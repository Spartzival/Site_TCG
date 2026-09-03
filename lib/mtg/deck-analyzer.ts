import type {
  DeckEligibility,
  DeckLocalAnalysis,
  DeckProject,
  DeckTypeStats,
  MtgCard,
} from "@/types/mtg";
import { logicalCardId, primaryCardName } from "@/lib/mtg/card-identity";

const BASIC_LANDS = new Set([
  "Plains",
  "Island",
  "Swamp",
  "Mountain",
  "Forest",
  "Wastes",
  "Snow-Covered Plains",
  "Snow-Covered Island",
  "Snow-Covered Swamp",
  "Snow-Covered Mountain",
  "Snow-Covered Forest",
]);

const COLORS = ["W", "U", "B", "R", "G"] as const;

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

function allowedCopies(card: MtgCard) {
  if (BASIC_LANDS.has(primaryCardName(card))) return Number.POSITIVE_INFINITY;

  const oracle = card.oracleText ?? "";
  if (/a deck can have any number of cards named/i.test(oracle)) {
    return Number.POSITIVE_INFINITY;
  }

  const limited = oracle.match(/a deck can have up to (\w+) cards named/i);
  if (limited) {
    const token = limited[1].toLowerCase();
    const parsed = Number(token);
    if (Number.isFinite(parsed)) return parsed;
    if (NUMBER_WORDS[token]) return NUMBER_WORDS[token];
  }

  return 1;
}

type ManaColor = (typeof COLORS)[number] | "C";

function countManaSymbols(card: MtgCard, quantity: number) {
  const result: Record<ManaColor, number> = {
    W: 0,
    U: 0,
    B: 0,
    R: 0,
    G: 0,
    C: 0,
  };

  const cost = card.manaCost ?? "";
  const symbols = cost.match(/\{[^}]+\}/g) ?? [];

  for (const symbol of symbols) {
    for (const color of COLORS) {
      if (symbol.includes(color)) result[color] += quantity;
    }
    if (symbol === "{C}") result.C += quantity;
  }

  return result;
}

function addCardType(stats: DeckTypeStats, card: MtgCard, quantity: number) {
  const type = card.typeLine ?? "";
  if (type.includes("Land")) stats.lands += quantity;
  else if (type.includes("Creature")) stats.creatures += quantity;
  else if (type.includes("Instant")) stats.instants += quantity;
  else if (type.includes("Sorcery")) stats.sorceries += quantity;
  else if (type.includes("Artifact")) stats.artifacts += quantity;
  else if (type.includes("Enchantment")) stats.enchantments += quantity;
  else if (type.includes("Planeswalker")) stats.planeswalkers += quantity;
  else if (type.includes("Battle")) stats.battles += quantity;
  else stats.other += quantity;
}

export type CommanderEligibilityResult = {
  ok: boolean;
  reason: string;
};

/**
 * Current Commander rule support for a single commander:
 * - legendary Creature
 * - legendary Vehicle
 * - legendary Spacecraft with a power/toughness box
 * - any card that explicitly says it can be your commander
 * The card must also not be banned/not-legal in Commander.
 */
export function getCommanderEligibility(card: MtgCard): CommanderEligibilityResult {
  const type = card.typeLine ?? "";
  const oracle = card.oracleText ?? "";
  const commanderLegality = card.legalities?.commander;

  if (commanderLegality && commanderLegality !== "legal") {
    return {
      ok: false,
      reason: `Cette carte n'est pas légale en Commander (${commanderLegality}).`,
    };
  }

  if (/can be your commander/i.test(oracle)) {
    return { ok: true, reason: "La carte indique explicitement qu'elle peut être commandant." };
  }

  const legendary = type.includes("Legendary");
  if (!legendary) {
    return { ok: false, reason: "Le commandant doit être une carte légendaire." };
  }

  if (type.includes("Creature")) {
    return { ok: true, reason: "Créature légendaire éligible." };
  }

  if (type.includes("Vehicle")) {
    return { ok: true, reason: "Véhicule légendaire éligible." };
  }

  if (type.includes("Spacecraft")) {
    if (card.power !== undefined && card.toughness !== undefined) {
      return { ok: true, reason: "Spacecraft légendaire avec force/endurance éligible." };
    }

    return {
      ok: false,
      reason: "Un Spacecraft commandant doit avoir une case de force/endurance.",
    };
  }

  return {
    ok: false,
    reason:
      "Le commandant doit être une créature légendaire, un véhicule légendaire, un Spacecraft légendaire éligible, ou préciser qu'il peut être commandant.",
  };
}

