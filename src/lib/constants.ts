export const LEGACY_ID_MAP: Record<number, string> = {
    1511: "Logs", 1521: "Oak logs", 1519: "Willow logs", 1515: "Yew logs", 1513: "Magic logs",
    436: "Copper ore", 438: "Tin ore", 440: "Iron ore", 453: "Coal",
    317: "Raw shrimps", 321: "Raw anchovies", 327: "Raw sardine", 345: "Raw herring",
    335: "Raw trout", 331: "Raw salmon", 349: "Raw pike", 359: "Raw tuna",
    371: "Raw swordfish", 377: "Raw lobster",
    995: "Coins", 592: "Ashes", 526: "Bones", 532: "Big bones", 554: "Fire rune",
    562: "Chaos rune", 560: "Death rune", 1333: "Rune scimitar", 1163: "Rune full helm",
    1061: "Leather boots", 333: "Trout", 9005: "Fancy boots", 9006: "Fighter boots",
    314: "Feather"
};

export const XP_MAP: Record<string, Record<string, number>> = {
    "Woodcutting": {
        "Logs": 25, "Oak logs": 37.5, "Willow logs": 67.5, "Teak logs": 85,
        "Maple logs": 100, "Mahogany logs": 125, "Yew logs": 175, "Magic logs": 250,
        "Redwood logs": 380
    },
    "Mining": {
        "Clay": 5, "Rune essence": 5, "Pure essence": 5, "Copper ore": 17.5,
        "Tin ore": 17.5, "Iron ore": 35, "Silver ore": 40, "Coal": 50,
        "Gold ore": 65, "Mithril ore": 80, "Adamantite ore": 95, "Runite ore": 125,
        "Amethyst": 240, "Barronite shards": 16, "Barronite deposit": 32
    },
    "Fishing": {
        "Raw shrimps": 10, "Raw sardine": 20, "Raw herring": 30, "Raw anchovies": 40,
        "Raw trout": 50, "Raw pike": 60, "Raw salmon": 90, "Raw tuna": 80,
        "Raw lobster": 90, "Raw swordfish": 100, "Raw monkfish": 120, "Raw shark": 110
    },
    "Cooking": {
        "Shrimps": 30, "Sardine": 40, "Herring": 50, "Anchovies": 30,
        "Trout": 70, "Salmon": 90, "Tuna": 100, "Lobster": 120,
        "Swordfish": 140, "Monkfish": 150, "Shark": 210, "Karambwan": 190
    },
    "Firemaking": {
        "Logs": 40, "Oak logs": 60, "Willow logs": 105, "Teak logs": 120,
        "Maple logs": 135, "Mahogany logs": 157.5, "Yew logs": 202.5, "Magic logs": 303.8
    },
    "Smithing": {
        "Bronze bar": 6.25, "Iron bar": 12.5, "Steel bar": 17.5,
        "Gold bar": 22.5, "Mithril bar": 30, "Adamantite bar": 37.5, "Runite bar": 50,
        "Barronite deposit": 30
    }
};