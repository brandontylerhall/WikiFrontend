"use client";

import React, {useEffect, useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import Link from 'next/link';
import {LEGACY_ID_MAP} from '@/lib/constants';
import WikiLayout from "@/components/WikiLayout";
import {DatabaseRow, LogItem} from '@/lib/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface SupplyStat {
    name: string;
    qtyUsed: number;
    unitGe: number;
    unitHa: number;
}

interface XpStat {
    skill: string;
    xpGained: number;
}

const calculateCost = (supplies: SupplyStat[], isIronman: boolean) => {
    return supplies.reduce((total, item) => total + (item.qtyUsed * (isIronman ? item.unitHa : item.unitGe)), 0);
};

const SupplyTable = ({title, supplies, colorClass, emptyMsg, isIronman, isLoading}: {
    title: string,
    supplies: SupplyStat[],
    colorClass: string,
    emptyMsg: string,
    isIronman: boolean,
    isLoading: boolean
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
                        <th className="border border-[#3a3a3a] px-3 py-2 text-right font-bold text-[#ff6666]">Total
                            Cost
                        </th>
                    </tr>
                    </thead>
                    <tbody>
                    {isLoading ? (
                        <tr>
                            <td colSpan={3}
                                className="border border-[#3a3a3a] p-4 text-center text-gray-500 italic">Scanning
                                logs...
                            </td>
                        </tr>
                    ) : supplies.length === 0 ? (
                        <tr>
                            <td colSpan={3}
                                className="border border-[#3a3a3a] p-4 text-center text-gray-500 italic">{emptyMsg}</td>
                        </tr>
                    ) : (
                        supplies.map((item, idx) => {
                            const cost = Math.floor(item.qtyUsed * (isIronman ? item.unitHa : item.unitGe));
                            return (
                                <tr key={idx}
                                    className={idx % 2 === 0 ? "bg-[#1e1e1e]" : "bg-[#222222] hover:bg-[#333333] transition-colors"}>
                                    <td className="border border-[#3a3a3a] px-3 py-2">
                                        <Link href={`/items/${item.name.replace(/ /g, '_')}`}
                                              className="text-[#729fcf] hover:underline">
                                            {item.name}
                                        </Link>
                                    </td>
                                    <td className="border border-[#3a3a3a] px-3 py-2 text-center text-white">{item.qtyUsed.toLocaleString()}</td>
                                    <td className="border border-[#3a3a3a] px-3 py-2 text-right text-gray-300">-{cost.toLocaleString()}</td>
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

export default function CombatHub() {
    const [isIronman, setIsIronman] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const [xpGains, setXpGains] = useState<XpStat[]>([]);
    const [magicSupplies, setMagicSupplies] = useState<SupplyStat[]>([]);
    const [rangedSupplies, setRangedSupplies] = useState<SupplyStat[]>([]);
    const [combatConsumables, setCombatConsumables] = useState<SupplyStat[]>([]);

    useEffect(() => {
        async function fetchCombatLogs() {
            setIsLoading(true);

            const {data, error} = await supabase
                .from('loot_logs')
                .select('log_data')
                .not('log_data->>action', 'is', null)
                .order('id', {ascending: false})
                .limit(5000);

            if (error) console.error("Database Error:", error);

            if (data) {
                const xpMap: Record<string, XpStat> = {};
                const magicMap: Record<string, SupplyStat> = {};
                const rangedMap: Record<string, SupplyStat> = {};
                const consumeMap: Record<string, SupplyStat> = {};

                data.forEach((row: DatabaseRow) => {
                    const log = row.log_data;

                    if (!['SPELL_CAST', 'RANGED_FIRE', 'COMBAT_CONSUME', 'XP_GAIN'].includes(log.action || '')) return;

                    if (log.items && log.items.length > 0) {
                        log.items.forEach((item) => {
                            const name = item.name || LEGACY_ID_MAP[item.id] || `Unknown (ID: ${item.id})`;

                            if (log.action === 'XP_GAIN' && log.category === 'Combat') {
                                const skillLabel = name === "XP_REWARD" ? "Legacy Combat XP" : name;

                                if (!xpMap[skillLabel]) {
                                    xpMap[skillLabel] = {skill: skillLabel, xpGained: 0};
                                }
                                xpMap[skillLabel].xpGained += item.qty;
                                return;
                            }

                            if (log.action !== 'XP_GAIN') {
                                let targetMap = consumeMap;
                                if (log.action === 'SPELL_CAST') targetMap = magicMap;
                                if (log.action === 'RANGED_FIRE') targetMap = rangedMap;

                                if (!targetMap[name]) {
                                    targetMap[name] = {name, qtyUsed: 0, unitGe: 0, unitHa: 0};
                                }

                                targetMap[name].qtyUsed += item.qty;

                                const itemGE = item.GE || 0;
                                const itemHA = item.HA || 0;
                                if (targetMap[name].unitGe === 0 && itemGE > 0) targetMap[name].unitGe = itemGE / item.qty;
                                if (targetMap[name].unitHa === 0 && itemHA > 0) targetMap[name].unitHa = itemHA / item.qty;
                            }
                        });
                    }
                });

                setXpGains(Object.values(xpMap).sort((a, b) => b.xpGained - a.xpGained));
                setMagicSupplies(Object.values(magicMap).sort((a, b) => b.qtyUsed - a.qtyUsed));
                setRangedSupplies(Object.values(rangedMap).sort((a, b) => b.qtyUsed - a.qtyUsed));
                setCombatConsumables(Object.values(consumeMap).sort((a, b) => b.qtyUsed - a.qtyUsed));
            }
            setIsLoading(false);
        }

        fetchCombatLogs();
    }, []);

    const totalMagicCost = calculateCost(magicSupplies, isIronman);
    const totalRangedCost = calculateCost(rangedSupplies, isIronman);
    const totalConsumeCost = calculateCost(combatConsumables, isIronman);
    const absoluteTotalCost = totalMagicCost + totalRangedCost + totalConsumeCost;
    const totalXpGained = xpGains.reduce((total, stat) => total + stat.xpGained, 0);

    return (
        <WikiLayout>
            <div className="max-w-[1200px] p-6 text-[14px] leading-relaxed">
                <div className="mb-6 text-sm">
                    <Link href="/" className="text-[#729fcf] hover:underline">Home</Link>
                    <span className="mx-2 text-gray-500">{'>'}</span>
                    <span className="text-gray-300">Combat & XP Hub</span>
                </div>

                <div
                    className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-[#3a3a3a] pb-4 mb-8 gap-4">
                    <div>
                        <h1 className="text-[32px] font-serif text-[#ffffff] tracking-wide">Combat & XP Tracker</h1>
                        <p className="text-gray-400 mt-2">A global overview of your combat supply overhead and skill
                            progression.</p>
                    </div>
                    <div className="text-right">
                        <button
                            onClick={() => setIsIronman(!isIronman)}
                            className="text-xs px-2 py-1 mb-1 bg-[#2a2a2a] border border-[#3a3a3a] hover:bg-[#3a3a3a] text-[#c8c8c8] transition-colors"
                        >
                            {isIronman ? 'Show HA Prices' : 'Show GE Prices'}
                        </button>
                        <p className="text-sm text-gray-400 mt-1">Total Account Overhead</p>
                        <p className="text-3xl font-bold text-[#ff6666]">-{Math.floor(absoluteTotalCost).toLocaleString()} gp</p>
                    </div>
                </div>

                {/* XP WIDGET */}
                <div className="mb-10">
                    <div className="flex justify-between items-end border-b border-[#3a3a3a] pb-2 mb-4">
                        <h2 className="text-[22px] font-serif text-[#fbdb71]">Experience Gained</h2>
                        <div className="text-right">
                            <span className="text-sm text-gray-400 mr-2">Total Tracked XP:</span>
                            <span className="font-bold text-[#fbdb71]">{totalXpGained.toLocaleString()}</span>
                        </div>
                    </div>

                    {isLoading ? (
                        <div
                            className="border border-[#3a3a3a] p-4 text-center text-gray-500 italic bg-[#1e1e1e]">Scanning
                            logs...</div>
                    ) : xpGains.length === 0 ? (
                        <div className="border border-[#3a3a3a] p-4 text-center text-gray-500 italic bg-[#1e1e1e]">No XP
                            data recorded yet.</div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {xpGains.map((stat, idx) => (
                                <div key={idx} className="bg-[#1e1e1e] border border-[#3a3a3a] p-4 rounded text-center">
                                    <div className="text-white font-serif text-lg mb-1">{stat.skill}</div>
                                    <div className="text-[#fbdb71] font-bold">+{stat.xpGained.toLocaleString()} XP</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* TABLES */}
                <SupplyTable title="Magic Runes Cast" supplies={magicSupplies} colorClass="text-[#80c8ff]"
                             emptyMsg="No spell casts recorded yet." isIronman={isIronman} isLoading={isLoading}/>
                <SupplyTable title="Ranged Ammunition Fired" supplies={rangedSupplies} colorClass="text-[#90ff90]"
                             emptyMsg="No arrows or bolts fired yet." isIronman={isIronman} isLoading={isLoading}/>
                <SupplyTable title="Combat Consumables" supplies={combatConsumables} colorClass="text-[#cca052]"
                             emptyMsg="No combat consumption recorded yet." isIronman={isIronman}
                             isLoading={isLoading}/>
            </div>
        </WikiLayout>
    );
}