export function analyzeDeckLocally(deck: DeckProject): DeckLocalAnalysis {
  const commanderIdentity = Array.from(
    new Set(deck.commanders.flatMap((entry) => entry.card.colorIdentity)),
  );

  const identitySet = new Set(commanderIdentity);
  const main = deck.cards.filter((entry) => entry.section === "mainboard");

  // Only the command zone + mainboard are part of the actual 100-card deck.
  // Maybeboard and sideboard are planning aids and must not affect legality,
  // deck size, mana curve, types or color identity checks.
  const deckEntries = [...deck.commanders, ...main];

  const typeStats: DeckTypeStats = {
    creatures: 0,
    instants: 0,
    sorceries: 0,
    artifacts: 0,
    enchantments: 0,
    planeswalkers: 0,
    battles: 0,
    lands: 0,
    other: 0,
  };

  const manaPips: DeckLocalAnalysis["manaPips"] = {
    W: 0,
    U: 0,
    B: 0,
    R: 0,
    G: 0,
    C: 0,
  };

  const manaBuckets = new Map<string, number>([
    ["0", 0],
    ["1", 0],
    ["2", 0],
    ["3", 0],
    ["4", 0],
    ["5", 0],
    ["6", 0],
    ["7+", 0],
  ]);

  let totalManaValue = 0;
  let nonlandCount = 0;
  const colorIdentityViolations: string[] = [];
  const commanderLegalityViolations: string[] = [];
  const logicalCounts = new Map<string, { card: MtgCard; count: number }>();

  for (const entry of deckEntries) {
    const { card, quantity } = entry;
    addCardType(typeStats, card, quantity);

    if (card.legalities?.commander && card.legalities.commander !== "legal") {
      commanderLegalityViolations.push(card.name);
    }

    if (identitySet.size > 0) {
      const outsideIdentity = card.colorIdentity.some((color) => !identitySet.has(color));
      if (outsideIdentity) colorIdentityViolations.push(card.name);
    }

    /*
     * Singleton is checked on the ONE logical Oracle card, never on each
     * face. This is what prevents a Front // Back / Adventure / MDFC object
     * from being interpreted as two separate deck cards.
     */
    const logicalId = logicalCardId(card);
    const existing = logicalCounts.get(logicalId);
    logicalCounts.set(logicalId, {
      card,
      count: (existing?.count ?? 0) + quantity,
    });

    if (!(card.typeLine ?? "").includes("Land")) {
      nonlandCount += quantity;
      const manaValue = Math.max(0, card.manaValue ?? 0);
      totalManaValue += manaValue * quantity;
      const bucket = manaValue >= 7 ? "7+" : String(Math.floor(manaValue));
      manaBuckets.set(bucket, (manaBuckets.get(bucket) ?? 0) + quantity);

      const symbols = countManaSymbols(card, quantity);
      for (const color of [...COLORS, "C"] as ManaColor[]) {
        manaPips[color] += symbols[color];
      }
    }
  }

  const duplicateViolations = Array.from(logicalCounts.values())
    .filter((value) => value.count > allowedCopies(value.card))
    .map((value) => primaryCardName(value.card));

  return {
    totalCards: deckEntries.reduce((sum, entry) => sum + entry.quantity, 0),
    commanderCount: deck.commanders.reduce((sum, entry) => sum + entry.quantity, 0),
    mainboardCount: main.reduce((sum, entry) => sum + entry.quantity, 0),
    landCount: typeStats.lands,
    nonlandCount,
    averageManaValue: nonlandCount > 0 ? totalManaValue / nonlandCount : 0,
    manaCurve: Array.from(manaBuckets, ([manaValue, count]) => ({ manaValue, count })),
    manaPips,
    typeStats,
    commanderIdentity,
    colorIdentityViolations: Array.from(new Set(colorIdentityViolations)),
    commanderLegalityViolations: Array.from(new Set(commanderLegalityViolations)),
    duplicateViolations,
  };
}

