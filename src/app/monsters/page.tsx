"use client";

import React, {useEffect, useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import Link from 'next/link';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface MonsterViewRow {
    monster_name: string;
    kill_count: number;
}

export default function MonstersHub() {
    const [monsterStats, setMonsterStats] = useState<Record<string, number>>({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchMonsters() {
            setIsLoading(true);

            const {data, error} = await supabase
                .from('monster_kill_counts')
                .select('*')
                .order('monster_name', {ascending: true});

            if (error) console.error("Database Error:", error);

            if (data) {
                // Properly type the 'row' as the view's output
                const stats = data.reduce((acc: Record<string, number>, row: MonsterViewRow) => {
                    if (row.monster_name && !row.monster_name.toLowerCase().includes('pickup')) {
                        acc[row.monster_name] = row.kill_count;
                    }
                    return acc;
                }, {});

                setMonsterStats(stats);
            }
            setIsLoading(false);
        }

        fetchMonsters();
    }, []);

    const sortedMonsters = Object.entries(monsterStats).sort((a, b) => a[0].localeCompare(b[0]));

    return (
        <div className="min-h-screen bg-[#121212] text-[#c8c8c8] font-sans p-8">
            <div className="max-w-[1000px] mx-auto">

                {/* Breadcrumb */}
                <div className="mb-6 text-sm">
                    <Link href="/" className="text-[#729fcf] hover:underline">Home</Link>
                    <span className="mx-2 text-gray-500">{'>'}</span>
                    <span className="text-gray-300">Monsters</span>
                </div>

                <div className="border-b border-[#3a3a3a] pb-4 mb-8">
                    <h1 className="text-[32px] font-serif text-[#ffffff] font-normal tracking-wide">
                        Bestiary & Combat Logs
                    </h1>
                    <p className="text-gray-400 mt-2">
                        A comprehensive record of every monster you have defeated.
                    </p>
                </div>

                {isLoading ? (
                    <div className="text-center p-12 text-gray-500 italic border border-[#3a3a3a] bg-[#1e1e1e]">
                        Scanning combat records...
                    </div>
                ) : sortedMonsters.length === 0 ? (
                    <div className="text-center p-12 text-gray-500 italic border border-[#3a3a3a] bg-[#1e1e1e]">
                        No monsters defeated yet.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {sortedMonsters.map(([monsterName, killCount]) => {
                            const urlFriendlyName = monsterName.replace(/ /g, '_');
                            const displayTitle = monsterName.charAt(0).toUpperCase() + monsterName.slice(1);

                            return (
                                <Link
                                    key={monsterName}
                                    href={`/monsters/${urlFriendlyName}`}
                                    className="bg-[#1e1e1e] border border-[#3a3a3a] p-4 flex justify-between items-center hover:bg-[#2a2a2a] hover:border-[#cca052] transition-colors group"
                                >
                                  <span className="font-bold text-[#729fcf] group-hover:text-[#cca052]">
                                    {displayTitle}
                                  </span>
                                    <span className="text-xs font-mono text-gray-400 bg-[#121212] px-2 py-1 border border-[#3a3a3a]">
                                    KC: {killCount.toLocaleString()}
                                  </span>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}