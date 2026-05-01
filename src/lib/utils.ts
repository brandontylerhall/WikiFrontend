// Updated Order to include "100%" at the top, and tweaked Food to include Potions
export const CATEGORY_ORDER = [
    "100%", "Currencies", "Weapons & Armour", "Runes & Ammunition", "Raw Resources",
    "Talismans", "Food & Potions", "Bones & Ashes", "Herbs", "Seeds", "Rare Drop Table & Gems",
    "Skilling Equipment", "Burnt Food", "Tertiary", "Other Loot"
];

export function categorizeItem(
    name: string,
    count: number = 0,
    totalKills: number = 0,
    sourceCategory: string = "Combat" // <--- New parameter to tell it where we are!
): string {
    const lowerName = name.toLowerCase();

    // --- 1. CONTEXTUAL OVERRIDES ---
    if (lowerName.includes("barronite shard")) {
        // If it was mined, it's a resource. If it was dropped by a Golem, it's currency!
        return sourceCategory === "Skilling" ? "Raw Resources" : "Currencies";
    }

    // --- 2. 100% DROPS ---
    if (totalKills > 0) {
        if (count === totalKills) {
            return "100%";
        }
    }

    // --- 3. EXPANDED REGEX FILTERS ---
    // Currencies
    if (lowerName === "coins" || /\b(tokkul|numulite|platinum token|mark of grace|stardust|blood money)\b/i.test(lowerName)) return "Currencies";

    // Bones & Ashes (Fallback if not a 100% drop)
    if (/\b(bones|ashes)\b/i.test(name) && !lowerName.includes("long bone") && !lowerName.includes("curved bone")) return "Bones & Ashes";

    // Tertiary & Keys
    if (/\b(clue|ensouled|totem|champion scroll|key|long bone|curved bone|shard|brimstone|larran's|casket|mossy|giant|hespori|scroll)\b/i.test(name)) return "Tertiary";

    // Rare Drop Table & Gems
    if (/\b(uncut|diamond|ruby|emerald|sapphire|dragonstone|onyx|loop half|tooth half|dragon spear|shield left half|nature talisman|rune javelin|rune spear)\b/i.test(name)) return "Rare Drop Table & Gems";

    // Herbs & Seeds
    if (/\b(grimy|herb|weed)\b/i.test(name)) return "Herbs";
    if (/\b(seed|spore|sapling)\b/i.test(name)) return "Seeds";

    // Runes & Ammunition
    const isRune = /\b(air|water|earth|fire|mind|body|cosmic|chaos|nature|law|death|blood|soul|astral|wrath|mud|lava|steam|dust|smoke|mist)\s+rune\b/i.test(name);
    const isAmmo = /\b(arrows?|bolts?|darts?|javelins?|knives|knife|thrownaxes?)\b/i.test(name);
    if (isRune || isAmmo) return "Runes & Ammunition";

    // Weapons & Armour
    const isEquipment = /\b(\w*sword|scimitar|dagger|mace|axe|spear|\w*bow|helm|helmet|platebody|platelegs|plateskirt|\w*shield|chainbody|mail|hide|staff|wand|boots|gloves|chaps|vamb|leather|robes?|top|bottom|halberd|battleaxe|2h|warhammer|sq|kite\w*|defender|mystic|d'hide|dragonhide|tiara)\b/i.test(name);
    if (isEquipment) return "Weapons & Armour";

    // Food & Potions
    const isFood = /\b(raw|tuna|trout|salmon|shrimps|beer|cider|ale|kebab|anchovies|potion|brew|shark|manta ray|karambwan|anglerfish|potato|pie|stew|cake)\b/i.test(name);
    if (isFood && !lowerName.includes("burnt")) return "Food & Potions";

    const isBurntFood = /\b(burnt)\b/i.test(name);
    if (isBurntFood) return "Burnt Food";

    // Skilling Equipment
    const isSkillingEquip = /\b(\w*fishing rod|tinderbox|forestry kit|hammer|\w*fishing net|pickaxe|harpoon|spade|mould|mold|chisel)\b/i.test(name);
    if (isSkillingEquip) return "Skilling Equipment";

    // Talismans
    const isTalisman = /\b(talisman)\b/i.test(name);
    if (isTalisman) return "Talismans";

    // Raw Resources
    const isResource = /\b(logs?|ore|coal|seaweed|oyster|cowhide|bar|clay|essence|flax|sandstone|granite|amethyst|salt|plank)\b/i.test(name);
    if (isResource) return "Raw Resources";

    return "Other Loot";
}