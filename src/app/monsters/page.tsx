"use client";

import React, {useEffect, useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import Link from 'next/link';
import WikiLayout from "@/components/WikiLayout";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface MonsterViewRow {
    monster_name: string;
    kill_count: number;
}

// List of words that indicate the "monster" is actually a spell
const SPELL_KEYWORDS = ['strike', 'bolt', 'blast', 'wave', 'surge', 'teleport', 'alchemy', 'enchant', 'crumble', 'generic magic'];

const CONSUMABLE_KEYWORDS = [
    'shrimp', 'anchovies', 'sardine', 'herring', 'pike', 'trout', 'salmon', 'tuna',
    'lobster', 'swordfish', 'monkfish', 'shark', 'karambwan', 'anglerfish', 'manta ray',
    'potion', 'brew', 'meat', 'chicken', 'pie', 'pizza', 'stew', 'wine', 'kebab', 'restore', 'stamina'
];

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
                const stats = data.reduce((acc: Record<string, number>, row: MonsterViewRow) => {
                    const name = row.monster_name?.toLowerCase() || '';

                    // Filter out pickups, spells, and food!
                    const isSpell = SPELL_KEYWORDS.some(keyword => name.includes(keyword));
                    const isConsumable = CONSUMABLE_KEYWORDS.some(keyword => name.includes(keyword));
                    const isInvalid = name.includes('pickup') || name === 'none' || name === 'unknown';

                    if (row.monster_name && !isSpell && !isConsumable && !isInvalid) {
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
        <WikiLayout>
            <div className="w-full p-6 text-[14px] leading-relaxed">
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
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="w-10 h-10 shrink-0 bg-[#121212] border border-[#3a3a3a] rounded flex items-center justify-center overflow-hidden">
                                            <img
                                                src={`https://oldschool.runescape.wiki/images/${urlFriendlyName}.png`}
                                                alt={displayTitle}
                                                className="max-w-full max-h-full object-contain"
                                                loading="lazy"
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                }}
                                            />
                                        </div>
                                        <span className="font-bold text-[#729fcf] group-hover:text-[#cca052] truncate">
                                            {displayTitle}
                                        </span>
                                    </div>
                                    <span
                                        className="text-xs font-mono text-gray-400 bg-[#121212] px-2 py-1 border border-[#3a3a3a] shrink-0 ml-2">
                                        KC: {killCount.toLocaleString()}
                                    </span>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </WikiLayout>
    );
}