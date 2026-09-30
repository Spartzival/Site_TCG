"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import MyDecksTab from "./tabs/MyDecksTab";
import CardLibraryTab from "./tabs/CardLibraryTab";
import DeckProjectsTab from "./tabs/DeckProjectsTab";
import SocialTab from "./tabs/SocialTab";
import DiscoverTab from "./tabs/DiscoverTab";
import MtgAuthGate from "./auth/MtgAuthGate";
import type { DeckFormat } from "@/types/mtg";

type MtgTabId = "decks" | "cards" | "projects" | "social" | "discover";

const FORMAT_STORAGE_KEY = "card-projects:mtg-active-format";

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
  {
    id: "social",
    number: "04",
    title: "Amis & partages",
    description: "Amis, demandes et decks partagés",
  },
  {
    id: "discover",
    number: "05",
    title: "Découvrir",
    description: "Tendances récentes et recommandations",
  },
];

function MtgDashboardContent() {
  const [activeTab, setActiveTab] = useState<MtgTabId>("decks");
  const [activeFormat, setActiveFormat] = useState<DeckFormat>("Commander");

  useEffect(() => {
    const stored = window.localStorage.getItem(FORMAT_STORAGE_KEY);
    if (stored === "Standard" || stored === "Commander") {
      setActiveFormat(stored);
    }
  }, []);

  const changeFormat = (format: DeckFormat) => {
    setActiveFormat(format);
    window.localStorage.setItem(FORMAT_STORAGE_KEY, format);
  };

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
            <span>FORMAT DE DECK</span>
            <div className="mtg-format-switch" role="group" aria-label="Format de deck">
              <button
                type="button"
                className={activeFormat === "Commander" ? "is-active" : ""}
                onClick={() => changeFormat("Commander")}
              >
                Commander
              </button>
              <button
                type="button"
                className={activeFormat === "Standard" ? "is-active" : ""}
                onClick={() => changeFormat("Standard")}
              >
                Standard
              </button>
            </div>
            <small>
              {activeFormat === "Commander"
                ? "100 cartes · singleton · commandant"
                : "60+ cartes · jusqu’à 15 en sideboard"}
            </small>
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
        {activeTab === "decks" && <MyDecksTab format={activeFormat} />}
        {activeTab === "cards" && <CardLibraryTab />}
        {activeTab === "projects" && <DeckProjectsTab format={activeFormat} />}
        {activeTab === "social" && <SocialTab />}
        {activeTab === "discover" && <DiscoverTab format={activeFormat} />}
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
