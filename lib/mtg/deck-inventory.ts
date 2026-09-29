import type { CollectionCard, DeckProject, MtgCard } from "@/types/mtg";

export function logicalCardId(card: Pick<MtgCard, "id" | "oracleId">) {
  return card.oracleId ?? card.id;
}

/**
 * Physical copies already committed to READY decks other than the deck being
 * viewed. Maybeboard/sideboard entries are intentionally ignored because they
 * are not part of the actual 100-card Commander deck.
 */
export function buildReservedReadyCopies(
  decks: DeckProject[],
  currentDeckId?: string,
) {
  const reserved = new Map<string, number>();

  for (const deck of decks) {
    if (deck.status !== "active" || deck.id === currentDeckId) continue;

    const entries = [
      ...deck.commanders,
      ...deck.cards.filter((entry) => entry.section === "mainboard"),
    ];

    for (const entry of entries) {
      const id = logicalCardId(entry.card);
      reserved.set(id, (reserved.get(id) ?? 0) + entry.quantity);
    }
  }

  return reserved;
}

export function buildAvailableCopies(
  collection: CollectionCard[],
  decks: DeckProject[],
  currentDeckId?: string,
) {
  const reserved = buildReservedReadyCopies(decks, currentDeckId);
  const available = new Map<string, number>();

  for (const item of collection) {
    const id = item.id;
    available.set(id, Math.max(0, item.quantity - (reserved.get(id) ?? 0)));
  }

  return { available, reserved };
}

export function countPhysicalMissingCopies(
  deck: DeckProject,
  available: Map<string, number>,
) {
  const needed = new Map<string, number>();

  const entries = [
    ...deck.commanders,
    ...deck.cards.filter((entry) => entry.section === "mainboard"),
  ];

  for (const entry of entries) {
    const id = logicalCardId(entry.card);
    needed.set(id, (needed.get(id) ?? 0) + entry.quantity);
  }

  let missing = 0;
  for (const [id, quantity] of needed) {
    missing += Math.max(0, quantity - (available.get(id) ?? 0));
  }

  return missing;
}
