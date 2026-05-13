"use client";

import React, {useEffect, useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import Link from 'next/link';
import WikiLayout from "@/components/WikiLayout";
import {DatabaseRow} from '@/lib/types';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

interface SupplyStat {
    name: string;
    qtyUsed: number;
    unitGe: number;
    unitHa: number;
}

const calculateCost = (supplies: SupplyStat[], isIronman: boolean) => {
    return supplies.reduce((total, item) => total + (item.qtyUsed * (isIronman ? item.unitHa : item.unitGe)), 0);
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
                            <tr key={idx} className={idx % 2 === 0 ? "bg-[#1e1e1e]" : "bg-[#222222] hover:bg-[#333333]"}>
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

export default function CombatHub() {
    const [isIronman, setIsIronman] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const [magicSupplies, setMagicSupplies] = useState<SupplyStat[]>([]);
    const [rangedSupplies, setRangedSupplies] = useState<SupplyStat[]>([]);
    const [combatConsumables, setCombatConsumables] = useState<SupplyStat[]>([]);

    useEffect(() => {
        async function fetchCombatLogs() {
            setIsLoading(true);
            const {data} = await supabase.from('loot_logs').select('log_data').order('id', {ascending: false}).limit(10000);

            if (data) {
                const magicMap: Record<string, SupplyStat> = {};
                const rangedMap: Record<string, SupplyStat> = {};
                const consumeMap: Record<string, SupplyStat> = {};

                data.forEach((row: any) => {
                    const log = row.log_data;
                    const action = (log.eventType || log.action || "").toUpperCase();

                    if (!['SPELL_CAST', 'RANGED_FIRE', 'COMBAT_CONSUME', 'TELEPORT'].includes(action)) return;

                    log.items?.forEach((item: any) => {
                        const name = item.name || "Unknown";
                        let targetMap = consumeMap;
                        if (action === 'SPELL_CAST' || action === 'TELEPORT') targetMap = magicMap;
                        if (action === 'RANGED_FIRE') targetMap = rangedMap;

                        if (!targetMap[name]) targetMap[name] = {name, qtyUsed: 0, unitGe: 0, unitHa: 0};
                        targetMap[name].qtyUsed += item.qty;
                        if (targetMap[name].unitGe === 0) targetMap[name].unitGe = (item.GE || 0) / item.qty;
                        if (targetMap[name].unitHa === 0) targetMap[name].unitHa = (item.HA || 0) / item.qty;
                    });
                });
                setMagicSupplies(Object.values(magicMap).sort((a,b) => b.qtyUsed - a.qtyUsed));
                setRangedSupplies(Object.values(rangedMap).sort((a,b) => b.qtyUsed - a.qtyUsed));
                setCombatConsumables(Object.values(consumeMap).sort((a,b) => b.qtyUsed - a.qtyUsed));
            }
            setIsLoading(false);
        }
        fetchCombatLogs();
    }, []);

    const absoluteTotalCost = calculateCost(magicSupplies, isIronman) + calculateCost(rangedSupplies, isIronman) + calculateCost(combatConsumables, isIronman);

    return (
        <WikiLayout>
            <div className="max-w-[1200px] p-6 text-[14px] leading-relaxed">

                {/* Breadcrumb */}
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
                                className="text-xs px-2 py-1 mb-1 bg-[#2a2a2a] border border-[#3a3a3a] text-[#c8c8c8]">{isIronman ? 'Show HA' : 'Show GE'}</button>
                        <p className="text-3xl font-bold text-[#ff6666]">-{Math.floor(absoluteTotalCost).toLocaleString()} gp</p>
                    </div>
                </div>
                <SupplyTable title="Magic & Teleports" supplies={magicSupplies} colorClass="text-[#80c8ff]"
                             emptyMsg="No runes used." isIronman={isIronman} isLoading={isLoading}/>
                <SupplyTable title="Ranged Ammunition" supplies={rangedSupplies} colorClass="text-[#90ff90]"
                             emptyMsg="No ammo used." isIronman={isIronman} isLoading={isLoading}/>
                <SupplyTable title="Consumables" supplies={combatConsumables} colorClass="text-[#cca052]"
                             emptyMsg="No food/pots used." isIronman={isIronman} isLoading={isLoading}/>
            </div>
        </WikiLayout>
    );
}