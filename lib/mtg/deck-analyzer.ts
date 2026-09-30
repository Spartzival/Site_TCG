import type {
  DeckEligibility,
  DeckFormat,
  DeckLocalAnalysis,
  DeckProject,
  DeckTypeStats,
  MtgCard,
} from "@/types/mtg";
import {
  allCardOracleTexts,
  logicalCardId,
  primaryCardManaCost,
  primaryCardName,
  primaryCardOracleText,
  primaryCardTypeLine,
} from "@/lib/mtg/card-identity";
import { normalizeDeckFormat } from "@/lib/mtg/deck-format";

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

function isBasicLand(card: MtgCard) {
  return primaryCardTypeLine(card).includes("Basic Land") || BASIC_LANDS.has(primaryCardName(card));
}

function allowedCopies(card: MtgCard, format: DeckFormat) {
  if (isBasicLand(card)) return Number.POSITIVE_INFINITY;

  const oracle = allCardOracleTexts(card).join("\n");
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

  return format === "Standard" ? 4 : 1;
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

  const cost = primaryCardManaCost(card);
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
  const type = primaryCardTypeLine(card);
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
 * Current single-commander support:
 * - legendary Creature
 * - legendary Vehicle
 * - legendary Spacecraft with a power/toughness box
 * - any card that explicitly says it can be your commander
 */
export function getCommanderEligibility(card: MtgCard): CommanderEligibilityResult {
  const type = primaryCardTypeLine(card);
  const oracle = allCardOracleTexts(card).join("\n") || primaryCardOracleText(card);
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
  const format = normalizeDeckFormat(deck.format);
  const isCommander = format === "Commander";
  const main = deck.cards.filter((entry) => entry.section === "mainboard");
  const sideboard = deck.cards.filter((entry) => entry.section === "sideboard");

  const commanderIdentity = isCommander
    ? Array.from(new Set(deck.commanders.flatMap((entry) => entry.card.colorIdentity)))
    : [];
  const identitySet = new Set(commanderIdentity);

  // Stats concern the cards that begin in the deck itself.
  // Commander: command zone + 99. Standard: main deck only.
  const deckEntries = isCommander ? [...deck.commanders, ...main] : main;

  // Legality/copy-limit scope differs by format.
  // In Standard, the four-copy rule applies across main deck + sideboard.
  const legalityEntries = isCommander ? [...deck.commanders, ...main] : [...main, ...sideboard];

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
  const legalityViolations: string[] = [];
  const logicalCounts = new Map<string, { card: MtgCard; count: number }>();

  for (const entry of deckEntries) {
    const { card, quantity } = entry;
    addCardType(typeStats, card, quantity);

    if (isCommander && identitySet.size > 0) {
      const outsideIdentity = card.colorIdentity.some((color) => !identitySet.has(color));
      if (outsideIdentity) colorIdentityViolations.push(card.name);
    }

    if (!primaryCardTypeLine(card).includes("Land")) {
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

  const legalityKey = isCommander ? "commander" : "standard";
  for (const entry of legalityEntries) {
    const legality = entry.card.legalities?.[legalityKey];
    if (legality && legality !== "legal") legalityViolations.push(entry.card.name);

    const logicalId = logicalCardId(entry.card);
    const existing = logicalCounts.get(logicalId);
    logicalCounts.set(logicalId, {
      card: entry.card,
      count: (existing?.count ?? 0) + entry.quantity,
    });
  }

  const duplicateViolations = Array.from(logicalCounts.values())
    .filter((value) => value.count > allowedCopies(value.card, format))
    .map((value) => primaryCardName(value.card));

  return {
    totalCards: deckEntries.reduce((sum, entry) => sum + entry.quantity, 0),
    commanderCount: deck.commanders.reduce((sum, entry) => sum + entry.quantity, 0),
    mainboardCount: main.reduce((sum, entry) => sum + entry.quantity, 0),
    sideboardCount: sideboard.reduce((sum, entry) => sum + entry.quantity, 0),
    landCount: typeStats.lands,
    nonlandCount,
    averageManaValue: nonlandCount > 0 ? totalManaValue / nonlandCount : 0,
    manaCurve: Array.from(manaBuckets, ([manaValue, count]) => ({ manaValue, count })),
    manaPips,
    typeStats,
    commanderIdentity,
    colorIdentityViolations: Array.from(new Set(colorIdentityViolations)),
    commanderLegalityViolations: isCommander ? Array.from(new Set(legalityViolations)) : [],
    legalityViolations: Array.from(new Set(legalityViolations)),
    duplicateViolations,
  };
}

export function evaluateDeckEligibility(
  deck: DeckProject,
  analysis: DeckLocalAnalysis,
): DeckEligibility {
  const format = normalizeDeckFormat(deck.format);

  if (format === "Standard") {
    const checks = [
      {
        id: "format",
        label: "Format Standard",
        ok: true,
        detail: "Standard",
      },
      {
        id: "no-commander",
        label: "Aucune zone de commandant",
        ok: analysis.commanderCount === 0 && deck.commanders.length === 0,
        detail:
          analysis.commanderCount === 0 && deck.commanders.length === 0
            ? "Le Standard n'utilise pas de commandant."
            : "Retire le commandant de ce deck Standard.",
      },
      {
        id: "mainboard-size",
        label: "60 cartes minimum dans le deck principal",
        ok: analysis.mainboardCount >= 60,
        detail:
          analysis.mainboardCount >= 60
            ? `${analysis.mainboardCount} cartes dans le deck principal.`
            : `${analysis.mainboardCount}/60 · encore ${60 - analysis.mainboardCount} carte(s) à ajouter`,
      },
      {
        id: "sideboard-size",
        label: "15 cartes maximum dans le sideboard",
        ok: analysis.sideboardCount <= 15,
        detail:
          analysis.sideboardCount <= 15
            ? `${analysis.sideboardCount}/15 carte(s) dans le sideboard.`
            : `${analysis.sideboardCount}/15 · ${analysis.sideboardCount - 15} carte(s) à retirer`,
      },
      {
        id: "legality",
        label: "Toutes les cartes sont légales en Standard",
        ok: analysis.legalityViolations.length === 0,
        detail:
          analysis.legalityViolations.length === 0
            ? "Aucune carte bannie ou hors Standard détectée."
            : analysis.legalityViolations.join(", "),
      },
      {
        id: "copies",
        label: "Limite de 4 exemplaires respectée",
        ok: analysis.duplicateViolations.length === 0,
        detail:
          analysis.duplicateViolations.length === 0
            ? "Aucun dépassement de la limite de copies détecté."
            : analysis.duplicateViolations.join(", "),
      },
    ];

    return {
      eligible: checks.every((check) => check.ok),
      checks,
    };
  }

  const singleCommander = analysis.commanderCount === 1 && deck.commanders.length === 1;
  const commanderCard = deck.commanders[0]?.card;
  const commanderEligibility = commanderCard
    ? getCommanderEligibility(commanderCard)
    : { ok: false, reason: "Ajoute un commandant." };

  const checks = [
    {
      id: "format",
      label: "Format Commander",
      ok: true,
      detail: "Commander",
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
      ok: analysis.legalityViolations.length === 0,
      detail:
        analysis.legalityViolations.length === 0
          ? "Aucune carte bannie ou non légale détectée."
          : analysis.legalityViolations.join(", "),
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
