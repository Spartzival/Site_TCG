"use client";

import { useEffect, useMemo, useState } from "react";
import CardPrintingChangeDialog from "./CardPrintingChangeDialog";
import {
  getPlannedQuantity,
  type CardDeckLocation,
} from "@/lib/mtg/deck-usage";
import type { CollectionCard, DeckSection, MtgCard } from "@/types/mtg";

type CardDetailDrawerProps = {
  item: CollectionCard | null;
  usedQuantity: number;
  locations: CardDeckLocation[];
  onClose: () => void;
  onDelete: (cardId: string) => void;
  onChangePrinting: (
    cardId: string,
    fromPrintingId: string,
    toPrinting: MtgCard,
    quantity: number,
  ) => void;
  onAdjustPrintingQuantity: (
    cardId: string,
    printingId: string,
    delta: number,
  ) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  canPrevious?: boolean;
  canNext?: boolean;
};

function sectionLabel(section: DeckSection) {
  switch (section) {
    case "commander":
      return "Commandant";
    case "sideboard":
      return "Sideboard";
    case "maybeboard":
      return "Maybeboard";
    default:
      return "Deck principal";
  }
}

export default function CardDetailDrawer({
  item,
  usedQuantity,
  locations,
  onClose,
  onDelete,
  onChangePrinting,
  onAdjustPrintingQuantity,
  onPrevious,
  onNext,
  canPrevious = false,
  canNext = false,
}: CardDetailDrawerProps) {
  const [activePrintingId, setActivePrintingId] = useState<string | null>(null);
  const [changePrintingOpen, setChangePrintingOpen] = useState(false);

  // Reset the selected printing only when the logical card changes.
  // Do not depend on `changePrintingOpen`: otherwise opening the version
  // selector immediately re-runs the effect and closes it again.
  useEffect(() => {
    if (!item) {
      setActivePrintingId(null);
      setChangePrintingOpen(false);
      return;
    }

    setActivePrintingId(item.card.scryfallId);
    setChangePrintingOpen(false);
  }, [item?.id]);

  // Keep the current printing selected while quantities / printings are updated.
  // If that exact printing disappears (for example after decrementing it to 0),
  // fall back to the representative / first remaining printing.
  useEffect(() => {
    if (!item) return;

    const stillExists =
      activePrintingId !== null &&
      item.printings.some(
        (printing) => printing.card.scryfallId === activePrintingId,
      );

    if (!stillExists) {
      setActivePrintingId(
        item.card.scryfallId || item.printings[0]?.card.scryfallId || null,
      );
    }
  }, [item, activePrintingId]);

  useEffect(() => {
    if (!item) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (changePrintingOpen) return;
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && canPrevious) onPrevious?.();
      if (event.key === "ArrowRight" && canNext) onNext?.();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    item?.id,
    onClose,
    onPrevious,
    onNext,
    canPrevious,
    canNext,
    changePrintingOpen,
  ]);

  const activePrinting = useMemo(() => {
    if (!item) return null;
    return (
      item.printings.find(
        (printing) => printing.card.scryfallId === activePrintingId,
      ) ?? item.printings[0] ?? null
    );
  }, [activePrintingId, item]);

  if (!item) return null;

  const available = Math.max(0, item.quantity - usedQuantity);
  const plannedQuantity = getPlannedQuantity(locations);
  const card = activePrinting?.card ?? item.card;

  return (
    <div
      className="mtg-drawer-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        className="mtg-card-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mtg-card-drawer-title"
      >
        <div className="mtg-card-drawer__topbar">
          <span>CARD DETAILS</span>
          <div className="mtg-card-drawer__navigation">
            <button
              type="button"
              className="mtg-card-drawer__nav-button"
              onClick={onPrevious}
              disabled={!canPrevious}
              aria-label="Carte précédente"
              title="Carte précédente (←)"
            >
              ←
            </button>
            <button
              type="button"
              className="mtg-card-drawer__nav-button"
              onClick={onNext}
              disabled={!canNext}
              aria-label="Carte suivante"
              title="Carte suivante (→)"
            >
              →
            </button>
            <button type="button" className="mtg-icon-button" onClick={onClose}>
              ×
            </button>
          </div>
        </div>

        <div className="mtg-card-drawer__image">
          {card.imageUri ? (
            <img src={card.imageUri} alt={card.name} />
          ) : (
            <div>Image indisponible</div>
          )}
        </div>

        <div className="mtg-card-drawer__heading">
          <span>{card.manaCost}</span>
          <h3 id="mtg-card-drawer-title">{item.name}</h3>
          <p>{card.typeLine}</p>
        </div>

        <div className="mtg-card-drawer__stats">
          <div>
            <span>Possédées</span>
            <strong>{item.quantity}</strong>
          </div>
          <div>
            <span>Utilisées</span>
            <strong>{usedQuantity}</strong>
          </div>
          <div>
            <span>Disponibles</span>
            <strong>{available}</strong>
          </div>
        </div>

        {plannedQuantity > 0 && (
          <div className="mtg-card-drawer__planned-summary">
            <span>Prévues dans les decks en construction</span>
            <strong>×{plannedQuantity}</strong>
          </div>
        )}

        <section className="mtg-card-drawer__section">
          <span className="mtg-card-drawer__label">VERSIONS POSSÉDÉES</span>

          <div className="mtg-owned-printings">
            {item.printings.map((printing) => {
              const selected = printing.card.scryfallId === card.scryfallId;

              return (
                <button
                  key={printing.card.scryfallId}
                  type="button"
                  className={`mtg-owned-printing ${selected ? "is-active" : ""}`}
                  onClick={() => setActivePrintingId(printing.card.scryfallId)}
                >
                  <span className="mtg-owned-printing__thumb">
                    {printing.card.imageUri ? (
                      <img src={printing.card.imageUri} alt="" />
                    ) : (
                      <span>?</span>
                    )}
                  </span>

                  <span className="mtg-owned-printing__details">
                    <strong>
                      {printing.card.setName ?? printing.card.setCode ?? "MTG"}
                    </strong>
                    <small>
                      {printing.card.setCode ?? "—"}
                      {printing.card.collectorNumber
                        ? ` · #${printing.card.collectorNumber}`
                        : ""}
                    </small>
                  </span>

                  <strong className="mtg-owned-printing__quantity">
                    ×{printing.quantity}
                  </strong>
                </button>
              );
            })}
          </div>

          {activePrinting && (
            <>
              <div className="mtg-quantity-field">
                <span>Quantité de cette version</span>
                <div>
                  <button
                    type="button"
                    aria-label="Retirer un exemplaire de cette version"
                    onClick={() =>
                      onAdjustPrintingQuantity(
                        item.id,
                        activePrinting.card.scryfallId,
                        -1,
                      )
                    }
                  >
                    −
                  </button>
                  <strong>{activePrinting.quantity}</strong>
                  <button
                    type="button"
                    aria-label="Ajouter un exemplaire de cette version"
                    onClick={() =>
                      onAdjustPrintingQuantity(
                        item.id,
                        activePrinting.card.scryfallId,
                        1,
                      )
                    }
                  >
                    +
                  </button>
                </div>
                <small>
                  Les boutons + / − modifient directement le nombre d’exemplaires
                  enregistrés dans le bulk.
                </small>
              </div>

              <button
                type="button"
                className="mtg-secondary-button"
                onClick={() => setChangePrintingOpen(true)}
              >
                Changer cette version
              </button>
            </>
          )}
        </section>

        <section className="mtg-card-drawer__section">
          <span className="mtg-card-drawer__label">LOCALISATION</span>

          {locations.length === 0 ? (
            <div className="mtg-card-drawer__empty-location">
              <strong>Aucun deck lié pour le moment</strong>
              <p>
                Cette carte n’est actuellement utilisée dans aucun deck prêt et
                n’est prévue dans aucun deck en construction.
              </p>
            </div>
          ) : (
            <div className="mtg-card-locations">
              {locations.map((location) => (
                <div key={location.deckId} className="mtg-card-location">
                  <div className="mtg-card-location__main">
                    <strong>{location.deckName}</strong>
                    <span
                      className={`mtg-card-location__status is-${location.status}`}
                    >
                      {location.status === "active" ? "PRÊT" : "EN CONSTRUCTION"}
                    </span>
                  </div>

                  <div className="mtg-card-location__meta">
                    <span>×{location.quantity}</span>
                    <span>•</span>
                    <span>{location.sections.map(sectionLabel).join(" + ")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mtg-card-drawer__section">
          <span className="mtg-card-drawer__label">GESTION DE LA COLLECTION</span>

          <button
            type="button"
            className="mtg-danger-button"
            onClick={() => {
              const confirmed = window.confirm(
                `Supprimer « ${item.name} » et toutes ses versions de la collection ?`,
              );

              if (!confirmed) return;

              onDelete(item.id);
              onClose();
            }}
          >
            Supprimer de la collection
          </button>

          <p className="mtg-danger-button__hint">
            Cette action retire tous les exemplaires et toutes les impressions de
            cette carte du bulk.
          </p>
        </section>

        <section className="mtg-card-drawer__section">
          <span className="mtg-card-drawer__label">INFORMATIONS DE LA VERSION</span>
          {card.oracleText && (
            <p className="mtg-card-drawer__oracle">{card.oracleText}</p>
          )}

          <dl className="mtg-card-drawer__meta">
            <div>
              <dt>Extension</dt>
              <dd>{card.setName ?? "—"}</dd>
            </div>
            <div>
              <dt>Set / Numéro</dt>
              <dd>
                {card.setCode ?? "—"}
                {card.collectorNumber ? ` · #${card.collectorNumber}` : ""}
              </dd>
            </div>
            <div>
              <dt>Rareté</dt>
              <dd>{card.rarity ?? "—"}</dd>
            </div>
            {card.releasedAt && (
              <div>
                <dt>Sortie</dt>
                <dd>{card.releasedAt}</dd>
              </div>
            )}
            {card.language && (
              <div>
                <dt>Langue Scryfall</dt>
                <dd>{card.language.toUpperCase()}</dd>
              </div>
            )}
            {card.power && card.toughness && (
              <div>
                <dt>Force / Endurance</dt>
                <dd>
                  {card.power} / {card.toughness}
                </dd>
              </div>
            )}
          </dl>
        </section>
      </aside>

      {activePrinting && (
        <CardPrintingChangeDialog
          open={changePrintingOpen}
          cardName={item.name}
          oracleId={activePrinting.card.oracleId ?? item.card.oracleId}
          currentPrintingId={activePrinting.card.scryfallId}
          maxQuantity={activePrinting.quantity}
          ownedPrintings={item.printings}
          onClose={() => setChangePrintingOpen(false)}
          onConfirm={(nextPrinting, quantity) => {
            onChangePrinting(
              item.id,
              activePrinting.card.scryfallId,
              nextPrinting,
              quantity,
            );
            setActivePrintingId(nextPrinting.scryfallId);
            setChangePrintingOpen(false);
          }}
        />
      )}
    </div>
  );
}
