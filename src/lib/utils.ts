// --- MAIN CATEGORIES ---
export const CATEGORY_ORDER = [
    "100%", "Currencies", "Weapons & Armour", "Runes & Ammunition", "Raw Resources",
    "Talismans", "Food & Potions", "Bones & Ashes", "Herbs", "Seeds", "Rare Drop Table & Gems",
    "Skilling Equipment", "Burnt Food", "Tertiary", "Other Loot"
];

// --- BANK SUB-CATEGORIES ---
export const SUB_CATEGORY_ORDER = [
    "Runes", "Ammunition",
    "Melee Weapons", "Melee Armour",
    "Ranged Weapons", "Ranged Armour",
    "Magic Weapons", "Magic Armour",
    "Capes", "Jewellery & Accessories",
    "Mining & Smithing", "Woodcutting & Firemaking", "Crafting", "Fletching", "Runecrafting", "General Resources",
    "Cooked Food", "Cooking Materials", "Potions", "Burnt Food"
];

// --- REGEX DICTIONARIES ---
const AMMO_REGEX = /\b(arrows?|bolt|dart|javelin|knife|thrownaxe)\b/;
const RAW_FOOD_REGEX = /\b(raw)\b/;
const POTION_REGEX = /\b(potion|brew)\b/;
const BURNT_FOOD_REGEX = /\b(burnt)\b/;
const MINING_GEAR_REGEX = /\b(pickaxe)\b/;
const WC_GEAR_REGEX = /\b(axe|hatchet|tinderbox|forestry)\b/;
const FISHING_GEAR_REGEX = /\b(fishing rod|fishing net|harpoon|lobster pot)\b/;
const CRAFTING_GEAR_REGEX = /\b(hammer|chisel|mould|mold|needle)\b/;
const FARMING_GEAR_REGEX = /\b(spade|rake|dibber|secateurs|trowel)\b/;
const HUNTER_GEAR_REGEX = /\b(box trap|snare|bird snare)\b/;
const MINING_RES_REGEX = /\b(ore|coal|bar|clay|sandstone|granite|amethyst|salt)\b/;
const WC_RES_REGEX = /\b(log|logs)\b/;
const CRAFTING_RES_REGEX = /\b(hide|cowhide|leather|flax|seaweed|oyster|glass|molten|wool)\b/;
const RC_RES_REGEX = /\b(essence|core)\b/;
const FLETCH_RES_REGEX = /\b(feather|shaft|arrowtips?)\b/;
const CAPE_REGEX = /\b(cape|cloak|accumulator|attractor)\b/;
const MAGIC_WEAPON_ARMOUR_REGEX = /\b(staff|wand|mystic|robe|ahrim|infinity)\b/;
const MAGIC_WEAPON_REGEX = /\b(staff|wand)\b/;
const RANGED_WEAPON_ARMOUR_REGEX = /\b(\w*bow|studded|dart|knife|thrownaxe|chaps|vamb\w*|d'hide|dragonhide|karil|pegasian|coif)\b/;
const RANGED_WEAPON_REGEX = /\b(\w*bow|dart|knife|thrownaxe)\b/;
const MELEE_WEAPON_REGEX = /\b(\w*sword|scimitar|dagger|mace|spear|halberd|battleaxe|warhammer|whip|fang|rapier|defender)\b/;
const MELEE_ARMOUR_REGEX = /\b(helm|helmet|platebody|platelegs|plateskirt|\w*shield|chainbody|boots|gloves|sq|kite)\b/;
const JEWELLERY_REGEX = /\b(ring|amulet|necklace|bracelet)\b/;

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

    if (lowerName.includes("barronite shard")) {
        return sourceCategory === "Skilling" ? "Raw Resources" : "Currencies";
    }

    if (totalKills > 0 && count === totalKills) return "100%";

    if (lowerName === "coins" || /\b(tokkul|numulite|platinum token|mark of grace|stardust|blood money|barronite shards?|bone fragments?)\b/i.test(lowerName)) return "Currencies";
    if (/\b(bones|ashes)\b/i.test(name) && !lowerName.includes("long bone") && !lowerName.includes("curved bone")) return "Bones & Ashes";
    if (/\b(clue|ensouled|totem|champion scroll|key|long bone|curved bone|shard|brimstone|larran's|casket|mossy|giant|hespori|scroll)\b/i.test(name)) return "Tertiary";
    if (/\b(uncut|diamond|ruby|emerald|sapphire|dragonstone|onyx|loop half|tooth half|dragon spear|shield left half|nature talisman|rune javelin|rune spear)\b/i.test(name)) return "Rare Drop Table & Gems";
    if (/\b(grimy|herb|weed)\b/i.test(name)) return "Herbs";
    if (/\b(seed|spore|sapling)\b/i.test(name)) return "Seeds";

    const isRune = /\b(air|water|earth|fire|mind|body|cosmic|chaos|nature|law|death|blood|soul|astral|wrath|mud|lava|steam|dust|smoke|mist)\s+rune\b/i.test(name);
    const isAmmo = /\b(arrows?|bolts?|darts?|javelins?|knives|knife|thrownaxes?)\b/i.test(name);
    if (isRune || isAmmo) return "Runes & Ammunition";

    const isEquipment = /\b(ring|necklace|bracelet|amulet|studded|cape|\w*sword|scimitar|dagger|mace|axe|spear|\w*bow|helm|helmet|platebody|platelegs|plateskirt|\w*shield|chainbody|mail|hide|staff|wand|boots|gloves|chaps|vamb|leather|robes?|top|bottom|halberd|battleaxe|2h|warhammer|sq|kite\w*|defender|mystic|d'hide|dragonhide|tiara)\b/i.test(name);
    if (isEquipment) return "Weapons & Armour";

    const isFood = /\b(raw|tuna|trout|salmon|shrimps|beer|cider|ale|kebab|anchovies|potion|brew|shark|manta ray|karambwan|anglerfish|potato|pie|stew|cake|lobster|pike|bread)\b/i.test(name);
    if (isFood && !lowerName.includes("burnt")) return "Food & Potions";

    if (/\b(burnt)\b/i.test(name)) return "Burnt Food";

    const isSkillingEquip = /\b(\w*fishing rod|tinderbox|forestry kit|hammer|\w*fishing net|pickaxe|harpoon|spade|mould|mold|chisel|needle|thread|bucket|feather|apron|shears|bait)\b/i.test(name);
    if (isSkillingEquip) return "Skilling Equipment";

    if (/\b(talisman)\b/i.test(name)) return "Talismans";

    const isResource = /\b(core|logs?|ore|coal|seaweed|oyster|cowhide|bar|clay|essence|flax|sandstone|granite|amethyst|salt|plank)\b/i.test(name);
    if (isResource) return "Raw Resources";

    return "Other Loot";
}

export function getBankSubCategory(name: string, mainCategory: string): string {
    const lowerName = name.toLowerCase();

    if (mainCategory === "Runes & Ammunition") {
        if (AMMO_REGEX.test(lowerName)) return "Ammunition";
        return "Runes";
    }
    if (mainCategory === "Food & Potions") {
        if (RAW_FOOD_REGEX.test(lowerName)) return "Cooking Materials";
        if (POTION_REGEX.test(lowerName)) return "Potions";
        if (BURNT_FOOD_REGEX.test(lowerName)) return "Burnt Food";
        return "Cooked Food";
    }
    if (mainCategory === "Skilling Equipment") {
        if (MINING_GEAR_REGEX.test(lowerName)) return "Mining";
        if (WC_GEAR_REGEX.test(lowerName)) return "Woodcutting & Firemaking";
        if (FISHING_GEAR_REGEX.test(lowerName)) return "Fishing";
        if (CRAFTING_GEAR_REGEX.test(lowerName)) return "Crafting & Smithing";
        if (FARMING_GEAR_REGEX.test(lowerName)) return "Farming";
        if (HUNTER_GEAR_REGEX.test(lowerName)) return "Hunter";
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
    if (mainCategory === "Weapons & Armour") {
        if (CAPE_REGEX.test(lowerName)) return "Capes";
        if (MAGIC_WEAPON_ARMOUR_REGEX.test(lowerName)) {
            if (MAGIC_WEAPON_REGEX.test(lowerName)) return "Magic Weapons";
            return "Magic Armour";
        }
        if (RANGED_WEAPON_ARMOUR_REGEX.test(lowerName)) {
            if (RANGED_WEAPON_REGEX.test(lowerName)) return "Ranged Weapons";
            return "Ranged Armour";
        }
        if (MELEE_WEAPON_REGEX.test(lowerName)) return "Melee Weapons";
        if (MELEE_ARMOUR_REGEX.test(lowerName)) return "Melee Armour";
        if (JEWELLERY_REGEX.test(lowerName)) return "Jewellery & Accessories";
        return "Armour";
    }

    return mainCategory;
}