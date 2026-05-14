"use client";

import React, {useEffect, useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import Link from 'next/link';
import WikiLayout from "@/components/WikiLayout";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// --- DATA MODELS ---
interface SupplyStat {
    name: string;
    qtyUsed: number;
    unitGe: number;
    unitHa: number;
}

interface ConsumableStat extends SupplyStat {
    hpHealed: number;
}

interface RangedSupplyStat {
    name: string;
    qtyFired: number;
    qtyRetrieved: number;
    qtySaved: number;
    unitGe: number;
    unitHa: number;
}

// --- CALCULATION HELPERS ---
const calculateCost = (supplies: SupplyStat[], isIronman: boolean) => {
    return supplies.reduce((total, item) => total + (item.qtyUsed * (isIronman ? item.unitHa : item.unitGe)), 0);
};

const calculateRangedCost = (supplies: RangedSupplyStat[], isIronman: boolean) => {
    return supplies.reduce((total, item) => {
        const netLost = Math.max(0, item.qtyFired - item.qtyRetrieved - item.qtySaved);
        return total + (netLost * (isIronman ? item.unitHa : item.unitGe));
    }, 0);
};

// --- COMPONENTS ---
const SupplyTable = ({title, supplies, colorClass, emptyMsg, isIronman, isLoading}: {
    title: string, supplies: SupplyStat[], colorClass: string, emptyMsg: string, isIronman: boolean, isLoading: boolean
}) => {
    const sectionCost = calculateCost(supplies, isIronman);
    return (
        <div className="mb-10">
            <div className="flex justify-between items-end border-b border-[#3a3a3a] pb-2 mb-4">
                <h2 className={`text-[22px] font-serif ${colorClass}`}>{title}</h2>
                <div className="text-right">
                    <span className="text-sm text-gray-400 mr-2">Overhead:</span>
                    <span className="font-bold text-[#ff6666]">-{Math.floor(sectionCost).toLocaleString()} gp</span>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-[#3a3a3a] text-sm bg-[#1e1e1e]">
                    <thead>
                    <tr className="bg-[#2a2a2a] text-white">
                        <th className="border border-[#3a3a3a] px-3 py-2 text-left font-bold w-1/2">Item</th>
                        <th className="border border-[#3a3a3a] px-3 py-2 text-center font-bold">Qty Used</th>
                        <th className="border border-[#3a3a3a] px-3 py-2 text-right font-bold text-[#ff6666]">Total Cost</th>
                    </tr>
                    </thead>
                    <tbody>
                    {isLoading ? (
                        <tr><td colSpan={3} className="p-4 text-center text-gray-500 italic">Scanning logs...</td></tr>
                    ) : supplies.length === 0 ? (
                        <tr><td colSpan={3} className="p-4 text-center text-gray-500 italic">{emptyMsg}</td></tr>
                    ) : (
                        supplies.map((item, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? "bg-[#1e1e1e]" : "bg-[#222222] hover:bg-[#333333] transition-colors"}>
                                <td className="border border-[#3a3a3a] px-3 py-2">
                                    <Link href={`/items/${item.name.replace(/ /g, '_')}`} className="text-[#729fcf] hover:underline">{item.name}</Link>
                                </td>
                                <td className="border border-[#3a3a3a] px-3 py-2 text-center text-white">{item.qtyUsed.toLocaleString()}</td>
                                <td className="border border-[#3a3a3a] px-3 py-2 text-right text-gray-300">-{Math.floor(item.qtyUsed * (isIronman ? item.unitHa : item.unitGe)).toLocaleString()}</td>
                            </tr>
                        ))
                    )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const ConsumableTable = ({title, supplies, colorClass, emptyMsg, isIronman, isLoading}: {
    title: string, supplies: ConsumableStat[], colorClass: string, emptyMsg: string, isIronman: boolean, isLoading: boolean
}) => {
    const sectionCost = calculateCost(supplies, isIronman);
    return (
        <div className="mb-10">
            <div className="flex justify-between items-end border-b border-[#3a3a3a] pb-2 mb-4">
                <h2 className={`text-[22px] font-serif ${colorClass}`}>{title}</h2>
                <div className="text-right">
                    <span className="text-sm text-gray-400 mr-2">Overhead:</span>
                    <span className="font-bold text-[#ff6666]">-{Math.floor(sectionCost).toLocaleString()} gp</span>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-[#3a3a3a] text-sm bg-[#1e1e1e] table-fixed">
                    <thead>
                    <tr className="bg-[#2a2a2a] text-white">
                        <th className="border border-[#3a3a3a] px-2 py-2 text-left font-bold w-1/3">Item</th>
                        <th className="border border-[#3a3a3a] px-2 py-2 text-center font-bold">Qty Eaten</th>
                        <th className="border border-[#3a3a3a] px-2 py-2 text-center font-bold text-[#90ff90]">Total HP Healed</th>
                        <th className="border border-[#3a3a3a] px-2 py-2 text-center font-bold">Avg HP/Eat</th>
                        <th className="border border-[#3a3a3a] px-2 py-2 text-right font-bold text-[#ff6666]">Total Cost</th>
                    </tr>
                    </thead>
                    <tbody>
                    {isLoading ? (
                        <tr><td colSpan={5} className="p-4 text-center text-gray-500 italic">Scanning logs...</td></tr>
                    ) : supplies.length === 0 ? (
                        <tr><td colSpan={5} className="p-4 text-center text-gray-500 italic">{emptyMsg}</td></tr>
                    ) : (
                        supplies.map((item, idx) => {
                            const avgHp = item.qtyUsed > 0 ? (item.hpHealed / item.qtyUsed).toFixed(1) : "0";
                            return (
                                <tr key={idx} className={idx % 2 === 0 ? "bg-[#1e1e1e]" : "bg-[#222222] hover:bg-[#333333] transition-colors"}>
                                    <td className="border border-[#3a3a3a] px-2 py-2 truncate">
                                        <Link href={`/items/${item.name.replace(/ /g, '_')}`} className="text-[#729fcf] hover:underline" title={item.name}>{item.name}</Link>
                                    </td>
                                    <td className="border border-[#3a3a3a] px-2 py-2 text-center text-white">{item.qtyUsed.toLocaleString()}</td>
                                    <td className="border border-[#3a3a3a] px-2 py-2 text-center text-[#90ff90] font-bold">{item.hpHealed.toLocaleString()}</td>
                                    <td className="border border-[#3a3a3a] px-2 py-2 text-center text-gray-400">~{avgHp}</td>
                                    <td className="border border-[#3a3a3a] px-2 py-2 text-right text-gray-300">-{Math.floor(item.qtyUsed * (isIronman ? item.unitHa : item.unitGe)).toLocaleString()}</td>
                                </tr>
                            );
                        })
                    )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const RangedSupplyTable = ({title, supplies, colorClass, emptyMsg, isIronman, isLoading}: {
    title: string, supplies: RangedSupplyStat[], colorClass: string, emptyMsg: string, isIronman: boolean, isLoading: boolean
}) => {
    const sectionCost = calculateRangedCost(supplies, isIronman);
    return (
        <div className="mb-10">
            <div className="flex justify-between items-end border-b border-[#3a3a3a] pb-2 mb-4">
                <h2 className={`text-[22px] font-serif ${colorClass}`}>{title}</h2>
                <div className="text-right flex flex-col items-end">
                    <div>
                        <span className="text-sm text-gray-400 mr-2">Net Overhead:</span>
                        <span className="font-bold text-[#ff6666]">-{Math.floor(sectionCost).toLocaleString()} gp</span>
                    </div>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-[#3a3a3a] text-sm bg-[#1e1e1e] table-fixed">
                    <thead>
                    <tr className="bg-[#2a2a2a] text-white">
                        <th className="border border-[#3a3a3a] px-2 py-2 text-left font-bold w-1/4">Ammunition</th>
                        <th className="border border-[#3a3a3a] px-2 py-2 text-center font-bold">Qty Fired</th>
                        <th className="border border-[#3a3a3a] px-2 py-2 text-center font-bold text-[#729fcf]">Qty Retrieved</th>
                        <th className="border border-[#3a3a3a] px-2 py-2 text-center font-bold text-[#cca052]">Qty Saved</th>
                        <th className="border border-[#3a3a3a] px-2 py-2 text-center font-bold text-[#ff6666]">Net Lost</th>
                        <th className="border border-[#3a3a3a] px-2 py-2 text-right font-bold text-[#ff6666]">Total Cost</th>
                    </tr>
                    </thead>
                    <tbody>
                    {isLoading ? (
                        <tr><td colSpan={6} className="p-4 text-center text-gray-500 italic">Scanning logs...</td></tr>
                    ) : supplies.length === 0 ? (
                        <tr><td colSpan={6} className="p-4 text-center text-gray-500 italic">{emptyMsg}</td></tr>
                    ) : (
                        supplies.map((item, idx) => {
                            const netLost = Math.max(0, item.qtyFired - item.qtyRetrieved - item.qtySaved);
                            const totalCost = Math.floor(netLost * (isIronman ? item.unitHa : item.unitGe));

                            return (
                                <tr key={idx} className={idx % 2 === 0 ? "bg-[#1e1e1e]" : "bg-[#222222] hover:bg-[#333333] transition-colors"}>
                                    <td className="border border-[#3a3a3a] px-2 py-2 truncate">
                                        <Link href={`/items/${item.name.replace(/ /g, '_')}`} className="text-[#729fcf] hover:underline" title={item.name}>{item.name}</Link>
                                    </td>
                                    <td className="border border-[#3a3a3a] px-2 py-2 text-center text-white">{item.qtyFired.toLocaleString()}</td>
                                    <td className="border border-[#3a3a3a] px-2 py-2 text-center text-[#80c8ff]">{item.qtyRetrieved.toLocaleString()}</td>
                                    <td className="border border-[#3a3a3a] px-2 py-2 text-center text-[#cca052]">{item.qtySaved.toLocaleString()}</td>
                                    <td className="border border-[#3a3a3a] px-2 py-2 text-center text-[#ff6666] font-bold">{netLost.toLocaleString()}</td>
                                    <td className="border border-[#3a3a3a] px-2 py-2 text-right text-gray-300">-{totalCost.toLocaleString()}</td>
                                </tr>
                            );
                        })
                    )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- MAIN PAGE ---
export default function CombatHub() {
    const [isIronman, setIsIronman] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const [magicSupplies, setMagicSupplies] = useState<SupplyStat[]>([]);
    const [rangedSupplies, setRangedSupplies] = useState<RangedSupplyStat[]>([]);
    const [foodSupplies, setFoodSupplies] = useState<ConsumableStat[]>([]);
    const [potionSupplies, setPotionSupplies] = useState<ConsumableStat[]>([]);

    useEffect(() => {
        async function fetchCombatLogs() {
            setIsLoading(true);
            const {data} = await supabase.from('loot_logs').select('log_data').order('id', {ascending: false}).limit(10000);

            if (data) {
                const magicMap: Record<string, SupplyStat> = {};
                const rangedMap: Record<string, RangedSupplyStat> = {};
                const foodMap: Record<string, ConsumableStat> = {};
                const potionMap: Record<string, ConsumableStat> = {};

                data.forEach((row: any) => {
                    const log = row.log_data;
                    const action = (log.eventType || log.action || "").toUpperCase();

                    // Allow everything we need to track ammo, runes, and food.
                    const isConsume = ['CONSUME', 'COMBAT_CONSUME', 'SKILLING_CONSUME'].includes(action);
                    const isTakeOrGround = action === 'TAKE' || (action === 'GATHER_GAIN' && log.source === 'None');

                    if (!['SPELL_CAST', 'RANGED_FIRE', 'TELEPORT'].includes(action) && !isConsume && !isTakeOrGround) return;

                    log.items?.forEach((item: any) => {
                        const name = item.name || "Unknown";
                        const lowerName = name.toLowerCase();

                        if (action === 'SPELL_CAST' || action === 'TELEPORT') {
                            if (!magicMap[name]) magicMap[name] = {name, qtyUsed: 0, unitGe: 0, unitHa: 0};
                            magicMap[name].qtyUsed += item.qty;
                            if (magicMap[name].unitGe === 0) magicMap[name].unitGe = (item.GE || 0) / item.qty;
                            if (magicMap[name].unitHa === 0) magicMap[name].unitHa = (item.HA || 0) / item.qty;
                        }
                        else if (isConsume) {
                            const hpHealed = log.hpHealed || 0;
                            const isPotion = ['potion', 'brew', 'restore', 'stamina', 'antifire', 'serum'].some(p => lowerName.includes(p));

                            const targetMap = isPotion ? potionMap : foodMap;
                            if (!targetMap[name]) targetMap[name] = {name, qtyUsed: 0, hpHealed: 0, unitGe: 0, unitHa: 0};

                            targetMap[name].qtyUsed += item.qty;
                            targetMap[name].hpHealed += hpHealed;
                            if (targetMap[name].unitGe === 0) targetMap[name].unitGe = (item.GE || 0) / item.qty;
                            if (targetMap[name].unitHa === 0) targetMap[name].unitHa = (item.HA || 0) / item.qty;
                        }
                        else if (action === 'RANGED_FIRE') {
                            if (!rangedMap[name]) rangedMap[name] = {name, qtyFired: 0, qtyRetrieved: 0, qtySaved: 0, unitGe: 0, unitHa: 0};
                            rangedMap[name].qtyFired += item.qty;
                            if (rangedMap[name].unitGe === 0) rangedMap[name].unitGe = (item.GE || 0) / item.qty;
                            if (rangedMap[name].unitHa === 0) rangedMap[name].unitHa = (item.HA || 0) / item.qty;
                        }
                        else if (isTakeOrGround) {
                            const isAmmo = ['arrow', 'bolt', 'dart', 'knife'].some(a => lowerName.includes(a));

                            if (isAmmo) {
                                if (!rangedMap[name]) rangedMap[name] = {name, qtyFired: 0, qtyRetrieved: 0, qtySaved: 0, unitGe: 0, unitHa: 0};
                                rangedMap[name].qtyRetrieved += item.qty;
                                if (rangedMap[name].unitGe === 0) rangedMap[name].unitGe = (item.GE || 0) / item.qty;
                                if (rangedMap[name].unitHa === 0) rangedMap[name].unitHa = (item.HA || 0) / item.qty;
                            }
                        }
                    });
                });

                setMagicSupplies(Object.values(magicMap).sort((a,b) => b.qtyUsed - a.qtyUsed));
                setRangedSupplies(Object.values(rangedMap).sort((a,b) => b.qtyFired - a.qtyFired));
                setFoodSupplies(Object.values(foodMap).sort((a,b) => b.qtyUsed - a.qtyUsed));
                setPotionSupplies(Object.values(potionMap).sort((a,b) => b.qtyUsed - a.qtyUsed));
            }
            setIsLoading(false);
        }
        fetchCombatLogs();
    }, []);

    const absoluteTotalCost = calculateCost(magicSupplies, isIronman) + calculateRangedCost(rangedSupplies, isIronman) + calculateCost(foodSupplies, isIronman) + calculateCost(potionSupplies, isIronman);

    return (
        <WikiLayout>
            <div className="w-full p-6 text-[14px] leading-relaxed">

                <div className="mb-6 text-sm">
                    <Link href="/" className="text-[#729fcf] hover:underline">Home</Link>
                    <span className="mx-2 text-gray-500">{'>'}</span>
                    <span className="text-gray-300">Combat</span>
                </div>

                <div className="flex justify-between items-end border-b border-[#3a3a3a] pb-4 mb-8">
                    <div>
                        <h1 className="text-[32px] font-serif text-[#ffffff]">Account Overhead</h1>
                        <p className="text-gray-400 mt-2">Lifetime supplies consumed for combat and travel.</p>
                    </div>
                    <div className="text-right">
                        <button onClick={() => setIsIronman(!isIronman)}
                                className="text-xs px-2 py-1 mb-1 bg-[#2a2a2a] border border-[#3a3a3a] text-[#c8c8c8] transition-colors hover:bg-[#3a3a3a]">
                            {isIronman ? 'Show HA Value' : 'Show GE Value'}
                        </button>
                        <p className="text-3xl font-bold text-[#ff6666]">-{Math.floor(absoluteTotalCost).toLocaleString()} gp</p>
                    </div>
                </div>

                <SupplyTable title="Magic & Teleports" supplies={magicSupplies} colorClass="text-[#80c8ff]" emptyMsg="No runes used." isIronman={isIronman} isLoading={isLoading}/>

                <RangedSupplyTable title="Ranged Ammunition" supplies={rangedSupplies} colorClass="text-[#90ff90]" emptyMsg="No ammo used." isIronman={isIronman} isLoading={isLoading}/>

                <ConsumableTable title="Food" supplies={foodSupplies} colorClass="text-[#cca052]" emptyMsg="No food eaten." isIronman={isIronman} isLoading={isLoading}/>

                {potionSupplies.length > 0 && (
                    <ConsumableTable title="Potions" supplies={potionSupplies} colorClass="text-[#cca052]" emptyMsg="No potions used." isIronman={isIronman} isLoading={isLoading}/>
                )}
            </div>
        </WikiLayout>
    );
}