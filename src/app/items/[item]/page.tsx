"use client";

import React, {useEffect, useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import regionData from '@/data/regions.json';
import WikiLayout from "@/components/WikiLayout";
import { useCharacter } from '@/lib/CharacterContext';

const regionDictionary: Record<string, string> = regionData;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface ItemSourceStat {
    sourceName: string;
    skillName?: string;
    category: string;
    quantityDropped: number;
    timesDropped: number;
    regions: Set<string>;
}

interface ItemDetailResult {
    item_id: number | null;
    ge_unit: number;
    ha_unit: number;
    total_qty: number;
    sources: {
        source_name: string;
        category: string;
        skill_name: string | null;
        qty: number;
        times_dropped: number;
        region_ids: number[] | null;
    }[];
}

export default function IndividualItemPage() {
    const params = useParams();
    const { activeCharacter, isLoading: charLoading } = useCharacter();
    const safeItemParam = typeof params?.item === 'string' ? params.item : "Unknown";
    const rawTarget = decodeURIComponent(safeItemParam);
    const itemNameTarget = rawTarget.replace(/_/g, ' ');
    const displayTitle = itemNameTarget.charAt(0).toUpperCase() + itemNameTarget.slice(1);

    const [isIronman, setIsIronman] = useState(false);
    const [sourceStats, setSourceStats] = useState<ItemSourceStat[]>([]);
    const [totalQuantity, setTotalQuantity] = useState(0);
    const [singleGePrice, setSingleGePrice] = useState(0);
    const [singleHaPrice, setSingleHaPrice] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [itemId, setItemId] = useState<number | null>(null);

    useEffect(() => {
        setSourceStats([]);
        setTotalQuantity(0);
        setSingleGePrice(0);
        setSingleHaPrice(0);
        setItemId(null);

        if (charLoading || !activeCharacter) {
            if (!charLoading) setIsLoading(false);
            return;
        }

        async function fetchItemData() {
            setIsLoading(true);

            const {data, error} = await supabase.rpc('get_item_detail', {
                p_character_id: activeCharacter!.id,
                p_item_name: itemNameTarget,
            });

            if (error) console.error("Database Error:", error);

            const detail = data as ItemDetailResult | null;
            if (detail) {
                setItemId(detail.item_id);
                setSingleGePrice(Number(detail.ge_unit) || 0);
                setSingleHaPrice(Number(detail.ha_unit) || 0);
                setTotalQuantity(Number(detail.total_qty) || 0);
                setSourceStats((detail.sources || []).map(s => ({
                    sourceName: s.source_name,
                    skillName: s.skill_name ?? undefined,
                    category: s.category,
                    quantityDropped: Number(s.qty),
                    timesDropped: Number(s.times_dropped),
                    regions: new Set((s.region_ids ?? []).map(String)),
                })));
            }
            setIsLoading(false);
        }

        fetchItemData();
    }, [itemNameTarget, activeCharacter, charLoading]);

    const totalValue = totalQuantity * (isIronman ? singleHaPrice : singleGePrice);

    const combatSources = sourceStats.filter(stat => stat.category === 'Combat');
    const skillingSources = sourceStats.filter(stat => stat.category === 'Skilling');
    const shopSources = sourceStats.filter(stat => stat.category === 'Shopping');
    const npcSources = sourceStats.filter(stat => ['NPC Interaction', 'Events & Rewards', 'Miscellaneous'].includes(stat.category));

    const questSources = sourceStats.filter(stat => {
        if (displayTitle === "Quest point" && stat.sourceName === "Quest Reward") return false;
        return stat.category === 'Quests';
    });

    const SourceTable = ({sources, emptyMessage, isQuestTable = false}: { sources: ItemSourceStat[], emptyMessage: string, isQuestTable?: boolean }) => {
        if (isLoading) return <div className="p-4 border border-[#3a3a3a] text-center italic text-gray-500 bg-[#1e1e1e]">Scanning logs...</div>;
        if (sources.length === 0) return <div className="p-4 border border-[#3a3a3a] text-center italic text-gray-500 bg-[#1e1e1e]">{emptyMessage}</div>;

        return (
            <div className="overflow-x-auto mb-8">
                <table className="w-full table-fixed border-collapse border border-[#3a3a3a] text-sm bg-[#1e1e1e]">
                    <thead>
                    <tr className="bg-[#2a2a2a] text-white">
                        <th className={`${isQuestTable ? 'w-2/3' : 'w-1/3'} border border-[#3a3a3a] px-3 py-2 text-left font-bold`}>
                            {isQuestTable ? "Completed Quest" : "Acquired From"}
                        </th>
                        {!isQuestTable && <th className="w-1/3 border border-[#3a3a3a] px-3 py-2 text-left font-bold">Location</th>}
                        <th className={`${isQuestTable ? 'w-1/3 text-right' : 'w-1/6 text-center'} border border-[#3a3a3a] px-3 py-2 font-bold text-[#cca052]`}>Total Received</th>
                        {!isQuestTable && <th className="w-1/6 border border-[#3a3a3a] px-3 py-2 text-right font-bold">Actions Logged</th>}
                    </tr>
                    </thead>
                    <tbody>
                    {sources.map((stat, idx) => {
                        let linkTarget = `/monsters/${stat.sourceName.replace(/ /g, '_')}`;

                        if (stat.category === "Skilling") {
                            linkTarget = `/xp/${stat.skillName ? stat.skillName.replace(/ /g, '_') : stat.sourceName.replace(/ /g, '_')}`; // Updated to /xp/!
                        } else if (stat.category === "Shopping") {
                            linkTarget = `/shops/${stat.sourceName.replace(/ /g, '_')}`;
                        } else if (stat.category === "Quests") {
                            linkTarget = `/quests/${stat.sourceName.replace(/ /g, '_')}`;
                        }

                        const locationNames = Array.from(stat.regions).map(rId => regionDictionary[rId] || `Region ${rId}`).join(', ');

                        return (
                            <tr key={idx} className={idx % 2 === 0 ? "bg-[#1e1e1e]" : "bg-[#222222] hover:bg-[#333333] transition-colors"}>
                                <td className="border border-[#3a3a3a] px-3 py-2 truncate">
                                    {stat.sourceName === "Quest Reward" ? (
                                        <span className="text-gray-400">{stat.sourceName}</span>
                                    ) : (
                                        <Link href={linkTarget} className="text-[#729fcf] hover:underline">
                                            {stat.sourceName}
                                        </Link>
                                    )}
                                </td>
                                {!isQuestTable && (
                                    <td className="border border-[#3a3a3a] px-3 py-2 text-gray-400 text-xs truncate" title={locationNames}>
                                        {locationNames || "Various/Unknown"}
                                    </td>
                                )}
                                <td className={`border border-[#3a3a3a] px-3 py-2 font-bold text-[#cca052] ${isQuestTable ? 'text-right' : 'text-center'}`}>
                                    {stat.quantityDropped.toLocaleString()}
                                </td>
                                {!isQuestTable && (
                                    <td className="border border-[#3a3a3a] px-3 py-2 text-right text-gray-400">
                                        {stat.timesDropped.toLocaleString()}
                                    </td>
                                )}
                            </tr>
                        );
                    })}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <WikiLayout>
            <div className="w-full p-6 text-[14px] leading-relaxed">
                <div className="mb-6 text-sm">
                    <Link href="/" className="text-[#729fcf] hover:underline">Home</Link>
                    <span className="mx-2 text-gray-500">{'>'}</span>

                    <Link href={displayTitle === "Quest point" ? "/quests" : "/items"} className="text-[#729fcf] hover:underline">
                        {displayTitle === "Quest point" ? "Quest Journal" : "Item Log"}
                    </Link>

                    <span className="mx-2 text-gray-500">{'>'}</span>
                    <span className="text-gray-300">{displayTitle}</span>
                </div>

                <div className="border-b border-[#3a3a3a] pb-4 mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
                    <div>
                        <h1 className="text-[32px] font-serif text-[#ffffff] font-normal tracking-wide flex items-center gap-3">
                            {displayTitle}
                        </h1>
                        <p className="text-gray-400 mt-2">
                            {displayTitle === "Quest point"
                                ? "Track your account's quest progression and total points earned."
                                : "Lifetime acquisition history and total wealth generated."}
                        </p>
                    </div>

                    <div className="flex gap-6 text-right">
                        <div>
                            <div className="text-sm text-gray-400 mb-1">
                                {displayTitle === "Quest point" ? "Total Points Earned" : "Total Gathered/Dropped"}
                            </div>
                            <div className="text-2xl font-bold text-white">{totalQuantity.toLocaleString()}</div>
                        </div>
                        {displayTitle !== "Quest point" && (
                            <div>
                                <button
                                    onClick={() => setIsIronman(!isIronman)}
                                    className="text-xs px-2 py-1 mb-1 bg-[#2a2a2a] border border-[#3a3a3a] hover:bg-[#3a3a3a] text-[#c8c8c8] transition-colors"
                                >
                                    {isIronman ? 'HA Value' : 'GE Value'}
                                </button>
                                <div className="text-2xl font-bold text-[#cca052]">{Math.floor(totalValue).toLocaleString()} gp</div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-8 items-start">
                    <div className="flex-1 w-full order-2 lg:order-1 overflow-hidden">
                        <h2 className="text-[28px] font-serif text-[#ffffff] border-b border-[#3a3a3a] pb-2 mb-6">
                            {displayTitle === "Quest point" ? "Quest Log" : "Acquisition Sources"}
                        </h2>

                        {displayTitle !== "Quest point" && (
                            <>
                                <h3 className="text-[20px] font-serif text-[#cca052] mb-3 flex items-center gap-2">
                                    Monster Drops
                                </h3>
                                <SourceTable sources={combatSources} emptyMessage="No combat drop records found."/>

                                <h3 className="text-[20px] font-serif text-[#90ff90] mb-3 flex items-center gap-2">
                                    Skilling & Gathering
                                </h3>
                                <SourceTable sources={skillingSources} emptyMessage="No skilling records found."/>
                            </>
                        )}

                        {displayTitle !== "Quest point" && npcSources.length > 0 && (
                            <>
                                <h3 className="text-[20px] font-serif text-[#80c8ff] mb-3 mt-6 flex items-center gap-2">
                                    NPCs & Dialogue
                                </h3>
                                <SourceTable sources={npcSources} emptyMessage="No NPC records found."/>
                            </>
                        )}

                        {(questSources.length > 0 || displayTitle === "Quest point") && (
                            <>
                                <h3 className="text-[20px] font-serif mb-3 mt-6 flex items-center gap-2">
                                    {displayTitle === "Quest point" ? "Quests Completed" : "Quest Rewards"}
                                </h3>
                                <SourceTable
                                    sources={questSources}
                                    emptyMessage={displayTitle === "Quest point" ? "No quests have been logged yet." : "No quest records found."}
                                    isQuestTable={true}
                                />
                            </>
                        )}

                        {displayTitle !== "Quest point" && shopSources.length > 0 && (
                            <>
                                <h3 className="text-[20px] font-serif text-[#ff6666] mb-3 mt-6 flex items-center gap-2">
                                    Shops & Merchants
                                </h3>
                                <SourceTable sources={shopSources} emptyMessage="No shop records found."/>
                            </>
                        )}
                    </div>

                    <div className="w-full lg:w-[320px] order-1 lg:order-2 shrink-0">
                        <table className="w-full border-collapse border border-[#3a3a3a] bg-[#1e1e1e] text-[14px]">
                            <tbody>
                            <tr>
                                <th colSpan={2}
                                    className="bg-[#cca052] text-black text-[16px] p-2 border-b border-[#3a3a3a] text-center font-bold">
                                    {displayTitle}
                                </th>
                            </tr>
                            <tr>
                                <td colSpan={2} className="p-4 text-center border-b border-[#3a3a3a] bg-[#222222]">
                                    <div
                                        className="w-[150px] h-[150px] mx-auto flex items-center justify-center">
                                        {displayTitle === "Quest point" ? (
                                            <img
                                                src="https://oldschool.runescape.wiki/images/Quest_point_icon.png"
                                                alt="Quest Point"
                                                className="w-16 h-16 object-contain drop-shadow-md"
                                                loading="lazy"
                                            />
                                        ) : itemId ? (
                                            <img
                                                src={`https://static.runelite.net/cache/item/icon/${itemId}.png`}
                                                alt={displayTitle}
                                                className="w-16 h-16 object-contain"
                                                style={{imageRendering: 'pixelated'}}
                                                loading="lazy"
                                            />
                                        ) : (
                                            <span className="text-gray-500 italic text-xs">No Icon Found</span>
                                        )}
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <th colSpan={2}
                                    className="bg-[#cca052] text-black p-1 text-center border-y border-[#3a3a3a] font-bold">
                                    {displayTitle === "Quest point" ? "Account Progression" : "Item Properties"}
                                </th>
                            </tr>
                            <tr className="bg-[#1e1e1e]">
                                <th className="p-3 border border-[#3a3a3a] text-left w-1/2 font-normal text-[#c8c8c8]">
                                    {displayTitle === "Quest point" ? "Total Points Earned" : "Total Gathered"}
                                </th>
                                <td className="p-3 border border-[#3a3a3a] text-right text-[#ffffff] font-bold">
                                    {totalQuantity.toLocaleString()}
                                </td>
                            </tr>
                            {displayTitle !== "Quest point" && (
                                <>
                                    <tr className="bg-[#222222]">
                                        <th className="p-3 border border-[#3a3a3a] text-left font-normal text-[#c8c8c8]">Exchange
                                            Price
                                        </th>
                                        <td className="p-3 border border-[#3a3a3a] text-right text-[#ffffff]">
                                            {Math.floor(singleGePrice).toLocaleString()} gp
                                        </td>
                                    </tr>
                                    <tr className="bg-[#1e1e1e]">
                                        <th className="p-3 border border-[#3a3a3a] text-left font-normal text-[#c8c8c8]">High
                                            Alch
                                        </th>
                                        <td className="p-3 border border-[#3a3a3a] text-right text-[#ffffff]">
                                            {Math.floor(singleHaPrice).toLocaleString()} gp
                                        </td>
                                    </tr>
                                    <tr className="bg-[#222222]">
                                        <th className="p-3 border border-[#3a3a3a] text-left font-normal text-[#c8c8c8]">Lifetime
                                            Value
                                        </th>
                                        <td className="p-3 border border-[#3a3a3a] text-right text-[#fbdb71] font-bold">
                                            {Math.floor(totalValue).toLocaleString()} gp
                                        </td>
                                    </tr>
                                </>
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </WikiLayout>
    );
}