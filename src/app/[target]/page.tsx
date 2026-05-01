"use client";

import React, {useEffect, useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import {useParams, useRouter} from 'next/navigation';
import Link from 'next/link';
import regionData from '@/data/regions.json';
import {LEGACY_ID_MAP} from '@/lib/constants';
import {categorizeItem, CATEGORY_ORDER} from '@/lib/utils';
import WikiLayout from "@/components/WikiLayout";
import {DatabaseRow, LogItem, AggregatedDrop, AggregatedLocation} from '@/lib/types';

const regionDictionary: Record<string, string> = regionData;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- INTERFACES ---
interface RawDropRecord {
    name: string;
    qty: number;
    count: number;
    gePrice: number;
    haPrice: number;
    firstKc: number;
}

// Utility to calculate the 1/X rarity fraction
function getRarity(count: number, total: number) {
    if (total === 0) return "-";
    if (count === total) return "Always";
    const fraction = total / count;
    return `1/${Number.isInteger(fraction) ? fraction : fraction.toFixed(2)}`;
}

export default function DynamicWikiPage() {
    const params = useParams();
    const router = useRouter();

    // Use target or monster depending on what you named your folder!
    const rawTarget = decodeURIComponent((params.target as string) || (params.monster as string) || "Unknown");

    // Instantly redirect spaces to underscores in the URL bar
    useEffect(() => {
        if (rawTarget.includes(' ')) {
            const standardizedUrl = rawTarget.replace(/ /g, '_');
            // Update this routing path if you use /monsters/ instead!
            router.replace(`/${standardizedUrl}`);
        }
    }, [rawTarget, router]);

    const targetName = rawTarget.replace(/_/g, ' ');
    const displayTitle = targetName.charAt(0).toUpperCase() + targetName.slice(1);

    const [isIronman, setIsIronman] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [totalKills, setTotalKills] = useState(0);
    const [aggregatedDrops, setAggregatedDrops] = useState<AggregatedDrop[]>([]);
    const [aggregatedLocations, setAggregatedLocations] = useState<AggregatedLocation[]>([]);

    const totalValue = aggregatedDrops
        .filter(drop => !drop.isSummary)
        .reduce((acc, drop) => acc + ((isIronman ? drop.haPrice : drop.gePrice) * drop.totalQty), 0);

    const gpPerKill = totalKills > 0 ? Math.floor(totalValue / totalKills) : 0;

    function processAnalytics(rawData: DatabaseRow[]) {
        const kills = rawData.length;
        setTotalKills(kills);

        const locMap: Record<string, number> = {};

        // Time-travel loop to find First KC
        const firstKcMap: Record<string, number> = {};
        for (let i = kills - 1; i >= 0; i--) {
            const currentKc = kills - i;
            const items = rawData[i].log_data.items;

            if (items) {
                items.forEach((item: LogItem) => {
                    const itemName = item.name || LEGACY_ID_MAP[item.id] || `Unknown`;
                    if (!firstKcMap[itemName]) {
                        firstKcMap[itemName] = currentKc;
                    }
                });
            }
        }

        // Pass 1: Raw grouping by exact Name + Qty
        const rawDropMap: Record<string, RawDropRecord> = {};

        rawData.forEach(row => {
            const data = row.log_data;

            // Locations
            const rId = String(data.regionId);
            locMap[rId] = (locMap[rId] || 0) + 1;

            // Drops
            if (data.items && data.items.length > 0) {
                data.items.forEach((item: LogItem) => {
                    const itemName = item.name || LEGACY_ID_MAP[item.id] || `Unknown (ID: ${item.id})`;
                    const key = `${itemName}-${item.qty}`;

                    let geValue = item.GE || 0;
                    let haValue = item.HA || 0;

                    if (itemName === "Coins") {
                        geValue = 1;
                        haValue = 1;
                    } else {
                        if (geValue > 0) geValue = geValue / item.qty;
                        if (haValue > 0) haValue = haValue / item.qty;
                    }

                    if (!rawDropMap[key]) {
                        rawDropMap[key] = {
                            name: itemName,
                            qty: item.qty,
                            count: 0,
                            gePrice: geValue,
                            haPrice: haValue,
                            firstKc: firstKcMap[itemName]
                        };
                    }
                    rawDropMap[key].count += 1;
                });
            } else {
                if (!rawDropMap["Nothing-0"]) {
                    rawDropMap["Nothing-0"] = {name: "Nothing", qty: 0, count: 0, gePrice: 0, haPrice: 0, firstKc: 0};
                }
                rawDropMap["Nothing-0"].count += 1;
            }
        });

        // Pass 2: The Data Science Separator
        const nameGroups: Record<string, RawDropRecord[]> = {};
        Object.values(rawDropMap).forEach(drop => {
            if (!nameGroups[drop.name]) nameGroups[drop.name] = [];
            nameGroups[drop.name].push(drop);
        });

        const finalDrops: AggregatedDrop[] = [];

        Object.values(nameGroups).forEach(drops => {
            const totalDropsOfItem = drops.reduce((sum, d) => sum + d.count, 0);
            const totalItemQty = drops.reduce((sum, d) => sum + (d.count * d.qty), 0);

            const isRange = drops.length > 8;

            if (isRange) {
                const minQty = Math.min(...drops.map(d => d.qty));
                const maxQty = Math.max(...drops.map(d => d.qty));
                const baseDrop = drops[0];

                finalDrops.push({
                    name: baseDrop.name,
                    displayQty: minQty === maxQty ? minQty : `${minQty} - ${maxQty}`,
                    totalQty: totalItemQty,
                    count: totalDropsOfItem,
                    gePrice: baseDrop.gePrice,
                    haPrice: baseDrop.haPrice,
                    isSummary: false,
                    firstKc: Math.min(...drops.map(d => d.firstKc))
                });
            } else {
                if (drops.length > 1) {
                    const baseDrop = drops[0];
                    finalDrops.push({
                        name: `${baseDrop.name} (Any)`,
                        displayQty: "Varies",
                        totalQty: totalItemQty,
                        count: totalDropsOfItem,
                        gePrice: baseDrop.gePrice,
                        haPrice: baseDrop.haPrice,
                        isSummary: true,
                        firstKc: Math.min(...drops.map(d => d.firstKc))
                    });
                }

                drops.forEach(d => {
                    finalDrops.push({
                        name: d.name,
                        displayQty: d.qty,
                        totalQty: d.qty * d.count,
                        count: d.count,
                        gePrice: d.gePrice,
                        haPrice: d.haPrice,
                        isSummary: false,
                        firstKc: d.firstKc
                    });
                });
            }
        });

        setAggregatedLocations(
            Object.keys(locMap).map(key => ({regionId: key, count: locMap[key]})).sort((a, b) => b.count - a.count)
        );

        setAggregatedDrops(
            finalDrops.sort((a, b) => {
                const aBase = a.name.replace(' (Any)', '');
                const bBase = b.name.replace(' (Any)', '');

                if (aBase === bBase) {
                    if (a.isSummary) return -1;
                    if (b.isSummary) return 1;
                    return b.count - a.count;
                }
                return b.count - a.count;
            })
        );
    }

    useEffect(() => {
        async function fetchLogs() {
            setIsLoading(true);

            const {data, error} = await supabase
                .from('loot_logs')
                .select('log_data')
                .ilike('log_data->>source', targetName)
                .is('log_data->>action', null)
                .order('id', {ascending: false})
                .limit(5000);

            if (error) console.error("Database Error:", error);

            if (data) {
                processAnalytics(data);
            }
            setIsLoading(false);
        }

        if (targetName !== "Unknown") {
            fetchLogs();
        }
    }, [targetName]);

    const grouped: Record<string, AggregatedDrop[]> = {};
    CATEGORY_ORDER.forEach(cat => {
        grouped[cat] = [];
    });

    aggregatedDrops.forEach(drop => {
        const cleanNameForCategory = drop.name.replace(' (Any)', '');
        const category = categorizeItem(cleanNameForCategory, drop.count, totalKills);

        if (grouped[category]) {
            grouped[category].push(drop);
        } else {
            if (!grouped["Other Loot"]) grouped["Other Loot"] = [];
            grouped["Other Loot"].push(drop);
        }
    });

    return (
        <WikiLayout>
            <div className="max-w-[1200px] p-6 text-[14px] leading-relaxed">
                {/* BACK LINK */}
                <Link href="/monsters" className="text-[#729fcf] hover:underline mb-2 block">{'<'} Back to
                    Bestiary</Link>

                {/* HEADER */}
                <div className="flex gap-4 text-sm mt-2">
                    <h2>
                        <span className="text-gray-400">Total Loot: <span
                            className="text-[#fbdb71]">{totalValue.toLocaleString()} gp</span></span>
                        <span className="text-gray-400 ml-4">Avg/Kill: <span
                            className="text-[#fbdb71]">{gpPerKill.toLocaleString()} gp</span></span>
                    </h2>
                </div>
                <div className="border-b border-[#3a3a3a] pb-2 mb-4 flex justify-between items-end">
                    <h1 className="text-[32px] font-serif text-[#ffffff] font-normal tracking-wide">
                        {displayTitle}
                    </h1>
                    <button
                        onClick={() => setIsIronman(!isIronman)}
                        className="text-xs px-3 py-1 bg-[#2a2a2a] border border-[#3a3a3a] hover:bg-[#3a3a3a] text-[#c8c8c8] transition-colors"
                    >
                        {isIronman ? 'Show GE Prices' : 'Show HA Prices'}
                    </button>
                </div>

                <div className="flex flex-col lg:flex-row gap-6 items-start">

                    {/* LEFT: MAIN CONTENT */}
                    <div className="flex-1 w-full order-2 lg:order-1">
                        <p className="mb-4">
                            <strong className="text-white">{displayTitle}s</strong> are monsters found around Gielinor.
                            The data below is generated dynamically based on <strong
                            className="text-white">{totalKills}</strong> live data points recorded by your RuneLite
                            plugin.
                        </p>

                        {/* LOCATIONS SECTION */}
                        <h2 className="text-[22px] font-serif text-[#ffffff] border-b border-[#3a3a3a] pb-1 mb-4 mt-8">Locations</h2>
                        <div className="overflow-x-auto mb-8">
                            <table
                                className="w-full table-fixed border-collapse border border-[#3a3a3a] text-sm bg-[#1e1e1e]">
                                <thead>
                                <tr className="bg-[#2a2a2a] text-white">
                                    <th className="w-1/3 border border-[#3a3a3a] px-3 py-2 text-left font-bold">Location</th>
                                    <th className="w-1/3 border border-[#3a3a3a] px-3 py-2 text-center font-bold">Region
                                        ID
                                    </th>
                                    <th className="w-1/3 border border-[#3a3a3a] px-3 py-2 text-center font-bold">Logged
                                        Kills
                                    </th>
                                </tr>
                                </thead>
                                <tbody>
                                {aggregatedLocations.length === 0 ? (
                                    <tr>
                                        <td colSpan={3}
                                            className="border border-[#3a3a3a] p-3 text-center text-gray-500 italic">No
                                            locations recorded.
                                        </td>
                                    </tr>
                                ) : aggregatedLocations.map((loc, idx) => (
                                    <tr key={idx} className={idx % 2 === 0 ? "bg-[#1e1e1e]" : "bg-[#222222]"}>
                                        <td className="border border-[#3a3a3a] px-3 py-2 text-[#729fcf]">{regionDictionary[loc.regionId] || `Unknown Area`}</td>
                                        <td className="border border-[#3a3a3a] px-3 py-2 text-center text-gray-400">{loc.regionId}</td>
                                        <td className="border border-[#3a3a3a] px-3 py-2 text-center text-white">{loc.count.toLocaleString()}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>

                        {/* DROP TABLE SECTION */}
                        <h2 className="text-[22px] font-serif text-[#ffffff] border-b border-[#3a3a3a] pb-1 mb-4">Live
                            Drop Tables</h2>
                        <p className="mb-4 text-xs italic text-gray-400">Drop rates are calculated dynamically based
                            on {totalKills} total records.</p>

                        {isLoading ? (
                            <div
                                className="border border-[#3a3a3a] p-4 text-center text-gray-500 italic bg-[#1e1e1e]">Crunching
                                drop rates...</div>
                        ) : aggregatedDrops.length === 0 ? (
                            <div
                                className="border border-[#3a3a3a] p-4 text-center text-gray-500 italic bg-[#1e1e1e]">No
                                drops recorded.</div>
                        ) : (
                            CATEGORY_ORDER.map(category => {
                                const dropsInCategory = grouped[category];
                                if (!dropsInCategory || dropsInCategory.length === 0) return null;

                                return (
                                    <div key={category} className="mb-8">
                                        <h3 className="text-[18px] font-serif text-[#ffffff] font-bold mb-2">{category}</h3>
                                        <div className="overflow-x-auto">
                                            <table
                                                className="w-full table-fixed border-collapse border border-[#3a3a3a] text-sm bg-[#1e1e1e]">
                                                <thead>
                                                <tr className="bg-[#2a2a2a] text-white">
                                                    <th className="w-1/5 border border-[#3a3a3a] px-3 py-2 text-left font-bold">Item</th>
                                                    <th className="w-1/5 border border-[#3a3a3a] px-3 py-2 text-center font-bold">Quantity</th>
                                                    <th className="w-1/5 border border-[#3a3a3a] px-3 py-2 text-center font-bold text-[#cca052]">Logged
                                                        Drops
                                                    </th>
                                                    <th className="w-1/5 border border-[#3a3a3a] px-3 py-2 text-center font-bold">Calculated
                                                        Rarity
                                                    </th>
                                                    <th className="w-1/5 border border-[#3a3a3a] px-3 py-2 text-right font-bold">Price
                                                        ({isIronman ? 'HA' : 'GE'})
                                                    </th>
                                                </tr>
                                                </thead>
                                                <tbody>
                                                {dropsInCategory.map((drop, idx) => {
                                                    const rowBg = idx % 2 === 0 ? "bg-[#1e1e1e]" : "bg-[#222222]";
                                                    const rarityString = getRarity(drop.count, totalKills);

                                                    let rarityColor = "bg-[#1e1e1e]";
                                                    if (rarityString === "Always") rarityColor = "bg-[#80c8ff] text-black";
                                                    else if (drop.count / totalKills > 0.05) rarityColor = "bg-[#90ff90] text-black";
                                                    else if (drop.count / totalKills > 0.01) rarityColor = "bg-[#ffff90] text-black";
                                                    else rarityColor = "bg-[#ffb050] text-black";

                                                    return (
                                                        <tr key={idx}
                                                            className={`${rowBg} hover:bg-[#333333] transition-colors ${drop.isSummary ? "border-t-2 border-[#cca052]/30" : ""}`}>

                                                            <td className={`border border-[#3a3a3a] px-3 py-2 ${!drop.isSummary && drop.name !== "Nothing" ? "pl-8" : ""}`}>
                                                                {drop.name === "Nothing" ? (
                                                                    <span className="text-[#ff6666]">Nothing</span>
                                                                ) : (
                                                                    <div
                                                                        className={`flex items-center ${drop.isSummary ? "justify-center" : "gap-2"}`}>
                                                                        {!drop.isSummary && <span
                                                                            className="text-gray-600 text-xs">└</span>}

                                                                        {drop.isSummary ? (
                                                                            <span
                                                                                className="text-[#cca052] font-bold">{drop.name}</span>
                                                                        ) : (
                                                                            <Link
                                                                                href={`/items/${drop.name.replace(/ /g, '_')}`}
                                                                                className="text-[#729fcf] hover:underline"
                                                                            >
                                                                                {drop.name}
                                                                            </Link>
                                                                        )}

                                                                        {drop.firstKc && (
                                                                            (["Tertiary", "Rare drop table"].includes(category) ||
                                                                                /\b(club|skull|sceptre|scepter|champion scroll|pet|piece|bottom|top|key|totem|essence|mutagen|visage|hilt|fang)\b/i.test(drop.name))
                                                                        ) && !drop.isSummary && (
                                                                            <span
                                                                                className="ml-2 text-[10px] text-[#cca052] bg-[#cca052]/10 px-1.5 py-0.5 rounded border border-[#cca052]/30 whitespace-nowrap">
                                                                                1st @ {drop.firstKc.toLocaleString()} KC
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </td>

                                                            <td className="border border-[#3a3a3a] px-3 py-2 text-center text-[#ffffff]">
                                                                {drop.displayQty}
                                                            </td>
                                                            <td className="border border-[#3a3a3a] px-3 py-2 text-center font-bold text-[#cca052]">
                                                                {drop.count}
                                                            </td>
                                                            <td className="border border-[#3a3a3a] p-0 text-center font-mono text-xs">
                                                                <div
                                                                    className={`w-full h-full p-2 ${rarityColor}`}>{rarityString}</div>
                                                            </td>
                                                            <td className="border border-[#3a3a3a] px-3 py-2 text-right text-[#ffffff]">
                                                                {drop.name === "Nothing" ? "N/A" : (
                                                                    Math.floor((drop.totalQty / drop.count) * (isIronman ? drop.haPrice : drop.gePrice)).toLocaleString()
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* RIGHT: THE WIKI INFOBOX */}
                    <div className="w-full lg:w-[320px] order-1 lg:order-2 shrink-0">
                        <table className="w-full border-collapse border border-[#3a3a3a] bg-[#1e1e1e] text-[13px]">
                            <tbody>
                            <tr>
                                <th colSpan={2}
                                    className="bg-[#cca052] text-black text-[16px] p-2 border-b border-[#3a3a3a] text-center font-bold">
                                    {displayTitle}
                                </th>
                            </tr>
                            <tr>
                                <td colSpan={2} className="p-4 text-center border-b border-[#3a3a3a] bg-[#222222]">
                                    <div
                                        className="w-[150px] h-[150px] mx-auto flex items-center justify-center text-gray-500 italic">
                                        [Image Placeholder]
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <th colSpan={2}
                                    className="bg-[#cca052] text-black p-1 text-center border-y border-[#3a3a3a] font-bold">
                                    General Info
                                </th>
                            </tr>
                            <tr className="bg-[#1e1e1e]">
                                <th className="p-2 border border-[#3a3a3a] text-left w-2/5 font-normal text-[#c8c8c8]">Combat
                                    level
                                </th>
                                <td className="p-2 border border-[#3a3a3a] text-[#ffffff]">?</td>
                            </tr>
                            <tr className="bg-[#1e1e1e]">
                                <th className="p-2 border border-[#3a3a3a] text-left w-2/5 font-normal text-[#c8c8c8]">Kill
                                    Count
                                </th>
                                <td className="p-2 border border-[#3a3a3a] text-[#ffffff]">{totalKills.toLocaleString()}</td>
                            </tr>
                            <tr className="bg-[#222222]">
                                <th className="p-2 border border-[#3a3a3a] text-left font-normal text-[#c8c8c8]">Size</th>
                                <td className="p-2 border border-[#3a3a3a] text-[#ffffff]">?</td>
                            </tr>
                            <tr className="bg-[#1e1e1e]">
                                <th className="p-2 border border-[#3a3a3a] text-left font-normal text-[#c8c8c8]">Examine</th>
                                <td className="p-2 border border-[#3a3a3a] text-[#ffffff] italic">A dynamically
                                    generated {targetName}.
                                </td>
                            </tr>
                            <tr>
                                <th colSpan={2}
                                    className="bg-[#cca052] text-black p-1 text-center border-y border-[#3a3a3a] font-bold mt-4">
                                    Combat Stats
                                </th>
                            </tr>
                            <tr className="bg-[#1e1e1e]">
                                <td colSpan={2}
                                    className="p-4 text-center text-gray-500 italic border border-[#3a3a3a]">
                                    Stat API Integration Pending
                                </td>
                            </tr>
                            <tr>
                                <th colSpan={2}
                                    className="bg-[#cca052] text-black p-1 text-center border-y border-[#3a3a3a] font-bold mt-4">
                                    Slayer Info
                                </th>
                            </tr>
                            <tr className="bg-[#1e1e1e]">
                                <th className="p-2 border border-[#3a3a3a] text-left font-normal text-[#c8c8c8]">Category</th>
                                <td className="p-2 border border-[#3a3a3a] text-[#ffffff]">{displayTitle}s</td>
                            </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </WikiLayout>
    );
}