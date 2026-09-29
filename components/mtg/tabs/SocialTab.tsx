"use client";

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import DeckBuilder from "../deck-builder/DeckBuilder";
import { fetchJson } from "@/lib/http/fetch-json";
import { loadDeckProjects } from "@/lib/mtg/deck-storage";
import { isGuestMode } from "@/lib/mtg/storage-mode";
import type { DeckProject } from "@/types/mtg";
import type {
  MtgDeckShare,
  MtgFriend,
  MtgFriendRequest,
  MtgSocialProfile,
  MtgSocialState,
} from "@/types/social";

type ActionResponse = {
  ok: boolean;
  state: MtgSocialState;
};

type SearchResponse = {
  users: MtgSocialProfile[];
};

export default function SocialTab() {
  const [state, setState] = useState<MtgSocialState | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<MtgSocialProfile[]>([]);
  const [selectedShareId, setSelectedShareId] = useState<string | null>(null);
  const [shareDeckId, setShareDeckId] = useState<string>("");
  const [shareFriendId, setShareFriendId] = useState<string>("");
  const [localDecks, setLocalDecks] = useState<DeckProject[]>([]);
  const [guest, setGuest] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const payload = await fetchJson<MtgSocialState>("/api/mtg/social");
      setState(payload);
      setUsername(payload.profile?.username ?? "");
      setDisplayName(payload.profile?.displayName ?? "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Social indisponible.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const currentGuest = isGuestMode();
    setGuest(currentGuest);
    setLocalDecks(loadDeckProjects());
    if (!currentGuest) void refresh();
    else setLoading(false);
  }, []);

  const selectedShare = useMemo(
    () => state?.sharesReceived.find((share: MtgDeckShare) => share.id === selectedShareId) ?? null,
    [state, selectedShareId],
  );

  if (selectedShare) {
    return (
      <DeckBuilder
        deck={selectedShare.deck}
        allDecks={[selectedShare.deck]}
        sharedBy={selectedShare.owner.displayName || `@${selectedShare.owner.username}`}
        onBack={() => setSelectedShareId(null)}
        onChange={() => undefined}
        onDelete={() => undefined}
      />
    );
  }

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    setMessage(null);
    try {
      const payload = await fetchJson<ActionResponse>("/api/mtg/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setState(payload.state);
      setUsername(payload.state.profile?.username ?? username);
      setDisplayName(payload.state.profile?.displayName ?? displayName);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action impossible.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    await post({ action: "save-profile", username, displayName });
  };

  const searchUsers = async (event: FormEvent) => {
    event.preventDefault();
    if (!search.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const payload = await fetchJson<SearchResponse>(
        `/api/mtg/social?q=${encodeURIComponent(search.trim())}`,
      );
      setSearchResults(payload.users);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Recherche impossible.");
    } finally {
      setBusy(false);
    }
  };

  const shareDeck = async () => {
    if (!shareDeckId || !shareFriendId) return;
    const deck = localDecks.find((candidate) => candidate.id === shareDeckId);
    if (!deck) return;

    const ok = await post({
      action: "share-deck",
      friendUserId: shareFriendId,
      deckId: shareDeckId,
      deck,
    });
    if (ok) {
      setShareDeckId("");
      setShareFriendId("");
    }
  };

  if (guest) {
    return (
      <div className="mtg-tab-page">
        <div className="mtg-tab-page__header">
          <div>
            <span className="mtg-tab-page__eyebrow">SOCIAL</span>
            <h2>Amis & partages</h2>
            <p>Partage tes decks avec d’autres utilisateurs de Magic Library.</p>
          </div>
        </div>
        <div className="mtg-social-empty mtg-social-empty--large">
          <strong>Le mode social nécessite un compte cloud</strong>
          <p>Utilise « Se connecter / sauvegarder » dans le bandeau en haut de l’écran. Les comptes invités restent entièrement locaux et ne sont pas visibles des autres utilisateurs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mtg-tab-page mtg-social-page">
      <div className="mtg-tab-page__header">
        <div>
          <span className="mtg-tab-page__eyebrow">SOCIAL LIBRARY</span>
          <h2>Amis & partages</h2>
          <p>Ajoute des amis par pseudo et partage tes decks en lecture seule.</p>
        </div>
      </div>

      {message && <div className="mtg-auth-message">{message}</div>}

      {loading ? (
        <div className="mtg-social-empty"><strong>Chargement du réseau…</strong></div>
      ) : (
        <div className="mtg-social-layout">
          <section className="mtg-social-card mtg-social-profile-card">
            <span className="mtg-tab-page__eyebrow">MON PROFIL PUBLIC</span>
            <h3>{state?.profile ? `@${state.profile.username}` : "Choisis ton pseudo"}</h3>
            <p>Seuls ton pseudo et ton nom d’affichage sont visibles. Ton e-mail reste privé.</p>

            <form onSubmit={saveProfile} className="mtg-social-form">
              <label>
                <span>Pseudo unique</span>
                <input
                  value={username}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setUsername(event.target.value.toLowerCase())}
                  placeholder="spartzival"
                  minLength={3}
                  maxLength={24}
                  pattern="[a-zA-Z0-9_.-]+"
                  required
                />
              </label>
              <label>
                <span>Nom affiché (optionnel)</span>
                <input
                  value={displayName}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setDisplayName(event.target.value)}
                  placeholder="Thomas"
                  maxLength={40}
                />
              </label>
              <button type="submit" className="mtg-primary-button" disabled={busy}>
                {state?.profile ? "Mettre à jour" : "Créer mon profil"}
              </button>
            </form>
          </section>

          <section className="mtg-social-card">
            <span className="mtg-tab-page__eyebrow">AJOUTER UN AMI</span>
            <h3>Rechercher par pseudo</h3>
            <form onSubmit={searchUsers} className="mtg-social-search">
              <input
                value={search}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
                placeholder="@pseudo"
                disabled={!state?.profile}
              />
              <button type="submit" className="mtg-secondary-button" disabled={busy || !state?.profile}>
                Rechercher
              </button>
            </form>

            <div className="mtg-social-share-list">
              {searchResults.map((user: MtgSocialProfile) => {
                const friend = state?.friends.some((item: MtgFriend) => item.userId === user.userId);
                const pending = state?.outgoingRequests.some((item: MtgFriendRequest) => item.user.userId === user.userId);
                return (
                  <div key={user.userId} className="mtg-social-person-row">
                    <span className="mtg-social-avatar">
                      {(user.displayName || user.username).slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <strong>{user.displayName || user.username}</strong>
                      <small>@{user.username}</small>
                    </div>
                    <button
                      type="button"
                      className="mtg-primary-button"
                      disabled={busy || friend || pending}
                      onClick={() => void post({ action: "friend-request", username: user.username })}
                    >
                      {friend ? "Déjà ami" : pending ? "Demande envoyée" : "+ Ajouter"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {(state?.incomingRequests.length ?? 0) > 0 && (
            <section className="mtg-social-card mtg-social-card--wide">
              <span className="mtg-tab-page__eyebrow">DEMANDES REÇUES</span>
              <h3>{state?.incomingRequests.length} demande(s) en attente</h3>
              <div className="mtg-social-share-list">
                {state?.incomingRequests.map((request: MtgFriendRequest) => (
                  <div key={request.id} className="mtg-social-person-row">
                    <span className="mtg-social-avatar">
                      {(request.user.displayName || request.user.username).slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <strong>{request.user.displayName || request.user.username}</strong>
                      <small>@{request.user.username}</small>
                    </div>
                    <div className="mtg-social-row-actions">
                      <button
                        type="button"
                        className="mtg-primary-button"
                        disabled={busy}
                        onClick={() => void post({ action: "friend-response", requestId: request.id, response: "accept" })}
                      >
                        Accepter
                      </button>
                      <button
                        type="button"
                        className="mtg-secondary-button"
                        disabled={busy}
                        onClick={() => void post({ action: "friend-response", requestId: request.id, response: "reject" })}
                      >
                        Refuser
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mtg-social-card mtg-social-card--wide">
            <div className="mtg-social-section-heading">
              <div>
                <span className="mtg-tab-page__eyebrow">MES AMIS</span>
                <h3>{state?.friends.length ?? 0} ami(s)</h3>
              </div>
            </div>

            {(state?.friends.length ?? 0) === 0 ? (
              <div className="mtg-social-empty"><p>Aucun ami pour le moment.</p></div>
            ) : (
              <div className="mtg-social-friend-grid">
                {state?.friends.map((friend: MtgFriend) => (
                  <article key={friend.userId} className="mtg-social-friend-card">
                    <span className="mtg-social-avatar mtg-social-avatar--large">
                      {(friend.displayName || friend.username).slice(0, 1).toUpperCase()}
                    </span>
                    <strong>{friend.displayName || friend.username}</strong>
                    <small>@{friend.username}</small>
                    <button
                      type="button"
                      className="mtg-social-link-danger"
                      onClick={() => {
                        if (window.confirm(`Retirer @${friend.username} de tes amis ? Les decks partagés entre vous seront également révoqués.`)) {
                          void post({ action: "remove-friend", friendUserId: friend.userId });
                        }
                      }}
                    >
                      Retirer l’ami
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="mtg-social-card mtg-social-card--wide">
            <span className="mtg-tab-page__eyebrow">PARTAGER UN DECK</span>
            <h3>Envoyer un deck à un ami</h3>
            <div className="mtg-social-share-controls">
              <label>
                <span>Deck</span>
                <select value={shareDeckId} onChange={(event: ChangeEvent<HTMLSelectElement>) => setShareDeckId(event.target.value)}>
                  <option value="">Choisir un deck…</option>
                  {localDecks.map((deck: DeckProject) => (
                    <option key={deck.id} value={deck.id}>{deck.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Ami</span>
                <select value={shareFriendId} onChange={(event: ChangeEvent<HTMLSelectElement>) => setShareFriendId(event.target.value)}>
                  <option value="">Choisir un ami…</option>
                  {state?.friends.map((friend: MtgFriend) => (
                    <option key={friend.userId} value={friend.userId}>
                      {friend.displayName || friend.username} (@{friend.username})
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="mtg-primary-button"
                disabled={busy || !shareDeckId || !shareFriendId}
                onClick={() => void shareDeck()}
              >
                Partager le deck
              </button>
            </div>
          </section>

          <section className="mtg-social-card mtg-social-card--wide">
            <span className="mtg-tab-page__eyebrow">PARTAGÉS AVEC MOI</span>
            <h3>{state?.sharesReceived.length ?? 0} deck(s) reçu(s)</h3>

            {(state?.sharesReceived.length ?? 0) === 0 ? (
              <div className="mtg-social-empty"><p>Aucun deck partagé avec toi pour le moment.</p></div>
            ) : (
              <div className="mtg-social-deck-grid">
                {state?.sharesReceived.map((share: MtgDeckShare) => {
                  const commander = share.deck.commanders[0]?.card;
                  return (
                    <button
                      key={share.id}
                      type="button"
                      className="mtg-social-deck-card"
                      onClick={() => setSelectedShareId(share.id)}
                    >
                      <span className="mtg-social-deck-card__image">
                        {commander?.imageUri ? <img src={commander.imageUri} alt="" /> : "CMD"}
                      </span>
                      <span>
                        <small>PARTAGÉ PAR @{share.owner.username}</small>
                        <strong>{share.deck.name}</strong>
                        <em>{commander?.name ?? "Sans commandant"}</em>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {(state?.sharesSent.length ?? 0) > 0 && (
            <section className="mtg-social-card mtg-social-card--wide">
              <span className="mtg-tab-page__eyebrow">MES PARTAGES ACTIFS</span>
              <h3>{state?.sharesSent.length} partage(s)</h3>
              <div className="mtg-social-share-list">
                {state?.sharesSent.map((share: MtgDeckShare) => (
                  <div key={share.id} className="mtg-social-person-row">
                    <div>
                      <strong>{share.deck.name}</strong>
                      <small>avec @{share.recipient.username}</small>
                    </div>
                    <button
                      type="button"
                      className="mtg-secondary-button"
                      disabled={busy}
                      onClick={() => void post({ action: "unshare-deck", shareId: share.id })}
                    >
                      Retirer le partage
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
