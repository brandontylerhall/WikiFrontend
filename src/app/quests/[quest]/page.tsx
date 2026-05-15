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

interface QuestReward {
    skill: string;
    xp: number;
}

export default function IndividualQuestPage() {
    const params = useParams();
    const rawQuest = typeof params?.quest === 'string' ? params.quest : '';
    const questName = decodeURIComponent(rawQuest).replace(/_/g, ' ');

    const [isLoading, setIsLoading] = useState(true);
    const [status, setStatus] = useState("NOT STARTED");
    const [startTime, setStartTime] = useState<Date | null>(null);
    const [finishTime, setFinishTime] = useState<Date | null>(null);

    const [xpRewards, setXpRewards] = useState<QuestReward[]>([]);
    const [itemRewards, setItemRewards] = useState<{name: string, qty: number}[]>([]);

    useEffect(() => {
        async function fetchQuestDetails() {
            setIsLoading(true);

            const {data: questLogs, error: qError} = await supabase
                .from('loot_logs')
                .select('log_data')
                .eq('log_data->>source', questName)
                .order('id', {ascending: true});

            if (qError) {
                console.error(qError);
                setIsLoading(false);
                return;
            }

            let start: Date | null = null;
            let end: Date | null = null;

            const xpMap: Record<string, number> = {};
            const itemMap: Record<string, number> = {};

            if (questLogs) {
                for (const row of questLogs) {
                    const log = row.log_data as any;

                    if (log.eventType === 'QUEST_PROGRESS') {
                        if (log.target === "IN_PROGRESS" && !start) {
                            start = new Date(log.timestamp);
                        }
                        if (log.target === "FINISHED") {
                            end = new Date(log.timestamp);
                        }
                    }

                    if (log.eventType === 'XP_GAIN') {
                        xpMap[log.skill] = (xpMap[log.skill] || 0) + log.xpGained;
                    }

                    if (log.eventType === 'DIALOGUE_REWARD' && log.items) {
                        log.items.forEach((item: any) => {
                            itemMap[item.name] = (itemMap[item.name] || 0) + item.qty;
                        });
                    }
                }
            }

            setStartTime(start);
            setFinishTime(end);

            if (end) setStatus("FINISHED");
            else if (start) setStatus("IN PROGRESS");

            setXpRewards(Object.entries(xpMap).map(([skill, xp]) => ({ skill, xp })));
            setItemRewards(Object.entries(itemMap).map(([name, qty]) => ({ name, qty })));

            setIsLoading(false);
        }

        if (questName) fetchQuestDetails();
    }, [questName]);

    // Calculate Duration string
    let durationString = "Unknown";
    if (startTime && finishTime) {
        const diffMs = finishTime.getTime() - startTime.getTime();
        const minutes = Math.floor(diffMs / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) durationString = `${days} Days, ${hours % 24} Hours`;
        else if (hours > 0) durationString = `${hours} Hours, ${minutes % 60} Minutes`;
        else durationString = `${minutes} Minutes`;
    }

    // --- NEW: Split rewards into categories ---
    const questPointsItem = itemRewards.find(i => i.name === "Quest point");
    const standardItems = itemRewards.filter(i => i.name !== "Quest point");
    const questPointsCount = questPointsItem ? questPointsItem.qty : 0;

    return (
        <WikiLayout>
            <div className="w-full p-6 text-[14px] leading-relaxed">
                <div className="mb-6 text-sm">
                    <Link href="/" className="text-[#729fcf] hover:underline">Home</Link> ›
                    <Link href="/quests" className="text-[#729fcf] hover:underline">Quests</Link> ›
                    <span className="text-gray-300"> {questName}</span>
                </div>

                <div className="border-b border-[#3a3a3a] pb-6 mb-8 flex justify-between items-end">
                    <h1 className="text-[32px] font-serif text-white tracking-wide">{questName}</h1>
                    <div className="text-right">
                        <div className="text-sm text-gray-400">Current Status</div>
                        <div className={`text-2xl font-bold ${status === 'FINISHED' ? 'text-[#90ff90]' : status === 'IN PROGRESS' ? 'text-[#ffff90]' : 'text-[#ff6666]'}`}>
                            {status}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-8 items-start">
                    <div className="flex-1 w-full order-2 lg:order-1">
                        <h2 className="text-[22px] font-serif text-[#ffffff] border-b border-[#3a3a3a] pb-2 mb-4">Quest Analytics</h2>

                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <div className="bg-[#1e1e1e] border border-[#3a3a3a] p-4 text-center">
                                <div className="text-gray-400 text-xs mb-1">Time to Complete (Calendar)</div>
                                <div className="text-xl font-bold text-white">{durationString}</div>
                            </div>
                            <div className="bg-[#1e1e1e] border border-[#3a3a3a] p-4 text-center">
                                <div className="text-gray-400 text-xs mb-1">Finish Date</div>
                                <div className="text-xl font-bold text-white">{finishTime ? finishTime.toLocaleDateString() : "-"}</div>
                            </div>
                        </div>

                        <h2 className="text-[22px] font-serif text-[#ffffff] border-b border-[#3a3a3a] pb-2 mb-4">Observed Rewards</h2>
                        <div className="bg-[#1e1e1e] border border-[#3a3a3a] p-4">
                            {isLoading ? (
                                <p className="text-gray-500 italic text-center">Scanning ledgers...</p>
                            ) : (xpRewards.length === 0 && itemRewards.length === 0) ? (
                                <p className="text-gray-500 italic text-center">
                                    {status === "FINISHED" ? "No rewards were detected for this quest." : "No rewards have been granted yet."}
                                </p>
                            ) : (
                                <div className="flex flex-col gap-6">

                                    {/* SECTION: Quest Points */}
                                    {questPointsCount > 0 && (
                                        <div>
                                            <h3 className="text-[16px] font-bold text-[#b080ff] mb-2 border-b border-[#3a3a3a] pb-1">Quest Points</h3>
                                            <ul className="list-disc pl-5">
                                                <li className="text-white">
                                                    <Link href="/items/Quest_point" className="hover:underline">
                                                        <span className="text-[#b080ff] font-bold">{questPointsCount}</span> Quest Point{questPointsCount !== 1 ? 's' : ''}
                                                    </Link>
                                                </li>
                                            </ul>
                                        </div>
                                    )}

                                    {/* SECTION: Experience */}
                                    {xpRewards.length > 0 && (
                                        <div>
                                            <h3 className="text-[16px] font-bold text-[#90ff90] mb-2 border-b border-[#3a3a3a] pb-1">Experience</h3>
                                            <ul className="list-disc pl-5">
                                                {xpRewards.map((reward, idx) => (
                                                    <li key={`xp-${idx}`} className="text-white mb-1">
                                                        <span className="text-[#90ff90] font-bold">{reward.xp.toLocaleString()}</span> {reward.skill} XP
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* SECTION: Items */}
                                    {standardItems.length > 0 && (
                                        <div>
                                            <h3 className="text-[16px] font-bold text-[#cca052] mb-2 border-b border-[#3a3a3a] pb-1">Items</h3>
                                            <ul className="list-disc pl-5">
                                                {standardItems.map((item, idx) => (
                                                    <li key={`item-${idx}`} className="text-white mb-1">
                                                        <span className="text-[#cca052] font-bold">{item.qty.toLocaleString()}x</span>{' '}
                                                        <Link href={`/items/${item.name.replace(/ /g, '_')}`} className="text-[#729fcf] hover:underline">
                                                            {item.name}
                                                        </Link>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                </div>
                            )}
                        </div>
                    </div>

                    {/* WIKI SIDEBAR */}
                    <div className="w-full lg:w-[320px] order-1 lg:order-2 shrink-0">
                        <table className="w-full border-collapse border border-[#3a3a3a] bg-[#1e1e1e] text-[13px]">
                            <tbody>
                            <tr>
                                <th colSpan={2} className="bg-[#cca052] text-black text-[16px] p-2 border-b border-[#3a3a3a] text-center font-bold">
                                    {questName}
                                </th>
                            </tr>
                            <tr className="bg-[#1e1e1e]">
                                <th className="p-2 border border-[#3a3a3a] text-left w-2/5 font-normal text-[#c8c8c8]">Started</th>
                                <td className="p-2 border border-[#3a3a3a] text-right text-[#ffffff]">{startTime ? startTime.toLocaleString() : "-"}</td>
                            </tr>
                            <tr className="bg-[#222222]">
                                <th className="p-2 border border-[#3a3a3a] text-left font-normal text-[#c8c8c8]">Finished</th>
                                <td className="p-2 border border-[#3a3a3a] text-right text-[#ffffff]">{finishTime ? finishTime.toLocaleString() : "-"}</td>
                            </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </WikiLayout>
    );
}