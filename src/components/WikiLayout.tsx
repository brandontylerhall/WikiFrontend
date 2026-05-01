"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function WikiLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [searchInput, setSearchInput] = useState("");

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = searchInput.trim();
        if (!trimmed) return;

        const urlSlug = trimmed.toLowerCase().replace(/ /g, '_');

        const { data } = await supabase
            .from('loot_logs')
            .select('log_data->>category')
            .ilike('log_data->>source', `%${trimmed}%`)
            .limit(1);

        if (data && data.length > 0) {
            const category = data[0].category;
            if (category === 'Skilling') router.push(`/skilling/${urlSlug}`);
            else router.push(`/monsters/${urlSlug}`);
        } else {
            router.push(`/items/${urlSlug}`);
        }
        setSearchInput("");
    };

    return (
        <div className="min-h-screen bg-[#121212] text-[#c8c8c8] font-sans flex">
            {/* LEFT SIDEBAR (The Wiki Nav) */}
            <div className="w-64 bg-[#1e1e1e] border-r border-[#3a3a3a] shrink-0 hidden md:flex flex-col">
                <div className="p-6 border-b border-[#3a3a3a]">
                    <Link href="/" className="text-2xl font-serif text-[#ffffff] hover:text-[#cca052] transition-colors tracking-wide">
                        OSRS Live
                    </Link>
                </div>
                <nav className="flex-1 p-4 flex flex-col gap-2">
                    <Link href="/monsters" className="block p-3 rounded hover:bg-[#2a2a2a] hover:text-[#cca052] transition-colors">Bestiary</Link>
                    <Link href="/skilling" className="block p-3 rounded hover:bg-[#2a2a2a] hover:text-[#cca052] transition-colors">Skilling</Link>
                    <Link href="/items" className="block p-3 rounded hover:bg-[#2a2a2a] hover:text-[#cca052] transition-colors">Item Log</Link>
                    <Link href="/combat" className="block p-3 rounded hover:bg-[#2a2a2a] hover:text-[#cca052] transition-colors">Combat & XP</Link>
                    <Link href="/bank" className="block p-3 rounded hover:bg-[#2a2a2a] hover:text-[#cca052] transition-colors">Live Bank</Link>
                </nav>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* TOP HEADER (Search Bar) */}
                <header className="h-16 bg-[#1e1e1e] border-b border-[#3a3a3a] flex items-center justify-between px-8 sticky top-0 z-10">
                    {/* Mobile fallback title */}
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

                {/* PAGE CONTENT */}
                <main className="flex-1 overflow-x-hidden">
                    {children}
                </main>
            </div>
        </div>
    );
}