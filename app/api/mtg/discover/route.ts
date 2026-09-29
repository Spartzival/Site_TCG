import { NextResponse } from "next/server";
import { readJsonResponse } from "@/lib/server/read-json-response";
import {
  detectCardRoles,
  type CardRole,
} from "@/lib/mtg/card-role-analyzer";
import {
  normalizeScryfallCard,
  SCRYFALL_HEADERS,
  type ScryfallCard,
} from "@/lib/mtg/scryfall";
import type {
  DiscoverDeckInput,
  DiscoverPersonalCard,
  DiscoverResponse,
  DiscoverTrendingCard,
} from "@/types/discover";
import type { MtgCard } from "@/types/mtg";

type DiscoverRequest = {
  decks?: DiscoverDeckInput[];
};

type RankedScryfallCard = ScryfallCard & {
  edhrec_rank?: number;
};

type ScryfallSearchPayload = {
  data?: RankedScryfallCard[];
  details?: string;
};

type SearchResult = {
  card: MtgCard;
  popularityRank?: number;
};

type Candidate = {
  card: MtgCard;
  score: number;
  reasons: Set<string>;
  deckIds: Set<string>;
  deckNames: Set<string>;
  popularityRank?: number;
};

const ROLE_QUERIES: Record<string, string> = {
  ramp: '(o:"add " OR o:"Treasure token" OR o:"additional land")',
  draw: '(o:"draw a card" OR o:"draw two cards" OR o:"draw cards" OR o:investigate OR o:connive)',
  removal: '(o:"destroy target" OR o:"exile target" OR o:"return target")',
  "board-wipe": '(o:"destroy all" OR o:"exile all" OR o:"each creature gets -")',
  recursion: '(o:"from your graveyard" OR o:"from a graveyard")',
  protection: '(o:hexproof OR o:indestructible OR o:ward OR o:"phase out")',
  counterspell: 'o:"counter target"',
  tokens: 'o:"create" o:token',
  sacrifice: 'o:sacrifice',
  "lifegain-drain": '(o:"gain life" OR o:"loses life")',
  "graveyard-hate": '(o:"exile" o:graveyard)',
  blink: '(o:"exile" o:"return" o:"battlefield")',
  discard: 'o:discard',
  mill: 'o:mill',
  evasion: '(o:flying OR o:menace OR o:trample OR o:"can\'t be blocked")',
  "tax-stax": '(o:"unless" o:"pays" OR o:"cost" o:"more")',
  finisher: '(o:"you win the game" OR o:"each opponent" OR o:"double strike")',
};

const SCRYFALL_MIN_GAP_MS = 180;
const SCRYFALL_CACHE_SECONDS = 6 * 60 * 60;

let scryfallQueue: Promise<void> = Promise.resolve();
let lastScryfallRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scheduleScryfall<T>(operation: () => Promise<T>): Promise<T> {
  const previous = scryfallQueue;
  let releaseQueue!: () => void;

  scryfallQueue = new Promise<void>((resolve) => {
    releaseQueue = resolve;
  });

  await previous;

  const waitMs = Math.max(
    0,
    lastScryfallRequestAt + SCRYFALL_MIN_GAP_MS - Date.now(),
  );

  if (waitMs > 0) {
    await sleep(waitMs);
  }

  try {
    return await operation();
  } finally {
    lastScryfallRequestAt = Date.now();
    releaseQueue();
  }
}

function monthsAgoIso(months: number): string {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString().slice(0, 10);
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase("en");
}

function identityQuery(identity: string[]): string {
  const colors = Array.from(new Set(identity)).join("").toLowerCase();
  return colors ? `id<=${colors}` : "id:c";
}

