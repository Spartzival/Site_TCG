"use client";

import { useEffect, useRef, useState } from "react";
import type { MtgCard } from "@/types/mtg";
import { autocompleteCards, getCardPrints } from "@/lib/mtg/api-client";

type CardAddDialogProps = {
  open: boolean;
  onClose: () => void;
  onAdd: (card: MtgCard, quantity: number) => void;
};

export default function CardAddDialog({
  open,
  onClose,
  onAdd,
}: CardAddDialogProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [prints, setPrints] = useState<MtgCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<MtgCard | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [searching, setSearching] = useState(false);
  const [loadingPrints, setLoadingPrints] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    const timeout = window.setTimeout(() => inputRef.current?.focus(), 80);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (
      !open ||
      prints.length > 0 ||
      selectedCard ||
      query.trim().length < 2
    ) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearching(true);
      setError(null);

      try {
        const names = await autocompleteCards(query.trim(), controller.signal);
        setSuggestions(names);
      } catch (caughtError) {
        if (controller.signal.aborted) return;
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Recherche impossible.",
        );
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [open, query, prints.length, selectedCard]);

  if (!open) return null;

  const reset = () => {
    setQuery("");
    setSuggestions([]);
    setPrints([]);
    setSelectedCard(null);
    setQuantity(1);
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const selectSuggestion = async (name: string) => {
    setQuery(name);
    setSuggestions([]);
    setPrints([]);
    setSelectedCard(null);
    setLoadingPrints(true);
    setError(null);

    try {
      const result = await getCardPrints(name);
      if (result.length === 0) {
        throw new Error("Aucune version physique trouvée.");
      }

      setPrints(result);
      if (result.length === 1) setSelectedCard(result[0]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Versions introuvables.",
      );
    } finally {
      setLoadingPrints(false);
    }
  };

  const add = () => {
    if (!selectedCard) return;
    onAdd(selectedCard, quantity);
    close();
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
        className="mtg-add-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mtg-add-card-title"
      >
        <div className="mtg-add-dialog__header">
          <div>
            <span>SCRYFALL SEARCH</span>
            <h3 id="mtg-add-card-title">Ajouter une carte</h3>
          </div>
          <button type="button" className="mtg-icon-button" onClick={close}>
            ×
          </button>
        </div>

        <label className="mtg-add-search">
          <span>Nom de la carte</span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            placeholder="Ex. Sol Ring"
            autoComplete="off"
            onChange={(event) => {
              setQuery(event.target.value);
              setPrints([]);
              setSelectedCard(null);
              setError(null);
            }}
          />
        </label>

        {prints.length === 0 &&
          !selectedCard &&
          query.trim().length >= 2 && (
            <div className="mtg-autocomplete" aria-live="polite">
              {searching && (
                <p className="mtg-autocomplete__status">Recherche…</p>
              )}

              {!searching && suggestions.length > 0 && (
                <div className="mtg-autocomplete__list">
                  {suggestions.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => void selectSuggestion(name)}
                    >
                      <span>{name}</span>
                      <span>→</span>
                    </button>
                  ))}
                </div>
              )}

              {!searching && suggestions.length === 0 && !error && (
                <p className="mtg-autocomplete__status">Aucune suggestion.</p>
              )}
            </div>
          )}

        {loadingPrints && (
          <p className="mtg-dialog-message">Chargement des versions…</p>
        )}
        {error && <p className="mtg-dialog-error">{error}</p>}

        {prints.length > 0 && !selectedCard && (
          <div className="mtg-print-selector">
            <div className="mtg-print-selector__header">
              <div>
                <span>VERSION</span>
                <strong>Choisir une impression</strong>
              </div>
              <small>
                {prints.length} version{prints.length > 1 ? "s" : ""}
              </small>
            </div>

            <div className="mtg-print-selector__grid">
              {prints.map((card) => (
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
                  </div>
                </button>
              ))}
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
              <p>{selectedCard.typeLine}</p>
              <p>
                Si cette carte est déjà présente dans le bulk, les nouveaux
                exemplaires seront ajoutés à la quantité existante sans créer
                de doublon.
              </p>

              {prints.length > 1 && (
                <button
                  type="button"
                  className="mtg-change-print-button"
                  onClick={() => setSelectedCard(null)}
                >
                  ← Changer de version
                </button>
              )}

              <label className="mtg-quantity-field">
                <span>Nombre d’exemplaires de cette version</span>
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
                      setQuantity((value) => Math.min(999, value + 1))
                    }
                  >
                    +
                  </button>
                </div>
              </label>
            </div>
          </div>
        )}

        <div className="mtg-add-dialog__footer">
          <button type="button" className="mtg-secondary-button" onClick={close}>
            Annuler
          </button>
          <button
            type="button"
            className="mtg-primary-button"
            disabled={!selectedCard || loadingPrints}
            onClick={add}
          >
            Ajouter à la collection
          </button>
        </div>
      </section>
    </div>
  );
}
