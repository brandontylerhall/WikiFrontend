// --- MAIN CATEGORIES ---
export const CATEGORY_ORDER = [
    "100%", "Currencies", "Weapons & Armour", "Runes & Ammunition", "Raw Resources",
    "Talismans", "Food & Potions", "Herbs & Secondaries", "Bones & Ashes", "Seeds", "Rare Drop Table & Gems",
    "Skilling Equipment", "Item Pieces", "Random Events & Cosmetics", "Tertiary", "Other Loot"
];

// --- BANK SUB-CATEGORIES ---
export const SUB_CATEGORY_ORDER = [
    "Runes", "Ammunition",
    "Melee Weapons", "Melee Armour",
    "Ranged Weapons", "Ranged Armour",
    "Magic Weapons", "Magic Armour",
    "Capes", "Jewellery & Accessories", "Navigation & Teleportation",
    "Mining & Smithing", "Woodcutting & Firemaking", "Fishing", "Crafting & Smithing", "Farming", "Hunter", "General Equipment",
    "Raw Food", "Cooked Food", "Drinks", "Potions", "Burnt Food", "Gems", "Herblore Secondaries",
    "Item Pieces",
    "Zombie Outfit", "Mime Outfit", "Frog Outfit", "Lederhosen Outfit", "Camo Outfit", "Beekeeper Outfit", "Sandwich Lady Outfit", "Miscellaneous Cosmetics"
];

// --- REGEX DICTIONARIES ---
const AMMO_REGEX = /\b(arrows?|bolts?|dart|javelin|thrownaxe)\b/;
const RAW_FOOD_REGEX = /\b(raw)\b/;
const DRINK_REGEX = /\b(beer|ale|cider|mind bomb|stout)\b/;
const POTION_REGEX = /\b(potion|brew)\b/;

// Gear Regexes
const MINING_GEAR_REGEX = /\b(pickaxe)\b/;
const WC_GEAR_REGEX = /\b(axe|hatchet|tinderbox|forestry)\b/;
const FISHING_GEAR_REGEX = /\b(fishing rod|fishing net|harpoon|lobster pot)\b/;
const CRAFTING_GEAR_REGEX = /\b(hammer|chisel|mould|mold|needle|thread|shears|apron)\b/;
const FARMING_GEAR_REGEX = /\b(spade|rake|dibber|secateurs|trowel)\b/;
const HUNTER_GEAR_REGEX = /\b(box trap|snare|bird snare)\b/;

// Resource Regexes
const MINING_RES_REGEX = /\b(ore|coal|bar|clay|sandstone|granite|amethyst|salt|barronite deposit)\b/;
const WC_RES_REGEX = /\b(log|logs)\b/;
const CRAFTING_RES_REGEX = /\b(hide|cowhide|leather|flax|seaweed|oyster|glass|molten|wool)\b/;
const RC_RES_REGEX = /\b(essence|core)\b/;
const FLETCH_RES_REGEX = /\b(feather|shaft|arrowtips?)\b/;

