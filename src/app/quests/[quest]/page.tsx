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

interface WikiMetadata {
    difficulty: string;
    length: string;
    series: string;
}

export default function IndividualQuestPage() {
    const params = useParams();
    const rawQuest = typeof params?.quest === 'string' ? params.quest : '';
    const questName = decodeURIComponent(rawQuest).replace(/_/g, ' ');

    const [isLoading, setIsLoading] = useState(true);
    const [status, setStatus] = useState("NOT STARTED");
    const [startTime, setStartTime] = useState<Date | null>(null);
    const [finishTime, setFinishTime] = useState<Date | null>(null);
    const [inGameSeconds, setInGameSeconds] = useState<number | null>(null);

    const [xpRewards, setXpRewards] = useState<QuestReward[]>([]);
    const [itemRewards, setItemRewards] = useState<{name: string, qty: number}[]>([]);

    // NEW: State to hold the live Wiki data
    const [wikiData, setWikiData] = useState<WikiMetadata>({ difficulty: '-', length: '-', series: '-' });

    useEffect(() => {
        async function fetchQuestDetails() {
            setIsLoading(true);

            // 1. Fetch your personal Supabase analytics
            const {data: questLogs, error: qError} = await supabase
                .from('loot_logs')
                .select('log_data')
                .eq('log_data->>source', questName)
                .order('id', {ascending: true});

            if (qError) {
                console.error(qError);
            } else {
                let start: Date | null = null;
                let end: Date | null = null;
                let trackedSeconds: number | null = null;

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

                                if (log.note && log.note.startsWith("In-Game Ticks: ")) {
                                    const ticks = parseInt(log.note.replace("In-Game Ticks: ", ""));
                                    if (!isNaN(ticks) && ticks > 0) {
                                        trackedSeconds = Math.floor(ticks * 0.6);
                                    }
                                }
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
                setInGameSeconds(trackedSeconds);

                if (end) setStatus("FINISHED");
                else if (start) setStatus("IN PROGRESS");

                setXpRewards(Object.entries(xpMap).map(([skill, xp]) => ({ skill, xp })));
                setItemRewards(Object.entries(itemMap).map(([name, qty]) => ({ name, qty })));
            }

            // 2. NEW: Fetch live metadata via WikiText Parsing
            try {
                // MediaWiki APIs prefer underscores instead of spaces for page titles
                const safeQuestName = encodeURIComponent(questName.replace(/ /g, '_'));

                // action=parse is the universally supported MediaWiki endpoint
                const wikiUrl = `https://oldschool.runescape.wiki/api.php?action=parse&page=${safeQuestName}&prop=wikitext&format=json&origin=*`;

                const res = await fetch(wikiUrl);
                const data = await res.json();

                // Navigate the JSON to grab the raw wiki code
                const wikitext = data?.parse?.wikitext?.['*'];

                if (wikitext) {
                    // Create a mini-parser to grab exact values out of the {{Infobox Quest}}
                    const extractProp = (propName: string) => {
                        // Looks for "| difficulty = Novice"
                        const regex = new RegExp(`\\|\\s*${propName}\\s*=\\s*(.+)`, 'i');
                        const match = wikitext.match(regex);

                        if (!match) return propName === 'series' ? 'None' : 'Unknown';

                        let val = match[1].trim();

                        // 1. Remove hidden HTML comments like val = val.replace(//g, '').trim();
                        // 2. Strip out Wiki links [[Target|Display Text]] so it just says "Display Text"
                        val = val.replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, '$1');

                        return val || (propName === 'series' ? 'None' : 'Unknown');
                    };

                    setWikiData({
                        difficulty: extractProp('difficulty'),
                        length: extractProp('length'),
                        series: extractProp('series')
                    });
                }
            } catch (e) {
                console.error("Failed to fetch Wiki metadata", e);
            }

            setIsLoading(false);
        }

        if (questName) fetchQuestDetails();
    }, [questName]);

    // Format Calendar Duration
    let calendarDuration = "-";
    if (startTime && finishTime) {
        const diffSeconds = Math.floor((finishTime.getTime() - startTime.getTime()) / 1000);
        const days = Math.floor(diffSeconds / 86400);
        const hours = Math.floor((diffSeconds % 86400) / 3600);
        const minutes = Math.floor((diffSeconds % 3600) / 60);
        const seconds = diffSeconds % 60;

        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

        calendarDuration = parts.join(' ');
    } else if (!startTime && status === "FINISHED") {
        calendarDuration = "Pre-Plugin";
    }

    // Format In-Game Duration
    let inGameDuration = "Untracked";
    if (inGameSeconds !== null) {
        const hours = Math.floor(inGameSeconds / 3600);
        const mins = Math.floor((inGameSeconds % 3600) / 60);
        const secs = inGameSeconds % 60;

        const parts = [];
        if (hours > 0) parts.push(`${hours}h`);
        if (mins > 0) parts.push(`${mins}m`);
        if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

        inGameDuration = parts.join(' ');
    }

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

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div className="bg-[#1e1e1e] border border-[#3a3a3a] p-4 text-center">
                                <div className="text-gray-400 text-xs mb-1">Calendar Time</div>
                                <div className="text-xl font-bold text-white">{calendarDuration}</div>
                            </div>
                            <div className="bg-[#1e1e1e] border border-[#3a3a3a] p-4 text-center relative group">
                                <div className="text-[#729fcf] text-xs mb-1">In-Game Time (PC)</div>
                                <div className="text-xl font-bold text-white">{inGameDuration}</div>
                            </div>
                            <div className="bg-[#1e1e1e] border border-[#3a3a3a] p-4 text-center">
                                <div className="text-gray-400 text-xs mb-1">Finish Date</div>
                                <div className="text-xl font-bold text-white">
                                    {finishTime ? finishTime.toLocaleDateString() : (status === "FINISHED" ? "Pre-Plugin" : "-")}
                                </div>
                            </div>
                        </div>

                        <div className="text-xs text-gray-500 italic mb-8 border-l-2 border-[#ff6666] pl-3">
                            NOTE: In-game time can only be accurately tracked whilst actively using the Loot Logger plugin. Mobile progression is tracked via Calendar Time.
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

                                    {standardItems.length > 0 && (
                                        <div>
                                            <h3 className="text-[16px] font-bold text-[#cca052] mb-2 border-b border-[#3a3a3a] pb-1">Items</h3>
                                            <ul className="list-disc pl-5">
                                                {standardItems.map((item, idx) => (
                                                    <li key={`item-${idx}`} className="text-white mb-1">
                                                        {item.qty > 1 && (
                                                            <><span className="text-[#cca052] font-bold">{item.qty.toLocaleString()}</span>{' '}</>
                                                        )}
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

                            {/* UPDATED: Your much better image tag logic */}
                            <tr>
                                <td colSpan={2} className="p-4 text-center border-b border-[#3a3a3a] bg-[#222222]">
                                    <div className="mx-auto flex items-center justify-center border border-[#3a3a3a] bg-[#1a1a1a] overflow-hidden p-2">
                                        <img
                                            src={`https://oldschool.runescape.wiki/images/${questName.replace(/ /g, '_')}.png`}
                                            alt={questName}
                                            onError={(e) => {
                                                e.currentTarget.src = 'https://oldschool.runescape.wiki/images/Quest_point_icon.png';
                                            }}
                                            loading="lazy"
                                        />
                                    </div>
                                </td>
                            </tr>

                            {/* SECTION: Live Wiki Quest Information */}
                            <tr>
                                <th colSpan={2} className="bg-[#cca052] text-black p-1 text-center border-y border-[#3a3a3a] font-bold">
                                    Quest Information
                                </th>
                            </tr>
                            <tr className="bg-[#1e1e1e]">
                                <th className="p-2 border border-[#3a3a3a] text-left w-2/5 font-normal text-[#c8c8c8]">Difficulty</th>
                                <td className="p-2 border border-[#3a3a3a] text-right text-[#ffffff] capitalize">
                                    {isLoading ? "..." : wikiData.difficulty}
                                </td>
                            </tr>
                            <tr className="bg-[#222222]">
                                <th className="p-2 border border-[#3a3a3a] text-left font-normal text-[#c8c8c8]">Length</th>
                                <td className="p-2 border border-[#3a3a3a] text-right text-[#ffffff] capitalize">
                                    {isLoading ? "..." : wikiData.length}
                                </td>
                            </tr>
                            {wikiData.series !== 'None' && (
                                <tr className="bg-[#1e1e1e]">
                                    <th className="p-2 border border-[#3a3a3a] text-left font-normal text-[#c8c8c8]">Series</th>
                                    {/* Changed to standard white text, no link styling */}
                                    <td className="p-2 border border-[#3a3a3a] text-right text-[#ffffff]">
                                        {wikiData.series}
                                    </td>
                                </tr>
                            )}

                            {/* SECTION: Your Custom Analytics */}
                            <tr>
                                <th colSpan={2} className="bg-[#cca052] text-black p-1 text-center border-y border-[#3a3a3a] font-bold">
                                    Analytics
                                </th>
                            </tr>
                            {startTime && finishTime && (
                                <>
                                    <tr className="bg-[#1e1e1e]">
                                        <th className="p-2 border border-[#3a3a3a] text-left w-2/5 font-normal text-[#c8c8c8]">Started</th>
                                        <td className="p-2 border border-[#3a3a3a] text-right text-[#ffffff]">{startTime.toLocaleString()}</td>
                                    </tr>
                                    <tr className="bg-[#222222]">
                                        <th className="p-2 border border-[#3a3a3a] text-left font-normal text-[#c8c8c8]">Finished</th>
                                        <td className="p-2 border border-[#3a3a3a] text-right text-[#ffffff]">{finishTime.toLocaleString()}</td>
                                    </tr>
                                </>
                            )}
                            {startTime && !finishTime && (
                                <tr className="bg-[#1e1e1e]">
                                    <th className="p-2 border border-[#3a3a3a] text-left w-2/5 font-normal text-[#c8c8c8]">Started</th>
                                    <td className="p-2 border border-[#3a3a3a] text-right text-[#ffffff]">{startTime.toLocaleString()}</td>
                                </tr>
                            )}
                            {!startTime && finishTime && (
                                <tr className="bg-[#1e1e1e]">
                                    <th className="p-2 border border-[#3a3a3a] text-left w-2/5 font-normal text-[#c8c8c8]">Completion Synced</th>
                                    <td className="p-2 border border-[#3a3a3a] text-right text-[#ffffff]">{finishTime.toLocaleDateString()}</td>
                                </tr>
                            )}
                            {!startTime && !finishTime && status === "FINISHED" && (
                                <tr className="bg-[#1e1e1e]">
                                    <th className="p-2 border border-[#3a3a3a] text-left w-2/5 font-normal text-[#c8c8c8]">Completion</th>
                                    <td className="p-2 border border-[#3a3a3a] text-right text-gray-400 italic">Pre-Plugin</td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </WikiLayout>
    );
}