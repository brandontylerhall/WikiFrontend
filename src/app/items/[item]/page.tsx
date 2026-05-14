"use client";

import React, {useEffect, useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import {LEGACY_ID_MAP} from '@/lib/constants';
import regionData from '@/data/regions.json';
import WikiLayout from "@/components/WikiLayout";
import {DatabaseRow} from '@/lib/types';

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

export default function IndividualItemPage() {
    const params = useParams();
    const safeItemParam = typeof params?.item === 'string' ? params.item : "Unknown";
    const rawTarget = decodeURIComponent(safeItemParam);
    const itemNameTarget = rawTarget.replace(/_/g, ' ');
    const displayTitle = itemNameTarget.charAt(0).toUpperCase() + itemNameTarget.slice(1);

    // ALL useState hooks must live inside the component!
    const [isIronman, setIsIronman] = useState(false);
    const [sourceStats, setSourceStats] = useState<ItemSourceStat[]>([]);
    const [totalQuantity, setTotalQuantity] = useState(0);
    const [singleGePrice, setSingleGePrice] = useState(0);
    const [singleHaPrice, setSingleHaPrice] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    // NEW: Store the item ID for the image fetch
    const [itemId, setItemId] = useState<number | null>(null);

    useEffect(() => {
        async function fetchItemData() {
            setIsLoading(true);

            const {data, error} = await supabase
                .from('loot_logs')
                .select('log_data')
                // Match exact capitalization from displayTitle
                .contains('log_data', {items: [{name: displayTitle}]})
                .order('id', {ascending: false})
                .limit(5000);

            if (error) console.error("Database Error:", error);

            if (data) {
                const statsMap: Record<string, ItemSourceStat> = {};
                let totalQty = 0;
                let ge = 0;
                let ha = 0;

                data.forEach((row: DatabaseRow) => {
                    const log = row.log_data as any;

                    // Safely grab the event type
                    const evt = (log.eventType || log.action || "").toUpperCase();

                    // Immediately kick out ANY inventory/bank management to strictly prevent double-counting
                    if (evt && ['CONSUME', 'DESTROY', 'DROP', 'PICKUP', 'TAKE', 'BANK_DEPOSIT', 'BANK_WITHDRAWAL', 'BANK_SNAPSHOT', 'EQUIP', 'UNEQUIP'].includes(evt)) {
                        return;
                    }

                    if (log.items && log.items.length > 0) {
                        log.items.forEach((item: any) => {
                            const currentName = (item.name || LEGACY_ID_MAP[item.id] || `Unknown`).trim();
                            const targetName = itemNameTarget.trim();

                            if (currentName.toLowerCase() === targetName.toLowerCase()) {

                                // NEW: Capture the ID on the very first match we find
                                setItemId((prevId) => prevId || item.id);

                                const itemGE = item.GE || 0;
                                const itemHA = item.HA || 0;
                                if (ge === 0 && itemGE > 0) ge = itemGE / item.qty;
                                if (ha === 0 && itemHA > 0) ha = itemHA / item.qty;

                                const source = log.source || "Unknown Source";
                                const category = log.category || "Unknown";

                                if (!statsMap[source]) {
                                    statsMap[source] = {
                                        sourceName: source,
                                        skillName: log.skill, // Save the parent skill for linking!
                                        category: category,
                                        quantityDropped: 0,
                                        timesDropped: 0,
                                        regions: new Set()
                                    };
                                }

                                statsMap[source].quantityDropped += item.qty;
                                statsMap[source].timesDropped += 1;

                                if (log.regionId) {
                                    statsMap[source].regions.add(String(log.regionId));
                                }

                                totalQty += item.qty;
                            }
                        });
                    }
                });

                setSourceStats(Object.values(statsMap).sort((a, b) => b.quantityDropped - a.quantityDropped));
                setTotalQuantity(totalQty);
                setSingleGePrice(ge);
                setSingleHaPrice(ha);
            }
            setIsLoading(false);
        }

        fetchItemData();
    }, [itemNameTarget, displayTitle]);

    const totalValue = totalQuantity * (isIronman ? singleHaPrice : singleGePrice);

    const combatSources = sourceStats.filter(stat => stat.category === 'Combat');
    const skillingSources = sourceStats.filter(stat => stat.category === 'Skilling');

    // Standardized 4-Column Table Component
    const SourceTable = ({sources, emptyMessage}: { sources: ItemSourceStat[], emptyMessage: string }) => {
        if (isLoading) return <div className="p-4 border border-[#3a3a3a] text-center italic text-gray-500 bg-[#1e1e1e]">Scanning logs...</div>;
        if (sources.length === 0) return <div className="p-4 border border-[#3a3a3a] text-center italic text-gray-500 bg-[#1e1e1e]">{emptyMessage}</div>;

        return (
            <div className="overflow-x-auto mb-8">
                <table className="w-full table-fixed border-collapse border border-[#3a3a3a] text-sm bg-[#1e1e1e]">
                    <thead>
                    <tr className="bg-[#2a2a2a] text-white">
                        <th className="w-1/3 border border-[#3a3a3a] px-3 py-2 text-left font-bold">Acquired From</th>
                        <th className="w-1/3 border border-[#3a3a3a] px-3 py-2 text-left font-bold">Location</th>
                        <th className="w-1/6 border border-[#3a3a3a] px-3 py-2 text-center font-bold text-[#cca052]">Total Received</th>
                        <th className="w-1/6 border border-[#3a3a3a] px-3 py-2 text-right font-bold">Actions Logged</th>
                    </tr>
                    </thead>
                    <tbody>
                    {sources.map((stat, idx) => {
                        // Link to the Skill Name if it exists, otherwise fallback to the source name
                        const linkTarget = stat.category === "Skilling"
                            ? `/skilling/${stat.skillName ? stat.skillName.replace(/ /g, '_') : stat.sourceName.replace(/ /g, '_')}`
                            : `/monsters/${stat.sourceName.replace(/ /g, '_')}`;

                        const locationNames = Array.from(stat.regions)
                            .map(rId => regionDictionary[rId] || `Region ${rId}`)
                            .join(', ');

                        return (
                            <tr key={idx} className={idx % 2 === 0 ? "bg-[#1e1e1e]" : "bg-[#222222] hover:bg-[#333333] transition-colors"}>
                                <td className="border border-[#3a3a3a] px-3 py-2 truncate">
                                    <Link href={linkTarget} className="text-[#729fcf] hover:underline">
                                        {stat.sourceName}
                                    </Link>
                                </td>
                                <td className="border border-[#3a3a3a] px-3 py-2 text-gray-400 text-xs truncate" title={locationNames}>
                                    {locationNames || "Various/Unknown"}
                                </td>
                                <td className="border border-[#3a3a3a] px-3 py-2 text-center font-bold text-[#cca052]">
                                    {stat.quantityDropped.toLocaleString()}
                                </td>
                                <td className="border border-[#3a3a3a] px-3 py-2 text-right text-gray-400">
                                    {stat.timesDropped.toLocaleString()}
                                </td>
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
                    <Link href="/items" className="text-[#729fcf] hover:underline">Lifetime Drops</Link>
                    <span className="mx-2 text-gray-500">{'>'}</span>
                    <span className="text-gray-300">{displayTitle}</span>
                </div>

                <div className="border-b border-[#3a3a3a] pb-4 mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
                    <div>
                        <h1 className="text-[32px] font-serif text-[#ffffff] font-normal tracking-wide flex items-center gap-3">
                            {displayTitle}
                        </h1>
                        <p className="text-gray-400 mt-2">
                            Lifetime acquisition history and total wealth generated.
                        </p>
                    </div>

                    <div className="flex gap-6 text-right">
                        <div>
                            <div className="text-sm text-gray-400 mb-1">Total Gathered/Dropped</div>
                            <div className="text-2xl font-bold text-white">{totalQuantity.toLocaleString()}</div>
                        </div>
                        <div>
                            <button
                                onClick={() => setIsIronman(!isIronman)}
                                className="text-xs px-2 py-1 mb-1 bg-[#2a2a2a] border border-[#3a3a3a] hover:bg-[#3a3a3a] text-[#c8c8c8] transition-colors"
                            >
                                {isIronman ? 'HA Value' : 'GE Value'}
                            </button>
                            <div className="text-2xl font-bold text-[#cca052]">{Math.floor(totalValue).toLocaleString()} gp</div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-8 items-start">
                    <div className="flex-1 w-full order-2 lg:order-1 overflow-hidden">
                        <h2 className="text-[28px] font-serif text-[#ffffff] border-b border-[#3a3a3a] pb-2 mb-6">
                            Acquisition Sources
                        </h2>

                        <h3 className="text-[20px] font-serif text-[#cca052] mb-3 flex items-center gap-2">
                            Monster Drops
                        </h3>
                        <SourceTable sources={combatSources} emptyMessage="No combat drop records found."/>

                        <h3 className="text-[20px] font-serif text-[#90ff90] mb-3 flex items-center gap-2">
                            Skilling & Gathering
                        </h3>
                        <SourceTable sources={skillingSources} emptyMessage="No skilling records found."/>
                    </div>

                    {/* NEW: Clean Wiki Infobox Sidebar */}
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
                                        className="w-[150px] h-[150px] mx-auto flex items-center justify-center border border-[#3a3a3a] bg-[#1a1a1a]">
                                        {itemId ? (
                                            <img
                                                src={`https://static.runelite.net/cache/item/icon/${itemId}.png`}
                                                alt={displayTitle}
                                                className="w-16 h-16 object-contain"
                                                style={{imageRendering: 'pixelated'}} // Keeps the OSRS pixel-art crisp when scaled up
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
                                    Item Properties
                                </th>
                            </tr>
                            <tr className="bg-[#1e1e1e]">
                                <th className="p-3 border border-[#3a3a3a] text-left w-1/2 font-normal text-[#c8c8c8]">Total
                                    Gathered
                                </th>
                                <td className="p-3 border border-[#3a3a3a] text-right text-[#ffffff] font-bold">
                                    {totalQuantity.toLocaleString()}
                                </td>
                            </tr>
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
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </WikiLayout>
    );
}