// Combat Regexes
const CAPE_REGEX = /\b(cape|cloak|accumulator|attractor)\b/;
const MAGIC_WEAPON_ARMOUR_REGEX = /\b(staff|wand|mystic|robe|ahrim|infinity|wizard|sceptre)\b/;
const MAGIC_WEAPON_REGEX = /\b(staff|wand|sceptre|crozier)\b/;
const RANGED_WEAPON_ARMOUR_REGEX = /\b(\w*bow|studded|dart|knife|thrownaxe|chaps|vamb\w*|d'hide|dragonhide|karil|pegasian|coif)\b/;
const RANGED_WEAPON_REGEX = /\b(\w*bow|dart|knife|thrownaxe)\b/;
const MELEE_WEAPON_REGEX = /\b(\w*sword|scimitar|dagger|mace|spear|halberd|battleaxe|warhammer|whip|fang|rapier|defender|silverlight|darklight|arclight)\b/;
const MELEE_ARMOUR_REGEX = /\b(helm|helmet|platebody|platelegs|plateskirt|\w*shield|chainbody|boots|gloves|sq|kite)\b/;
const JEWELLERY_REGEX = /\b(ring|amulet|necklace|bracelet|tiara)\b/;

// Secondaries & Cosmetics
const SECONDARY_REGEX = /\b(limpwurt|berries|unicorn horn|eye of newt|dragon scale|snape grass|crushed nest|chocolate dust)\b/;
const RANDOM_EVENT_REGEX = /\b(beekeeper's|camo|lederhosen|zombie|frog|royal|mime|baguette|triangle sandwich|sandwich lady)\b/;
const ITEM_PIECES_REGEX = /\b(left skull half|right skull half|top of sceptre|bottom of sceptre|shield left half|barronite guard|barronite head|blade|hilt)\b/;

export const TOOL_HACK_REGEX = /\b(axe|hatchet|pickaxe|tinderbox|harpoon|fishing rod|fishing net|hammer|chisel|spade)\b/;
export const COMBAT_AXE_HACK_REGEX = /\b(battleaxe|thrownaxe)\b/;

// --- CATEGORIZATION LOGIC ---
export function categorizeItem(
    name: string,
    count: number = 0,
    totalKills: number = 0,
    sourceCategory: string = "Combat"
): string {
    const lowerName = name.toLowerCase();

    // 1. HARD EXPLICIT INTERCEPTS
    if (lowerName === "bank filler") return "Hidden";
    if (lowerName === "knife") return "Skilling Equipment";
    if (/\b(lobster pot|chef's hat)\b/.test(lowerName)) return "Skilling Equipment";
    if (/\b(chronicle|skull sceptre)\b/.test(lowerName)) return "Weapons & Armour";

    if (totalKills > 0 && count === totalKills) return "100%";

    // 2. CURRENCIES
    if (lowerName === "coins" || /\b(tokkul|numulite|platinum token|mark of grace|stardust|blood money|barronite shards?|bone fragments?)\b/.test(lowerName)) return "Currencies";

    // 3. BONES & ASHES
    if (/\b(bones|ashes)\b/.test(lowerName) && !lowerName.includes("long bone") && !lowerName.includes("curved bone")) return "Bones & Ashes";

    // 4. ITEM PIECES
    if (ITEM_PIECES_REGEX.test(lowerName)) return "Item Pieces";

    // 5. TERTIARY & CLUES
    if (/\b(clue|ensouled|totem|champion scroll|key|long bone|curved bone|shard|brimstone|larran's|casket|mossy|giant|hespori|scroll)\b/.test(lowerName)) return "Tertiary";

    // 6. RARE DROP TABLE & GEMS
    if (/\b(uncut|diamond|ruby|emerald|sapphire|dragonstone|onyx|loop half|tooth half|dragon spear|nature talisman|rune javelin|rune spear)\b/.test(lowerName)) return "Rare Drop Table & Gems";

    // 7. HERBS & SECONDARIES
    if (/\b(grimy|herb|weed)\b/.test(lowerName) || SECONDARY_REGEX.test(lowerName)) return "Herbs & Secondaries";
    if (/\b(seed|spore|sapling)\b/.test(lowerName)) return "Seeds";

    // 8. RUNES & AMMO
    const isRune = /\b(air|water|earth|fire|mind|body|cosmic|chaos|nature|law|death|blood|soul|astral|wrath|mud|lava|steam|dust|smoke|mist)\s+rune\b/.test(lowerName);
    const isAmmo = /\b(arrows?|bolts?|darts?|javelins?|thrownaxes?)\b/.test(lowerName) || (lowerName.includes("knife") && lowerName !== "knife");
    if (isRune || isAmmo) return "Runes & Ammunition";

    // 9. COSMETICS / RANDOM EVENTS
    if (RANDOM_EVENT_REGEX.test(lowerName)) return "Random Events & Cosmetics";

    // 10. WEAPONS & ARMOUR
    const isEquipment = /\b(ring|necklace|bracelet|amulet|studded|cape|\w*sword|scimitar|dagger|mace|axe|spear|\w*bow|helm|helmet|platebody|platelegs|plateskirt|\w*shield|chainbody|mail|hide|staff|wand|boots|gloves|chaps|vamb|leather|robes?|top|bottom|halberd|battleaxe|2h|warhammer|sq|kite\w*|defender|mystic|d'hide|dragonhide|tiara|silverlight|darklight|arclight|wizard|sceptre)\b/.test(lowerName);
    if (isEquipment) return "Weapons & Armour";

    // 11. FOOD & POTIONS
    const isFood = /\b(raw|tuna|trout|salmon|shrimps|beer|cider|ale|kebab|anchovies|potion|brew|shark|manta ray|karambwan|anglerfish|potato|pie|stew|cake|lobster|pike|bread|meat)\b/.test(lowerName);
    if (isFood || lowerName.includes("burnt")) return "Food & Potions";

    // 12. SKILLING EQUIPMENT
    const isSkillingEquip = /\b(\w*fishing rod|tinderbox|forestry kit|hammer|\w*fishing net|pickaxe|harpoon|spade|mould|mold|chisel|needle|thread|shears|bucket|feather|apron|bait)\b/.test(lowerName);
    if (isSkillingEquip) return "Skilling Equipment";

    // 13. TALISMANS
    if (/\b(talisman)\b/.test(lowerName)) return "Talismans";

    // 14. RAW RESOURCES
    const isResource = /\b(core|logs?|ore|coal|seaweed|oyster|cowhide|bar|clay|essence|flax|sandstone|granite|amethyst|salt|plank|barronite deposit)\b/.test(lowerName);
    if (isResource) return "Raw Resources";

    return "Other Loot";
}

export function getBankSubCategory(name: string, mainCategory: string): string {
    const lowerName = name.toLowerCase();

    if (mainCategory === "Hidden") return "Hidden";

    if (mainCategory === "Runes & Ammunition") {
        if (AMMO_REGEX.test(lowerName) || (lowerName.includes("knife") && lowerName !== "knife")) return "Ammunition";
        return "Runes";
    }
    if (mainCategory === "Food & Potions") {
        if (RAW_FOOD_REGEX.test(lowerName)) return "Raw Food";
        if (POTION_REGEX.test(lowerName)) return "Potions";
        if (DRINK_REGEX.test(lowerName)) return "Drinks";
        if (/\b(burnt)\b/.test(lowerName)) return "Burnt Food";
        return "Cooked Food";
    }
    if (mainCategory === "Herbs & Secondaries") {
        if (SECONDARY_REGEX.test(lowerName)) return "Herblore Secondaries";
        return "Herbs";
    }
    if (mainCategory === "Rare Drop Table & Gems") {
        if (/\b(uncut|diamond|ruby|emerald|sapphire|dragonstone|onyx)\b/.test(lowerName)) return "Gems";
        return "Rare Drop Table";
    }
    if (mainCategory === "Skilling Equipment") {
        if (MINING_GEAR_REGEX.test(lowerName)) return "Mining";
        if (WC_GEAR_REGEX.test(lowerName)) return "Woodcutting & Firemaking";
        if (FISHING_GEAR_REGEX.test(lowerName)) return "Fishing";
        if (CRAFTING_GEAR_REGEX.test(lowerName)) return "Crafting & Smithing";
        if (FARMING_GEAR_REGEX.test(lowerName)) return "Farming";
        if (HUNTER_GEAR_REGEX.test(lowerName)) return "Hunter";
        if (/\b(chef's hat|apron|shears|thread)\b/.test(lowerName)) return "Crafting & Smithing";
        return "General Equipment";
    }
    if (mainCategory === "Raw Resources") {
        if (MINING_RES_REGEX.test(lowerName)) return "Mining & Smithing";
        if (WC_RES_REGEX.test(lowerName)) return "Woodcutting & Firemaking";
        if (CRAFTING_RES_REGEX.test(lowerName)) return "Crafting";
        if (RC_RES_REGEX.test(lowerName)) return "Runecrafting";
        if (FLETCH_RES_REGEX.test(lowerName)) return "Fletching";
        return "General Resources";
    }
    if (mainCategory === "Random Events & Cosmetics") {
        if (lowerName.includes("zombie")) return "Zombie Outfit";
        if (lowerName.includes("mime")) return "Mime Outfit";
        if (lowerName.includes("frog") || lowerName.includes("royal")) return "Frog Outfit";
        if (lowerName.includes("lederhosen")) return "Lederhosen Outfit";
        if (lowerName.includes("camo")) return "Camo Outfit";
        if (lowerName.includes("beekeeper")) return "Beekeeper Outfit";
        if (lowerName.includes("sandwich") || lowerName.includes("baguette")) return "Sandwich Lady Outfit";
        return "Miscellaneous Cosmetics";
    }
    if (mainCategory === "Weapons & Armour") {
        if (/\b(chronicle)\b/.test(lowerName)) return "Navigation & Teleportation";
        // JEWELRY INTERCEPTED FIRST
        if (JEWELLERY_REGEX.test(lowerName)) return "Jewellery & Accessories";
        if (CAPE_REGEX.test(lowerName)) return "Capes";

        if (MAGIC_WEAPON_ARMOUR_REGEX.test(lowerName)) {
            if (MAGIC_WEAPON_REGEX.test(lowerName)) return "Magic Weapons";
            return "Magic Armour";
        }
        if (RANGED_WEAPON_ARMOUR_REGEX.test(lowerName)) {
            if (RANGED_WEAPON_REGEX.test(lowerName) || (lowerName.includes("knife") && lowerName !== "knife")) return "Ranged Weapons";
            return "Ranged Armour";
        }
        if (MELEE_WEAPON_REGEX.test(lowerName)) return "Melee Weapons";
        if (MELEE_ARMOUR_REGEX.test(lowerName)) return "Melee Armour";
        return "Armour";
    }

    return mainCategory;
}