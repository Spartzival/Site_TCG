"use client";

import { type MouseEvent, useEffect, useMemo, useState } from "react";
import { fetchJson } from "@/lib/http/fetch-json";
import { isGuestMode } from "@/lib/mtg/storage-mode";
import type { DeckProject } from "@/types/mtg";
import type { MtgFriend, MtgSocialState } from "@/types/social";

type Props = {
  open: boolean;
  deck: DeckProject;
  onClose: () => void;
};

type ActionResponse = {
  ok: boolean;
  state: MtgSocialState;
};

export default function ShareDeckDialog({ open, deck, onClose }: Props) {
  const [state, setState] = useState<MtgSocialState | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const guest = typeof window !== "undefined" && isGuestMode();

  useEffect(() => {
    if (!open || guest) return;

    let cancelled = false;
    setLoading(true);
    setMessage(null);

    fetchJson<MtgSocialState>("/api/mtg/social")
      .then((payload) => {
        if (!cancelled) setState(payload);
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Partage indisponible.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, guest]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const sharedByFriend = useMemo(() => {
    const map = new Map<string, string>();
    for (const share of state?.sharesSent ?? []) {
      if (share.deckId === deck.id) map.set(share.recipient.userId, share.id);
    }
    return map;
  }, [state, deck.id]);

  if (!open) return null;

  const act = async (
    friendUserId: string,
    shareId?: string,
  ) => {
    setBusyId(friendUserId);
    setMessage(null);

    try {
      const payload = await fetchJson<ActionResponse>("/api/mtg/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          shareId
            ? { action: "unshare-deck", shareId }
            : { action: "share-deck", friendUserId, deckId: deck.id, deck },
        ),
      });
      setState(payload.state);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Partage impossible.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      className="mtg-social-dialog-backdrop"
      role="presentation"
      onMouseDown={(event: MouseEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="mtg-social-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mtg-share-deck-title"
      >
        <header className="mtg-social-dialog__header">
          <div>
            <span>PARTAGER LE DECK</span>
            <h2 id="mtg-share-deck-title">{deck.name}</h2>
            <p>Les amis reçoivent une vue en lecture seule qui suit tes mises à jour.</p>
          </div>
          <button type="button" className="mtg-icon-button" onClick={onClose}>×</button>
        </header>

        {guest ? (
          <div className="mtg-social-empty">
            <strong>Connexion cloud requise</strong>
            <p>Quitte le mode invité avec le bouton « Se connecter / sauvegarder » pour utiliser les amis et les partages.</p>
          </div>
        ) : loading ? (
          <div className="mtg-social-empty"><strong>Chargement des amis…</strong></div>
        ) : !state?.profile ? (
          <div className="mtg-social-empty">
            <strong>Crée d’abord ton profil social</strong>
            <p>Ouvre l’onglet « Amis & partages » et choisis un pseudo public.</p>
          </div>
        ) : (state.friends.length ?? 0) === 0 ? (
          <div className="mtg-social-empty">
            <strong>Aucun ami pour le moment</strong>
            <p>Ajoute un utilisateur dans l’onglet social avant de partager ce deck.</p>
          </div>
        ) : (
          <div className="mtg-social-share-list">
            {state.friends.map((friend: MtgFriend) => {
              const shareId = sharedByFriend.get(friend.userId);
              return (
                <div key={friend.userId} className="mtg-social-person-row">
                  <span className="mtg-social-avatar">
                    {(friend.displayName || friend.username).slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <strong>{friend.displayName || friend.username}</strong>
                    <small>@{friend.username}</small>
                  </div>
                  <button
                    type="button"
                    className={shareId ? "mtg-secondary-button" : "mtg-primary-button"}
                    disabled={busyId === friend.userId}
                    onClick={() => void act(friend.userId, shareId)}
                  >
                    {busyId === friend.userId
                      ? "…"
                      : shareId
                        ? "Retirer le partage"
                        : "Partager"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {message && <div className="mtg-auth-message">{message}</div>}
      </section>
    </div>
  );
}
