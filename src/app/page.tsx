"use client";


import React, {useState, useEffect} from 'react';

import {useRouter} from 'next/navigation';

import Link from 'next/link';

import {createClient} from '@supabase/supabase-js';


// Initialize Supabase for the recent feed

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);


export default function HomePage() {

    const router = useRouter();

    const [searchInput, setSearchInput] = useState("");

    const [recentSources, setRecentSources] = useState<string[]>([]);

    const [isLoading, setIsLoading] = useState(true);


    // 1. Fetch "Recently Tracked" data

    useEffect(() => {

        async function fetchRecent() {

            // Grab the last 100 logs

            const {data, error} = await supabase

                .from('loot_logs')

                .select('log_data')

                .order('created_at', {ascending: false})

                .limit(100);


            if (error) {

                console.error("Database Error:", error);

            } else if (data) {

                // Filter out duplicates so we only see unique monster/activity names

                const uniqueSources = new Set<string>();

                data.forEach(row => {

                    const source = row.log_data?.source;

                    // Filter out "Pickup" or any null/empty sources

                    if (source && source !== "Pickup" && source !== "Unknown/Pickup") {

                        uniqueSources.add(source);

                    }

                });


                // Grab the 8 most recent distinct ones

                setRecentSources(Array.from(uniqueSources).slice(0, 8));

            }

            setIsLoading(false);

        }


        fetchRecent();

    }, []);


    // 2. Handle the Search Bar

    const handleSearch = (e: React.FormEvent) => {

        e.preventDefault(); // Stop the page from reloading

        if (!searchInput.trim()) return;


        // Mimic the exact formatting the Wiki uses (spaces to underscores)

        const targetUrl = searchInput.trim().replace(/ /g, '_');

        router.push(`/${targetUrl}`);

    };


    return (

        <div className="min-h-screen bg-[#121212] text-[#c8c8c8] flex flex-col items-center p-8 font-sans">


            {/* HERO SECTION */}

            <div className="mt-20 text-center mb-12">

                <h1 className="text-5xl font-serif text-[#ffffff] mb-4 tracking-wide">

                    OSRS Live Analytics

                </h1>

                <p className="text-[#a0a0a0] text-lg max-w-xl mx-auto">

                    Your personal, real-time Old School RuneScape database. Search for a monster, boss, or gathering

                    activity to view dynamic drop rates.

                </p>

            </div>


            {/* SEARCH BAR */}

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


            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mb-16">

                <Link href="/monsters"

                      className="h-32 bg-[#1e1e1e] border border-[#3a3a3a] flex items-center justify-center text-2xl font-serif hover:border-[#cca052] transition-all group">

                    <span className="group-hover:text-[#cca052]">Monsters</span>

                </Link>

                <Link href="/skilling"

                      className="h-32 bg-[#1e1e1e] border border-[#3a3a3a] flex items-center justify-center text-2xl font-serif hover:border-[#cca052] transition-all group">

                    <span className="group-hover:text-[#cca052]">Skilling</span>

                </Link>

                <Link href="/items"

                      className="h-32 bg-[#1e1e1e] border border-[#3a3a3a] flex items-center justify-center text-2xl font-serif hover:border-[#cca052] transition-all group">

                    <span className="group-hover:text-[#cca052]">Items</span>

                </Link>

            </div>


            {/* RECENTLY TRACKED GRID */}

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

                            // Convert "Greater demon" to "Greater_demon" for the URL

                            const linkUrl = `/${source.replace(/ /g, '_')}`;

                            // Capitalize for display

                            const displayTitle = source.charAt(0).toUpperCase() + source.slice(1);


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

    );

}