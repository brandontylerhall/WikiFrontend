"use client";

import React, {useEffect, useState, use} from 'react';
import {createClient} from '@supabase/supabase-js';
import Link from 'next/link';
import {LEGACY_ID_MAP, XP_MAP} from '@/lib/constants';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface DatabaseRow {
    log_data: {
        source?: string;
        category?: string;
        items?: Array<{
            id: number;
            name?: string;
            qty: number;
        }>;
    };
}

interface ResourceStat {
    name: string;
    qty: number;
    xp: number;
}

export default function IndividualSkillPage({params}: { params: Promise<{ skill: string }> }) {
    const resolvedParams = use(params);
    const rawTarget = decodeURIComponent(resolvedParams.skill);
    const targetSkill = rawTarget.replace(/_/g, ' ');

    const [resources, setResources] = useState<ResourceStat[]>([]);
    const [totalActions, setTotalActions] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchResources() {
            setIsLoading(true);
            const {data, error} = await supabase
                .from('loot_logs')
                .select('log_data')
                .ilike('log_data->>category', 'Skilling')
                .ilike('log_data->>source', targetSkill)
                .order('id', {ascending: false})
                .limit(5000);

            if (error) console.error("Database Error:", error);

            if (data) {
                const resMap: Record<string, ResourceStat> = {};
                let actions = 0;

                data.forEach((row: DatabaseRow) => {
                    const log = row.log_data;
                    if (log.items && log.items.length > 0) {
                        actions++;
                        log.items.forEach((item) => {
                            if (item.id <= 0) return;

                            const name = item.name || LEGACY_ID_MAP[item.id] || `Unknown (ID: ${item.id})`;

                            if (!resMap[name]) {
                                resMap[name] = {name, qty: 0, xp: 0};
                            }

                            resMap[name].qty += item.qty;
                            resMap[name].xp += (XP_MAP[name] || 0) * item.qty;
                        });
                    }
                });

                // Sort by highest quantity gathered
                setResources(Object.values(resMap).sort((a, b) => b.qty - a.qty));
                setTotalActions(actions);
            }
            setIsLoading(false);
        }

        fetchResources();
    }, [targetSkill]);

    const totalXp = resources.reduce((sum, r) => sum + r.xp, 0);

    return (
        <div className="min-h-screen bg-[#121212] text-[#c8c8c8] font-sans p-8">
            <div className="max-w-[1000px] mx-auto">

                {/* BREADCRUMB NAVIGATION */}
                <div className="mb-6 text-sm">
                    <Link href="/" className="text-[#729fcf] hover:underline">Home</Link>
                    <span className="mx-2 text-gray-500">{'>'}</span>
                    <Link href="/skilling" className="text-[#729fcf] hover:underline">Skilling Hub</Link>
                    <span className="mx-2 text-gray-500">{'>'}</span>
                    <span className="text-gray-300">{targetSkill}</span>
                </div>

                {/* HEADER ROW */}
                <div className="border-b border-[#3a3a3a] pb-4 mb-8 flex justify-between items-end">
                    <div>
                        <h1 className="text-[32px] font-serif text-[#ffffff] font-normal tracking-wide">
                            {targetSkill}
                        </h1>
                        <p className="text-gray-400 mt-2">
                            Total actions logged: <span className="text-white">{totalActions.toLocaleString()}</span>
                        </p>
                    </div>

                    <div className="text-right">
                        <div className="text-sm text-gray-400 mb-1">Total Tracked XP</div>
                        <div className="text-3xl font-bold text-[#fbdb71]">
                            {totalXp.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})}
                        </div>
                    </div>
                </div>

                {/* DATA TABLE */}
                <h2 className="text-[20px] font-serif text-[#ffffff] border-b border-[#3a3a3a] pb-1 mb-4">
                    Resources Gathered
                </h2>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-[#3a3a3a] text-sm bg-[#1e1e1e]">
                        <thead>
                        <tr className="bg-[#2a2a2a] text-white">
                            <th className="border border-[#3a3a3a] px-3 py-2 text-left font-bold w-1/2">Resource</th>
                            <th className="border border-[#3a3a3a] px-3 py-2 text-center font-bold">Quantity Gathered
                            </th>
                            <th className="border border-[#3a3a3a] px-3 py-2 text-right font-bold text-[#fbdb71]">XP
                                Earned
                            </th>
                        </tr>
                        </thead>
                        <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan={3}
                                    className="border border-[#3a3a3a] p-4 text-center text-gray-500 italic">
                                    Loading gathering data...
                                </td>
                            </tr>
                        ) : resources.length === 0 ? (
                            <tr>
                                <td colSpan={3}
                                    className="border border-[#3a3a3a] p-4 text-center text-gray-500 italic">
                                    No resources found for this skill.
                                </td>
                            </tr>
                        ) : (
                            resources.map((r, idx) => (
                                <tr key={idx}
                                    className={idx % 2 === 0 ? "bg-[#1e1e1e]" : "bg-[#222222] hover:bg-[#333333] transition-colors"}>
                                    <td className="border border-[#3a3a3a] px-3 py-2">
                                        {/* LINKING TO ITEMS PAGE! */}
                                        <Link href={`/items/${r.name.replace(/ /g, '_')}`}
                                              className="text-[#729fcf] hover:underline font-medium">
                                            {r.name}
                                        </Link>
                                    </td>
                                    <td className="border border-[#3a3a3a] px-3 py-2 text-center text-white">
                                        {r.qty.toLocaleString()}
                                    </td>
                                    <td className="border border-[#3a3a3a] px-3 py-2 text-right font-bold text-[#fbdb71]">
                                        {r.xp.toLocaleString(undefined, {
                                            minimumFractionDigits: 1,
                                            maximumFractionDigits: 1
                                        })}
                                    </td>
                                </tr>
                            ))
                        )}
                        </tbody>
                    </table>
                </div>

            </div>
        </div>
    );
}