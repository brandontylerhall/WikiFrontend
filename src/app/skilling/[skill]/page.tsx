"use client";

import React, {useEffect, useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import {XP_MAP} from '@/lib/constants';
import WikiLayout from '@/components/WikiLayout';
import {DatabaseRow, LogItem} from '@/lib/types';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ResourceStat {
    name: string;
    qty: number;
    xpPerItem: number;
    totalXp: number;
    isXpRow?: boolean;
}

export default function IndividualSkillPage() {
    const params = useParams();
    const rawSkill = typeof params?.skill === 'string' ? params.skill : '';
    const targetSkill = rawSkill.replace(/_/g, ' ');

    const [resources, setResources] = useState<ResourceStat[]>([]);
    const [totalActions, setTotalActions] = useState(0);
    const [totalXp, setTotalXp] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    const isGatheringSkill = Boolean(XP_MAP[targetSkill]);
    const isCombatSkill = ["Attack", "Strength", "Defence", "Hitpoints", "Ranged", "Magic"].includes(targetSkill);

    const skillFilters: Record<string, (name: string) => boolean> = {
        "Fishing": (name) => {
            const lower = name.toLowerCase();
            return lower.startsWith("raw ") || lower.includes("shrimp") || lower.includes("anchovies") ||
                lower.includes("trout") || lower.includes("salmon") || lower.includes("tuna") ||
                lower.includes("lobster") || lower.includes("swordfish") || lower.includes("shark") ||
                lower.includes("monkfish") || lower.includes("karambwan") || lower.includes("anglerfish");
        },
        "Cooking": (name) => {
            const lower = name.toLowerCase();
            return !lower.includes("burnt") && (
                lower.includes("lobster") || lower.includes("shrimp") || lower.includes("anchovies") ||
                lower.includes("trout") || lower.includes("salmon") || lower.includes("tuna") ||
                lower.includes("swordfish") || lower.includes("shark") || lower.includes("karambwan") ||
                lower.includes("monkfish") || lower.includes("anglerfish") || lower.includes("manta ray") ||
                lower.includes("meat") || lower.includes("chicken") || lower.includes("pie") || lower.includes("pizza")
            );
        },
        "Woodcutting": (name) => name.toLowerCase().includes("logs") || name.toLowerCase().includes("bird nest"),
        "Mining": (name) => {
            const lower = name.toLowerCase();
            return lower.includes("ore") || lower.includes("coal") || lower.includes("gem") ||
                lower.includes("rune essence") || lower.includes("clay") || lower.includes("bar") ||
                lower.includes("granite") || lower.includes("sandstone") || lower.includes("amethyst") ||
                lower.includes("minerals") || lower.includes("salt") || lower.includes("barronite");
        },
        "Firemaking": (name) => name.toLowerCase().includes("logs"),
        "Smithing": (name) => {
            const lower = name.toLowerCase();
            return lower.includes("ore") || lower.includes("bar") || lower.includes("deposit");
        },
    };

    useEffect(() => {
        async function fetchSkillData() {
            setIsLoading(true);

            const {data, error} = await supabase
                .from('loot_logs')
                .select('log_data')
                .or('log_data->>category.eq.Skilling,log_data->>category.eq.Combat,log_data->>action.is.null,log_data->>eventType.eq.XP_GAIN')
                .order('id', {ascending: false})
                .limit(20000);

            if (error) {
                console.error(error);
                setIsLoading(false);
                return;
            }

            let absoluteTotalXp = 0;
            const resMap = new Map<string, ResourceStat>();

            data?.forEach((row: DatabaseRow) => {
                const log = row.log_data as any;
                const action = (log.eventType || log.action || "").toUpperCase();

                // 1. HANDLE REAL XP LOGS
                if (action === "XP_GAIN") {
                    const isTargetSkillMatch = log.skill?.toLowerCase() === targetSkill.toLowerCase();

                    if (isTargetSkillMatch) {
                        const amount = log.xpGained || (log.items && log.items.length > 0 ? log.items[0].qty : 0);

                        if (amount > 0) {
                            absoluteTotalXp += amount;

                            if (!isGatheringSkill) {
                                let rawSource = log.source;

                                if (!rawSource || rawSource === "Unknown" || rawSource === "Activity") {
                                    return;
                                }

                                if (rawSource.includes("->")) {
                                    rawSource = rawSource.split("->").pop()?.trim() || rawSource;
                                }

                                if (!resMap.has(rawSource)) {
                                    resMap.set(rawSource, { name: rawSource, qty: 0, xpPerItem: 0, totalXp: 0, isXpRow: true });
                                }

                                const stat = resMap.get(rawSource)!;
                                stat.qty += 1;
                                stat.totalXp += amount;
                            }
                        }
                    }
                    return;
                }

                // 2. HANDLE GATHERING LOGS
                if (action !== 'GATHER_GAIN' && action !== '') return;

                const logSkill = log.skill;
                const isTargetSkill = logSkill
                    ? logSkill.toLowerCase() === targetSkill.toLowerCase()
                    : (log.source || "").toLowerCase() === targetSkill.toLowerCase();

                if (!isTargetSkill) return;

                log.items?.forEach((item: LogItem) => {
                    const itemName = (item.name || "").trim();
                    if (!itemName || (skillFilters[targetSkill] && !skillFilters[targetSkill](itemName))) return;

                    const skillMap = XP_MAP[targetSkill] || {};
                    const xpPerItem = skillMap[itemName] || 0;

                    if (!resMap.has(itemName)) {
                        resMap.set(itemName, {name: itemName, qty: 0, xpPerItem, totalXp: 0, isXpRow: false});
                    }

                    const stat = resMap.get(itemName)!;
                    stat.qty += item.qty;
                    stat.totalXp += (xpPerItem * item.qty);
                });
            });

            const sorted = Array.from(resMap.values()).sort((a, b) => b.totalXp - a.totalXp);
            const computedTotalActions = sorted.reduce((sum, r) => sum + r.qty, 0);
            const theoreticalItemXp = sorted.reduce((sum, r) => sum + r.totalXp, 0);

            setResources(sorted);
            setTotalActions(computedTotalActions);
            setTotalXp(absoluteTotalXp > 0 ? absoluteTotalXp : theoreticalItemXp);
            setIsLoading(false);
        }

        if (targetSkill) fetchSkillData();
    }, [targetSkill, isGatheringSkill]);

    return (
        <WikiLayout>
            <div className="max-w-[1200px] p-6 text-[14px] leading-relaxed">
                <div className="mb-6 text-sm">
                    <Link href="/" className="text-[#729fcf] hover:underline">Home</Link> ›
                    <Link href="/skilling" className="text-[#729fcf] hover:underline">Skilling Hub</Link> ›
                    <span className="text-gray-300"> {targetSkill}</span>
                </div>

                <div className="border-b border-[#3a3a3a] pb-6 mb-8 flex justify-between items-end">
                    <div>
                        <h1 className="text-[32px] font-serif text-white tracking-wide">{targetSkill}</h1>
                        <p className="text-3xl mt-3 font-bold text-[#90ff90]">
                            {totalActions.toLocaleString()} {isGatheringSkill ? "resources gathered" : "actions logged"}
                        </p>
                    </div>

                    <div className="text-right">
                        <div className="text-sm text-gray-400">Total XP Tracked</div>
                        <div className="text-4xl font-bold text-[#fbdb71]">
                            {totalXp.toLocaleString()}
                        </div>
                    </div>
                </div>

                <h2 className="text-xl font-serif text-white mb-4 border-b border-[#3a3a3a] pb-2">
                    {isGatheringSkill ? "Resources Gathered" : "Combat & Actions"}
                </h2>

                <div className="overflow-x-auto bg-[#1e1e1e] border border-[#3a3a3a] rounded">
                    <table className="w-full">
                        <thead>
                        <tr className="bg-[#2a2a2a]">
                            <th className="px-4 py-3 text-left w-1/3">
                                {isCombatSkill ? "Target / Spell" : "Resource"}
                            </th>
                            <th className="px-4 py-3 text-center">
                                {isGatheringSkill ? "Quantity" : "Hits / Casts"}
                            </th>
                            <th className="px-4 py-3 text-right">
                                {isGatheringSkill ? "XP per Item" : "Avg XP/Action"}
                            </th>
                            <th className="px-4 py-3 text-right text-[#fbdb71]">Total XP</th>
                        </tr>
                        </thead>
                        <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan={4} className="p-12 text-center text-gray-500">Loading data...</td>
                            </tr>
                        ) : resources.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="p-12 text-center text-gray-500">
                                    No records found for {targetSkill}.
                                </td>
                            </tr>
                        ) : (
                            resources.map((r, i) => (
                                <tr key={i} className="border-t border-[#3a3a3a] hover:bg-[#252525]">
                                    <td className="px-4 py-3">
                                        {r.isXpRow ? (
                                            // NEW: Only link to Bestiary if it's NOT magic, since spells aren't monsters
                                            isCombatSkill && targetSkill !== "Magic" ? (
                                                <Link href={`/monsters/${r.name.replace(/ /g, '_')}`} className="text-[#729fcf] hover:underline">
                                                    {r.name}
                                                </Link>
                                            ) : (
                                                <span className="text-[#cca052] font-bold">{r.name}</span>
                                            )
                                        ) : (
                                            <Link href={`/items/${r.name.replace(/ /g, '_')}`} className="text-[#729fcf] hover:underline">
                                                {r.name}
                                            </Link>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center font-medium">{r.qty.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right text-gray-400">
                                        {r.isXpRow ? `~${Math.round(r.totalXp / r.qty)}` : r.xpPerItem}
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-[#fbdb71]">{r.totalXp.toLocaleString()}</td>
                                </tr>
                            ))
                        )}
                        </tbody>
                    </table>
                </div>
            </div>
        </WikiLayout>
    );
}