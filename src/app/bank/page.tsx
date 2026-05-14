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

// Custom sort array to dictate exactly what order the sub-tables appear in
const SUB_CATEGORY_ORDER = [
    "Runes", "Ammunition",
    "Melee Weapons", "Melee Armour",
    "Ranged Weapons", "Ranged Armour",
    "Magic Weapons", "Magic Armour",
    "Capes", "Jewellery & Accessories",
    "Mining & Smithing", "Woodcutting & Firemaking", "Crafting", "Fletching", "Runecrafting", "General Resources",
    "Cooked Food", "Cooking Materials", "Potions", "Burnt Food"
];

// PRE-COMPILED REGEX OPTIMIZATION
const AMMO_REGEX = /\b(arrows?|bolt|dart|javelin|knife|thrownaxe)\b/;
const RAW_FOOD_REGEX = /\b(raw)\b/;
const POTION_REGEX = /\b(potion|brew)\b/;
const BURNT_FOOD_REGEX = /\b(burnt)\b/;
const MINING_GEAR_REGEX = /\b(pickaxe)\b/;
const WC_GEAR_REGEX = /\b(axe|hatchet|tinderbox|forestry)\b/;
const FISHING_GEAR_REGEX = /\b(fishing rod|fishing net|harpoon|lobster pot)\b/;
const CRAFTING_GEAR_REGEX = /\b(hammer|chisel|mould|mold|needle)\b/;
const FARMING_GEAR_REGEX = /\b(spade|rake|dibber|secateurs|trowel)\b/;
const HUNTER_GEAR_REGEX = /\b(box trap|snare|bird snare)\b/;
const MINING_RES_REGEX = /\b(ore|coal|bar|clay|sandstone|granite|amethyst|salt)\b/;
const WC_RES_REGEX = /\b(log|logs)\b/;
const CRAFTING_RES_REGEX = /\b(hide|cowhide|leather|flax|seaweed|oyster|glass|molten|wool)\b/;
const RC_RES_REGEX = /\b(essence|core)\b/;
const FLETCH_RES_REGEX = /\b(feather|shaft|arrowtips?)\b/;
const CAPE_REGEX = /\b(cape|cloak|accumulator|attractor)\b/;
const MAGIC_WEAPON_ARMOUR_REGEX = /\b(staff|wand|mystic|robe|ahrim|infinity)\b/;
const MAGIC_WEAPON_REGEX = /\b(staff|wand)\b/;
const RANGED_WEAPON_ARMOUR_REGEX = /\b(\w*bow|studded|dart|knife|thrownaxe|chaps|vamb\w*|d'hide|dragonhide|karil|pegasian|coif)\b/;
const RANGED_WEAPON_REGEX = /\b(\w*bow|dart|knife|thrownaxe)\b/;
const MELEE_WEAPON_REGEX = /\b(\w*sword|scimitar|dagger|mace|spear|halberd|battleaxe|warhammer|whip|fang|rapier|defender)\b/;
const MELEE_ARMOUR_REGEX = /\b(helm|helmet|platebody|platelegs|plateskirt|\w*shield|chainbody|boots|gloves|sq|kite)\b/;
const JEWELLERY_REGEX = /\b(ring|amulet|necklace|bracelet)\b/;
const TOOL_HACK_REGEX = /\b(axe|hatchet|pickaxe|tinderbox|harpoon|fishing rod|fishing net|hammer|chisel|spade)\b/;
const COMBAT_AXE_HACK_REGEX = /\b(battleaxe|thrownaxe)\b/;

function getBankSubCategory(name: string, mainCategory: string): string {
    const lowerName = name.toLowerCase();

    if (mainCategory === "Runes & Ammunition") {
        if (AMMO_REGEX.test(lowerName)) return "Ammunition";
        return "Runes";
    }

    if (mainCategory === "Food & Potions") {
        if (RAW_FOOD_REGEX.test(lowerName)) return "Cooking Materials";
        if (POTION_REGEX.test(lowerName)) return "Potions";
        if (BURNT_FOOD_REGEX.test(lowerName)) return "Burnt Food";
        return "Cooked Food";
    }

    if (mainCategory === "Skilling Equipment") {
        if (MINING_GEAR_REGEX.test(lowerName)) return "Mining";
        if (WC_GEAR_REGEX.test(lowerName)) return "Woodcutting & Firemaking";
        if (FISHING_GEAR_REGEX.test(lowerName)) return "Fishing";
        if (CRAFTING_GEAR_REGEX.test(lowerName)) return "Crafting & Smithing";
        if (FARMING_GEAR_REGEX.test(lowerName)) return "Farming";
        if (HUNTER_GEAR_REGEX.test(lowerName)) return "Hunter";
        return "General Equipment";
    }

    if (mainCategory === "Raw Resources") {
        if (MINING_RES_REGEX.test(lowerName)) return "Mining & Smithing";
        if (WC_RES_REGEX.test(lowerName)) return "Woodcutting & Firemaking";
        if (CRAFTING_RES_REGEX.test(lowerName)) return "Crafting";
        if (RC_RES_REGEX.test(lowerName)) return "Runecrafting";
        if (FLETCH_RES_REGEX.test(lowerName)) return "Fletching";
        return "General Resources";
    }

    if (mainCategory === "Weapons & Armour") {
        if (CAPE_REGEX.test(lowerName)) return "Capes";
        if (MAGIC_WEAPON_ARMOUR_REGEX.test(lowerName)) {
            if (MAGIC_WEAPON_REGEX.test(lowerName)) return "Magic Weapons";
            return "Magic Armour";
        }
        if (RANGED_WEAPON_ARMOUR_REGEX.test(lowerName)) {
            if (RANGED_WEAPON_REGEX.test(lowerName)) return "Ranged Weapons";
            return "Ranged Armour";
        }
        if (MELEE_WEAPON_REGEX.test(lowerName)) return "Melee Weapons";
        if (MELEE_ARMOUR_REGEX.test(lowerName)) return "Melee Armour";
        if (JEWELLERY_REGEX.test(lowerName)) return "Jewellery & Accessories";
        return "Armour";
    }

    return mainCategory;
}

export default function BankHub() {
    const [categories, setCategories] = useState<Record<string, Record<string, ProcessedItem[]>>>({});
    const [isIronman, setIsIronman] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchBankItems() {
            setIsLoading(true);
            const {data} = await supabase
                .from('loot_logs')
                .select('log_data')
                .order('id', {ascending: false})
                .limit(5000);

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

                            const itemGE = item.GE || 0;
                            const itemHA = item.HA || 0;
                            if (itemMap[name].unitGe === 0 && itemGE > 0) itemMap[name].unitGe = itemGE / item.qty;
                            if (itemMap[name].unitHa === 0 && itemHA > 0) itemMap[name].unitHa = itemHA / item.qty;

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

                const categorized: Record<string, Record<string, ProcessedItem[]>> = {};

                Object.values(itemMap).forEach(info => {
                    if (info.name === "Coins" && info.unitGe === 0) {
                        info.unitGe = 1;
                        info.unitHa = 1;
                    }

                    const finalQty = info.snapshotBase + info.deposits - info.withdrawals;

                    if (finalQty > 0) {
                        let catName = categorizeItem(info.name);
                        const lowerName = info.name.toLowerCase();

                        // HACK: Force all tools explicitly into Skilling Equipment so they can be sorted by skill
                        if (TOOL_HACK_REGEX.test(lowerName) && !COMBAT_AXE_HACK_REGEX.test(lowerName)) {
                            catName = "Skilling Equipment";
                        }

                        const subCatName = getBankSubCategory(info.name, catName);

                        if (!categorized[catName]) {
                            categorized[catName] = {};
                        }
                        if (!categorized[catName][subCatName]) {
                            categorized[catName][subCatName] = [];
                        }

                        categorized[catName][subCatName].push({
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

    // FIX: Exact wealth calculation to prevent floor drift
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
                                    <span
                                        className="text-[#cca052] font-bold text-lg">{catValue.toLocaleString()} gp</span>
                                </div>

                                {/* Custom Array Sort to dictate sub-table order */}
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
                                                {/* ALPHABETICAL SORT APPLIED HERE */}
                                                {items.sort((a, b) => a.name.localeCompare(b.name)).map((item, idx) => {
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
                                })}
                            </div>
                        );
                    })
                )}
            </div>
        </WikiLayout>
    );
}