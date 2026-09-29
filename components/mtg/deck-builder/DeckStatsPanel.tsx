import type { DeckLocalAnalysis } from "@/types/mtg";

type Props = { analysis: DeckLocalAnalysis };

export default function DeckStatsPanel({ analysis }: Props) {
  const maxCurve = Math.max(1, ...analysis.manaCurve.map((item) => item.count));
  const totalPips = Math.max(
    1,
    Object.values(analysis.manaPips).reduce((sum, value) => sum + value, 0),
  );

  const typeRows = [
    ["Créatures", analysis.typeStats.creatures],
    ["Éphémères", analysis.typeStats.instants],
    ["Rituels", analysis.typeStats.sorceries],
    ["Artefacts", analysis.typeStats.artifacts],
    ["Enchantements", analysis.typeStats.enchantments],
    ["Planeswalkers", analysis.typeStats.planeswalkers],
    ["Terrains", analysis.typeStats.lands],
  ] as const;

  return (
    <div className="mtg-analysis-grid">
      <section className="mtg-analysis-panel">
        <div className="mtg-analysis-panel__heading">
          <span>MANA CURVE</span>
          <strong>{analysis.averageManaValue.toFixed(2)} MV moyen</strong>
        </div>
        <div className="mtg-mana-curve">
          {analysis.manaCurve.map((bucket) => (
            <div key={bucket.manaValue}>
              <span>{bucket.manaValue}</span>
              <div>
                <i style={{ width: `${(bucket.count / maxCurve) * 100}%` }} />
              </div>
              <strong>{bucket.count}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="mtg-analysis-panel">
        <div className="mtg-analysis-panel__heading">
          <span>MANA SYMBOLS</span>
          <strong>{totalPips === 1 ? 0 : totalPips} pips</strong>
        </div>
        <div className="mtg-mana-pips">
          {Object.entries(analysis.manaPips).map(([color, value]) => (
            <div key={color}>
              <span>{color}</span>
              <div>
                <i style={{ width: `${(value / totalPips) * 100}%` }} />
              </div>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="mtg-analysis-panel">
        <div className="mtg-analysis-panel__heading">
          <span>COMPOSITION</span>
          <strong>{analysis.totalCards} cartes</strong>
        </div>
        <div className="mtg-type-stats">
          {typeRows.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="mtg-analysis-panel">
        <div className="mtg-analysis-panel__heading">
          <span>COMMANDER CHECK</span>
          <strong>{analysis.totalCards}/100</strong>
        </div>
        <div className="mtg-rule-checks">
          <p className={analysis.colorIdentityViolations.length ? "is-error" : "is-ok"}>
            {analysis.colorIdentityViolations.length
              ? `Identité couleur : ${analysis.colorIdentityViolations.length} erreur(s)`
              : "Identité couleur respectée"}
          </p>
          <p className={analysis.commanderLegalityViolations.length ? "is-error" : "is-ok"}>
            {analysis.commanderLegalityViolations.length
              ? `Légalité : ${analysis.commanderLegalityViolations.length} problème(s)`
              : "Cartes Commander légales"}
          </p>
          <p className={analysis.duplicateViolations.length ? "is-error" : "is-ok"}>
            {analysis.duplicateViolations.length
              ? `Singleton : ${analysis.duplicateViolations.length} doublon(s)`
              : "Singleton respecté"}
          </p>
        </div>
      </section>
    </div>
  );
}
