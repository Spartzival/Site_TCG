import type { DeckCardEntry, DeckProject } from "@/types/mtg";
import { normalizeDeckFormat } from "@/lib/mtg/deck-format";

type ExportSection = {
  title: string;
  entries: DeckCardEntry[];
};

function exportLine(entry: DeckCardEntry) {
  return `${entry.quantity} ${entry.card.name}`;
}

function sortByName(entries: DeckCardEntry[]) {
  return [...entries].sort((a, b) =>
    a.card.name.localeCompare(b.card.name, "fr", { sensitivity: "base" }),
  );
}

export function exportDeckNames(deck: DeckProject) {
  const format = normalizeDeckFormat(deck.format);
  const sections: ExportSection[] = [
    ...(format === "Commander"
      ? [{ title: "COMMANDANT", entries: deck.commanders }]
      : []),
    {
      title: "DECK",
      entries: deck.cards.filter((entry) => entry.section === "mainboard"),
    },
    {
      title: "SIDEBOARD",
      entries: deck.cards.filter((entry) => entry.section === "sideboard"),
    },
    {
      title: "MAYBEBOARD",
      entries: deck.cards.filter((entry) => entry.section === "maybeboard"),
    },
  ];

  return sections
    .filter((section) => section.entries.length > 0)
    .map((section) => {
      const lines = sortByName(section.entries).map(exportLine);
      return [section.title, ...lines].join("\n");
    })
    .join("\n\n");
}

export async function copyTextToClipboard(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.select();

  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error("Impossible de copier la decklist dans le presse-papiers.");
  }
}
