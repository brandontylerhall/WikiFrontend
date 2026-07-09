"use client";

import React, {useState, useEffect} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {createClient} from '@supabase/supabase-js';
import {useCharacter} from '@/lib/CharacterContext';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function HomePage() {
    const router = useRouter();
    const { activeCharacter, isLoading: charLoading } = useCharacter();
    const [searchInput, setSearchInput] = useState("");
    const [recentSources, setRecentSources] = useState<{ name: string, category: string }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [authChecked, setAuthChecked] = useState(false);

    useEffect(() => {
        async function checkAuth() {
            const {data: {user}} = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
                return;
            }
            setUserEmail(user.email ?? null);
            setAuthChecked(true);
        }
        checkAuth();

        const {data: listener} = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session?.user) {
                router.push('/login');
                return;
            }
            setUserEmail(session.user.email ?? null);
        });

        return () => listener.subscription.unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        setRecentSources([]);
        if (charLoading) return;
        if (!activeCharacter) {
            setIsLoading(false);
            return;
        }

        async function fetchRecent() {
            setIsLoading(true);
            const {data, error} = await supabase.rpc('get_recent_sources', {
                p_character_id: activeCharacter!.id,
            });

            if (error) {
                console.error("Database Error:", error);
            } else if (data) {
                setRecentSources((data as { name: string, category: string }[])
                    .map(row => ({name: row.name, category: row.category || 'Combat'})));
            }
            setIsLoading(false);
        }

        fetchRecent();
    }, [activeCharacter, charLoading]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = searchInput.trim();
        if (!trimmed) return;

        const urlSlug = trimmed.toLowerCase().replace(/ /g, '_');

        const {data} = activeCharacter
            ? await supabase.rpc('search_sources', {
                p_character_id: activeCharacter.id,
                p_query: trimmed,
            })
            : {data: null};

        if (data && data.length > 0) {
            const category = data[0].category;

            if (category === 'Skilling' || category === 'Experience') {
                router.push(`/xp/${urlSlug}`);
            } else if (category === 'Shopping') {
                router.push(`/shops/${urlSlug}`);
            } else if (category === 'Quests') {
                router.push(`/quests/${urlSlug}`);
            } else {
                router.push(`/monsters/${urlSlug}`);
            }
        } else {
            router.push(`/items/${urlSlug}`);
        }

        setSearchInput("");
    };

    if (!authChecked) {
        return (
            <div className="min-h-screen bg-[#121212] flex items-center justify-center">
                <p className="text-gray-500 italic font-sans">Loading...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#121212] text-[#c8c8c8] flex flex-col items-center p-8 font-sans w-full">
            <div className="w-full max-w-4xl flex justify-end mb-4">
                <Link
                    href="/account"
                    className="text-sm px-4 py-2 bg-[#1e1e1e] border border-[#3a3a3a] hover:border-[#cca052] hover:text-[#cca052] rounded transition-colors"
                >
                    {userEmail}
                </Link>
            </div>

            <div className="mt-10 text-center mb-12">
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
                    placeholder="e.g. Greater demon, Woodcutting, General store..."
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
                    {/* ROW 1: The Core Loop (Most Important) */}
                    <Link href="/monsters"
                          className="md:col-span-2 h-32 bg-[#1e1e1e] border border-[#3a3a3a] flex items-center justify-center text-2xl font-serif hover:border-[#cca052] transition-all group">
                        <span className="group-hover:text-[#cca052]">Bestiary</span>
                    </Link>
                    <Link href="/xp"
                          className="md:col-span-2 h-32 bg-[#1e1e1e] border border-[#3a3a3a] flex items-center justify-center text-2xl font-serif hover:border-[#cca052] transition-all group">
                        <span className="group-hover:text-[#cca052]">Skill Progress</span>
                    </Link>
                    <Link href="/items"
                          className="md:col-span-2 h-32 bg-[#1e1e1e] border border-[#3a3a3a] flex items-center justify-center text-2xl font-serif hover:border-[#cca052] transition-all group">
                        <span className="group-hover:text-[#cca052]">Item Log</span>
                    </Link>

                    {/* ROW 2: Utility & Resource Drain (Wider tiles) */}
                    <Link href="/combat"
                          className="md:col-span-3 h-32 bg-[#1e1e1e] border border-[#3a3a3a] flex items-center justify-center text-2xl font-serif hover:border-[#cca052] transition-all group">
                        <span className="group-hover:text-[#cca052]">Combat Costs</span>
                    </Link>
                    <Link href="/xp/Magic"
                          className="md:col-span-3 h-32 bg-[#1e1e1e] border border-[#3a3a3a] flex items-center justify-center text-2xl font-serif hover:border-[#cca052] transition-all group">
                        <span className="group-hover:text-[#cca052]">Magic Spells</span>
                    </Link>

                    {/* ROW 3: Economy & Meta Tracking */}
                    <Link href="/quests"
                          className="md:col-span-2 h-32 bg-[#1e1e1e] border border-[#3a3a3a] flex items-center justify-center text-2xl font-serif hover:border-[#cca052] transition-all group">
                        <span className="group-hover:text-[#cca052]">Quest Journal</span>
                    </Link>
                    <Link href="/shops"
                          className="md:col-span-2 h-32 bg-[#1e1e1e] border border-[#3a3a3a] flex items-center justify-center text-2xl font-serif hover:border-[#cca052] transition-all group">
                        <span className="group-hover:text-[#cca052]">Merchants & Shops</span>
                    </Link>
                    <Link href="/bank"
                          className="md:col-span-2 h-32 bg-[#1e1e1e] border border-[#3a3a3a] flex items-center justify-center text-2xl font-serif hover:border-[#cca052] transition-all group">
                        <span className="group-hover:text-[#cca052]">Live Bank</span>
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
                            let linkPath = "/monsters/";
                            if (source.category === "Skilling" || source.category === "Experience") linkPath = "/xp/";
                            if (source.category === "Shopping") linkPath = "/shops/";
                            if (source.category === "Quests") linkPath = "/quests/";

                            const linkUrl = `${linkPath}${source.name.replace(/ /g, '_')}`;
                            const displayTitle = source.name.charAt(0).toUpperCase() + source.name.slice(1);

                            return (
                                <Link key={idx} href={linkUrl}
                                      className="block bg-[#1e1e1e] border border-[#3a3a3a] p-4 rounded hover:bg-[#2a2a2a] hover:border-[#cca052] transition-all group">
                                    <div
                                        className="text-[#729fcf] font-bold text-lg group-hover:text-[#cca052] truncate">{displayTitle}</div>
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
    );
}