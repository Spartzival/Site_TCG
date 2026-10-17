import { NextResponse } from "next/server";
import { readJsonResponse } from "@/lib/server/read-json-response";
import {
  normalizeScryfallCard,
  SCRYFALL_HEADERS,
  type ScryfallCard,
  type ScryfallRelatedCard,
} from "@/lib/mtg/scryfall";
import type {
  DeckSection,
  DeckTokenAnalysis,
  DeckTokenItem,
  DeckTokenKind,
  DeckTokenSource,
} from "@/types/mtg";

type TokenSourceInput = {
  scryfallId?: string;
  name: string;
  quantity?: number;
  section?: DeckSection;
};

type TokenRequest = {
  cards?: TokenSourceInput[];
};

type CardIdentifier = {
  id?: string;
  name?: string;
};

type ScryfallCollectionResponse = {
  data?: ScryfallCard[];
  not_found?: CardIdentifier[];
  details?: string;
};

type CachedAnalysis = {
  expiresAt: number;
  value: DeckTokenAnalysis;
};

const MAX_BATCH = 75;
const MIN_SCRYFALL_GAP_MS = 180;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const analysisCache = new Map<string, CachedAnalysis>();
let lastScryfallRequestAt = 0;
let scryfallQueue: Promise<void> = Promise.resolve();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scheduleScryfall<T>(operation: () => Promise<T>): Promise<T> {
  const previous = scryfallQueue;
  let release!: () => void;

  scryfallQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;

  const waitMs = Math.max(
    0,
    lastScryfallRequestAt + MIN_SCRYFALL_GAP_MS - Date.now(),
  );

  if (waitMs > 0) await sleep(waitMs);

  try {
    return await operation();
  } finally {
    lastScryfallRequestAt = Date.now();
    release();
  }
}

async function fetchCollection(identifiers: CardIdentifier[]): Promise<ScryfallCard[]> {
  const cards: ScryfallCard[] = [];

  for (let offset = 0; offset < identifiers.length; offset += MAX_BATCH) {
    const batch = identifiers.slice(offset, offset + MAX_BATCH);

    const payload = await scheduleScryfall(async () => {
      const response: Response = await fetch(
        "https://api.scryfall.com/cards/collection",
        {
          method: "POST",
          headers: {
            ...SCRYFALL_HEADERS,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ identifiers: batch }),
          cache: "no-store",
        },
      );

      const json = await readJsonResponse<ScryfallCollectionResponse>(
        response,
        "Scryfall deck tokens",
      );

      if (!response.ok) {
        throw new Error(json.details ?? `Scryfall HTTP ${response.status}`);
      }

      return json;
    });

    cards.push(...(payload.data ?? []));
  }

  return cards;
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase("en");
}

function sourceKey(source: DeckTokenSource): string {
  return `${source.cardId}:${source.section}`;
}

function mergeSources(sources: DeckTokenSource[]): DeckTokenSource[] {
  const merged = new Map<string, DeckTokenSource>();

  for (const source of sources) {
    const key = sourceKey(source);
    const current = merged.get(key);
    merged.set(
      key,
      current
        ? { ...current, quantity: current.quantity + source.quantity }
        : source,
    );
  }

  return Array.from(merged.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "fr"),
  );
}

