"use client";

import React, {useEffect, useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import {useParams} from 'next/navigation';
import Link from 'next/link';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// 1. FIXED: Full Legacy ID Map
const LEGACY_ID_MAP: Record<number, string> = {
    // Trees
    1511: "Logs", 1521: "Oak logs", 1519: "Willow logs", 1515: "Yew logs", 1513: "Magic logs",
    // Ores
    436: "Copper ore", 438: "Tin ore", 440: "Iron ore", 453: "Coal",
    // Fish
    317: "Raw shrimps", 321: "Raw anchovies", 327: "Raw sardine", 345: "Raw herring",
    335: "Raw trout", 331: "Raw salmon", 349: "Raw pike", 359: "Raw tuna",
    371: "Raw swordfish", 377: "Raw lobster",

    // THE MISSING COMBAT DROPS
    995: "Coins",
    592: "Ashes",
    526: "Bones",
    532: "Big bones",
    554: "Fire rune",
    562: "Chaos rune",
    560: "Death rune",
    1061: "Leather boots",
    333: "Trout",
    9005: "Fancy boots",
    9006: "Fighter boots",
    12812: "Ironman platelegs",
    314: "Feather"
};

interface ItemSourceStat {
    sourceName: string;
    category: string;
    quantityDropped: number;
    timesDropped: number;
}

export default function IndividualItemPage() {
    const params = useParams();
    const rawTarget = decodeURIComponent(params.item as string);
    const itemNameTarget = rawTarget.replace(/_/g, ' ');
    const displayTitle = itemNameTarget.charAt(0).toUpperCase() + itemNameTarget.slice(1);

    const [isIronman, setIsIronman] = useState(false);
    const [sourceStats, setSourceStats] = useState<ItemSourceStat[]>([]);
    const [totalQuantity, setTotalQuantity] = useState(0);
    const [singleGePrice, setSingleGePrice] = useState(0);
    const [singleHaPrice, setSingleHaPrice] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchItemData() {
            setIsLoading(true);

            // Fetch logs with the 5000 limit
            const {data, error} = await supabase
                .from('loot_logs')
                .select('log_data')
                .order('id', {ascending: false})
                .limit(5000);

            if (error) console.error("Database Error:", error);

            if (data) {
                const statsMap: Record<string, ItemSourceStat> = {};
                let totalQty = 0;
                let ge = 0;
                let ha = 0;

                data.forEach((row: any) => {
                    const log = row.log_data;

                    // 2. FIXED: Added 'DROP' and 'PICKUP' to ignored actions
                    // if (log.action && ['BANK_DEPOSIT', 'BANK_WITHDRAWAL', 'CONSUME', 'DESTROY', 'DROP', 'PICKUP'].includes(log.action)) {
                    //     return;
                    // }

                    if (log.items && log.items.length > 0) {
                        log.items.forEach((item: any) => {
                            const currentName = item.name || LEGACY_ID_MAP[item.id] || `Unknown (ID: ${item.id})`;

                            if (currentName.toLowerCase() === itemNameTarget.toLowerCase()) {
                                const source = log.source || "Unknown Source";
                                const category = log.category || "Unknown";

                                if (!statsMap[source]) {
                                    statsMap[source] = {
                                        sourceName: source,
                                        category: category,
                                        quantityDropped: 0,
                                        timesDropped: 0
                                    };
                                }

                                statsMap[source].quantityDropped += item.qty;
                                statsMap[source].timesDropped += 1;
                                totalQty += item.qty;

                                if (ge === 0 && item.GE > 0) ge = item.GE / item.qty;
                                if (ha === 0 && item.HA > 0) ha = item.HA / item.qty;
                            }
                        });
                    }
                });

                setSourceStats(Object.values(statsMap).sort((a, b) => b.quantityDropped - a.quantityDropped));
                setTotalQuantity(totalQty);
                setSingleGePrice(ge);
                setSingleHaPrice(ha);
            }
            setIsLoading(false);
        }

        fetchItemData();
    }, [itemNameTarget]);

    const totalValue = totalQuantity * (isIronman ? singleHaPrice : singleGePrice);

    return (
        <div className="min-h-screen bg-[#121212] text-[#c8c8c8] font-sans p-8">
            <div className="max-w-[1000px] mx-auto">

                <div className="mb-6 text-sm">
                    <Link href="/" className="text-[#729fcf] hover:underline">Home</Link>
                    <span className="mx-2 text-gray-500">{'>'}</span>
                    <Link href="/items" className="text-[#729fcf] hover:underline">Items Collection</Link>
                    <span className="mx-2 text-gray-500">{'>'}</span>
                    <span className="text-gray-300">{displayTitle}</span>
                </div>

                <div
                    className="border-b border-[#3a3a3a] pb-4 mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
                    <div>
                        <h1 className="text-[32px] font-serif text-[#ffffff] font-normal tracking-wide flex items-center gap-3">
                            {displayTitle}
                        </h1>
                        <p className="text-gray-400 mt-2">
                            Acquisition history and wealth contribution.
                        </p>
                    </div>

                    <div className="flex gap-6 text-right">
                        <div>
                            <div className="text-sm text-gray-400 mb-1">Total Collected</div>
                            <div className="text-2xl font-bold text-white">{totalQuantity.toLocaleString()}</div>
                        </div>
                        <div>
                            <button
                                onClick={() => setIsIronman(!isIronman)}
                                className="text-xs px-2 py-1 mb-1 bg-[#2a2a2a] border border-[#3a3a3a] hover:bg-[#3a3a3a] text-[#c8c8c8] transition-colors"
                            >
                                {isIronman ? 'HA Value' : 'GE Value'}
                            </button>
                            <div
                                className="text-2xl font-bold text-[#cca052]">{Math.floor(totalValue).toLocaleString()} gp
                            </div>
                        </div>
                    </div>
                </div>

                <h2 className="text-[20px] font-serif text-[#ffffff] border-b border-[#3a3a3a] pb-1 mb-4">
                    Sources
                </h2>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-[#3a3a3a] text-sm bg-[#1e1e1e]">
                        <thead>
                        <tr className="bg-[#2a2a2a] text-white">
                            <th className="border border-[#3a3a3a] px-3 py-2 text-left font-bold">Acquired From</th>
                            <th className="border border-[#3a3a3a] px-3 py-2 text-center font-bold">Category</th>
                            <th className="border border-[#3a3a3a] px-3 py-2 text-center font-bold text-[#cca052]">Total
                                Received
                            </th>
                            <th className="border border-[#3a3a3a] px-3 py-2 text-right font-bold">Times
                                Dropped/Gathered
                            </th>
                        </tr>
                        </thead>
                        <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan={4}
                                    className="border border-[#3a3a3a] p-4 text-center text-gray-500 italic">Tracking
                                    item origins...
                                </td>
                            </tr>
                        ) : sourceStats.length === 0 ? (
                            <tr>
                                <td colSpan={4}
                                    className="border border-[#3a3a3a] p-4 text-center text-gray-500 italic">Item
                                    history not found.
                                </td>
                            </tr>
                        ) : (
                            sourceStats.map((stat, idx) => {
                                // 3. FIXED: Route properly to /monsters/ for combat drops
                                const linkTarget = stat.category === "Skilling"
                                    ? `/skilling/${stat.sourceName.replace(/ /g, '_')}`
                                    : `/monsters/${stat.sourceName.replace(/ /g, '_')}`;

                                return (
                                    <tr key={idx}
                                        className={idx % 2 === 0 ? "bg-[#1e1e1e]" : "bg-[#222222] hover:bg-[#333333] transition-colors"}>
                                        <td className="border border-[#3a3a3a] px-3 py-2">
                                            <Link href={linkTarget} className="text-[#729fcf] hover:underline">
                                                {stat.sourceName}
                                            </Link>
                                        </td>
                                        <td className="border border-[#3a3a3a] px-3 py-2 text-center text-gray-400">
                                            {stat.category}
                                        </td>
                                        <td className="border border-[#3a3a3a] px-3 py-2 text-center font-bold text-[#cca052]">
                                            {stat.quantityDropped.toLocaleString()}
                                        </td>
                                        <td className="border border-[#3a3a3a] px-3 py-2 text-right text-gray-400">
                                            {stat.timesDropped.toLocaleString()}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                        </tbody>
                    </table>
                </div>

            </div>
        </div>
    );
}