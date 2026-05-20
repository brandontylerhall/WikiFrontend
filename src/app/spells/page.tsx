"use client";

import React, {useEffect, useState} from 'react';
import Link from 'next/link';
import {createClient} from '@supabase/supabase-js';
import WikiLayout from "@/components/WikiLayout";
import {DatabaseRow} from '@/lib/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const COMBAT_SPELLS = [
    "Wind Strike", "Water Strike", "Earth Strike", "Fire Strike",
    "Wind Bolt", "Water Bolt", "Earth Bolt", "Fire Bolt",
    "Wind Blast", "Water Blast", "Earth Blast", "Fire Blast"
];

const TELEPORT_SPELLS = [
    "Lumbridge Teleport", "Varrock Teleport", "Falador Teleport", "Camelot Teleport"
];

const UTILITY_SPELLS = [
    "High Level Alchemy", "Low Level Alchemy", "Monster Examine", "Monster Inspect"
];

const KNOWN_SPELLS = new Set([...COMBAT_SPELLS, ...TELEPORT_SPELLS, ...UTILITY_SPELLS]);

const SpellGrid = ({ title, spells, colorClass }: { title: string, spells: string[], colorClass: string }) => {
    if (spells.length === 0) return null;

    return (
        <div className="mb-10">
            <h2 className={`text-[22px] font-serif border-b border-[#3a3a3a] pb-2 mb-4 ${colorClass}`}>
                {title}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {spells.map(spell => {
                    const urlFriendlyName = spell.replace(/ /g, '_');
                    return (
                        <Link
                            key={spell}
                            href={`/spells/${urlFriendlyName}`}
                            className="bg-[#1e1e1e] border border-[#3a3a3a] p-4 flex flex-col items-center justify-center hover:bg-[#2a2a2a] hover:border-[#cca052] transition-all group"
                        >
                            <div className="w-10 h-10 mb-3 flex items-center justify-center overflow-hidden">
                                <img
                                    src={`https://oldschool.runescape.wiki/images/${urlFriendlyName}.png`}
                                    alt={spell}
                                    className="max-w-full max-h-full object-contain drop-shadow-md group-hover:scale-110 transition-transform"
                                    loading="lazy"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                            </div>
                            <span className="font-bold text-[#729fcf] group-hover:text-[#cca052] text-center text-sm">
                                {spell}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
};

export default function SpellsHub() {
    const [castSpells, setCastSpells] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchUnlockedSpells() {
            setIsLoading(true);

            // Fetch Casts OR Magic XP
            const {data, error} = await supabase
                .from('loot_logs')
                .select('log_data')
                .or('log_data->>eventType.eq.SPELL_CAST,log_data->>eventType.eq.MONSTER_EXAMINE,log_data->>skill.eq.Magic')
                .limit(10000);

            if (error) console.error("Database Error:", error);

            if (data) {
                const uniqueSpells = new Set<string>();
                const invalidSources = ["Generic Magic", "Unknown", "None", "Goblin", "Activity"];

                data.forEach((row: DatabaseRow) => {
                    const log = row.log_data;
                    // Ignore quest XP drops!
                    if (!log || log.category === 'Quests') return;

                    let src = log.source;
                    if (src && src.includes("->")) src = src.split("->")[0].trim();

                    if (src && !invalidSources.includes(src)) {
                        uniqueSpells.add(src);
                    }
                });
                setCastSpells(uniqueSpells);
            }
            setIsLoading(false);
        }

        fetchUnlockedSpells();
    }, []);

    const activeCombat = COMBAT_SPELLS.filter(s => castSpells.has(s));
    const activeTeleports = TELEPORT_SPELLS.filter(s => castSpells.has(s));
    const activeUtility = UTILITY_SPELLS.filter(s => castSpells.has(s));

    const otherSpells = Array.from(castSpells).filter(s => !KNOWN_SPELLS.has(s));

    return (
        <WikiLayout>
            <div className="w-full p-6 text-[14px] leading-relaxed">
                <div className="mb-6 text-sm">
                    <Link href="/" className="text-[#729fcf] hover:underline">Home</Link>
                    <span className="mx-2 text-gray-500">{'>'}</span>
                    <span className="text-gray-300">Spellbook</span>
                </div>

                <div className="border-b border-[#3a3a3a] pb-4 mb-8">
                    <h1 className="text-[32px] font-serif text-[#ffffff] font-normal tracking-wide">
                        Magic Spellbook
                    </h1>
                    <p className="text-gray-400 mt-2">
                        Track rune consumption, cast counts, and magic experience yields for discovered spells.
                    </p>
                </div>

                {isLoading ? (
                    <div className="text-center p-12 text-gray-500 italic border border-[#3a3a3a] bg-[#1e1e1e]">
                        Scanning grimoires...
                    </div>
                ) : castSpells.size === 0 ? (
                    <div className="text-center p-12 text-gray-500 italic border border-[#3a3a3a] bg-[#1e1e1e]">
                        No spells cast yet. Go cast some magic!
                    </div>
                ) : (
                    <>
                        <SpellGrid title="Combat Spells" spells={activeCombat} colorClass="text-[#ff6666]" />
                        <SpellGrid title="Teleportation" spells={activeTeleports} colorClass="text-[#b080ff]" />
                        <SpellGrid title="Utility & Skilling" spells={activeUtility} colorClass="text-[#90ff90]" />
                        <SpellGrid title="Other Discovered Magic" spells={otherSpells} colorClass="text-[#c8c8c8]" />
                    </>
                )}
            </div>
        </WikiLayout>
    );
}