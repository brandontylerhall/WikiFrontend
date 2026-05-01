"use client";

import React, {useEffect, useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import Link from 'next/link';
import WikiLayout from "@/components/WikiLayout";
import { DatabaseRow, LogItem } from '@/lib/types';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface SkillStat {
    skillName: string;
    totalXp: number;
    sessionXp: number;
    actions: number;
}

const OSRS_SKILLS = new Set([
    "Woodcutting", "Mining", "Fishing", "Cooking", "Firemaking", "Smithing",
    "Crafting", "Fletching", "Thieving", "Farming", "Herblore", "Hunter",
    "Construction", "Agility", "Runecraft", "Slayer"
]);

export default function SkillingHub() {
    const [skills, setSkills] = useState<SkillStat[]>([]);
    const [isOnline, setIsOnline] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchSkillingData() {
            setIsLoading(true);

            const {data, error} = await supabase
                .from('loot_logs')
                .select('log_data')
                .or('log_data->>action.eq.XP_GAIN,log_data->>action.eq.GATHER_GAIN')
                .order('id', {ascending: false})
                .limit(10000); // Bumped up slightly to catch more history

            if (error) {
                console.error("Supabase error:", error);
                setIsLoading(false);
                return;
            }

            const skillMap = new Map<string, SkillStat>();

            let activeSessionId: string | null = null;
            let isCurrentlyOnline = false;
            let nearestSkillChronologically = "Unknown";

            data?.forEach((row: DatabaseRow) => { // Removed 'any', properly typed!
                const log = row.log_data;

                // Determine session status from newest record
                if (!activeSessionId && log.sessionId) {
                    activeSessionId = log.sessionId;
                    isCurrentlyOnline = log.action !== 'SESSION_END';
                    setIsOnline(isCurrentlyOnline);
                }

                if (log.category !== 'Skilling') return;

                let skillName = log.source || "Unknown";

                if (log.action === 'XP_GAIN' && log.items?.[0]?.name) {
                    // XP drops always accurately contain the skill name
                    skillName = log.items[0].name;
                    nearestSkillChronologically = skillName;
                } else if (log.action === 'GATHER_GAIN') {
                    // If the gather action shows "Copper rocks" or "Unknown/Pickup",
                    // fall back to the most recently tracked XP skill
                    if (!OSRS_SKILLS.has(skillName)) {
                        skillName = nearestSkillChronologically;
                    }
                }

                // If it's still somehow not a valid skill, skip it so it doesn't create a junk card
                if (!OSRS_SKILLS.has(skillName)) return;

                if (!skillMap.has(skillName)) {
                    skillMap.set(skillName, {
                        skillName,
                        totalXp: 0,
                        sessionXp: 0,
                        actions: 0
                    });
                }

                const stat = skillMap.get(skillName)!;

                if (log.action === 'XP_GAIN' && log.items?.[0]) {
                    const xp = log.items[0].qty;
                    if (xp > 100_000) return; // sanity

                    stat.totalXp += xp;
                    if (isCurrentlyOnline && log.sessionId === activeSessionId) {
                        stat.sessionXp += xp;
                    }
                } else if (log.action === 'GATHER_GAIN' && log.items?.length) {
                    stat.actions += log.items.length;
                }
            });

            // Sort by total XP descending
            const sortedSkills = Array.from(skillMap.values())
                .filter(s => s.totalXp > 0 || s.actions > 0)
                .sort((a, b) => b.totalXp - a.totalXp);

            setSkills(sortedSkills);
            setIsLoading(false);
        }

        fetchSkillingData();
    }, []);

    return (
        <WikiLayout>
            <div className="min-h-screen bg-[#121212] text-[#c8c8c8] p-8">

                {isLoading ? (
                    <div className="text-center p-12 border border-[#3a3a3a] bg-[#1e1e1e]">
                        Loading skilling statistics...
                    </div>
                ) : skills.length === 0 ? (
                    <div className="text-center p-12 border border-[#3a3a3a] bg-[#1e1e1e] text-gray-400">
                        No skilling data yet. Start training!
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {skills.map((skill) => (
                            <div key={skill.skillName}
                                 className="bg-[#1e1e1e] border border-[#3a3a3a] p-6 rounded hover:border-[#cca052] transition-all flex flex-col">
                                <h2 className="text-2xl font-serif text-white mb-4 border-b border-[#3a3a3a] pb-2">
                                    {skill.skillName}
                                </h2>

                                <div className="flex justify-between items-end mb-6">
                                    <div>
                                        <div className="text-gray-400 text-sm">Total XP</div>
                                        <div className="text-3xl font-bold text-[#fbdb71]">
                                            {skill.totalXp.toLocaleString()}
                                        </div>
                                    </div>

                                    {isOnline && skill.sessionXp > 0 && (
                                        <div className="text-right">
                                            <div className="text-gray-400 text-sm">This Session</div>
                                            <div className="text-xl font-bold text-[#90ff90]">
                                                +{skill.sessionXp.toLocaleString()}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div
                                    className="mt-auto pt-4 border-t border-[#3a3a3a] flex justify-between text-sm">
                                    <span className="text-gray-400">Actions: {skill.actions.toLocaleString()}</span>
                                    <Link
                                        href={`/skilling/${skill.skillName.replace(/ /g, '_')}`}
                                        className="text-[#729fcf] hover:underline"
                                    >
                                        View Details →
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </WikiLayout>
    );
}