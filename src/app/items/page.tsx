"use client";

import React, {useEffect, useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import Link from 'next/link';
import {categorizeItem, CATEGORY_ORDER} from '@/lib/utils';
import regionData from '@/data/regions.json';
import WikiLayout from "@/components/WikiLayout";
import { useCharacter } from '@/lib/CharacterContext';
import { usePeriod } from '@/lib/PeriodContext';

const regionDictionary: Record<string, string> = regionData;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface ProcessedItem {
    name: string;
    qty: number;
    unitGe: number;
    unitHa: number;
    origins: Set<string>;
}

interface ItemLogRow {
    name: string;
    qty: number;
    ge_unit: number;
    ha_unit: number;
    origins: string[] | null;
}

const mapOrigin = (o: string) =>
    o.startsWith('region:') ? (regionDictionary[o.slice(7)] || `Region ${o.slice(7)}`) : o;

export default function ItemsPage() {
    const { activeCharacter, isLoading: charLoading } = useCharacter();
    const { period } = usePeriod();
    const [categories, setCategories] = useState<Record<string, ProcessedItem[]>>({});
    const [isIronman, setIsIronman] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setCategories({});
        if (charLoading) return;
        if (!activeCharacter) {
            setIsLoading(false);
            return;
        }

        async function fetchItems() {
            setIsLoading(true);
            const {data, error} = await supabase.rpc('get_item_log', {
                p_character_id: activeCharacter!.id,
                p_period: period,
            });

            if (error) console.error("Database Error:", error);

            if (data) {
                const categorized: Record<string, ProcessedItem[]> = {};

                (data as ItemLogRow[]).forEach(row => {
                    const item: ProcessedItem = {
                        name: row.name,
                        qty: Number(row.qty),
                        unitGe: Number(row.ge_unit),
                        unitHa: Number(row.ha_unit),
                        origins: new Set((row.origins ?? []).map(mapOrigin)),
                    };

                    if (item.qty <= 0) return;

                    const catName = categorizeItem(item.name);

                    if (!categorized[catName]) {
                        categorized[catName] = [];
                    }
                    categorized[catName].push(item);
                });

                setCategories(categorized);
            }
            setIsLoading(false);
        }

        fetchItems();
    }, [activeCharacter, charLoading, period]);

    let totalWealth = 0;
    Object.values(categories).flat().forEach(item => {
        const value = isIronman ? (item.unitHa * item.qty) : (item.unitGe * item.qty);
        totalWealth += Math.floor(value);
    });

    const sortedCategoryKeys = Object.keys(categories).sort((a, b) => {
        const indexA = CATEGORY_ORDER.indexOf(a);
        const indexB = CATEGORY_ORDER.indexOf(b);
        if (indexA === -1 && indexB === -1) return a.localeCompare(b);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });

    return (
        <WikiLayout>
            <div className="w-full p-6 text-[14px] leading-relaxed">
                <div className="mb-6 text-sm">
                    <Link href="/" className="text-[#729fcf] hover:underline">Home</Link>
                    <span className="mx-2 text-gray-500">{'>'}</span>
                    <span className="text-gray-300">Item Log</span>
                </div>

                <div className="flex justify-between items-end border-b border-[#3a3a3a] pb-4 mb-8">
                    <h1 className="text-[32px] font-serif text-[#ffffff] font-normal tracking-wide">Lifetime Drops</h1>
                    <div className="text-right">
                        <button
                            onClick={() => setIsIronman(!isIronman)}
                            className="text-xs px-2 py-1 mb-1 bg-[#2a2a2a] border border-[#3a3a3a] hover:bg-[#3a3a3a] text-[#c8c8c8] transition-colors"
                        >
                            {isIronman ? 'Show GE Prices' : 'Show HA Prices'}
                        </button>
                        <p className="text-sm text-gray-400 mt-1">Lifetime Drop Value</p>
                        <p className="text-3xl font-bold text-[#cca052]">{totalWealth.toLocaleString()} gp</p>
                    </div>
                </div>

                {isLoading ? (
                    <div className="text-center text-gray-500 italic mt-12">Calculating bank value...</div>
                ) : (
                    sortedCategoryKeys.map(catName => {
                        const items = categories[catName];
                        if (!items || items.length === 0) return null;

                        const catValue = items.reduce((sum, item) => sum + Math.floor(item.qty * (isIronman ? item.unitHa : item.unitGe)), 0);

                        return (
                            <div key={catName} className="mb-8">
                                <div className="flex justify-between mb-2">
                                    <h2 className="text-xl font-serif text-white">{catName}</h2>
                                    <span className="text-[#cca052] text-sm">{catValue.toLocaleString()} gp</span>
                                </div>
                                <table className="w-full border-collapse border border-[#3a3a3a] text-sm bg-[#1e1e1e] table-fixed">
                                    <thead>
                                    <tr className="bg-[#2a2a2a] text-white">
                                        <th className="w-1/3 border border-[#3a3a3a] px-3 py-2 text-left font-bold">Item</th>
                                        <th className="w-1/3 border border-[#3a3a3a] px-3 py-2 text-left font-bold">Acquired From</th>
                                        <th className="w-1/6 border border-[#3a3a3a] px-3 py-2 text-center font-bold">Qty</th>
                                        <th className="w-1/6 border border-[#3a3a3a] px-3 py-2 text-right font-bold text-[#cca052]">Value</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {items.sort((a, b) => (b.qty * (isIronman ? b.unitHa : b.unitGe)) - (a.qty * (isIronman ? a.unitHa : a.unitGe))).map((item, idx) => {
                                        const itemValue = Math.floor(item.qty * (isIronman ? item.unitHa : item.unitGe));

                                        const originsArr = Array.from(item.origins);
                                        const displayOrigins = originsArr.length > 0
                                            ? originsArr.slice(0, 3).join(', ') + (originsArr.length > 3 ? ', ...' : '')
                                            : 'Various';

                                        return (
                                            <tr key={idx} className="border border-[#3a3a3a] hover:bg-[#2a2a2a] transition-colors">
                                                <td className="border border-[#3a3a3a] px-3 py-2">
                                                    <Link href={`/items/${item.name.replace(/ /g, '_')}`} className="text-[#729fcf] hover:underline">
                                                        {item.name}
                                                    </Link>
                                                </td>
                                                <td className="border border-[#3a3a3a] px-3 py-2 text-gray-400 text-xs truncate" title={originsArr.join(', ')}>
                                                    {displayOrigins}
                                                </td>
                                                <td className="border border-[#3a3a3a] px-3 py-2 text-center text-white">{item.qty.toLocaleString()}</td>
                                                <td className="border border-[#3a3a3a] px-3 py-2 text-right">{itemValue.toLocaleString()}</td>
                                            </tr>
                                        );
                                    })}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })
                )}
            </div>
        </WikiLayout>
    );
}