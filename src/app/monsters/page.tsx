"use client";
import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import WikiLayout from "@/components/WikiLayout";
import { useCharacter } from '@/lib/CharacterContext';
import { usePeriod } from '@/lib/PeriodContext';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface MonsterListRow {
    monster_name: string;
    kill_count: number;
}

export default function MonstersHub() {
    const { activeCharacter, isLoading: charLoading } = useCharacter();
    const { period } = usePeriod();
    const [monsterStats, setMonsterStats] = useState<Record<string, number>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [wikiImages, setWikiImages] = useState<Record<string, string>>({});
    const [sortMode, setSortMode] = useState<"alpha" | "kc">("alpha");

    useEffect(() => {
        setMonsterStats({});
        if (charLoading) return;
        if (!activeCharacter) {
            setIsLoading(false);
            return;
        }

        async function fetchMonsters() {
            setIsLoading(true);
            const { data, error } = await supabase.rpc('get_monster_list', {
                p_character_id: activeCharacter!.id,
                p_period: period,
            });

            if (error) {
                console.error("Database Error:", error);
                setIsLoading(false);
                return;
            }

            if (data) {
                const stats = (data as MonsterListRow[]).reduce((acc: Record<string, number>, row) => {
                    if (row.monster_name) {
                        acc[row.monster_name] = Number(row.kill_count);
                    }
                    return acc;
                }, {});

                setMonsterStats(stats);

                const monsterNames = Object.keys(stats);
                const images: Record<string, string> = {};
                const chunkSize = 50;
                for (let i = 0; i < monsterNames.length; i += chunkSize) {
                    const chunk = monsterNames.slice(i, i + chunkSize);
                    const titles = chunk.map(n => encodeURIComponent(n.charAt(0).toUpperCase() + n.slice(1))).join('|');
                    try {
                        const res = await fetch(`https://oldschool.runescape.wiki/api.php?action=query&titles=${titles}&prop=pageimages&format=json&pithumbsize=200&origin=*`);
                        const json = await res.json();
                        if (json.query?.pages) {
                            Object.values(json.query.pages).forEach((p: any) => {
                                if (p.title && p.thumbnail?.source) {
                                    images[p.title.toLowerCase()] = p.thumbnail.source;
                                }
                            });
                        }
                    } catch (e) {
                        console.error("Failed to fetch image batch", e);
                    }
                }
                setWikiImages(images);
            }
            setIsLoading(false);
        }

        fetchMonsters();
    }, [activeCharacter, charLoading, period]);

    const sortedMonsters = Object.entries(monsterStats).sort((a, b) => {
        if (sortMode === "alpha") return a[0].localeCompare(b[0]);
        return b[1] - a[1];
    });

    return (
        <WikiLayout>
            <div className="w-full p-6 text-[14px] leading-relaxed">
                <div className="mb-6 text-sm">
                    <Link href="/" className="text-[#729fcf] hover:underline">Home</Link>
                    <span className="mx-2 text-gray-500">{'>'}</span>
                    <span className="text-gray-300">Bestiary</span>
                </div>
                <div className="border-b border-[#3a3a3a] pb-4 mb-8">
                    <div className="flex gap-2 mt-4">
                        <button onClick={() => setSortMode("alpha")} className={`text-xs px-3 py-1 border ${sortMode === "alpha" ? "bg-[#cca052] text-black border-[#cca052]" : "bg-[#2a2a2a] border-[#3a3a3a] text-[#c8c8c8] hover:bg-[#3a3a3a]"}`}>A–Z</button>
                        <button onClick={() => setSortMode("kc")} className={`text-xs px-3 py-1 border ${sortMode === "kc" ? "bg-[#cca052] text-black border-[#cca052]" : "bg-[#2a2a2a] border-[#3a3a3a] text-[#c8c8c8] hover:bg-[#3a3a3a]"}`}>Kill Count</button>
                    </div>
                    <h1 className="text-[32px] font-serif text-[#ffffff] font-normal tracking-wide">Bestiary & Combat Logs</h1>
                    <p className="text-gray-400 mt-2">A comprehensive record of every monster you have defeated.</p>
                </div>

                {charLoading || isLoading ? (
                    <div className="text-center p-12 text-gray-500 italic border border-[#3a3a3a] bg-[#1e1e1e]">Scanning combat records...</div>
                ) : !activeCharacter ? (
                    <div className="text-center p-12 text-gray-500 italic border border-[#3a3a3a] bg-[#1e1e1e]">No character selected. Create one on the <Link href="/account" className="text-[#729fcf] hover:underline">account page</Link>.</div>
                ) : sortedMonsters.length === 0 ? (
                    <div className="text-center p-12 text-gray-500 italic border border-[#3a3a3a] bg-[#1e1e1e]">No monsters defeated yet for {activeCharacter.label}.</div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {sortedMonsters.map(([monsterName, killCount]) => {
                            const urlFriendlyName = monsterName.replace(/ /g, '_');
                            const displayTitle = monsterName.charAt(0).toUpperCase() + monsterName.slice(1);
                            const imgSrc = wikiImages[monsterName.toLowerCase()] || `https://oldschool.runescape.wiki/images/${urlFriendlyName}.png`;
                            return (
                                <Link key={monsterName} href={`/monsters/${urlFriendlyName}`}
                                      className="bg-[#1e1e1e] border border-[#3a3a3a] p-4 flex justify-between items-center hover:bg-[#2a2a2a] hover:border-[#cca052] transition-colors group">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="w-10 h-10 shrink-0 rounded flex items-center justify-center overflow-hidden">
                                            <img src={imgSrc} alt={displayTitle} className="max-w-full max-h-full object-contain" loading="lazy"
                                                 onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                        </div>
                                        <span className="font-bold text-[#729fcf] group-hover:text-[#cca052] truncate">{displayTitle}</span>
                                    </div>
                                    <span className="text-xs font-mono text-gray-400 px-2 py-1 shrink-0 ml-2">KC: {killCount.toLocaleString()}</span>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </WikiLayout>
    );
}