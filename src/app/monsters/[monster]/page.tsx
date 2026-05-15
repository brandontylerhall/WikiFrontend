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

interface RawDropRecord {
    name: string;
    qty: number;
    count: number;
    gePrice: number;
    haPrice: number;
    firstKc: number;
}

function getRarity(count: number, total: number) {
    if (total === 0) return "-";
    if (count === total) return "Always";
    const fraction = total / count;
    return `1/${Number.isInteger(fraction) ? fraction : fraction.toFixed(2)}`;
}

// Helper to parse the pipe-delimited examine string
function parseMonsterExamine(note: string) {
    const stats = {
        combat: "?", hp: "?",
        atk: "?", str: "?", def: "?", mage: "?", range: "?",
        atkSpeed: "?", atkBonus: "?", strBonus: "?",
        defStab: "?", defSlash: "?", defCrush: "?", defMage: "?",
        defLight: "?", defStandard: "?", defHeavy: "?",
        attributes: [] as string[]
    };

    const segments = note.split('|');
    for (const seg of segments) {
        if (seg.includes("StatsCombat")) {
            stats.combat = seg.match(/Combat level:\s*(\d+)/)?.[1] || stats.combat;
            stats.hp = seg.match(/Hitpoints:\s*(\d+)/)?.[1] || stats.hp;
            stats.atk = seg.match(/Attack:\s*(\d+)/)?.[1] || stats.atk;
            stats.def = seg.match(/Defence:\s*(\d+)/)?.[1] || stats.def;
            stats.str = seg.match(/Strength:\s*(\d+)/)?.[1] || stats.str;
            stats.mage = seg.match(/Magic:\s*(\d+)/)?.[1] || stats.mage;
            stats.range = seg.match(/Ranged:\s*(\d+)/)?.[1] || stats.range;
        }
        if (seg.startsWith("Aggressive Stats")) {
            stats.atkSpeed = seg.match(/Attack speed:\s*(\d+)/)?.[1] || stats.atkSpeed;
            stats.atkBonus = seg.match(/Attack bonus:\s*(-?\d+)/)?.[1] || stats.atkBonus;
            stats.strBonus = seg.match(/Strength bonus:\s*(-?\d+)/)?.[1] || stats.strBonus;
        }
        if (seg.startsWith("Defensive Stats")) {
            stats.defStab = seg.match(/Stab:\s*(-?\d+)/)?.[1] || stats.defStab;
            stats.defSlash = seg.match(/Slash:\s*(-?\d+)/)?.[1] || stats.defSlash;
            stats.defCrush = seg.match(/Crush:\s*(-?\d+)/)?.[1] || stats.defCrush;
            stats.defMage = seg.match(/Magic:\s*(-?\d+)/)?.[1] || stats.defMage;
            stats.defLight = seg.match(/Light Ranged:\s*(-?\d+)/)?.[1] || stats.defLight;
            stats.defStandard = seg.match(/Standard Ranged:\s*(-?\d+)/)?.[1] || stats.defStandard;
            stats.defHeavy = seg.match(/Heavy Ranged:\s*(-?\d+)/)?.[1] || stats.defHeavy;
        }
        if (seg.startsWith("Other Attributes")) {
            const attr = seg.replace("Other Attributes", "").replace(/^-/, "").trim();
            if (attr && !stats.attributes.includes(attr)) {
                stats.attributes.push(attr);
            }
        }
    }
    return stats;
}

