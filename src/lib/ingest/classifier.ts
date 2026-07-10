/**
 * SessionClassifier — server-side port of the four RuneLite classifier engines:
 *   1. Net-Diff engine    (processNetItemDiff in LootLoggerPlugin)
 *   2. Context locking    (onMenuOptionClicked)
 *   3. XP attribution     (onStatChanged)
 *   4. Quest state machine (checkQuestProgress)
 *
 * One instance is created per session per batch call. State is loaded from
 * Supabase `session_state` at the start of each batch and written back at the end.
 */

import {getAutocastSpell} from './autocast';
import type {
    RawEvent,
    RawItem,
    TickPayload,
    MenuClickPayload,
    XpUpdatePayload,
    NpcLootPayload,
    ShopStockPayload,
    ExamineTextPayload,
    QuestStatePayload,
    StatsSnapshotPayload,
    QuestSnapshotPayload,
    ChestLootPayload,
    CollectionLogPayload,
    ClassifiedEvent,
    ClassifiedItem,
    CombinedSnapshot,
    SessionState,
    WidgetFlags,
    BankSnapshotPayload,
} from './types';

// ---------------------------------------------------------------------------
// Pure utilities
// ---------------------------------------------------------------------------

function stripHtml(s: string): string {
    return s.replace(/<[^>]*>/g, '');
}

/** Strip HTML tags then remove "(level-NN)" suffix — mirrors Text.removeTags + regex in the plugin. */
function stripTarget(raw: string): string {
    return stripHtml(raw).replace(/\s*\(level-\d+\)/g, '').trim();
}

function isConsumable(item: RawItem): boolean {
    return item.invActions.some((a) => a === 'Eat' || a === 'Drink');
}

function isRune(name: string): boolean {
    return name.toLowerCase().endsWith(' rune');
}

function isAmmo(name: string): boolean {
    const n = name.toLowerCase();
    return (
        n.includes('arrow') ||
        n.includes('bolt') ||
        n.includes('dart') ||
        n.includes('javelin') ||
        n.includes('throwing') ||
        n.includes('chinchompa')
    );
}

/**
 * Converts a RawItem + explicit qty into a ClassifiedItem for loot_logs.
 * GE/HA/basePrice are STACK TOTALS (unit × qty) as the frontend expects.
 */
function toClassifiedItem(rawItem: RawItem, qty: number): ClassifiedItem {
    return {
        id: rawItem.id,
        name: rawItem.name,
        qty,
        GE: rawItem.geUnit * qty,
        HA: rawItem.haUnit * qty,
        basePrice: rawItem.baseUnit * qty,
    };
}

/** Port of formatLostItems — used in SHOP_TRANSACTION and DIALOGUE_REWARD notes. */
function formatLostItems(items: Array<{ item: RawItem; qty: number }>): string {
    if (items.length === 0) return 'Nothing';
    return items.map((i) => `${i.qty}x ${i.item.name}`).join(' ');
}

/** Build a combined inventory+equipment snapshot: itemId → {item, summedQty}. */
function buildCombinedSnapshot(inv: RawItem[], equip: RawItem[]): CombinedSnapshot {
    const snapshot: CombinedSnapshot = {};
    for (const item of [...inv, ...equip]) {
        const key = String(item.id);
        if (snapshot[key]) {
            snapshot[key] = {item: snapshot[key].item, qty: snapshot[key].qty + item.qty};
        } else {
            snapshot[key] = {item, qty: item.qty};
        }
    }
    return snapshot;
}

/** Diff two combined snapshots. Returns items gained and items lost since `previous`. */
function diffSnapshots(
    current: CombinedSnapshot,
    previous: CombinedSnapshot,
): { gained: Array<{ item: RawItem; qty: number }>; lost: Array<{ item: RawItem; qty: number }> } {
    const gained: Array<{ item: RawItem; qty: number }> = [];
    const lost: Array<{ item: RawItem; qty: number }> = [];

    for (const [id, {item, qty}] of Object.entries(current)) {
        const prevQty = previous[id]?.qty ?? 0;
        if (qty > prevQty) gained.push({item, qty: qty - prevQty});
    }
    for (const [id, {item, qty}] of Object.entries(previous)) {
        const curQty = current[id]?.qty ?? 0;
        if (qty > curQty) lost.push({item, qty: qty - curQty});
    }

    return {gained, lost};
}

