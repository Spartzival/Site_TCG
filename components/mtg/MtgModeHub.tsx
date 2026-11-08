"use client";

import Link from "next/link";

const modes = [
  {
    href: "/mtg/decks",
    index: "01",
    eyebrow: "LIBRARY",
    title: "Construction de deck",
    description:
      "Collection, decks Commander & Standard, analyse, combos, brackets, suggestions, tokens et partage.",
    meta: ["Bulk partagé", "Deck builder", "Analyse avancée"],
    accent: "builder",
  },
  {
    href: "/mtg/play",
    index: "02",
    eyebrow: "TABLE",
    title: "Jeu",
    description:
      "Choisis un deck prêt, ouvre une table, invite un joueur avec un code et joue sur un plateau synchronisable.",
    meta: ["Lobby", "Table interactive", "Realtime prototype"],
    accent: "play",
  },
] as const;

export default function MtgModeHub() {
  return (
    <main className="mtg-mode-hub">
      <div className="mtg-mode-hub__background" aria-hidden="true" />

      <header className="mtg-mode-hub__header">
        <Link href="/" className="mtg-mode-hub__back">
          <span>←</span>
          Projets
        </Link>

        <div className="mtg-mode-hub__identity">
          <span>MAGIC · THE GATHERING</span>
          <strong>Choisir un espace</strong>
        </div>
      </header>

      <section className="mtg-mode-hub__hero">
        <p>TON ESPACE MAGIC</p>
        <h1>
          Construire.
          <span> Jouer.</span>
        </h1>
        <p>
          Le même compte, les mêmes decks et la même collection — deux espaces séparés
          pour préparer tes listes ou passer directement à la table.
        </p>
      </section>

      <section className="mtg-mode-hub__grid" aria-label="Choix de l’espace Magic">
        {modes.map((mode) => (
          <Link
            key={mode.href}
            href={mode.href}
            className={`mtg-mode-card is-${mode.accent}`}
          >
            <div className="mtg-mode-card__glow" aria-hidden="true" />
            <div className="mtg-mode-card__top">
              <span>{mode.index}</span>
              <span>{mode.eyebrow}</span>
              <span>↗</span>
            </div>

            <div className="mtg-mode-card__visual" aria-hidden="true">
              <div className="mtg-mode-card__orb" />
              <div className="mtg-mode-card__frame" />
            </div>

            <div className="mtg-mode-card__content">
              <h2>{mode.title}</h2>
              <p>{mode.description}</p>
              <div className="mtg-mode-card__meta">
                {mode.meta.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>

            <div className="mtg-mode-card__cta">
              <strong>Entrer</strong>
              <span>→</span>
            </div>
          </Link>
        ))}
      </section>

      <footer className="mtg-mode-hub__footer">
        <span>Deck data shared between both spaces</span>
        <span>Play · prototype v0.1</span>
      </footer>
    </main>
  );
}
