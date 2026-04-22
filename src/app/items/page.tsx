"use client";

import React, {useEffect, useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import Link from 'next/link';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const LEGACY_ID_MAP: Record<number, string> = {
    // Trees
    1511: "Logs", 1521: "Oak logs", 1519: "Willow logs", 1515: "Yew logs", 1513: "Magic logs",
    // Ores
    436: "Copper ore", 438: "Tin ore", 440: "Iron ore", 453: "Coal",
    // Fish
    317: "Raw shrimps", 321: "Raw anchovies", 327: "Raw sardine", 345: "Raw herring",
    335: "Raw trout", 331: "Raw salmon", 349: "Raw pike", 359: "Raw tuna",
    371: "Raw swordfish", 377: "Raw lobster",

    // THE MISSING COMBAT DROPS
    995: "Coins",
    592: "Ashes",
    526: "Bones",
    532: "Big bones",
    554: "Fire rune",
    562: "Chaos rune",
    560: "Death rune",
    1061: "Leather boots",
    333: "Trout",
    9005: "Fancy boots",
    9006: "Fighter boots",
    12812: "Ironman platelegs"
};

interface AggregatedItem {
    name: string;
    quantity: number;
    totalGe: number;
    totalHa: number;
}

// THE UNIVERSAL ITEM SORTER
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

    const isFood = /\b(tuna|trout|salmon)\b/i.test(name);
    if (isFood) return "Food";

    const isResource = /\b(log|logs|ore|coal|raw|seaweed|oyster|casket)\b/i.test(name);
    if (isResource) return "Raw Resources";

    return "Other Loot";
}

