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

export const XP_MAP: Record<string, number> = {
    // Woodcutting
    "Logs": 25, "Oak logs": 37.5, "Willow logs": 67.5, "Teak logs": 85,
    "Maple logs": 100, "Mahogany logs": 125, "Yew logs": 175, "Magic logs": 250,
    // Mining
    "Copper ore": 17.5, "Tin ore": 17.5, "Iron ore": 35, "Coal": 50, "Barronite shards": 16, "Barronite deposit": 32,
    // Fishing (With singular safety nets)
    "Raw shrimps": 10, "Raw shrimp": 10, "Shrimps": 10,
    "Raw sardine": 20, "Raw herring": 30, "Raw anchovies": 40, "Raw anchovy": 40,
    "Raw trout": 50, "Raw pike": 60, "Raw salmon": 90, "Raw tuna": 80,
    "Raw lobster": 90, "Raw swordfish": 100, "Raw shark": 110
};