function allOracleText(card: MtgCard): string {
  return [
    card.oracleText,
    ...(card.faces?.map((face) => face.oracleText) ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("en");
}

function commanderText(deck: DiscoverDeckInput): string {
  return [
    deck.commander.oracleText,
    ...(deck.commander.faces?.map((face) => face.oracleText) ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("en");
}

function commanderSynergy(
  deck: DiscoverDeckInput,
): { query: string; reason: string; kind: string } | null {
  const text = commanderText(deck);
  const type = (deck.commander.typeLine ?? "").toLocaleLowerCase("en");

  if (text.includes("treasure")) {
    return {
      query: 'o:"Treasure token"',
      reason: `Synergie Trésors avec ${deck.commander.name}.`,
      kind: "treasure",
    };
  }
  if (text.includes("token")) {
    return {
      query: "o:token",
      reason: `Synergie jetons avec ${deck.commander.name}.`,
      kind: "token",
    };
  }
  if (text.includes("sacrifice")) {
    return {
      query: "o:sacrifice",
      reason: `Renforce le plan sacrifice de ${deck.commander.name}.`,
      kind: "sacrifice",
    };
  }
  if (text.includes("graveyard")) {
    return {
      query: "o:graveyard",
      reason: `Renforce le plan cimetière de ${deck.commander.name}.`,
      kind: "graveyard",
    };
  }
  if (text.includes("gain life") || text.includes("life total")) {
    return {
      query: '(o:"gain life" OR o:lifelink)',
      reason: `Synergie gain de vie avec ${deck.commander.name}.`,
      kind: "lifegain",
    };
  }
  if (text.includes("artifact") || type.includes("artifact")) {
    return {
      query: "(t:artifact OR o:artifact)",
      reason: `Synergie artefacts avec ${deck.commander.name}.`,
      kind: "artifact",
    };
  }
  if (text.includes("enchantment") || type.includes("enchantment")) {
    return {
      query: "(t:enchantment OR o:enchantment)",
      reason: `Synergie enchantements avec ${deck.commander.name}.`,
      kind: "enchantment",
    };
  }
  if (text.includes("instant") || text.includes("sorcery")) {
    return {
      query: "(t:instant OR t:sorcery)",
      reason: `Renforce le plan sorts de ${deck.commander.name}.`,
      kind: "spells",
    };
  }
  if (text.includes("attack") || text.includes("combat damage")) {
    return {
      query: '(o:"whenever" o:"attack" OR o:"combat damage")',
      reason: `Renforce le plan combat de ${deck.commander.name}.`,
      kind: "combat",
    };
  }
  if (text.includes("+1/+1 counter")) {
    return {
      query: 'o:"+1/+1 counter"',
      reason: `Synergie marqueurs +1/+1 avec ${deck.commander.name}.`,
      kind: "counter",
    };
  }
  if (text.includes("discard")) {
    return {
      query: "o:discard",
      reason: `Synergie défausse avec ${deck.commander.name}.`,
      kind: "discard",
    };
  }
  if (text.includes("exile") && text.includes("return") && text.includes("battlefield")) {
    return {
      query: '(o:"exile" o:"return" o:"battlefield")',
      reason: `Synergie blink/flicker avec ${deck.commander.name}.`,
      kind: "blink",
    };
  }

  return null;
}

function cardMatchesSynergy(card: MtgCard, kind: string): boolean {
  const text = allOracleText(card);
  const type = [card.typeLine, ...(card.faces?.map((face) => face.typeLine) ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("en");

  switch (kind) {
    case "treasure":
      return text.includes("treasure");
    case "token":
      return text.includes("token");
    case "sacrifice":
      return text.includes("sacrifice");
    case "graveyard":
      return text.includes("graveyard");
    case "lifegain":
      return text.includes("gain life") || text.includes("lifelink");
    case "artifact":
      return text.includes("artifact") || type.includes("artifact");
    case "enchantment":
      return text.includes("enchantment") || type.includes("enchantment");
    case "spells":
      return type.includes("instant") || type.includes("sorcery");
    case "combat":
      return text.includes("attack") || text.includes("combat damage");
    case "counter":
      return text.includes("+1/+1 counter");
    case "discard":
      return text.includes("discard");
    case "blink":
      return text.includes("exile") && text.includes("return") && text.includes("battlefield");
    default:
      return false;
  }
}

async function searchScryfall(query: string, limit: number): Promise<SearchResult[]> {
  const endpoint = new URL("https://api.scryfall.com/cards/search");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("unique", "cards");
  endpoint.searchParams.set("order", "edhrec");
  endpoint.searchParams.set("dir", "asc");

  return scheduleScryfall(async () => {
    const response: Response = await fetch(endpoint, {
      headers: SCRYFALL_HEADERS,
      next: {
        revalidate: SCRYFALL_CACHE_SECONDS,
      },
    });

    const payload = await readJsonResponse<ScryfallSearchPayload>(
      response,
      "Scryfall discover",
    );

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error(
          "Scryfall limite temporairement les requêtes. Les tendances réessaieront plus tard automatiquement.",
        );
      }

      throw new Error(payload.details ?? `Scryfall HTTP ${response.status}`);
    }

    return (payload.data ?? []).slice(0, limit).map((raw) => ({
      card: normalizeScryfallCard(raw),
      popularityRank: raw.edhrec_rank,
    }));
  });
}

export async function POST(request: Request) {
  const recentSince = monthsAgoIso(6);

  let body: DiscoverRequest = {};
  try {
    body = (await request.json()) as DiscoverRequest;
  } catch {
    // Les tendances restent disponibles sans personnalisation.
  }

  let trendError: string | undefined;
  let trending: DiscoverTrendingCard[] = [];

  try {
    const trendingRaw = await searchScryfall(
      `legal:commander game:paper -is:funny -is:reprint -t:basic date>=${recentSince}`,
      18,
    );

    trending = trendingRaw.map((item) => ({
      card: item.card,
      popularityRank: item.popularityRank,
    }));
  } catch (error) {
    trendError =
      error instanceof Error && error.message
        ? error.message
        : "Impossible de charger les tendances MTG.";
  }

  const decks = [...(body.decks ?? [])]
    .filter((deck) => Boolean(deck.commander?.name))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    })
    // Trois decks suffisent pour personnaliser la page et maintiennent la
    // charge Scryfall très basse : 1 requête tendances + 1 requête par deck.
    .slice(0, 3);

  const candidates = new Map<string, Candidate>();
  let personalError: string | undefined;

  for (const deck of decks) {
    try {
      const inDeck = new Set(
        [deck.commander.name, ...deck.cardNames].map(normalizeName),
      );

      const base = `legal:commander game:paper -is:funny -t:basic ${identityQuery(
        deck.commander.colorIdentity ?? [],
      )}`;

      const gap = [...deck.roleNeeds]
        .filter((need) => need.count < need.target && ROLE_QUERIES[need.role])
        .sort((a, b) => b.target - b.count - (a.target - a.count))[0];

      const synergy = commanderSynergy(deck);
      const clauses = [synergy?.query, gap ? ROLE_QUERIES[gap.role] : null].filter(
        (value): value is string => Boolean(value),
      );

      const focusQuery = clauses.length > 0
        ? `(${clauses.join(" OR ")})`
        : "-t:land";

      const results = await searchScryfall(`${base} ${focusQuery}`, 28);

      results.forEach((result, index) => {
        if (inDeck.has(normalizeName(result.card.name))) return;

        const detectedRoles = detectCardRoles(result.card);
        const matchesGap = Boolean(gap && detectedRoles.includes(gap.role as CardRole));
        const matchesSynergy = Boolean(
          synergy && cardMatchesSynergy(result.card, synergy.kind),
        );

        const reasons = new Set<string>();
        let bonus = 20;

        if (matchesSynergy && synergy) {
          reasons.add(synergy.reason);
          bonus += 52;
        }

        if (matchesGap && gap) {
          reasons.add(
            `${deck.name} manque de ${gap.label.toLocaleLowerCase("fr")} (${gap.count}/${gap.target}).`,
          );
          bonus += 58;
        }

        if (reasons.size === 0) {
          reasons.add(`Carte Commander populaire compatible avec ${deck.commander.name}.`);
          bonus += 18;
        }

        const key = result.card.oracleId ?? result.card.id;
        const existing = candidates.get(key) ?? {
          card: result.card,
          score: 0,
          reasons: new Set<string>(),
          deckIds: new Set<string>(),
          deckNames: new Set<string>(),
          popularityRank: result.popularityRank,
        };

        existing.score += bonus + Math.max(0, 34 - index);
        reasons.forEach((reason) => existing.reasons.add(reason));
        existing.deckIds.add(deck.id);
        existing.deckNames.add(deck.name);
        existing.popularityRank = existing.popularityRank ?? result.popularityRank;

        candidates.set(key, existing);
      });
    } catch (error) {
      personalError =
        error instanceof Error && error.message
          ? error.message
          : "Certaines recommandations personnalisées sont indisponibles.";
      // On conserve les résultats déjà calculés pour les autres decks.
    }
  }

  const personalized: DiscoverPersonalCard[] = Array.from(candidates.values())
    .map((candidate) => ({
      card: candidate.card,
      score: candidate.score + Math.max(0, candidate.deckIds.size - 1) * 28,
      reasons: Array.from(candidate.reasons).slice(0, 4),
      deckIds: Array.from(candidate.deckIds),
      deckNames: Array.from(candidate.deckNames),
      popularityRank: candidate.popularityRank,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 18);

  const error = [trendError, personalError].filter(Boolean).join(" ") || undefined;

  return NextResponse.json({
    available: trending.length > 0 || personalized.length > 0 || !error,
    recentSince,
    trending,
    personalized,
    error,
  } satisfies DiscoverResponse);
}
