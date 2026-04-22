"use client";
import React, { useEffect, useState, use } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function IndividualMonsterPage({ params }: { params: Promise<{ monster: string }> }) {
    const resolvedParams = use(params);
    const targetMonster = decodeURIComponent(resolvedParams.monster).replace(/_/g, ' ');
    const [drops, setDrops] = useState<any[]>([]);
    const [totalKills, setTotalKills] = useState(0);

    useEffect(() => {
        async function fetchDrops() {
            const { data } = await supabase.from('loot_logs').select('log_data');
            if (data) {
                let kills = 0;
                const dropMap: Record<string, { qty: number, times: number }> = {};
                data.forEach((row: any) => {
                    const log = row.log_data;
                    if (log.source === targetMonster && log.action !== 'PICKUP' && log.action !== 'DROP') {
                        kills++;
                        if (log.items) {
                            log.items.forEach((item: any) => {
                                const name = item.name || `Unknown (ID: ${item.id})`;
                                if (!dropMap[name]) dropMap[name] = { qty: 0, times: 0 };
                                dropMap[name].qty += item.qty;
                                dropMap[name].times += 1;
                            });
                        }
                    }
                });
                setTotalKills(kills);
                setDrops(Object.entries(dropMap).map(([name, stats]) => ({ name, ...stats })).sort((a, b) => b.qty - a.qty));
            }
        }
        fetchDrops();
    }, [targetMonster]);

    return (
        <div className="min-h-screen bg-[#121212] text-[#c8c8c8] font-sans p-8">
            <div className="max-w-[1000px] mx-auto">
                <Link href="/monsters" className="text-[#729fcf] hover:underline mb-4 block">{'<'} Back to Bestiary</Link>
                <h1 className="text-[32px] font-serif text-[#ffffff] border-b border-[#3a3a3a] pb-4 mb-4">{targetMonster}</h1>
                <p className="text-[#cca052] mb-8 font-bold">Total Logged Kills: {totalKills}</p>
                <table className="w-full border-collapse border border-[#3a3a3a] text-sm bg-[#1e1e1e]">
                    <thead>
                    <tr className="bg-[#2a2a2a] text-white">
                        <th className="border border-[#3a3a3a] px-3 py-2 text-left">Item</th>
                        <th className="border border-[#3a3a3a] px-3 py-2 text-center">Total Qty</th>
                        <th className="border border-[#3a3a3a] px-3 py-2 text-right">Times Dropped</th>
                    </tr>
                    </thead>
                    <tbody>
                    {drops.map((drop, idx) => (
                        <tr key={idx} className="border border-[#3a3a3a]">
                            <td className="border border-[#3a3a3a] px-3 py-2"><Link href={`/items/${drop.name.replace(/ /g, '_')}`} className="text-[#729fcf] hover:underline">{drop.name}</Link></td>
                            <td className="border border-[#3a3a3a] px-3 py-2 text-center">{drop.qty}</td>
                            <td className="border border-[#3a3a3a] px-3 py-2 text-right">{drop.times}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}