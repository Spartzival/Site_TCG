"use client";

import { useEffect, useMemo, useState } from "react";
import DeckBuilder from "../deck-builder/DeckBuilder";
import { analyzeDeckLocally } from "@/lib/mtg/deck-analyzer";
import { normalizeDeckFormat } from "@/lib/mtg/deck-format";
import { loadDeckProjects, saveDeckProjects } from "@/lib/mtg/deck-storage";
import type { DeckFormat, DeckProject } from "@/types/mtg";

type Props = { format: DeckFormat };

export default function MyDecksTab({ format }: Props) {
  const [decks, setDecks] = useState<DeckProject[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setDecks(loadDeckProjects());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveDeckProjects(decks);
  }, [decks, hydrated]);

  useEffect(() => {
    setSelectedId(null);
  }, [format]);

  const activeDecks = useMemo(
    () =>
      decks.filter(
        (deck) => deck.status === "active" && normalizeDeckFormat(deck.format) === format,
      ),
    [decks, format],
  );

  const selected = decks.find((deck) => deck.id === selectedId) ?? null;

  if (selected) {
    return (
      <DeckBuilder
        deck={selected}
        allDecks={decks}
        onBack={() => setSelectedId(null)}
        onChange={(next) =>
          setDecks((current) =>
            current.map((deck) => (deck.id === next.id ? next : deck)),
          )
        }
        onDelete={() => {
          setDecks((current) => current.filter((deck) => deck.id !== selected.id));
          setSelectedId(null);
        }}
        onReturnToBuilding={(buildingDeck) => {
          setDecks((current) =>
            current.map((deck) => (deck.id === buildingDeck.id ? buildingDeck : deck)),
          );
          setSelectedId(null);
        }}
      />
    );
  }

  return (
    <div className="mtg-tab-page">
      <div className="mtg-tab-page__header">
        <div>
          <span className="mtg-tab-page__eyebrow">{format.toUpperCase()} · DECK LIBRARY</span>
          <h2>Mes decks</h2>
          <p>Decks {format} validés, prêts à jouer et consultables en détail.</p>
        </div>
      </div>

      {!hydrated ? (
        <div className="mtg-empty-state"><strong>Chargement…</strong></div>
      ) : activeDecks.length === 0 ? (
        <div className="mtg-empty-state">
          <span className="mtg-empty-state__number">01</span>
          <div>
            <strong>Aucun deck {format} prêt pour le moment</strong>
            <p>
              Termine un deck dans « Decks en construction ». Lorsqu&apos;il respecte les validations {format},
              tu pourras le marquer comme prêt et il apparaîtra automatiquement ici.
            </p>
          </div>
        </div>
      ) : (
        <div className="mtg-deck-project-grid">
          {activeDecks.map((deck) => {
            const commander = deck.commanders[0]?.card;
            const featured = commander ?? deck.cards.find((entry) => entry.section === "mainboard")?.card;
            const analysis = analyzeDeckLocally(deck);
            const identity = analysis.commanderIdentity.length
              ? analysis.commanderIdentity.join("")
              : "C";

            return (
              <button
                key={deck.id}
                type="button"
                className="mtg-deck-project-card mtg-ready-deck-card"
                onClick={() => setSelectedId(deck.id)}
              >
                <span className="mtg-deck-project-card__image">
                  {featured?.imageUri ? <img src={featured.imageUri} alt="" /> : format === "Commander" ? "CMD" : "STD"}
                </span>

                <span className="mtg-deck-project-card__content">
                  <small>
                    {format === "Commander"
                      ? `COMMANDER · ${analysis.totalCards}/100 · ${identity}`
                      : `STANDARD · ${analysis.mainboardCount} MAIN · ${analysis.sideboardCount} SIDE`}
                  </small>
                  <strong>{deck.name}</strong>
                  <span>{format === "Commander" ? commander?.name ?? "Sans commandant" : "Deck Standard"}</span>

                  <span className="mtg-ready-deck-card__meta">
                    <b>PRÊT</b>
                    <i>
                      {format === "Commander"
                        ? deck.bracket
                          ? `Bracket ${deck.bracket}`
                          : "Bracket en analyse"
                        : "Standard"}
                    </i>
                  </span>

                  <em>Voir le deck et ses cartes →</em>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
