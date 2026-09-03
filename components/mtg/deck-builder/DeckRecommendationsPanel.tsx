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

function SuggestionCard({
  suggestion,
  collection,
  readOnly,
  onAddCard,
}: {
  suggestion: DeckCardSuggestion;
  collection: CollectionCard[];
  readOnly: boolean;
  onAddCard?: (card: MtgCard) => void;
}) {
  const owned = ownedQuantity(collection, suggestion.card);

  return (
    <article className="mtg-recommendation-card">
      <div className="mtg-recommendation-card__visual">
        {suggestion.card.imageUri ? (
          <img src={suggestion.card.imageUri} alt={suggestion.card.name} />
        ) : (
          <span>MTG</span>
        )}
      </div>

      <div className="mtg-recommendation-card__body">
        <div className="mtg-recommendation-card__heading">
          <div>
            <strong>{suggestion.card.name}</strong>
            <small>{suggestion.card.typeLine}</small>
          </div>
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
            <button type="button" className="mtg-secondary-button" onClick={() => onAddCard(suggestion.card)}>
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

  return (
    <section className="mtg-recommendations-panel">
      <div className="mtg-analysis-panel__heading">
        <span>CARTES CLÉS / SUGGESTIONS</span>
        <strong>{loading ? "Analyse…" : `${suggestions.length} proposition(s)`}</strong>
      </div>

      <p className="mtg-recommendations-panel__intro">
        Recommandations calculées à partir du commandant, de son texte Oracle, des rôles faibles de la decklist
        et de la popularité Commander des cartes. Les pièces de combo manquantes restent détaillées dans le panneau Combos.
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
            />
          ))}
        </div>
      )}
    </section>
  );
}