/** Port of getActiveShopName — resolves shop display name from candidate widget texts. */
function resolveShopName(candidates: string[], lockedShopTarget: string): string {
    for (const candidate of candidates) {
        const clean = stripHtml(candidate).trim();
        if (
            clean.length > 3 &&
            clean.toLowerCase() !== 'close' &&
            !clean.includes('Value check')
        ) {
            return clean;
        }
    }
    const locked = lockedShopTarget.trim();
    if (!locked) return 'Unknown Shop';
    return locked.toLowerCase().includes('shop') ? locked : locked + ' Shop';
}

const COMBAT_SKILLS = new Set(['Attack', 'Strength', 'Defence', 'Ranged', 'Magic', 'Hitpoints']);

/** Boss/raid chests classify as Combat; clue caskets and skilling minigames as Minigame. */
const COMBAT_CHEST_SOURCES = new Set([
    'Barrows',
    'Chambers of Xeric',
    'Theatre of Blood',
    'Tombs of Amascut',
]);

function chestCategory(source: string): string {
    return COMBAT_CHEST_SOURCES.has(source) ? 'Combat' : 'Minigame';
}

/** Gains within this many ticks of an empty-items CHEST_LOOT marker are attributed to it. */
const CHEST_MARKER_WINDOW_TICKS = 3;

// ---------------------------------------------------------------------------
// Fresh state factory
// ---------------------------------------------------------------------------

export function freshSessionState(): SessionState {
    return {
        previousCombined: {},
        currentInvItems: [],
        currentEquipItems: [],
        previousBoostedHp: -1,
        lastNetGained: [],
        lastNetLost: [],
        lockedCombatTarget: 'Unknown',
        lockedSkillingTarget: 'Unknown',
        lockedManualSpell: '',
        lockedShopTarget: '',
        lastMenuOption: '',
        previousXp: {},
        lastAutocastVarp: 0,
        lastDialogueTick: -999,
        lastDialogueNpc: 'NPC / Dialogue',
        lastFinishedQuest: 'Quest Reward',
        previousQuestPoints: -1,
        lastWidgets: null,
        currentShopName: 'Unknown Shop',
        questTicks: {},
        inProgressQuests: [],
        currentTick: 0,
        currentBankItems: [],
        pendingChestSource: '',
        pendingChestTick: -999,
    };
}

// ---------------------------------------------------------------------------
// SessionClassifier
// ---------------------------------------------------------------------------

export class SessionClassifier {
    private state: SessionState;

    private constructor(state: SessionState) {
        this.state = state;
    }

    /** Load from persisted state (or start fresh). Fresh defaults are spread
     *  first so states persisted before newer fields were added stay valid. */
    static rehydrate(state: SessionState | null): SessionClassifier {
        return new SessionClassifier(state ? {...freshSessionState(), ...state} : freshSessionState());
    }

    /** Serialise state back for Supabase upsert. */
    dump(): SessionState {
        return this.state;
    }

    /** Process a single raw event and return zero or more classified rows. */
    process(event: RawEvent): ClassifiedEvent[] {
        switch (event.type) {
            case 'MENU_CLICK':
                return this.processMenuClick(event, event.payload as MenuClickPayload);
            case 'XP_UPDATE':
                return this.processXpUpdate(event, event.payload as XpUpdatePayload);
            case 'NPC_LOOT':
                return this.processNpcLoot(event, event.payload as NpcLootPayload);
            case 'QUEST_STATE':
                return this.processQuestState(event, event.payload as QuestStatePayload);
            case 'SHOP_STOCK':
                return this.processShopStock(event, event.payload as ShopStockPayload);
            case 'EXAMINE_TEXT':
                return this.processExamineText(event, event.payload as ExamineTextPayload);
            case 'TICK':
                return this.processTick(event, event.payload as TickPayload);
            case 'BANK_SNAPSHOT':
                return this.processBankSnapshot(event, event.payload as BankSnapshotPayload);
            case 'STATS_SNAPSHOT':
                return this.processStatsSnapshot(event, event.payload as StatsSnapshotPayload);
            case 'QUEST_SNAPSHOT':
                return this.processQuestSnapshot(event, event.payload as QuestSnapshotPayload);
            case 'CHEST_LOOT':
                return this.processChestLoot(event, event.payload as ChestLootPayload);
            case 'COLLECTION_LOG':
                return this.processCollectionLog(event, event.payload as CollectionLogPayload);
            default:
                return [];
        }
    }

