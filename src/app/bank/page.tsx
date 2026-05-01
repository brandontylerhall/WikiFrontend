"use client";

import React, {useEffect, useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import Link from 'next/link';
import {LEGACY_ID_MAP} from '@/lib/constants';
import {categorizeItem, CATEGORY_ORDER} from '@/lib/utils';
import WikiLayout from "@/components/WikiLayout";
import {DatabaseRow, LogItem} from '@/lib/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface BankItemTracking {
    name: string;
    snapshotBase: number;
    deposits: number;
    withdrawals: number;
    unitGe: number;
    unitHa: number;
    foundSnapshot: boolean;
}

interface ProcessedItem {
    name: string;
    qty: number;
    unitGe: number;
    unitHa: number;
}

export default function BankHub() {
    const [categories, setCategories] = useState<Record<string, ProcessedItem[]>>({});
    const [isIronman, setIsIronman] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchBankItems() {
            setIsLoading(true);
            const {data} = await supabase
                .from('loot_logs')
                .select('log_data')
                .order('id', {ascending: false})
                .limit(5000); // Reads newest first

            if (data) {
                const itemMap: Record<string, BankItemTracking> = {};

                data.forEach((row: DatabaseRow) => {
                    const log = row.log_data;

                    if (log.items) {
                        log.items.forEach((item: LogItem) => {
                            const name = (item.name || LEGACY_ID_MAP[item.id] || `Unknown (ID: ${item.id})`).trim();

                            if (!itemMap[name]) {
                                itemMap[name] = {
                                    name,
                                    snapshotBase: 0,
                                    deposits: 0,
                                    withdrawals: 0,
                                    unitGe: 0,
                                    unitHa: 0,
                                    foundSnapshot: false
                                };
                            }

                            // Update Prices from ANY log
                            const itemGE = item.GE || 0;
                            const itemHA = item.HA || 0;
                            if (itemMap[name].unitGe === 0 && itemGE > 0) itemMap[name].unitGe = itemGE / item.qty;
                            if (itemMap[name].unitHa === 0 && itemHA > 0) itemMap[name].unitHa = itemHA / item.qty;

                            // Calculate Bank Quantities
                            if (log.action === 'BANK_SNAPSHOT') {
                                if (!itemMap[name].foundSnapshot) {
                                    itemMap[name].snapshotBase = item.qty;
                                    itemMap[name].foundSnapshot = true;
                                }
                            } else if (log.action === 'BANK_DEPOSIT') {
                                if (!itemMap[name].foundSnapshot) itemMap[name].deposits += item.qty;
                            } else if (log.action === 'BANK_WITHDRAWAL') {
                                if (!itemMap[name].foundSnapshot) itemMap[name].withdrawals += item.qty;
                            }
                        });
                    }
                });

                // Calculate final quantities and group by category
                const categorized: Record<string, ProcessedItem[]> = {};

                Object.values(itemMap).forEach(info => {
                    // Quick fix for Coins unit price
                    if (info.name === "Coins" && info.unitGe === 0) {
                        info.unitGe = 1;
                        info.unitHa = 1;
                    }

                    const finalQty = info.snapshotBase + info.deposits - info.withdrawals;

                    // Only show items that actually exist in the bank
                    if (finalQty > 0) {
                        const catName = categorizeItem(info.name);
                        if (!categorized[catName]) {
                            categorized[catName] = [];
                        }
                        categorized[catName].push({
                            name: info.name,
                            qty: finalQty,
                            unitGe: info.unitGe,
                            unitHa: info.unitHa
                        });
                    }
                });

                setCategories(categorized);
            }
            setIsLoading(false);
        }

        fetchBankItems();
    }, []);

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
            <div className="max-w-[1200px] p-6 text-[14px] leading-relaxed">
                <div className="mb-6 text-sm">
                    <Link href="/" className="text-[#729fcf] hover:underline">Home</Link>
                    <span className="mx-2 text-gray-500">{'>'}</span>
                    <span className="text-gray-300">Bank Viewer</span>
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
                    <div
                        className="text-center text-gray-500 italic mt-12 border border-[#3a3a3a] bg-[#1e1e1e] p-8">Reading
                        bank snapshot...</div>
                ) : sortedCategoryKeys.length === 0 ? (
                    <div
                        className="text-center text-gray-500 italic mt-12 border border-[#3a3a3a] bg-[#1e1e1e] p-8">No
                        banked items found. Go open your bank in-game to sync!</div>
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
                                <table
                                    className="w-full border-collapse border border-[#3a3a3a] text-sm bg-[#1e1e1e]">
                                    <thead>
                                    <tr className="bg-[#2a2a2a] text-white">
                                        <th className="w-1/2 border border-[#3a3a3a] px-3 py-2 text-left font-bold">Item</th>
                                        <th className="w-1/4 border border-[#3a3a3a] px-3 py-2 text-center font-bold">In
                                            Bank
                                        </th>
                                        <th className="w-1/4 border border-[#3a3a3a] px-3 py-2 text-right font-bold text-[#cca052]">Value</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {items.sort((a, b) => (b.qty * (isIronman ? b.unitHa : b.unitGe)) - (a.qty * (isIronman ? a.unitHa : a.unitGe))).map((item, idx) => {
                                        const itemValue = Math.floor(item.qty * (isIronman ? item.unitHa : item.unitGe));
                                        return (
                                            <tr key={idx}
                                                className="border border-[#3a3a3a] hover:bg-[#2a2a2a] transition-colors">
                                                <td className="border border-[#3a3a3a] px-3 py-2">
                                                    <Link href={`/items/${item.name.replace(/ /g, '_')}`}
                                                          className="text-[#729fcf] hover:underline">
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
                    })
                )}
            </div>
        </WikiLayout>
    );
}