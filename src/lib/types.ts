export interface LogItem {
    id: number;
    name?: string;
    qty: number;
    GE?: number;
    HA?: number;
}

export interface DatabaseRow {
    log_data: {
        action?: string;
        source?: string;
        category?: string;
        sessionId?: string;
        regionId?: number | string;
        items?: Array<{
            id: number;
            name?: string;
            qty: number;
            GE?: number;
            HA?: number;
        }>;
    };
}

export interface AggregatedDrop {
    name: string;
    displayQty: string | number;
    totalQty: number;
    count: number;
    gePrice: number;
    haPrice: number;
    isSummary?: boolean; // Brings back the summary flag
    firstKc?: number;
}

export interface AggregatedLocation {
    regionId: string;
    count: number;
}