/**
 * Port of getStandardAutocastSpell(int varp) from LootLoggerPlugin.java.
 * Maps varp 108 values to their corresponding spell names.
 */
export function getAutocastSpell(varp: number): string {
  switch (varp) {
    case 3:  return 'Wind Strike';
    case 5:  return 'Water Strike';
    case 7:  return 'Earth Strike';
    case 9:  return 'Fire Strike';
    case 11: return 'Wind Bolt';
    case 13: return 'Water Bolt';
    case 15: return 'Earth Bolt';
    case 17: return 'Fire Bolt';
    case 19: return 'Wind Blast';
    case 21: return 'Water Blast';
    case 23: return 'Earth Blast';
    case 25: return 'Fire Blast';
    case 27: return 'Wind Wave';
    case 29: return 'Water Wave';
    case 31: return 'Earth Wave';
    case 33: return 'Fire Wave';
    case 35: return 'Wind Surge';
    case 37: return 'Water Surge';
    case 39: return 'Earth Surge';
    case 41: return 'Fire Surge';
    default: return `Unknown Autocast (${varp})`;
  }
}
