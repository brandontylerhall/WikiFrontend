"use client";

import React, { useEffect, useState, use } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { LEGACY_ID_MAP } from '@/lib/constants';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface DatabaseRow {
    log_data: {
        action?: string;
        source?: string;
        category?: string;
        items?: Array<{
            id: number;
            name?: string;
            qty: number;
            GE?: number;
            HA?: number;
        }>;
    };
}

interface ItemSourceStat {
    sourceName: string;
    category: string;
    quantityDropped: number;
    timesDropped: number;
}

export default function IndividualItemPage() {
    const params = useParams();
    const rawTarget = decodeURIComponent(params.item as string);
    const itemNameTarget = rawTarget.replace(/_/g, ' ');
    const displayTitle = itemNameTarget.charAt(0).toUpperCase() + itemNameTarget.slice(1);

    const [isIronman, setIsIronman] = useState(false);
    const [sourceStats, setSourceStats] = useState<ItemSourceStat[]>([]);

    // Updated Bank Tracking State
    const [bankSnapshotQty, setBankSnapshotQty] = useState(0);
    const [sessionDeposits, setSessionDeposits] = useState(0);
    const [sessionWithdrawals, setSessionWithdrawals] = useState(0);
    const [hasSnapshot, setHasSnapshot] = useState(false);

    const [totalQuantity, setTotalQuantity] = useState(0);
    const [singleGePrice, setSingleGePrice] = useState(0);
    const [singleHaPrice, setSingleHaPrice] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchItemData() {
            setIsLoading(true);

            const { data, error } = await supabase
                .from('loot_logs')
                .select('log_data')
                .order('id', { ascending: false })
                .limit(5000);

            if (error) console.error("Database Error:", error);

            if (data) {
                const statsMap: Record<string, ItemSourceStat> = {};
                let totalQty = 0;
                let ge = 0;
                let ha = 0;

                // Bank tracking variables
                let snapshotBase = 0;
                let recentDeposits = 0;
                let recentWithdrawals = 0;
                let foundSnapshot = false;

                data.forEach((row: DatabaseRow) => {
                    const log = row.log_data;

                    // Still ignore these completely to prevent double dipping for total quantity
                    if (log.action && ['CONSUME', 'DESTROY', 'DROP', 'PICKUP'].includes(log.action)) {
                        return;
                    }

                    if (log.items && log.items.length > 0) {
                        log.items.forEach((item) => {
                            // Trim whitespace just in case!
                            const currentName = (item.name || LEGACY_ID_MAP[item.id] || `Unknown`).trim();
                            const targetName = itemNameTarget.trim();

                            if (currentName.toLowerCase() === targetName.toLowerCase()) {

                                // Grab prices early just in case it's a bank action
                                const itemGE = item.GE || 0;
                                const itemHA = item.HA || 0;
                                if (ge === 0 && itemGE > 0) ge = itemGE / item.qty;
                                if (ha === 0 && itemHA > 0) ha = itemHA / item.qty;

                                // --- THE NEW BANK SNAPSHOT LOGIC ---
                                if (log.action === 'BANK_SNAPSHOT') {
                                    // Because we read newest-to-oldest, the FIRST snapshot we hit is the most recent one.
                                    // Once we find it, we lock in that base amount and stop counting older deposits/withdrawals.
                                    if (!foundSnapshot) {
                                        snapshotBase = item.qty;
                                        foundSnapshot = true;
                                    }
                                    return; // It's a bank action, not an acquisition source
                                }

                                if (log.action === 'BANK_DEPOSIT') {
                                    // Only count deposits that happened AFTER the most recent snapshot
                                    if (!foundSnapshot) recentDeposits += item.qty;
                                    return;
                                }
                                if (log.action === 'BANK_WITHDRAWAL') {
                                    // Only count withdrawals that happened AFTER the most recent snapshot
                                    if (!foundSnapshot) recentWithdrawals += item.qty;
                                    return;
                                }
                                // ------------------------------------

                                // If it survived the gauntlet, it's a true acquisition source!
                                const source = log.source || "Unknown Source";
                                const category = log.category || "Unknown";

                                if (!statsMap[source]) {
                                    statsMap[source] = {
                                        sourceName: source,
                                        category: category,
                                        quantityDropped: 0,
                                        timesDropped: 0
                                    };
                                }

                                statsMap[source].quantityDropped += item.qty;
                                statsMap[source].timesDropped += 1;
                                totalQty += item.qty;
                            }
                        });
                    }
                });

                setSourceStats(Object.values(statsMap).sort((a, b) => b.quantityDropped - a.quantityDropped));
                setTotalQuantity(totalQty);
                setBankSnapshotQty(snapshotBase);
                setSessionDeposits(recentDeposits);
                setSessionWithdrawals(recentWithdrawals);
                setHasSnapshot(foundSnapshot);
                setSingleGePrice(ge);
                setSingleHaPrice(ha);
            }
            setIsLoading(false);
        }

        fetchItemData();
    }, [itemNameTarget]);

    const totalValue = totalQuantity * (isIronman ? singleHaPrice : singleGePrice);

    // Split sources for our new layout
    const combatSources = sourceStats.filter(stat => stat.category === 'Combat');
    const skillingSources = sourceStats.filter(stat => stat.category === 'Skilling');

    // Reusable table component
    const SourceTable = ({ sources, emptyMessage }: { sources: ItemSourceStat[], emptyMessage: string }) => {
        if (isLoading) return <div className="p-4 border border-[#3a3a3a] text-center italic text-gray-500 bg-[#1e1e1e]">Scanning logs...</div>;
        if (sources.length === 0) return <div className="p-4 border border-[#3a3a3a] text-center italic text-gray-500 bg-[#1e1e1e]">{emptyMessage}</div>;

        return (
            <div className="overflow-x-auto mb-8">
                <table className="w-full border-collapse border border-[#3a3a3a] text-sm bg-[#1e1e1e]">
                    <thead>
                    <tr className="bg-[#2a2a2a] text-white">
                        <th className="border border-[#3a3a3a] px-3 py-2 text-left font-bold w-1/2">Acquired From</th>
                        <th className="border border-[#3a3a3a] px-3 py-2 text-center font-bold text-[#cca052]">Total Received</th>
                        <th className="border border-[#3a3a3a] px-3 py-2 text-right font-bold">Actions Logged</th>
                    </tr>
                    </thead>
                    <tbody>
                    {sources.map((stat, idx) => {
                        const linkTarget = stat.category === "Skilling"
                            ? `/skilling/${stat.sourceName.replace(/ /g, '_')}`
                            : `/monsters/${stat.sourceName.replace(/ /g, '_')}`;

                        return (
                            <tr key={idx} className={idx % 2 === 0 ? "bg-[#1e1e1e]" : "bg-[#222222] hover:bg-[#333333] transition-colors"}>
                                <td className="border border-[#3a3a3a] px-3 py-2">
                                    <Link href={linkTarget} className="text-[#729fcf] hover:underline">
                                        {stat.sourceName}
                                    </Link>
                                </td>
                                <td className="border border-[#3a3a3a] px-3 py-2 text-center font-bold text-[#cca052]">
                                    {stat.quantityDropped.toLocaleString()}
                                </td>
                                <td className="border border-[#3a3a3a] px-3 py-2 text-right text-gray-400">
                                    {stat.timesDropped.toLocaleString()}
                                </td>
                            </tr>
                        );
                    })}
                    </tbody>
                </table>
            </div>
        );
    };

    const netBankAmount = bankSnapshotQty + sessionDeposits - sessionWithdrawals;

    return (
        <div className="min-h-screen bg-[#121212] text-[#c8c8c8] font-sans p-8">
            <div className="max-w-[1200px] mx-auto">

                {/* BREADCRUMBS */}
                <div className="mb-6 text-sm">
                    <Link href="/" className="text-[#729fcf] hover:underline">Home</Link>
                    <span className="mx-2 text-gray-500">{'>'}</span>
                    <Link href="/items" className="text-[#729fcf] hover:underline">Items Collection</Link>
                    <span className="mx-2 text-gray-500">{'>'}</span>
                    <span className="text-gray-300">{displayTitle}</span>
                </div>

                {/* HEADER */}
                <div className="border-b border-[#3a3a3a] pb-4 mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
                    <div>
                        <h1 className="text-[32px] font-serif text-[#ffffff] font-normal tracking-wide flex items-center gap-3">
                            {displayTitle}
                        </h1>
                        <p className="text-gray-400 mt-2">
                            Acquisition history and wealth contribution.
                        </p>
                    </div>

                    <div className="flex gap-6 text-right">
                        <div>
                            <div className="text-sm text-gray-400 mb-1">Total Gathered/Dropped</div>
                            <div className="text-2xl font-bold text-white">{totalQuantity.toLocaleString()}</div>
                        </div>
                        <div>
                            <button
                                onClick={() => setIsIronman(!isIronman)}
                                className="text-xs px-2 py-1 mb-1 bg-[#2a2a2a] border border-[#3a3a3a] hover:bg-[#3a3a3a] text-[#c8c8c8] transition-colors"
                            >
                                {isIronman ? 'HA Value' : 'GE Value'}
                            </button>
                            <div className="text-2xl font-bold text-[#cca052]">{Math.floor(totalValue).toLocaleString()} gp</div>
                        </div>
                    </div>
                </div>

                {/* MAIN CONTENT SPLIT */}
                <div className="flex flex-col lg:flex-row gap-8 items-start">

                    {/* LEFT SIDE: ACQUISITION SOURCES */}
                    <div className="flex-1 w-full order-2 lg:order-1">
                        <h2 className="text-[28px] font-serif text-[#ffffff] border-b border-[#3a3a3a] pb-2 mb-6">
                            Acquisition Sources
                        </h2>

                        {/* Monster Drops Section */}
                        <h3 className="text-[20px] font-serif text-[#cca052] mb-3 flex items-center gap-2">
                            Monster Drops
                        </h3>
                        <SourceTable sources={combatSources} emptyMessage="No combat drop records found." />

                        {/* Skilling Section */}
                        <h3 className="text-[20px] font-serif text-[#90ff90] mb-3 flex items-center gap-2">
                            Skilling & Gathering
                        </h3>
                        <SourceTable sources={skillingSources} emptyMessage="No skilling records found." />
                    </div>

                    {/* RIGHT SIDE: BANK WIDGET */}
                    <div className="w-full lg:w-[320px] order-1 lg:order-2 shrink-0">
                        <table className="w-full border-collapse border border-[#3a3a3a] bg-[#1e1e1e] text-[14px]">
                            <tbody>
                            <tr>
                                <th colSpan={2} className="bg-[#cca052] text-black text-[16px] p-2 border-b border-[#3a3a3a] text-center font-bold">
                                    Storage Activity
                                </th>
                            </tr>
                            <tr>
                                <td colSpan={2} className="p-6 text-center border-b border-[#3a3a3a] bg-[#222222]">
                                    <div className="text-sm text-gray-400 mb-1">Current Banked Amount</div>
                                    <div className={`text-4xl font-bold ${netBankAmount >= 0 ? 'text-white' : 'text-red-400'}`}>
                                        {netBankAmount.toLocaleString()}
                                    </div>
                                </td>
                            </tr>
                            <tr className="bg-[#1e1e1e]">
                                <th className="p-3 border border-[#3a3a3a] text-left font-normal text-gray-400 w-1/2">
                                    {hasSnapshot ? "Base (Snapshot)" : "Base Amount"}
                                </th>
                                <td className="p-3 border border-[#3a3a3a] text-right font-bold text-white">
                                    {bankSnapshotQty.toLocaleString()}
                                </td>
                            </tr>
                            <tr className="bg-[#222222]">
                                <th className="p-3 border border-[#3a3a3a] text-left font-normal text-gray-400">Session Deposits</th>
                                <td className="p-3 border border-[#3a3a3a] text-right font-bold text-[#90ff90]">
                                    +{sessionDeposits.toLocaleString()}
                                </td>
                            </tr>
                            <tr className="bg-[#1e1e1e]">
                                <th className="p-3 border border-[#3a3a3a] text-left font-normal text-gray-400">Session Withdrawals</th>
                                <td className="p-3 border border-[#3a3a3a] text-right font-bold text-[#ff6666]">
                                    -{sessionWithdrawals.toLocaleString()}
                                </td>
                            </tr>
                            </tbody>
                        </table>
                        <p className="text-xs text-gray-500 italic mt-3 text-center">
                            {hasSnapshot
                                ? "*Bank amount calibrated from recent snapshot."
                                : "*Bank values reflect only actions logged while the plugin was active."}
                        </p>
                    </div>

                </div>

            </div>
        </div>
    );
}