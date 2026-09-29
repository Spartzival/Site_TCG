"use client";

import { useEffect, useMemo, useState } from "react";
import { parseCollectionText } from "@/lib/mtg/collection-parser";
import type { MtgCard } from "@/types/mtg";
import { resolveCardCollection } from "@/lib/mtg/api-client";
import { indexCardsByNameAliases, normalizeCardLookupName } from "@/lib/mtg/card-identity";

type ImportItem = {
  card: MtgCard;
  quantity: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onImport: (items: ImportItem[]) => void;
};


function printingKey(card: MtgCard) {
  return `${card.setCode?.toLowerCase() ?? ""}:${card.collectorNumber ?? ""}`;
}

export default function CollectionImportDialog({ open, onClose, onImport }: Props) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const parsed = useMemo(() => parseCollectionText(text), [text]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const close = () => {
    setText("");
    setMessage(null);
    onClose();
  };

  const runImport = async () => {
    if (parsed.entries.length === 0) {
      setMessage("Aucune ligne de collection valide détectée.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const identifiers = parsed.entries.map((entry) => {
        if (entry.setCode && entry.collectorNumber) {
          return {
            set: entry.setCode,
            collector_number: entry.collectorNumber,
          };
        }

        if (entry.setCode) {
          return {
            name: entry.name,
            set: entry.setCode,
          };
        }

        return { name: entry.name };
      });

      const payload = await resolveCardCollection(identifiers);

      const cards = payload.cards ?? [];
      const availableByName = indexCardsByNameAliases(cards);
      const availableByPrinting = new Map<string, MtgCard>();

      for (const card of cards) {
        availableByPrinting.set(printingKey(card), card);
      }

      const items: ImportItem[] = [];

      for (const entry of parsed.entries) {
        let card: MtgCard | undefined;

        if (entry.setCode && entry.collectorNumber) {
          card = availableByPrinting.get(
            `${entry.setCode.toLowerCase()}:${entry.collectorNumber}`,
          );
        }

        if (!card) {
          const candidates =
            availableByName.get(normalizeCardLookupName(entry.name)) ?? [];

          card = entry.setCode
            ? candidates.find(
                (candidate) =>
                  candidate.setCode?.toLowerCase() === entry.setCode?.toLowerCase(),
              )
            : candidates[0];
        }

        if (card) items.push({ card, quantity: entry.quantity });
      }

      onImport(items);

      const warnings = [
        ...(payload.notFound ?? []).map((name) => `Introuvable : ${name}`),
        ...parsed.ignored.map((line) => `Ignorée : ${line}`),
      ];

      setMessage(
        `${items.length} ligne(s) importée(s)` +
          (warnings.length ? ` · ${warnings.length} avertissement(s)` : ""),
      );

      if (items.length > 0) {
        window.setTimeout(close, 550);
      }
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Import impossible.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="mtg-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        className="mtg-add-dialog mtg-collection-import-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mtg-import-collection-title"
      >
        <div className="mtg-add-dialog__header">
          <div>
            <span>BULK IMPORT</span>
            <h3 id="mtg-import-collection-title">Importer une liste de cartes</h3>
          </div>
          <button type="button" className="mtg-icon-button" onClick={close}>
            ×
          </button>
        </div>

        <label className="mtg-collection-import__field">
          <span>Liste de collection</span>
          <textarea
            value={text}
            autoFocus
            placeholder={`2 Sol Ring\n1 Arcane Signet\n1 Ancient Copper Dragon (CLB) 161\n3 Swords to Plowshares`}
            onChange={(event) => setText(event.target.value)}
          />
        </label>

        <div className="mtg-collection-import__preview">
          <span>{parsed.entries.length} ligne(s) reconnue(s)</span>
          <span>
            {parsed.entries.reduce((sum, entry) => sum + entry.quantity, 0)} exemplaire(s)
          </span>
          <span>{parsed.ignored.length} ignorée(s)</span>
        </div>

        <div className="mtg-collection-import__help">
          <strong>Formats acceptés</strong>
          <code>2 Sol Ring</code>
          <code>2x Sol Ring</code>
          <code>1 Sol Ring (CMM) 396</code>
          <p>
            Avec set + numéro, l’impression exacte est conservée. Sans version,
            Scryfall choisit une impression de référence.
          </p>
        </div>

        {message && <p className="mtg-deck-import__message">{message}</p>}

        <div className="mtg-add-dialog__footer">
          <button type="button" className="mtg-secondary-button" onClick={close}>
            Annuler
          </button>
          <button
            type="button"
            className="mtg-primary-button"
            disabled={loading || parsed.entries.length === 0}
            onClick={() => void runImport()}
          >
            {loading ? "Import…" : "Ajouter au bulk"}
          </button>
        </div>
      </section>
    </div>
  );
}