    // -------------------------------------------------------------------------
    // MENU_CLICK — update context locks; emit nothing
    // -------------------------------------------------------------------------

    private processMenuClick(event: RawEvent, p: MenuClickPayload): ClassifiedEvent[] {
        const opt = stripHtml(p.option).toLowerCase();
        const target = stripTarget(p.target);

        this.state.lastMenuOption = opt;

        // Shop lock
        if (opt.includes('trade') || opt.includes('talk-to') || opt.includes('buy') || opt.includes('sell')) {
            this.state.lockedShopTarget = target;
        }

        // Skilling lock
        if (
            opt.includes('mine') || opt.includes('chop') || opt.includes('cut') ||
            opt.includes('net') || opt.includes('lure') || opt.includes('bait') ||
            opt.includes('cage') || opt.includes('harpoon') || opt.includes('fish')
        ) {
            this.state.lockedSkillingTarget = target;
        } else if (opt === 'cast') {
            // Manual spell cast: target may be "Spell->Enemy" or just "Spell"
            if (target.includes('->')) {
                const parts = target.split('->');
                this.state.lockedManualSpell = parts[0].trim();
                this.state.lockedCombatTarget = parts[parts.length - 1].trim();
            } else {
                this.state.lockedManualSpell = target.trim();
                this.state.lockedCombatTarget = 'None';
            }
        } else if (opt.includes('attack')) {
            this.state.lockedCombatTarget = target;
            this.state.lockedManualSpell = '';
        }

        void event; // coords not needed; emits nothing
        return [];
    }

    // -------------------------------------------------------------------------
    // XP_UPDATE — compute delta and attribute source; emit XP_GAIN
    // -------------------------------------------------------------------------

    private processXpUpdate(event: RawEvent, p: XpUpdatePayload): ClassifiedEvent[] {
        const {skill, xp} = p;
        const prevXp = this.state.previousXp[skill] ?? 0;

        // First observation per skill → calibrate, don't emit
        if (prevXp === 0) {
            this.state.previousXp[skill] = xp;
            return [];
        }

        const xpDelta = xp - prevXp;
        this.state.previousXp[skill] = xp;
        if (xpDelta <= 0) return [];

        const isCombat = COMBAT_SKILLS.has(skill);
        const w = this.state.lastWidgets;
        const isQuestReward = w?.dialogue277;

        const category = isQuestReward ? 'Quests' : (isCombat ? 'Combat' : 'Skilling');

        let source: string;

        if (isQuestReward) {
            source = this.state.lastFinishedQuest || 'Quest Reward';
        } else if (isCombat) {
            source = this.state.lockedCombatTarget || 'Enemy';
            if (skill === 'Magic') {
                if (this.state.lockedManualSpell) {
                    source = this.state.lockedManualSpell;
                } else if (this.state.lastAutocastVarp > 0) {
                    source = getAutocastSpell(this.state.lastAutocastVarp);
                } else {
                    source = 'Generic Magic';
                }
            }
        } else {
            source = this.state.lockedSkillingTarget || 'Unknown';
            if (!source || source === 'Unknown' || source === '') {
                const w = this.state.lastWidgets;
                if (w?.dialogue193) {
                    source = 'XP Lamp / Reward';
                } else if (this.state.lastNetLost.length > 0) {
                    source = this.state.lastNetLost[0].item.name;
                } else if (this.state.lastNetGained.length > 0) {
                    const itemName = this.state.lastNetGained[0].item.name.toLowerCase();
                    source = itemName.includes('key') || itemName.includes('bone')
                        ? 'Activity'
                        : this.state.lastNetGained[0].item.name;
                } else {
                    source = 'Activity';
                }
            }
        }

        // Strip -> notation for safety
        if (source.includes('->')) {
            source = source.split('->').pop()!.trim();
        }

        if (!source || source === 'Unknown' || source === '') source = 'Activity';

        return [
            this.makeEvent(event, {
                eventType: 'XP_GAIN',
                category,
                source,
                target: 'None',
                skill,
                xpGained: xpDelta,
                note: `XP Gained: ${xpDelta}`,
            }),
        ];
    }

