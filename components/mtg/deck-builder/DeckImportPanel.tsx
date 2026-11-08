"use client";

import { useEffect, useMemo, useState } from "react";
import { parseDeckText } from "@/lib/mtg/deck-parser";
import type { DeckCardEntry, DeckFormat } from "@/types/mtg";
import { resolveCardCollection } from "@/lib/mtg/api-client";
import {
  cardNameAliases,
  indexCardsByNameAliases,
  normalizeCardLookupName,
} from "@/lib/mtg/card-identity";

type Props = {
  format: DeckFormat;
  currentCards: DeckCardEntry[];
  currentCommanders?: DeckCardEntry[];
  onImport: (entries: DeckCardEntry[], commanders: DeckCardEntry[]) => void;
};

type ExistingPreview = {
  key: string;
  name: string;
  importedQuantity: number;
  currentQuantity: number;
  importedSection: DeckCardEntry["section"];
  currentSection: DeckCardEntry["section"];
};

function sectionLabel(section: DeckCardEntry["section"]) {
  switch (section) {
    case "commander":
      return "Commandant";
    case "sideboard":
      return "Sideboard";
    case "maybeboard":
      return "Maybeboard";
    default:
      return "Deck principal";
  }
}

export default function DeckImportPanel({
  format,
  currentCards,
  currentCommanders = [],
  onImport,
}: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, loading]);

  const parsedPreview = useMemo(() => parseDeckText(text), [text]);

  const existingPreview = useMemo<ExistingPreview[]>(() => {
    if (!parsedPreview.entries.length) return [];

    const currentEntries = [...currentCommanders, ...currentCards];
    const aliasMap = new Map<string, DeckCardEntry[]>();

    for (const entry of currentEntries) {
      for (const alias of cardNameAliases(entry.card)) {
        const list = aliasMap.get(alias) ?? [];
        list.push(entry);
        aliasMap.set(alias, list);
      }
    }

    const aggregated = new Map<string, ExistingPreview>();

    for (const parsedEntry of parsedPreview.entries) {
      const importedSection: DeckCardEntry["section"] =
        format === "Standard" && parsedEntry.section === "commander"
          ? "mainboard"
          : parsedEntry.section;

      const matches = aliasMap.get(normalizeCardLookupName(parsedEntry.name)) ?? [];
      if (!matches.length) continue;

      // A same-section match is the one that will actually merge on import.
      // If there is none, still show the existing copy in another zone so the
      // user knows the logical card is already somewhere in the deck.
      const preferredMatches = matches.some((entry) => entry.section === importedSection)
        ? matches.filter((entry) => entry.section === importedSection)
        : matches;

      for (const current of preferredMatches) {
        const key = `${normalizeCardLookupName(current.card.name)}:${importedSection}:${current.section}`;
        const previous = aggregated.get(key);

        aggregated.set(key, {
          key,
          name: current.card.name,
          importedQuantity: (previous?.importedQuantity ?? 0) + parsedEntry.quantity,
          currentQuantity: current.quantity,
          importedSection,
          currentSection: current.section,
        });
      }
    }

    return Array.from(aggregated.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [currentCards, currentCommanders, format, parsedPreview.entries]);

  const close = () => {
    if (loading) return;
    setOpen(false);
    setMessage(null);
  };

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
          entries.push({
            card,
            quantity: parsedEntry.quantity,
            section: "mainboard",
          });
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
        ...(payload.notFound ?? []).map((name) => `Introuvable : ${name}`),
        ...parsed.ignored.map((line) => `Ignorée : ${line}`),
      ];

      setMessage(
        `${entries.length + commanders.length} ligne(s) importée(s)` +
          (warnings.length ? ` · ${warnings.length} avertissement(s)` : ""),
      );

      if (entries.length + commanders.length > 0) {
        setText("");
        window.setTimeout(() => {
          setOpen(false);
          setMessage(null);
        }, 650);
      }
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
        onClick={() => {
          setOpen(true);
          setMessage(null);
        }}
      >
        Importer une liste
      </button>

      {open && (
        <div
          className="mtg-deck-import__backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <section
            className="mtg-deck-import__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mtg-deck-import-title"
          >
            <div className="mtg-deck-import__header">
              <div>
                <span>DECKLIST IMPORT</span>
                <h3 id="mtg-deck-import-title">Importer une liste {format}</h3>
              </div>

              <button
                type="button"
                className="mtg-icon-button"
                onClick={close}
                disabled={loading}
                aria-label="Fermer l'import"
              >
                ×
              </button>
            </div>

            <div className="mtg-deck-import__body">
              <label>
                <span>Decklist texte</span>
                <textarea
                  value={text}
                  autoFocus
                  placeholder={
                    format === "Commander"
                      ? `// Commander\n1 Kona, Rescue Beastie\n\n// Main\n1 Sol Ring\n1 Llanowar Elves\n...`
                      : `// Main\n4 Llanowar Elves\n4 Lightning Strike\n24 Forest\n...\n\n// Sideboard\n2 Duress\n...`
                  }
                  onChange={(event) => {
                    setText(event.target.value);
                    setMessage(null);
                  }}
                />
              </label>

              <div className="mtg-deck-import__help">
                <span>Formats acceptés</span>
                <code>1 Sol Ring</code>
                <code>1x Sol Ring</code>
                <small>
                  Les sections Commander / Main / Sideboard sont reconnues quand elles
                  sont présentes dans la liste.
                </small>
              </div>

              {text.trim() && (
                <div className="mtg-deck-import__preview-summary">
                  <div>
                    <span>Lignes détectées</span>
                    <strong>{parsedPreview.entries.length}</strong>
                  </div>
                  <div className={existingPreview.length ? "has-existing" : ""}>
                    <span>Déjà présentes</span>
                    <strong>{existingPreview.length}</strong>
                  </div>
                  <div>
                    <span>Lignes ignorées</span>
                    <strong>{parsedPreview.ignored.length}</strong>
                  </div>
                </div>
              )}

              {existingPreview.length > 0 && (
                <section className="mtg-deck-import__existing">
                  <div className="mtg-deck-import__existing-heading">
                    <div>
                      <span>DÉJÀ PRÉSENTES DANS CE DECK</span>
                      <strong>
                        Ces cartes seront fusionnées avec les exemplaires existants.
                      </strong>
                    </div>
                    <span>{existingPreview.length}</span>
                  </div>

                  <div className="mtg-deck-import__existing-list">
                    {existingPreview.map((existing) => {
                      const sameSection = existing.currentSection === existing.importedSection;
                      return (
                        <div key={existing.key} className="mtg-deck-import__existing-row">
                          <div>
                            <strong>{existing.name}</strong>
                            <small>
                              {sectionLabel(existing.currentSection)}
                              {!sameSection
                                ? ` · import prévu dans ${sectionLabel(existing.importedSection)}`
                                : ""}
                            </small>
                          </div>

                          <div className="mtg-deck-import__existing-quantity">
                            <span>Actuel</span>
                            <strong>{existing.currentQuantity}</strong>
                            <span>+</span>
                            <strong className="is-incoming">{existing.importedQuantity}</strong>
                            {sameSection && (
                              <>
                                <span>=</span>
                                <strong>{existing.currentQuantity + existing.importedQuantity}</strong>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {message && <p className="mtg-deck-import__message">{message}</p>}
            </div>

            <div className="mtg-deck-import__actions">
              <button
                type="button"
                className="mtg-secondary-button"
                onClick={close}
                disabled={loading}
              >
                Annuler
              </button>

              <button
                type="button"
                className="mtg-primary-button"
                disabled={loading || !text.trim()}
                onClick={() => void runImport()}
              >
                {loading ? "Import…" : "Importer"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
