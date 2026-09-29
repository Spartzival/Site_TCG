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

/**
 * Scryfall exposes a combined `type_line` for modal/transform DFCs.
 * For deck statistics and folders, however, the physical card's front face is
 * the primary face. Old collection entries may not yet have `layout`, so the
 * presence of per-face images is also used to recognize a real double-faced
 * card (split/adventure cards normally use one shared image instead).
 */
export function isPhysicalDoubleFacedCard(
  card: Pick<MtgCard, "layout" | "faces">,
) {
  const layout = card.layout ?? "";
  if (
    layout === "modal_dfc" ||
    layout === "transform" ||
    layout === "reversible_card" ||
    layout === "double_faced_token"
  ) {
    return true;
  }

  const faces = card.faces ?? [];
  return faces.length >= 2 && faces.every((face) => Boolean(face.imageUri));
}

export function primaryCardName(card: Pick<MtgCard, "name" | "faces">) {
  return cardFaceNames(card)[0] ?? card.name;
}

export function primaryCardTypeLine(
  card: Pick<MtgCard, "typeLine" | "layout" | "faces">,
) {
  if (isPhysicalDoubleFacedCard(card)) {
    return card.faces?.[0]?.typeLine ?? card.typeLine ?? "";
  }

  return card.typeLine ?? card.faces?.[0]?.typeLine ?? "";
}

export function primaryCardOracleText(
  card: Pick<MtgCard, "oracleText" | "layout" | "faces">,
) {
  if (isPhysicalDoubleFacedCard(card)) {
    return card.faces?.[0]?.oracleText ?? card.oracleText ?? "";
  }

  return card.oracleText ?? card.faces?.[0]?.oracleText ?? "";
}

export function primaryCardManaCost(
  card: Pick<MtgCard, "manaCost" | "layout" | "faces">,
) {
  if (isPhysicalDoubleFacedCard(card)) {
    return card.faces?.[0]?.manaCost ?? card.manaCost ?? "";
  }

  return card.manaCost ?? card.faces?.[0]?.manaCost ?? "";
}

export function allCardOracleTexts(card: Pick<MtgCard, "oracleText" | "faces">) {
  const faceTexts = card.faces?.map((face) => face.oracleText).filter(Boolean) ?? [];
  if (faceTexts.length) return faceTexts as string[];
  return card.oracleText ? [card.oracleText] : [];
}

export function allCardTypeLines(card: Pick<MtgCard, "typeLine" | "faces">) {
  const faceTypes = card.faces?.map((face) => face.typeLine).filter(Boolean) ?? [];
  if (faceTypes.length) return faceTypes as string[];
  return card.typeLine ? [card.typeLine] : [];
}

export function isPureLandCard(card: Pick<MtgCard, "typeLine" | "faces">) {
  const types = allCardTypeLines(card);
  return types.length > 0 && types.every((type) => type.includes("Land"));
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
