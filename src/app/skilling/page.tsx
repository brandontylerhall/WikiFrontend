"use client";

import React, {useEffect, useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import Link from 'next/link';
import WikiLayout from "@/components/WikiLayout";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const F2P_SKILLS = [
    "Attack", "Cooking", "Crafting", "Defence", "Firemaking",
    "Fishing", "Hitpoints", "Magic", "Mining", "Prayer",
    "Ranged", "Runecraft", "Smithing", "Strength", "Woodcutting"
];

const P2P_SKILLS = [
    "Agility", "Construction", "Farming", "Fletching",
    "Herblore", "Hunter", "Sailing", "Slayer", "Thieving"
];

const ALL_SKILLS = [...F2P_SKILLS, ...P2P_SKILLS];

const SkillGrid = ({title, skills, skillStats}: {
    title: string,
    skills: string[],
    skillStats: Record<string, number>
}) => (
    <div className="mb-12">
        <h2 className="text-[22px] font-serif text-[#ffffff] border-b border-[#3a3a3a] pb-2 mb-6">
            {title}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {skills.map(skillName => {
                const actionCount = skillStats[skillName] || 0;
                const urlFriendlyName = skillName.replace(/ /g, '_');

                return (
                    <Link
                        key={skillName}
                        href={`/skilling/${urlFriendlyName}`}
                        className={`border p-4 flex flex-col items-center justify-center transition-all group ${
                            actionCount > 0
                                ? "bg-[#1e1e1e] border-[#3a3a3a] hover:bg-[#2a2a2a] hover:border-[#cca052]"
                                : "bg-[#121212] border-[#222222] opacity-60 hover:opacity-100 hover:border-[#3a3a3a]"
                        }`}
                    >
                        <span
                            className={`font-bold mb-2 ${actionCount > 0 ? "text-[#729fcf] group-hover:text-[#cca052]" : "text-gray-500"}`}>
                            {skillName}
                        </span>
                        <span
                            className="text-xs font-mono text-gray-400 bg-[#000000] px-2 py-1 border border-[#3a3a3a] rounded">
                            Actions: {actionCount.toLocaleString()}
                        </span>
                    </Link>
                );
            })}
        </div>
    </div>
);

export default function SkillingHub() {
    const [skillStats, setSkillStats] = useState<Record<string, number>>({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchSkillingData() {
            setIsLoading(true);

            const {data, error} = await supabase
                .from('loot_logs')
                .select('log_data')
                .or('log_data->>category.eq.Skilling,log_data->>category.eq.Combat,log_data->>eventType.eq.XP_GAIN')
                .order('id', {ascending: false})
                .limit(20000);

            if (error) console.error("Database Error:", error);

            if (data) {
                const stats: Record<string, number> = {};

                data.forEach(row => {
                    const log = row.log_data as any;

                    let targetSkill = log?.skill;
                    if (!targetSkill && log?.category === 'Skilling') {
                        targetSkill = log?.source;
                    }

                    const evt = (log?.eventType || log?.action || "").toUpperCase();

                    // Allow XP_GAIN again so Magic/Combat register!
                    const isValidAction = ['', 'GATHER_GAIN', 'SPELL_CAST', 'RANGED_FIRE', 'XP_GAIN'].includes(evt);

                    if (targetSkill && isValidAction) {
                        const cleanSkill = targetSkill.charAt(0).toUpperCase() + targetSkill.slice(1).toLowerCase();

                        // NEW: Ensure we aren't accidentally assigning actions to "Highwayman"
                        if (ALL_SKILLS.includes(cleanSkill)) {
                            stats[cleanSkill] = (stats[cleanSkill] || 0) + 1;
                        }
                    }
                });

                setSkillStats(stats);
            }
            setIsLoading(false);
        }

        fetchSkillingData();
    }, []);

    return (
        <WikiLayout>
            <div className="max-w-[1200px] p-6 text-[14px] leading-relaxed">
                <div className="max-w-[1200px] mx-auto">

                    <div className="mb-6 text-sm">
                        <Link href="/" className="text-[#729fcf] hover:underline">Home</Link>
                        <span className="mx-2 text-gray-500">{'>'}</span>
                        <span className="text-gray-300">Skilling</span>
                    </div>

                    <div className="border-b border-[#3a3a3a] pb-4 mb-8">
                        <h1 className="text-[32px] font-serif text-[#ffffff] font-normal tracking-wide">
                            Skilling Directory
                        </h1>
                        <p className="text-gray-400 mt-2">
                            Track your gathering yields, resource gains, and skilling activity.
                        </p>
                    </div>

                    {isLoading ? (
                        <div className="text-center p-12 text-gray-500 italic border border-[#3a3a3a] bg-[#1e1e1e]">
                            Scanning skilling records...
                        </div>
                    ) : (
                        <>
                            <SkillGrid title="Free-to-Play Skills" skills={F2P_SKILLS} skillStats={skillStats}/>
                            <SkillGrid title="Members Skills" skills={P2P_SKILLS} skillStats={skillStats}/>
                        </>
                    )}
                </div>
            </div>
        </WikiLayout>
    );
}