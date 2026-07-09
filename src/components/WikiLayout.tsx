"use client";
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { useCharacter } from '@/lib/CharacterContext';
import { usePeriod, PERIOD_LABELS, Period } from '@/lib/PeriodContext';

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

// Inner layout — has access to CharacterContext
function WikiLayoutInner({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { characters, activeCharacter, setActiveCharacter, isLoading: charLoading } = useCharacter();
    const { period, setPeriod } = usePeriod();
    const [searchInput, setSearchInput] = useState("");
    const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isCharacterMenuOpen, setIsCharacterMenuOpen] = useState(false);
    const [isPeriodMenuOpen, setIsPeriodMenuOpen] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const characterMenuRef = useRef<HTMLDivElement>(null);
    const periodMenuRef = useRef<HTMLDivElement>(null);

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
            if (characterMenuRef.current && !characterMenuRef.current.contains(event.target as Node)) {
                setIsCharacterMenuOpen(false);
            }
            if (periodMenuRef.current && !periodMenuRef.current.contains(event.target as Node)) {
                setIsPeriodMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const determineRouteAndType = (sourceName: string, category: string, eventType: string) => {
        const slug = sourceName.replace(/ /g, '_');
        const lowName = sourceName.toLowerCase();
        const INVALID_SPELLS = ['goblin', 'none', 'unknown', 'generic magic', 'activity'];
        if (ALL_SKILLS.includes(lowName)) return { route: `/xp/${slug}`, displayType: "Skill" };
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

            // Filter suggestions to active character's data only
            if (!activeCharacter) {
                setSuggestions([]);
                setIsDropdownOpen(false);
                return;
            }

            const { data } = await supabase.rpc('search_sources', {
                p_character_id: activeCharacter.id,
                p_query: trimmed,
            });

            if (data) {
                const uniqueMap = new Map<string, SearchSuggestion>();
                const matchedSkill = ALL_SKILLS.find(s => s.includes(trimmed.toLowerCase()));
                if (matchedSkill) {
                    const properName = matchedSkill.charAt(0).toUpperCase() + matchedSkill.slice(1);
                    uniqueMap.set(properName, { name: properName, category: "Skilling", displayType: "Skill", route: `/xp/${properName}` });
                }
                data.forEach((row: any) => {
                    const source = row.source;
                    const category = row.category || "Items";
                    const eventType = row.event_type || "";
                    if (source && !uniqueMap.has(source)) {
                        const routingData = determineRouteAndType(source, category, eventType);
                        uniqueMap.set(source, { name: source, category, displayType: routingData.displayType, route: routingData.route });
                    }
                });
                setSuggestions(Array.from(uniqueMap.values()).slice(0, 6));
                setIsDropdownOpen(true);
            }
        };
        const debounceTimer = setTimeout(fetchSuggestions, 250);
        return () => clearTimeout(debounceTimer);
    }, [searchInput, activeCharacter]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = searchInput.trim();
        if (!trimmed) return;

        if (ALL_SKILLS.includes(trimmed.toLowerCase())) {
            router.push(`/xp/${trimmed.charAt(0).toUpperCase() + trimmed.slice(1)}`);
            setSearchInput("");
            setIsDropdownOpen(false);
            return;
        }

        const exactMatch = suggestions.find(s => s.name.toLowerCase() === trimmed.toLowerCase());
        if (exactMatch) {
            router.push(exactMatch.route);
            setSearchInput("");
            setIsDropdownOpen(false);
            return;
        }

        const urlSlug = trimmed.toLowerCase().replace(/ /g, '_');
        const { data } = activeCharacter
            ? await supabase.rpc('search_sources', {
                p_character_id: activeCharacter.id,
                p_query: trimmed,
            })
            : { data: null };

        if (data && data.length > 0) {
            const routingData = determineRouteAndType(data[0].source || trimmed, data[0].category || "", data[0].event_type || "");
            router.push(routingData.route);
        } else {
            router.push(`/items/${urlSlug}`);
        }
        setSearchInput("");
        setIsDropdownOpen(false);
    };

    return (
        <div className="min-h-screen bg-[#121212] text-[#c8c8c8] font-sans flex w-full">
            {/* Sidebar */}
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

            {/* Main content area */}
            <div className="flex-1 flex flex-col min-w-0 w-full relative">
                <header className="h-16 bg-[#1e1e1e] border-b border-[#3a3a3a] flex items-center justify-between px-8 sticky top-0 z-30 gap-4">
                    <div className="md:hidden font-serif text-white shrink-0">OSRS Live</div>

                    {/* Search */}
                    <div className="flex-1 max-w-md relative" ref={searchRef}>
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

                    {/* Period switcher */}
                    <div className="relative shrink-0" ref={periodMenuRef}>
                        <button
                            onClick={() => setIsPeriodMenuOpen(!isPeriodMenuOpen)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-[#121212] border border-[#3a3a3a] hover:border-[#cca052] text-sm transition-colors"
                        >
                            <span className="text-[#cca052] font-bold">
                                {PERIOD_LABELS[period]}
                            </span>
                            <span className="text-gray-500 text-xs">{isPeriodMenuOpen ? '▲' : '▼'}</span>
                        </button>

                        {isPeriodMenuOpen && (
                            <div className="absolute top-full right-0 mt-1 bg-[#1e1e1e] border border-[#3a3a3a] shadow-2xl min-w-[160px] z-50">
                                {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => {
                                            setPeriod(p);
                                            setIsPeriodMenuOpen(false);
                                        }}
                                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors border-b border-[#3a3a3a]/30 last:border-0 ${
                                            period === p
                                                ? 'text-[#cca052] bg-[#2a2a2a]'
                                                : 'text-white hover:bg-[#2a2a2a]'
                                        }`}
                                    >
                                        {PERIOD_LABELS[p]}
                                        {period === p && (
                                            <span className="text-xs text-[#cca052] ml-2">✓</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Character switcher */}
                    {!charLoading && characters.length > 0 && (
                        <div className="relative shrink-0" ref={characterMenuRef}>
                            <button
                                onClick={() => setIsCharacterMenuOpen(!isCharacterMenuOpen)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-[#121212] border border-[#3a3a3a] hover:border-[#cca052] text-sm transition-colors"
                            >
                                <span className="text-[#cca052] font-bold">
                                    {activeCharacter?.label ?? 'Select Character'}
                                </span>
                                <span className="text-gray-500 text-xs">{isCharacterMenuOpen ? '▲' : '▼'}</span>
                            </button>

                            {isCharacterMenuOpen && (
                                <div className="absolute top-full right-0 mt-1 bg-[#1e1e1e] border border-[#3a3a3a] shadow-2xl min-w-[160px] z-50">
                                    {characters.map((char) => (
                                        <button
                                            key={char.id}
                                            onClick={() => {
                                                setActiveCharacter(char);
                                                setIsCharacterMenuOpen(false);
                                            }}
                                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors border-b border-[#3a3a3a]/30 last:border-0 ${
                                                activeCharacter?.id === char.id
                                                    ? 'text-[#cca052] bg-[#2a2a2a]'
                                                    : 'text-white hover:bg-[#2a2a2a]'
                                            }`}
                                        >
                                            {char.label}
                                            {activeCharacter?.id === char.id && (
                                                <span className="text-xs text-[#cca052] ml-2">✓</span>
                                            )}
                                        </button>
                                    ))}
                                    <Link
                                        href="/account"
                                        className="block w-full text-left px-4 py-2.5 text-xs text-gray-500 hover:text-gray-300 hover:bg-[#2a2a2a] transition-colors border-t border-[#3a3a3a]"
                                        onClick={() => setIsCharacterMenuOpen(false)}
                                    >
                                        Manage characters →
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}
                </header>

                <main className="flex-1 overflow-x-hidden w-full relative z-10">
                    {children}
                </main>
            </div>
        </div>
    );
}

// Contexts are provided once in the root layout (src/app/layout.tsx) so that
// page components — which render WikiLayout as a child — also see them.
export default function WikiLayout({ children }: { children: React.ReactNode }) {
    return <WikiLayoutInner>{children}</WikiLayoutInner>;
}