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

const EXPECTATIONS: Record<CommanderBracket, { title: string; description: string; pace: string }> = {
  1: {
    title: "Thématique avant tout",
    description: "Deck volontairement atypique ou très casual. Pas de Game Changer ni de plan de victoire compact recherché.",
    pace: "Parties longues ; gagner rapidement n’est pas l’objectif principal.",
  },
  2: {
    title: "Puissance type précon / casual construit",
    description: "Plan cohérent mais modéré : pas de Game Changer, pas de mass land denial et peu de tutors très efficaces.",
    pace: "On s’attend généralement à pouvoir jouer un bon nombre de tours avant la fin.",
  },
  3: {
    title: "Deck amélioré et synergique",
    description: "Cartes fortes et synergies marquées. Jusqu’à trois Game Changers, mais sans plan volontaire de combo rapide à deux cartes.",
    pace: "Le deck peut prendre nettement l’avantage au milieu de partie.",
  },
  4: {
    title: "Optimisé / high power",
    description: "Tutors efficaces, combos compactes, fast mana, locks ou stratégies très puissantes sont attendus.",
    pace: "Le deck cherche à être létal, rapide et consistant.",
  },
  5: {
    title: "Compétitif cEDH",
    description: "Deck construit pour affronter le métagame cEDH avec priorité maximale à l’efficacité et à la victoire.",
    pace: "Une partie peut se décider très tôt ; l’intention compétitive est déterminante.",
  },
};

function Factor({
  label,
  count,
  detail,
  names = [],
  alert = false,
}: {
  label: string;
  count: number;
  detail: string;
  names?: string[];
  alert?: boolean;
}) {
  return (
    <div className={`mtg-bracket-factor ${alert ? "is-alert" : ""}`}>
      <div className="mtg-bracket-factor__heading">
        <span>{label}</span>
        <strong>{count}</strong>
      </div>
      <p>{detail}</p>
      {names.length > 0 && (
        <div className="mtg-bracket-factor__cards">
          {names.slice(0, 12).map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
      )}
    </div>
  );
}

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
  const twoCardCombos = analysis?.findings.twoCardCombos ?? [];
  const locks = analysis?.findings.lockCombos ?? [];
  const extraTurns = analysis?.findings.extraTurnCards ?? [];
  const massLandDenial = analysis?.findings.massLandDenialCards ?? [];
  const banned = analysis?.findings.bannedCards ?? [];
  const expectation = EXPECTATIONS[displayed];

  const pressureReasons: string[] = [];
  if (gameChangers.length > 3) pressureReasons.push("Plus de 3 Game Changers pousse le deck vers Bracket 4+.");
  else if (gameChangers.length > 0) pressureReasons.push(`${gameChangers.length}/3 Game Changer(s) utilisé(s) dans l’espace Bracket 3.`);
  if (twoCardCombos.length > 0) pressureReasons.push(`${twoCardCombos.length} combo(s) à deux cartes détectée(s) : facteur important de puissance.`);
  if (locks.length > 0) pressureReasons.push(`${locks.length} lock(s) détecté(s).`);
  if (massLandDenial.length > 0) pressureReasons.push("Mass land denial détecté : incompatible avec les Brackets 1–3.");
  if (extraTurns.length > 0) pressureReasons.push(`${extraTurns.length} carte(s) de tour supplémentaire détectée(s).`);
  if (!pressureReasons.length) pressureReasons.push("Aucun marqueur majeur de high power détecté automatiquement.");

  return (
    <section className="mtg-bracket-panel">
      <div className="mtg-bracket-panel__score">
        <span>BRACKET ESTIMÉ</span>
        <strong>{loading ? "…" : displayed}</strong>
        <em>{cedhIntent ? NAMES[5] : analysis?.bracketLabel ?? NAMES[detected]}</em>
        {analysis && !cedhIntent && (
          <small>Minimum détecté : {analysis.minimumBracket} · {NAMES[analysis.minimumBracket]}</small>
        )}
      </div>

      <div className="mtg-bracket-panel__details">
        {analysis?.available === false && (
          <p className="mtg-bracket-panel__warning">
            Commander Spellbook est indisponible : les Game Changers officiels et l’analyse locale restent actifs.
          </p>
        )}

        <div className="mtg-bracket-explanation">
          <span>CE QUE SIGNIFIE CE BRACKET</span>
          <strong>{expectation.title}</strong>
          <p>{expectation.description}</p>
          <small>{expectation.pace}</small>
        </div>

        <div className="mtg-bracket-why">
          <h4>Pourquoi cette estimation ?</h4>
          <ul>
            {pressureReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
            {(analysis?.bracketReason ?? []).map((reason) => (
              <li key={`api-${reason}`}>{reason}</li>
            ))}
          </ul>
        </div>

        <div className="mtg-bracket-factors">
          <Factor
            label="Game Changers"
            count={gameChangers.length}
            detail={
              gameChangers.length === 0
                ? "Brackets 1–2 n’en utilisent pas ; Bracket 3 peut en jouer jusqu’à trois."
                : "Ces cartes sont explicitement utilisées comme indicateur de puissance dans le système de brackets."
            }
            names={gameChangers}
            alert={gameChangers.length > 3}
          />

          <Factor
            label="Combos à 2 cartes"
            count={twoCardCombos.length}
            detail="Les combos compactes, surtout lorsqu’elles sont rapides et faciles à tutoriser, rapprochent fortement d’un deck optimisé."
            names={twoCardCombos.flatMap((combo) => combo.cards.map((card) => card.name))}
            alert={twoCardCombos.length > 0}
          />

          <Factor
            label="Locks"
            count={locks.length}
            detail="Les locks répétés ou faciles à assembler sont un marqueur de gameplay high power."
            names={locks.flatMap((combo) => combo.cards.map((card) => card.name))}
            alert={locks.length > 0}
          />

          <Factor
            label="Tours supplémentaires"
            count={extraTurns.length}
            detail="Les Brackets bas les tolèrent peu et ne cherchent pas à les enchaîner ou les boucler."
            names={extraTurns}
          />

          <Factor
            label="Mass land denial"
            count={massLandDenial.length}
            detail="Ce type de stratégie n’est pas attendu en Brackets 1 à 3."
            names={massLandDenial}
            alert={massLandDenial.length > 0}
          />

          {banned.length > 0 && (
            <Factor
              label="Cartes interdites"
              count={banned.length}
              detail="Ces cartes doivent être retirées pour une decklist Commander légale."
              names={banned}
              alert
            />
          )}
        </div>

        <div className={`mtg-game-changers ${gameChangers.length ? "has-cards" : ""}`}>
          <div className="mtg-game-changers__heading">
            <span>GAME CHANGERS DÉTECTÉS</span>
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
                : "Le Bracket 5 ne se déduit pas seulement des cartes : il correspond à une intention compétitive et au métagame cEDH."}
            </small>
          </span>
        </label>
      </div>
    </section>
  );
}