export function evaluateDeckEligibility(
  deck: DeckProject,
  analysis: DeckLocalAnalysis,
): DeckEligibility {
  const singleCommander = analysis.commanderCount === 1 && deck.commanders.length === 1;
  const commanderCard = deck.commanders[0]?.card;
  const commanderEligibility = commanderCard
    ? getCommanderEligibility(commanderCard)
    : { ok: false, reason: "Ajoute un commandant." };

  const checks = [
    {
      id: "format",
      label: "Format Commander",
      ok: deck.format.toLowerCase() === "commander",
      detail:
        deck.format.toLowerCase() === "commander"
          ? "Commander"
          : `Format actuel : ${deck.format}`,
    },
    {
      id: "commander-count",
      label: "Un commandant défini",
      ok: singleCommander,
      detail: singleCommander
        ? commanderCard?.name ?? "Commandant défini"
        : analysis.commanderCount > 1
          ? "Les decks Partner / Background ne sont pas encore validés automatiquement."
          : "Choisis un commandant.",
    },
    {
      id: "commander-type",
      label: "Commandant éligible",
      ok: Boolean(singleCommander && commanderCard && commanderEligibility.ok),
      detail: commanderEligibility.reason,
    },
    {
      id: "deck-size",
      label: "100 cartes au total",
      ok: analysis.totalCards === 100,
      detail:
        analysis.totalCards < 100
          ? `${analysis.totalCards}/100 · encore ${100 - analysis.totalCards} carte(s) à ajouter`
          : analysis.totalCards > 100
            ? `${analysis.totalCards}/100 · ${analysis.totalCards - 100} carte(s) à retirer`
            : "100/100 cartes",
    },
    {
      id: "mainboard-size",
      label: "99 cartes hors commandant",
      ok: singleCommander && analysis.mainboardCount === 99,
      detail:
        analysis.mainboardCount < 99
          ? `${analysis.mainboardCount}/99 · encore ${99 - analysis.mainboardCount} carte(s) dans le deck principal`
          : analysis.mainboardCount > 99
            ? `${analysis.mainboardCount}/99 · ${analysis.mainboardCount - 99} carte(s) en trop`
            : "99/99 cartes",
    },
    {
      id: "legality",
      label: "Toutes les cartes sont légales en Commander",
      ok: analysis.commanderLegalityViolations.length === 0,
      detail:
        analysis.commanderLegalityViolations.length === 0
          ? "Aucune carte bannie ou non légale détectée."
          : analysis.commanderLegalityViolations.join(", "),
    },
    {
      id: "identity",
      label: "Identité couleur respectée",
      ok: analysis.colorIdentityViolations.length === 0,
      detail:
        analysis.colorIdentityViolations.length === 0
          ? "Toutes les cartes respectent l'identité du commandant."
          : analysis.colorIdentityViolations.join(", "),
    },
    {
      id: "singleton",
      label: "Règle du singleton respectée",
      ok: analysis.duplicateViolations.length === 0,
      detail:
        analysis.duplicateViolations.length === 0
          ? "Aucun doublon illégal détecté."
          : analysis.duplicateViolations.join(", "),
    },
  ];

  return {
    eligible: checks.every((check) => check.ok),
    checks,
  };
}
