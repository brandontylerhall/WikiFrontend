"use client";

import React, {useState, useEffect, useRef} from 'react';
import Link from 'next/link';
import {useRouter, usePathname} from 'next/navigation';
import {createClient} from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const TITLE_MAP: Record<string, string> = {
    'items': "Item Log",
    'monsters': "Bestiary",
    'xp': "Skill Progress",
    'combat': "Combat Costs",
    'bank': "Live Bank",
    'spells': "Magic Spellbook",
    'shops': "Merchants & Shops",
    'quests': "Quest Journal"
};

const ALL_SKILLS = [
    "Attack", "Strength", "Defence", "Ranged", "Prayer", "Magic", "Runecraft", "Hitpoints",
    "Crafting", "Mining", "Smithing", "Fishing", "Cooking", "Firemaking", "Woodcutting",
    "Agility", "Herblore", "Thieving", "Fletching", "Slayer", "Farming", "Construction", "Hunter"
].map(s => s.toLowerCase());

interface SearchSuggestion {
    name: string;
    category: string;
    displayType: string;
    route: string;
}

export default function WikiLayout({children}: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [searchInput, setSearchInput] = useState("");

    const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

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

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // --- THE ROUTING BRAIN ---
    const determineRouteAndType = (sourceName: string, category: string, eventType: string) => {
        const slug = sourceName.replace(/ /g, '_');
        const lowName = sourceName.toLowerCase();
        const INVALID_SPELLS = ['goblin', 'none', 'unknown', 'generic magic', 'activity'];

        if (ALL_SKILLS.includes(lowName)) return { route: `/xp/${slug}`, displayType: "Skill" };

        // If it's a spell cast (and not a Goblin), OR it contains spell keywords, it's a spell.
        if ((eventType === 'SPELL_CAST' && !INVALID_SPELLS.includes(lowName)) || lowName.includes('strike') || lowName.includes('bolt') || lowName.includes('blast') || lowName.includes('teleport') || lowName.includes('alchemy') || lowName.includes('inspect') || lowName.includes('examine')) {
            return { route: `/spells/${slug}`, displayType: "Spell" };
        }

        if (category === 'Combat' || eventType === 'NPC_DROP' || eventType === 'NPC_KILLED' || eventType === 'MONSTER_EXAMINE') {
            return { route: `/monsters/${slug}`, displayType: "Monster" };
        }
        if (category === 'Shopping') return { route: `/shops/${slug}`, displayType: "Shop" };
        if (category === 'Quests' || lowName.includes('quest')) return { route: `/quests/${slug}`, displayType: "Quest" };
        if (category === 'Skilling' || eventType === 'XP_GAIN') return { route: `/xp/${slug}`, displayType: "Skilling" };

        return { route: `/items/${slug}`, displayType: "Item" };
    };

    useEffect(() => {
        const fetchSuggestions = async () => {
            const trimmed = searchInput.trim();
            if (trimmed.length < 2) {
                setSuggestions([]);
                setIsDropdownOpen(false);
                return;
            }

            // Pull eventType so we can accurately classify spells vs monsters
            const {data} = await supabase
                .from('loot_logs')
                .select('log_data->>source, log_data->>category, log_data->>eventType')
                .ilike('log_data->>source', `%${trimmed}%`)
                .neq('log_data->>source', 'None')
                .neq('log_data->>source', 'Unknown')
                .not('log_data->>source', 'ilike', '%->%') // EXCLUDE messy combi-logs
                .limit(50);

            if (data) {
                const uniqueMap = new Map<string, SearchSuggestion>();

                // Skill Interceptor: Force exact skill matches to the top
                const matchedSkill = ALL_SKILLS.find(s => s.includes(trimmed.toLowerCase()));
                if (matchedSkill) {
                    const properName = matchedSkill.charAt(0).toUpperCase() + matchedSkill.slice(1);
                    uniqueMap.set(properName, { name: properName, category: "Skilling", displayType: "Skill", route: `/xp/${properName}` });
                }

                data.forEach((row: any) => {
                    const source = row.source;
                    const category = row.category || "Items";
                    const eventType = row.eventType || "";

                    if (source && !uniqueMap.has(source)) {
                        const routingData = determineRouteAndType(source, category, eventType);
                        uniqueMap.set(source, {
                            name: source,
                            category,
                            displayType: routingData.displayType,
                            route: routingData.route
                        });
                    }
                });

                setSuggestions(Array.from(uniqueMap.values()).slice(0, 6));
                setIsDropdownOpen(true);
            }
        };

        const debounceTimer = setTimeout(fetchSuggestions, 250);
        return () => clearTimeout(debounceTimer);
    }, [searchInput]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = searchInput.trim();
        if (!trimmed) return;

        // Skill Override
        if (ALL_SKILLS.includes(trimmed.toLowerCase())) {
            router.push(`/xp/${trimmed.charAt(0).toUpperCase() + trimmed.slice(1)}`);
            setSearchInput("");
            setIsDropdownOpen(false);
            return;
        }

        // Exact Suggestion Matcher
        const exactMatch = suggestions.find(s => s.name.toLowerCase() === trimmed.toLowerCase());
        if (exactMatch) {
            router.push(exactMatch.route);
            setSearchInput("");
            setIsDropdownOpen(false);
            return;
        }

        // Fallback hard query if they hit enter super fast
        const urlSlug = trimmed.toLowerCase().replace(/ /g, '_');
        const {data} = await supabase
            .from('loot_logs')
            .select('log_data->>source, log_data->>category, log_data->>eventType')
            .ilike('log_data->>source', `%${trimmed}%`)
            .not('log_data->>source', 'ilike', '%->%')
            .limit(1);

        if (data && data.length > 0) {
            const routingData = determineRouteAndType(data[0].source || trimmed, data[0].category || "", data[0].eventType || "");
            router.push(routingData.route);
        } else {
            router.push(`/items/${urlSlug}`);
        }

        setSearchInput("");
        setIsDropdownOpen(false);
    };

    return (
        <div className="min-h-screen bg-[#121212] text-[#c8c8c8] font-sans flex w-full">
            <div className="w-64 bg-[#1e1e1e] border-r border-[#3a3a3a] shrink-0 hidden md:flex flex-col z-20 relative">
                <div className="p-6 border-b border-[#3a3a3a]">
                    <Link href="/" className="text-2xl font-serif text-[#ffffff] hover:text-[#cca052] transition-colors tracking-wide">
                        OSRS Live
                    </Link>
                </div>

                <nav className="flex-1 p-4 flex flex-col gap-1 overflow-y-auto">
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

                    <div className="flex flex-col gap-1 py-4 border-b border-[#3a3a3a]/60">
                        <Link href="/combat" className="flex items-center justify-between p-2.5 rounded hover:bg-[#2a2a2a] hover:text-[#cca052] transition-colors">
                            <span>Combat Costs</span>
                            <img src="https://oldschool.runescape.wiki/images/Super_combat_potion%284%29.png" alt="Combat Costs" className="w-5 h-5 object-contain" />
                        </Link>
                        <Link href="/spells" className="flex items-center justify-between p-2.5 rounded hover:bg-[#2a2a2a] hover:text-[#cca052] transition-colors">
                            <span>Magic Spells</span>
                            <img src="https://oldschool.runescape.wiki/images/Spellbook.png" alt="Magic Spells" className="w-5 h-5 object-contain" />
                        </Link>
                    </div>

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
                </nav>
            </div>

            <div className="flex-1 flex flex-col min-w-0 w-full relative">
                <header className="h-16 bg-[#1e1e1e] border-b border-[#3a3a3a] flex items-center justify-between px-8 sticky top-0 z-30">
                    <div className="md:hidden font-serif text-white">OSRS Live</div>

                    <div className="w-full max-w-md ml-auto relative" ref={searchRef}>
                        <form onSubmit={handleSearch} className="flex gap-2 w-full">
                            <input
                                type="text"
                                placeholder="Search wiki..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onFocus={() => { if (suggestions.length > 0) setIsDropdownOpen(true); }}
                                suppressHydrationWarning
                                className="flex-1 bg-[#121212] border border-[#3a3a3a] text-white px-4 py-1.5 text-sm focus:outline-none focus:border-[#cca052] transition-colors"
                            />
                        </form>

                        {isDropdownOpen && suggestions.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-[#1e1e1e] border border-[#3a3a3a] shadow-2xl overflow-hidden rounded-b">
                                {suggestions.map((suggestion, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => {
                                            router.push(suggestion.route);
                                            setSearchInput("");
                                            setIsDropdownOpen(false);
                                        }}
                                        className="px-4 py-2 hover:bg-[#2a2a2a] cursor-pointer flex justify-between items-center transition-colors border-b border-[#3a3a3a]/30 last:border-0"
                                    >
                                        <span className="text-white font-bold">{suggestion.name}</span>
                                        <span className="text-[10px] uppercase text-[#cca052] tracking-wider">{suggestion.displayType}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </header>

                <main className="flex-1 overflow-x-hidden w-full relative z-10">
                    {children}
                </main>
            </div>
        </div>
    );
}