    // -------------------------------------------------------------------------
    // NPC_LOOT — emit NPC_DROP directly (no state needed)
    // -------------------------------------------------------------------------

    private processNpcLoot(event: RawEvent, p: NpcLootPayload): ClassifiedEvent[] {
        return [
            this.makeEvent(event, {
                eventType: 'NPC_DROP',
                category: 'Combat',
                source: p.npcName,
                target: 'None',
                npcLevel: p.npcLevel,
                items: p.items.map((item) => toClassifiedItem(item, item.qty)),
                note: '',
            }),
        ];
    }

    // -------------------------------------------------------------------------
    // SHOP_STOCK — resolve shop name, update state, emit SHOP_SNAPSHOT
    // -------------------------------------------------------------------------

    private processShopStock(event: RawEvent, p: ShopStockPayload): ClassifiedEvent[] {
        const shopName = resolveShopName(p.shopNameCandidates, this.state.lockedShopTarget);
        this.state.currentShopName = shopName;

        return [
            this.makeEvent(event, {
                eventType: 'SHOP_SNAPSHOT',
                category: 'Shopping',
                source: shopName,
                target: 'None',
                // Items preserve order (shop display order); basePrice is per-stack
                items: p.items.map((item) => toClassifiedItem(item, item.qty)),
                note: '',
            }),
        ];
    }

    // -------------------------------------------------------------------------
    // EXAMINE_TEXT — emit MONSTER_EXAMINE; source = locked combat target
    // -------------------------------------------------------------------------

    private processExamineText(event: RawEvent, p: ExamineTextPayload): ClassifiedEvent[] {
        const target =
            this.state.lockedCombatTarget &&
            this.state.lockedCombatTarget !== 'None' &&
            this.state.lockedCombatTarget !== 'Unknown'
                ? this.state.lockedCombatTarget
                : 'Unknown Monster';

        return [
            this.makeEvent(event, {
                eventType: 'MONSTER_EXAMINE',
                category: 'Bestiary',
                source: target,
                target: 'None',
                skill: 'Magic',
                note: p.texts.join('|'),
            }),
        ];
    }

    // -------------------------------------------------------------------------
    // QUEST_STATE — update in-progress tracking; emit QUEST_PROGRESS
    // -------------------------------------------------------------------------

    private processQuestState(event: RawEvent, p: QuestStatePayload): ClassifiedEvent[] {
        const questId = String(p.questId);
        const {questName, newState} = p;

        if (newState === 'IN_PROGRESS') {
            if (!this.state.inProgressQuests.includes(questId)) {
                this.state.inProgressQuests.push(questId);
            }
            if (this.state.questTicks[questId] == null) {
                this.state.questTicks[questId] = 0;
            }
            const ticks = this.state.questTicks[questId];
            return [
                this.makeEvent(event, {
                    eventType: 'QUEST_PROGRESS',
                    category: 'Quests',
                    source: questName,
                    target: 'IN_PROGRESS',
                    note: `In-Game Ticks: ${ticks}`,
                }),
            ];
        }

        if (newState === 'FINISHED') {
            this.state.lastFinishedQuest = questName;
            const ticks = this.state.questTicks[questId] ?? 0;
            this.state.inProgressQuests = this.state.inProgressQuests.filter((id) => id !== questId);
            return [
                this.makeEvent(event, {
                    eventType: 'QUEST_PROGRESS',
                    category: 'Quests',
                    source: questName,
                    target: 'FINISHED',
                    note: `In-Game Ticks: ${ticks}`,
                }),
            ];
        }

        // NOT_STARTED: remove from tracking, emit nothing
        this.state.inProgressQuests = this.state.inProgressQuests.filter((id) => id !== questId);
        return [];
    }

    // -------------------------------------------------------------------------
    // TICK — Net-Diff engine + QP reward + quest tick counters
    // -------------------------------------------------------------------------

