"use client";

import { useState } from "react";
import Link from "next/link";

import MyDecksTab from "./tabs/MyDecksTab";
import CardLibraryTab from "./tabs/CardLibraryTab";
import DeckProjectsTab from "./tabs/DeckProjectsTab";
import MtgAuthGate from "./auth/MtgAuthGate";

type MtgTabId = "decks" | "cards" | "projects";

const tabs: {
  id: MtgTabId;
  number: string;
  title: string;
  description: string;
}[] = [
  {
    id: "decks",
    number: "01",
    title: "Mes decks",
    description: "Decks construits et prêts à jouer",
  },
  {
    id: "cards",
    number: "02",
    title: "Toutes les cartes",
    description: "Collection globale et localisation",
  },
  {
    id: "projects",
    number: "03",
    title: "Decks en construction",
    description: "Idées et futurs decks",
  },
];

function MtgDashboardContent() {
  const [activeTab, setActiveTab] = useState<MtgTabId>("decks");

  return (
    <main className="mtg-dashboard">
      <div className="mtg-dashboard__background" />

      <header className="mtg-dashboard__header">
        <div className="mtg-dashboard__topbar">
          <Link href="/" className="mtg-dashboard__back">
            <span>←</span>
            Projets
          </Link>

          <div className="mtg-dashboard__game-label">
            MAGIC · THE GATHERING
          </div>
        </div>

        <div className="mtg-dashboard__intro">
          <div>
            <p className="mtg-dashboard__eyebrow">COLLECTION PERSONNELLE</p>

            <h1>
              Magic
              <span> Library</span>
            </h1>

            <p className="mtg-dashboard__subtitle">
              Decks, collection de cartes et projets à venir.
            </p>
          </div>

          <div className="mtg-dashboard__edition">
            <span>FORMAT PRINCIPAL</span>
            <strong>COMMANDER</strong>
          </div>
        </div>
      </header>

      <nav
        className="mtg-dashboard__tabs"
        role="tablist"
        aria-label="Navigation Magic"
      >
        {tabs.map((tab) => {
          const active = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`mtg-dashboard__tab ${active ? "is-active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <div className="mtg-dashboard__tab-top">
                <span className="mtg-dashboard__tab-number">{tab.number}</span>
                <span className="mtg-dashboard__tab-arrow">→</span>
              </div>

              <strong>{tab.title}</strong>
              <span className="mtg-dashboard__tab-description">
                {tab.description}
              </span>
              <div className="mtg-dashboard__tab-line" />
            </button>
          );
        })}
      </nav>

      <section className="mtg-dashboard__content">
        {activeTab === "decks" && <MyDecksTab />}
        {activeTab === "cards" && <CardLibraryTab />}
        {activeTab === "projects" && <DeckProjectsTab />}
      </section>
    </main>
  );
}


export default function MtgDashboard() {
  return (
    <MtgAuthGate>
      <MtgDashboardContent />
    </MtgAuthGate>
  );
}
