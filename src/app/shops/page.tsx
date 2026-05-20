"use client";

import React, {useEffect, useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import Link from 'next/link';
import WikiLayout from "@/components/WikiLayout";
import regionData from '@/data/regions.json';
import {DatabaseRow, LogItem} from '@/lib/types';

const regionDictionary: Record<string, string> = regionData;

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ShopPreview {
    name: string;
    netProfit: number;
    regionName: string;
}

export default function ShopsHub() {
    const [shops, setShops] = useState<ShopPreview[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [sortMode, setSortMode] = useState<"alpha" | "profit" | "loss">("alpha");

    useEffect(() => {
        async function fetchShops() {
            setIsLoading(true);
            const {data} = await supabase
                .from('loot_logs')
                .select('log_data')
                .eq('log_data->>category', 'Shopping')
                .order('id', {ascending: false})
                .limit(10000);

            if (data) {
                const shopMap: Record<string, ShopPreview> = {};

                data.forEach((row: DatabaseRow) => {
                    const log = row.log_data;
                    if (!log) return;

                    const shopName = log.source;
                    const action = (log.eventType || "").toUpperCase();

                    if (!shopName) return;

                    if (!shopMap[shopName]) {
                        const rId = log.regionId ? String(log.regionId) : "Unknown";
                        const regionName = regionDictionary[rId] || (log.regionId ? `Region ${log.regionId}` : "Unknown Location");
                        shopMap[shopName] = { name: shopName, netProfit: 0, regionName };
                    }

                    if (action === 'SHOP_TRANSACTION') {
                        const gained = log.items || [];
                        const gainedCoins = gained.find((i: LogItem) => i.name === "Coins");

                        if (gainedCoins) {
                            shopMap[shopName].netProfit += gainedCoins.qty;
                        } else {
                            if (log.note && log.note.includes("Spent:")) {
                                const match = log.note.match(/Spent:\s*(\d+)x\s*(.*)/);
                                if (match && (!match[2] || match[2].trim() === "Coins")) {
                                    shopMap[shopName].netProfit -= parseInt(match[1], 10);
                                }
                            }
                        }
                    } else if (action === 'SHOP_SPEND') {
                        const coins = log.items?.[0]?.qty || 0;
                        shopMap[shopName].netProfit -= coins;
                    } else if (action === 'SHOP_RECEIVE') {
                        const coins = log.items?.[0]?.qty || 0;
                        shopMap[shopName].netProfit += coins;
                    }
                });

                setShops(Object.values(shopMap));
            }
            setIsLoading(false);
        }

        fetchShops();
    }, []);

    const sortedShops = [...shops].sort((a, b) => {
        if (sortMode === "alpha") return a.name.localeCompare(b.name);
        if (sortMode === "profit") return b.netProfit - a.netProfit;
        return a.netProfit - b.netProfit; // "loss"
    });

    return (
        <WikiLayout>
            <div className="w-full p-6 text-[14px] leading-relaxed">
                <div className="mb-6 text-sm">
                    <Link href="/" className="text-[#729fcf] hover:underline">Home</Link>
                    <span className="mx-2 text-gray-500">{'>'}</span>
                    <span className="text-gray-300">Shops</span>
                </div>

                <div className="border-b border-[#3a3a3a] pb-4 mb-6">
                    <h1 className="text-[32px] font-serif text-[#ffffff] font-normal tracking-wide">
                        Gielinor Shops Directory
                    </h1>
                    <p className="text-gray-400 mt-2">
                        A record of merchants and general stores you have interacted with.
                    </p>
                </div>

                <div className="mb-6 flex gap-2 items-center">
                    <span className="text-xs text-gray-500 mr-1 uppercase font-mono">Sort By:</span>
                    <button
                        onClick={() => setSortMode("alpha")}
                        className={`px-3 py-1 text-xs border transition-colors ${
                            sortMode === "alpha" ? "bg-[#cca052] text-black border-[#cca052]" : "bg-[#2a2a2a] border-[#3a3a3a] text-gray-300 hover:bg-[#3a3a3a]"
                        }`}
                    >
                        A–Z
                    </button>
                    <button
                        onClick={() => setSortMode("profit")}
                        className={`px-3 py-1 text-xs border transition-colors ${
                            sortMode === "profit" ? "bg-[#cca052] text-black border-[#cca052]" : "bg-[#2a2a2a] border-[#3a3a3a] text-gray-300 hover:bg-[#3a3a3a]"
                        }`}
                    >
                        Highest Profit
                    </button>
                    <button
                        onClick={() => setSortMode("loss")}
                        className={`px-3 py-1 text-xs border transition-colors ${
                            sortMode === "loss" ? "bg-[#cca052] text-black border-[#cca052]" : "bg-[#2a2a2a] border-[#3a3a3a] text-gray-300 hover:bg-[#3a3a3a]"
                        }`}
                    >
                        Highest Loss
                    </button>
                </div>

                {isLoading ? (
                    <div className="text-center p-12 text-gray-500 italic border border-[#3a3a3a] bg-[#1e1e1e]">
                        Scanning merchant records...
                    </div>
                ) : sortedShops.length === 0 ? (
                    <div className="text-center p-12 text-gray-500 italic border border-[#3a3a3a] bg-[#1e1e1e]">
                        You haven't visited any shops yet. Go open a store interface in-game!
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {sortedShops.map(shop => {
                            const urlFriendlyName = shop.name.replace(/ /g, '_');
                            return (
                                <Link
                                    key={shop.name}
                                    href={`/shops/${urlFriendlyName}`}
                                    className="bg-[#1e1e1e] border border-[#3a3a3a] p-4 flex flex-col items-center justify-center hover:bg-[#2a2a2a] hover:border-[#cca052] transition-all group"
                                >
                                    <span className="font-bold text-[#729fcf] group-hover:text-[#cca052] text-center leading-tight">
                                        {shop.name}
                                    </span>
                                    <span className="text-[11px] text-gray-500 mb-2 mt-1 text-center uppercase tracking-wide truncate w-full">
                                        {shop.regionName}
                                    </span>
                                    {shop.netProfit !== 0 ? (
                                        <span className={`text-xs font-mono px-2 py-1 border border-[#3a3a3a] rounded bg-black ${shop.netProfit > 0 ? "text-[#90ff90]" : "text-[#ff6666]"}`}>
                                            Net: {shop.netProfit > 0 ? "+" : ""}{shop.netProfit.toLocaleString()} gp
                                        </span>
                                    ) : (
                                        <span className="text-xs font-mono text-gray-400 bg-black px-2 py-1 border border-[#3a3a3a] rounded">
                                            No Transactions
                                        </span>
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </WikiLayout>
    );
}