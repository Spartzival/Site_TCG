"use client";

import { useEffect, useMemo, useState } from "react";
import DeckCardPicker from "./DeckCardPicker";
import DeckImportPanel from "./DeckImportPanel";
import DeckStatsPanel from "./DeckStatsPanel";
import DeckBracketPanel from "./DeckBracketPanel";
import DeckComboPanel from "./DeckComboPanel";
import DeckCardDetailDrawer from "./DeckCardDetailDrawer";
import DeckReadinessPanel from "./DeckReadinessPanel";
import {
  analyzeDeckLocally,
  evaluateDeckEligibility,
  getCommanderEligibility,
} from "@/lib/mtg/deck-analyzer";
import { loadCollection } from "@/lib/mtg/collection-storage";
import {
  buildAvailableCopies,
  countPhysicalMissingCopies,
  logicalCardId,
} from "@/lib/mtg/deck-inventory";
import { fetchJson } from "@/lib/http/fetch-json";
import { cardHasRole } from "@/lib/mtg/card-role-analyzer";
import { copyTextToClipboard, exportDeckNames } from "@/lib/mtg/deck-export";
import type {
  CollectionCard,
  DeckCardEntry,
  DeckProject,
  DeckRemoteAnalysis,
  MtgCard,
} from "@/types/mtg";

type Props = {
  deck: DeckProject;
  allDecks: DeckProject[];
  onChange: (deck: DeckProject) => void;
  onBack: () => void;
  onDelete: () => void;
  onMarkReady?: (deck: DeckProject) => void;
  onReturnToBuilding?: (deck: DeckProject) => void;
};

type DeckDimension = "type" | "color" | "section" | "role";
type DeckSort = "name" | "quantity" | "mana";
type DeckDisplayMode = "image" | "image-name" | "name";

type DeckFolder = {
  id: string;
  label: string;
  description: string;
  symbol: string;
  predicate: (entry: DeckCardEntry) => boolean;
};

const TYPE_FOLDERS: DeckFolder[] = [
  {
    id: "lands",
    label: "Terrains",
    description: "Bases de mana et terrains utilitaires",
    symbol: "LND",
    predicate: (entry) => entry.card.typeLine?.includes("Land") ?? false,
  },
  {
    id: "creatures",
    label: "Créatures",
    description: "Créatures et créatures-artefacts",
    symbol: "CRE",
    predicate: (entry) =>
      !entry.card.typeLine?.includes("Land") &&
      (entry.card.typeLine?.includes("Creature") ?? false),
  },
  {
    id: "artifacts",
    label: "Artefacts",
    description: "Artefacts non-créatures",
    symbol: "ART",
    predicate: (entry) =>
      !entry.card.typeLine?.includes("Creature") &&
      (entry.card.typeLine?.includes("Artifact") ?? false),
  },
  {
    id: "enchantments",
    label: "Enchantements",
    description: "Enchantements et sagas",
    symbol: "ENC",
    predicate: (entry) => entry.card.typeLine?.includes("Enchantment") ?? false,
  },
  {
    id: "instants",
    label: "Éphémères",
    description: "Interaction et réponses instantanées",
    symbol: "INS",
    predicate: (entry) => entry.card.typeLine?.includes("Instant") ?? false,
  },
  {
    id: "sorceries",
    label: "Rituels",
    description: "Sorts de rituel",
    symbol: "RIT",
    predicate: (entry) => entry.card.typeLine?.includes("Sorcery") ?? false,
  },
  {
    id: "planeswalkers",
    label: "Planeswalkers",
    description: "Cartes de planeswalker",
    symbol: "PLW",
    predicate: (entry) => entry.card.typeLine?.includes("Planeswalker") ?? false,
  },
  {
    id: "battles",
    label: "Batailles",
    description: "Cartes Battle",
    symbol: "BAT",
    predicate: (entry) => entry.card.typeLine?.includes("Battle") ?? false,
  },
  {
    id: "other",
    label: "Autres",
    description: "Cartes hors catégories principales",
    symbol: "AUT",
    predicate: (entry) => {
      const type = entry.card.typeLine ?? "";
      return ![
        "Land",
        "Creature",
        "Artifact",
        "Enchantment",
        "Instant",
        "Sorcery",
        "Planeswalker",
        "Battle",
      ].some((token) => type.includes(token));
    },
  },
];

