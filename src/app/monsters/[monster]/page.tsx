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

const formatDecimal = (num: number): string => {
    if (Number.isInteger(num)) return num.toString();
    const str = num.toString();
    const decimalPart = str.split('.')[1] || '';
    if (decimalPart.length <= 2) return str;
    return `~${num.toFixed(1)}`;
};

function getRarity(count: number, total: number) {
    if (total === 0) return "-";
    if (count === total) return "Always";
    const fraction = total / count;
    return `1/${formatDecimal(fraction)}`;
}

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
    const targetName = rawTarget.replace(/_/g, ' ');
    const displayTitle = targetName.charAt(0).toUpperCase() + targetName.slice(1);

    const [isIronman, setIsIronman] = useState(false);
    const [examineStats, setExamineStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [totalKills, setTotalKills] = useState(0);
    const [aggregatedDrops, setAggregatedDrops] = useState<AggregatedDrop[]>([]);
    const [aggregatedLocations, setAggregatedLocations] = useState<AggregatedLocation[]>([]);

    // NEW TTK STATES
    const [avgTtkSeconds, setAvgTtkSeconds] = useState<number>(0);

    const totalValue = aggregatedDrops
        .filter(drop => !drop.isSummary && drop.name !== "Nothing")
        .reduce((acc, drop) => acc + ((isIronman ? drop.haPrice : drop.gePrice) * drop.totalQty), 0);

    const gpPerKill = totalKills > 0 ? Math.floor(totalValue / totalKills) : 0;

    // NEW: Calculate extrapolated values based on TTK
    const killsPerHour = avgTtkSeconds > 0 ? Math.floor(3600 / avgTtkSeconds) : 0;
    const gpPerHour = killsPerHour * gpPerKill;

    function processAnalytics(rawData: DatabaseRow[]) {
        // We need chronological order to accurately track TTK (First Hit -> Drop)
        const chronoLogs = [...rawData].reverse();

        let killCount = 0;
        let totalTtkMs = 0;
        let validTtkSamples = 0;
        let currentKillStartTime: number | null = null;

        const locMap: Record<string, number> = {};
        const rawDropMap: Record<string, RawDropRecord> = {};

        chronoLogs.forEach(row => {
            const data = row.log_data;
            if (!data) return;

            const action = (data.eventType || data.action || "").toUpperCase();
            const ts = data.timestamp ? new Date(data.timestamp).getTime() : 0;

            // TRACK TTK: Start timer on first XP gain
            if (action === 'XP_GAIN') {
                if (!currentKillStartTime && ts > 0) {
                    currentKillStartTime = ts;
                }
                return; // XP logs don't have loot, skip the rest
            }

            // If we reach here, it's an NPC_DROP event (a kill)
            killCount++;

            // TRACK TTK: End timer and log sample
            if (currentKillStartTime && ts > 0) {
                const ttk = ts - currentKillStartTime;
                // Filter out AFK kills (longer than 5 minutes) or instant bugs (< 0)
                if (ttk > 0 && ttk < 300000) {
                    totalTtkMs += ttk;
                    validTtkSamples++;
                }
            }
            currentKillStartTime = null; // Reset for the next monster

            if (data.regionId) {
                const rId = String(data.regionId);
                locMap[rId] = (locMap[rId] || 0) + 1;
            }

            if (data.items) {
                data.items.forEach((item: LogItem) => {
                    const itemName = item.name || LEGACY_ID_MAP[item.id] || `Unknown (ID: ${item.id})`;
                    const key = `${itemName}-${item.qty}`;
                    const gePrice = (item.GE || 0) / item.qty;
                    const haPrice = (item.HA || 0) / item.qty;

                    if (!rawDropMap[key]) {
                        rawDropMap[key] = { name: itemName, qty: item.qty, count: 0, gePrice, haPrice, firstKc: 0 };
                    }
                    rawDropMap[key].count += 1;
                });
            }
        });

        setTotalKills(killCount);
        if (validTtkSamples > 0) setAvgTtkSeconds((totalTtkMs / validTtkSamples) / 1000);

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
                finalDrops.push({
                    name: `${baseDrop.name} (Average)`,
                    displayQty: formatDecimal(totalItemQty / totalDropsOfItem),
                    totalQty: totalItemQty,
                    count: totalDropsOfItem,
                    gePrice: baseDrop.gePrice,
                    haPrice: baseDrop.haPrice,
                    isSummary: true,
                    firstKc: 0
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
                    firstKc: 0
                });
            });
        });

        setAggregatedLocations(Object.keys(locMap).map(key => ({regionId: key, count: locMap[key]})));
        setAggregatedDrops(finalDrops.sort((a, b) => b.count - a.count));
    }

    useEffect(() => {
        async function fetchLogs() {
            setIsLoading(true);

            // WE NOW FETCH DROPS AND XP TO CALCULATE TTK
            const {data, error} = await supabase
                .from('loot_logs')
                .select('log_data')
                .eq('log_data->>source', targetName)
                .or('log_data->>action.eq.NPC_DROP,log_data->>eventType.eq.NPC_DROP,log_data->>eventType.eq.XP_GAIN')
                .order('id', {ascending: false})
                .limit(10000);

            if (error) console.error("Database Error:", error);
            if (data) processAnalytics(data as DatabaseRow[]);

            const { data: examineData } = await supabase
                .from('loot_logs')
                .select('log_data')
                .eq('log_data->>eventType', 'MONSTER_EXAMINE')
                .eq('log_data->>source', targetName)
                .limit(1);

            if (examineData && examineData.length > 0) {
                const note = (examineData[0].log_data as any).note;
                if (note) setExamineStats(parseMonsterExamine(note));
            }
            setIsLoading(false);
        }
        if (targetName !== "Unknown") fetchLogs();
    }, [targetName]);

    const grouped: Record<string, AggregatedDrop[]> = {};
    CATEGORY_ORDER.forEach(cat => grouped[cat] = []);
    aggregatedDrops.forEach(drop => {
        const category = categorizeItem(drop.name.replace(' (Average)', ''), drop.count, totalKills, "Combat");
        if (grouped[category]) grouped[category].push(drop);
        else grouped["Other Loot"] = [...(grouped["Other Loot"] || []), drop];
    });

    return (
        <WikiLayout>
            <div className="w-full p-6 text-[14px]">
                <Link href="/monsters" className="text-[#729fcf] hover:underline mb-2 block">{'<'} Back to Bestiary</Link>

                <div className="flex justify-between items-end border-b border-[#3a3a3a] pb-4 mb-8">
                    <div>
                        <h1 className="text-[32px] font-serif text-[#ffffff]">{displayTitle}</h1>
                        <div className="flex gap-4 text-sm mt-2">
                            <span className="text-gray-400">Total Kills: <span className="text-white">{totalKills.toLocaleString()}</span></span>
                            <span className="text-gray-400">Avg Kill Time: <span className="text-white">{avgTtkSeconds > 0 ? `${avgTtkSeconds.toFixed(1)}s` : "-"}</span></span>
                        </div>
                    </div>
                    <div className="text-right">
                        <button
                            onClick={() => setIsIronman(!isIronman)}
                            className="text-xs px-3 py-1 mb-2 bg-[#2a2a2a] border border-[#3a3a3a] hover:bg-[#3a3a3a] text-[#c8c8c8] transition-colors"
                        >
                            {isIronman ? 'Show GE Prices' : 'Show HA Prices'}
                        </button>
                        <p className="text-sm text-gray-400">Total Wealth</p>
                        <p className="text-3xl font-bold text-[#fbdb71]">{Math.floor(totalValue).toLocaleString()} gp</p>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-6 items-start">
                    <div className="flex-1 w-full order-2 lg:order-1">
                        <h2 className="text-[22px] font-serif text-[#ffffff] border-b border-[#3a3a3a] pb-1 mb-4">Locations</h2>
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

                    {/* WIKI INFOBOX - NOW WITH TTK & GP/HR */}
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
                                    Combat Overview
                                </th>
                            </tr>
                            <tr className="bg-[#1e1e1e]">
                                <th colSpan={2} className="p-2 border border-[#3a3a3a] text-left font-normal text-[#c8c8c8]">Kills Logged</th>
                                <td colSpan={2} className="p-2 border border-[#3a3a3a] text-right text-[#ffffff] font-bold">{totalKills.toLocaleString()}</td>
                            </tr>
                            <tr className="bg-[#222222]">
                                <th colSpan={2} className="p-2 border border-[#3a3a3a] text-left font-normal text-[#c8c8c8]">Average TTK</th>
                                <td colSpan={2} className="p-2 border border-[#3a3a3a] text-right text-[#ffffff] font-bold">{avgTtkSeconds > 0 ? `${avgTtkSeconds.toFixed(1)}s` : "-"}</td>
                            </tr>
                            <tr className="bg-[#1e1e1e]">
                                <th colSpan={2} className="p-2 border border-[#3a3a3a] text-left font-normal text-[#c8c8c8]">Est. Kills / Hr</th>
                                <td colSpan={2} className="p-2 border border-[#3a3a3a] text-right text-[#ffffff] font-bold">{killsPerHour > 0 ? killsPerHour.toLocaleString() : "-"}</td>
                            </tr>
                            <tr className="bg-[#222222]">
                                <th colSpan={2} className="p-2 border border-[#3a3a3a] text-left font-normal text-[#c8c8c8]">Avg GP / Kill</th>
                                <td colSpan={2} className="p-2 border border-[#3a3a3a] text-right text-[#90ff90] font-bold">{gpPerKill.toLocaleString()}</td>
                            </tr>
                            <tr className="bg-[#1e1e1e]">
                                <th colSpan={2} className="p-2 border border-[#3a3a3a] text-left font-normal text-[#c8c8c8]">Est. GP / Hr</th>
                                <td colSpan={2} className="p-2 border border-[#3a3a3a] text-right text-[#fbdb71] font-bold">{gpPerHour > 0 ? gpPerHour.toLocaleString() : "-"}</td>
                            </tr>

                            <tr>
                                <th colSpan={4} className="bg-[#cca052] text-black p-1 text-center border-y border-[#3a3a3a] font-bold mt-4">
                                    Base Combat Stats
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
                                    {/* EXAMINE TABLE KEPT EXACTLY AS IT WAS */}
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
                                </>
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </WikiLayout>
    );
}