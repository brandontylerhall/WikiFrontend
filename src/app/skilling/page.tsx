"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface DatabaseRow {
    log_data: {
        action?: string;
        sessionId?: string;
        items?: Array<{
            id: number;
            name?: string;
            qty: number;
        }>;
    };
}

interface SkillStat {
    totalXp: number;
    sessionXp: number;
}

const COMBAT_SKILLS = ["Attack", "Strength", "Defence", "Ranged", "Magic", "Hitpoints", "Prayer"];

export default function SkillingHub() {
    const [skillTotals, setSkillTotals] = useState<Record<string, SkillStat>>({});
    const [isOnline, setIsOnline] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchSkillingLogs() {
            setIsLoading(true);

            // Fetching logs that are either XP gains or session markers
            const { data, error } = await supabase
                .from('loot_logs')
                .select('log_data')
                .in('log_data->>action', ['XP_GAIN', 'SESSION_START', 'SESSION_END'])
                .order('id', { ascending: false })
                .limit(5000);

            if (error) console.error("Database Error:", error);

            if (data && data.length > 0) {
                const statsMap: Record<string, SkillStat> = {};

                // Determine online state from the absolute newest record
                const newestLog = data[0].log_data;
                const activeSessionId = newestLog.sessionId;
                const userIsOnline = newestLog.action !== 'SESSION_END';

                setIsOnline(userIsOnline);

                data.forEach((row: DatabaseRow) => {
                    const log = row.log_data;

                    // ONLY process actual XP_GAIN actions for the totals
                    if (log.action === 'XP_GAIN' && log.items && log.items.length > 0) {
                        const item = log.items[0];
                        const skillName = item.name || "Unknown Skill";
                        const xpValue = item.qty;

                        // Safety check for that previous total XP bug
                        if (xpValue > 50000) return;

                        if (!COMBAT_SKILLS.includes(skillName)) {
                            if (!statsMap[skillName]) {
                                statsMap[skillName] = { totalXp: 0, sessionXp: 0 };
                            }

                            statsMap[skillName].totalXp += xpValue;

                            if (userIsOnline && log.sessionId === activeSessionId) {
                                statsMap[skillName].sessionXp += xpValue;
                            }
                        }
                    }
                });

                setSkillTotals(statsMap);
            }
            setIsLoading(false);
        }

        fetchSkillingLogs();
    }, []);

    return (
        <div className="min-h-screen bg-[#121212] text-[#c8c8c8] font-sans p-8">
            <div className="max-w-[1000px] mx-auto">
                <div className="mb-6 text-sm">
                    <Link href="/" className="text-[#729fcf] hover:underline">Home</Link>
                    <span className="mx-2 text-gray-500">{'>'}</span>
                    <span className="text-gray-300">Skilling Hub</span>
                </div>

                <div className="flex justify-between items-end border-b border-[#3a3a3a] pb-4 mb-8">
                    <div>
                        <h1 className="text-[32px] font-serif text-[#ffffff] font-normal tracking-wide">
                            Skilling Dashboard
                        </h1>
                        <p className="text-gray-400 mt-2">
                            Total experience gained across all non-combat skills.
                        </p>
                    </div>
                    <div>
                        {/* Live Status Indicator */}
                        {isOnline ? (
                            <div className="flex items-center gap-2 text-[#90ff90] font-bold bg-[#1e1e1e] border border-[#3a3a3a] px-3 py-1 rounded">
                                <span className="w-2 h-2 rounded-full bg-[#90ff90] animate-pulse"></span>
                                Session Active
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-gray-500 font-bold bg-[#1e1e1e] border border-[#3a3a3a] px-3 py-1 rounded">
                                <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                                Offline
                            </div>
                        )}
                    </div>
                </div>

                {isLoading ? (
                    <div className="text-center p-12 text-gray-500 italic border border-[#3a3a3a] bg-[#1e1e1e]">
                        Calculating experience totals...
                    </div>
                ) : Object.keys(skillTotals).length === 0 ? (
                    <div className="text-center p-12 text-gray-500 italic border border-[#3a3a3a] bg-[#1e1e1e]">
                        No skilling data logged yet. Go chop a tree or light a fire!
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Object.entries(skillTotals).map(([skillName, stat]) => (
                            <div key={skillName} className="bg-[#1e1e1e] border border-[#3a3a3a] p-6 rounded hover:border-[#cca052] transition-colors flex flex-col justify-between">
                                <div>
                                    <h2 className="text-2xl font-serif text-white mb-4 border-b border-[#3a3a3a] pb-2">
                                        {skillName}
                                    </h2>

                                    <div className="flex justify-between items-end gap-4">
                                        <div className="flex flex-col gap-1">
                                            <div className="text-gray-400 text-sm">Total Tracked</div>
                                            <div className="text-3xl font-bold text-[#fbdb71]">
                                                {stat.totalXp.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                            </div>
                                        </div>

                                        {/* Only show the Session XP block if the user is online! */}
                                        {isOnline && (
                                            <div className="flex flex-col gap-1 text-right">
                                                <div className="text-gray-400 text-sm">This Session</div>
                                                <div className="text-xl font-bold text-[#90ff90]">
                                                    +{stat.sessionXp.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-6 flex justify-end">
                                    <Link href={`/skilling/${skillName}`} className="text-xs text-[#729fcf] hover:underline">
                                        View Breakdown →
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}