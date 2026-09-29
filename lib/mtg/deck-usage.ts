import type { DeckProject, DeckSection } from "@/types/mtg";

export type CardDeckLocation = {
  deckId: string;
  deckName: string;
  deckSlug: string;
  status: "active" | "building";
  quantity: number;
  sections: DeckSection[];
};

function getCardId(card: { id: string; oracleId?: string }) {
  return card.oracleId ?? card.id;
}

export function buildDeckLocations(decks: DeckProject[]) {
  const locations = new Map<string, CardDeckLocation[]>();

  for (const deck of decks) {
    if (deck.status !== "active" && deck.status !== "building") continue;

    const entries = [...deck.commanders, ...deck.cards];
    const deckCards = new Map<
      string,
      { quantity: number; sections: Set<DeckSection> }
    >();

    for (const entry of entries) {
      const cardId = getCardId(entry.card);
      const existing = deckCards.get(cardId);

      if (existing) {
        existing.quantity += entry.quantity;
        existing.sections.add(entry.section);
      } else {
        deckCards.set(cardId, {
          quantity: entry.quantity,
          sections: new Set([entry.section]),
        });
      }
    }

    for (const [cardId, usage] of deckCards) {
      const current = locations.get(cardId) ?? [];

      current.push({
        deckId: deck.id,
        deckName: deck.name,
        deckSlug: deck.slug,
        status: deck.status,
        quantity: usage.quantity,
        sections: [...usage.sections],
      });

      locations.set(cardId, current);
    }
  }

  for (const entries of locations.values()) {
    entries.sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      return a.deckName.localeCompare(b.deckName);
    });
  }

  return locations;
}

export function getUsedQuantity(locations: CardDeckLocation[]) {
  return locations
    .filter((location) => location.status === "active")
    .reduce((sum, location) => sum + location.quantity, 0);
}

export function getPlannedQuantity(locations: CardDeckLocation[]) {
  return locations
    .filter((location) => location.status === "building")
    .reduce((sum, location) => sum + location.quantity, 0);
}