export default function ItemsHub() {
    const [isIronman, setIsIronman] = useState(false);
    const [groupedItems, setGroupedItems] = useState<Record<string, AggregatedItem[]>>({});
    const [grandTotalGe, setGrandTotalGe] = useState(0);
    const [grandTotalHa, setGrandTotalHa] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchAllItems() {
            setIsLoading(true);

            // Fetch EVERYTHING. We will filter out bank actions in JavaScript.
            const {data, error} = await supabase
                .from('loot_logs')
                .select('log_data')
                .limit(5000); // Adjust this limit if your DB gets massive

            if (error) console.error("Database Error:", error);

            if (data) {
                const itemMap: Record<string, AggregatedItem> = {};

                data.forEach((row: any) => {
                    const log = row.log_data;

                    // CRITICAL FILTER: We only want Combat, Skilling, and Ground Pickups.
                    // We DO NOT want Bank Deposits, Consumes, or Destroys ruining the wealth calculation.
                    if (log.action && ['BANK_DEPOSIT', 'BANK_WITHDRAWAL', 'CONSUME', 'DESTROY'].includes(log.action)) {
                        return; // Skip this row entirely
                    }

                    if (log.items && log.items.length > 0) {
                        log.items.forEach((item: any) => {
                            const itemName = item.name || LEGACY_ID_MAP[item.id] || `Unknown (ID: ${item.id})`;

                            // Skip "Nothing" drops
                            if (itemName === "Nothing") return;

                            if (!itemMap[itemName]) {
                                itemMap[itemName] = {name: itemName, quantity: 0, totalGe: 0, totalHa: 0};
                            }

                            itemMap[itemName].quantity += item.qty;
                            itemMap[itemName].totalGe += item.GE || 0; // GE total for that stack
                            itemMap[itemName].totalHa += item.HA || 0; // HA total for that stack
                        });
                    }
                });

                // Group the aggregated items by our Regex categories
                const newGrouped: Record<string, AggregatedItem[]> = {};
                let geSum = 0;
                let haSum = 0;

                Object.values(itemMap).forEach(item => {
                    geSum += item.totalGe;
                    haSum += item.totalHa;

                    const category = categorizeCollectionItem(item.name);
                    if (!newGrouped[category]) newGrouped[category] = [];
                    newGrouped[category].push(item);
                });

                // Sort items within each category by GE value (Most valuable at the top)
                Object.keys(newGrouped).forEach(cat => {
                    newGrouped[cat].sort((a, b) => b.totalGe - a.totalGe);
                });

                setGroupedItems(newGrouped);
                setGrandTotalGe(geSum);
                setGrandTotalHa(haSum);
            }
            setIsLoading(false);
        }

        fetchAllItems();
    }, []);

    // Order we want the categories to render on the page
    const categoryOrder = [
        "Currencies", "Weapons & Armour", "Food", "Rare Drop Table & Gems", "Runes & Ammunition",
        "Raw Resources", "Herbs", "Seeds", "Tertiary & Keys", "Bones & Ashes", "Other Loot"
    ];

    const displayTotal = isIronman ? grandTotalHa : grandTotalGe;

    return (
        <div className="min-h-screen bg-[#121212] text-[#c8c8c8] font-sans p-8">
            <div className="max-w-[1200px] mx-auto">

                <div className="mb-6 text-sm">
                    <Link href="/" className="text-[#729fcf] hover:underline">Home</Link>
                    <span className="mx-2 text-gray-500">{'>'}</span>
                    <span className="text-gray-300">Items Collection</span>
                </div>

                {/* Header & Wealth Tracker */}
                <div className="border-b border-[#3a3a3a] pb-4 mb-8 flex justify-between items-end">
                    <div>
                        <h1 className="text-[32px] font-serif text-[#ffffff] font-normal tracking-wide">
                            Collection Log & Wealth
                        </h1>
                        <p className="text-gray-400 mt-2">
                            A complete aggregate of every item acquired through combat, skilling, and looting.
                        </p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                        <button
                            onClick={() => setIsIronman(!isIronman)}
                            className="text-xs px-3 py-1 bg-[#2a2a2a] border border-[#3a3a3a] hover:bg-[#3a3a3a] text-[#c8c8c8] transition-colors"
                        >
                            {isIronman ? 'Show GE Prices' : 'Show HA Prices'}
                        </button>
                        <div className="text-sm text-gray-400 mt-1">Total Collection Value</div>
                        <div className="text-3xl font-bold text-[#fbdb71]">
                            {displayTotal.toLocaleString()} gp
                        </div>
                    </div>
                </div>

                {isLoading ? (
                    <div className="border border-[#3a3a3a] p-12 text-center text-gray-500 italic bg-[#1e1e1e]">
                        Appraising bank value...
                    </div>
                ) : Object.keys(groupedItems).length === 0 ? (
                    <div className="border border-[#3a3a3a] p-12 text-center text-gray-500 italic bg-[#1e1e1e]">
                        No items collected yet.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                        {categoryOrder.map(category => {
                            const itemsInCategory = groupedItems[category];
                            if (!itemsInCategory || itemsInCategory.length === 0) return null;

                            // Calculate total value of just this specific category tab
                            const categoryValue = itemsInCategory.reduce((sum, item) => sum + (isIronman ? item.totalHa : item.totalGe), 0);

                            return (
                                <div key={category} className="mb-4">
                                    <div className="flex justify-between items-end border-b border-[#3a3a3a] pb-1 mb-3">
                                        <h2 className="text-[20px] font-serif text-[#ffffff]">
                                            {category}
                                        </h2>
                                        <span className="text-xs text-[#cca052] font-mono">
                                            {categoryValue.toLocaleString()} gp
                                        </span>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table
                                            className="w-full border-collapse border border-[#3a3a3a] text-sm bg-[#1e1e1e]">
                                            <thead>
                                            <tr className="bg-[#2a2a2a] text-white">
                                                <th className="w-1/2 border border-[#3a3a3a] px-3 py-2 text-left font-bold">Item</th>
                                                <th className="w-1/4 border border-[#3a3a3a] px-3 py-2 text-center font-bold">Qty</th>
                                                <th className="w-1/4 border border-[#3a3a3a] px-3 py-2 text-right font-bold text-[#cca052]">Value</th>
                                            </tr>
                                            </thead>
                                            <tbody>
                                            {itemsInCategory.map((item, idx) => {
                                                const rowValue = isIronman ? item.totalHa : item.totalGe;
                                                return (
                                                    <tr key={idx}
                                                        className={idx % 2 === 0 ? "bg-[#1e1e1e]" : "bg-[#222222] hover:bg-[#333333] transition-colors"}>
                                                        <td className="border border-[#3a3a3a] px-3 py-2">
                                                            <Link
                                                                href={`/items/${item.name.replace(/ /g, '_')}`}
                                                                className="text-[#729fcf] hover:underline"
                                                            >
                                                                {item.name}
                                                            </Link>
                                                        </td>
                                                        <td className="border border-[#3a3a3a] px-3 py-2 text-center text-[#ffffff]">
                                                            {item.quantity.toLocaleString()}
                                                        </td>
                                                        <td className="border border-[#3a3a3a] px-3 py-2 text-right text-[#ffffff]">
                                                            {rowValue.toLocaleString()}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

            </div>
        </div>
    );
}