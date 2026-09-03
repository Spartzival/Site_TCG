"use client";

import { useEffect, useMemo, useState } from "react";
import CardAddDialog from "../library/CardAddDialog";
import CardDetailDrawer from "../library/CardDetailDrawer";
import CollectionImportDialog from "../library/CollectionImportDialog";
import { loadCollection, saveCollection } from "@/lib/mtg/collection-storage";
import { loadDeckProjects } from "@/lib/mtg/deck-storage";
import { buildDeckLocations, getUsedQuantity } from "@/lib/mtg/deck-usage";
import type { CollectionCard, DeckProject, MtgCard } from "@/types/mtg";

type ImportItem = {
  card: MtgCard;
  quantity: number;
};

type LibraryDimension = "type" | "color" | "availability";
type LibrarySort = "name" | "quantity" | "available";

type LibraryFolder = {
  id: string;
  label: string;
  description: string;
  symbol: string;
  predicate: (item: CollectionCard) => boolean;
};

const TYPE_FOLDERS: LibraryFolder[] = [
  {
    id: "lands",
    label: "Terrains",
    description: "Bases de mana et terrains utilitaires",
    symbol: "LND",
    predicate: (item) => item.card.typeLine?.includes("Land") ?? false,
  },
  {
    id: "creatures",
    label: "Créatures",
    description: "Créatures et créatures-artefacts",
    symbol: "CRE",
    predicate: (item) =>
      !item.card.typeLine?.includes("Land") &&
      (item.card.typeLine?.includes("Creature") ?? false),
  },
  {
    id: "artifacts",
    label: "Artefacts",
    description: "Artefacts non-créatures",
    symbol: "ART",
    predicate: (item) =>
      !item.card.typeLine?.includes("Creature") &&
      (item.card.typeLine?.includes("Artifact") ?? false),
  },
  {
    id: "enchantments",
    label: "Enchantements",
    description: "Enchantements et sagas",
    symbol: "ENC",
    predicate: (item) => item.card.typeLine?.includes("Enchantment") ?? false,
  },
  {
    id: "instants",
    label: "Éphémères",
    description: "Interaction et réponses instantanées",
    symbol: "INS",
    predicate: (item) => item.card.typeLine?.includes("Instant") ?? false,
  },
  {
    id: "sorceries",
    label: "Rituels",
    description: "Sorts de rituel",
    symbol: "RIT",
    predicate: (item) => item.card.typeLine?.includes("Sorcery") ?? false,
  },
  {
    id: "planeswalkers",
    label: "Planeswalkers",
    description: "Cartes de planeswalker",
    symbol: "PLW",
    predicate: (item) => item.card.typeLine?.includes("Planeswalker") ?? false,
  },
  {
    id: "battles",
    label: "Batailles",
    description: "Cartes Battle",
    symbol: "BAT",
    predicate: (item) => item.card.typeLine?.includes("Battle") ?? false,
  },
  {
    id: "other",
    label: "Autres",
    description: "Cartes hors catégories principales",
    symbol: "AUT",
    predicate: (item) => {
      const type = item.card.typeLine ?? "";
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

const COLOR_FOLDERS: LibraryFolder[] = [
  {
    id: "white",
    label: "Blanc",
    description: "Identité couleur blanche uniquement",
    symbol: "W",
    predicate: (item) =>
      item.card.colorIdentity?.length === 1 && item.card.colorIdentity[0] === "W",
  },
  {
    id: "blue",
    label: "Bleu",
    description: "Identité couleur bleue uniquement",
    symbol: "U",
    predicate: (item) =>
      item.card.colorIdentity?.length === 1 && item.card.colorIdentity[0] === "U",
  },
  {
    id: "black",
    label: "Noir",
    description: "Identité couleur noire uniquement",
    symbol: "B",
    predicate: (item) =>
      item.card.colorIdentity?.length === 1 && item.card.colorIdentity[0] === "B",
  },
  {
    id: "red",
    label: "Rouge",
    description: "Identité couleur rouge uniquement",
    symbol: "R",
    predicate: (item) =>
      item.card.colorIdentity?.length === 1 && item.card.colorIdentity[0] === "R",
  },
  {
    id: "green",
    label: "Vert",
    description: "Identité couleur verte uniquement",
    symbol: "G",
    predicate: (item) =>
      item.card.colorIdentity?.length === 1 && item.card.colorIdentity[0] === "G",
  },
  {
    id: "multicolor",
    label: "Multicolore",
    description: "Deux couleurs ou plus",
    symbol: "M",
    predicate: (item) => (item.card.colorIdentity?.length ?? 0) > 1,
  },
  {
    id: "colorless",
    label: "Incolore",
    description: "Aucune identité couleur",
    symbol: "C",
    predicate: (item) => (item.card.colorIdentity?.length ?? 0) === 0,
  },
];

function mergeCardIntoCollection(
  current: CollectionCard[],
  card: MtgCard,
  quantity: number,
) {
  const cardId = card.oracleId ?? card.id;
  const existing = current.find((item) => item.id === cardId);

  if (existing) {
    const existingPrinting = existing.printings.find(
      (printing) => printing.card.scryfallId === card.scryfallId,
    );

    const printings = existingPrinting
      ? existing.printings.map((printing) =>
          printing.card.scryfallId === card.scryfallId
            ? { ...printing, quantity: printing.quantity + quantity }
            : printing,
        )
      : [...existing.printings, { card, quantity }];

    return current.map((item) =>
      item.id === cardId
        ? {
            ...item,
            card,
            name: card.name,
            quantity: item.quantity + quantity,
            printings,
          }
        : item,
    );
  }

  const newItem: CollectionCard = {
    id: cardId,
    name: card.name,
    card,
    quantity,
    printings: [{ card, quantity }],
  };

  return [...current, newItem];
}

export default function CardLibraryTab() {
  const [collection, setCollection] = useState<CollectionCard[]>([]);
  const [decks, setDecks] = useState<DeckProject[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const [dimension, setDimension] = useState<LibraryDimension | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<LibrarySort>("name");

  useEffect(() => {
    setCollection(loadCollection());
    setDecks(loadDeckProjects());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveCollection(collection);
  }, [collection, hydrated]);

  const deckLocationsByCard = useMemo(
    () => buildDeckLocations(decks),
    [decks],
  );

  const usedQuantityByCard = useMemo(() => {
    const result = new Map<string, number>();

    for (const [cardId, locations] of deckLocationsByCard) {
      result.set(cardId, getUsedQuantity(locations));
    }

    return result;
  }, [deckLocationsByCard]);

  const availabilityFolders = useMemo<LibraryFolder[]>(
    () => [
      {
        id: "free",
        label: "Disponibles",
        description: "Au moins un exemplaire libre",
        symbol: "LIB",
        predicate: (item) => {
          const used = usedQuantityByCard.get(item.id) ?? 0;
          return item.quantity - used > 0;
        },
      },
      {
        id: "used",
        label: "Dans mes decks",
        description: "Présentes dans au moins un deck prêt",
        symbol: "DEK",
        predicate: (item) => (usedQuantityByCard.get(item.id) ?? 0) > 0,
      },
      {
        id: "fully-used",
        label: "Toutes utilisées",
        description: "Aucun exemplaire libre",
        symbol: "0",
        predicate: (item) => {
          const used = usedQuantityByCard.get(item.id) ?? 0;
          return item.quantity > 0 && used >= item.quantity;
        },
      },
      {
        id: "planned",
        label: "Prévues",
        description: "Présentes dans un deck en construction",
        symbol: "BLD",
        predicate: (item) =>
          (deckLocationsByCard.get(item.id) ?? []).some(
            (location) => location.status === "building",
          ),
      },
    ],
    [deckLocationsByCard, usedQuantityByCard],
  );

  const folders = useMemo(() => {
    if (dimension === "type") return TYPE_FOLDERS;
    if (dimension === "color") return COLOR_FOLDERS;
    if (dimension === "availability") return availabilityFolders;
    return [];
  }, [availabilityFolders, dimension]);

  const activeFolder = useMemo(
    () => folders.find((folder) => folder.id === folderId) ?? null,
    [folderId, folders],
  );

  const visibleCollection = useMemo(() => {
    let result = activeFolder
      ? collection.filter(activeFolder.predicate)
      : collection;

    const normalized = search.trim().toLocaleLowerCase("fr");
    if (normalized) {
      result = result.filter((item) =>
        item.name.toLocaleLowerCase("fr").includes(normalized),
      );
    }

    return [...result].sort((a, b) => {
      if (sortBy === "quantity") {
        return b.quantity - a.quantity || a.name.localeCompare(b.name);
      }

      if (sortBy === "available") {
        const aAvailable = Math.max(
          0,
          a.quantity - (usedQuantityByCard.get(a.id) ?? 0),
        );
        const bAvailable = Math.max(
          0,
          b.quantity - (usedQuantityByCard.get(b.id) ?? 0),
        );
        return bAvailable - aAvailable || a.name.localeCompare(b.name);
      }

      return a.name.localeCompare(b.name);
    });
  }, [activeFolder, collection, search, sortBy, usedQuantityByCard]);

  const totalCopies = collection.reduce((sum, item) => sum + item.quantity, 0);

  const totalAvailable = collection.reduce((sum, item) => {
    const used = usedQuantityByCard.get(item.id) ?? 0;
    return sum + Math.max(0, item.quantity - used);
  }, 0);

  const selectedItem =
    collection.find((item) => item.id === selectedCardId) ?? null;

  const selectedLocations = selectedItem
    ? deckLocationsByCard.get(selectedItem.id) ?? []
    : [];

  const selectedVisibleIndex = selectedCardId
    ? visibleCollection.findIndex((item) => item.id === selectedCardId)
    : -1;

  const canPrevious = selectedVisibleIndex > 0;
  const canNext =
    selectedVisibleIndex >= 0 &&
    selectedVisibleIndex < visibleCollection.length - 1;

  const selectPrevious = () => {
    if (!canPrevious) return;
    setSelectedCardId(visibleCollection[selectedVisibleIndex - 1].id);
  };

  const selectNext = () => {
    if (!canNext) return;
    setSelectedCardId(visibleCollection[selectedVisibleIndex + 1].id);
  };

  const deleteCard = (cardId: string) => {
    setCollection((current) =>
      current.filter((item) => item.id !== cardId),
    );
  };

  const adjustPrintingQuantity = (
    cardId: string,
    printingId: string,
    delta: number,
  ) => {
    if (delta === 0) return;

    setCollection((current) =>
      current.flatMap((item) => {
        if (item.id !== cardId) return [item];

        const printing = item.printings.find(
          (candidate) => candidate.card.scryfallId === printingId,
        );

        if (!printing) return [item];

        const nextPrintingQuantity = Math.max(0, printing.quantity + delta);
        const appliedDelta = nextPrintingQuantity - printing.quantity;

        if (appliedDelta === 0) return [item];

        let printings = item.printings
          .map((candidate) =>
            candidate.card.scryfallId === printingId
              ? { ...candidate, quantity: nextPrintingQuantity }
              : candidate,
          )
          .filter((candidate) => candidate.quantity > 0);

        const nextTotal = Math.max(0, item.quantity + appliedDelta);

        // Plus aucun exemplaire : la carte disparaît complètement du bulk.
        if (nextTotal === 0 || printings.length === 0) {
          return [];
        }

        const representativeStillExists = printings.some(
          (candidate) =>
            candidate.card.scryfallId === item.card.scryfallId,
        );

        const representative = representativeStillExists
          ? item.card
          : printings[0].card;

        printings = printings.sort((a, b) =>
          (b.card.releasedAt ?? "").localeCompare(a.card.releasedAt ?? ""),
        );

        return [
          {
            ...item,
            card: representative,
            quantity: nextTotal,
            printings,
          },
        ];
      }),
    );
  };


  const changeCollectionPrinting = (
    cardId: string,
    fromPrintingId: string,
    toPrinting: MtgCard,
    requestedQuantity: number,
  ) => {
    setCollection((current) =>
      current.map((item) => {
        if (item.id !== cardId) return item;

        const source = item.printings.find(
          (printing) => printing.card.scryfallId === fromPrintingId,
        );

        if (!source) return item;

        const quantity = Math.min(
          Math.max(1, requestedQuantity),
          source.quantity,
        );
        const remaining = source.quantity - quantity;

        let printings = item.printings.filter(
          (printing) => printing.card.scryfallId !== fromPrintingId,
        );

        if (remaining > 0) {
          printings.push({
            ...source,
            quantity: remaining,
          });
        }

        const target = printings.find(
          (printing) => printing.card.scryfallId === toPrinting.scryfallId,
        );

        if (target) {
          printings = printings.map((printing) =>
            printing.card.scryfallId === toPrinting.scryfallId
              ? {
                  ...printing,
                  card: toPrinting,
                  quantity: printing.quantity + quantity,
                }
              : printing,
          );
        } else {
          printings.push({ card: toPrinting, quantity });
        }

        printings.sort((a, b) =>
          (b.card.releasedAt ?? "").localeCompare(a.card.releasedAt ?? ""),
        );

        const representative =
          item.card.scryfallId === fromPrintingId && remaining === 0
            ? toPrinting
            : item.card;

        return {
          ...item,
          card: representative,
          printings,
        };
      }),
    );
  };

  const addCard = (card: MtgCard, quantity: number) => {
    setCollection((current) =>
      mergeCardIntoCollection(current, card, quantity).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    );
  };

  const importCards = (items: ImportItem[]) => {
    setCollection((current) => {
      let next = current;

      for (const item of items) {
        next = mergeCardIntoCollection(next, item.card, item.quantity);
      }

      return next.sort((a, b) => a.name.localeCompare(b.name));
    });
  };

  const openDimension = (nextDimension: LibraryDimension) => {
    setDimension(nextDimension);
    setFolderId(null);
    setSearch("");
    setSelectedCardId(null);
  };

  const returnToFolders = () => {
    setFolderId(null);
    setSearch("");
    setSelectedCardId(null);
  };

  const returnToLibraryHome = () => {
    setDimension(null);
    setFolderId(null);
    setSearch("");
    setSelectedCardId(null);
  };

  return (
    <div className="mtg-tab-page">
      <div className="mtg-tab-page__header">
        <div>
          <span className="mtg-tab-page__eyebrow">GLOBAL COLLECTION</span>
          <h2>Toutes les cartes</h2>
          <p>
            Organise ta collection comme une bibliothèque : par type, couleur
            ou disponibilité, puis ouvre seulement les cartes du dossier voulu.
          </p>
        </div>

        <div className="mtg-tab-page__actions">
          <button
            className="mtg-secondary-button"
            type="button"
            onClick={() => setImportOpen(true)}
          >
            Importer une liste
          </button>
          <button
            className="mtg-primary-button"
            type="button"
            onClick={() => setAddOpen(true)}
          >
            + Ajouter une carte
          </button>
        </div>
      </div>

      <div className="mtg-library-summary" aria-label="Résumé de la collection">
        <div>
          <span>Cartes uniques</span>
          <strong>{collection.length}</strong>
        </div>
        <div>
          <span>Exemplaires</span>
          <strong>{totalCopies}</strong>
        </div>
        <div>
          <span>Disponibles</span>
          <strong>{totalAvailable}</strong>
        </div>
      </div>

      <div className="mtg-library-breadcrumb" aria-label="Navigation de la bibliothèque">
        <button type="button" onClick={returnToLibraryHome}>
          Bibliothèque
        </button>
        {dimension && (
          <>
            <span>›</span>
            <button type="button" onClick={returnToFolders}>
              {folderId === "__all__"
                ? "Liste complète"
                : dimension === "type"
                  ? "Types"
                  : dimension === "color"
                    ? "Couleurs"
                    : "Disponibilité"}
            </button>
          </>
        )}
        {activeFolder && (
          <>
            <span>›</span>
            <strong>{activeFolder.label}</strong>
          </>
        )}
      </div>

      {!dimension ? (
        <div className="mtg-library-dimensions">
          <button type="button" onClick={() => openDimension("type")}>
            <span className="mtg-library-dimension__symbol">TYPE</span>
            <div>
              <strong>Par type</strong>
              <p>Créatures, terrains, artefacts, rituels…</p>
            </div>
            <span className="mtg-library-dimension__arrow">→</span>
          </button>

          <button type="button" onClick={() => openDimension("color")}>
            <span className="mtg-library-dimension__symbol">WUBRG</span>
            <div>
              <strong>Par couleur</strong>
              <p>Blanc, bleu, noir, rouge, vert, multicolore…</p>
            </div>
            <span className="mtg-library-dimension__arrow">→</span>
          </button>

          <button type="button" onClick={() => openDimension("availability")}>
            <span className="mtg-library-dimension__symbol">STOCK</span>
            <div>
              <strong>Par disponibilité</strong>
              <p>Libres, utilisées, prévues, totalement occupées…</p>
            </div>
            <span className="mtg-library-dimension__arrow">→</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setDimension("type");
              setFolderId("__all__");
            }}
          >
            <span className="mtg-library-dimension__symbol">ALL</span>
            <div>
              <strong>Liste complète</strong>
              <p>Retrouver la liste globale comme avant.</p>
            </div>
            <span className="mtg-library-dimension__arrow">→</span>
          </button>
        </div>
      ) : !folderId ? (
        <div className="mtg-library-folders">
          {folders.map((folder) => {
            const cards = collection.filter(folder.predicate);
            const copies = cards.reduce((sum, item) => sum + item.quantity, 0);

            return (
              <button
                key={folder.id}
                type="button"
                className="mtg-library-folder"
                onClick={() => setFolderId(folder.id)}
              >
                <div className="mtg-library-folder__top">
                  <span>{folder.symbol}</span>
                  <span>→</span>
                </div>
                <strong>{folder.label}</strong>
                <p>{folder.description}</p>
                <div className="mtg-library-folder__stats">
                  <span>{cards.length} cartes</span>
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
                placeholder="Sol Ring, Myrel, Ancient Copper Dragon…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <label className="mtg-library-sort">
              <span>Trier</span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as LibrarySort)}
              >
                <option value="name">Nom A → Z</option>
                <option value="quantity">Quantité</option>
                <option value="available">Disponibles</option>
              </select>
            </label>
          </div>

          <div className="mtg-library-folder-title">
            <div>
              <span>
                {activeFolder?.symbol ?? "ALL"}
              </span>
              <div>
                <strong>{activeFolder?.label ?? "Toutes les cartes"}</strong>
                <p>
                  {activeFolder?.description ?? "Collection complète sans filtre de dossier."}
                </p>
              </div>
            </div>
            <small>{visibleCollection.length} cartes affichées</small>
          </div>

          <div
            className="mtg-library-table"
            role="table"
            aria-label="Cartes de la collection"
          >
            <div className="mtg-library-table__header" role="row">
              <span role="columnheader">Carte</span>
              <span role="columnheader">Qté</span>
              <span role="columnheader">Utilisées</span>
              <span role="columnheader">Libres</span>
            </div>

            {!hydrated ? (
              <div className="mtg-library-table__empty">
                <strong>Chargement de la collection…</strong>
              </div>
            ) : visibleCollection.length === 0 ? (
              <div className="mtg-library-table__empty">
                <strong>Aucune carte dans ce dossier</strong>
                <p>
                  {search
                    ? "Essaie un autre nom de carte."
                    : "Ajoute des cartes à la collection ou choisis un autre dossier."}
                </p>
              </div>
            ) : (
              <div className="mtg-library-table__body">
                {visibleCollection.map((item) => {
                  const used = usedQuantityByCard.get(item.id) ?? 0;
                  const available = Math.max(0, item.quantity - used);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="mtg-library-row"
                      role="row"
                      onClick={() => setSelectedCardId(item.id)}
                    >
                      <span className="mtg-library-row__card" role="cell">
                        <span className="mtg-library-row__thumb">
                          {item.card.imageUri ? (
                            <img src={item.card.imageUri} alt="" />
                          ) : (
                            <span>{item.name.slice(0, 1)}</span>
                          )}
                        </span>
                        <span>
                          <strong>{item.name}</strong>
                          <small>
                            {item.printings.length} version
                            {item.printings.length > 1 ? "s" : ""} · {item.card.typeLine}
                          </small>
                        </span>
                      </span>
                      <strong role="cell">{item.quantity}</strong>
                      <span role="cell">{used}</span>
                      <span role="cell">{available}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      <CardAddDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={addCard}
      />

      <CollectionImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={importCards}
      />

      <CardDetailDrawer
        item={selectedItem}
        usedQuantity={
          selectedItem ? usedQuantityByCard.get(selectedItem.id) ?? 0 : 0
        }
        locations={selectedLocations}
        onClose={() => setSelectedCardId(null)}
        onDelete={deleteCard}
        onChangePrinting={changeCollectionPrinting}
        onAdjustPrintingQuantity={adjustPrintingQuantity}
        onPrevious={selectPrevious}
        onNext={selectNext}
        canPrevious={canPrevious}
        canNext={canNext}
      />
    </div>
  );
}
