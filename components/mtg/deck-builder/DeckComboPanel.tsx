import type { SpellbookCombo } from "@/types/mtg";

type Props = {
  included: SpellbookCombo[];
  almost: SpellbookCombo[];
  loading: boolean;
};

function ComboCard({ combo, almost }: { combo: SpellbookCombo; almost?: boolean }) {
  return (
    <article className="mtg-combo-card">
      <div className="mtg-combo-card__top">
        <span>{almost ? "POTENTIELLE" : "DÉTECTÉE"}</span>
        <small>{combo.cards.length} carte(s)</small>
      </div>
      <strong>{combo.cards.map((card) => card.name).join(" + ") || "Combo Spellbook"}</strong>
      {combo.produces.length > 0 && <p>{combo.produces.join(" · ")}</p>}
      {combo.missingCards && combo.missingCards.length > 0 && (
        <p className="mtg-combo-card__missing">Manque : {combo.missingCards.join(", ")}</p>
      )}
      {combo.easyPrerequisites && <small>{combo.easyPrerequisites}</small>}
    </article>
  );
}

export default function DeckComboPanel({ included, almost, loading }: Props) {
  return (
    <section className="mtg-combo-panel">
      <div className="mtg-analysis-panel__heading">
        <span>COMMANDER SPELLBOOK</span>
        <strong>{loading ? "Analyse…" : `${included.length} combo(s)`}</strong>
      </div>

      {!loading && included.length === 0 && almost.length === 0 ? (
        <p className="mtg-combo-panel__empty">Aucune combo répertoriée détectée pour le moment.</p>
      ) : (
        <div className="mtg-combo-panel__lists">
          {included.length > 0 && (
            <div>
              <h4>Dans le deck</h4>
              {included.slice(0, 12).map((combo) => (
                <ComboCard key={combo.id} combo={combo} />
              ))}
            </div>
          )}
          {almost.length > 0 && (
            <div>
              <h4>Presque incluses</h4>
              {almost.slice(0, 8).map((combo) => (
                <ComboCard key={combo.id} combo={combo} almost />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
