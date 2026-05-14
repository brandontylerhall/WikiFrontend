"use client";

import React, {useEffect, useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import WikiLayout from '@/components/WikiLayout';
import regionData from '@/data/regions.json';

const regionDictionary: Record<string, string> = regionData;

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// OSRS Base stock rarely uses irregular numbers. This helps filter junk on the very first visit.
const STANDARD_SHOP_QTYS = new Set([
    0, 1, 2, 3, 4, 5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 75, 80, 100, 150, 200, 250, 300, 400, 500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 10000
]);

interface ShopItem {
    name: string;
    totalQty: number;
    totalCurrency: number;
    currencyName: string;
}

interface StockItem {
    name: string;
    qty: number;
    storeBasePrice: number;
    presenceScore: number;
    isLikelyJunk: boolean;
    sortIndex: number; // NEW
}

export default function IndividualShopPage() {
    const params = useParams();
    const rawShop = typeof params?.shop === 'string' ? params.shop : '';
    const shopName = decodeURIComponent(rawShop).replace(/_/g, ' ');

    const [isLoading, setIsLoading] = useState(true);
    const [shopStock, setShopStock] = useState<StockItem[]>([]);
    const [boughtItems, setBoughtItems] = useState<ShopItem[]>([]);
    const [soldItems, setSoldItems] = useState<ShopItem[]>([]);
    const [totalSpent, setTotalSpent] = useState(0);
    const [totalEarned, setTotalEarned] = useState(0);
    const [shopRegion, setShopRegion] = useState<string>("Unknown Location");

    const [cleanStock, setCleanStock] = useState(true);

    useEffect(() => {
        async function fetchShopData() {
            setIsLoading(true);

            const {data, error} = await supabase
                .from('loot_logs')
                .select('log_data')
                .eq('log_data->>category', 'Shopping')
                .ilike('log_data->>source', shopName)
                .order('id', {ascending: false})
                .limit(5000);

            if (error) {
                console.error(error);
                setIsLoading(false);
                return;
            }

            const transactions: Record<string, { bought: any[], sold: any[], spent: any[], received: any[] }> = {};
            const rawSnapshots: { ts: number, items: any[] }[] = [];
            let latestRegion = "Unknown Location";

            data?.forEach(row => {
                const log = row.log_data as any;
                const ts = new Date(log.timestamp).getTime();
                const action = (log.eventType || "").toUpperCase();

                if (log.regionId) latestRegion = regionDictionary[String(log.regionId)] || `Region ${log.regionId}`;

                if (action === 'SHOP_SNAPSHOT') {
                    if (log.items && log.items.length > 0) {
                        rawSnapshots.push({ts, items: log.items});
                    }
                }

                if (!transactions[ts]) transactions[ts] = {bought: [], sold: [], spent: [], received: []};

                if (action === 'SHOP_BUY') transactions[ts].bought.push(...(log.items || []));
                if (action === 'SHOP_SELL') transactions[ts].sold.push(...(log.items || []));
                if (action === 'SHOP_SPEND') transactions[ts].spent.push(...(log.items || []));
                if (action === 'SHOP_RECEIVE') transactions[ts].received.push(...(log.items || []));
            });

            // --- DATA SCIENCE: TIME-CLUSTERED SNAPSHOTS ---
            rawSnapshots.sort((a, b) => a.ts - b.ts);
            const distinctVisits: any[][] = [];
            let currentGroup: any[][] = [];
            let groupStartTime = 0;

            rawSnapshots.forEach(snap => {
                if (groupStartTime === 0 || snap.ts - groupStartTime > 1000 * 60 * 60 * 2) {
                    if (currentGroup.length > 0) {
                        const mergedMap = new Map<string, any>();
                        currentGroup.forEach(items => {
                            items.forEach((item, index) => {
                                if (!mergedMap.has(item.name)) mergedMap.set(item.name, {...item, sortIndex: index});
                                else {
                                    if (item.qty > mergedMap.get(item.name).qty) mergedMap.get(item.name).qty = item.qty;
                                    mergedMap.get(item.name).sortIndex = Math.min(mergedMap.get(item.name).sortIndex, index);
                                }
                            });
                        });
                        distinctVisits.push(Array.from(mergedMap.values()));
                    }
                    currentGroup = [snap.items];
                    groupStartTime = snap.ts;
                } else {
                    currentGroup.push(snap.items);
                }
            });
            if (currentGroup.length > 0) {
                const mergedMap = new Map<string, any>();
                currentGroup.forEach(items => {
                    items.forEach((item, index) => {
                        if (!mergedMap.has(item.name)) mergedMap.set(item.name, {...item, sortIndex: index});
                        else {
                            if (item.qty > mergedMap.get(item.name).qty) mergedMap.get(item.name).qty = item.qty;
                            mergedMap.get(item.name).sortIndex = Math.min(mergedMap.get(item.name).sortIndex, index);
                        }
                    });
                });
                distinctVisits.push(Array.from(mergedMap.values()));
            }

            const totalVisits = distinctVisits.length;

            // NEW: Added sortIndex to the tracking map
            const itemPresence: Record<string, {
                presenceCount: number,
                maxQty: number,
                exactBasePrice: number,
                sortIndex: number
            }> = {};

            distinctVisits.forEach(visitItems => {
                // NEW: Grab the index from the array
                visitItems.forEach((item: any, index: number) => {
                    const itemName = item.name;
                    if (!itemPresence[itemName]) {
                        itemPresence[itemName] = {
                            presenceCount: 0,
                            maxQty: 0,
                            exactBasePrice: item.basePrice
                                ? (item.basePrice / item.qty)
                                : Math.max(1, Math.round((item.HA / item.qty) / 0.6)),
                            sortIndex: item.sortIndex !== undefined ? item.sortIndex : index
                        };
                    } else {
                        // Base stock is always at the top. Save the lowest slot index seen.
                        itemPresence[itemName].sortIndex = Math.min(itemPresence[itemName].sortIndex, item.sortIndex !== undefined ? item.sortIndex : index);
                    }

                    itemPresence[itemName].presenceCount += 1;
                    if (item.qty > itemPresence[itemName].maxQty) {
                        itemPresence[itemName].maxQty = item.qty;
                    }
                });
            });

            const capturedStock = Object.entries(itemPresence)
                .map(([name, data]) => {
                    const presenceScore = Math.round((data.presenceCount / totalVisits) * 100);

                    let isLikelyJunk = false;
                    if (totalVisits > 1 && presenceScore < 100) {
                        isLikelyJunk = true;
                    } else if (totalVisits === 1 && !STANDARD_SHOP_QTYS.has(data.maxQty)) {
                        isLikelyJunk = true;
                    }

                    return {
                        name,
                        qty: data.maxQty,
                        storeBasePrice: data.exactBasePrice,
                        presenceScore,
                        isLikelyJunk,
                        sortIndex: data.sortIndex
                    };
                })
                .sort((a, b) => a.sortIndex - b.sortIndex); // NEW: Sort by In-Game Slot order

            // --- PROCESS TRANSACTIONS ---
            const boughtMap = new Map<string, ShopItem>();
            const soldMap = new Map<string, ShopItem>();
            let spentTally = 0;
            let earnedTally = 0;

            Object.values(transactions).forEach(tx => {
                if (tx.bought.length > 0 && tx.spent.length > 0) {
                    const item = tx.bought[0];
                    const currency = tx.spent[0];
                    if (!boughtMap.has(item.name)) boughtMap.set(item.name, {
                        name: item.name,
                        totalQty: 0,
                        totalCurrency: 0,
                        currencyName: currency.name
                    });
                    const stat = boughtMap.get(item.name)!;
                    stat.totalQty += item.qty;
                    stat.totalCurrency += currency.qty;
                    spentTally += currency.qty;
                }
                if (tx.sold.length > 0 && tx.received.length > 0) {
                    const item = tx.sold[0];
                    const currency = tx.received[0];
                    if (!soldMap.has(item.name)) soldMap.set(item.name, {
                        name: item.name,
                        totalQty: 0,
                        totalCurrency: 0,
                        currencyName: currency.name
                    });
                    const stat = soldMap.get(item.name)!;
                    stat.totalQty += item.qty;
                    stat.totalCurrency += currency.qty;
                    earnedTally += currency.qty;
                }
            });

            setShopStock(capturedStock);
            setBoughtItems(Array.from(boughtMap.values()).sort((a, b) => b.totalQty - a.totalQty));
            setSoldItems(Array.from(soldMap.values()).sort((a, b) => b.totalCurrency - a.totalCurrency));
            setTotalSpent(spentTally);
            setTotalEarned(earnedTally);
            setShopRegion(latestRegion);
            setIsLoading(false);
        }

        if (shopName) fetchShopData();
    }, [shopName]);

    const displayedStock = cleanStock ? shopStock.filter(item => !item.isLikelyJunk) : shopStock;

    return (
        <WikiLayout>
            <div className="w-full p-6 text-[14px] leading-relaxed">
                <div className="mb-6 text-sm">
                    <Link href="/" className="text-[#729fcf] hover:underline">Home</Link> ›
                    <Link href="/shops" className="text-[#729fcf] hover:underline">Shops</Link> ›
                    <span className="text-gray-300"> {shopName}</span>
                </div>

                <div className="border-b border-[#3a3a3a] pb-6 mb-8 flex justify-between items-end">
                    <div>
                        <h1 className="text-[32px] font-serif text-white tracking-wide">{shopName}</h1>
                        <p className="text-lg mt-1 text-gray-400">
                            Located in <span className="text-[#729fcf]">{shopRegion}</span>
                        </p>
                    </div>

                    <div className="flex gap-8 text-right">
                        <div>
                            <div className="text-sm text-gray-400">Total Spent</div>
                            <div className="text-2xl font-bold text-[#ff6666]">-{totalSpent.toLocaleString()} gp</div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-400">Total Earned</div>
                            <div className="text-2xl font-bold text-[#90ff90]">+{totalEarned.toLocaleString()} gp</div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-8 items-start">
                    <div className="flex-1 w-full order-2 lg:order-1">

                        <div className="flex justify-between items-end border-b border-[#3a3a3a] pb-2 mb-4">
                            <h2 className="text-[22px] font-serif text-[#ffffff]">Observed Base Stock</h2>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setCleanStock(!cleanStock)}
                                    className={`text-xs px-2 py-1 border transition-colors ${cleanStock ? 'bg-[#cca052] text-black border-[#cca052]' : 'bg-[#2a2a2a] text-[#c8c8c8] border-[#3a3a3a] hover:bg-[#3a3a3a]'}`}
                                >
                                    {cleanStock ? 'Junk Filter: ON' : 'Junk Filter: OFF'}
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto mb-10">
                            <table className="w-full border-collapse border border-[#3a3a3a] text-sm bg-[#1e1e1e]">
                                <thead>
                                <tr className="bg-[#2a2a2a] text-white">
                                    <th className="border border-[#3a3a3a] px-3 py-2 text-left font-bold w-1/2">Item in
                                        Stock
                                    </th>
                                    <th className="border border-[#3a3a3a] px-3 py-2 text-center font-bold">Base
                                        Quantity
                                    </th>
                                    <th className="border border-[#3a3a3a] px-3 py-2 text-right font-bold text-[#cca052]">Store
                                        Base Price
                                    </th>
                                </tr>
                                </thead>
                                <tbody>
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={3} className="p-4 text-center text-gray-500 italic">Reading shop
                                            interface...
                                        </td>
                                    </tr>
                                ) : displayedStock.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="p-4 text-center text-gray-500 italic">No inventory
                                            snapshot found for this shop. Open it in-game!
                                        </td>
                                    </tr>
                                ) : (
                                    displayedStock.map((item, idx) => {
                                        return (
                                            <tr key={idx} className={idx % 2 === 0 ? "bg-[#1e1e1e]" : "bg-[#222222]"}>
                                                <td className="border border-[#3a3a3a] px-3 py-2">
                                                    <div className="flex items-center gap-2">
                                                        <Link href={`/items/${item.name.replace(/ /g, '_')}`}
                                                              className="text-[#729fcf] hover:underline">
                                                            {item.name}
                                                        </Link>
                                                        {item.isLikelyJunk && (
                                                            <span
                                                                className="text-[10px] text-[#ff6666] ml-2 border border-[#ff6666]/30 px-1 rounded bg-[#ff6666]/10"
                                                                title="This is likely an item sold by another player.">
                                                                Player Sold
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="border border-[#3a3a3a] px-3 py-2 text-center text-white font-bold">{item.qty === 0 ? "Out of Stock" : item.qty.toLocaleString()}</td>
                                                <td className="border border-[#3a3a3a] px-3 py-2 text-right font-mono text-gray-400">{item.storeBasePrice.toLocaleString()} gp</td>
                                            </tr>
                                        );
                                    })
                                )}
                                </tbody>
                            </table>
                        </div>

                        <h2 className="text-[22px] font-serif text-[#ffffff] border-b border-[#3a3a3a] pb-2 mb-4">Your
                            Purchases</h2>
                        <div className="overflow-x-auto mb-10">
                            <table className="w-full border-collapse border border-[#3a3a3a] text-sm bg-[#1e1e1e]">
                                <thead>
                                <tr className="bg-[#2a2a2a] text-white">
                                    <th className="border border-[#3a3a3a] px-3 py-2 text-left font-bold w-1/3">Item</th>
                                    <th className="border border-[#3a3a3a] px-3 py-2 text-center font-bold">Qty Bought
                                    </th>
                                    <th className="border border-[#3a3a3a] px-3 py-2 text-right font-bold text-[#80c8ff]">Avg
                                        Paid (ea)
                                    </th>
                                    <th className="border border-[#3a3a3a] px-3 py-2 text-right font-bold text-[#ff6666]">Total
                                        Cost
                                    </th>
                                </tr>
                                </thead>
                                <tbody>
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={4} className="p-4 text-center text-gray-500 italic">Scanning
                                            ledgers...
                                        </td>
                                    </tr>
                                ) : boughtItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="p-4 text-center text-gray-500 italic">You haven't
                                            bought anything here.
                                        </td>
                                    </tr>
                                ) : (
                                    boughtItems.map((item, idx) => {
                                        const avgPrice = Math.round(item.totalCurrency / item.totalQty);
                                        return (
                                            <tr key={idx} className={idx % 2 === 0 ? "bg-[#1e1e1e]" : "bg-[#222222]"}>
                                                <td className="border border-[#3a3a3a] px-3 py-2"><Link
                                                    href={`/items/${item.name.replace(/ /g, '_')}`}
                                                    className="text-[#729fcf] hover:underline">{item.name}</Link></td>
                                                <td className="border border-[#3a3a3a] px-3 py-2 text-center text-white">{item.totalQty.toLocaleString()}</td>
                                                <td className="border border-[#3a3a3a] px-3 py-2 text-right font-mono text-[#80c8ff]">~{avgPrice}</td>
                                                <td className="border border-[#3a3a3a] px-3 py-2 text-right text-gray-300">-{item.totalCurrency.toLocaleString()}</td>
                                            </tr>
                                        );
                                    })
                                )}
                                </tbody>
                            </table>
                        </div>

                        <h2 className="text-[22px] font-serif text-[#ffffff] border-b border-[#3a3a3a] pb-2 mb-4">Items
                            Liquidated</h2>
                        <div className="overflow-x-auto mb-8">
                            <table
                                className="w-full border-collapse border border-[#3a3a3a] text-sm bg-[#1e1e1e] table-fixed">
                                <thead>
                                <tr className="bg-[#2a2a2a] text-white">
                                    <th className="border border-[#3a3a3a] px-3 py-2 text-left font-bold w-1/3">Item</th>
                                    <th className="border border-[#3a3a3a] px-3 py-2 text-center font-bold">Qty Sold
                                    </th>
                                    <th className="border border-[#3a3a3a] px-3 py-2 text-right font-bold text-[#80c8ff]">Avg
                                        Received (ea)
                                    </th>
                                    <th className="border border-[#3a3a3a] px-3 py-2 text-right font-bold text-[#90ff90]">Total
                                        Revenue
                                    </th>
                                </tr>
                                </thead>
                                <tbody>
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={4} className="p-4 text-center text-gray-500 italic">Scanning
                                            ledgers...
                                        </td>
                                    </tr>
                                ) : soldItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="p-4 text-center text-gray-500 italic">You haven't
                                            sold anything here.
                                        </td>
                                    </tr>
                                ) : (
                                    soldItems.map((item, idx) => {
                                        const avgPrice = Math.round(item.totalCurrency / item.totalQty);
                                        return (
                                            <tr key={idx} className={idx % 2 === 0 ? "bg-[#1e1e1e]" : "bg-[#222222]"}>
                                                <td className="border border-[#3a3a3a] px-3 py-2"><Link
                                                    href={`/items/${item.name.replace(/ /g, '_')}`}
                                                    className="text-[#729fcf] hover:underline">{item.name}</Link></td>
                                                <td className="border border-[#3a3a3a] px-3 py-2 text-center text-white">{item.totalQty.toLocaleString()}</td>
                                                <td className="border border-[#3a3a3a] px-3 py-2 text-right font-mono text-[#80c8ff]">~{avgPrice}</td>
                                                <td className="border border-[#3a3a3a] px-3 py-2 text-right text-gray-300">+{item.totalCurrency.toLocaleString()}</td>
                                            </tr>
                                        );
                                    })
                                )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* WIKI INFOBOX */}
                    <div className="w-full lg:w-[320px] order-1 lg:order-2 shrink-0">
                        <table className="w-full border-collapse border border-[#3a3a3a] bg-[#1e1e1e] text-[13px]">
                            <tbody>
                            <tr>
                                <th colSpan={2}
                                    className="bg-[#cca052] text-black text-[16px] p-2 border-b border-[#3a3a3a] text-center font-bold">
                                    {shopName}
                                </th>
                            </tr>
                            <tr>
                                <td colSpan={2} className="p-4 text-center border-b border-[#3a3a3a] bg-[#222222]">
                                    <div
                                        className="w-[150px] h-[150px] mx-auto flex items-center justify-center text-gray-500 italic border border-[#3a3a3a]">
                                        [Shop Interface]
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <th colSpan={2}
                                    className="bg-[#cca052] text-black p-1 text-center border-y border-[#3a3a3a] font-bold">
                                    Merchant Ledger
                                </th>
                            </tr>
                            <tr className="bg-[#1e1e1e]">
                                <th className="p-2 border border-[#3a3a3a] text-left w-2/5 font-normal text-[#c8c8c8]">Total
                                    Transactions
                                </th>
                                <td className="p-2 border border-[#3a3a3a] text-right text-[#ffffff]">{(boughtItems.length + soldItems.length).toLocaleString()}</td>
                            </tr>
                            <tr className="bg-[#222222]">
                                <th className="p-2 border border-[#3a3a3a] text-left font-normal text-[#c8c8c8]">Total
                                    Spent
                                </th>
                                <td className="p-2 border border-[#3a3a3a] text-right text-[#ff6666] font-bold">-{totalSpent.toLocaleString()}</td>
                            </tr>
                            <tr className="bg-[#1e1e1e]">
                                <th className="p-2 border border-[#3a3a3a] text-left font-normal text-[#c8c8c8]">Total
                                    Earned
                                </th>
                                <td className="p-2 border border-[#3a3a3a] text-right text-[#90ff90] font-bold">+{totalEarned.toLocaleString()}</td>
                            </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </WikiLayout>
    );
}