import type { MtgCard } from "@/types/mtg";

export function normalizeCardLookupName(value: string) {
  return value
    .trim()
    .replace(/\s*\/\/\s*/g, " // ")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en");
}

export function logicalCardId(card: Pick<MtgCard, "id" | "oracleId">) {
  return card.oracleId ?? card.id;
}

export function cardFaceNames(card: Pick<MtgCard, "name" | "faces">) {
  const explicit = card.faces?.map((face) => face.name.trim()).filter(Boolean) ?? [];
  if (explicit.length) return explicit;

  const split = card.name
    .split(/\s+\/\/\s+/)
    .map((name) => name.trim())
    .filter(Boolean);

  return split.length > 1 ? split : [card.name.trim()];
}

export function primaryCardName(card: Pick<MtgCard, "name" | "faces">) {
  return cardFaceNames(card)[0] ?? card.name;
}

export function cardNameAliases(card: Pick<MtgCard, "name" | "faces">) {
  return Array.from(
    new Set(
      [card.name, ...cardFaceNames(card)]
        .map(normalizeCardLookupName)
        .filter(Boolean),
    ),
  );
}

export function indexCardsByNameAliases(cards: MtgCard[]) {
  const map = new Map<string, MtgCard[]>();

  for (const card of cards) {
    for (const alias of cardNameAliases(card)) {
      const current = map.get(alias) ?? [];
      if (!current.some((candidate) => candidate.scryfallId === card.scryfallId)) {
        current.push(card);
      }
      map.set(alias, current);
    }
  }

  return map;
}
