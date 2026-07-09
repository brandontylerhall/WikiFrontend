"use client";

import React, {useEffect, useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import WikiLayout from '@/components/WikiLayout';
import regionData from '@/data/regions.json';
import { useCharacter } from '@/lib/CharacterContext';

const regionDictionary: Record<string, string> = regionData;

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
    isLikelyJunk: boolean;
}

interface ShopDetailResult {
    region_id: number | null;
    total_spent: number;
    total_earned: number;
    stock: { name: string; qty: number; base_price: number; is_player_sold: boolean }[];
    purchases: { name: string; qty: number; total_cost: number }[];
    sales: { name: string; qty: number; total_revenue: number }[];
}

const formatAvg = (currency: number, qty: number) => {
    if (qty === 0) return 0;
    const exactAvg = currency / qty;
    return Number.isInteger(exactAvg) ? exactAvg.toString() : `~${Math.round(exactAvg)}`;
};

export default function IndividualShopPage() {
    const params = useParams();
    const { activeCharacter, isLoading: charLoading } = useCharacter();
    const rawShop = typeof params?.shop === 'string' ? params.shop : '';
    const shopName = decodeURIComponent(rawShop).replace(/_/g, ' ');

    const [isLoading, setIsLoading] = useState(true);
    const [shopStock, setShopStock] = useState<StockItem[]>([]);
    const [boughtItems, setBoughtItems] = useState<ShopItem[]>([]);
    const [soldItems, setSoldItems] = useState<ShopItem[]>([]);
    const [totalSpent, setTotalSpent] = useState(0);
    const [totalEarned, setTotalEarned] = useState(0);
    const [shopRegion, setShopRegion] = useState<string>("Unknown Location");

    useEffect(() => {
        setShopStock([]);
        setBoughtItems([]);
        setSoldItems([]);
        setTotalSpent(0);
        setTotalEarned(0);
        setShopRegion("Unknown Location");

        if (charLoading || !activeCharacter) {
            if (!charLoading) setIsLoading(false);
            return;
        }

        async function fetchShopData() {
            setIsLoading(true);

            const {data, error} = await supabase.rpc('get_shop_detail', {
                p_character_id: activeCharacter!.id,
                p_shop_name: shopName,
            });

            if (error) {
                console.error(error);
                setIsLoading(false);
                return;
            }

            const detail = data as ShopDetailResult | null;
            if (detail) {
                setShopStock((detail.stock || []).map(s => ({
                    name: s.name,
                    qty: Number(s.qty),
                    storeBasePrice: Number(s.base_price),
                    isLikelyJunk: !!s.is_player_sold,
                })));
                setBoughtItems((detail.purchases || []).map(p => ({
                    name: p.name,
                    totalQty: Number(p.qty),
                    totalCurrency: Number(p.total_cost),
                    currencyName: "Coins",
                })));
                setSoldItems((detail.sales || []).map(s => ({
                    name: s.name,
                    totalQty: Number(s.qty),
                    totalCurrency: Number(s.total_revenue),
                    currencyName: "Coins",
                })));
                setTotalSpent(Number(detail.total_spent) || 0);
                setTotalEarned(Number(detail.total_earned) || 0);
                setShopRegion(detail.region_id
                    ? (regionDictionary[String(detail.region_id)] || `Region ${detail.region_id}`)
                    : "Unknown Location");
            }
            setIsLoading(false);
        }

        if (shopName) fetchShopData();
    }, [shopName, activeCharacter, charLoading]);

    const displayedStock = shopStock;

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

                        {/* REARRANGED: Purchases and Sales rendered BEFORE Inventory Stock */}

                        <h2 className="text-[22px] font-serif text-[#ffffff] border-b border-[#3a3a3a] pb-2 mb-4">Your Purchases</h2>
                        <div className="overflow-x-auto mb-10">
                            <table className="w-full border-collapse border border-[#3a3a3a] text-sm bg-[#1e1e1e]">
                                <thead>
                                <tr className="bg-[#2a2a2a] text-white">
                                    <th className="border border-[#3a3a3a] px-3 py-2 text-left font-bold w-1/3">Item</th>
                                    <th className="border border-[#3a3a3a] px-3 py-2 text-center font-bold">Qty Bought</th>
                                    <th className="border border-[#3a3a3a] px-3 py-2 text-right font-bold text-[#80c8ff]">Avg Paid (ea)</th>
                                    <th className="border border-[#3a3a3a] px-3 py-2 text-right font-bold text-[#ff6666]">Total Cost</th>
                                </tr>
                                </thead>
                                <tbody>
                                {isLoading ? (
                                    <tr><td colSpan={4} className="p-4 text-center text-gray-500 italic">Scanning ledgers...</td></tr>
                                ) : boughtItems.length === 0 ? (
                                    <tr><td colSpan={4} className="p-4 text-center text-gray-500 italic">You haven't bought anything here.</td></tr>
                                ) : (
                                    boughtItems.map((item, idx) => (
                                        <tr key={idx} className={idx % 2 === 0 ? "bg-[#1e1e1e]" : "bg-[#222222]"}>
                                            <td className="border border-[#3a3a3a] px-3 py-2"><Link href={`/items/${item.name.replace(/ /g, '_')}`} className="text-[#729fcf] hover:underline">{item.name}</Link></td>
                                            <td className="border border-[#3a3a3a] px-3 py-2 text-center text-white">{item.totalQty.toLocaleString()}</td>
                                            <td className="border border-[#3a3a3a] px-3 py-2 text-right font-mono text-[#80c8ff]">{formatAvg(item.totalCurrency, item.totalQty)}</td>
                                            <td className="border border-[#3a3a3a] px-3 py-2 text-right text-gray-300">-{item.totalCurrency.toLocaleString()}</td>
                                        </tr>
                                    ))
                                )}
                                </tbody>
                            </table>
                        </div>

                        <h2 className="text-[22px] font-serif text-[#ffffff] border-b border-[#3a3a3a] pb-2 mb-4">Items Liquidated</h2>
                        <div className="overflow-x-auto mb-10">
                            <table className="w-full border-collapse border border-[#3a3a3a] text-sm bg-[#1e1e1e] table-fixed">
                                <thead>
                                <tr className="bg-[#2a2a2a] text-white">
                                    <th className="border border-[#3a3a3a] px-3 py-2 text-left font-bold w-1/3">Item</th>
                                    <th className="border border-[#3a3a3a] px-3 py-2 text-center font-bold">Qty Sold</th>
                                    <th className="border border-[#3a3a3a] px-3 py-2 text-right font-bold text-[#80c8ff]">Avg Received (ea)</th>
                                    <th className="border border-[#3a3a3a] px-3 py-2 text-right font-bold text-[#90ff90]">Total Revenue</th>
                                </tr>
                                </thead>
                                <tbody>
                                {isLoading ? (
                                    <tr><td colSpan={4} className="p-4 text-center text-gray-500 italic">Scanning ledgers...</td></tr>
                                ) : soldItems.length === 0 ? (
                                    <tr><td colSpan={4} className="p-4 text-center text-gray-500 italic">You haven't sold anything here.</td></tr>
                                ) : (
                                    soldItems.map((item, idx) => (
                                        <tr key={idx} className={idx % 2 === 0 ? "bg-[#1e1e1e]" : "bg-[#222222]"}>
                                            <td className="border border-[#3a3a3a] px-3 py-2"><Link href={`/items/${item.name.replace(/ /g, '_')}`} className="text-[#729fcf] hover:underline">{item.name}</Link></td>
                                            <td className="border border-[#3a3a3a] px-3 py-2 text-center text-white">{item.totalQty.toLocaleString()}</td>
                                            <td className="border border-[#3a3a3a] px-3 py-2 text-right font-mono text-[#80c8ff]">{formatAvg(item.totalCurrency, item.totalQty)}</td>
                                            <td className="border border-[#3a3a3a] px-3 py-2 text-right text-gray-300">+{item.totalCurrency.toLocaleString()}</td>
                                        </tr>
                                    ))
                                )}
                                </tbody>
                            </table>
                        </div>

                        {/* Inventory moved to bottom */}
                        <div className="flex justify-between items-end border-b border-[#3a3a3a] pb-2 mb-4">
                            <h2 className="text-[22px] font-serif text-[#ffffff]">Observed Base Stock</h2>
                        </div>

                        <div className="overflow-x-auto mb-10">
                            <table className="w-full border-collapse border border-[#3a3a3a] text-sm bg-[#1e1e1e]">
                                <thead>
                                <tr className="bg-[#2a2a2a] text-white">
                                    <th className="border border-[#3a3a3a] px-3 py-2 text-left font-bold w-1/2">Item in Stock</th>
                                    <th className="border border-[#3a3a3a] px-3 py-2 text-center font-bold">Base Quantity</th>
                                    <th className="border border-[#3a3a3a] px-3 py-2 text-right font-bold text-[#cca052]">Store Base Price</th>
                                </tr>
                                </thead>
                                <tbody>
                                {isLoading ? (
                                    <tr><td colSpan={3} className="p-4 text-center text-gray-500 italic">Reading shop interface...</td></tr>
                                ) : displayedStock.length === 0 ? (
                                    <tr><td colSpan={3} className="p-4 text-center text-gray-500 italic">No inventory snapshot found for this shop. Open it in-game!</td></tr>
                                ) : (
                                    displayedStock.map((item, idx) => (
                                        <tr key={idx} className={idx % 2 === 0 ? "bg-[#1e1e1e]" : "bg-[#222222]"}>
                                            <td className="border border-[#3a3a3a] px-3 py-2">
                                                <div className="flex items-center gap-2">
                                                    <Link href={`/items/${item.name.replace(/ /g, '_')}`} className="text-[#729fcf] hover:underline">
                                                        {item.name}
                                                    </Link>
                                                    {item.isLikelyJunk && (
                                                        <span className="text-[10px] text-[#ff6666] ml-2 border border-[#ff6666]/30 px-1 rounded bg-[#ff6666]/10" title="This is likely an item sold by another player.">
                                                            Player Sold
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="border border-[#3a3a3a] px-3 py-2 text-center text-white font-bold">{item.qty === 0 ? "Out of Stock" : item.qty.toLocaleString()}</td>
                                            <td className="border border-[#3a3a3a] px-3 py-2 text-right font-mono text-gray-400">{item.storeBasePrice.toLocaleString()} gp</td>
                                        </tr>
                                    ))
                                )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="w-full lg:w-[320px] order-1 lg:order-2 shrink-0">
                        <table className="w-full border-collapse border border-[#3a3a3a] bg-[#1e1e1e] text-[13px]">
                            <tbody>
                            <tr>
                                <th colSpan={2} className="bg-[#cca052] text-black text-[16px] p-2 border-b border-[#3a3a3a] text-center font-bold">
                                    {shopName}
                                </th>
                            </tr>
                            <tr>
                                <td colSpan={2} className="p-4 text-center border-b border-[#3a3a3a] bg-[#222222]">
                                    <div className="w-[150px] h-[150px] mx-auto flex items-center justify-center text-gray-500 italic border border-[#3a3a3a]">
                                        [Shop Interface]
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <th colSpan={2} className="bg-[#cca052] text-black p-1 text-center border-y border-[#3a3a3a] font-bold">
                                    Merchant Ledger
                                </th>
                            </tr>
                            <tr className="bg-[#1e1e1e]">
                                <th className="p-2 border border-[#3a3a3a] text-left w-2/5 font-normal text-[#c8c8c8]">Total Transactions</th>
                                <td className="p-2 border border-[#3a3a3a] text-right text-[#ffffff]">{(boughtItems.length + soldItems.length).toLocaleString()}</td>
                            </tr>
                            <tr className="bg-[#222222]">
                                <th className="p-2 border border-[#3a3a3a] text-left font-normal text-[#c8c8c8]">Total Spent</th>
                                <td className="p-2 border border-[#3a3a3a] text-right text-[#ff6666] font-bold">-{totalSpent.toLocaleString()}</td>
                            </tr>
                            <tr className="bg-[#1e1e1e]">
                                <th className="p-2 border border-[#3a3a3a] text-left font-normal text-[#c8c8c8]">Total Earned</th>
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