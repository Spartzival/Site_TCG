"use client";

import { useState } from "react";
import { parseDeckText } from "@/lib/mtg/deck-parser";
import type { DeckCardEntry, DeckFormat } from "@/types/mtg";
import { resolveCardCollection } from "@/lib/mtg/api-client";
import { indexCardsByNameAliases, normalizeCardLookupName } from "@/lib/mtg/card-identity";

type Props = {
  format: DeckFormat;
  onImport: (entries: DeckCardEntry[], commanders: DeckCardEntry[]) => void;
};

export default function DeckImportPanel({ format, onImport }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const runImport = async () => {
    const parsed = parseDeckText(text);
    if (parsed.entries.length === 0) {
      setMessage("Aucune ligne de deck valide détectée.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const names = Array.from(new Set(parsed.entries.map((entry) => entry.name)));
      const payload = await resolveCardCollection(names.map((name) => ({ name })));
      const byName = indexCardsByNameAliases(payload.cards ?? []);

      const entries: DeckCardEntry[] = [];
      const commanders: DeckCardEntry[] = [];

      for (const parsedEntry of parsed.entries) {
        const card = byName.get(normalizeCardLookupName(parsedEntry.name))?.[0];
        if (!card) continue;

        if (format === "Standard" && parsedEntry.section === "commander") {
          entries.push({ card, quantity: parsedEntry.quantity, section: "mainboard" });
          continue;
        }

        const entry: DeckCardEntry = {
          card,
          quantity: parsedEntry.quantity,
          section: parsedEntry.section,
        };

        if (parsedEntry.section === "commander") commanders.push(entry);
        else entries.push(entry);
      }

      onImport(entries, commanders);

      const warnings = [
        ...(payload.notFound ?? []).map((name) => `Introuvable: ${name}`),
        ...parsed.ignored.map((line) => `Ignorée: ${line}`),
      ];

      setMessage(
        `${entries.length + commanders.length} ligne(s) importée(s)` +
          (warnings.length ? ` · ${warnings.length} avertissement(s)` : ""),
      );
      setText("");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Import impossible.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mtg-deck-import">
      <button
        type="button"
        className="mtg-secondary-button"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Fermer l'import" : "Importer une liste"}
      </button>

      {open && (
        <div className="mtg-deck-import__panel">
          <label>
            <span>Decklist texte</span>
            <textarea
              value={text}
              placeholder={
                format === "Commander"
                  ? `// Commander\n1 Kona, Rescue Beastie\n\n// Main\n1 Sol Ring\n1 Llanowar Elves\n...`
                  : `// Main\n4 Llanowar Elves\n4 Lightning Strike\n24 Forest\n...\n\n// Sideboard\n2 Duress\n...`
              }
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          <div className="mtg-deck-import__actions">
            <small>Formats acceptés : “1 Sol Ring” ou “1x Sol Ring”.</small>
            <button
              type="button"
              className="mtg-primary-button"
              disabled={loading || !text.trim()}
              onClick={() => void runImport()}
            >
              {loading ? "Import…" : "Importer"}
            </button>
          </div>
          {message && <p className="mtg-deck-import__message">{message}</p>}
        </div>
      )}
    </div>
  );
}
