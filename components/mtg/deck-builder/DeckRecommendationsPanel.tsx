"use client";

import { useEffect, useState } from "react";
import type {
  CollectionCard,
  DeckCardSuggestion,
  DeckRecommendations,
  MtgCard,
} from "@/types/mtg";
import { logicalCardId } from "@/lib/mtg/deck-inventory";

type Props = {
  analysis: DeckRecommendations | null;
  loading: boolean;
  collection: CollectionCard[];
  readOnly?: boolean;
  onAddCard?: (card: MtgCard) => void;
};

const KIND_LABELS: Record<DeckCardSuggestion["kinds"][number], string> = {
  "commander-synergy": "Synergie commandant",
  "role-gap": "Besoin du deck",
  staple: "Valeur sûre",
};

const ROLE_LABELS: Record<string, string> = {
  ramp: "Ramp",
  draw: "Pioche",
  removal: "Removal",
  "board-wipe": "Wrath",
  tutor: "Tutor",
  recursion: "Récursion",
  protection: "Protection",
  counterspell: "Counter",
  evasion: "Évasion",
  "tax-stax": "Tax / Stax",
  tokens: "Tokens",
  sacrifice: "Sacrifice",
  "lifegain-drain": "Gain / Drain",
  "graveyard-hate": "Hate cimetière",
  blink: "Blink",
  discard: "Défausse",
  mill: "Meule",
  finisher: "Finisher",
};

function ownedQuantity(collection: CollectionCard[], card: MtgCard) {
  const id = logicalCardId(card);
  return collection.find((item) => item.id === id)?.quantity ?? 0;
}

