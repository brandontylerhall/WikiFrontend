"use client";

import React, {useEffect, useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import WikiLayout from '@/components/WikiLayout';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface SkillingActionStat {
    name: string;
    totalXp: number;
    actionCount: number;
}

export default function IndividualSkillPage() {
    const params = useParams();
    const rawSkill = typeof params?.skill === 'string' ? params.skill : '';
    const skillName = rawSkill.replace(/_/g, ' ');

    const [isLoading, setIsLoading] = useState(true);
    const [totalSkillXp, setTotalSkillXp] = useState(0);
    const [actionStats, setActionStats] = useState<SkillingActionStat[]>([]);

    useEffect(() => {
        async function fetchSkillData() {
            setIsLoading(true);

            // Fetch both XP gains for this skill AND spell casts if it's Magic
            const query = skillName === "Magic"
                ? `log_data->>skill.eq.Magic,log_data->>eventType.eq.SPELL_CAST`
                : `log_data->>skill.eq.${skillName}`;

            const {data, error} = await supabase
                .from('loot_logs')
                .select('log_data')
                .or(query)
                .order('id', {ascending: false})
                .limit(15000);

            if (error) {
                console.error(error);
                setIsLoading(false);
                return;
            }

            let xp = 0;
            const actionsMap = new Map<string, { name: string, totalXp: number, ticks: Set<number> }>();

            // Pass 1: Build a map of what spell was cast at what exact timestamp
            const magicCastEvents: { time: number, source: string }[] = [];
            if (skillName === "Magic") {
                data?.forEach(row => {
                    const log = row.log_data as any;
                    if (log.eventType === 'SPELL_CAST') {
                        let src = log.source;
                        if (src && src.includes("->")) src = src.split("->")[0].trim();
                        if (src && src !== "Generic Magic") {
                            magicCastEvents.push({ time: new Date(log.timestamp).getTime(), source: src });
                        }
                    }
                });
            }

            // Pass 2: Aggregate the XP
            data?.forEach(row => {
                const log = row.log_data as any;
                const actionType = log.eventType || "";
                // The deduplication fix!
                const tickId = Math.floor(new Date(log.timestamp).getTime() / 600);

                if (actionType === "XP_GAIN" && log.skill === skillName) {
                    let rawSource = log.source || "Unknown Activity";
                    const logTime = new Date(log.timestamp).getTime();

                    // Clean up arrows (e.g. "Wind Strike -> Goblin")
                    if (rawSource.includes("->")) {
                        rawSource = rawSource.split("->")[0].trim();
                    }

                    // The "Generic Magic" Fix! Cross-reference the spell cast list
                    if (skillName === "Magic" && (rawSource === "Generic Magic" || rawSource === "Activity")) {
                        const matchingCast = magicCastEvents.find(e => Math.abs(e.time - logTime) < 600);
                        if (matchingCast) rawSource = matchingCast.source;
                    }

                    xp += (log.xpGained || 0);

                    if (!actionsMap.has(rawSource)) {
                        actionsMap.set(rawSource, { name: rawSource, totalXp: 0, ticks: new Set<number>() });
                    }

                    const stat = actionsMap.get(rawSource)!;
                    stat.totalXp += (log.xpGained || 0);
                    stat.ticks.add(tickId);
                }
            });

            const finalStats = Array.from(actionsMap.values()).map(stat => ({
                name: stat.name,
                totalXp: stat.totalXp,
                actionCount: stat.ticks.size
            })).sort((a, b) => b.totalXp - a.totalXp);

            setTotalSkillXp(xp);
            setActionStats(finalStats);
            setIsLoading(false);
        }

        if (skillName) fetchSkillData();
    }, [skillName]);

    return (
        <WikiLayout>
            <div className="w-full p-6 text-[14px] leading-relaxed">
                <div className="mb-6 text-sm">
                    <Link href="/" className="text-[#729fcf] hover:underline">Home</Link> ›
                    <Link href="/skilling" className="text-[#729fcf] hover:underline">Skilling Hub</Link> ›
                    <span className="text-gray-300"> {skillName}</span>
                </div>

                <div className="border-b border-[#3a3a3a] pb-6 mb-8 flex justify-between items-end">
                    <div>
                        <h1 className="text-[32px] font-serif text-white tracking-wide">{skillName}</h1>
                        <p className="text-lg mt-1 text-gray-400">
                            Activity Log & Training Breakdown
                        </p>
                    </div>

                    <div className="text-right">
                        <div className="text-sm text-gray-400">Total XP Tracked</div>
                        <div className="text-3xl font-bold text-[#90ff90]">{totalSkillXp.toLocaleString()}</div>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-8 items-start">
                    <div className="flex-1 w-full order-2 lg:order-1">

                        <h2 className="text-[22px] font-serif text-[#ffffff] border-b border-[#3a3a3a] pb-2 mb-4">Training Methods Used</h2>

                        <div className="overflow-x-auto mb-10">
                            <table className="w-full border-collapse border border-[#3a3a3a] text-sm bg-[#1e1e1e]">
                                <thead>
                                <tr className="bg-[#2a2a2a] text-white">
                                    <th className="border border-[#3a3a3a] px-3 py-2 text-left font-bold w-1/2">Activity / Source</th>
                                    <th className="border border-[#3a3a3a] px-3 py-2 text-center font-bold text-[#80c8ff]">Actions Logged</th>
                                    <th className="border border-[#3a3a3a] px-3 py-2 text-right font-bold text-[#90ff90]">XP Gained</th>
                                </tr>
                                </thead>
                                <tbody>
                                {isLoading ? (
                                    <tr><td colSpan={3} className="p-4 text-center text-gray-500 italic">Scanning ledgers...</td></tr>
                                ) : actionStats.length === 0 ? (
                                    <tr><td colSpan={3} className="p-4 text-center text-gray-500 italic">No {skillName} activities logged yet.</td></tr>
                                ) : (
                                    actionStats.map((stat, idx) => {
                                        // Link to the spell page if it's Magic, otherwise a generic items/location link
                                        const linkTarget = skillName === "Magic"
                                            ? `/spells/${stat.name.replace(/ /g, '_')}`
                                            : `/items/${stat.name.replace(/ /g, '_')}`;

                                        return (
                                            <tr key={idx} className={idx % 2 === 0 ? "bg-[#1e1e1e]" : "bg-[#222222]"}>
                                                <td className="border border-[#3a3a3a] px-3 py-2">
                                                    <Link href={linkTarget} className="text-[#729fcf] hover:underline">
                                                        {stat.name}
                                                    </Link>
                                                </td>
                                                <td className="border border-[#3a3a3a] px-3 py-2 text-center text-[#80c8ff]">{stat.actionCount.toLocaleString()}</td>
                                                <td className="border border-[#3a3a3a] px-3 py-2 text-right font-bold text-[#90ff90]">+{stat.totalXp.toLocaleString()}</td>
                                            </tr>
                                        );
                                    })
                                )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="w-full lg:w-[320px] order-1 lg:order-2 shrink-0">
                        <table className="w-full border-collapse border border-[#3a3a3a] bg-[#1e1e1e] text-[13px]">
                            <tbody>
                            <tr>
                                <th colSpan={2}
                                    className="bg-[#cca052] text-black text-[16px] p-2 border-b border-[#3a3a3a] text-center font-bold">
                                    {skillName} Overview
                                </th>
                            </tr>
                            <tr>
                                <td colSpan={2} className="p-4 text-center border-b border-[#3a3a3a] bg-[#222222]">
                                    <div className="w-[150px] h-[150px] mx-auto flex items-center justify-center overflow-hidden">
                                        <img
                                            src={`https://oldschool.runescape.wiki/images/${skillName}_icon.png`}
                                            alt={skillName}
                                            className="w-16 h-16 object-contain drop-shadow-md"
                                            style={{imageRendering: 'pixelated'}}
                                            loading="lazy"
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                    </div>
                                </td>
                            </tr>
                            <tr className="bg-[#1e1e1e]">
                                <th className="p-2 border border-[#3a3a3a] text-left w-2/5 font-normal text-[#c8c8c8]">Total Actions</th>
                                <td className="p-2 border border-[#3a3a3a] text-right text-[#ffffff]">
                                    {actionStats.reduce((acc, curr) => acc + curr.actionCount, 0).toLocaleString()}
                                </td>
                            </tr>
                            <tr className="bg-[#222222]">
                                <th className="p-2 border border-[#3a3a3a] text-left font-normal text-[#c8c8c8]">Total XP</th>
                                <td className="p-2 border border-[#3a3a3a] text-right text-[#90ff90] font-bold">
                                    +{totalSkillXp.toLocaleString()}
                                </td>
                            </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </WikiLayout>
    );
}