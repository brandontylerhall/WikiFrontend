export interface LogItem {
    id: number;
    name?: string;
    qty: number;
    GE?: number;
    HA?: number;
    basePrice?: number;
}

export interface DatabaseRow {
    id?: number;
    log_data: {
        eventType?: string;
        action?: string;
        source?: string;
        target?: string;
        category?: string;
        skill?: string;
        xpGained?: number;
        note?: string;
        sessionId?: string;
        regionId?: number | string;
        timestamp?: string;
        items?: LogItem[];
        npcLevel?: number;
    };
}

export interface AggregatedDrop {
    name: string;
    displayQty: string | number;
    totalQty: number;
    count: number;
    gePrice: number;
    haPrice: number;
    isSummary?: boolean;
    firstKc?: number;
}

export interface AggregatedLocation {
    regionId: string;
    count: number;
}