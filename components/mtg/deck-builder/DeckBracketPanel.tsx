import type { CommanderBracket, DeckRemoteAnalysis } from "@/types/mtg";

type Props = {
  analysis: DeckRemoteAnalysis | null;
  loading: boolean;
  cedhIntent: boolean;
  onCedhIntentChange: (value: boolean) => void;
  readOnly?: boolean;
};

const NAMES: Record<CommanderBracket, string> = {
  1: "Exhibition",
  2: "Core",
  3: "Upgraded",
  4: "Optimized",
  5: "cEDH",
};

export default function DeckBracketPanel({
  analysis,
  loading,
  cedhIntent,
  onCedhIntentChange,
  readOnly = false,
}: Props) {
  const detected = analysis?.estimatedBracket ?? 2;
  const displayed: CommanderBracket = cedhIntent ? 5 : detected;
  const gameChangers = analysis?.findings.gameChangerCards ?? [];

  return (
    <section className="mtg-bracket-panel">
      <div className="mtg-bracket-panel__score">
        <span>BRACKET ESTIMÉ</span>
        <strong>{loading ? "…" : displayed}</strong>
        <em>{cedhIntent ? NAMES[5] : analysis?.bracketLabel ?? NAMES[detected]}</em>
      </div>

      <div className="mtg-bracket-panel__details">
        {analysis?.available === false && (
          <p className="mtg-bracket-panel__warning">
            Commander Spellbook est indisponible : les Game Changers officiels et
            l&apos;analyse locale restent actifs.
          </p>
        )}

        <p>
          Estimation dynamique selon les marqueurs détectables. Le bracket reste un
          outil de conversation, pas une certification automatique.
        </p>

        <ul>
          {(analysis?.bracketReason ?? ["Analyse en attente…"]).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>

        <div className={`mtg-game-changers ${gameChangers.length ? "has-cards" : ""}`}>
          <div className="mtg-game-changers__heading">
            <span>GAME CHANGERS</span>
            <strong>{gameChangers.length}</strong>
          </div>

          {gameChangers.length ? (
            <div className="mtg-game-changers__list">
              {gameChangers.map((name) => (
                <span key={name}>{name}</span>
              ))}
            </div>
          ) : (
            <small>Aucun Game Changer officiel détecté dans la liste actuelle.</small>
          )}
        </div>

        <label className="mtg-cedh-toggle">
          <input
            type="checkbox"
            checked={cedhIntent}
            disabled={readOnly}
            onChange={(event) => onCedhIntentChange(event.target.checked)}
          />
          <span>
            <strong>Intention cEDH</strong>
            <small>
              {readOnly
                ? "Lecture seule. Remets le deck en construction pour modifier cette intention."
                : "Force l'affichage Bracket 5 : le cEDH dépend du métagame et de l'intention."}
            </small>
          </span>
        </label>
      </div>
    </section>
  );
}
