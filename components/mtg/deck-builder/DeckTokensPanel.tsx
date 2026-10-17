"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  DeckSection,
  DeckTokenAnalysis,
  DeckTokenItem,
  DeckTokenKind,
} from "@/types/mtg";

type Props = {
  analysis: DeckTokenAnalysis | null;
  loading: boolean;
  onRefresh?: () => void;
};

function kindLabel(kind: DeckTokenKind): string {
  switch (kind) {
    case "emblem":
      return "Emblème";
    case "copy":
      return "Copie";
    case "variable":
      return "Variable";
    default:
      return "Token";
  }
}

function sectionLabel(section: DeckSection): string {
  switch (section) {
    case "commander":
      return "Commandant";
    case "sideboard":
      return "Sideboard";
    case "maybeboard":
      return "Maybeboard";
    default:
      return "Main";
  }
}

function tokenListText(tokens: DeckTokenItem[]): string {
  return tokens
    .map((token) => {
      const sources = token.sources
        .map((source) => `${source.quantity}× ${source.name}`)
        .join(", ");
      return `${token.name}${token.card?.power && token.card?.toughness ? ` ${token.card.power}/${token.card.toughness}` : ""} — ${sources}`;
    })
    .join("\n");
}

export default function DeckTokensPanel({ analysis, loading, onRefresh }: Props) {
  const [selectedToken, setSelectedToken] = useState<DeckTokenItem | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  useEffect(() => {
    if (!selectedToken) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedToken(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedToken]);

  const grouped = useMemo(() => {
    const tokens = analysis?.tokens ?? [];
    return {
      printed: tokens.filter((token) => token.kind === "token"),
      emblems: tokens.filter((token) => token.kind === "emblem"),
      special: tokens.filter((token) => token.kind === "copy" || token.kind === "variable"),
    };
  }, [analysis]);

  const selectedTokenImages = useMemo(
    () =>
      selectedToken?.card?.faces
        ?.map((face) => face.imageUri)
        .filter((image): image is string => Boolean(image)) ?? [],
    [selectedToken],
  );

  const copyList = async () => {
    if (!analysis?.tokens.length) return;

    try {
      await navigator.clipboard.writeText(tokenListText(analysis.tokens));
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1600);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 2000);
    }
  };

  if (loading && !analysis) {
    return (
      <section className="mtg-token-panel">
        <div className="mtg-token-panel__loading">
          <span className="mtg-token-panel__spinner" aria-hidden="true" />
          <div>
            <strong>Recherche des tokens…</strong>
            <p>Scryfall relie les cartes du deck à leurs jetons officiels.</p>
          </div>
        </div>
      </section>
    );
  }

  if (analysis && !analysis.available) {
    return (
      <section className="mtg-token-panel">
        <div className="mtg-token-panel__empty is-error">
          <span>TOK</span>
          <strong>Tokens momentanément indisponibles</strong>
          <p>{analysis.error ?? "Impossible de charger les tokens depuis Scryfall."}</p>
          {onRefresh && (
            <button type="button" className="mtg-secondary-button" onClick={onRefresh}>
              Réessayer
            </button>
          )}
        </div>
      </section>
    );
  }

  if (!analysis || analysis.tokens.length === 0) {
    return (
      <section className="mtg-token-panel">
        <div className="mtg-token-panel__empty">
          <span>TOK</span>
          <strong>Aucun token détecté</strong>
          <p>
            Aucune des cartes jouées dans ce deck n’est actuellement reliée à un token ou un emblème Scryfall.
          </p>
          {onRefresh && (
            <button type="button" className="mtg-secondary-button" onClick={onRefresh}>
              Rechercher à nouveau
            </button>
          )}
        </div>
      </section>
    );
  }

  const sections = [
    { id: "printed", label: "Tokens officiels", items: grouped.printed },
    { id: "emblems", label: "Emblèmes", items: grouped.emblems },
    { id: "special", label: "Copies & tokens variables", items: grouped.special },
  ].filter((section) => section.items.length > 0);

  return (
    <section className="mtg-token-panel">
      <div className="mtg-token-panel__hero">
        <div>
          <span>ACCESSOIRES DU DECK</span>
          <h3>{analysis.tokens.length} token{analysis.tokens.length > 1 ? "s" : ""} à prévoir</h3>
          <p>
            Regroupés automatiquement à partir de {analysis.sourceCardCount} carte{analysis.sourceCardCount > 1 ? "s" : ""} du deck.
            Une seule fiche est affichée même si plusieurs cartes créent le même token.
          </p>
        </div>

        <div className="mtg-token-panel__actions">
          <button type="button" className="mtg-secondary-button" onClick={copyList}>
            {copyState === "copied"
              ? "Liste copiée ✓"
              : copyState === "error"
                ? "Copie impossible"
                : "Copier la liste"}
          </button>
          {onRefresh && (
            <button type="button" className="mtg-secondary-button" onClick={onRefresh} disabled={loading}>
              {loading ? "Actualisation…" : "Actualiser"}
            </button>
          )}
        </div>
      </div>

      {sections.map((section) => (
        <div key={section.id} className="mtg-token-panel__section">
          <div className="mtg-token-panel__section-title">
            <strong>{section.label}</strong>
            <span>{section.items.length}</span>
          </div>

          <div className="mtg-token-grid">
            {section.items.map((token) => (
              <article key={token.id} className="mtg-token-card">
                <button
                  type="button"
                  className="mtg-token-card__visual"
                  onClick={() => setSelectedToken(token)}
                  aria-label={`Voir ${token.name}`}
                >
                  {token.card?.imageUri ? (
                    <img src={token.card.imageUri} alt={token.name} />
                  ) : (
                    <span className="mtg-token-card__placeholder">
                      <b>{token.kind === "copy" ? "COPY" : token.kind === "emblem" ? "EMB" : "TOK"}</b>
                      <small>{token.name}</small>
                    </span>
                  )}
                </button>

                <div className="mtg-token-card__body">
                  <div className="mtg-token-card__heading">
                    <button type="button" onClick={() => setSelectedToken(token)}>
                      {token.name}
                    </button>
                    <span className={`is-${token.kind}`}>{kindLabel(token.kind)}</span>
                  </div>

                  {token.card?.typeLine && <p>{token.card.typeLine}</p>}

                  <div className="mtg-token-card__sources">
                    <small>GÉNÉRÉ PAR</small>
                    {token.sources.map((source) => (
                      <span key={`${token.id}:${source.cardId}:${source.section}`}>
                        <b>{source.quantity > 1 ? `${source.quantity}× ` : ""}{source.name}</b>
                        <em>{sectionLabel(source.section)}</em>
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      ))}

      {selectedToken && (
        <div
          className="mtg-token-preview-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedToken(null);
          }}
        >
          <section className="mtg-token-preview" role="dialog" aria-modal="true" aria-label={selectedToken.name}>
            <button
              type="button"
              className="mtg-token-preview__close"
              onClick={() => setSelectedToken(null)}
              aria-label="Fermer"
            >
              ×
            </button>

            <div className="mtg-token-preview__visual">
              {selectedTokenImages.length > 1 ? (
                <div className="mtg-token-preview__faces">
                  {selectedTokenImages.map((image, index) => (
                    <img
                      key={`${selectedToken.id}:face:${index}`}
                      src={image}
                      alt={`${selectedToken.name} — face ${index + 1}`}
                    />
                  ))}
                </div>
              ) : selectedToken.card?.imageUri ? (
                <img src={selectedToken.card.imageUri} alt={selectedToken.name} />
              ) : (
                <div className="mtg-token-card__placeholder is-large">
                  <b>{selectedToken.kind === "copy" ? "COPY" : selectedToken.kind === "emblem" ? "EMB" : "TOK"}</b>
                  <small>{selectedToken.name}</small>
                </div>
              )}
            </div>

            <div className="mtg-token-preview__content">
              <span className={`mtg-token-preview__kind is-${selectedToken.kind}`}>
                {kindLabel(selectedToken.kind)}
              </span>
              <h3>{selectedToken.name}</h3>
              {selectedToken.card?.typeLine && <p className="mtg-token-preview__type">{selectedToken.card.typeLine}</p>}
              {selectedToken.card?.oracleText && <p className="mtg-token-preview__oracle">{selectedToken.card.oracleText}</p>}

              {selectedToken.card?.power && selectedToken.card?.toughness && (
                <div className="mtg-token-preview__stat">
                  <span>Force / Endurance</span>
                  <strong>{selectedToken.card.power} / {selectedToken.card.toughness}</strong>
                </div>
              )}

              <div className="mtg-token-preview__sources">
                <span>CRÉÉ PAR</span>
                {selectedToken.sources.map((source) => (
                  <div key={`${selectedToken.id}:preview:${source.cardId}:${source.section}`}>
                    <strong>{source.quantity > 1 ? `${source.quantity}× ` : ""}{source.name}</strong>
                    <small>{sectionLabel(source.section)}</small>
                  </div>
                ))}
              </div>

              {selectedToken.card?.setCode && (
                <small className="mtg-token-preview__set">
                  {selectedToken.card.setName ?? selectedToken.card.setCode} · {selectedToken.card.setCode}
                  {selectedToken.card.collectorNumber ? ` #${selectedToken.card.collectorNumber}` : ""}
                </small>
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