    private processTick(event: RawEvent, tick: TickPayload): ClassifiedEvent[] {
        const result: ClassifiedEvent[] = [];

        // 1. Update tick counter and cached context for XP attribution
        this.state.currentTick = event.clientTick;
        this.state.lastAutocastVarp = tick.autocastVarp;
        this.state.lastWidgets = tick.widgets;

        // 2. Dialogue NPC name (widget 231,4 text)
        if (tick.dialogueNpcText) {
            this.state.lastDialogueNpc = tick.dialogueNpcText.trim();
        }

        // 3. Track dialogue-open tick (for the ≤3-tick recency window)
        const anyDialogue =
            tick.widgets.dialogue231 || tick.widgets.dialogue217 || tick.widgets.dialogue193 ||
            tick.widgets.dialogue229 || tick.widgets.dialogue277;
        if (anyDialogue) this.state.lastDialogueTick = event.clientTick;

        // 4. Increment in-progress quest tick counters
        for (const questId of this.state.inProgressQuests) {
            this.state.questTicks[questId] = (this.state.questTicks[questId] ?? 0) + 1;
        }

        // 5. Quest-point reward detection (mirrors onGameTick L208–215)
        const qpCheck = this.checkQuestPointReward(event, tick.questPoints);
        if (qpCheck) result.push(qpCheck);

        // 6. Net-Diff (only when at least one container changed this tick)
        const invChanged = tick.inv !== undefined && tick.inv !== null;
        const equipChanged = tick.equip !== undefined && tick.equip !== null;

        if (invChanged || equipChanged) {
            if (invChanged) this.state.currentInvItems = tick.inv!;
            if (equipChanged) this.state.currentEquipItems = tick.equip!;

            const newCombined = buildCombinedSnapshot(this.state.currentInvItems, this.state.currentEquipItems);

            if (Object.keys(this.state.previousCombined).length === 0) {
                // First tick after session start / login — calibrate, don't diff
                this.state.previousCombined = newCombined;
            } else {
                const {gained, lost} = diffSnapshots(newCombined, this.state.previousCombined);
                this.state.previousCombined = newCombined;
                this.state.lastNetGained = gained;
                this.state.lastNetLost = lost;

                // Suppress classification when bank / GE / deposit-box is open
                if (!tick.widgets.bank && !tick.widgets.ge && !tick.widgets.deposit) {
                    const tickHpHealed = Math.max(
                        0,
                        this.state.previousBoostedHp >= 0 ? tick.hp - this.state.previousBoostedHp : 0,
                    );

                    result.push(...this.classifyLosses(event, lost, tickHpHealed));
                    result.push(...this.classifyGains(event, gained, lost, tick));
                }
            }
        }

        // 7. Update previousBoostedHp at end of tick (CRITICAL for heal attribution)
        this.state.previousBoostedHp = tick.hp;

        // 8. Clear manual spell lock at end of tick (mirrors L157)
        this.state.lockedManualSpell = '';

        return result;
    }

    private processBankSnapshot(event: RawEvent, p: BankSnapshotPayload): ClassifiedEvent[] {
        const previous = this.state.currentBankItems;
        const previousSnapshot: CombinedSnapshot = {};
        for (const item of previous) {
            previousSnapshot[String(item.id)] = {item, qty: item.qty};
        }
        const currentSnapshot: CombinedSnapshot = {};
        for (const item of p.items) {
            currentSnapshot[String(item.id)] = {item, qty: item.qty};
        }

        const {gained, lost} = diffSnapshots(currentSnapshot, previousSnapshot);

        // Update persisted bank state
        this.state.currentBankItems = p.items;

        const results: ClassifiedEvent[] = [];

        // Always emit the snapshot record so the frontend can display current bank contents
        results.push(
            this.makeEvent(event, {
                eventType: 'BANK_SNAPSHOT',
                category: 'Bank',
                source: 'Bank',
                target: 'None',
                items: p.items.map((item) => toClassifiedItem(item, item.qty)),
                note: '',
            }),
        );

        // If there's a previous baseline and something changed, emit a diff record
        if (previous.length > 0 && (gained.length > 0 || lost.length > 0)) {
            results.push(
                this.makeEvent(event, {
                    eventType: 'BANK_DIFF',
                    category: 'Bank',
                    source: 'Bank',
                    target: 'None',
                    items: gained.map((g) => toClassifiedItem(g.item, g.qty)),
                    note: 'Lost: ' + formatLostItems(lost),
                }),
            );
        }

        return results;
    }

    // -------------------------------------------------------------------------
    // STATS_SNAPSHOT — pass-through; no session state involved
    // -------------------------------------------------------------------------