const COLOR_FOLDERS: DeckFolder[] = [
  {
    id: "white",
    label: "Blanc",
    description: "Identité couleur blanche uniquement",
    symbol: "W",
    predicate: (entry) =>
      entry.card.colorIdentity?.length === 1 && entry.card.colorIdentity[0] === "W",
  },
  {
    id: "blue",
    label: "Bleu",
    description: "Identité couleur bleue uniquement",
    symbol: "U",
    predicate: (entry) =>
      entry.card.colorIdentity?.length === 1 && entry.card.colorIdentity[0] === "U",
  },
  {
    id: "black",
    label: "Noir",
    description: "Identité couleur noire uniquement",
    symbol: "B",
    predicate: (entry) =>
      entry.card.colorIdentity?.length === 1 && entry.card.colorIdentity[0] === "B",
  },
  {
    id: "red",
    label: "Rouge",
    description: "Identité couleur rouge uniquement",
    symbol: "R",
    predicate: (entry) =>
      entry.card.colorIdentity?.length === 1 && entry.card.colorIdentity[0] === "R",
  },
  {
    id: "green",
    label: "Vert",
    description: "Identité couleur verte uniquement",
    symbol: "G",
    predicate: (entry) =>
      entry.card.colorIdentity?.length === 1 && entry.card.colorIdentity[0] === "G",
  },
  {
    id: "multicolor",
    label: "Multicolore",
    description: "Deux couleurs ou plus",
    symbol: "M",
    predicate: (entry) => (entry.card.colorIdentity?.length ?? 0) > 1,
  },
  {
    id: "colorless",
    label: "Incolore",
    description: "Aucune identité couleur",
    symbol: "C",
    predicate: (entry) => (entry.card.colorIdentity?.length ?? 0) === 0,
  },
];

const SECTION_FOLDERS: DeckFolder[] = [
  {
    id: "mainboard",
    label: "Deck principal",
    description: "Cartes actuellement dans les 99",
    symbol: "MAIN",
    predicate: (entry) => entry.section === "mainboard",
  },
  {
    id: "sideboard",
    label: "Sideboard",
    description: "Cartes conservées dans la zone sideboard",
    symbol: "SIDE",
    predicate: (entry) => entry.section === "sideboard",
  },
  {
    id: "maybeboard",
    label: "Maybeboard",
    description: "Cartes envisagées mais pas encore intégrées",
    symbol: "MAY",
    predicate: (entry) => entry.section === "maybeboard",
  },
];

const ROLE_FOLDERS: DeckFolder[] = [
  {
    id: "ramp",
    label: "Ramp",
    description: "Accélération de mana, trésors, mana rocks, dorks et terrains supplémentaires",
    symbol: "RMP",
    predicate: (entry) => cardHasRole(entry.card, "ramp"),
  },
  {
    id: "draw",
    label: "Pioche",
    description: "Pioche de cartes et moteurs de card advantage",
    symbol: "DRW",
    predicate: (entry) => cardHasRole(entry.card, "draw"),
  },
  {
    id: "removal",
    label: "Removal ciblé",
    description: "Destruction, exil et interaction ciblée",
    symbol: "REM",
    predicate: (entry) => cardHasRole(entry.card, "removal"),
  },
  {
    id: "board-wipe",
    label: "Wrath / Board wipe",
    description: "Nettoyage global du champ de bataille",
    symbol: "WIP",
    predicate: (entry) => cardHasRole(entry.card, "board-wipe"),
  },
  {
    id: "tutor",
    label: "Tutor",
    description: "Recherche de cartes dans la bibliothèque",
    symbol: "TUT",
    predicate: (entry) => cardHasRole(entry.card, "tutor"),
  },
  {
    id: "recursion",
    label: "Récursion",
    description: "Récupération et lancement de cartes depuis le cimetière",
    symbol: "REC",
    predicate: (entry) => cardHasRole(entry.card, "recursion"),
  },
  {
    id: "protection",
    label: "Protection",
    description: "Hexproof, Ward, indestructible, pillow-fort et prévention",
    symbol: "PRO",
    predicate: (entry) => cardHasRole(entry.card, "protection"),
  },
  {
    id: "evasion",
    label: "Évasion",
    description: "Vol, menace, piétinement et autres moyens de passer les bloqueurs",
    symbol: "EVA",
    predicate: (entry) => cardHasRole(entry.card, "evasion"),
  },
  {
    id: "tax-stax",
    label: "Tax / Stax",
    description: "Taxes, restrictions d’attaque, ralentissement et effets de verrouillage",
    symbol: "TAX",
    predicate: (entry) => cardHasRole(entry.card, "tax-stax"),
  },
  {
    id: "counterspell",
    label: "Counterspells",
    description: "Contresorts et interaction sur la pile",
    symbol: "CTR",
    predicate: (entry) => cardHasRole(entry.card, "counterspell"),
  },
  {
    id: "tokens",
    label: "Tokens",
    description: "Création de jetons et production de board",
    symbol: "TOK",
    predicate: (entry) => cardHasRole(entry.card, "tokens"),
  },
  {
    id: "sacrifice",
    label: "Sacrifice",
    description: "Sac outlets, coûts de sacrifice et synergies associées",
    symbol: "SAC",
    predicate: (entry) => cardHasRole(entry.card, "sacrifice"),
  },
  {
    id: "lifegain-drain",
    label: "Gain / Drain",
    description: "Gain de vie et perte de vie des adversaires",
    symbol: "LIF",
    predicate: (entry) => cardHasRole(entry.card, "lifegain-drain"),
  },
  {
    id: "graveyard-hate",
    label: "Interaction cimetière",
    description: "Exil et verrouillage des cimetières adverses",
    symbol: "GY",
    predicate: (entry) => cardHasRole(entry.card, "graveyard-hate"),
  },
  {
    id: "blink",
    label: "Blink / Flicker",
    description: "Exile puis renvoie tes permanents pour réutiliser leurs effets",
    symbol: "BLK",
    predicate: (entry) => cardHasRole(entry.card, "blink"),
  },
  {
    id: "discard",
    label: "Défausse",
    description: "Fait défausser des cartes aux adversaires",
    symbol: "DSC",
    predicate: (entry) => cardHasRole(entry.card, "discard"),
  },
  {
    id: "mill",
    label: "Meule",
    description: "Met des cartes de la bibliothèque au cimetière",
    symbol: "MIL",
    predicate: (entry) => cardHasRole(entry.card, "mill"),
  },
  {
    id: "finisher",
    label: "Finisher / Wincon",
    description: "Menaces ou effets capables de fermer rapidement la partie",
    symbol: "WIN",
    predicate: (entry) => cardHasRole(entry.card, "finisher"),
  },
  {
    id: "other",
    label: "Autres rôles",
    description: "Cartes non classées automatiquement dans les rôles ci-dessus",
    symbol: "AUT",
    predicate: (entry) => cardHasRole(entry.card, "other"),
  },
];
function mergeEntries(current: DeckCardEntry[], incoming: DeckCardEntry[]) {
  const map = new Map<string, DeckCardEntry>();
  for (const entry of [...current, ...incoming]) {
    const key = `${entry.section}:${logicalCardId(entry.card)}`;
    const existing = map.get(key);
    map.set(key, existing ? { ...existing, quantity: existing.quantity + entry.quantity } : entry);
  }
  return Array.from(map.values());
}

