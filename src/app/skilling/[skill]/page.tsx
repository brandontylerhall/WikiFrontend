"use client";

import React, {useEffect, useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import {useParams} from 'next/navigation';
import Link from 'next/link';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Expanded XP Dictionary for Fishing
const XP_MAP: Record<string, number> = {
    // Woodcutting
    "Logs": 25, "Oak logs": 37.5, "Willow logs": 67.5, "Teak logs": 85,
    "Maple logs": 100, "Mahogany logs": 125, "Yew logs": 175, "Magic logs": 250,
    // Mining
    "Copper ore": 17.5, "Tin ore": 17.5, "Iron ore": 35, "Coal": 50,
    // Fishing
    "Raw shrimps": 10, "Raw sardine": 20, "Raw herring": 30, "Raw anchovies": 40,
    "Raw trout": 50, "Raw pike": 60, "Raw salmon": 90, "Raw tuna": 80,
    "Raw lobster": 90, "Raw swordfish": 100, "Raw shark": 110
};

// Expanded Legacy ID Map
const LEGACY_ID_MAP: Record<number, string> = {
    // Trees
    1511: "Logs", 1521: "Oak logs", 1519: "Willow logs", 1515: "Yew logs", 1513: "Magic logs",
    // Ores
    436: "Copper ore", 438: "Tin ore", 440: "Iron ore", 453: "Coal",
    // Fish
    317: "Raw shrimps", 321: "Raw anchovies", 327: "Raw sardine", 345: "Raw herring",
    335: "Raw trout", 331: "Raw salmon", 349: "Raw pike", 359: "Raw tuna",
    371: "Raw swordfish", 377: "Raw lobster"
};

interface ResourceStat {
    name: string;
    quantity: number;
    totalXp: number;
}

// THE NEW SKILLING SORTER (Added 'shrimp' without the S)
function categorizeResource(skill: string, itemName: string): string {
    if (skill.toLowerCase() === "fishing") {
        if (/\b(shrimp|shrimps|anchovy|anchovies)\b/i.test(itemName)) return "Small Net";
        if (/\b(sardine|herring|pike)\b/i.test(itemName)) return "Bait Fishing";
        if (/\b(trout|salmon)\b/i.test(itemName)) return "Fly Fishing";
        if (/\b(tuna|swordfish|shark)\b/i.test(itemName)) return "Harpoon";
        if (/\b(lobster)\b/i.test(itemName)) return "Cage";
        if (/\b(mackerel|cod|bass|casket|seaweed|oyster)\b/i.test(itemName)) return "Big Net";
        return "Other Catches";
    }

    if (skill.toLowerCase() === "mining") {
        if (/\b(uncut|diamond|ruby|emerald|sapphire)\b/i.test(itemName)) return "Gems";
        return "Ores";
    }

    if (skill.toLowerCase() === "woodcutting") {
        if (/\b(nest|egg|seed|ring)\b/i.test(itemName)) return "Bird Nests";
        return "Logs";
    }

    return "Resources"; // Generic fallback for unknown skills
}

export default function SkillingBreakdownPage() {
    const params = useParams();
    const skillName = decodeURIComponent(params.skill as string);
    const displayTitle = skillName.charAt(0).toUpperCase() + skillName.slice(1);

    const [groupedStats, setGroupedStats] = useState<Record<string, ResourceStat[]>>({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchSkillData() {
            setIsLoading(true);

            const {data, error} = await supabase
                .from('loot_logs')
                .select('log_data')
                .ilike('log_data->>source', skillName)
                .ilike('log_data->>category', 'Skilling');

            if (error) console.error("Database Error:", error);

            if (data) {
                const statsMap: Record<string, ResourceStat> = {};

                data.forEach((row: any) => {
                    const log = row.log_data;
                    if (log.items && log.items.length > 0) {
                        const item = log.items[0];
                        const itemName = item.name || LEGACY_ID_MAP[item.id] || "Unknown Item";

                        if (!statsMap[itemName]) {
                            statsMap[itemName] = {name: itemName, quantity: 0, totalXp: 0};
                        }

                        statsMap[itemName].quantity += item.qty;
                        statsMap[itemName].totalXp += (XP_MAP[itemName] || 0) * item.qty;
                    }
                });

                const newGrouped: Record<string, ResourceStat[]> = {};
                Object.values(statsMap).forEach(stat => {
                    const category = categorizeResource(skillName, stat.name);
                    if (!newGrouped[category]) newGrouped[category] = [];
                    newGrouped[category].push(stat);
                });

                Object.keys(newGrouped).forEach(cat => {
                    newGrouped[cat].sort((a, b) => b.totalXp - a.totalXp);
                });

                setGroupedStats(newGrouped);
            }
            setIsLoading(false);
        }

        fetchSkillData();
    }, [skillName]);

    const grandTotalXp = Object.values(groupedStats)
        .flat()
        .reduce((acc, stat) => acc + stat.totalXp, 0);

    // --- THE MAGIC SORTER ---
    // Sorts categories by most XP, but forces "Other Catches" & "Resources" to the bottom
    const sortedCategories = Object.keys(groupedStats).sort((catA, catB) => {
        const fallbacks = ["Other Catches", "Resources"];
        if (fallbacks.includes(catA) && !fallbacks.includes(catB)) return 1;
        if (!fallbacks.includes(catA) && fallbacks.includes(catB)) return -1;

        const xpA = groupedStats[catA].reduce((sum, item) => sum + item.totalXp, 0);
        const xpB = groupedStats[catB].reduce((sum, item) => sum + item.totalXp, 0);
        return xpB - xpA;
    });

    return (
        <div className="min-h-screen bg-[#121212] text-[#c8c8c8] font-sans p-8">
            <div className="max-w-[1000px] mx-auto">

                <div className="mb-6 text-sm">
                    <Link href="/" className="text-[#729fcf] hover:underline">Home</Link>
                    <span className="mx-2 text-gray-500">{'>'}</span>
                    <Link href="/skilling" className="text-[#729fcf] hover:underline">Skilling Hub</Link>
                    <span className="mx-2 text-gray-500">{'>'}</span>
                    <span className="text-gray-300">{displayTitle}</span>
                </div>

                <div className="border-b border-[#3a3a3a] pb-4 mb-8 flex justify-between items-end">
                    <div>
                        <h1 className="text-[32px] font-serif text-[#ffffff] font-normal tracking-wide">
                            {displayTitle} Breakdown
                        </h1>
                        <p className="text-gray-400 mt-2">
                            Detailed analysis of resources gathered and experience earned.
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-gray-400">Total {displayTitle} XP</div>
                        <div className="text-2xl font-bold text-[#fbdb71]">
                            {grandTotalXp.toLocaleString(undefined, {
                                minimumFractionDigits: 1,
                                maximumFractionDigits: 1
                            })}
                        </div>
                    </div>
                </div>

                {isLoading ? (
                    <div className="border border-[#3a3a3a] p-12 text-center text-gray-500 italic bg-[#1e1e1e]">
                        Calculating breakdown...
                    </div>
                ) : sortedCategories.length === 0 ? (
                    <div className="border border-[#3a3a3a] p-12 text-center text-gray-500 italic bg-[#1e1e1e]">
                        No resources logged for this skill.
                    </div>
                ) : (
                    // We map over our sorted categories instead of the raw Object.entries!
                    sortedCategories.map(categoryName => {
                        const statsArray = groupedStats[categoryName];
                        return (
                            <div key={categoryName} className="mb-10">
                                <h2 className="text-[20px] font-serif text-[#ffffff] border-b border-[#3a3a3a] pb-1 mb-4">
                                    {categoryName}
                                </h2>
                                <div className="overflow-x-auto">
                                    <table
                                        className="w-full border-collapse border border-[#3a3a3a] text-sm bg-[#1e1e1e]">
                                        <thead>
                                        <tr className="bg-[#2a2a2a] text-white">
                                            <th className="border border-[#3a3a3a] px-3 py-2 text-left font-bold">Resource</th>
                                            <th className="border border-[#3a3a3a] px-3 py-2 text-center font-bold">Amount
                                                Gathered
                                            </th>
                                            <th className="border border-[#3a3a3a] px-3 py-2 text-right font-bold text-[#fbdb71]">XP
                                                Earned
                                            </th>
                                        </tr>
                                        </thead>
                                        <tbody>
                                        {statsArray.map((stat, idx) => (
                                            <tr key={idx}
                                                className={idx % 2 === 0 ? "bg-[#1e1e1e]" : "bg-[#222222] hover:bg-[#333333] transition-colors"}>
                                                <td className="border border-[#3a3a3a] px-3 py-2 text-[#729fcf] cursor-pointer hover:underline">
                                                    {stat.name}
                                                </td>
                                                <td className="border border-[#3a3a3a] px-3 py-2 text-center text-[#ffffff]">
                                                    {stat.quantity.toLocaleString()}
                                                </td>
                                                <td className="border border-[#3a3a3a] px-3 py-2 text-right text-[#fbdb71] font-bold">
                                                    {stat.totalXp.toLocaleString(undefined, {
                                                        minimumFractionDigits: 1,
                                                        maximumFractionDigits: 1
                                                    })}
                                                </td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )
                    })
                )}

            </div>
        </div>
    );
}