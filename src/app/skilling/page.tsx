"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);
import {LEGACY_ID_MAP, XP_MAP} from '@/lib/constants';

export default function SkillingHub() {
    const [skillTotals, setSkillTotals] = useState<Record<string, number>>({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchSkillingLogs() {
            setIsLoading(true);

            const { data, error } = await supabase
                .from('loot_logs')
                .select('log_data')
                .ilike('log_data->>category', 'Skilling');

            if (error) console.error("Database Error:", error);

            if (data) {
                const totals = data.reduce((acc: Record<string, number>, row: any) => {
                    const log = row.log_data;
                    const skill = log.source || "Unknown Skilling";

                    acc[skill] = acc[skill] || 0;

                    if (log.items && log.items.length > 0) {
                        const item = log.items[0];
                        const itemName = item.name || LEGACY_ID_MAP[item.id] || `Unknown (ID: ${item.id})`;
                        const xp = (XP_MAP[itemName] || 0) * item.qty;
                        acc[skill] += xp;
                    }

                    return acc;
                }, {});

                setSkillTotals(totals);
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

                <div className="border-b border-[#3a3a3a] pb-4 mb-8">
                    <h1 className="text-[32px] font-serif text-[#ffffff] font-normal tracking-wide">
                        Skilling Dashboard
                    </h1>
                    <p className="text-gray-400 mt-2">
                        Total experience gained across all tracked resource gathering sessions.
                    </p>
                </div>

                {isLoading ? (
                    <div className="text-center p-12 text-gray-500 italic border border-[#3a3a3a] bg-[#1e1e1e]">
                        Calculating experience totals...
                    </div>
                ) : Object.keys(skillTotals).length === 0 ? (
                    <div className="text-center p-12 text-gray-500 italic border border-[#3a3a3a] bg-[#1e1e1e]">
                        No skilling data logged yet. Go chop a tree!
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Object.entries(skillTotals).map(([skillName, totalXp]) => (
                            <div key={skillName} className="bg-[#1e1e1e] border border-[#3a3a3a] p-6 rounded hover:border-[#cca052] transition-colors">
                                <h2 className="text-2xl font-serif text-white mb-4 border-b border-[#3a3a3a] pb-2">
                                    {skillName}
                                </h2>

                                <div className="flex flex-col gap-1">
                                    <div className="text-gray-400 text-sm">Total Tracked XP</div>
                                    <div className="text-3xl font-bold text-[#fbdb71]">
                                        {totalXp.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
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