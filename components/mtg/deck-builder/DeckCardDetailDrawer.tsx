"use client";

import { useEffect, useState } from "react";
import CardPrintingChangeDialog from "../library/CardPrintingChangeDialog";
import type { CollectionCard, DeckCardEntry, MtgCard } from "@/types/mtg";

type Props = {
  entry: DeckCardEntry | null;
  collectionItem: CollectionCard | null;
  availableQuantity: number;
  reservedElsewhereQuantity: number;
  onClose: () => void;
  onChangePrinting?: (printing: MtgCard) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  canPrevious?: boolean;
  canNext?: boolean;
};

export default function DeckCardDetailDrawer({
  entry,
  collectionItem,
  availableQuantity,
  reservedElsewhereQuantity,
  onClose,
  onChangePrinting,
  onPrevious,
  onNext,
  canPrevious = false,
  canNext = false,
}: Props) {
  const [changePrintingOpen, setChangePrintingOpen] = useState(false);

  // Close the printing selector only when navigating to another deck entry.
  // This MUST stay separate from the keyboard effect: depending on
  // `changePrintingOpen` while calling setChangePrintingOpen(false) caused the
  // selector to close immediately after the user clicked "Changer la version".
  useEffect(() => {
    setChangePrintingOpen(false);
  }, [entry?.card.id, entry?.section]);

  useEffect(() => {
    if (!entry) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (changePrintingOpen) return;
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && canPrevious) onPrevious?.();
      if (event.key === "ArrowRight" && canNext) onNext?.();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    entry?.card.id,
    entry?.section,
    onClose,
    onPrevious,
    onNext,
    canPrevious,
    canNext,
    changePrintingOpen,
  ]);

  if (!entry) return null;

  const card = entry.card;
  const owned = collectionItem?.quantity ?? 0;
  const missing = Math.max(0, entry.quantity - availableQuantity);
  const ownedCurrentPrinting =
    collectionItem?.printings.find(
      (printing) => printing.card.scryfallId === card.scryfallId,
    )?.quantity ?? 0;

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
        aria-labelledby="mtg-deck-card-drawer-title"
      >
        <div className="mtg-card-drawer__topbar">
          <span>DECK CARD DETAILS</span>
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
          <h3 id="mtg-deck-card-drawer-title">{card.name}</h3>
          <p>{card.typeLine}</p>
        </div>

        <div className="mtg-card-drawer__stats">
          <div>
            <span>Dans ce deck</span>
            <strong>{entry.quantity}</strong>
          </div>
          <div>
            <span>Disponibles</span>
            <strong>{availableQuantity}</strong>
          </div>
          <div>
            <span>Manquantes</span>
            <strong>{missing}</strong>
          </div>
        </div>

        <p className="mtg-deck-inventory-note">
          {owned} exemplaire(s) possédé(s) au total · {reservedElsewhereQuantity} réservé(s)
          dans d&apos;autres decks prêts.
        </p>

        <section className="mtg-card-drawer__section">
          <span className="mtg-card-drawer__label">VERSION UTILISÉE DANS LE DECK</span>

          <div className="mtg-owned-printing mtg-owned-printing--static">
            <span className="mtg-owned-printing__thumb">
              {card.imageUri ? <img src={card.imageUri} alt="" /> : <span>?</span>}
            </span>

            <span className="mtg-owned-printing__details">
              <strong>{card.setName ?? card.setCode ?? "MTG"}</strong>
              <small>
                {card.setCode ?? "—"}
                {card.collectorNumber ? ` · #${card.collectorNumber}` : ""}
              </small>
              <small>
                {ownedCurrentPrinting > 0
                  ? `Cette version est possédée ×${ownedCurrentPrinting}`
                  : "Cette version précise n’est pas possédée"}
              </small>
            </span>
          </div>

          {onChangePrinting && (
            <button
              type="button"
              className="mtg-secondary-button"
              onClick={() => setChangePrintingOpen(true)}
            >
              Changer la version dans ce deck
            </button>
          )}
        </section>

        <section className="mtg-card-drawer__section">
          <span className="mtg-card-drawer__label">COLLECTION</span>

          {collectionItem ? (
            <div className="mtg-owned-printings">
              {collectionItem.printings.map((printing) => (
                <div
                  key={printing.card.scryfallId}
                  className="mtg-owned-printing mtg-owned-printing--static"
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
                </div>
              ))}
            </div>
          ) : (
            <div className="mtg-card-drawer__empty-location">
              <strong>Carte non présente dans le bulk</strong>
              <p>
                Cette carte est prévue dans le deck, mais aucun exemplaire n’est
                actuellement enregistré dans « Toutes les cartes ».
              </p>
            </div>
          )}
        </section>

        <section className="mtg-card-drawer__section">
          <span className="mtg-card-drawer__label">INFORMATIONS MTG</span>

          {card.oracleText && (
            <p className="mtg-card-drawer__oracle">{card.oracleText}</p>
          )}

          <dl className="mtg-card-drawer__meta">
            <div>
              <dt>Mana value</dt>
              <dd>{card.manaValue ?? "—"}</dd>
            </div>
            <div>
              <dt>Identité couleur</dt>
              <dd>
                {card.colorIdentity.length ? card.colorIdentity.join(" · ") : "C"}
              </dd>
            </div>
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

      {onChangePrinting && (
        <CardPrintingChangeDialog
          open={changePrintingOpen}
          cardName={card.name}
          oracleId={card.oracleId}
          currentPrintingId={card.scryfallId}
          ownedPrintings={collectionItem?.printings ?? []}
          onClose={() => setChangePrintingOpen(false)}
          onConfirm={(printing) => {
            onChangePrinting(printing);
            setChangePrintingOpen(false);
          }}
        />
      )}
    </div>
  );
}
