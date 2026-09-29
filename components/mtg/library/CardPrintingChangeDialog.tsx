"use client";

import { useEffect, useMemo, useState } from "react";
import { getCardPrints } from "@/lib/mtg/api-client";
import type { CollectionPrinting, MtgCard } from "@/types/mtg";

type Props = {
  open: boolean;
  cardName: string;
  oracleId?: string;
  currentPrintingId: string;
  maxQuantity?: number;
  ownedPrintings?: CollectionPrinting[];
  onClose: () => void;
  onConfirm: (printing: MtgCard, quantity: number) => void;
};

export default function CardPrintingChangeDialog({
  open,
  cardName,
  oracleId,
  currentPrintingId,
  maxQuantity,
  ownedPrintings = [],
  onClose,
  onConfirm,
}: Props) {
  const [prints, setPrints] = useState<MtgCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<MtgCard | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    setPrints([]);
    setSelectedCard(null);
    setQuantity(1);
    setFilter("");
    setError(null);
    setLoading(true);

    const load = async () => {
      try {
        const result = await getCardPrints(cardName, oracleId);

        if (!cancelled) {
          setPrints(
            result.filter((card) => card.scryfallId !== currentPrintingId),
          );
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Impossible de charger les versions.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [open, cardName, oracleId, currentPrintingId]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const ownedByPrinting = useMemo(
    () =>
      new Map(
        ownedPrintings.map((printing) => [
          printing.card.scryfallId,
          printing.quantity,
        ]),
      ),
    [ownedPrintings],
  );

  const visiblePrints = useMemo(() => {
    const normalized = filter.trim().toLocaleLowerCase("fr");

    if (!normalized) return prints;

    return prints.filter((card) =>
      [
        card.setName,
        card.setCode,
        card.collectorNumber,
        card.releasedAt,
        card.language,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("fr")
        .includes(normalized),
    );
  }, [prints, filter]);

  if (!open) return null;

  const maximum = Math.max(1, maxQuantity ?? 1);

  return (
    <div
      className="mtg-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="mtg-add-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mtg-change-printing-title"
      >
        <div className="mtg-add-dialog__header">
          <div>
            <span>SCRYFALL PRINTINGS</span>
            <h3 id="mtg-change-printing-title">Changer la version</h3>
          </div>

          <button type="button" className="mtg-icon-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="mtg-dialog-message">
          <strong>{cardName}</strong>
          <br />
          La carte logique reste identique : seule l&apos;impression physique est
          modifiée.
        </div>

        <label className="mtg-add-search">
          <span>Filtrer les impressions</span>
          <input
            type="search"
            value={filter}
            placeholder="CMM, Commander Masters, 2023…"
            onChange={(event) => setFilter(event.target.value)}
          />
        </label>

        {loading && (
          <p className="mtg-dialog-message">Chargement des versions…</p>
        )}

        {error && <p className="mtg-dialog-error">{error}</p>}

        {!loading && !error && !selectedCard && visiblePrints.length === 0 && (
          <p className="mtg-dialog-message">Aucune autre version trouvée.</p>
        )}

        {!selectedCard && visiblePrints.length > 0 && (
          <div className="mtg-print-selector">
            <div className="mtg-print-selector__header">
              <div>
                <span>VERSION</span>
                <strong>Choisir une impression</strong>
              </div>
              <small>
                {visiblePrints.length} version
                {visiblePrints.length > 1 ? "s" : ""}
              </small>
            </div>

            <div className="mtg-print-selector__grid">
              {visiblePrints.map((card) => {
                const owned = ownedByPrinting.get(card.scryfallId) ?? 0;

                return (
                  <button
                    key={card.scryfallId}
                    type="button"
                    className="mtg-print-card"
                    onClick={() => setSelectedCard(card)}
                  >
                    <div className="mtg-print-card__image">
                      {card.imageUri ? (
                        <img src={card.imageUri} alt="" />
                      ) : (
                        <div>Image indisponible</div>
                      )}
                    </div>

                    <div className="mtg-print-card__info">
                      <strong>{card.setName ?? card.setCode ?? "MTG"}</strong>
                      <span>
                        {card.setCode ?? "—"}
                        {card.collectorNumber
                          ? ` · #${card.collectorNumber}`
                          : ""}
                      </span>
                      {card.releasedAt && <small>{card.releasedAt}</small>}
                      {owned > 0 && <small>Déjà possédée ×{owned}</small>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {selectedCard && (
          <div className="mtg-add-preview">
            <div className="mtg-add-preview__image">
              {selectedCard.imageUri ? (
                <img src={selectedCard.imageUri} alt={selectedCard.name} />
              ) : (
                <div>Image indisponible</div>
              )}
            </div>

            <div className="mtg-add-preview__info">
              <span>
                {selectedCard.setCode ?? "MTG"}
                {selectedCard.collectorNumber
                  ? ` · #${selectedCard.collectorNumber}`
                  : ""}
              </span>
              <h4>{selectedCard.name}</h4>
              <p>{selectedCard.setName}</p>
              {selectedCard.releasedAt && <p>{selectedCard.releasedAt}</p>}

              {(ownedByPrinting.get(selectedCard.scryfallId) ?? 0) > 0 && (
                <p>
                  Déjà possédée ×
                  {ownedByPrinting.get(selectedCard.scryfallId) ?? 0}
                </p>
              )}

              <button
                type="button"
                className="mtg-change-print-button"
                onClick={() => setSelectedCard(null)}
              >
                ← Choisir une autre version
              </button>

              {maxQuantity !== undefined && (
                <label className="mtg-quantity-field">
                  <span>Exemplaires à déplacer vers cette version</span>
                  <div>
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity((value) => Math.max(1, value - 1))
                      }
                    >
                      −
                    </button>
                    <strong>{quantity}</strong>
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity((value) => Math.min(maximum, value + 1))
                      }
                    >
                      +
                    </button>
                  </div>
                  <small>Maximum : {maximum}</small>
                </label>
              )}
            </div>
          </div>
        )}

        <div className="mtg-add-dialog__footer">
          <button type="button" className="mtg-secondary-button" onClick={onClose}>
            Annuler
          </button>

          <button
            type="button"
            className="mtg-primary-button"
            disabled={!selectedCard || loading}
            onClick={() => {
              if (!selectedCard) return;
              onConfirm(selectedCard, maxQuantity !== undefined ? quantity : 1);
            }}
          >
            Confirmer la version
          </button>
        </div>
      </section>
    </div>
  );
}
