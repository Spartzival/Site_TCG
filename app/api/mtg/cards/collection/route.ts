import { NextResponse } from "next/server";
import { readJsonResponse } from "@/lib/server/read-json-response";
import type { MtgCard } from "@/types/mtg";
import {
  normalizeScryfallCard,
  SCRYFALL_HEADERS,
  type ScryfallCard,
} from "@/lib/mtg/scryfall";

type CardIdentifier = {
  name?: string;
  set?: string;
  collector_number?: string;
};

type CollectionRequest = {
  names?: string[];
  identifiers?: CardIdentifier[];
};

type ScryfallCollectionResponse = {
  data?: ScryfallCard[];
  not_found?: CardIdentifier[];
  details?: string;
};

const MAX_BATCH = 75;

function normalizeIdentifier(identifier: CardIdentifier): CardIdentifier | null {
  const name = identifier.name?.trim();
  const set = identifier.set?.trim().toLowerCase();
  const collectorNumber = identifier.collector_number?.trim();

  if (set && collectorNumber) {
    return { set, collector_number: collectorNumber };
  }

  if (name && set) {
    return { name, set };
  }

  if (name) {
    return { name };
  }

  return null;
}

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

async function resolveNameFallback(name: string) {
  for (const mode of ["exact", "fuzzy"] as const) {
    const endpoint = new URL("https://api.scryfall.com/cards/named");
    endpoint.searchParams.set(mode, name);

    const response = await fetch(endpoint, {
      headers: SCRYFALL_HEADERS,
      cache: "no-store",
    });

    const payload = await readJsonResponse<ScryfallCard>(
      response,
      `Scryfall collection fallback (${mode})`,
    );

    if (response.ok) return normalizeScryfallCard(payload);
  }

  return null;
}

export async function POST(request: Request) {
  let body: CollectionRequest;

  try {
    body = (await request.json()) as CollectionRequest;
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const rawIdentifiers: CardIdentifier[] = body.identifiers?.length
    ? body.identifiers
    : (body.names ?? []).map((name) => ({ name }));

  const identifiers = rawIdentifiers
    .map(normalizeIdentifier)
    .filter((identifier): identifier is CardIdentifier => Boolean(identifier));

  if (identifiers.length === 0) {
    return NextResponse.json({ cards: [], notFound: [] });
  }

  try {
    const cards: MtgCard[] = [];
    const notFound: string[] = [];

    for (let offset = 0; offset < identifiers.length; offset += MAX_BATCH) {
      const batch = identifiers.slice(offset, offset + MAX_BATCH);

      const response = await fetch("https://api.scryfall.com/cards/collection", {
        method: "POST",
        headers: {
          ...SCRYFALL_HEADERS,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ identifiers: batch }),
        cache: "no-store",
      });

      const payload = await readJsonResponse<ScryfallCollectionResponse>(response, "Scryfall collection");

      if (!response.ok) {
        return NextResponse.json(
          { error: payload.details ?? "Impossible de charger les cartes." },
          { status: response.status },
        );
      }

      cards.push(...(payload.data ?? []).map(normalizeScryfallCard));

      /*
       * Scryfall collection lookup is optimized for canonical card names.
       * A deck export can contain only one face name of a multi-faced card.
       * Resolve those misses through /cards/named and still return ONE card.
       */
      for (const missingIdentifier of payload.not_found ?? []) {
        if (missingIdentifier.name) {
          const fallback = await resolveNameFallback(missingIdentifier.name);
          if (fallback) {
            if (!cards.some((card) => card.scryfallId === fallback.scryfallId)) {
              cards.push(fallback);
            }
            await new Promise((resolve) => setTimeout(resolve, 110));
            continue;
          }
        }

        notFound.push(identifierLabel(missingIdentifier));
      }

      if (offset + MAX_BATCH < identifiers.length) {
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
    }

    return NextResponse.json({ cards, notFound });
  } catch {
    return NextResponse.json(
      { error: "Scryfall est momentanément inaccessible." },
      { status: 502 },
    );
  }
}