    private processStatsSnapshot(event: RawEvent, p: StatsSnapshotPayload): ClassifiedEvent[] {
        return [
            this.makeEvent(event, {
                eventType: 'STATS_SNAPSHOT',
                category: 'System',
                source: 'Player',
                target: 'None',
                stats: {
                    skillLevels: p.skillLevels,
                    totalLevel: p.totalLevel,
                    combatLevel: p.combatLevel,
                    membershipDays: p.membershipDays,
                    memberWorld: p.memberWorld,
                },
                note: '',
            }),
        ];
    }

    // -------------------------------------------------------------------------
    // QUEST_SNAPSHOT — pass-through; the authoritative quest baseline per login
    // -------------------------------------------------------------------------

    private processQuestSnapshot(event: RawEvent, p: QuestSnapshotPayload): ClassifiedEvent[] {
        return [
            this.makeEvent(event, {
                eventType: 'QUEST_SNAPSHOT',
                category: 'Quests',
                source: 'Quest Journal',
                target: 'None',
                quests: p.quests,
                questPoints: p.questPoints,
                note: '',
            }),
        ];
    }

    // -------------------------------------------------------------------------
    // CHEST_LOOT — interface-delivered rewards (chests, caskets, minigames)
    // -------------------------------------------------------------------------

    private processChestLoot(event: RawEvent, p: ChestLootPayload): ClassifiedEvent[] {
        if (p.items && p.items.length > 0) {
            // Reward container contents shipped directly — classify immediately.
            return [
                this.makeEvent(event, {
                    eventType: 'CHEST_LOOT',
                    category: chestCategory(p.source),
                    source: p.source,
                    target: 'None',
                    items: p.items.map((item) => toClassifiedItem(item, item.qty)),
                    note: '',
                }),
            ];
        }

        // Items-empty marker: attribute upcoming inventory gains (net-diff) to
        // this source. Each repeated loot message refreshes the window, which
        // covers multi-tick crate openings.
        this.state.pendingChestSource = p.source;
        this.state.pendingChestTick = event.clientTick;
        return [];
    }

    // -------------------------------------------------------------------------
    // COLLECTION_LOG — pass-through; capture-only (no frontend consumer yet).
    // Item name lives in `note` so item-page queries never pick it up as loot.
    // -------------------------------------------------------------------------

    private processCollectionLog(event: RawEvent, p: CollectionLogPayload): ClassifiedEvent[] {
        return [
            this.makeEvent(event, {
                eventType: 'COLLECTION_LOG',
                category: 'System',
                source: 'Collection Log',
                target: 'None',
                note: p.itemName,
            }),
        ];
    }

    // -------------------------------------------------------------------------
    // Net-Diff sub-classifiers
    // -------------------------------------------------------------------------

    private classifyLosses(
        event: RawEvent,
        lost: Array<{ item: RawItem; qty: number }>,
        tickHpHealed: number,
    ): ClassifiedEvent[] {
        const result: ClassifiedEvent[] = [];
        let healLogged = false;

        for (const {item, qty} of lost) {
            if (isConsumable(item)) {
                const assignedHeal = healLogged ? 0 : tickHpHealed;
                healLogged = true;
                result.push(
                    this.makeEvent(event, {
                        eventType: 'CONSUME',
                        category: 'Combat',
                        source: 'Activity',
                        target: 'None',
                        skill: 'Hitpoints',
                        hpHealed: assignedHeal,
                        items: [toClassifiedItem(item, qty)],
                        note: '',
                    }),
                );
            } else if (isRune(item.name)) {
                const target =
                    this.state.lockedCombatTarget && this.state.lockedCombatTarget !== 'None'
                        ? this.state.lockedCombatTarget
                        : 'Enemy';
                result.push(
                    this.makeEvent(event, {
                        eventType: 'SPELL_CAST',
                        category: 'Combat',
                        source: target,
                        target: 'None',
                        skill: 'Magic',
                        items: [toClassifiedItem(item, qty)],
                        note: '',
                    }),
                );
            } else if (isAmmo(item.name)) {
                const target =
                    this.state.lockedCombatTarget && this.state.lockedCombatTarget !== 'None'
                        ? this.state.lockedCombatTarget
                        : 'Enemy';
                result.push(
                    this.makeEvent(event, {
                        eventType: 'RANGED_FIRE',
                        category: 'Combat',
                        source: target,
                        target: 'None',
                        skill: 'Ranged',
                        items: [toClassifiedItem(item, qty)],
                        note: '',
                    }),
                );
            }
        }

        return result;
    }

