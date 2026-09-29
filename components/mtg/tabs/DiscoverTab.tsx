"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchJson } from "@/lib/http/fetch-json";
import { loadCollection } from "@/lib/mtg/collection-storage";
import { loadDeckProjects } from "@/lib/mtg/deck-storage";
import { detectCardRoles, type CardRole } from "@/lib/mtg/card-role-analyzer";
import { logicalCardId } from "@/lib/mtg/deck-inventory";
import type { CollectionCard, DeckProject, MtgCard } from "@/types/mtg";
import type {
  DiscoverDeckInput,
  DiscoverPersonalCard,
  DiscoverResponse,
  DiscoverTrendingCard,
} from "@/types/discover";

type RoleTarget = {
  role: CardRole;
  label: string;
  target: number;
};

const ROLE_TARGETS: RoleTarget[] = [
  { role: "ramp", label: "Ramp", target: 8 },
  { role: "draw", label: "Pioche", target: 8 },
  { role: "removal", label: "Removal", target: 6 },
  { role: "board-wipe", label: "Wrath / Board wipe", target: 2 },
  { role: "protection", label: "Protection", target: 3 },
  { role: "recursion", label: "Récursion", target: 2 },
  { role: "finisher", label: "Finisher", target: 2 },
];

type PreviewCard = {
  card: MtgCard;
  title: string;
  subtitle?: string;
  reasons?: string[];
  deckNames?: string[];
  popularityRank?: number;
};

function buildDiscoverDeck(deck: DeckProject): DiscoverDeckInput | null {
  const commander = deck.commanders[0]?.card;
  if (!commander) return null;

  const counts = new Map<CardRole, number>();
  for (const entry of deck.cards) {
    if (entry.section !== "mainboard") continue;
    for (const role of detectCardRoles(entry.card)) {
      counts.set(role, (counts.get(role) ?? 0) + entry.quantity);
    }
  }

  return {
    id: deck.id,
    name: deck.name,
    status: deck.status,
    updatedAt: deck.updatedAt,
    commander: {
      name: commander.name,
      oracleText: commander.oracleText,
      typeLine: commander.typeLine,
      colorIdentity: commander.colorIdentity,
      keywords: commander.keywords,
      faces: commander.faces,
    },
    cardNames: deck.cards.map((entry) => entry.card.name),
    roleNeeds: ROLE_TARGETS.map((target) => ({
      ...target,
      count: counts.get(target.role) ?? 0,
    })),
  };
}

function ownedQuantity(collection: CollectionCard[], card: MtgCard): number {
  const id = logicalCardId(card);
  return collection.find((item) => item.id === id)?.quantity ?? 0;
}

