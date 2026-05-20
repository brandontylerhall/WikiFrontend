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
    const [totalQP, setTotalQP] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        async function fetchQuestProgress() {
            setIsLoading(true);

            const {data, error} = await supabase
                .from('loot_logs')
                .select('log_data')
                .eq('log_data->>category', 'Quests')
                .order('id', {ascending: true});

            if (error) {
                console.error(error);
                setIsLoading(false);
                return;
            }

            if (data) {
                const states: Record<string, string> = {};
                const qpMap = new Map<string, number>();
                const validQuestNames = new Set(questList.map((q: any) => q.name));

                data.forEach(row => {
                    const log = row.log_data as any;
                    const source = log.source;

                    if (!source || !validQuestNames.has(source)) return;

                    if (log.eventType === 'QUEST_PROGRESS' && log.target) {
                        states[source] = log.target;
                    }

                    if (log.eventType === 'DIALOGUE_REWARD' && log.items) {
                        log.items.forEach((item: any) => {
                            if (item.name === "Quest point") {
                                qpMap.set(source, item.qty);
                                states[source] = "FINISHED";
                            }
                        });
                    }
                });

                setQuestStates(states);
                setTotalQP(Array.from(qpMap.values()).reduce((a, b) => a + b, 0));
            }
            setIsLoading(false);
        }

        fetchQuestProgress();
    }, []);

    const f2pQuests = questList.filter(q => q.type === "F2P");

    const getQuestColor = (state: string) => {
        if (state === "FINISHED") return "text-[#90ff90]";
        if (state === "IN_PROGRESS") return "text-[#ffff90]";
        return "text-[#ff6666]";
    };

    const handleLockedQuestClick = (questName: string) => {
        setErrorMessage(`You have not encountered "${questName}" yet. Embark on the adventure in-game first!`);
        setTimeout(() => setErrorMessage(null), 3000);
    };

    return (
        <WikiLayout>
            <div className="w-full p-6 text-[14px] leading-relaxed relative">
                {errorMessage && (
                    <div className="fixed bottom-10 right-10 bg-[#222222] border-l-4 border-[#ff6666] text-white p-4 shadow-2xl z-50 animate-fade-in font-serif">
                        <span className="font-bold text-[#ff6666] mr-2">Locked:</span>
                        {errorMessage}
                    </div>
                )}

                <div className="mb-6 text-sm">
                    <Link href="/" className="text-[#729fcf] hover:underline">Home</Link> ›
                    <span className="text-gray-300"> Quests</span>
                </div>

                <div className="border-b border-[#3a3a3a] pb-4 mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
                    <div>
                        <h1 className="text-[32px] font-serif text-[#ffffff] font-normal tracking-wide">
                            Quest Journal
                        </h1>
                        <p className="text-gray-400 mt-2">Track completion times and rewards.</p>
                    </div>

                    <div className="text-right">
                        <div className="text-sm text-gray-400 mb-1">Total Quest Points</div>
                        <div className="text-3xl font-bold text-[#b080ff] flex items-center justify-end gap-2">
                            {totalQP.toLocaleString()}
                            <img
                                src="https://oldschool.runescape.wiki/images/Quest_point_icon.png"
                                alt="QP"
                                className="w-6 h-6 object-contain"
                            />
                        </div>
                    </div>
                </div>

                {isLoading ? (
                    <div className="text-center p-12 text-gray-500 italic bg-[#1e1e1e] border border-[#3a3a3a]">Loading quest data...</div>
                ) : (
                    <div className="flex flex-col lg:flex-row gap-8">
                        <div className="flex-1">
                            <h2 className="text-[22px] font-serif text-[#ffffff] border-b border-[#3a3a3a] pb-2 mb-4">Free-to-Play Quests</h2>
                            <div className="bg-[#1e1e1e] border border-[#3a3a3a] p-4 flex flex-col gap-2 font-bold font-serif text-[16px]">
                                {f2pQuests.map(q => {
                                    const state = questStates[q.name] || "NOT_STARTED";

                                    if (state === "NOT_STARTED") {
                                        return (
                                            <button
                                                key={q.name}
                                                onClick={() => handleLockedQuestClick(q.name)}
                                                className={`${getQuestColor(state)} text-left hover:opacity-75 transition-opacity drop-shadow-md cursor-not-allowed`}
                                            >
                                                {q.name}
                                            </button>
                                        );
                                    }

                                    return (
                                        <Link key={q.name} href={`/quests/${q.name.replace(/ /g, '_')}`} className={`${getQuestColor(state)} hover:underline drop-shadow-md`}>
                                            {q.name}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>

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