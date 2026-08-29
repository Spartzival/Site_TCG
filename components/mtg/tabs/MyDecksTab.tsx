"use client";

import { useEffect, useMemo, useState } from "react";
import DeckBuilder from "../deck-builder/DeckBuilder";
import { analyzeDeckLocally } from "@/lib/mtg/deck-analyzer";
import { loadDeckProjects, saveDeckProjects } from "@/lib/mtg/deck-storage";
import type { DeckProject } from "@/types/mtg";

export default function MyDecksTab() {
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

  const activeDecks = useMemo(
    () => decks.filter((deck) => deck.status === "active"),
    [decks],
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
          <span className="mtg-tab-page__eyebrow">DECK LIBRARY</span>
          <h2>Mes decks</h2>
          <p>Decks validés, prêts à jouer et consultables en détail.</p>
        </div>
      </div>

      {!hydrated ? (
        <div className="mtg-empty-state"><strong>Chargement…</strong></div>
      ) : activeDecks.length === 0 ? (
        <div className="mtg-empty-state">
          <span className="mtg-empty-state__number">01</span>
          <div>
            <strong>Aucun deck prêt pour le moment</strong>
            <p>
              Termine un deck dans « Decks en construction ». Lorsqu'il respecte les validations
              Commander, tu pourras le marquer comme prêt et il apparaîtra automatiquement ici.
            </p>
          </div>
        </div>
      ) : (
        <div className="mtg-deck-project-grid">
          {activeDecks.map((deck) => {
            const commander = deck.commanders[0]?.card;
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
                  {commander?.imageUri ? <img src={commander.imageUri} alt="" /> : "CMD"}
                </span>

                <span className="mtg-deck-project-card__content">
                  <small>COMMANDER · {analysis.totalCards}/100 · {identity}</small>
                  <strong>{deck.name}</strong>
                  <span>{commander?.name ?? "Sans commandant"}</span>

                  <span className="mtg-ready-deck-card__meta">
                    <b>PRÊT</b>
                    <i>{deck.bracket ? `Bracket ${deck.bracket}` : "Bracket en analyse"}</i>
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
