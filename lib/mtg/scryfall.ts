import type { MtgCard, MtgCardFace, MtgLegality } from "@/types/mtg";

export const SCRYFALL_HEADERS = {
  Accept: "application/json",
  "User-Agent": "CardProjects/0.2 (personal MTG collection manager)",
};

export type ScryfallFace = {
  name?: string;
  image_uris?: { normal?: string; large?: string };
  oracle_text?: string;
  mana_cost?: string;
  type_line?: string;
  power?: string;
  toughness?: string;
  colors?: string[];
};

export type ScryfallCard = {
  id: string;
  oracle_id?: string;
  name: string;
  mana_cost?: string;
  cmc?: number;
  type_line?: string;
  oracle_text?: string;
  image_uris?: { normal?: string; large?: string };
  card_faces?: ScryfallFace[];
  colors?: string[];
  color_identity?: string[];
  keywords?: string[];
  legalities?: Record<string, MtgLegality>;
  set?: string;
  set_name?: string;
  collector_number?: string;
  rarity?: string;
  power?: string;
  toughness?: string;
  released_at?: string;
  lang?: string;
  details?: string;
};

export function normalizeScryfallCard(card: ScryfallCard): MtgCard {
  const rawFaces = card.card_faces ?? [];
  const firstFace = rawFaces[0];

  const faces: MtgCardFace[] | undefined = rawFaces.length
    ? rawFaces
        .filter((face): face is ScryfallFace & { name: string } => Boolean(face.name))
        .map((face) => ({
          name: face.name,
          manaCost: face.mana_cost,
          typeLine: face.type_line,
          oracleText: face.oracle_text,
          imageUri:
            face.image_uris?.normal ??
            face.image_uris?.large,
          colors: face.colors ?? [],
          power: face.power,
          toughness: face.toughness,
        }))
    : undefined;

  const imageUri =
    card.image_uris?.normal ??
    card.image_uris?.large ??
    firstFace?.image_uris?.normal ??
    firstFace?.image_uris?.large;

  /*
   * For deck construction, a multi-faced object is still one physical card.
   * We keep the first/front face as the primary characteristics used by local
   * deck stats, while preserving every face in `faces` for lookup/display.
   */
  const primaryTypeLine = card.type_line ?? firstFace?.type_line;
  const primaryOracleText = card.oracle_text ?? firstFace?.oracle_text;
  const primaryManaCost = card.mana_cost ?? firstFace?.mana_cost;

  const colors =
    card.colors ??
    Array.from(new Set(rawFaces.flatMap((face) => face.colors ?? [])));

  return {
    id: card.oracle_id ?? card.id,
    scryfallId: card.id,
    oracleId: card.oracle_id,
    name: card.name,
    manaCost: primaryManaCost,
    manaValue: card.cmc,
    typeLine: primaryTypeLine,
    oracleText: primaryOracleText,
    imageUri,
    colors,
    colorIdentity: card.color_identity ?? [],
    keywords: card.keywords ?? [],
    legalities: card.legalities ?? {},
    setCode: card.set?.toUpperCase(),
    setName: card.set_name,
    collectorNumber: card.collector_number,
    rarity: card.rarity,
    power: card.power ?? firstFace?.power,
    toughness: card.toughness ?? firstFace?.toughness,
    releasedAt: card.released_at,
    language: card.lang,
    faces,
  };
}
