"use client";
import React, {useEffect, useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import Link from 'next/link';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const LEGACY_ID_MAP: Record<number, string> = {
    1511: "Logs", 1521: "Oak logs", 1519: "Willow logs", 1515: "Yew logs", 1513: "Magic logs",
    436: "Copper ore", 438: "Tin ore", 440: "Iron ore", 453: "Coal",
    317: "Raw shrimps", 321: "Raw anchovies", 327: "Raw sardine", 345: "Raw herring",
    335: "Raw trout", 331: "Raw salmon", 349: "Raw pike", 359: "Raw tuna",
    371: "Raw swordfish", 377: "Raw lobster",
    995: "Coins", 592: "Ashes", 526: "Bones", 532: "Big bones", 554: "Fire rune",
    562: "Chaos rune", 560: "Death rune", 1333: "Rune scimitar", 1163: "Rune full helm",
    1061: "Leather boots", 333: "Trout", 9005: "Fancy boots", 9006: "Fighter boots",
    314: "Feather"
};

interface ProcessedItem {
    name: string;
    qty: number;
    unitGe: number;
    unitHa: number;
}

// YOUR REGEX SORTER IS BACK!
function categorizeCollectionItem(name: string): string {
    if (name === "Coins") return "Currencies";

    if (/\b(bones|ashes)\b/i.test(name)) return "Bones & Ashes";

    if (/\b(clue scroll|ensouled|totem|champion scroll|key|long bone|curved bone|shard|brimstone|larran's)\b/i.test(name)) return "Tertiary & Keys";

    if (/\b(uncut|diamond|ruby|emerald|sapphire|loop half|tooth half|dragon spear|shield left half)\b/i.test(name)) return "Rare Drop Table & Gems";

    if (/\b(grimy|seed|spore)\b/i.test(name)) return /\b(grimy)\b/i.test(name) ? "Herbs" : "Seeds";

    const isRune = /\b(air|water|earth|fire|mind|body|cosmic|chaos|nature|law|death|blood|soul|astral|wrath|mud|lava|steam|dust|smoke|mist)\s+rune\b/i.test(name);
    const isAmmo = /\b(arrow|arrows|bolt|bolts|dart|darts|javelin|javelins)\b/i.test(name);
    if (isRune || isAmmo) return "Runes & Ammunition";

    const isEquipment = /\b(sword|scimitar|dagger|mace|axe|spear|bow|helm|helmet|platebody|platelegs|plateskirt|shield|kiteshield|chainbody|mail|hide|staff|wand|boots|gloves|chaps|vamb|leather|robes?|top|bottom|halberd|battleaxe|2h|warhammer|sq|kite|defender)\b/i.test(name);
    if (isEquipment) return "Weapons & Armour";

    const isFood = /\b(raw|tuna|trout|salmon)\b/i.test(name);
    if (isFood) return "Food";

    const isTalisman = /\b(talisman)\b/i.test(name);
    if (isTalisman) return "Talismans";

    const isResource = /\b(log|logs|ore|coal|seaweed|oyster|cowhide)\b/i.test(name);
    if (isResource) return "Raw Resources";

    return "Other Loot";
}

// Preferred display order for the UI
const CATEGORY_ORDER = [
    "Currencies", "Weapons & Armour", "Runes & Ammunition", "Raw Resources", "Talismans",
    "Food", "Bones & Ashes", "Herbs", "Seeds", "Rare Drop Table & Gems",
    "Tertiary & Keys", "Other Loot"
];

export default function ItemsPage() {
    const [categories, setCategories] = useState<Record<string, ProcessedItem[]>>({});
    const [isIronman, setIsIronman] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchItems() {
            setIsLoading(true);
            const {data} = await supabase
                .from('loot_logs')
                .select('log_data')
                .order('id', {ascending: false})
                .limit(5000);

            if (data) {
                const itemMap: Record<string, ProcessedItem> = {};

                data.forEach((row: any) => {
                    const log = row.log_data;

                    // BLOCK DOUBLE DIPPING
                    if (log.action && ['BANK_DEPOSIT', 'BANK_WITHDRAWAL', 'CONSUME', 'DESTROY', 'DROP', 'PICKUP'].includes(log.action)) {
                        return;
                    }

                    if (log.items) {
                        log.items.forEach((item: any) => {
                            const name = item.name || LEGACY_ID_MAP[item.id] || `Unknown (ID: ${item.id})`;

                            if (!itemMap[name]) {
                                itemMap[name] = {name, qty: 0, unitGe: 0, unitHa: 0};
                            }

                            itemMap[name].qty += item.qty;

                            // EXTRACT UNIT PRICE ONCE
                            if (itemMap[name].unitGe === 0 && item.GE > 0) itemMap[name].unitGe = item.GE / item.qty;
                            if (itemMap[name].unitHa === 0 && item.HA > 0) itemMap[name].unitHa = item.HA / item.qty;
                        });
                    }
                });

                // Dynamically build the categorized object using your regex
                const categorized: Record<string, ProcessedItem[]> = {};

                Object.values(itemMap).forEach(item => {
                    // Quick fix for Coins unit price usually being 1 (GE data is often weird for coins)
                    if (item.name === "Coins" && item.unitGe === 0) {
                        item.unitGe = 1;
                        item.unitHa = 1;
                    }

                    const catName = categorizeCollectionItem(item.name);

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
    }, []);

    let totalWealth = 0;
    Object.values(categories).flat().forEach(item => {
        const value = isIronman ? (item.unitHa * item.qty) : (item.unitGe * item.qty);
        totalWealth += Math.floor(value);
    });

    // Sort categories based on our preferred order, putting any unexpected ones at the end
    const sortedCategoryKeys = Object.keys(categories).sort((a, b) => {
        const indexA = CATEGORY_ORDER.indexOf(a);
        const indexB = CATEGORY_ORDER.indexOf(b);
        if (indexA === -1 && indexB === -1) return a.localeCompare(b);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });

    return (
        <div className="min-h-screen bg-[#121212] text-[#c8c8c8] font-sans p-8">
            <div className="max-w-[1000px] mx-auto">
                <div className="flex justify-between items-end border-b border-[#3a3a3a] pb-4 mb-8">
                    <h1 className="text-[32px] font-serif text-[#ffffff]">Collection Log & Wealth</h1>
                    <div className="text-right">
                        <button
                            onClick={() => setIsIronman(!isIronman)}
                            className="text-xs px-2 py-1 mb-1 bg-[#2a2a2a] border border-[#3a3a3a] hover:bg-[#3a3a3a] text-[#c8c8c8] transition-colors"
                        >
                            {isIronman ? 'Show GE Prices' : 'Show HA Prices'}
                        </button>
                        <p className="text-sm text-gray-400 mt-1">Total Collection Value</p>
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
                                <table className="w-full border-collapse border border-[#3a3a3a] text-sm bg-[#1e1e1e]">
                                    <thead>
                                    <tr className="bg-[#2a2a2a] text-white">
                                        <th className="w-1/2 border border-[#3a3a3a] px-3 py-2 text-left font-bold">Item</th>
                                        <th className="w-1/4 border border-[#3a3a3a] px-3 py-2 text-center font-bold">Qty</th>
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
                                                <td className="border border-[#3a3a3a] px-3 py-2 text-center">{item.qty.toLocaleString()}</td>
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
        </div>
    );
}