import type { MtgCard } from "@/types/mtg";
import {
  normalizeScryfallCard,
  type ScryfallCard,
} from "@/lib/mtg/scryfall";
import { fetchJson } from "@/lib/http/fetch-json";

type ErrorPayload = {
  error?: string;
  details?: string;
};

type AutocompletePayload = ErrorPayload & {
  data?: string[];
};

type NamedPayload = ErrorPayload & {
  card?: MtgCard;
};

type PrintsPayload = ErrorPayload & {
  cards?: MtgCard[];
};

type ScryfallListPayload = ErrorPayload & {
  data?: ScryfallCard[];
  has_more?: boolean;
  next_page?: string;
};

export type CardIdentifier = {
  name?: string;
  set?: string;
  collector_number?: string;
};

export type CardCollectionPayload = ErrorPayload & {
  cards?: MtgCard[];
  notFound?: string[];
};

type ScryfallCollectionPayload = ErrorPayload & {
  data?: ScryfallCard[];
  not_found?: CardIdentifier[];
};

const SCRYFALL_BROWSER_HEADERS = {
  Accept: "application/json",
};

function identifierLabel(identifier: CardIdentifier) {
  if (identifier.name && identifier.set) {
    return `${identifier.name} (${identifier.set.toUpperCase()})`;
  }
  if (identifier.name) return identifier.name;
  if (identifier.set && identifier.collector_number) {
    return `${identifier.set.toUpperCase()} #${identifier.collector_number}`;
  }
  return "Carte inconnue";
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function autocompleteCards(
  query: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const cleanQuery = query.trim();
  if (cleanQuery.length < 2) return [];

  try {
    const local = await fetchJson<AutocompletePayload>(
      `/api/mtg/cards/autocomplete?q=${encodeURIComponent(cleanQuery)}`,
      { signal },
    );
    return local.data ?? [];
  } catch (localError) {
    if (signal?.aborted) throw localError;

    const endpoint = new URL("https://api.scryfall.com/cards/autocomplete");
    endpoint.searchParams.set("q", cleanQuery);
    endpoint.searchParams.set("include_extras", "false");

    const direct = await fetchJson<AutocompletePayload>(endpoint, {
      signal,
      headers: SCRYFALL_BROWSER_HEADERS,
    });

    return direct.data ?? [];
  }
}

export async function getNamedCard(name: string): Promise<MtgCard> {
  try {
    const local = await fetchJson<NamedPayload>(
      `/api/mtg/cards/named?name=${encodeURIComponent(name)}`,
    );
    if (!local.card) throw new Error("Carte introuvable.");
    return local.card;
  } catch {
    const exactEndpoint = new URL("https://api.scryfall.com/cards/named");
    exactEndpoint.searchParams.set("exact", name);

    try {
      const direct = await fetchJson<ScryfallCard>(exactEndpoint, {
        headers: SCRYFALL_BROWSER_HEADERS,
      });
      return normalizeScryfallCard(direct);
    } catch {
      const fuzzyEndpoint = new URL("https://api.scryfall.com/cards/named");
      fuzzyEndpoint.searchParams.set("fuzzy", name);

      const direct = await fetchJson<ScryfallCard>(fuzzyEndpoint, {
        headers: SCRYFALL_BROWSER_HEADERS,
      });
      return normalizeScryfallCard(direct);
    }
  }
}

export async function getCardPrints(
  name: string,
  oracleId?: string,
): Promise<MtgCard[]> {
  try {
    const params = new URLSearchParams();
    params.set("name", name);
    if (oracleId) params.set("oracleId", oracleId);

    const local = await fetchJson<PrintsPayload>(
      `/api/mtg/cards/prints?${params.toString()}`,
    );

    const cards = local.cards ?? [];
    return oracleId
      ? cards.filter((card) => card.oracleId === oracleId)
      : cards;
  } catch {
    const escapedName = name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const endpoint = new URL("https://api.scryfall.com/cards/search");

    endpoint.searchParams.set(
      "q",
      oracleId
        ? `oracleid:${oracleId} game:paper`
        : `!"${escapedName}" game:paper`,
    );
    endpoint.searchParams.set("unique", "prints");
    endpoint.searchParams.set("order", "released");
    endpoint.searchParams.set("dir", "desc");

    const cards: MtgCard[] = [];
    let nextUrl: string | null = endpoint.toString();

    while (nextUrl) {
      const page: ScryfallListPayload = await fetchJson<ScryfallListPayload>(nextUrl, {
        headers: SCRYFALL_BROWSER_HEADERS,
      });

      cards.push(...(page.data ?? []).map(normalizeScryfallCard));

      if (page.has_more && page.next_page) {
        nextUrl = page.next_page;
        await sleep(120);
      } else {
        nextUrl = null;
      }
    }

    return oracleId
      ? cards.filter((card) => card.oracleId === oracleId)
      : cards;
  }
}

export async function resolveCardCollection(
  identifiers: CardIdentifier[],
): Promise<CardCollectionPayload> {
  try {
    return await fetchJson<CardCollectionPayload>("/api/mtg/cards/collection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifiers }),
    });
  } catch {
    const cards: MtgCard[] = [];
    const notFound: string[] = [];
    const MAX_BATCH = 75;

    for (let offset = 0; offset < identifiers.length; offset += MAX_BATCH) {
      const batch = identifiers.slice(offset, offset + MAX_BATCH);
      const payload = await fetchJson<ScryfallCollectionPayload>(
        "https://api.scryfall.com/cards/collection",
        {
          method: "POST",
          headers: {
            ...SCRYFALL_BROWSER_HEADERS,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ identifiers: batch }),
        },
      );

      cards.push(...(payload.data ?? []).map(normalizeScryfallCard));

      for (const missingIdentifier of payload.not_found ?? []) {
        if (missingIdentifier.name) {
          try {
            const fallback = await getNamedCard(missingIdentifier.name);
            if (!cards.some((card) => card.scryfallId === fallback.scryfallId)) {
              cards.push(fallback);
            }
            await sleep(120);
            continue;
          } catch {
            // Keep the identifier in notFound below.
          }
        }

        notFound.push(identifierLabel(missingIdentifier));
      }

      if (offset + MAX_BATCH < identifiers.length) {
        await sleep(120);
      }
    }

    return { cards, notFound };
  }
}
