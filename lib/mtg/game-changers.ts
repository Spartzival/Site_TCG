/**
 * Official Commander Game Changers, current after the February 9, 2026
 * Commander Brackets update. Commander Spellbook remains the primary remote
 * analyzer; this list is a deterministic fallback so Game Changers are still
 * detected when that API changes or is unavailable.
 */
export const OFFICIAL_GAME_CHANGERS_2026 = new Set(
  [
    "Drannith Magistrate",
    "Farewell",
    "Humility",
    "Serra's Sanctum",
    "Smothering Tithe",
    "Enlightened Tutor",
    "Teferi's Protection",
    "Consecrated Sphinx",
    "Cyclonic Rift",
    "Force of Will",
    "Fierce Guardianship",
    "Gifts Ungiven",
    "Intuition",
    "Mystical Tutor",
    "Narset, Parter of Veils",
    "Rhystic Study",
    "Thassa's Oracle",
    "Ad Nauseam",
    "Bolas's Citadel",
    "Biorhythm",
    "Braids, Cabal Minion",
    "Demonic Tutor",
    "Imperial Seal",
    "Necropotence",
    "Opposition Agent",
    "Orcish Bowmasters",
    "Tergrid, God of Fright",
    "Vampiric Tutor",
    "Gamble",
    "Jeska's Will",
    "Underworld Breach",
    "Crop Rotation",
    "Gaea's Cradle",
    "Natural Order",
    "Seedborn Muse",
    "Survival of the Fittest",
    "Worldly Tutor",
    "Aura Shards",
    "Coalition Victory",
    "Grand Arbiter Augustin IV",
    "Notion Thief",
    "Ancient Tomb",
    "Chrome Mox",
    "Field of the Dead",
    "Glacial Chasm",
    "Grim Monolith",
    "Lion's Eye Diamond",
    "Mana Vault",
    "Mishra's Workshop",
    "Mox Diamond",
    "Panoptic Mirror",
    "The One Ring",
    "The Tabernacle at Pendrell Vale",
  ].map((name) => name.toLocaleLowerCase("en")),
);

export function detectOfficialGameChangers(cardNames: string[]) {
  const detected = new Map<string, string>();

  for (const rawName of cardNames) {
    /*
     * Scryfall names multi-faced cards as "Front // Back". Commander lists
     * and official bracket lists generally refer to the front/card name.
     */
    const primaryName = rawName.split(/\s+\/\/\s+/)[0]?.trim() ?? rawName.trim();
    const normalized = primaryName.toLocaleLowerCase("en");

    if (OFFICIAL_GAME_CHANGERS_2026.has(normalized)) {
      detected.set(normalized, primaryName);
    }
  }

  return Array.from(detected.values());
}
