"use client";

import React, {useState, useEffect} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {createClient} from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface DatabaseRow {
    log_data: {
        source?: string;
        category?: string;
    };
}

export default function HomePage() {
    const router = useRouter();
    const [searchInput, setSearchInput] = useState("");
    const [recentSources, setRecentSources] = useState<{ name: string, category: string }[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchRecent() {
            const {data, error} = await supabase
                .from('loot_logs')
                .select('log_data')
                .not('log_data->>source', 'in', '("Pickup","Unknown/Pickup","None","Bank")')
                .order('id', {ascending: false})
                .limit(100);

            if (error) {
                console.error("Database Error:", error);
            } else if (data) {
                const uniqueSources = new Map<string, string>();
                data.forEach((row: DatabaseRow) => {
                    const log = row.log_data as any;
                    const category = log?.category || 'Combat';

                    // If it's a skilling log, the 'name' we show is the Skill (Mining)
                    // but the link needs to go to /skilling/Mining
                    const targetName = (category === 'Skilling' && log.skill) ? log.skill : log.source;

                    if (targetName && !["Pickup", "Unknown/Pickup", "None", "Bank"].includes(targetName)) {
                        if (!uniqueSources.has(targetName)) {
                            uniqueSources.set(targetName, category);
                        }
                    }
                });

                const formattedSources = Array.from(uniqueSources.entries())
                    .map(([name, category]) => ({name, category}))
                    .slice(0, 8);

                setRecentSources(formattedSources);
            }
            setIsLoading(false);
        }

        fetchRecent();
    }, []);

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

            if (category === 'Skilling') {
                router.push(`/skilling/${urlSlug}`);
            } else {
                router.push(`/monsters/${urlSlug}`);
            }
        } else {
            router.push(`/items/${urlSlug}`);
        }

        setSearchInput("");
    };

    return (
        <>
            <title>OSRS Live - Home</title>

            <div className="min-h-screen bg-[#121212] text-[#c8c8c8] flex flex-col items-center p-8 font-sans">
                <div className="mt-20 text-center mb-12">
                    <h1 className="text-5xl font-serif text-[#ffffff] mb-4 tracking-wide">
                        OSRS Live Analytics
                    </h1>
                    <p className="text-[#a0a0a0] text-lg max-w-xl mx-auto">
                        Your personal, real-time Old School RuneScape database. Search for a monster, boss, or gathering
                        activity to view dynamic drop rates.
                    </p>
                </div>

                <form onSubmit={handleSearch} className="w-full max-w-2xl mb-16 flex gap-2">
                    <input
                        type="text"
                        placeholder="e.g. Greater demon, Woodcutting, Goblin..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="flex-1 bg-[#1e1e1e] border border-[#3a3a3a] text-white px-6 py-4 rounded text-lg focus:outline-none focus:border-[#cca052] transition-colors"
                    />
                    <button
                        type="submit"
                        className="bg-[#2a2a2a] border border-[#3a3a3a] hover:bg-[#cca052] hover:text-black hover:border-[#cca052] text-[#c8c8c8] font-bold px-8 py-4 rounded transition-all"
                    >
                        Search
                    </button>
                </form>

                <div className="w-full max-w-4xl mb-16">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
                        {/* TOP ROW */}
                        <Link href="/monsters"
                              className="md:col-span-2 h-32 bg-[#1e1e1e] border border-[#3a3a3a] flex items-center justify-center text-2xl font-serif hover:border-[#cca052] transition-all group">
                            <span className="group-hover:text-[#cca052]">Monsters</span>
                        </Link>
                        <Link href="/skilling"
                              className="md:col-span-2 h-32 bg-[#1e1e1e] border border-[#3a3a3a] flex items-center justify-center text-2xl font-serif hover:border-[#cca052] transition-all group">
                            <span className="group-hover:text-[#cca052]">Skilling</span>
                        </Link>
                        <Link href="/items"
                              className="md:col-span-2 h-32 bg-[#1e1e1e] border border-[#3a3a3a] flex items-center justify-center text-2xl font-serif hover:border-[#cca052] transition-all group">
                            <span className="group-hover:text-[#cca052]">Items Log</span>
                        </Link>

                        {/* BOTTOM ROW */}
                        <Link href="/bank"
                              className="md:col-start-2 md:col-span-2 h-32 bg-[#1e1e1e] border border-[#3a3a3a] flex items-center justify-center text-2xl font-serif hover:border-[#cca052] transition-all group">
                            <span className="group-hover:text-[#cca052]">Live Bank</span>
                        </Link>
                        <Link href="/combat"
                              className="md:col-span-2 h-32 bg-[#1e1e1e] border border-[#3a3a3a] flex items-center justify-center text-2xl font-serif hover:border-[#cca052] transition-all group">
                            <span className="group-hover:text-[#cca052]">Combat & XP</span>
                        </Link>
                    </div>
                </div>

                <div className="w-full max-w-4xl">
                    <div className="border-b border-[#3a3a3a] pb-2 mb-6">
                        <h2 className="text-2xl font-serif text-[#ffffff]">Recently Tracked</h2>
                    </div>
                    {isLoading ? (
                        <p className="text-center text-gray-500 italic py-8">Scanning database for recent activity...</p>
                    ) : recentSources.length === 0 ? (
                        <p className="text-center text-gray-500 italic py-8">No data found. Go play some RuneScape!</p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            {recentSources.map((source, idx) => {
                                const linkPath = source.category === "Skilling" ? "/skilling/" : "/monsters/";
                                const linkUrl = `${linkPath}${source.name.replace(/ /g, '_')}`;
                                const displayTitle = source.name.charAt(0).toUpperCase() + source.name.slice(1);

                                return (
                                    <Link
                                        key={idx}
                                        href={linkUrl}
                                        className="block bg-[#1e1e1e] border border-[#3a3a3a] p-4 rounded hover:bg-[#2a2a2a] hover:border-[#cca052] transition-all group"
                                    >
                                        <div className="text-[#729fcf] font-bold text-lg group-hover:text-[#cca052]">
                                            {displayTitle}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-2 flex justify-between">
                                            <span>View Analytics</span>
                                            <span>→</span>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}