export default function DeckBuilder({
  deck,
  allDecks,
  onChange,
  onBack,
  onDelete,
  onMarkReady,
  onReturnToBuilding,
}: Props) {
  const [remote, setRemote] = useState<DeckRemoteAnalysis | null>(null);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [collection, setCollection] = useState<CollectionCard[]>([]);
  const [selectedEntryKey, setSelectedEntryKey] = useState<string | null>(null);

  const [deckDimension, setDeckDimension] = useState<DeckDimension | null>(null);
  const [deckFolderId, setDeckFolderId] = useState<string | null>(null);
  const [deckSortBy, setDeckSortBy] = useState<DeckSort>("name");
  const [deckDisplayMode, setDeckDisplayMode] = useState<DeckDisplayMode>("image-name");
  const [deckSearch, setDeckSearch] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  useEffect(() => {
    setCollection(loadCollection());
  }, []);

  const local = useMemo(() => analyzeDeckLocally(deck), [deck]);
  const readOnly = deck.status === "active";

  const inventory = useMemo(
    () => buildAvailableCopies(collection, allDecks, deck.id),
    [collection, allDecks, deck.id],
  );

  const physicalMissingCopies = useMemo(
    () => countPhysicalMissingCopies(deck, inventory.available),
    [deck, inventory.available],
  );

  const eligibility = useMemo(() => {
    const base = evaluateDeckEligibility(deck, local);
    const inventoryCheck = {
      id: "inventory",
      label: "Toutes les cartes physiques sont disponibles",
      ok: physicalMissingCopies === 0,
      detail:
        physicalMissingCopies === 0
          ? "Aucun exemplaire n'est déjà réservé par un autre deck prêt."
          : `${physicalMissingCopies} exemplaire(s) à acquérir ou à libérer d'un autre deck prêt.`,
    };

    return {
      eligible: base.eligible && inventoryCheck.ok,
      checks: [...base.checks, inventoryCheck],
    };
  }, [deck, local, physicalMissingCopies]);

  const cardsToAdd = Math.max(0, 100 - local.totalCards);
  const cardsToRemove = Math.max(0, local.totalCards - 100);

  useEffect(() => {
    if (deck.commanders.length === 0) {
      setRemote(null);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setRemoteLoading(true);
      try {
        const payload = await fetchJson<DeckRemoteAnalysis>("/api/mtg/decks/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            commanders: deck.commanders.map((entry) => ({
              card: entry.card.name,
              quantity: entry.quantity,
            })),
            main: deck.cards
              .filter((entry) => entry.section === "mainboard")
              .map((entry) => ({ card: entry.card.name, quantity: entry.quantity })),
          }),
        });
        if (!controller.signal.aborted) setRemote(payload);
      } catch {
        if (!controller.signal.aborted) setRemote(null);
      } finally {
        if (!controller.signal.aborted) setRemoteLoading(false);
      }
    }, 700);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [deck.commanders, deck.cards]);

  const update = (patch: Partial<DeckProject>) => {
    onChange({ ...deck, ...patch, updatedAt: new Date().toISOString() });
  };

  const copyDecklist = async () => {
    try {
      await copyTextToClipboard(exportDeckNames(deck));
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 2500);
    }
  };

  const addMainCard = (card: MtgCard) => {
    update({
      cards: mergeEntries(deck.cards, [{ card, quantity: 1, section: "mainboard" }]),
    });
  };

  const changeQuantity = (cardId: string, delta: number) => {
    const next = deck.cards
      .map((entry) =>
        logicalCardId(entry.card) === cardId
          ? { ...entry, quantity: Math.max(0, entry.quantity + delta) }
          : entry,
      )
      .filter((entry) => entry.quantity > 0);
    update({ cards: next });
  };

  const replaceCommander = (nextCommander: MtgCard) => {
    const check = getCommanderEligibility(nextCommander);
    if (!check.ok) return;

    const currentCommander = deck.commanders[0]?.card;
    const nextId = logicalCardId(nextCommander);
    const currentId = currentCommander ? logicalCardId(currentCommander) : null;

    if (currentId === nextId) return;

    // If the new commander is already in the deck, consume one of those copies
    // instead of duplicating the physical/logical card.
    let consumed = false;
    const nextCards = deck.cards.flatMap((entry) => {
      if (!consumed && logicalCardId(entry.card) === nextId) {
        consumed = true;
        return entry.quantity > 1 ? [{ ...entry, quantity: entry.quantity - 1 }] : [];
      }
      return [entry];
    });

    // Keep the previous commander in the 99 when switching leaders.
    const cardsWithOldCommander = currentCommander
      ? mergeEntries(nextCards, [
          { card: currentCommander, quantity: 1, section: "mainboard" },
        ])
      : nextCards;

    update({
      commanders: [{ card: nextCommander, quantity: 1, section: "commander" }],
      cards: cardsWithOldCommander,
    });
  };

  const availableById = inventory.available;
  const reservedById = inventory.reserved;

  const commander = deck.commanders[0]?.card;

  const deckFolders = useMemo(() => {
    if (deckDimension === "type") return TYPE_FOLDERS;
    if (deckDimension === "color") return COLOR_FOLDERS;
    if (deckDimension === "section") return SECTION_FOLDERS;
    if (deckDimension === "role") return ROLE_FOLDERS;
    return [];
  }, [deckDimension]);

  const activeDeckFolder = useMemo(
    () => deckFolders.find((folder) => folder.id === deckFolderId) ?? null,
    [deckFolderId, deckFolders],
  );

  const visibleDeckCards = useMemo(() => {
    let result =
      deckFolderId === "__all__"
        ? deck.cards
        : activeDeckFolder
          ? deck.cards.filter(activeDeckFolder.predicate)
          : [];

    const normalized = deckSearch.trim().toLocaleLowerCase("fr");
    if (normalized) {
      result = result.filter((entry) =>
        [entry.card.name, entry.card.typeLine, entry.card.setName, entry.card.setCode]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("fr")
          .includes(normalized),
      );
    }

    return [...result].sort((a, b) => {
      if (deckSortBy === "quantity") {
        return b.quantity - a.quantity || a.card.name.localeCompare(b.card.name);
      }

      if (deckSortBy === "mana") {
        const aMana = a.card.manaValue ?? 0;
        const bMana = b.card.manaValue ?? 0;
        return aMana - bMana || a.card.name.localeCompare(b.card.name);
      }

      return a.card.name.localeCompare(b.card.name);
    });
  }, [activeDeckFolder, deck.cards, deckFolderId, deckSearch, deckSortBy]);

  const detailCardsForNavigation = useMemo(() => {
    if (deckFolderId) return visibleDeckCards;
    return deck.cards.slice().sort((a, b) => a.card.name.localeCompare(b.card.name));
  }, [deck.cards, deckFolderId, visibleDeckCards]);

  const detailItems = useMemo(() => {
    const commanders = deck.commanders.map((entry, index) => ({
      key: `commander:${index}`,
      entry,
    }));

    const cards = detailCardsForNavigation.map((entry) => {
      const originalIndex = deck.cards.indexOf(entry);

      return {
        key: `card:${originalIndex}`,
        entry,
      };
    });

    return [...commanders, ...cards];
  }, [deck.commanders, deck.cards, detailCardsForNavigation]);

  const selectedDetailIndex = selectedEntryKey
    ? detailItems.findIndex((item) => item.key === selectedEntryKey)
    : -1;

  const selectedEntry =
    selectedDetailIndex >= 0 ? detailItems[selectedDetailIndex].entry : null;

  const selectedCollectionItem = selectedEntry
    ? collection.find((item) => item.id === logicalCardId(selectedEntry.card)) ?? null
    : null;

  const canPreviousCard = selectedDetailIndex > 0;
  const canNextCard =
    selectedDetailIndex >= 0 && selectedDetailIndex < detailItems.length - 1;

  const changeSelectedPrinting = (nextPrinting: MtgCard) => {
    if (!selectedEntry || !selectedEntryKey) return;

    const logicalId = selectedEntry.card.oracleId ?? selectedEntry.card.id;

    // Refuse silently any printing that would not represent the same Oracle card.
    if (
      selectedEntry.card.oracleId &&
      nextPrinting.oracleId &&
      selectedEntry.card.oracleId !== nextPrinting.oracleId
    ) {
      return;
    }

    const replacementCard: MtgCard = {
      ...nextPrinting,
      id: logicalId,
      oracleId: selectedEntry.card.oracleId ?? nextPrinting.oracleId,
    };

    if (selectedEntryKey.startsWith("commander:")) {
      const index = Number(selectedEntryKey.split(":")[1]);
      if (!Number.isInteger(index) || index < 0 || index >= deck.commanders.length) {
        return;
      }

      update({
        commanders: deck.commanders.map((entry, currentIndex) =>
          currentIndex === index ? { ...entry, card: replacementCard } : entry,
        ),
      });
      return;
    }

    if (selectedEntryKey.startsWith("card:")) {
      const index = Number(selectedEntryKey.split(":")[1]);
      if (!Number.isInteger(index) || index < 0 || index >= deck.cards.length) {
        return;
      }

      update({
        cards: deck.cards.map((entry, currentIndex) =>
          currentIndex === index ? { ...entry, card: replacementCard } : entry,
        ),
      });
    }
  };

  const openDeckDimension = (dimension: DeckDimension) => {
    setDeckDimension(dimension);
    setDeckFolderId(null);
    setDeckSearch("");
    setDeckSortBy("name");
    setSelectedEntryKey(null);
  };

  const returnToDeckHome = () => {
    setDeckDimension(null);
    setDeckFolderId(null);
    setDeckSearch("");
    setDeckSortBy("name");
    setSelectedEntryKey(null);
  };

  const returnToDeckFolders = () => {
    if (deckFolderId === "__all__") {
      returnToDeckHome();
      return;
    }

    setDeckFolderId(null);
    setDeckSearch("");
    setSelectedEntryKey(null);
  };

  const dimensionLabel =
    deckFolderId === "__all__"
      ? "Liste complète"
      : deckDimension === "type"
        ? "Types"
        : deckDimension === "color"
          ? "Couleurs"
          : deckDimension === "role"
            ? "Rôles"
            : "Zones du deck";

  return (
    <div className={`mtg-deck-builder ${readOnly ? "is-readonly" : ""}`}>
      <div className="mtg-deck-builder__topbar">
        <button type="button" className="mtg-dashboard__back" onClick={onBack}>
          {readOnly ? "← Mes decks" : "← Projets de decks"}
        </button>

        <div className="mtg-deck-builder__status-actions">
          <button
            type="button"
            className="mtg-secondary-button"
            onClick={copyDecklist}
            title="Copier les quantités et noms des cartes dans le presse-papiers"
          >
            {copyState === "copied"
              ? "Liste copiée ✓"
              : copyState === "error"
                ? "Copie impossible"
                : "Copier la decklist"}
          </button>

          {readOnly && onReturnToBuilding && (
            <button
              type="button"
              className="mtg-secondary-button"
              onClick={() =>
                onReturnToBuilding({
                  ...deck,
                  status: "building",
                  updatedAt: new Date().toISOString(),
                })
              }
            >
              Remettre en construction
            </button>
          )}

          <button
            type="button"
            className="mtg-deck-builder__delete"
            onClick={() => {
              if (window.confirm(`Supprimer le deck « ${deck.name} » ?`)) onDelete();
            }}
          >
            Supprimer le deck
          </button>
        </div>
      </div>

      <header className="mtg-deck-builder__hero">
        <button
          type="button"
          className="mtg-deck-builder__commander mtg-deck-builder__commander-button"
          onClick={() => commander && setSelectedEntryKey("commander:0")}
          aria-label={commander ? `Voir les détails de ${commander.name}` : "Aucun commandant"}
          disabled={!commander}
        >
          {commander?.imageUri ? <img src={commander.imageUri} alt={commander.name} /> : <span>CMD</span>}
        </button>
        <div>
          <span className="mtg-tab-page__eyebrow">{readOnly ? "DECK PRÊT" : "DECK EN CONSTRUCTION"}</span>
          <input
            className="mtg-deck-builder__name"
            value={deck.name}
            readOnly={readOnly}
            onChange={(event) => !readOnly && update({ name: event.target.value })}
          />
          <p>{commander ? commander.name : "Aucun commandant"} · Commander</p>
          <div className="mtg-deck-builder__identity">
            {(local.commanderIdentity.length ? local.commanderIdentity : ["C"]).map((color) => (
              <span key={color}>{color}</span>
            ))}
          </div>
        </div>
        <div className="mtg-deck-builder__hero-stats">
          <div><span>Deck</span><strong>{local.totalCards}/100</strong></div>
          <div><span>Terrains</span><strong>{local.landCount}</strong></div>
          <div>
            <span>{cardsToRemove > 0 ? "À retirer" : "À ajouter"}</span>
            <strong>{cardsToRemove > 0 ? cardsToRemove : cardsToAdd}</strong>
          </div>
          <div><span>À acquérir</span><strong>{physicalMissingCopies}</strong></div>
        </div>
      </header>

      {!readOnly && onMarkReady && (
        <DeckReadinessPanel
          eligibility={eligibility}
          onMarkReady={() => {
            if (!eligibility.eligible) return;
            const detectedBracket = deck.cedhIntent
              ? 5
              : remote?.estimatedBracket ?? remote?.minimumBracket ?? deck.bracket;

            onMarkReady({
              ...deck,
              status: "active",
              bracket: detectedBracket ?? deck.bracket,
              updatedAt: new Date().toISOString(),
            });
          }}
        />
      )}

      <DeckBracketPanel
        analysis={remote}
        loading={remoteLoading}
        cedhIntent={Boolean(deck.cedhIntent)}
        readOnly={readOnly}
        onCedhIntentChange={(cedhIntent) => !readOnly && update({ cedhIntent })}
      />

      <div className="mtg-deck-builder__workspace">
        <section className="mtg-deck-builder__list-panel">
          {!readOnly && (
            <div className="mtg-deck-builder__tools">
              <DeckCardPicker
                label="Choisir / changer le commandant"
                placeholder="Créature légendaire, Vehicle, Spacecraft…"
                buttonLabel="Commandant"
                validate={(card) => {
                  const result = getCommanderEligibility(card);
                  return result.ok ? null : result.reason;
                }}
                onSelect={replaceCommander}
              />
              <DeckCardPicker label="Ajouter une carte" onSelect={addMainCard} />
              <DeckImportPanel
                onImport={(entries, commanders) =>
                  update({
                    cards: mergeEntries(deck.cards, entries),
                    commanders: commanders.length
                      ? mergeEntries(deck.commanders, commanders)
                      : deck.commanders,
                  })
                }
              />
            </div>
          )}

          {deck.cards.length === 0 ? (
            <div className="mtg-deck-list">
              <div className="mtg-deck-list__empty">
                Ajoute une carte ou importe une decklist.
              </div>
            </div>
          ) : (
            <>
              <div className="mtg-library-breadcrumb" aria-label="Navigation de la decklist">
                <button type="button" onClick={returnToDeckHome}>
                  Decklist
                </button>

                {deckDimension && (
                  <>
                    <span>›</span>
                    <button type="button" onClick={returnToDeckFolders}>
                      {dimensionLabel}
                    </button>
                  </>
                )}

                {activeDeckFolder && (
                  <>
                    <span>›</span>
                    <strong>{activeDeckFolder.label}</strong>
                  </>
                )}
              </div>

              {!deckDimension ? (
                <div className="mtg-library-dimensions">
                  <button type="button" onClick={() => openDeckDimension("type")}>
                    <span className="mtg-library-dimension__symbol">TYPE</span>
                    <div>
                      <strong>Par type</strong>
                      <p>Créatures, terrains, artefacts, rituels…</p>
                    </div>
                    <span className="mtg-library-dimension__arrow">→</span>
                  </button>

                  <button type="button" onClick={() => openDeckDimension("color")}>
                    <span className="mtg-library-dimension__symbol">WUBRG</span>
                    <div>
                      <strong>Par couleur</strong>
                      <p>Blanc, bleu, noir, rouge, vert, multicolore…</p>
                    </div>
                    <span className="mtg-library-dimension__arrow">→</span>
                  </button>

                  <button type="button" onClick={() => openDeckDimension("role")}>
                    <span className="mtg-library-dimension__symbol">RÔLE</span>
                    <div>
                      <strong>Par rôle</strong>
                      <p>Ramp, pioche, removal, wrath, tutor, récursion…</p>
                    </div>
                    <span className="mtg-library-dimension__arrow">→</span>
                  </button>

                  <button type="button" onClick={() => openDeckDimension("section")}>
                    <span className="mtg-library-dimension__symbol">ZONE</span>
                    <div>
                      <strong>Par zone</strong>
                      <p>Deck principal, sideboard et maybeboard.</p>
                    </div>
                    <span className="mtg-library-dimension__arrow">→</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDeckDimension("type");
                      setDeckFolderId("__all__");
                      setDeckSearch("");
                      setDeckSortBy("name");
                    }}
                  >
                    <span className="mtg-library-dimension__symbol">ALL</span>
                    <div>
                      <strong>Liste complète</strong>
                      <p>Afficher toute la decklist comme auparavant.</p>
                    </div>
                    <span className="mtg-library-dimension__arrow">→</span>
                  </button>
                </div>
              ) : !deckFolderId ? (
                <div className="mtg-library-folders">
                  {deckFolders.map((folder) => {
                    const entries = deck.cards.filter(folder.predicate);
                    const copies = entries.reduce((sum, entry) => sum + entry.quantity, 0);

                    return (
                      <button
                        key={folder.id}
                        type="button"
                        className="mtg-library-folder"
                        onClick={() => {
                          setDeckFolderId(folder.id);
                          setDeckSearch("");
                        }}
                      >
                        <div className="mtg-library-folder__top">
                          <span>{folder.symbol}</span>
                          <span>→</span>
                        </div>
                        <strong>{folder.label}</strong>
                        <p>{folder.description}</p>
                        <div className="mtg-library-folder__stats">
                          <span>{entries.length} cartes</span>
                          <span>{copies} exemplaires</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <>
                  <div className="mtg-library-toolbar">
                    <label className="mtg-library-search">
                      <span>Rechercher dans ce dossier</span>
                      <input
                        type="search"
                        placeholder="Sol Ring, Counterspell, Llanowar Elves…"
                        value={deckSearch}
                        onChange={(event) => setDeckSearch(event.target.value)}
                      />
                    </label>

                    <label className="mtg-library-sort">
                      <span>Trier</span>
                      <select
                        value={deckSortBy}
                        onChange={(event) => setDeckSortBy(event.target.value as DeckSort)}
                      >
                        <option value="name">Nom A → Z</option>
                        <option value="quantity">Quantité</option>
                        <option value="mana">Valeur de mana</option>
                      </select>
                    </label>

                    <div className="mtg-deck-view-toggle" role="group" aria-label="Mode d’affichage des cartes">
                      <span>Affichage</span>
                      <div>
                        <button
                          type="button"
                          className={deckDisplayMode === "image" ? "is-active" : ""}
                          onClick={() => setDeckDisplayMode("image")}
                          aria-pressed={deckDisplayMode === "image"}
                        >
                          Image
                        </button>
                        <button
                          type="button"
                          className={deckDisplayMode === "image-name" ? "is-active" : ""}
                          onClick={() => setDeckDisplayMode("image-name")}
                          aria-pressed={deckDisplayMode === "image-name"}
                        >
                          Image + nom
                        </button>
                        <button
                          type="button"
                          className={deckDisplayMode === "name" ? "is-active" : ""}
                          onClick={() => setDeckDisplayMode("name")}
                          aria-pressed={deckDisplayMode === "name"}
                        >
                          Nom
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mtg-library-folder-title">
                    <div>
                      <span>{activeDeckFolder?.symbol ?? "ALL"}</span>
                      <div>
                        <strong>{activeDeckFolder?.label ?? "Toutes les cartes"}</strong>
                        <p>
                          {activeDeckFolder?.description ??
                            "Decklist complète sans filtre de dossier."}
                        </p>
                      </div>
                    </div>
                    <small>{visibleDeckCards.length} cartes affichées</small>
                  </div>

                  {deckDisplayMode === "image" || deckDisplayMode === "image-name" ? (
                    <div className={`mtg-deck-gallery ${deckDisplayMode === "image" ? "is-image-only" : "is-image-name"}`}>
                      {visibleDeckCards.length === 0 ? (
                        <div className="mtg-deck-list__empty">
                          {deckSearch
                            ? "Aucune carte ne correspond à cette recherche."
                            : "Aucune carte dans ce dossier."}
                        </div>
                      ) : (
                        visibleDeckCards.map((entry) => {
                          const cardId = logicalCardId(entry.card);
                          const available = availableById.get(cardId) ?? 0;
                          const originalIndex = deck.cards.indexOf(entry);
                          const entryKey = `card:${originalIndex}`;

                          return (
                            <article key={entryKey} className="mtg-deck-gallery__item">
                              <button
                                type="button"
                                className="mtg-deck-gallery__card"
                                onClick={() => setSelectedEntryKey(entryKey)}
                                aria-label={`Voir les détails de ${entry.card.name}`}
                              >
                                <span className="mtg-deck-gallery__image">
                                  {entry.card.imageUri ? (
                                    <img src={entry.card.imageUri} alt={entry.card.name} />
                                  ) : (
                                    <span>{entry.card.name}</span>
                                  )}
                                  {deckDisplayMode === "image-name" && (
                                    <span className="mtg-deck-gallery__quantity-badge">×{entry.quantity}</span>
                                  )}
                                </span>

                                {deckDisplayMode === "image-name" && (
                                  <span className="mtg-deck-gallery__name">
                                    <strong>{entry.card.name}</strong>
                                    <small className={available >= entry.quantity ? "is-owned" : "is-missing"}>
                                      {available}/{entry.quantity} disponible
                                    </small>
                                  </span>
                                )}
                              </button>

                              {!readOnly && deckDisplayMode === "image-name" && (
                                <span className="mtg-deck-gallery__controls">
                                  <button type="button" onClick={() => changeQuantity(logicalCardId(entry.card), -1)}>−</button>
                                  <strong>{entry.quantity}</strong>
                                  <button type="button" onClick={() => changeQuantity(logicalCardId(entry.card), 1)}>+</button>
                                </span>
                              )}
                            </article>
                          );
                        })
                      )}
                    </div>
                  ) : (
                    <div className="mtg-deck-list is-name-only">
                      <div className="mtg-deck-list__header">
                        <span>Carte</span><span>Disponible</span><span>Qté</span>
                      </div>

                      {visibleDeckCards.length === 0 ? (
                        <div className="mtg-deck-list__empty">
                          {deckSearch
                            ? "Aucune carte ne correspond à cette recherche."
                            : "Aucune carte dans ce dossier."}
                        </div>
                      ) : (
                        visibleDeckCards.map((entry) => {
                          const cardId = logicalCardId(entry.card);
                          const available = availableById.get(cardId) ?? 0;
                          const originalIndex = deck.cards.indexOf(entry);
                          const entryKey = `card:${originalIndex}`;

                          return (
                            <div key={entryKey} className="mtg-deck-list__row">
                              <button
                                type="button"
                                className="mtg-deck-list__card mtg-deck-list__card-button mtg-deck-list__card-name-only"
                                onClick={() => setSelectedEntryKey(entryKey)}
                                aria-label={`Voir les détails de ${entry.card.name}`}
                              >
                                <span>
                                  <strong>{entry.card.name}</strong>
                                  <small>{entry.card.typeLine}</small>
                                </span>
                              </button>
                              <span className={available >= entry.quantity ? "is-owned" : "is-missing"}>
                                {available}/{entry.quantity}
                              </span>
                              {readOnly ? (
                                <span className="mtg-deck-list__readonly-quantity">×{entry.quantity}</span>
                              ) : (
                                <span className="mtg-deck-list__quantity">
                                  <button type="button" onClick={() => changeQuantity(logicalCardId(entry.card), -1)}>−</button>
                                  <strong>{entry.quantity}</strong>
                                  <button type="button" onClick={() => changeQuantity(logicalCardId(entry.card), 1)}>+</button>
                                </span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </section>

        <aside className="mtg-deck-builder__analysis">
          <DeckStatsPanel analysis={local} />
          <DeckComboPanel
            included={remote?.includedCombos ?? []}
            almost={remote?.almostIncludedCombos ?? []}
            loading={remoteLoading}
          />
        </aside>
      </div>

      <DeckCardDetailDrawer
        entry={selectedEntry}
        collectionItem={selectedCollectionItem}
        availableQuantity={
          selectedEntry ? availableById.get(logicalCardId(selectedEntry.card)) ?? 0 : 0
        }
        reservedElsewhereQuantity={
          selectedEntry ? reservedById.get(logicalCardId(selectedEntry.card)) ?? 0 : 0
        }
        onClose={() => setSelectedEntryKey(null)}
        onChangePrinting={changeSelectedPrinting}
        onPrevious={() => {
          if (!canPreviousCard) return;
          setSelectedEntryKey(detailItems[selectedDetailIndex - 1].key);
        }}
        onNext={() => {
          if (!canNextCard) return;
          setSelectedEntryKey(detailItems[selectedDetailIndex + 1].key);
        }}
        canPrevious={canPreviousCard}
        canNext={canNextCard}
      />
    </div>
  );
}
