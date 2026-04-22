export function categorizeItem(name: string, count: number = 0, totalKills: number = 0): string {
    if (totalKills > 0) {
        if (count === totalKills || /\b(bones|ashes)\b/i.test(name)) {
            return "100%";
        }
    }

    if (name === "Coins") return "Currencies";

    if (/\b(bones|ashes)\b/i.test(name)) return "Bones & Ashes";

    if (/\b(clue scroll|ensouled|totem|champion scroll|key|long bone|curved bone|shard|brimstone|larran's)\b/i.test(name)) return "Tertiary & Keys";

    if (/\b(uncut|diamond|ruby|emerald|sapphire|loop half|tooth half|dragon spear|shield left half|nature talisman|rune javelin|rune spear)\b/i.test(name)) return "Rare Drop Table & Gems";

    if (/\b(grimy|seed|spore)\b/i.test(name)) return /\b(grimy)\b/i.test(name) ? "Herbs" : "Seeds";

    const isRune = /\b(air|water|earth|fire|mind|body|cosmic|chaos|nature|law|death|blood|soul|astral|wrath|mud|lava|steam|dust|smoke|mist)\s+rune\b/i.test(name);
    const isAmmo = /\b(arrows?|bolts?|darts?|javelins?)\b/i.test(name);
    if (isRune || isAmmo) return "Runes & Ammunition";

    const isEquipment = /\b(\w*sword|scimitar|dagger|mace|axe|spear|\w*bow|helm|helmet|platebody|platelegs|plateskirt|\w*shield|chainbody|mail|hide|staff|wand|boots|gloves|chaps|vamb|leather|robes?|top|bottom|halberd|battleaxe|2h|warhammer|sq|kite\w*|defender)\b/i.test(name);
    if (isEquipment) return "Weapons & Armour";

    const isFood = /\b(raw|tuna|trout|salmon|shrimps|beer|cider|ale|kebab|anchovies)\b/i.test(name);
    if (isFood) return "Food";

    const isBurntFood = /\b(burnt)\b/i.test(name);
    if (isBurntFood) return "Burnt Food";

    const isSkillingEquip = /\b(\w*fishing rod|tinderbox|forestry kit|hammer|\w*fishing net)\b/i.test(name);
    if (isSkillingEquip) return "Skilling Equipment";

    const isTalisman = /\b(talisman)\b/i.test(name);
    if (isTalisman) return "Talismans";

    const isResource = /\b(logs?|ore|coal|seaweed|oyster|cowhide)\b/i.test(name);
    if (isResource) return "Raw Resources";

    return "Other Loot";
}

// Updated Order to include "100%" at the very top for the Monster page
export const CATEGORY_ORDER = [
    "100%", "Currencies", "Weapons & Armour", "Runes & Ammunition", "Raw Resources",
    "Talismans", "Food", "Bones & Ashes", "Herbs", "Seeds", "Rare Drop Table & Gems",
    "Tertiary & Keys", "Skilling Equipment", "Burnt Food", "Other Loot"
];