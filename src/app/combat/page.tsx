"use client";

import React, {useEffect, useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import Link from 'next/link';
import WikiLayout from "@/components/WikiLayout";
import { useCharacter } from '@/lib/CharacterContext';
import { usePeriod } from '@/lib/PeriodContext';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

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
    unitGe: number;
    unitHa: number;
}

const calculateCost = (supplies: SupplyStat[], isIronman: boolean) => {
    return supplies.reduce((total, item) => total + (item.qtyUsed * (isIronman ? item.unitHa : item.unitGe)), 0);
};

const calculateRangedCost = (supplies: RangedSupplyStat[], isIronman: boolean) => {
    return supplies.reduce((total, item) => {
        const netLost = Math.max(0, item.qtyFired - item.qtyRetrieved);
        return total + (netLost * (isIronman ? item.unitHa : item.unitGe));
    }, 0);
};

const formatDecimal = (num: number): string => {
    if (Number.isInteger(num)) return num.toString();
    const str = num.toString();
    const decimalPart = str.split('.')[1] || '';
    if (decimalPart.length <= 2) return str;
    return `~${num.toFixed(1)}`;
};

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

const ConsumableTable = ({title, supplies, colorClass, emptyMsg, isIronman, isLoading, showHp}: {
    title: string, supplies: ConsumableStat[], colorClass: string, emptyMsg: string, isIronman: boolean, isLoading: boolean, showHp: boolean
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
                        <th className="border border-[#3a3a3a] px-2 py-2 text-center font-bold">Qty {showHp ? 'Eaten' : 'Used'}</th>
                        {showHp && <th className="border border-[#3a3a3a] px-2 py-2 text-center font-bold text-[#90ff90]">Total HP Healed</th>}
                        {showHp && <th className="border border-[#3a3a3a] px-2 py-2 text-center font-bold">Avg HP/Eat</th>}
                        <th className="border border-[#3a3a3a] px-2 py-2 text-right font-bold text-[#ff6666]">Total Cost</th>
                    </tr>
                    </thead>
                    <tbody>
                    {isLoading ? (
                        <tr><td colSpan={showHp ? 5 : 3} className="p-4 text-center text-gray-500 italic">Scanning logs...</td></tr>
                    ) : supplies.length === 0 ? (
                        <tr><td colSpan={showHp ? 5 : 3} className="p-4 text-center text-gray-500 italic">{emptyMsg}</td></tr>
                    ) : (
                        supplies.map((item, idx) => {
                            let displayAvgHp = "0";
                            if (item.qtyUsed > 0) displayAvgHp = formatDecimal(item.hpHealed / item.qtyUsed);

                            return (
                                <tr key={idx} className={idx % 2 === 0 ? "bg-[#1e1e1e]" : "bg-[#222222] hover:bg-[#333333] transition-colors"}>
                                    <td className="border border-[#3a3a3a] px-2 py-2 truncate">
                                        <Link href={`/items/${item.name.replace(/ /g, '_')}`} className="text-[#729fcf] hover:underline" title={item.name}>{item.name}</Link>
                                    </td>
                                    <td className="border border-[#3a3a3a] px-2 py-2 text-center text-white">{item.qtyUsed.toLocaleString()}</td>
                                    {showHp && <td className="border border-[#3a3a3a] px-2 py-2 text-center text-[#90ff90] font-bold">{item.hpHealed.toLocaleString()}</td>}
                                    {showHp && <td className="border border-[#3a3a3a] px-2 py-2 text-center text-gray-400">{displayAvgHp}</td>}
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
                        <th className="border border-[#3a3a3a] px-2 py-2 text-left font-bold w-1/3">Ammunition</th>
                        <th className="border border-[#3a3a3a] px-2 py-2 text-center font-bold">Qty Fired</th>
                        <th className="border border-[#3a3a3a] px-2 py-2 text-center font-bold text-[#80c8ff]">Qty Retrieved</th>
                        <th className="border border-[#3a3a3a] px-2 py-2 text-center font-bold text-[#ff6666]">Net Lost</th>
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
                            const netLost = Math.max(0, item.qtyFired - item.qtyRetrieved);
                            const totalCost = Math.floor(netLost * (isIronman ? item.unitHa : item.unitGe));

                            return (
                                <tr key={idx} className={idx % 2 === 0 ? "bg-[#1e1e1e]" : "bg-[#222222] hover:bg-[#333333] transition-colors"}>
                                    <td className="border border-[#3a3a3a] px-2 py-2 truncate">
                                        <Link href={`/items/${item.name.replace(/ /g, '_')}`} className="text-[#729fcf] hover:underline" title={item.name}>{item.name}</Link>
                                    </td>
                                    <td className="border border-[#3a3a3a] px-2 py-2 text-center text-white">{item.qtyFired.toLocaleString()}</td>
                                    <td className="border border-[#3a3a3a] px-2 py-2 text-center text-[#80c8ff]">{item.qtyRetrieved.toLocaleString()}</td>
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

interface CombatCostsResult {
    runes: { name: string; qty: number; ge_unit: number; ha_unit: number }[];
    ammo: { name: string; fired: number; retrieved: number; ge_unit: number; ha_unit: number }[];
    food: { name: string; qty: number; hp_healed: number; ge_unit: number; ha_unit: number }[];
    potions: { name: string; qty: number; ge_unit: number; ha_unit: number }[];
}

export default function CombatHub() {
    const { activeCharacter, isLoading: charLoading } = useCharacter();
    const { period } = usePeriod();
    const [isIronman, setIsIronman] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const [magicSupplies, setMagicSupplies] = useState<SupplyStat[]>([]);
    const [rangedSupplies, setRangedSupplies] = useState<RangedSupplyStat[]>([]);
    const [foodSupplies, setConsumableSupplies] = useState<ConsumableStat[]>([]);
    const [potionSupplies, setPotionSupplies] = useState<ConsumableStat[]>([]);

    useEffect(() => {
        setMagicSupplies([]);
        setRangedSupplies([]);
        setConsumableSupplies([]);
        setPotionSupplies([]);

        if (charLoading) return;
        if (!activeCharacter) {
            setIsLoading(false);
            return;
        }

        async function fetchCombatLogs() {
            setIsLoading(true);
            const {data, error} = await supabase.rpc('get_combat_costs', {
                p_character_id: activeCharacter!.id,
                p_period: period,
            });

            if (error) console.error("Database Error:", error);

            const costs = data as CombatCostsResult | null;
            if (costs) {
                setMagicSupplies((costs.runes || []).map(r => ({
                    name: r.name, qtyUsed: Number(r.qty), unitGe: Number(r.ge_unit), unitHa: Number(r.ha_unit),
                })));
                setRangedSupplies((costs.ammo || []).map(a => ({
                    name: a.name, qtyFired: Number(a.fired), qtyRetrieved: Number(a.retrieved),
                    unitGe: Number(a.ge_unit), unitHa: Number(a.ha_unit),
                })));
                setConsumableSupplies((costs.food || []).map(f => ({
                    name: f.name, qtyUsed: Number(f.qty), hpHealed: Number(f.hp_healed),
                    unitGe: Number(f.ge_unit), unitHa: Number(f.ha_unit),
                })));
                setPotionSupplies((costs.potions || []).map(p => ({
                    name: p.name, qtyUsed: Number(p.qty), hpHealed: 0,
                    unitGe: Number(p.ge_unit), unitHa: Number(p.ha_unit),
                })));
            }
            setIsLoading(false);
        }

        fetchCombatLogs();
    }, [activeCharacter, charLoading, period]);

    const absoluteTotalCost = calculateCost(magicSupplies, isIronman) + calculateRangedCost(rangedSupplies, isIronman) + calculateCost(foodSupplies, isIronman) + calculateCost(potionSupplies, isIronman);

    return (
        <WikiLayout>
            <div className="w-full p-6 text-[14px] leading-relaxed">
                <div className="mb-6 text-sm">
                    <Link href="/" className="text-[#729fcf] hover:underline">Home</Link>
                    <span className="mx-2 text-gray-500">{'>'}</span>
                    <span className="text-gray-300">Combat Costs</span>
                </div>

                <div className="flex justify-between items-end border-b border-[#3a3a3a] pb-4 mb-8">
                    <div>
                        <h1 className="text-[32px] font-serif text-[#ffffff]">Combat Costs</h1>
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

                <SupplyTable title="Magic & Teleports" supplies={magicSupplies} colorClass="text-[#80c8ff]"
                             emptyMsg="No runes used." isIronman={isIronman} isLoading={isLoading}/>

                <RangedSupplyTable title="Ranged Ammunition" supplies={rangedSupplies} colorClass="text-[#90ff90]"
                                   emptyMsg="No ammo used." isIronman={isIronman} isLoading={isLoading}/>

                <ConsumableTable title="Food" supplies={foodSupplies} colorClass="text-[#cca052]"
                                 emptyMsg="No food eaten." isIronman={isIronman} isLoading={isLoading} showHp={true}/>

                {potionSupplies.length > 0 && (
                    <ConsumableTable title="Potions" supplies={potionSupplies} colorClass="text-[#cca052]"
                                     emptyMsg="No potions used." isIronman={isIronman} isLoading={isLoading} showHp={false}/>
                )}
            </div>
        </WikiLayout>
    );
}