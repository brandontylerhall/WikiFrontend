"use client";

import React, {useEffect, useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import Link from 'next/link';
import {categorizeItem, CATEGORY_ORDER, getBankSubCategory, SUB_CATEGORY_ORDER} from '@/lib/utils';
import WikiLayout from "@/components/WikiLayout";
import { useCharacter } from '@/lib/CharacterContext';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface ProcessedItem {
    name: string;
    qty: number;
    unitGe: number;
    unitHa: number;
}

interface BankRow {
    name: string;
    qty: number;
    ge_unit: number;
    ha_unit: number;
}

export default function BankHub() {
    const { activeCharacter, isLoading: charLoading } = useCharacter();
    const [categories, setCategories] = useState<Record<string, Record<string, ProcessedItem[]>>>({});
    const [isIronman, setIsIronman] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setCategories({});
        if (charLoading) return;
        if (!activeCharacter) {
            setIsLoading(false);
            return;
        }

        async function fetchBankItems() {
            setIsLoading(true);
            const {data, error} = await supabase.rpc('get_bank_snapshot', {
                p_character_id: activeCharacter!.id,
            });

            if (error) console.error("Database Error:", error);

            if (data) {
                const categorized: Record<string, Record<string, ProcessedItem[]>> = {};

                (data as BankRow[]).forEach(row => {
                    const finalQty = Number(row.qty);
                    if (finalQty <= 0) return;

                    const catName = categorizeItem(row.name);
                    const subCatName = getBankSubCategory(row.name, catName);

                    // Ignore Bank Fillers!
                    if (catName === "Hidden" || subCatName === "Hidden") return;

                    if (!categorized[catName]) {
                        categorized[catName] = {};
                    }
                    if (!categorized[catName][subCatName]) {
                        categorized[catName][subCatName] = [];
                    }

                    categorized[catName][subCatName].push({
                        name: row.name,
                        qty: finalQty,
                        unitGe: Number(row.ge_unit),
                        unitHa: Number(row.ha_unit)
                    });
                });

                setCategories(categorized);
            }
            setIsLoading(false);
        }

        fetchBankItems();
    }, [activeCharacter, charLoading]);

    let exactTotalWealth = 0;
    Object.values(categories).forEach(subCats => {
        Object.values(subCats).flat().forEach(item => {
            exactTotalWealth += isIronman ? (item.unitHa * item.qty) : (item.unitGe * item.qty);
        });
    });
    const totalWealth = Math.floor(exactTotalWealth);

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
                    <span className="text-gray-300">Live Bank</span>
                </div>

                <div className="flex justify-between items-end border-b border-[#3a3a3a] pb-4 mb-8">
                    <div>
                        <h1 className="text-[32px] font-serif text-[#ffffff]">Live Bank Viewer</h1>
                        <p className="text-gray-400 mt-2">Syncs with your latest bank snapshot and live actions.</p>
                    </div>
                    <div className="text-right">
                        <button
                            onClick={() => setIsIronman(!isIronman)}
                            className="text-xs px-2 py-1 mb-1 bg-[#2a2a2a] border border-[#3a3a3a] hover:bg-[#3a3a3a] text-[#c8c8c8] transition-colors"
                        >
                            {isIronman ? 'Show GE Prices' : 'Show HA Prices'}
                        </button>
                        <p className="text-sm text-gray-400 mt-1">Total Bank Value</p>
                        <p className="text-3xl font-bold text-[#cca052]">{totalWealth.toLocaleString()} gp</p>
                    </div>
                </div>

                {isLoading ? (
                    <div className="text-center text-gray-500 italic mt-12 border border-[#3a3a3a] bg-[#1e1e1e] p-8">
                        Reading bank snapshot...
                    </div>
                ) : sortedCategoryKeys.length === 0 ? (
                    <div className="text-center text-gray-500 italic mt-12 border border-[#3a3a3a] bg-[#1e1e1e] p-8">
                        No banked items found. Go open your bank in-game to sync!
                    </div>
                ) : (
                    sortedCategoryKeys.map(catName => {
                        const subCategories = categories[catName];
                        if (!subCategories || Object.keys(subCategories).length === 0) return null;

                        const catValue = Object.values(subCategories).flat().reduce((sum, item) => sum + Math.floor(item.qty * (isIronman ? item.unitHa : item.unitGe)), 0);

                        return (
                            <div key={catName} className="mb-10">
                                <div className="flex justify-between items-end border-b border-[#3a3a3a] pb-1 mb-4">
                                    <h2 className="text-[24px] font-serif text-white">{catName}</h2>
                                    <span className="text-[#cca052] font-bold text-lg">{catValue.toLocaleString()} gp</span>
                                </div>

                                {Object.keys(subCategories).sort((a, b) => {
                                    const indexA = SUB_CATEGORY_ORDER.indexOf(a);
                                    const indexB = SUB_CATEGORY_ORDER.indexOf(b);
                                    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
                                    if (indexA === -1) return 1;
                                    if (indexB === -1) return -1;
                                    return indexA - indexB;
                                }).map(subCatName => {
                                    const items = subCategories[subCatName];
                                    const showSubHeader = subCatName !== catName;

                                    return (
                                        <div key={subCatName} className="mb-6">
                                            {showSubHeader && (
                                                <h3 className="text-[18px] font-serif text-[#c8c8c8] mb-2 px-1">
                                                    {subCatName}
                                                </h3>
                                            )}
                                            <table className="w-full border-collapse border border-[#3a3a3a] text-sm bg-[#1e1e1e]">
                                                <thead>
                                                <tr className="bg-[#2a2a2a] text-white">
                                                    <th className="w-1/2 border border-[#3a3a3a] px-3 py-2 text-left font-bold">Item</th>
                                                    <th className="w-1/4 border border-[#3a3a3a] px-3 py-2 text-center font-bold">In Bank</th>
                                                    <th className="w-1/4 border border-[#3a3a3a] px-3 py-2 text-right font-bold text-[#cca052]">Value</th>
                                                </tr>
                                                </thead>
                                                <tbody>
                                                {items.sort((a, b) => a.name.localeCompare(b.name)).map((item, idx) => {
                                                    const itemValue = Math.floor(item.qty * (isIronman ? item.unitHa : item.unitGe));
                                                    return (
                                                        <tr key={idx} className="border border-[#3a3a3a] hover:bg-[#2a2a2a] transition-colors">
                                                            <td className="border border-[#3a3a3a] px-3 py-2">
                                                                <Link href={`/items/${item.name.replace(/ /g, '_')}`} className="text-[#729fcf] hover:underline">
                                                                    {item.name}
                                                                </Link>
                                                            </td>
                                                            <td className="border border-[#3a3a3a] px-3 py-2 text-center text-white font-bold">{item.qty.toLocaleString()}</td>
                                                            <td className="border border-[#3a3a3a] px-3 py-2 text-right">{itemValue.toLocaleString()}</td>
                                                        </tr>
                                                    );
                                                })}
                                                </tbody>
                                            </table>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })
                )}
            </div>
        </WikiLayout>
    );
}