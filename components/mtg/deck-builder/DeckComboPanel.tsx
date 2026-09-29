import type { SpellbookCombo } from "@/types/mtg";

type Props = {
  included: SpellbookCombo[];
  almost: SpellbookCombo[];
  loading: boolean;
  readOnly?: boolean;
  onAddMissingCard?: (name: string) => void;
};

function uniqueLines(values: Array<string | undefined>) {
  return Array.from(
    new Set(
      values
        .flatMap((value) => (value ?? "").split(/\r?\n/))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function ComboCard({
  combo,
  almost = false,
  readOnly = false,
  onAddMissingCard,
}: {
  combo: SpellbookCombo;
  almost?: boolean;
  readOnly?: boolean;
  onAddMissingCard?: (name: string) => void;
}) {
  const prerequisites = uniqueLines([
    ...(combo.prerequisites ?? []),
    combo.easyPrerequisites,
    combo.notablePrerequisites,
  ]);

  const steps = uniqueLines([
    ...(combo.steps ?? []),
    combo.description,
  ]);

  return (
    <details className={`mtg-combo-card ${almost ? "is-almost" : "is-complete"}`}>
      <summary>
        <div className="mtg-combo-card__summary-main">
          <div className="mtg-combo-card__top">
            <span>{almost ? "COMBO POTENTIELLE" : "COMBO COMPLÈTE"}</span>
            <small>{combo.cards.length} carte(s)</small>
          </div>

          <strong>
            {combo.cards.map((card) => card.name).join(" + ") || "Combo Commander Spellbook"}
          </strong>

          {combo.produces.length > 0 && (
            <p className="mtg-combo-card__result-preview">→ {combo.produces.join(" · ")}</p>
          )}
        </div>

        <span className="mtg-combo-card__expand">Détails ↓</span>
      </summary>

      <div className="mtg-combo-card__details">
        <div className="mtg-combo-card__pieces">
          <h5>Cartes nécessaires</h5>
          <div>
            {combo.cards.map((card) => (
              <span key={`${combo.id}-${card.name}`}>
                {card.quantity && card.quantity > 1 ? `${card.quantity}× ` : ""}
                {card.name}
                {card.mustBeCommander ? " · commandant" : ""}
              </span>
            ))}
          </div>
        </div>

        {almost && combo.missingCards && combo.missingCards.length > 0 && (
          <div className="mtg-combo-card__missing-block">
            <h5>Il te manque</h5>
            {combo.missingCards.map((name) => (
              <div key={`${combo.id}-missing-${name}`}>
                <strong>{name}</strong>
                {!readOnly && onAddMissingCard && (
                  <button type="button" onClick={() => onAddMissingCard(name)}>
                    + Ajouter au deck
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {prerequisites.length > 0 && (
          <div className="mtg-combo-card__section">
            <h5>Prérequis</h5>
            <ul>
              {prerequisites.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mtg-combo-card__section">
          <h5>Comment jouer la combo</h5>
          {steps.length > 0 ? (
            <ol>
              {steps.map((step, index) => (
                <li key={`${combo.id}-step-${index}`}>{step}</li>
              ))}
            </ol>
          ) : (
            <p>
              Commander Spellbook identifie cette combinaison, mais ne fournit pas de séquence détaillée dans cette réponse.
              Les cartes et le résultat restent affichés pour te permettre de l’identifier.
            </p>
          )}
        </div>

        {combo.produces.length > 0 && (
          <div className="mtg-combo-card__section mtg-combo-card__produces">
            <h5>Résultat</h5>
            <ul>
              {combo.produces.map((result) => (
                <li key={`${combo.id}-result-${result}`}>{result}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mtg-combo-card__impact">
          <span>Impact deck</span>
          <strong>
            {combo.cards.length <= 2
              ? "Combo très compacte : elle peut peser fortement sur l’estimation du bracket."
              : "Combo à plusieurs pièces : sa puissance dépend surtout de sa vitesse et de sa facilité d’assemblage."}
          </strong>
          {combo.bracketTag && <small>Tag Spellbook : {combo.bracketTag}</small>}
        </div>
      </div>
    </details>
  );
}

export default function DeckComboPanel({
  included,
  almost,
  loading,
  readOnly = false,
  onAddMissingCard,
}: Props) {
  return (
    <section className="mtg-combo-panel">
      <div className="mtg-analysis-panel__heading">
        <span>COMBOS · COMMANDER SPELLBOOK</span>
        <strong>{loading ? "Analyse…" : `${included.length} complète(s)`}</strong>
      </div>

      <p className="mtg-combo-panel__intro">
        Ouvre une combo pour voir ses pièces, les prérequis, la séquence de jeu et ce qu’elle produit.
        Les combos presque complètes indiquent aussi les cartes manquantes.
      </p>

      {!loading && included.length === 0 && almost.length === 0 ? (
        <p className="mtg-combo-panel__empty">Aucune combo répertoriée détectée pour le moment.</p>
      ) : (
        <div className="mtg-combo-panel__lists">
          {included.length > 0 && (
            <div>
              <h4>Complètes dans le deck</h4>
              {included.slice(0, 12).map((combo) => (
                <ComboCard key={combo.id} combo={combo} readOnly={readOnly} />
              ))}
            </div>
          )}

          {almost.length > 0 && (
            <div>
              <h4>À une ou plusieurs cartes</h4>
              {almost.slice(0, 10).map((combo) => (
                <ComboCard
                  key={combo.id}
                  combo={combo}
                  almost
                  readOnly={readOnly}
                  onAddMissingCard={onAddMissingCard}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
