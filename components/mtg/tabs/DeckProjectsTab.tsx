"use client";

import { useEffect, useState } from "react";
import DeckBuilder from "../deck-builder/DeckBuilder";
import DeckCardPicker from "../deck-builder/DeckCardPicker";
import {
  loadDeckProjects,
  saveDeckProjects,
  slugifyDeckName,
} from "@/lib/mtg/deck-storage";
import { getCommanderEligibility } from "@/lib/mtg/deck-analyzer";
import type { DeckProject, MtgCard } from "@/types/mtg";

export default function DeckProjectsTab() {
  const [projects, setProjects] = useState<DeckProject[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCommander, setNewCommander] = useState<MtgCard | null>(null);

  useEffect(() => {
    setProjects(loadDeckProjects());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveDeckProjects(projects);
  }, [projects, hydrated]);

  const selected = projects.find((project) => project.id === selectedId) ?? null;
  const buildingProjects = projects.filter((project) => project.status === "building");

  if (selected) {
    return (
      <DeckBuilder
        deck={selected}
        allDecks={projects}
        onBack={() => setSelectedId(null)}
        onChange={(next) =>
          setProjects((current) =>
            current.map((project) => (project.id === next.id ? next : project)),
          )
        }
        onDelete={() => {
          setProjects((current) => current.filter((project) => project.id !== selected.id));
          setSelectedId(null);
        }}
        onMarkReady={(readyDeck) => {
          setProjects((current) =>
            current.map((project) => (project.id === readyDeck.id ? readyDeck : project)),
          );
          setSelectedId(null);
        }}
      />
    );
  }

  const createProject = () => {
    if (!newName.trim() || !newCommander) return;

    const commanderCheck = getCommanderEligibility(newCommander);
    if (!commanderCheck.ok) return;

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const deck: DeckProject = {
      id,
      name: newName.trim(),
      slug: `${slugifyDeckName(newName)}-${id.slice(0, 6)}`,
      format: "Commander",
      status: "building",
      commanders: [{ card: newCommander, quantity: 1, section: "commander" }],
      cards: [],
      createdAt: now,
      updatedAt: now,
    };

    setProjects((current) => [deck, ...current]);
    setCreating(false);
    setNewName("");
    setNewCommander(null);
    setSelectedId(deck.id);
  };

  return (
    <div className="mtg-tab-page">
      <div className="mtg-tab-page__header">
        <div>
          <span className="mtg-tab-page__eyebrow">DECK LAB</span>
          <h2>Decks en construction</h2>
          <p>Création, import, bracket dynamique, combos et statistiques de mana.</p>
        </div>
        <button
          className="mtg-primary-button"
          type="button"
          onClick={() => setCreating((value) => !value)}
        >
          {creating ? "Annuler" : "+ Nouveau projet"}
        </button>
      </div>

      {creating && (
        <section className="mtg-new-deck">
          <div>
            <span className="mtg-tab-page__eyebrow">NOUVEAU COMMANDER</span>
            <h3>Créer un deck en construction</h3>
          </div>

          <label className="mtg-new-deck__name">
            <span>Nom du projet</span>
            <input
              value={newName}
              placeholder="Ex. Kona stompy"
              onChange={(event) => setNewName(event.target.value)}
            />
          </label>

          <DeckCardPicker
            label="Commandant"
            placeholder="Kona, Rescue Beastie…"
            buttonLabel="Choisir"
            validate={(card) => {
              const result = getCommanderEligibility(card);
              return result.ok ? null : result.reason;
            }}
            onSelect={setNewCommander}
          />

          {newCommander && (
            <div className="mtg-new-deck__commander">
              {newCommander.imageUri && <img src={newCommander.imageUri} alt="" />}
              <div>
                <span>COMMANDANT SÉLECTIONNÉ</span>
                <strong>{newCommander.name}</strong>
                <small>{newCommander.colorIdentity.join("") || "C"}</small>
              </div>
            </div>
          )}

          <button
            className="mtg-primary-button"
            type="button"
            disabled={!newName.trim() || !newCommander}
            onClick={createProject}
          >
            Créer le projet
          </button>
        </section>
      )}

      {!hydrated ? (
        <div className="mtg-empty-state"><strong>Chargement…</strong></div>
      ) : buildingProjects.length === 0 ? (
        <div className="mtg-empty-state">
          <span className="mtg-empty-state__number">03</span>
          <div>
            <strong>Aucun deck en construction</strong>
            <p>
              Crée un nouveau projet ou remets un deck prêt en construction depuis
              l&apos;onglet Mes decks.
            </p>
          </div>
        </div>
      ) : (
        <div className="mtg-deck-project-grid">
          {buildingProjects.map((project) => {
            const commander = project.commanders[0]?.card;
            const mainCount = project.cards
              .filter((entry) => entry.section === "mainboard")
              .reduce((sum, entry) => sum + entry.quantity, 0);
            const commanderCount = project.commanders.reduce(
              (sum, entry) => sum + entry.quantity,
              0,
            );
            const total = mainCount + commanderCount;

            return (
              <button
                key={project.id}
                type="button"
                className="mtg-deck-project-card"
                onClick={() => setSelectedId(project.id)}
              >
                <span className="mtg-deck-project-card__image">
                  {commander?.imageUri ? <img src={commander.imageUri} alt="" /> : "CMD"}
                </span>
                <span className="mtg-deck-project-card__content">
                  <small>COMMANDER · {total}/100</small>
                  <strong>{project.name}</strong>
                  <span>{commander?.name ?? "Sans commandant"}</span>
                  <em>Ouvrir le deck →</em>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