function allOracleText(card: ScryfallCard): string {
  return [
    card.oracle_text,
    ...(card.card_faces?.map((face) => face.oracle_text) ?? []),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLocaleLowerCase("en");
}

function isTokenRelation(part: ScryfallRelatedCard): boolean {
  if (part.component === "token") return true;
  return /\b(token|emblem)\b/i.test(part.type_line ?? "");
}

function relatedKind(part: ScryfallRelatedCard): DeckTokenKind {
  return /\bemblem\b/i.test(part.type_line ?? "") ? "emblem" : "token";
}

function genericKind(card: ScryfallCard): DeckTokenKind | null {
  const text = allOracleText(card);

  if (
    /token (?:that(?:'s| is)|which is) a copy/.test(text) ||
    /create[^.]*token[^.]*copy of/.test(text) ||
    /create a token that's a copy/.test(text)
  ) {
    return "copy";
  }

  if (/\bcreate\b[^.]*\btoken\b/.test(text)) return "variable";
  if (/\bget an emblem\b/.test(text)) return "emblem";

  return null;
}

function genericLabel(kind: DeckTokenKind): string {
  switch (kind) {
    case "copy":
      return "Jeton copie";
    case "emblem":
      return "Emblème variable";
    default:
      return "Jeton généré (variable)";
  }
}

function buildCacheKey(cards: TokenSourceInput[]): string {
  return cards
    .map(
      (card) =>
        `${card.scryfallId ?? normalizeName(card.name)}:${card.quantity ?? 1}:${card.section ?? "mainboard"}`,
    )
    .sort()
    .join("|");
}

export async function POST(request: Request) {
  let body: TokenRequest;

  try {
    body = (await request.json()) as TokenRequest;
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const input = (body.cards ?? [])
    .filter((card) => card.name?.trim())
    .map((card) => ({
      scryfallId: card.scryfallId?.trim(),
      name: card.name.trim(),
      quantity: Math.max(1, Number(card.quantity) || 1),
      section: card.section ?? "mainboard",
    }));

  if (input.length === 0) {
    return NextResponse.json({
      available: true,
      tokens: [],
      sourceCardCount: 0,
    } satisfies DeckTokenAnalysis);
  }

  const cacheKey = buildCacheKey(input);
  const cached = analysisCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.value);
  }

  try {
    const identifiers: CardIdentifier[] = Array.from(
      new Map(
        input.map((card) => [
          card.scryfallId ?? normalizeName(card.name),
          card.scryfallId ? { id: card.scryfallId } : { name: card.name },
        ]),
      ).values(),
    );

    const sourceCards = await fetchCollection(identifiers);

    const inputById = new Map<string, typeof input>();
    const inputByName = new Map<string, typeof input>();

    for (const card of input) {
      if (card.scryfallId) {
        inputById.set(card.scryfallId, [
          ...(inputById.get(card.scryfallId) ?? []),
          card,
        ]);
      }

      const name = normalizeName(card.name);
      inputByName.set(name, [...(inputByName.get(name) ?? []), card]);
    }

    const relatedMeta = new Map<string, ScryfallRelatedCard>();
    const relatedSources = new Map<string, DeckTokenSource[]>();
    const genericSources = new Map<DeckTokenKind, DeckTokenSource[]>();

    for (const sourceCard of sourceCards) {
      const matchedInputs = [
        ...(inputById.get(sourceCard.id) ?? []),
        ...(inputByName.get(normalizeName(sourceCard.name)) ?? []),
      ];

      const dedupedInputs = Array.from(
        new Map(
          matchedInputs.map((source) => [
            `${source.scryfallId ?? normalizeName(source.name)}:${source.section}`,
            source,
          ]),
        ).values(),
      );

      const sources: DeckTokenSource[] = dedupedInputs.map((source) => ({
        cardId: source.scryfallId ?? normalizeName(source.name),
        name: source.name,
        quantity: source.quantity,
        section: source.section,
      }));

      const tokenParts = (sourceCard.all_parts ?? []).filter(isTokenRelation);

      for (const part of tokenParts) {
        relatedMeta.set(part.id, part);
        relatedSources.set(part.id, [
          ...(relatedSources.get(part.id) ?? []),
          ...sources,
        ]);
      }

      const kind = genericKind(sourceCard);
      if (kind && tokenParts.length === 0) {
        genericSources.set(kind, [
          ...(genericSources.get(kind) ?? []),
          ...sources,
        ]);
      }
    }

    const relatedIds = Array.from(relatedMeta.keys());
    const tokenCards = relatedIds.length
      ? await fetchCollection(relatedIds.map((id) => ({ id })))
      : [];
    const tokenCardById = new Map(tokenCards.map((card) => [card.id, card]));

    const tokenConcepts = new Map<string, DeckTokenItem>();

    for (const [id, part] of relatedMeta) {
      const rawToken = tokenCardById.get(id);
      const card = rawToken ? normalizeScryfallCard(rawToken) : undefined;
      const sources = mergeSources(relatedSources.get(id) ?? []);
      const kind: DeckTokenKind = rawToken?.layout === "emblem"
        ? "emblem"
        : relatedKind(part);

      /*
       * Different source printings can point to different Scryfall token IDs
       * for the same physical token concept (Treasure is the classic case).
       * Group by rules identity instead of Scryfall printing ID so the deck
       * shows one Treasure entry rather than one per set.
       */
      const conceptKey = [
        kind,
        normalizeName(card?.name ?? part.name),
        (card?.typeLine ?? part.type_line ?? "").toLocaleLowerCase("en"),
        (card?.oracleText ?? "").toLocaleLowerCase("en"),
        card?.power ?? "",
        card?.toughness ?? "",
        [...(card?.colors ?? [])].sort().join(""),
      ].join("|");

      const existing = tokenConcepts.get(conceptKey);
      if (existing) {
        const mergedSources = mergeSources([...existing.sources, ...sources]);
        tokenConcepts.set(conceptKey, {
          ...existing,
          card: existing.card ?? card,
          sources: mergedSources,
          sourceCopies: mergedSources.reduce(
            (sum, source) => sum + source.quantity,
            0,
          ),
        });
      } else {
        tokenConcepts.set(conceptKey, {
          id,
          kind,
          name: card?.name ?? part.name,
          card,
          sources,
          sourceCopies: sources.reduce((sum, source) => sum + source.quantity, 0),
        });
      }
    }

    const tokens: DeckTokenItem[] = Array.from(tokenConcepts.values());

    for (const [kind, rawSources] of genericSources) {
      const sources = mergeSources(rawSources);
      tokens.push({
        id: `generic:${kind}`,
        kind,
        name: genericLabel(kind),
        sources,
        sourceCopies: sources.reduce((sum, source) => sum + source.quantity, 0),
      });
    }

    tokens.sort((a, b) => {
      const order: Record<DeckTokenKind, number> = {
        token: 0,
        emblem: 1,
        copy: 2,
        variable: 3,
      };
      return order[a.kind] - order[b.kind] || a.name.localeCompare(b.name, "fr");
    });

    const result: DeckTokenAnalysis = {
      available: true,
      tokens,
      sourceCardCount: new Set(
        input.map((card) => card.scryfallId ?? normalizeName(card.name)),
      ).size,
    };

    analysisCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      value: result,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      available: false,
      tokens: [],
      sourceCardCount: input.length,
      error:
        error instanceof Error
          ? error.message
          : "Impossible d'analyser les tokens du deck.",
    } satisfies DeckTokenAnalysis);
  }
}
