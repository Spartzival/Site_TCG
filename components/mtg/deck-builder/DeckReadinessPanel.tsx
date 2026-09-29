import type { DeckEligibility } from "@/types/mtg";

type Props = {
  eligibility: DeckEligibility;
  onMarkReady: () => void;
};

export default function DeckReadinessPanel({ eligibility, onMarkReady }: Props) {
  return (
    <section className={`mtg-readiness-panel ${eligibility.eligible ? "is-ready" : ""}`}>
      <div className="mtg-readiness-panel__summary">
        <span>{eligibility.eligible ? "DECK ÉLIGIBLE" : "PRÉPARATION"}</span>
        <strong>{eligibility.eligible ? "Prêt à jouer" : "Pas encore prêt"}</strong>
        <p>
          {eligibility.eligible
            ? "Les règles Commander et la disponibilité physique des cartes sont satisfaites. Tu peux déplacer ce deck dans Mes decks."
            : "Corrige les règles, la taille du deck ou les exemplaires indisponibles avant de le classer comme prêt."}
        </p>
        <button
          type="button"
          className="mtg-primary-button"
          disabled={!eligibility.eligible}
          onClick={onMarkReady}
        >
          Marquer comme prêt →
        </button>
      </div>

      <div className="mtg-readiness-panel__checks">
        {eligibility.checks.map((check) => (
          <div key={check.id} className={`mtg-readiness-check ${check.ok ? "is-ok" : "is-blocked"}`}>
            <span className="mtg-readiness-check__icon">{check.ok ? "✓" : "!"}</span>
            <span>
              <strong>{check.label}</strong>
              <small>{check.detail}</small>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
