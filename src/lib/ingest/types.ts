// ---------------------------------------------------------------------------
// Raw types — mirror the Java data classes shipped by the client
// ---------------------------------------------------------------------------

export interface RawItem {
    id: number;
    qty: number;
    name: string;
    invActions: string[];
    geUnit: number;   // GE price per 1 item
    haUnit: number;   // High-alch price per 1 item
    baseUnit: number; // Store base price per 1 item
}

export interface WidgetFlags {
    bank: boolean;
    ge: boolean;
    deposit: boolean;
    shop: boolean;
    dialogue231: boolean;
    dialogue217: boolean;
    dialogue193: boolean;
    dialogue229: boolean;
    dialogue277: boolean;
}

export interface TickPayload {
    hp: number;
    questPoints: number;
    autocastVarp: number;
    lastMenuOption: string;    // raw, HTML tags intact
    lastMenuTarget: string;    // raw
    dialogueNpcText?: string;  // stripped text of widget(231,4)
    widgets: WidgetFlags;
    inv: RawItem[] | null;     // null = no change since last snapshot
    equip: RawItem[] | null;
}

export interface MenuClickPayload {
    option: string; // raw
    target: string; // raw
}

export interface XpUpdatePayload {
    skill: string;
    xp: number; // absolute
}

export interface NpcLootPayload {
    npcName: string;
    npcLevel: number;
    items: RawItem[];
}

export interface ShopStockPayload {
    shopNameCandidates: string[];
    items: RawItem[];
}

export interface ExamineTextPayload {
    texts: string[];
}

export interface QuestStatePayload {
    questId: string | number;
    questName: string;
    newState: 'NOT_STARTED' | 'IN_PROGRESS' | 'FINISHED';
}

export type RawEventType =
    | 'TICK'
    | 'MENU_CLICK'
    | 'XP_UPDATE'
    | 'NPC_LOOT'
    | 'SHOP_STOCK'
    | 'BANK_SNAPSHOT'
    | 'EXAMINE_TEXT'
    | 'QUEST_STATE';

export interface RawEvent {
    schemaVersion?: string;
    sessionId: string;
    timestamp: string;
    clientTick: number;
    type: RawEventType;
    x?: number;
    y?: number;
    plane?: number;
    regionId?: number;
    payload: unknown;
}

export interface BankSnapshotPayload {
    items: RawItem[];
}

// ---------------------------------------------------------------------------
// Classified types — what gets written to loot_logs.log_data
// ---------------------------------------------------------------------------

/** Matches the frontend's LogItem interface (GE/HA/basePrice are STACK totals). */
export interface ClassifiedItem {
    id: number;
    name: string;
    qty: number;
    GE: number;        // geUnit * qty
    HA: number;        // haUnit * qty
    basePrice: number; // baseUnit * qty
}

/** Matches the frontend's DatabaseRow.log_data interface (and more). */
export interface ClassifiedEvent {
    eventType: string;
    sessionId: string;
    timestamp: string;
    x?: number;
    y?: number;
    plane?: number;
    regionId?: number;
    category: string;
    source: string;
    target: string;
    skill?: string;
    xpGained?: number;
    note?: string;
    hpHealed?: number;
    npcLevel?: number;
    items?: ClassifiedItem[];
}

// ---------------------------------------------------------------------------
// Session state — persisted per session in Supabase `session_state.state`
// ---------------------------------------------------------------------------

/** Combined inv+equip snapshot: itemId (string) → { raw metadata, combined qty } */
export type CombinedSnapshot = Record<string, { item: RawItem; qty: number }>;

export interface SessionState {
    // Item tracking
    previousCombined: CombinedSnapshot; // combined inv+equip from previous diff
    currentInvItems: RawItem[];         // latest known full inventory
    currentEquipItems: RawItem[];       // latest known full equipment
    previousBoostedHp: number;
    lastNetGained: Array<{ item: RawItem; qty: number }>;
    lastNetLost: Array<{ item: RawItem; qty: number }>;

    // Context locking (mirrors old plugin fields)
    lockedCombatTarget: string;
    lockedSkillingTarget: string;
    lockedManualSpell: string;
    lockedShopTarget: string;
    lastMenuOption: string; // stripped + lowercased

    // XP tracking
    previousXp: Record<string, number>; // skill name → absolute XP (0 = unset/calibrating)
    lastAutocastVarp: number;

    // Dialogue tracking
    lastDialogueTick: number;
    lastDialogueNpc: string;
    lastFinishedQuest: string;
    previousQuestPoints: number;
    lastWidgets: WidgetFlags | null;

    // Shop tracking
    currentShopName: string;

    // Quest tracking
    questTicks: Record<string, number>; // questId (string) → tick count
    inProgressQuests: string[];

    // Tick counter (used for dialogue-recency window)
    currentTick: number;

    currentBankItems: RawItem[];
}