function formatSince(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function DiscoverPreview({
  preview,
  collection,
  onClose,
}: {
  preview: PreviewCard;
  collection: CollectionCard[];
  onClose: () => void;
}) {
  const owned = ownedQuantity(collection, preview.card);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="mtg-suggestion-preview-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        className="mtg-suggestion-preview mtg-discover-preview"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mtg-discover-preview-title"
      >
        <div className="mtg-suggestion-preview__topbar">
          <div>
            <span>{preview.title}</span>
            <strong>{owned > 0 ? `Dans ton bulk ×${owned}` : preview.subtitle ?? "Découverte"}</strong>
          </div>
          <button
            type="button"
            className="mtg-suggestion-preview__close"
            onClick={onClose}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="mtg-suggestion-preview__layout">
          <div className="mtg-suggestion-preview__image">
            {preview.card.imageUri ? (
              <img src={preview.card.imageUri} alt={preview.card.name} />
            ) : (
              <span>Image indisponible</span>
            )}
          </div>

          <div className="mtg-suggestion-preview__content">
            <header>
              <span>{preview.card.manaCost}</span>
              <h3 id="mtg-discover-preview-title">{preview.card.name}</h3>
              <p>{preview.card.typeLine}</p>
            </header>

            {preview.popularityRank && (
              <div className="mtg-discover-preview__rank">
                Rang de popularité Commander · #{preview.popularityRank}
              </div>
            )}

            {preview.deckNames && preview.deckNames.length > 0 && (
              <section>
                <span className="mtg-card-drawer__label">RECOMMANDÉE POUR</span>
                <div className="mtg-discover-deck-chips">
                  {preview.deckNames.map((deckName) => (
                    <span key={deckName}>{deckName}</span>
                  ))}
                </div>
              </section>
            )}

            {preview.reasons && preview.reasons.length > 0 && (
              <section>
                <span className="mtg-card-drawer__label">POURQUOI ?</span>
                <ul className="mtg-recommendation-card__reasons">
                  {preview.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </section>
            )}

            {preview.card.oracleText && (
              <section>
                <span className="mtg-card-drawer__label">TEXTE ORACLE</span>
                <p className="mtg-suggestion-preview__oracle">{preview.card.oracleText}</p>
              </section>
            )}

            <dl className="mtg-suggestion-preview__meta">
              <div>
                <dt>Mana value</dt>
                <dd>{preview.card.manaValue ?? "—"}</dd>
              </div>
              <div>
                <dt>Identité couleur</dt>
                <dd>
                  {preview.card.colorIdentity.length
                    ? preview.card.colorIdentity.join(" · ")
                    : "C"}
                </dd>
              </div>
              <div>
                <dt>Extension</dt>
                <dd>{preview.card.setName ?? preview.card.setCode ?? "—"}</dd>
              </div>
              <div>
                <dt>Sortie</dt>
                <dd>{preview.card.releasedAt ?? "—"}</dd>
              </div>
            </dl>
          </div>
        </div>
      </aside>
    </div>
  );
}

function TrendingCard({
  item,
  index,
  onOpen,
}: {
  item: DiscoverTrendingCard;
  index: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className="mtg-discover-card mtg-discover-card--trend"
      onClick={onOpen}
    >
      <span className="mtg-discover-card__rank">#{String(index + 1).padStart(2, "0")}</span>
      <span className="mtg-discover-card__image">
        {item.card.imageUri ? (
          <img src={item.card.imageUri} alt={item.card.name} />
        ) : (
          <span>MTG</span>
        )}
      </span>
      <span className="mtg-discover-card__body">
        <strong>{item.card.name}</strong>
        <small>{item.card.setCode ?? "MTG"} · {item.card.releasedAt ?? "sortie récente"}</small>
        {item.popularityRank && <em>Rang Commander #{item.popularityRank}</em>}
      </span>
    </button>
  );
}

function PersonalCard({
  item,
  collection,
  onOpen,
}: {
  item: DiscoverPersonalCard;
  collection: CollectionCard[];
  onOpen: () => void;
}) {
  const owned = ownedQuantity(collection, item.card);

  return (
    <article className="mtg-discover-personal-card">
      <button type="button" className="mtg-discover-personal-card__image" onClick={onOpen}>
        {item.card.imageUri ? <img src={item.card.imageUri} alt={item.card.name} /> : <span>MTG</span>}
      </button>

      <div className="mtg-discover-personal-card__content">
        <div className="mtg-discover-personal-card__top">
          <button type="button" onClick={onOpen}>
            <strong>{item.card.name}</strong>
            <small>{item.card.typeLine}</small>
          </button>
          <span className={owned > 0 ? "is-owned" : ""}>
            {owned > 0 ? `Bulk ×${owned}` : "À découvrir"}
          </span>
        </div>

        <div className="mtg-discover-deck-chips">
          {item.deckNames.slice(0, 3).map((deckName) => (
            <span key={deckName}>{deckName}</span>
          ))}
        </div>

        <ul>
          {item.reasons.slice(0, 2).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>

        <button type="button" className="mtg-discover-personal-card__more" onClick={onOpen}>
          Voir la carte →
        </button>
      </div>
    </article>
  );
}

export default function DiscoverTab() {
  const [collection, setCollection] = useState<CollectionCard[]>([]);
  const [decks, setDecks] = useState<DeckProject[]>([]);
  const [analysis, setAnalysis] = useState<DiscoverResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<PreviewCard | null>(null);

  useEffect(() => {
    const currentCollection = loadCollection();
    const currentDecks = loadDeckProjects().filter((deck) => deck.status !== "archived");
    setCollection(currentCollection);
    setDecks(currentDecks);

    const deckInputs = currentDecks
      .map(buildDiscoverDeck)
      .filter((deck): deck is DiscoverDeckInput => deck !== null);

    const controller = new AbortController();

    const run = async () => {
      setLoading(true);
      try {
        const payload = await fetchJson<DiscoverResponse>("/api/mtg/discover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decks: deckInputs }),
          signal: controller.signal,
        });
        setAnalysis(payload);
      } catch (error) {
        if (controller.signal.aborted) return;
        setAnalysis({
          available: false,
          recentSince: "",
          trending: [],
          personalized: [],
          error: error instanceof Error ? error.message : "Analyse indisponible.",
        });
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void run();
    return () => controller.abort();
  }, []);

  const deckSummary = useMemo(() => {
    const withCommander = decks.filter((deck) => deck.commanders.length > 0).length;
    return { total: decks.length, withCommander };
  }, [decks]);

  return (
    <div className="mtg-tab-page mtg-discover-page">
      <header className="mtg-tab-page__header mtg-discover-header">
        <div>
          <span className="mtg-tab-page__eyebrow">DÉCOUVRIR</span>
          <h2>Tendances & recommandations</h2>
          <p>
            Les sorties Commander qui montent, puis des idées calculées à partir de tes propres decks.
          </p>
        </div>

        <div className="mtg-discover-header__stats">
          <div>
            <span>Decks analysés</span>
            <strong>{deckSummary.withCommander}</strong>
          </div>
          <div>
            <span>Cartes possédées</span>
            <strong>{collection.reduce((sum, item) => sum + item.quantity, 0)}</strong>
          </div>
        </div>
      </header>

      {analysis?.available === false && (
        <div className="mtg-discover-error">
          <strong>Tendances momentanément indisponibles</strong>
          <span>{analysis.error}</span>
        </div>
      )}

      <section className="mtg-discover-section">
        <div className="mtg-discover-section__heading">
          <div>
            <span>01 · TENDANCES RÉCENTES</span>
            <h3>Les nouvelles cartes qui s’installent en Commander</h3>
          </div>
          <p>
            {analysis?.recentSince
              ? `Sorties depuis le ${formatSince(analysis.recentSince)}, classées par popularité Commander.`
              : "Cartes sorties sur les six derniers mois, classées par popularité Commander."}
          </p>
        </div>

        {loading ? (
          <div className="mtg-discover-loading">Analyse des sorties récentes…</div>
        ) : (
          <div className="mtg-discover-trending-grid">
            {(analysis?.trending ?? []).slice(0, 12).map((item, index) => (
              <TrendingCard
                key={item.card.oracleId ?? item.card.id}
                item={item}
                index={index}
                onOpen={() =>
                  setPreview({
                    card: item.card,
                    title: "TENDANCE RÉCENTE",
                    subtitle: "Carte populaire en Commander",
                    popularityRank: item.popularityRank,
                  })
                }
              />
            ))}
          </div>
        )}
      </section>

      <section className="mtg-discover-section mtg-discover-section--personal">
        <div className="mtg-discover-section__heading">
          <div>
            <span>02 · POUR TOI</span>
            <h3>Des cartes cohérentes avec ta façon de construire</h3>
          </div>
          <p>
            Les suggestions croisent tes commandants, leurs identités couleur et les rôles encore faibles dans tes decklists.
          </p>
        </div>

        {!loading && (analysis?.personalized.length ?? 0) === 0 ? (
          <div className="mtg-discover-empty">
            <strong>Pas encore assez de contexte</strong>
            <p>Ajoute au moins un commandant à un deck pour obtenir des recommandations personnalisées.</p>
          </div>
        ) : (
          <div className="mtg-discover-personal-grid">
            {(analysis?.personalized ?? []).slice(0, 12).map((item) => (
              <PersonalCard
                key={item.card.oracleId ?? item.card.id}
                item={item}
                collection={collection}
                onOpen={() =>
                  setPreview({
                    card: item.card,
                    title: "RECOMMANDATION POUR TOI",
                    subtitle: "Basée sur tes decks",
                    reasons: item.reasons,
                    deckNames: item.deckNames,
                    popularityRank: item.popularityRank,
                  })
                }
              />
            ))}
          </div>
        )}
      </section>

      <footer className="mtg-discover-method">
        <span>MÉTHODE</span>
        <p>
          Les tendances utilisent le classement de popularité Commander fourni par Scryfall. Les recommandations personnelles
          restent locales à ta bibliothèque : le serveur reçoit uniquement les informations de deck nécessaires au calcul et ne
          modifie aucune carte ni aucun deck.
        </p>
      </footer>

      {preview && (
        <DiscoverPreview
          preview={preview}
          collection={collection}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