    private classifyGains(
        event: RawEvent,
        gained: Array<{ item: RawItem; qty: number }>,
        lost: Array<{ item: RawItem; qty: number }>,
        tick: TickPayload,
    ): ClassifiedEvent[] {
        if (gained.length === 0) return [];

        const shopOpen = tick.widgets.shop;
        const wasDialogueRecently = event.clientTick - this.state.lastDialogueTick <= 3;
        const opt = this.state.lastMenuOption;

        // Most specific first: an active chest-loot marker (empty-items
        // CHEST_LOOT from Wintertodt/Tempoross/GOTR) claims these gains.
        if (this.state.pendingChestSource
            && event.clientTick - this.state.pendingChestTick <= CHEST_MARKER_WINDOW_TICKS) {
            return [
                this.makeEvent(event, {
                    eventType: 'CHEST_LOOT',
                    category: chestCategory(this.state.pendingChestSource),
                    source: this.state.pendingChestSource,
                    target: 'None',
                    items: gained.map((g) => toClassifiedItem(g.item, g.qty)),
                    note: '',
                }),
            ];
        }

        if (shopOpen) {
            return [
                this.makeEvent(event, {
                    eventType: 'SHOP_TRANSACTION',
                    category: 'Shopping',
                    source: this.state.currentShopName,
                    target: 'None',
                    items: gained.map((g) => toClassifiedItem(g.item, g.qty)),
                    note: 'Spent: ' + formatLostItems(lost),
                }),
            ];
        }

        if (wasDialogueRecently) {
            const isQuestReward = tick.widgets.dialogue277;
            const category = isQuestReward ? 'Quests' : 'NPC Interaction';
            const source = isQuestReward
                ? this.state.lastFinishedQuest || 'Quest Reward'
                : this.state.lastDialogueNpc;
            return [
                this.makeEvent(event, {
                    eventType: 'DIALOGUE_REWARD',
                    category,
                    source,
                    target: 'None',
                    items: gained.map((g) => toClassifiedItem(g.item, g.qty)),
                    note: 'Spent: ' + formatLostItems(lost),
                }),
            ];
        }

        if (opt === 'take') {
            return [
                this.makeEvent(event, {
                    eventType: 'TAKE',
                    category: 'Misc',
                    source: 'Pickup',
                    target: 'None',
                    items: gained.map((g) => toClassifiedItem(g.item, g.qty)),
                    note: '',
                }),
            ];
        }

        return [];
    }

    // -------------------------------------------------------------------------
    // Quest-point reward (embedded in TICK, mirrors onGameTick L208–215)
    // -------------------------------------------------------------------------

    private checkQuestPointReward(event: RawEvent, currentQp: number): ClassifiedEvent | null {
        if (this.state.previousQuestPoints === -1) {
            // First observation — calibrate
            this.state.previousQuestPoints = currentQp;
            return null;
        }

        if (currentQp > this.state.previousQuestPoints) {
            const qpGained = currentQp - this.state.previousQuestPoints;
            this.state.previousQuestPoints = currentQp;
            return this.makeEvent(event, {
                eventType: 'DIALOGUE_REWARD',
                category: 'Quests',
                source: this.state.lastFinishedQuest || 'Quest Reward',
                target: 'None',
                items: [{id: -1, name: 'Quest point', qty: qpGained, GE: 0, HA: 0, basePrice: 0}],
                note: '',
            });
        }

        if (currentQp < this.state.previousQuestPoints) {
            // Handles login reset / mismatches
            this.state.previousQuestPoints = currentQp;
        }

        return null;
    }

    // -------------------------------------------------------------------------
    // Helper — stamp coords + sessionId onto a partial classified event
    // -------------------------------------------------------------------------

    private makeEvent(
        rawEvent: RawEvent,
        fields: Partial<ClassifiedEvent> & { eventType: string },
    ): ClassifiedEvent {
        return {
            sessionId: rawEvent.sessionId,
            timestamp: rawEvent.timestamp,
            x: rawEvent.x,
            y: rawEvent.y,
            plane: rawEvent.plane,
            regionId: rawEvent.regionId,
            target: 'None',
            source: '',
            category: '',
            note: '',
            ...fields,
        };
    }
}