function SuggestionPreview({
  suggestion,
  collection,
  readOnly,
  onAddCard,
  onClose,
}: {
  suggestion: DeckCardSuggestion;
  collection: CollectionCard[];
  readOnly: boolean;
  onAddCard?: (card: MtgCard) => void;
  onClose: () => void;
}) {
  const card = suggestion.card;
  const owned = ownedQuantity(collection, card);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="mtg-suggestion-preview-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        className="mtg-suggestion-preview"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mtg-suggestion-preview-title"
      >
        <div className="mtg-suggestion-preview__topbar">
          <div>
            <span>CARTE SUGGÉRÉE</span>
            <strong>{owned > 0 ? `Dans ton bulk ×${owned}` : "Non possédée"}</strong>
          </div>

          <button
            type="button"
            className="mtg-suggestion-preview__close"
            onClick={onClose}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="mtg-suggestion-preview__layout">
          <div className="mtg-suggestion-preview__image">
            {card.imageUri ? (
              <img src={card.imageUri} alt={card.name} />
            ) : (
              <span>Image indisponible</span>
            )}
          </div>

          <div className="mtg-suggestion-preview__content">
            <header>
              <span>{card.manaCost}</span>
              <h3 id="mtg-suggestion-preview-title">{card.name}</h3>
              <p>{card.typeLine}</p>
            </header>

            <div className="mtg-recommendation-card__tags">
              {suggestion.kinds.map((kind) => (
                <span key={kind}>{KIND_LABELS[kind]}</span>
              ))}
              {suggestion.roles
                .filter((role) => role !== "other")
                .slice(0, 5)
                .map((role) => (
                  <span key={role}>{ROLE_LABELS[role] ?? role}</span>
                ))}
              {suggestion.isGameChanger && <span>GAME CHANGER</span>}
            </div>

            <section>
              <span className="mtg-card-drawer__label">POURQUOI CETTE CARTE ?</span>
              <ul className="mtg-recommendation-card__reasons">
                {suggestion.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </section>

            {card.oracleText && (
              <section>
                <span className="mtg-card-drawer__label">TEXTE ORACLE</span>
                <p className="mtg-suggestion-preview__oracle">{card.oracleText}</p>
              </section>
            )}

            <dl className="mtg-suggestion-preview__meta">
              <div>
                <dt>Mana value</dt>
                <dd>{card.manaValue ?? "—"}</dd>
              </div>
              <div>
                <dt>Identité couleur</dt>
                <dd>{card.colorIdentity.length ? card.colorIdentity.join(" · ") : "C"}</dd>
              </div>
              <div>
                <dt>Extension</dt>
                <dd>{card.setName ?? card.setCode ?? "—"}</dd>
              </div>
              <div>
                <dt>Set / Numéro</dt>
                <dd>
                  {card.setCode ?? "—"}
                  {card.collectorNumber ? ` · #${card.collectorNumber}` : ""}
                </dd>
              </div>
            </dl>

            {!readOnly && onAddCard && (
              <button
                type="button"
                className="mtg-primary-button mtg-suggestion-preview__add"
                onClick={() => onAddCard(card)}
              >
                + Ajouter au deck
              </button>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function SuggestionCard({
  suggestion,
  collection,
  readOnly,
  onAddCard,
  onOpen,
}: {
  suggestion: DeckCardSuggestion;
  collection: CollectionCard[];
  readOnly: boolean;
  onAddCard?: (card: MtgCard) => void;
  onOpen: () => void;
}) {
  const owned = ownedQuantity(collection, suggestion.card);

  return (
    <article className="mtg-recommendation-card">
      <button
        type="button"
        className="mtg-recommendation-card__visual mtg-recommendation-card__open"
        onClick={onOpen}
        aria-label={`Afficher ${suggestion.card.name} en grand`}
        title="Afficher la carte en grand"
      >
        {suggestion.card.imageUri ? (
          <img src={suggestion.card.imageUri} alt={suggestion.card.name} />
        ) : (
          <span>MTG</span>
        )}
      </button>

      <div className="mtg-recommendation-card__body">
        <div className="mtg-recommendation-card__heading">
          <button
            type="button"
            className="mtg-recommendation-card__title-button"
            onClick={onOpen}
            title="Afficher la carte en grand"
          >
            <strong>{suggestion.card.name}</strong>
            <small>{suggestion.card.typeLine}</small>
          </button>
          {suggestion.isGameChanger && <span className="mtg-recommendation-card__gc">GAME CHANGER</span>}
        </div>

        <div className="mtg-recommendation-card__tags">
          {suggestion.kinds.map((kind) => (
            <span key={kind}>{KIND_LABELS[kind]}</span>
          ))}
          {suggestion.roles
            .filter((role) => role !== "other")
            .slice(0, 3)
            .map((role) => (
              <span key={role}>{ROLE_LABELS[role] ?? role}</span>
            ))}
        </div>

        <ul className="mtg-recommendation-card__reasons">
          {suggestion.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>

        <div className="mtg-recommendation-card__footer">
          <span className={owned > 0 ? "is-owned" : "is-missing"}>
            {owned > 0 ? `Dans ton bulk ×${owned}` : "Non possédée"}
          </span>

          {!readOnly && onAddCard && (
            <button
              type="button"
              className="mtg-secondary-button"
              onClick={(event) => {
                event.stopPropagation();
                onAddCard(suggestion.card);
              }}
            >
              + Ajouter au deck
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default function DeckRecommendationsPanel({
  analysis,
  loading,
  collection,
  readOnly = false,
  onAddCard,
}: Props) {
  const suggestions = analysis?.suggestions ?? [];
  const [selectedSuggestion, setSelectedSuggestion] = useState<DeckCardSuggestion | null>(null);

  return (
    <>
      <section className="mtg-recommendations-panel">
        <div className="mtg-analysis-panel__heading">
          <span>CARTES CLÉS / SUGGESTIONS</span>
          <strong>{loading ? "Analyse…" : `${suggestions.length} proposition(s)`}</strong>
        </div>

        <p className="mtg-recommendations-panel__intro">
          Recommandations calculées à partir du commandant, de son texte Oracle, des rôles faibles de la decklist
          et de la popularité Commander des cartes. Clique sur l’image ou le nom d’une suggestion pour l’afficher en grand.
        </p>

        {analysis?.available === false && (
          <p className="mtg-bracket-panel__warning">
            Les suggestions Scryfall sont momentanément indisponibles. Le reste de l’analyse du deck continue de fonctionner.
          </p>
        )}

        {!loading && suggestions.length === 0 ? (
          <div className="mtg-combo-panel__empty">
            Aucune suggestion calculée pour le moment. Choisis un commandant ou complète un peu la decklist.
          </div>
        ) : (
          <div className="mtg-recommendations-panel__list">
            {suggestions.slice(0, 12).map((suggestion) => (
              <SuggestionCard
                key={suggestion.card.oracleId ?? suggestion.card.id}
                suggestion={suggestion}
                collection={collection}
                readOnly={readOnly}
                onAddCard={onAddCard}
                onOpen={() => setSelectedSuggestion(suggestion)}
              />
            ))}
          </div>
        )}
      </section>

      {selectedSuggestion && (
        <SuggestionPreview
          suggestion={selectedSuggestion}
          collection={collection}
          readOnly={readOnly}
          onAddCard={onAddCard}
          onClose={() => setSelectedSuggestion(null)}
        />
      )}
    </>
  );
}
