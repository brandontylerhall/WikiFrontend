"use client";

import React, {useEffect, useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import WikiLayout from '@/components/WikiLayout';
import { useCharacter } from '@/lib/CharacterContext';
import { usePeriod } from '@/lib/PeriodContext';
import { SkillProgressionChart, SkillProgressionPoint } from '@/components/ProgressionChart';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface SkillingActionStat {
    name: string;
    totalXp: number;
    actionCount: number;
}

interface SkillDetailResult {
    total_xp: number;
    training: { source: string; xp: number; actions: number }[];
    quest_xp: { source: string; xp: number }[];
}

export default function IndividualSkillPage() {
    const params = useParams();
    const { activeCharacter, isLoading: charLoading } = useCharacter();
    const { period } = usePeriod();
    const rawSkill = typeof params?.skill === 'string' ? params.skill : '';
    const skillName = rawSkill.replace(/_/g, ' ');

    const [isLoading, setIsLoading] = useState(true);
    const [totalSkillXp, setTotalSkillXp] = useState(0);
    const [actionStats, setActionStats] = useState<SkillingActionStat[]>([]);
    const [questStats, setQuestStats] = useState<SkillingActionStat[]>([]); // New state for Quest XP
    const [progression, setProgression] = useState<SkillProgressionPoint[]>([]);

    useEffect(() => {
        setTotalSkillXp(0);
        setActionStats([]);
        setQuestStats([]);
        setProgression([]);

        if (charLoading || !activeCharacter) {
            if (!charLoading) setIsLoading(false);
            return;
        }

        async function fetchSkillData() {
            setIsLoading(true);

            const [detailRes, progressionRes] = await Promise.all([
                supabase.rpc('get_skill_detail', {
                    p_character_id: activeCharacter!.id,
                    p_skill_name: skillName,
                    p_period: period,
                }),
                supabase.rpc('get_skill_progression', {
                    p_character_id: activeCharacter!.id,
                    p_skill_name: skillName,
                }),
            ]);

            if (detailRes.error) console.error(detailRes.error);
            if (progressionRes.error) console.error(progressionRes.error);

            const detail = detailRes.data as SkillDetailResult | null;
            if (detail) {
                setTotalSkillXp(Number(detail.total_xp) || 0);
                setActionStats((detail.training || []).map(t => ({
                    name: t.source,
                    totalXp: Number(t.xp),
                    actionCount: Number(t.actions),
                })));
                setQuestStats((detail.quest_xp || []).map(q => ({
                    name: q.source,
                    totalXp: Number(q.xp),
                    actionCount: 0,
                })));
            }

            setProgression((progressionRes.data as SkillProgressionPoint[]) || []);
            setIsLoading(false);
        }

        if (skillName) fetchSkillData();
    }, [skillName, activeCharacter, charLoading, period]);

    return (
        <WikiLayout>
            <div className="w-full p-6 text-[14px] leading-relaxed">
                <div className="mb-6 text-sm">
                    <Link href="/" className="text-[#729fcf] hover:underline">Home</Link> ›
                    <Link href="/xp" className="text-[#729fcf] hover:underline">Experience</Link> ›
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
                                    <tr><td colSpan={3} className="p-4 text-center text-gray-500 italic">No sustainable {skillName} activities logged yet.</td></tr>
                                ) : (
                                    actionStats.map((stat, idx) => {
                                        let linkTarget = `/items/${stat.name.replace(/ /g, '_')}`;

                                        if (skillName === "Magic") {
                                            linkTarget = `/spells/${stat.name.replace(/ /g, '_')}`;
                                        } else if (["Attack", "Strength", "Defence", "Hitpoints", "Ranged", "Slayer", "Thieving", "Hunter"].includes(skillName)) {
                                            linkTarget = `/monsters/${stat.name.replace(/ /g, '_')}`;
                                        }

                                        const isGenericActivity = stat.name === "Activity" || stat.name === "Unknown";

                                        return (
                                            <tr key={idx} className={idx % 2 === 0 ? "bg-[#1e1e1e]" : "bg-[#222222]"}>
                                                <td className="border border-[#3a3a3a] px-3 py-2">
                                                    {isGenericActivity ? (
                                                        <span className="text-gray-400">{stat.name}</span>
                                                    ) : (
                                                        <Link href={linkTarget} className="text-[#729fcf] hover:underline">
                                                            {stat.name}
                                                        </Link>
                                                    )}
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

                        <h2 className="text-[22px] font-serif text-[#ffffff] border-b border-[#3a3a3a] pb-2 mb-4">Weekly Progression</h2>
                        <div className="mb-10">
                            <SkillProgressionChart data={progression} />
                        </div>

                        {/* Quests Experience Table */}
                        {questStats.length > 0 && (
                            <>
                                <h2 className="text-[22px] font-serif text-[#ffffff] border-b border-[#3a3a3a] pb-2 mb-4">Quest Experience Rewards</h2>
                                <div className="overflow-x-auto mb-10">
                                    <table className="w-full border-collapse border border-[#3a3a3a] text-sm bg-[#1e1e1e]">
                                        <thead>
                                        <tr className="bg-[#2a2a2a] text-white">
                                            <th className="border border-[#3a3a3a] px-3 py-2 text-left font-bold w-1/2">Quest Name</th>
                                            <th className="border border-[#3a3a3a] px-3 py-2 text-right font-bold text-[#b080ff]">XP Gained</th>
                                        </tr>
                                        </thead>
                                        <tbody>
                                        {questStats.map((stat, idx) => (
                                            <tr key={idx} className={idx % 2 === 0 ? "bg-[#1e1e1e]" : "bg-[#222222]"}>
                                                <td className="border border-[#3a3a3a] px-3 py-2">
                                                    {stat.name === "Quest Reward" ? (
                                                        <span className="text-gray-400">{stat.name}</span>
                                                    ) : (
                                                        <Link href={`/quests/${stat.name.replace(/ /g, '_')}`} className="text-[#729fcf] hover:underline">
                                                            {stat.name}
                                                        </Link>
                                                    )}
                                                </td>
                                                <td className="border border-[#3a3a3a] px-3 py-2 text-right font-bold text-[#b080ff]">+{stat.totalXp.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
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
                                    {(actionStats.reduce((acc, curr) => acc + curr.actionCount, 0) + questStats.reduce((acc, curr) => acc + curr.actionCount, 0)).toLocaleString()}
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