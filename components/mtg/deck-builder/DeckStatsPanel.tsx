import type { DeckFormat, DeckLocalAnalysis } from "@/types/mtg";

type Props = { analysis: DeckLocalAnalysis; format: DeckFormat };

export default function DeckStatsPanel({ analysis, format }: Props) {
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

  const isCommander = format === "Commander";

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
              <div><i style={{ width: `${(bucket.count / maxCurve) * 100}%` }} /></div>
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
              <div><i style={{ width: `${(value / totalPips) * 100}%` }} /></div>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="mtg-analysis-panel">
        <div className="mtg-analysis-panel__heading">
          <span>COMPOSITION</span>
          <strong>{analysis.mainboardCount} cartes main</strong>
        </div>
        <div className="mtg-type-stats">
          {typeRows.map(([label, value]) => (
            <div key={label}><span>{label}</span><strong>{value}</strong></div>
          ))}
          {!isCommander && (
            <div><span>Sideboard</span><strong>{analysis.sideboardCount}</strong></div>
          )}
        </div>
      </section>

      <section className="mtg-analysis-panel">
        <div className="mtg-analysis-panel__heading">
          <span>{isCommander ? "COMMANDER CHECK" : "STANDARD CHECK"}</span>
          <strong>{isCommander ? `${analysis.totalCards}/100` : `${analysis.mainboardCount}/60+`}</strong>
        </div>
        <div className="mtg-rule-checks">
          {isCommander && (
            <p className={analysis.colorIdentityViolations.length ? "is-error" : "is-ok"}>
              {analysis.colorIdentityViolations.length
                ? `Identité couleur : ${analysis.colorIdentityViolations.length} erreur(s)`
                : "Identité couleur respectée"}
            </p>
          )}
          <p className={analysis.legalityViolations.length ? "is-error" : "is-ok"}>
            {analysis.legalityViolations.length
              ? `Légalité : ${analysis.legalityViolations.length} problème(s)`
              : `Cartes ${format} légales`}
          </p>
          <p className={analysis.duplicateViolations.length ? "is-error" : "is-ok"}>
            {analysis.duplicateViolations.length
              ? `${isCommander ? "Singleton" : "Copies"} : ${analysis.duplicateViolations.length} problème(s)`
              : isCommander
                ? "Singleton respecté"
                : "Limite de 4 copies respectée"}
          </p>
        </div>
      </section>
    </div>
  );
}
