"use client";

import React, {useEffect, useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import Link from 'next/link';
import WikiLayout from '@/components/WikiLayout';
import questList from '@/data/quests.json';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function QuestsHub() {
    const [questStates, setQuestStates] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchQuestProgress() {
            setIsLoading(true);
            const {data, error} = await supabase
                .from('loot_logs')
                .select('log_data')
                .eq('log_data->>eventType', 'QUEST_PROGRESS')
                .order('id', {ascending: true}); // Ascending so FINISHED overwrites IN_PROGRESS

            if (error) console.error(error);

            if (data) {
                const states: Record<string, string> = {};
                data.forEach(row => {
                    const log = row.log_data as any;
                    if (log.source && log.target) {
                        states[log.source] = log.target; // "Cook's Assistant": "FINISHED"
                    }
                });
                setQuestStates(states);
            }
            setIsLoading(false);
        }

        fetchQuestProgress();
    }, []);

    const f2pQuests = questList.filter(q => q.type === "F2P");
    const p2pQuests = questList.filter(q => q.type === "P2P");

    const getQuestColor = (state: string) => {
        if (state === "FINISHED") return "text-[#90ff90]";
        if (state === "IN_PROGRESS") return "text-[#ffff90]";
        return "text-[#ff6666]"; // NOT_STARTED
    };

    return (
        <WikiLayout>
            <div className="w-full p-6 text-[14px] leading-relaxed">
                <div className="mb-6 text-sm">
                    <Link href="/" className="text-[#729fcf] hover:underline">Home</Link> ›
                    <span className="text-gray-300"> Quests</span>
                </div>

                <div className="border-b border-[#3a3a3a] pb-4 mb-8">
                    <h1 className="text-[32px] font-serif text-[#ffffff] font-normal tracking-wide">
                        Quest Journal
                    </h1>
                    <p className="text-gray-400 mt-2">Track completion times and rewards.</p>
                </div>

                {isLoading ? (
                    <div className="text-center p-12 text-gray-500 italic bg-[#1e1e1e] border border-[#3a3a3a]">Loading quest data...</div>
                ) : (
                    <div className="flex flex-col lg:flex-row gap-8">
                        {/* F2P QUESTS */}
                        <div className="flex-1">
                            <h2 className="text-[22px] font-serif text-[#ffffff] border-b border-[#3a3a3a] pb-2 mb-4">Free-to-Play Quests</h2>
                            <div className="bg-[#1e1e1e] border border-[#3a3a3a] p-4 flex flex-col gap-2 font-bold font-serif text-[16px]">
                                {f2pQuests.map(q => {
                                    const state = questStates[q.name] || "NOT_STARTED";
                                    return (
                                        <Link key={q.name} href={`/quests/${q.name.replace(/ /g, '_')}`} className={`${getQuestColor(state)} hover:underline drop-shadow-md`}>
                                            {q.name}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>

                        {/* P2P QUESTS (Placeholder for now) */}
                        <div className="flex-1 opacity-50">
                            <h2 className="text-[22px] font-serif text-[#ffffff] border-b border-[#3a3a3a] pb-2 mb-4">Members' Quests</h2>
                            <div className="bg-[#1e1e1e] border border-[#3a3a3a] p-4 text-center text-gray-500 italic">
                                Migrate to P2P to unlock.
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </WikiLayout>
    );
}