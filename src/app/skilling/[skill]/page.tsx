"use client";

import React, {useEffect, useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import {XP_MAP} from '@/lib/constants';
import WikiLayout from '@/components/WikiLayout';
import { DatabaseRow, LogItem } from '@/lib/types';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ResourceStat {
    name: string;
    qty: number;
    xpPerItem: number;
    totalXp: number;
}

export default function IndividualSkillPage() {
    const params = useParams();
    const rawSkill = typeof params?.skill === 'string' ? params.skill : '';
    const targetSkill = rawSkill.replace(/_/g, ' ');

    const [resources, setResources] = useState<ResourceStat[]>([]);
    const [totalActions, setTotalActions] = useState(0);
    const [totalXp, setTotalXp] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    const skillFilters: Record<string, (name: string) => boolean> = {
        "Fishing": (name) => {
            const lower = name.toLowerCase();
            return lower.startsWith("raw ") || lower.includes("shrimp") || lower.includes("anchovies") ||
                lower.includes("trout") || lower.includes("salmon") || lower.includes("tuna") ||
                lower.includes("lobster") || lower.includes("swordfish") || lower.includes("shark") ||
                lower.includes("monkfish") || lower.includes("karambwan") || lower.includes("anglerfish") ||
                lower.includes("barronite"); // Added Barronite
        },
        "Cooking": (name) => {
            const lower = name.toLowerCase();
            return !lower.includes("burnt") && (lower.includes("lobster") || lower.includes("shrimp") ||
                lower.includes("trout") || lower.includes("salmon") || lower.includes("tuna") ||
                lower.includes("swordfish"));
        },
        "Woodcutting": (name) => name.toLowerCase().includes("logs") || name.toLowerCase().includes("bird nest"),
        "Mining": (name) => {
            const lower = name.toLowerCase();
            return lower.includes("ore") || lower.includes("coal") || lower.includes("gem") ||
                lower.includes("rune essence") || lower.includes("clay") || lower.includes("bar") ||
                lower.includes("granite") || lower.includes("sandstone") || lower.includes("amethyst") ||
                lower.includes("minerals") || lower.includes("salt") || lower.includes("barronite"); // Added Barronite
        },
        "Firemaking": (name) => name.toLowerCase().includes("logs"),
        "Smithing": (name) => {
            const lower = name.toLowerCase();
            // Allows ores (smelting), bars (smithing), and deposits (crushing)
            return lower.includes("ore") || lower.includes("bar") || lower.includes("deposit");
        },
    };

    useEffect(() => {
        async function fetchSkillData() {
            setIsLoading(true);

            const {data, error} = await supabase
                .from('loot_logs')
                .select('log_data')
                // Grab all skilling actions AND older null actions just in case
                .or('log_data->>category.eq.Skilling,log_data->>action.is.null')
                .order('id', {ascending: false})
                .limit(15000);

            if (error) {
                console.error(error);
                setIsLoading(false);
                return;
            }

            const resMap = new Map<string, ResourceStat>();

            data?.forEach((row: DatabaseRow) => {
                const log = row.log_data;
                if (!log?.items?.length) return;

                if (log.action === "XP_GAIN") return;

                const sourceName = log.source || "None";
                const category = log.category || "Unknown";

                // 1. Explicitly ignore anything from Combat (Bye bye, Golem shards)
                if (category === "Combat") return;

                const isTargetSkill = sourceName.toLowerCase() === targetSkill.toLowerCase();
                const isGenericSource = ["none", "pickup", "unknown/pickup", "unknown", "bank"].includes(sourceName.toLowerCase());

                // 2. Strict Check: If it's NOT the exact skill we are looking at,
                // AND it's NOT a generic pickup, skip it entirely.
                // (This keeps Fished Barronite out of Mining!)
                if (!isTargetSkill && !isGenericSource) return;

                log.items.forEach((item: LogItem) => {
                    if (item.id <= 0) return;

                    const itemName = (item.name || "").trim();
                    if (!itemName) return;

                    const filterFn = skillFilters[targetSkill];
                    if (filterFn && !filterFn(itemName)) {
                        return;
                    }

                    let xpPerItem = XP_MAP[itemName] || 0;

                    if (itemName.toLowerCase() === "barronite deposit") {
                        xpPerItem = targetSkill === "Smithing" ? 30 : 32;
                    }

                    if (!resMap.has(itemName)) {
                        resMap.set(itemName, {name: itemName, qty: 0, xpPerItem, totalXp: 0});
                    }

                    const stat = resMap.get(itemName)!;
                    const qty = Number(item.qty) || 1;

                    stat.qty += qty;

                    stat.totalXp += xpPerItem;
                });
            });

            const sorted = Array.from(resMap.values()).sort((a, b) => b.qty - a.qty);
            const totalQty = sorted.reduce((sum, r) => sum + r.qty, 0);
            const totalXpCalc = sorted.reduce((sum, r) => sum + r.totalXp, 0);

            setResources(sorted);
            setTotalActions(totalQty);
            setTotalXp(totalXpCalc);
            setIsLoading(false);
        }

        if (targetSkill) fetchSkillData();
    }, [targetSkill]);

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
                            {totalActions.toLocaleString()} {targetSkill === "Fishing" ? "fish" : "resources"} gathered
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
                    Resources Gathered
                </h2>

                <div className="overflow-x-auto bg-[#1e1e1e] border border-[#3a3a3a] rounded">
                    <table className="w-full">
                        <thead>
                        <tr className="bg-[#2a2a2a]">
                            <th className="px-4 py-3 text-left">Resource</th>
                            <th className="px-4 py-3 text-center">Quantity</th>
                            <th className="px-4 py-3 text-right">XP per Item</th>
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
                                    No resources logged yet for {targetSkill}.
                                </td>
                            </tr>
                        ) : (
                            resources.map((r, i) => (
                                <tr key={i} className="border-t border-[#3a3a3a] hover:bg-[#252525]">
                                    <td className="px-4 py-3">
                                        <Link href={`/items/${r.name.replace(/ /g, '_')}`}
                                              className="text-[#729fcf] hover:underline">
                                            {r.name}
                                        </Link>
                                    </td>
                                    <td className="px-4 py-3 text-center font-medium">{r.qty.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right text-gray-400">{r.xpPerItem}</td>
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