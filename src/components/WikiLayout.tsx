"use client";

import React, {useState, useEffect} from 'react';
import Link from 'next/link';
import {useRouter, usePathname} from 'next/navigation';
import {createClient} from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const TITLE_MAP: Record<string, string> = {
    'items': "Item Log",
    'monsters': "Bestiary",
    'xp': "Skill Progress", // <-- Cleaned up nomenclature
    'combat': "Combat Costs",
    'bank': "Live Bank",
    'magic': "Magic Spells",
    'shops': "Merchants & Shops",
    'quests': "Quest Journal"
};

export default function WikiLayout({children}: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [searchInput, setSearchInput] = useState("");

    useEffect(() => {
        let pageTitle = "Home";
        if (pathname) {
            const segments = pathname.split('/').filter(Boolean);
            if (segments.length > 0) {
                const rawSlug = segments[segments.length - 1];
                const cleanName = decodeURIComponent(rawSlug).replace(/_/g, ' ');
                pageTitle = TITLE_MAP[cleanName.toLowerCase()] || (cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
            }
        }
        document.title = `${pageTitle} - OSRS Live`;
    }, [pathname]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = searchInput.trim();
        if (!trimmed) return;

        const urlSlug = trimmed.toLowerCase().replace(/ /g, '_');
        const {data} = await supabase
            .from('loot_logs')
            .select('log_data->>category')
            .ilike('log_data->>source', `%${trimmed}%`)
            .limit(1);

        if (data && data.length > 0) {
            const category = data[0].category;
            if (category === 'Skilling' || category === 'Experience') router.push(`/xp/${urlSlug}`);
            else if (category === 'Shopping') router.push(`/shops/${urlSlug}`);
            else router.push(`/monsters/${urlSlug}`);
        } else {
            router.push(`/items/${urlSlug}`);
        }
        setSearchInput("");
    };

    return (
        <div className="min-h-screen bg-[#121212] text-[#c8c8c8] font-sans flex w-full">
            {/* LEFT SIDEBAR */}
            <div className="w-64 bg-[#1e1e1e] border-r border-[#3a3a3a] shrink-0 hidden md:flex flex-col">
                <div className="p-6 border-b border-[#3a3a3a]">
                    <Link href="/" className="text-2xl font-serif text-[#ffffff] hover:text-[#cca052] transition-colors tracking-wide">
                        OSRS Live
                    </Link>
                </div>

                <nav className="flex-1 p-4 flex flex-col gap-1 overflow-y-auto">
                    {/* SECTION 1: Core Gameplay Records */}
                    <div className="flex flex-col gap-1 pb-4 border-b border-[#3a3a3a]/60">
                        <Link href="/monsters" className="flex items-center justify-between p-2.5 rounded hover:bg-[#2a2a2a] hover:text-[#cca052] transition-colors">
                            <span>Bestiary</span>
                            <img src="https://oldschool.runescape.wiki/images/Slayer_icon.png" alt="Bestiary" className="w-5 h-5 object-contain" />
                        </Link>
                        <Link href="/xp" className="flex items-center justify-between p-2.5 rounded hover:bg-[#2a2a2a] hover:text-[#cca052] transition-colors">
                            <span>Skill Progress</span>
                            <img src="https://oldschool.runescape.wiki/images/Stats_icon.png" alt="Progress" className="w-5 h-5 object-contain" />
                        </Link>
                        <Link href="/items" className="flex items-center justify-between p-2.5 rounded hover:bg-[#2a2a2a] hover:text-[#cca052] transition-colors">
                            <span>Item Log</span>
                            <img src="https://oldschool.runescape.wiki/images/Inventory.png" alt="Item Log" className="w-5 h-5 object-contain" />
                        </Link>
                    </div>

                    {/* SECTION 2: Resource Burn & Upkeep */}
                    <div className="flex flex-col gap-1 py-4 border-b border-[#3a3a3a]/60">
                        <Link href="/combat" className="flex items-center justify-between p-2.5 rounded hover:bg-[#2a2a2a] hover:text-[#cca052] transition-colors">
                            <span>Combat Costs</span>
                            <img src="https://oldschool.runescape.wiki/images/Super_combat_potion%284%29.png" alt="Combat Costs" className="w-5 h-5 object-contain" />
                        </Link>
                        <Link href="/xp/Magic" className="flex items-center justify-between p-2.5 rounded hover:bg-[#2a2a2a] hover:text-[#cca052] transition-colors">
                            <span>Magic Spells</span>
                            <img src="https://oldschool.runescape.wiki/images/Spellbook.png" alt="Magic Spells" className="w-5 h-5 object-contain" />
                        </Link>
                    </div>

                    {/* SECTION 3: World Meta & Progression */}
                    <div className="flex flex-col gap-1 py-4">
                        <Link href="/quests" className="flex items-center justify-between p-2.5 rounded hover:bg-[#2a2a2a] hover:text-[#b080ff] transition-colors">
                            <span>Quest Journal</span>
                            <img src="https://oldschool.runescape.wiki/images/Quest_point_icon.png" alt="Quests" className="w-4 h-4 object-contain" />
                        </Link>
                        <Link href="/shops" className="flex items-center justify-between p-2.5 rounded hover:bg-[#2a2a2a] hover:text-[#cca052] transition-colors">
                            <span>Merchants & Shops</span>
                            <img src="https://oldschool.runescape.wiki/images/General_store_icon.png" alt="Shops" className="w-5 h-5 object-contain" />
                        </Link>
                        <Link href="/bank" className="flex items-center justify-between p-2.5 rounded hover:bg-[#2a2a2a] hover:text-[#cca052] transition-colors">
                            <span>Live Bank</span>
                            <img src="https://oldschool.runescape.wiki/images/Bank_logo.png" alt="Bank" className="w-5 h-5 object-contain" />
                        </Link>

                    </div>
                    {/* SECTION 4: Storage Infrastructure (Isolated Break) */}

                </nav>
            </div>

            <div className="flex-1 flex flex-col min-w-0 w-full">
                <header className="h-16 bg-[#1e1e1e] border-b border-[#3a3a3a] flex items-center justify-between px-8 sticky top-0 z-10">
                    <div className="md:hidden font-serif text-white">OSRS Live</div>
                    <form onSubmit={handleSearch} className="w-full max-w-md ml-auto flex gap-2">
                        <input
                            type="text"
                            placeholder="Search wiki..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="flex-1 bg-[#121212] border border-[#3a3a3a] text-white px-4 py-1.5 text-sm focus:outline-none focus:border-[#cca052] transition-colors"
                        />
                    </form>
                </header>
                <main className="flex-1 overflow-x-hidden w-full">
                    {children}
                </main>
            </div>
        </div>
    );
}