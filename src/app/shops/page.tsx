"use client";

import React, {useEffect, useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import Link from 'next/link';
import WikiLayout from "@/components/WikiLayout";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ShopPreview {
    name: string;
    interactions: number;
    regionId: number;
}

export default function ShopsHub() {
    const [shops, setShops] = useState<ShopPreview[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchShops() {
            setIsLoading(true);
            const {data} = await supabase
                .from('loot_logs')
                .select('log_data')
                .eq('log_data->>category', 'Shopping')
                .order('id', {ascending: false})
                .limit(10000);

            if (data) {
                const shopMap: Record<string, ShopPreview> = {};

                data.forEach(row => {
                    const log = row.log_data as any;
                    const shopName = log.source;

                    // FIX: Allow "Unknown Shop" to render so we can debug!
                    if (!shopName) return;

                    if (!shopMap[shopName]) {
                        shopMap[shopName] = { name: shopName, interactions: 0, regionId: log.regionId };
                    }

                    // Increment interactions whether it's a purchase, sell, or just a snapshot (opening the store)
                    shopMap[shopName].interactions += 1;
                });

                setShops(Object.values(shopMap).sort((a,b) => b.interactions - a.interactions));
            }
            setIsLoading(false);
        }

        fetchShops();
    }, []);

    return (
        <WikiLayout>
            <div className="w-full p-6 text-[14px] leading-relaxed">
                <div className="mb-6 text-sm">
                    <Link href="/" className="text-[#729fcf] hover:underline">Home</Link>
                    <span className="mx-2 text-gray-500">{'>'}</span>
                    <span className="text-gray-300">Shops</span>
                </div>

                <div className="border-b border-[#3a3a3a] pb-4 mb-8">
                    <h1 className="text-[32px] font-serif text-[#ffffff] font-normal tracking-wide">
                        Gielinor Shops Directory
                    </h1>
                    <p className="text-gray-400 mt-2">
                        A record of merchants and general stores you have interacted with.
                    </p>
                </div>

                {isLoading ? (
                    <div className="text-center p-12 text-gray-500 italic border border-[#3a3a3a] bg-[#1e1e1e]">
                        Scanning merchant records...
                    </div>
                ) : shops.length === 0 ? (
                    <div className="text-center p-12 text-gray-500 italic border border-[#3a3a3a] bg-[#1e1e1e]">
                        You haven't visited any shops yet. Go open a store interface in-game!
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {shops.map(shop => {
                            const urlFriendlyName = shop.name.replace(/ /g, '_');
                            return (
                                <Link
                                    key={shop.name}
                                    href={`/shops/${urlFriendlyName}`}
                                    className="bg-[#1e1e1e] border border-[#3a3a3a] p-4 flex flex-col items-center justify-center hover:bg-[#2a2a2a] hover:border-[#cca052] transition-all group"
                                >
                                    <span className="font-bold mb-2 text-[#729fcf] group-hover:text-[#cca052] text-center">
                                        {shop.name}
                                    </span>
                                    <span className="text-xs font-mono text-gray-400 bg-[#000000] px-2 py-1 border border-[#3a3a3a] rounded">
                                        Interactions: {shop.interactions.toLocaleString()}
                                    </span>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </WikiLayout>
    );
}