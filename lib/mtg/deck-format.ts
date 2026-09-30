import type { DeckFormat, DeckProject } from "@/types/mtg";

export function normalizeDeckFormat(value: string | undefined | null): DeckFormat {
  return value?.toLocaleLowerCase("en") === "standard" ? "Standard" : "Commander";
}

export function isCommanderDeck(deck: Pick<DeckProject, "format">) {
  return normalizeDeckFormat(deck.format) === "Commander";
}

export function isStandardDeck(deck: Pick<DeckProject, "format">) {
  return normalizeDeckFormat(deck.format) === "Standard";
}

export function formatDeckTarget(format: DeckFormat) {
  return format === "Commander" ? 100 : 60;
}