export default function IndividualMonsterPage() {
    const params = useParams();
    const router = useRouter();

    const rawTarget = decodeURIComponent((params.monster as string) || "Unknown");

    useEffect(() => {
        if (rawTarget.includes(' ')) {
            const standardizedUrl = rawTarget.replace(/ /g, '_');
            router.replace(`/monsters/${standardizedUrl}`);
        }
    }, [rawTarget, router]);

    const targetName = rawTarget.replace(/_/g, ' ');
    const displayTitle = targetName.charAt(0).toUpperCase() + targetName.slice(1);

    const [isIronman, setIsIronman] = useState(false);
    const [examineStats, setExamineStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [totalKills, setTotalKills] = useState(0);
    const [aggregatedDrops, setAggregatedDrops] = useState<AggregatedDrop[]>([]);
    const [aggregatedLocations, setAggregatedLocations] = useState<AggregatedLocation[]>([]);

    // FIX: Filtering to ONLY count non-summary rows to prevent double counting
    const totalValue = aggregatedDrops
        .filter(drop => !drop.isSummary && drop.name !== "Nothing")
        .reduce((acc, drop) => acc + ((isIronman ? drop.haPrice : drop.gePrice) * drop.totalQty), 0);

    const gpPerKill = totalKills > 0 ? Math.floor(totalValue / totalKills) : 0;

    function processAnalytics(rawData: DatabaseRow[]) {
        const kills = rawData.length;
        setTotalKills(kills);

        const locMap: Record<string, number> = {};
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

        const rawDropMap: Record<string, RawDropRecord> = {};

        rawData.forEach(row => {
            const data = row.log_data;
            const rId = String(data.regionId);
            locMap[rId] = (locMap[rId] || 0) + 1;

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

        const nameGroups: Record<string, RawDropRecord[]> = {};
        Object.values(rawDropMap).forEach(drop => {
            if (!nameGroups[drop.name]) nameGroups[drop.name] = [];
            nameGroups[drop.name].push(drop);
        });

        const finalDrops: AggregatedDrop[] = [];

        Object.values(nameGroups).forEach(drops => {
            drops.sort((a, b) => a.qty - b.qty);
            const totalDropsOfItem = drops.reduce((sum, d) => sum + d.count, 0);
            const totalItemQty = drops.reduce((sum, d) => sum + (d.count * d.qty), 0);
            const baseDrop = drops[0];

            if (drops.length > 1) {
                const avgQty = totalItemQty / totalDropsOfItem;
                finalDrops.push({
                    name: `${baseDrop.name} (Average)`,

                    displayQty: Number.isInteger(avgQty) ? `${avgQty}` : `~${avgQty.toFixed(2)}`,

                    totalQty: totalItemQty,
                    count: totalDropsOfItem,
                    gePrice: baseDrop.gePrice,
                    haPrice: baseDrop.haPrice,
                    isSummary: true,
                    firstKc: Math.min(...drops.map(d => d.firstKc))
                });
            }

            const clusters: RawDropRecord[][] = [];
            let currentCluster: RawDropRecord[] = [drops[0]];

            for (let i = 1; i < drops.length; i++) {
                const current = drops[i];
                const last = currentCluster[currentCluster.length - 1];
                const maxGap = last.qty > 5 ? Math.ceil(last.qty * 0.2) : 1;

                if (current.qty - last.qty <= maxGap) {
                    currentCluster.push(current);
                } else {
                    clusters.push(currentCluster);
                    currentCluster = [current];
                }
            }
            clusters.push(currentCluster);

            clusters.forEach(cluster => {
                if (cluster.length === 1) {
                    const d = cluster[0];
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
                } else {
                    const minQty = cluster[0].qty;
                    const maxQty = cluster[cluster.length - 1].qty;
                    const totalCount = cluster.reduce((sum, d) => sum + d.count, 0);
                    const totalClusterQty = cluster.reduce((sum, d) => sum + (d.count * d.qty), 0);

                    finalDrops.push({
                        name: baseDrop.name,
                        displayQty: minQty === maxQty ? minQty : `${minQty} - ${maxQty}`,
                        totalQty: totalClusterQty,
                        count: totalCount,
                        gePrice: baseDrop.gePrice,
                        haPrice: baseDrop.haPrice,
                        isSummary: false,
                        firstKc: Math.min(...cluster.map(d => d.firstKc))
                    });
                }
            });
        });

        setAggregatedLocations(
            Object.keys(locMap).map(key => ({regionId: key, count: locMap[key]})).sort((a, b) => b.count - a.count)
        );

        setAggregatedDrops(
            finalDrops.sort((a, b) => {
                const aBase = a.name.replace(' (Average)', '');
                const bBase = b.name.replace(' (Average)', '');
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

            // Fetch Drops
            const {data, error} = await supabase
                .from('loot_logs')
                .select('log_data')
                .ilike('log_data->>source', targetName)
                .or('log_data->>action.eq.NPC_DROP,log_data->>eventType.eq.NPC_DROP')
                .order('id', {ascending: false})
                .limit(5000);

            if (error) console.error("Database Error:", error);
            if (data) processAnalytics(data);

            // Fetch Monster Examine
            const { data: examineData } = await supabase
                .from('loot_logs')
                .select('log_data')
                .eq('log_data->>eventType', 'MONSTER_EXAMINE')
                .ilike('log_data->>source', targetName)
                .limit(1);

            if (examineData && examineData.length > 0) {
                const note = (examineData[0].log_data as any).note;
                if (note) setExamineStats(parseMonsterExamine(note));
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
        const cleanNameForCategory = drop.name.replace(' (Average)', '');
        const category = categorizeItem(cleanNameForCategory, drop.count, totalKills, "Combat");
        if (grouped[category]) grouped[category].push(drop);
        else {
            if (!grouped["Other Loot"]) grouped["Other Loot"] = [];
            grouped["Other Loot"].push(drop);
        }
    });

    return (
        <WikiLayout>
            <div className="w-full p-6 text-[14px] leading-relaxed">
                <Link href="/monsters" className="text-[#729fcf] hover:underline mb-2 block">{'<'} Back to Bestiary</Link>

                <div className="flex gap-4 text-sm mt-2">
                    <h2>
                        <span className="text-gray-400">Total Loot: <span className="text-[#fbdb71]">{totalValue.toLocaleString()} gp</span></span>
                        <span className="text-gray-400 ml-4">Avg/Kill: <span className="text-[#fbdb71]">{gpPerKill.toLocaleString()} gp</span></span>
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
                    <div className="flex-1 w-full order-2 lg:order-1">
                        <p className="mb-4">
                            <strong className="text-white">{displayTitle}s</strong> are monsters found around Gielinor. The data below is generated dynamically based on <strong className="text-white">{totalKills}</strong> live data points recorded by your RuneLite plugin.
                        </p>

                        <h2 className="text-[22px] font-serif text-[#ffffff] border-b border-[#3a3a3a] pb-1 mb-4 mt-8">Locations</h2>
                        <div className="overflow-x-auto mb-8">
                            <table className="w-full border-collapse border border-[#3a3a3a] text-sm bg-[#1e1e1e]">
                                <thead>
                                <tr className="bg-[#2a2a2a] text-white">
                                    <th className="border border-[#3a3a3a] px-3 py-2 text-left font-bold w-1/2">Location</th>
                                    <th className="border border-[#3a3a3a] px-3 py-2 text-center font-bold">Region ID</th>
                                    <th className="border border-[#3a3a3a] px-3 py-2 text-center font-bold">Logged Kills</th>
                                </tr>
                                </thead>
                                <tbody>
                                {aggregatedLocations.length === 0 ? (
                                    <tr><td colSpan={3} className="border border-[#3a3a3a] p-3 text-center text-gray-500 italic">No locations recorded.</td></tr>
                                ) : aggregatedLocations.map((loc, idx) => (
                                    <tr key={idx} className={idx % 2 === 0 ? "bg-[#1e1e1e]" : "bg-[#222222]"}>
                                        <td className="border border-[#3a3a3a] px-3 py-2 text-[#729fcf] text-left">{regionDictionary[loc.regionId] || `Unknown Area`}</td>
                                        <td className="border border-[#3a3a3a] px-3 py-2 text-center text-gray-400">{loc.regionId}</td>
                                        <td className="border border-[#3a3a3a] px-3 py-2 text-center text-white">{loc.count.toLocaleString()}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>

                        <h2 className="text-[22px] font-serif text-[#ffffff] border-b border-[#3a3a3a] pb-1 mb-4">Live Drop Tables</h2>
                        <p className="mb-4 text-xs italic text-gray-400">Drop rates are calculated dynamically based on {totalKills} total records.</p>

                        {isLoading ? (
                            <div className="border border-[#3a3a3a] p-4 text-center text-gray-500 italic bg-[#1e1e1e]">Crunching drop rates...</div>
                        ) : aggregatedDrops.length === 0 ? (
                            <div className="border border-[#3a3a3a] p-4 text-center text-gray-500 italic bg-[#1e1e1e]">No drops recorded.</div>
                        ) : (
                            CATEGORY_ORDER.map(category => {
                                const dropsInCategory = grouped[category];
                                if (!dropsInCategory || dropsInCategory.length === 0) return null;
                                return (
                                    <div key={category} className="mb-8">
                                        <h3 className="text-[18px] font-serif text-[#ffffff] font-bold mb-2">{category}</h3>
                                        <div className="overflow-x-auto">
                                            <table className="w-full table-fixed border-collapse border border-[#3a3a3a] text-sm bg-[#1e1e1e]">
                                                <thead>
                                                <tr className="bg-[#2a2a2a] text-white">
                                                    <th className="border border-[#3a3a3a] px-3 py-2 text-left font-bold">Item</th>
                                                    <th className="border border-[#3a3a3a] px-3 py-2 text-center font-bold">Quantity</th>
                                                    <th className="border border-[#3a3a3a] px-3 py-2 text-center font-bold text-[#cca052]">Logged Drops</th>
                                                    <th className="border border-[#3a3a3a] px-3 py-2 text-center font-bold">Calculated Rarity</th>
                                                    <th className="border border-[#3a3a3a] px-3 py-2 text-right font-bold">Price ({isIronman ? 'HA' : 'GE'})</th>
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
                                                    const hasParentSummary = !drop.isSummary && dropsInCategory.some(d => d.name === `${drop.name} (Average)`);
                                                    return (
                                                        <tr key={idx} className={`${rowBg} hover:bg-[#333333] transition-colors ${drop.isSummary ? "border-t-2 border-[#cca052]/30" : ""}`}>
                                                            <td className="border border-[#3a3a3a] px-3 py-2 text-left">
                                                                <div className="flex items-center gap-2 justify-start">
                                                                    {hasParentSummary && <span className="text-gray-600 text-xs ml-4">└</span>}
                                                                    {drop.isSummary ? (
                                                                        <span className="text-[#cca052] font-bold">{drop.name}</span>
                                                                    ) : (
                                                                        <Link href={`/items/${drop.name.replace(/ /g, '_')}`} className="text-[#729fcf] hover:underline">{drop.name}</Link>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="border border-[#3a3a3a] px-3 py-2 text-center text-[#ffffff]">{drop.displayQty}</td>
                                                            <td className="border border-[#3a3a3a] px-3 py-2 text-center font-bold text-[#cca052]">{drop.count}</td>
                                                            <td className="border border-[#3a3a3a] p-0 text-center font-mono text-xs"><div className={`w-full h-full p-2 ${rarityColor}`}>{rarityString}</div></td>
                                                            <td className="border border-[#3a3a3a] px-3 py-2 text-right text-[#ffffff]">
                                                                {drop.name === "Nothing" ? "N/A" : Math.floor((drop.totalQty / drop.count) * (isIronman ? drop.haPrice : drop.gePrice)).toLocaleString()}
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

                    {/* RIGHT: THE WIKI INFOBOX (Updated with 2-column stats) */}
                    <div className="w-full lg:w-[320px] order-1 lg:order-2 shrink-0">
                        <table className="w-full border-collapse border border-[#3a3a3a] bg-[#1e1e1e] text-[13px]">
                            <tbody>
                            <tr>
                                <th colSpan={4} className="bg-[#cca052] text-black text-[16px] p-2 border-b border-[#3a3a3a] text-center font-bold">
                                    {displayTitle}
                                </th>
                            </tr>
                            <tr>
                                <td colSpan={4} className="p-4 text-center border-b border-[#3a3a3a] bg-[#222222]">
                                    <div className="w-[150px] h-[150px] mx-auto flex items-center justify-center overflow-hidden">
                                        <img
                                            src={`https://oldschool.runescape.wiki/images/${displayTitle.replace(/ /g, '_')}.png`}
                                            alt={displayTitle}
                                            className="max-w-[130px] max-h-[130px] object-contain drop-shadow-md"
                                            loading="lazy"
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                                e.currentTarget.parentElement!.innerHTML = '<span class="text-gray-500 italic text-xs">Image Unavailable</span>';
                                            }}
                                        />
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <th colSpan={4} className="bg-[#cca052] text-black p-1 text-center border-y border-[#3a3a3a] font-bold">
                                    Live Combat Stats
                                </th>
                            </tr>
                            {!examineStats ? (
                                <tr>
                                    <td colSpan={4} className="p-3 bg-[#1e1e1e] text-center text-gray-500 italic border-b border-[#3a3a3a]">
                                        Cast Monster Inspect to populate.
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    <tr className="bg-[#1e1e1e]">
                                        <th className="p-1 px-2 border border-[#3a3a3a] text-left font-normal text-gray-400 text-xs w-1/4">Cmb Lvl</th>
                                        <td className="p-1 px-2 border border-[#3a3a3a] text-right font-bold text-white text-xs w-1/4">{examineStats.combat}</td>
                                        <th className="p-1 px-2 border border-[#3a3a3a] text-left font-normal text-gray-400 text-xs w-1/4">HP</th>
                                        <td className="p-1 px-2 border border-[#3a3a3a] text-right font-bold text-[#ff6666] text-xs w-1/4">{examineStats.hp}</td>
                                    </tr>
                                    <tr className="bg-[#222222]">
                                        <th className="p-1 px-2 border border-[#3a3a3a] text-left font-normal text-gray-400 text-xs">Atk</th>
                                        <td className="p-1 px-2 border border-[#3a3a3a] text-right text-white text-xs">{examineStats.atk}</td>
                                        <th className="p-1 px-2 border border-[#3a3a3a] text-left font-normal text-gray-400 text-xs">Str</th>
                                        <td className="p-1 px-2 border border-[#3a3a3a] text-right text-white text-xs">{examineStats.str}</td>
                                    </tr>
                                    <tr className="bg-[#1e1e1e]">
                                        <th className="p-1 px-2 border border-[#3a3a3a] text-left font-normal text-gray-400 text-xs">Def</th>
                                        <td className="p-1 px-2 border border-[#3a3a3a] text-right text-white text-xs">{examineStats.def}</td>
                                        <th className="p-1 px-2 border border-[#3a3a3a] text-left font-normal text-gray-400 text-xs">Mage</th>
                                        <td className="p-1 px-2 border border-[#3a3a3a] text-right text-[#729fcf] text-xs">{examineStats.mage}</td>
                                    </tr>
                                    <tr className="bg-[#222222]">
                                        <th className="p-1 px-2 border border-[#3a3a3a] text-left font-normal text-gray-400 text-xs">Ranged</th>
                                        <td className="p-1 px-2 border border-[#3a3a3a] text-right text-[#90ff90] text-xs">{examineStats.range}</td>
                                        <th className="p-1 px-2 border border-[#3a3a3a] text-left font-normal text-[#ff6666] text-xs">Atk Speed</th>
                                        <td className="p-1 px-2 border border-[#3a3a3a] text-right text-white text-xs">{examineStats.atkSpeed}</td>
                                    </tr>

                                    <tr><th colSpan={4} className="bg-[#cca052] text-black p-1 text-center border-y border-[#3a3a3a] font-bold text-xs">Defensive Bonuses</th></tr>

                                    <tr className="bg-[#1e1e1e]">
                                        <th className="p-1 px-2 border border-[#3a3a3a] text-left font-normal text-gray-400 text-xs">Stab</th>
                                        <td className="p-1 px-2 border border-[#3a3a3a] text-right text-white text-xs">{examineStats.defStab}</td>
                                        <th className="p-1 px-2 border border-[#3a3a3a] text-left font-normal text-[#90ff90] text-xs">Light</th>
                                        <td className="p-1 px-2 border border-[#3a3a3a] text-right text-white text-xs">{examineStats.defLight}</td>
                                    </tr>
                                    <tr className="bg-[#222222]">
                                        <th className="p-1 px-2 border border-[#3a3a3a] text-left font-normal text-gray-400 text-xs">Slash</th>
                                        <td className="p-1 px-2 border border-[#3a3a3a] text-right text-white text-xs">{examineStats.defSlash}</td>
                                        <th className="p-1 px-2 border border-[#3a3a3a] text-left font-normal text-[#90ff90] text-xs">Standard</th>
                                        <td className="p-1 px-2 border border-[#3a3a3a] text-right text-white text-xs">{examineStats.defStandard}</td>
                                    </tr>
                                    <tr className="bg-[#1e1e1e]">
                                        <th className="p-1 px-2 border border-[#3a3a3a] text-left font-normal text-gray-400 text-xs">Crush</th>
                                        <td className="p-1 px-2 border border-[#3a3a3a] text-right text-white text-xs">{examineStats.defCrush}</td>
                                        <th className="p-1 px-2 border border-[#3a3a3a] text-left font-normal text-[#90ff90] text-xs">Heavy</th>
                                        <td className="p-1 px-2 border border-[#3a3a3a] text-right text-white text-xs">{examineStats.defHeavy}</td>
                                    </tr>
                                    <tr className="bg-[#222222]">
                                        <th colSpan={3} className="p-1 px-2 border border-[#3a3a3a] text-left font-normal text-[#729fcf] text-xs">Magic Defense</th>
                                        <td className="p-1 px-2 border border-[#3a3a3a] text-right text-white text-xs">{examineStats.defMage}</td>
                                    </tr>
                                </>
                            )}
                            <tr>
                                <th colSpan={4} className="bg-[#cca052] text-black p-1 text-center border-y border-[#3a3a3a] font-bold">
                                    Combat Overview
                                </th>
                            </tr>
                            <tr className="bg-[#1e1e1e]">
                                <th colSpan={2} className="p-2 border border-[#3a3a3a] text-left font-normal text-[#c8c8c8]">Kill Count</th>
                                <td colSpan={2} className="p-2 border border-[#3a3a3a] text-right text-[#ffffff] font-bold">{totalKills.toLocaleString()}</td>
                            </tr>
                            <tr className="bg-[#222222]">
                                <th colSpan={2} className="p-2 border border-[#3a3a3a] text-left font-normal text-[#c8c8c8]">Total Wealth</th>
                                <td colSpan={2} className="p-2 border border-[#3a3a3a] text-right text-[#cca052] font-bold">{Math.floor(totalValue).toLocaleString()} gp</td>
                            </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </WikiLayout>
    );
}