"use client";

import React, {useEffect, useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import WikiLayout from '@/components/WikiLayout';
import { useCharacter } from '@/lib/CharacterContext';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SPELL_REQUIREMENTS: Record<string, Record<string, number>> = {
    "Wind Strike": { "Mind rune": 1, "Air rune": 1 },
    "Water Strike": { "Mind rune": 1, "Water rune": 1, "Air rune": 1 },
    "Earth Strike": { "Mind rune": 1, "Earth rune": 2, "Air rune": 1 },
    "Fire Strike": { "Mind rune": 1, "Fire rune": 3, "Air rune": 2 },
    "Wind Bolt": { "Chaos rune": 1, "Air rune": 2 },
    "Water Bolt": { "Chaos rune": 1, "Water rune": 2, "Air rune": 2 },
    "Earth Bolt": { "Chaos rune": 1, "Earth rune": 3, "Air rune": 2 },
    "Fire Bolt": { "Chaos rune": 1, "Fire rune": 4, "Air rune": 3 },
    "Wind Blast": { "Death rune": 1, "Air rune": 3 },
    "Water Blast": { "Death rune": 1, "Water rune": 3, "Air rune": 3 },
    "Earth Blast": { "Death rune": 1, "Earth rune": 4, "Air rune": 3 },
    "Fire Blast": { "Death rune": 1, "Fire rune": 5, "Air rune": 4 },
    "Lumbridge Teleport": { "Law rune": 1, "Earth rune": 1, "Air rune": 3 },
    "Varrock Teleport": { "Law rune": 1, "Fire rune": 1, "Air rune": 3 },
    "Falador Teleport": { "Law rune": 1, "Water rune": 1, "Air rune": 3 },
    "Camelot Teleport": { "Law rune": 1, "Air rune": 5 },
    "High Level Alchemy": { "Nature rune": 1, "Fire rune": 5 },
    "Low Level Alchemy": { "Nature rune": 1, "Fire rune": 3 },
    "Monster Examine": { "Astral rune": 1, "Cosmic rune": 1, "Mind rune": 1 },
    "Monster Inspect": { "Astral rune": 1, "Cosmic rune": 1, "Mind rune": 1 }
};

interface RunePricing {
    name: string;
    ge: number;
    ha: number;
}

interface SpellDetailResult {
    total_casts: number;
    total_xp: number;
    runes: { name: string; qty: number; ge_unit: number; ha_unit: number }[];
    examined_monsters: { name: string; count: number }[];
}

// ============================================================================
// CUSTOM MODULE: MONSTER EXAMINE / INSPECT
// ============================================================================
function MonsterExamineModule({ monsters, isLoading }: { monsters: Record<string, number>, isLoading: boolean }) {
    return (
        <div className="mt-8 border-t border-[#3a3a3a] pt-8">
            <h2 className="text-[22px] font-serif text-[#ffffff] border-b border-[#3a3a3a] pb-2 mb-4">Inspected Bestiary</h2>
            {isLoading ? (
                <div className="p-8 text-center text-gray-500 italic bg-[#1e1e1e] border border-[#3a3a3a]">Flipping through pages...</div>
            ) : Object.keys(monsters).length === 0 ? (
                <div className="p-8 text-center text-gray-500 italic bg-[#1e1e1e] border border-[#3a3a3a]">No monsters examined yet.</div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {Object.entries(monsters).sort((a,b) => b[1] - a[1]).map(([monsterName, count]) => (
                        <Link key={monsterName} href={`/monsters/${monsterName.replace(/ /g, '_')}`} className="bg-[#1e1e1e] border border-[#3a3a3a] p-4 flex justify-between items-center hover:bg-[#2a2a2a] hover:border-[#cca052] transition-colors group">
                            <span className="font-bold text-[#729fcf] group-hover:text-[#cca052] truncate">{monsterName}</span>
                            <span className="text-xs font-mono text-gray-400 px-2 py-1 bg-black rounded">Casts: {count}</span>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}

// ============================================================================
// CUSTOM MODULE: ALCHEMY
// ============================================================================
function AlchemyModule({ spellName }: { spellName: string }) {
    return (
        <div className="mt-8 border-t border-[#3a3a3a] pt-8">
            <h2 className="text-[22px] font-serif text-[#ffffff] border-b border-[#3a3a3a] pb-2 mb-4">Lifetime Earnings</h2>
            <div className="p-8 text-center text-gray-500 italic bg-[#1e1e1e] border border-[#3a3a3a]">
                Alchemy data pipeline loaded. Awaiting exact JSON log format to calculate item liquidation profits.
            </div>
        </div>
    );
}

// ============================================================================
// MAIN PAGE: UNIFIED SPELL TEMPLATE (Export Default ensures layout renders!)
// ============================================================================
export default function IndividualSpellPage() {
    const params = useParams();
    const { activeCharacter, isLoading: charLoading } = useCharacter();
    const rawSpell = typeof params?.spell === 'string' ? params.spell : '';
    const spellName = rawSpell.replace(/_/g, ' ');

    const [isIronman, setIsIronman] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [totalCasts, setTotalCasts] = useState(0);
    const [totalXp, setTotalXp] = useState(0);
    const [actualRunesUsed, setActualRunesUsed] = useState<Record<string, number>>({});
    const [runePrices, setRunePrices] = useState<Record<string, RunePricing>>({});
    const [examinedMonsters, setExaminedMonsters] = useState<Record<string, number>>({});

    useEffect(() => {
        setTotalCasts(0);
        setTotalXp(0);
        setActualRunesUsed({});
        setRunePrices({});
        setExaminedMonsters({});

        if (charLoading || !activeCharacter) {
            if (!charLoading) setIsLoading(false);
            return;
        }

        async function fetchSpellData() {
            setIsLoading(true);

            const {data, error} = await supabase.rpc('get_spell_detail', {
                p_character_id: activeCharacter!.id,
                p_spell_name: spellName,
            });

            if (error) {
                console.error(error);
                setIsLoading(false);
                return;
            }

            const detail = data as SpellDetailResult | null;
            if (detail) {
                const runes: Record<string, number> = {};
                const prices: Record<string, RunePricing> = {};
                (detail.runes || []).forEach(r => {
                    runes[r.name] = Number(r.qty);
                    prices[r.name] = { name: r.name, ge: Number(r.ge_unit), ha: Number(r.ha_unit) };
                });

                const examines: Record<string, number> = {};
                (detail.examined_monsters || []).forEach(m => {
                    if (m.name) examines[m.name] = Number(m.count);
                });

                setTotalCasts(Number(detail.total_casts) || 0);
                setTotalXp(Number(detail.total_xp) || 0);
                setActualRunesUsed(runes);
                setRunePrices(prices);
                setExaminedMonsters(examines);
            }
            setIsLoading(false);
        }

        if (spellName) fetchSpellData();
    }, [spellName, activeCharacter, charLoading]);

    const avgXpPerCast = totalCasts > 0 ? (totalXp / totalCasts) : 0;

    const calculateSetupCost = (setup: Record<string, number>) => {
        return Object.entries(setup).reduce((total, [rune, qty]) => {
            const price = runePrices[rune] ? (isIronman ? runePrices[rune].ha : runePrices[rune].ge) : 0;
            return total + (price * qty);
        }, 0);
    };

    const baseReqs = SPELL_REQUIREMENTS[spellName] || SPELL_REQUIREMENTS[spellName.replace("Inspect", "Examine")];
    const theoreticalSetups = [];

    if (baseReqs) {
        theoreticalSetups.push({ label: "Base Rune Cost", reqs: { ...baseReqs } });
        ["Air rune", "Water rune", "Earth rune", "Fire rune"].forEach(eleRune => {
            if (baseReqs[eleRune]) {
                const staffSetup = { ...baseReqs };
                delete staffSetup[eleRune];
                const staffName = eleRune.split(' ')[0] + " Staff";
                theoreticalSetups.push({ label: `With ${staffName}`, reqs: staffSetup });
            }
        });
    }

    return (
        <WikiLayout>
            <div className="w-full p-6 text-[14px] leading-relaxed">
                <div className="mb-6 text-sm">
                    <Link href="/" className="text-[#729fcf] hover:underline">Home</Link> ›
                    <Link href="/spells" className="text-[#729fcf] hover:underline">Spellbook</Link> ›
                    <span className="text-gray-300"> {spellName}</span>
                </div>

                <div className="border-b border-[#3a3a3a] pb-6 mb-8 flex justify-between items-end">
                    <div>
                        <h1 className="text-[32px] font-serif text-white tracking-wide">{spellName}</h1>
                        <p className="text-3xl mt-3 font-bold text-[#80c8ff]">
                            {totalCasts.toLocaleString()} Casts Logged
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-gray-400">Total Magic XP</div>
                        <div className="text-4xl font-bold text-[#fbdb71]">
                            {totalXp.toLocaleString()}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-8 items-start">
                    <div className="flex-1 w-full order-2 lg:order-1">
                        <div className="flex justify-between items-end border-b border-[#3a3a3a] pb-2 mb-4">
                            <h2 className="text-[22px] font-serif text-[#ffffff]">Theoretical Cost Analysis</h2>
                            <button onClick={() => setIsIronman(!isIronman)} className="text-xs px-2 py-1 bg-[#2a2a2a] border border-[#3a3a3a] text-[#c8c8c8] hover:bg-[#3a3a3a] transition-colors">
                                {isIronman ? 'Show HA Value' : 'Show GE Value'}
                            </button>
                        </div>

                        <div className="overflow-x-auto mb-10">
                            <table className="w-full border-collapse border border-[#3a3a3a] text-sm bg-[#1e1e1e]">
                                <thead>
                                <tr className="bg-[#2a2a2a] text-white">
                                    <th className="border border-[#3a3a3a] px-3 py-2 text-left font-bold w-1/3">Setup</th>
                                    <th className="border border-[#3a3a3a] px-3 py-2 text-left font-bold">Runes Required</th>
                                    <th className="border border-[#3a3a3a] px-3 py-2 text-center font-bold text-[#80c8ff]">Extrapolated XP / Rune</th>
                                    <th className="border border-[#3a3a3a] px-3 py-2 text-right font-bold text-[#ff6666]">Cost per Cast</th>
                                </tr>
                                </thead>
                                <tbody>
                                {!baseReqs ? (
                                    <tr><td colSpan={4} className="p-4 text-center text-gray-500 italic">No base requirements mapped for this spell yet.</td></tr>
                                ) : (
                                    theoreticalSetups.map((setup, idx) => {
                                        const cost = calculateSetupCost(setup.reqs);
                                        const totalRunesRequired = Object.values(setup.reqs).reduce((a, b) => a + b, 0);
                                        const xpPerRune = totalRunesRequired > 0 ? (avgXpPerCast / totalRunesRequired).toFixed(1) : "0";

                                        return (
                                            <tr key={idx} className={idx % 2 === 0 ? "bg-[#1e1e1e]" : "bg-[#222222]"}>
                                                <td className="border border-[#3a3a3a] px-3 py-2 font-bold text-[#c8c8c8]">{setup.label}</td>
                                                <td className="border border-[#3a3a3a] px-3 py-2 text-gray-400">
                                                    {Object.entries(setup.reqs).map(([rune, qty], rIdx) => (
                                                        <div key={rIdx}>{qty}x {rune}</div>
                                                    ))}
                                                </td>
                                                <td className="border border-[#3a3a3a] px-3 py-2 text-center font-mono text-[#80c8ff]">{avgXpPerCast > 0 ? xpPerRune : "-"}</td>
                                                <td className="border border-[#3a3a3a] px-3 py-2 text-right text-gray-300">-{cost.toLocaleString()} gp</td>
                                            </tr>
                                        );
                                    })
                                )}
                                </tbody>
                            </table>
                        </div>

                        <h2 className="text-[22px] font-serif text-[#ffffff] border-b border-[#3a3a3a] pb-2 mb-4 mt-8">Your Actual Consumption</h2>
                        <div className="overflow-x-auto mb-8">
                            <table className="w-full border-collapse border border-[#3a3a3a] text-sm bg-[#1e1e1e] table-fixed">
                                <thead>
                                <tr className="bg-[#2a2a2a] text-white">
                                    <th className="border border-[#3a3a3a] px-3 py-2 text-left font-bold w-1/2">Rune</th>
                                    <th className="border border-[#3a3a3a] px-3 py-2 text-center font-bold">Qty Consumed</th>
                                    <th className="border border-[#3a3a3a] px-3 py-2 text-right font-bold text-[#ff6666]">Net Cost</th>
                                </tr>
                                </thead>
                                <tbody>
                                {isLoading ? (
                                    <tr><td colSpan={3} className="p-4 text-center text-gray-500 italic">Scanning logs...</td></tr>
                                ) : Object.keys(actualRunesUsed).length === 0 ? (
                                    <tr><td colSpan={3} className="p-4 text-center text-gray-500 italic">No runes consumed.</td></tr>
                                ) : (
                                    Object.entries(actualRunesUsed).sort((a,b) => b[1] - a[1]).map(([rune, qty], idx) => {
                                        const price = runePrices[rune] ? (isIronman ? runePrices[rune].ha : runePrices[rune].ge) : 0;
                                        const totalRuneCost = Math.floor(price * qty);

                                        return (
                                            <tr key={idx} className={idx % 2 === 0 ? "bg-[#1e1e1e]" : "bg-[#222222] hover:bg-[#333333] transition-colors"}>
                                                <td className="border border-[#3a3a3a] px-3 py-2">
                                                    <Link href={`/items/${rune.replace(/ /g, '_')}`} className="text-[#729fcf] hover:underline">{rune}</Link>
                                                </td>
                                                <td className="border border-[#3a3a3a] px-3 py-2 text-center text-white">{qty.toLocaleString()}</td>
                                                <td className="border border-[#3a3a3a] px-3 py-2 text-right text-gray-300">-{totalRuneCost.toLocaleString()} gp</td>
                                            </tr>
                                        );
                                    })
                                )}
                                </tbody>
                            </table>
                        </div>

                        {/* --- CUSTOM MODULE INJECTIONS --- */}
                        {(spellName === "Monster Examine" || spellName === "Monster Inspect") && <MonsterExamineModule monsters={examinedMonsters} isLoading={isLoading} />}
                        {spellName.includes("Alchemy") && <AlchemyModule spellName={spellName} />}

                    </div>

                    <div className="w-full lg:w-[320px] order-1 lg:order-2 shrink-0">
                        <table className="w-full border-collapse border border-[#3a3a3a] bg-[#1e1e1e] text-[13px]">
                            <tbody>
                            <tr>
                                <th colSpan={2}
                                    className="bg-[#cca052] text-black text-[16px] p-2 border-b border-[#3a3a3a] text-center font-bold">
                                    {spellName}
                                </th>
                            </tr>
                            <tr>
                                <td colSpan={2} className="p-4 text-center border-b border-[#3a3a3a] bg-[#222222]">
                                    <div className="w-[150px] h-[150px] mx-auto flex items-center justify-center overflow-hidden">
                                        <img
                                            src={`https://oldschool.runescape.wiki/images/${spellName.replace(/ /g, '_').replace("Inspect", "Examine")}.png`}
                                            alt={spellName}
                                            className="w-16 h-16 object-contain drop-shadow-md"
                                            style={{imageRendering: 'pixelated'}}
                                            loading="lazy"
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                                e.currentTarget.parentElement!.innerHTML = '<span class="text-gray-500 italic text-xs">Image Unavailable</span>';
                                            }}
                                        />
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <th colSpan={2} className="bg-[#cca052] text-black p-1 text-center border-y border-[#3a3a3a] font-bold">
                                    Performance Metrics
                                </th>
                            </tr>
                            <tr className="bg-[#1e1e1e]">
                                <th className="p-2 border border-[#3a3a3a] text-left w-2/5 font-normal text-[#c8c8c8]">Total Casts</th>
                                <td className="p-2 border border-[#3a3a3a] text-right text-[#ffffff]">{totalCasts.toLocaleString()}</td>
                            </tr>
                            <tr className="bg-[#222222]">
                                <th className="p-2 border border-[#3a3a3a] text-left font-normal text-[#c8c8c8]">Avg XP/Cast</th>
                                <td className="p-2 border border-[#3a3a3a] text-right text-[#ffffff]">~{avgXpPerCast.toFixed(1)}</td>
                            </tr>
                            <tr className="bg-[#1e1e1e]">
                                <th className="p-2 border border-[#3a3a3a] text-left font-normal text-[#c8c8c8]">Total Magic XP</th>
                                <td className="p-2 border border-[#3a3a3a] text-right text-[#fbdb71] font-bold">{totalXp.toLocaleString()}</td>
                            </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </WikiLayout>
    );
}