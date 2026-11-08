"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { loadDeckProjects } from "@/lib/mtg/deck-storage";
import {
  createInitialGameState,
  drawCards,
  moveCard,
  shuffleCards,
  startGame,
  toPublicPlayerState,
  toggleTapped,
} from "@/lib/mtg/play-engine";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { DeckProject } from "@/types/mtg";
import type { LocalGameState, PlayCard, PlayZone, PublicPlayerState } from "@/types/play";

type Screen = "lobby" | "table";
type RoomMode = "local" | "online";

function createRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function normalizeRoomCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function cardImage(card: PlayCard) {
  return card.card.imageUri ?? card.card.faces?.find((face) => face.imageUri)?.imageUri;
}

function PlayCardTile({
  item,
  compact = false,
  hidden = false,
  onClick,
  actions,
}: {
  item?: PlayCard;
  compact?: boolean;
  hidden?: boolean;
  onClick?: () => void;
  actions?: ReactNode;
}) {
  const image = item ? cardImage(item) : undefined;

  return (
    <div className={`mtg-play-card ${compact ? "is-compact" : ""} ${item?.tapped ? "is-tapped" : ""}`}>
      <button
        type="button"
        className="mtg-play-card__surface"
        onClick={onClick}
        disabled={!onClick}
        title={item?.card.name}
      >
        {hidden ? (
          <span className="mtg-play-card__back">MAGIC</span>
        ) : image ? (
          <img src={image} alt={item?.card.name ?? "Carte"} />
        ) : (
          <span>{item?.card.name ?? "Carte"}</span>
        )}
      </button>
      {actions ? <div className="mtg-play-card__actions">{actions}</div> : null}
    </div>
  );
}

function Counter({ label, value, onMinus, onPlus }: { label: string; value: number; onMinus: () => void; onPlus: () => void }) {
  return (
    <div className="mtg-play-counter">
      <span>{label}</span>
      <div>
        <button type="button" onClick={onMinus}>−</button>
        <strong>{value}</strong>
        <button type="button" onClick={onPlus}>+</button>
      </div>
    </div>
  );
}

function ZonePile({
  title,
  cards,
  hidden = false,
}: {
  title: string;
  cards: PlayCard[];
  hidden?: boolean;
}) {
  const top = cards[cards.length - 1];
  return (
    <div className="mtg-play-zone-pile">
      <span>{title}</span>
      <div className="mtg-play-zone-pile__card">
        {cards.length > 0 ? <PlayCardTile item={top} compact hidden={hidden} /> : <div className="mtg-play-zone-pile__empty">—</div>}
        <strong>{cards.length}</strong>
      </div>
    </div>
  );
}

function RemoteBoard({ player }: { player: PublicPlayerState }) {
  return (
    <section className="mtg-play-opponent">
      <header>
        <div>
          <span>ADVERSAIRE</span>
          <strong>{player.playerLabel}</strong>
          <small>{player.deckName} · {player.format}</small>
        </div>
        <div className="mtg-play-opponent__life">{player.life} PV</div>
      </header>

      <div className="mtg-play-opponent__summary">
        <span>Main <strong>{player.handCount}</strong></span>
        <span>Bibliothèque <strong>{player.libraryCount}</strong></span>
        <span>Cimetière <strong>{player.graveyard.length}</strong></span>
        <span>Exil <strong>{player.exile.length}</strong></span>
      </div>

      {player.command.length > 0 && (
        <div className="mtg-play-opponent__command">
          <span>Zone de commandement</span>
          <div>{player.command.map((card) => <PlayCardTile key={card.instanceId} item={card} compact />)}</div>
        </div>
      )}

      <div className="mtg-play-opponent__battlefield">
        {player.battlefield.length ? (
          player.battlefield.map((card) => <PlayCardTile key={card.instanceId} item={card} compact />)
        ) : (
          <span>Aucun permanent sur le champ de bataille.</span>
        )}
      </div>
    </section>
  );
}

export default function MtgPlay() {
  const [screen, setScreen] = useState<Screen>("lobby");
  const [decks, setDecks] = useState<DeckProject[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [roomMode, setRoomMode] = useState<RoomMode>("local");
  const [status, setStatus] = useState("Prêt");
  const [message, setMessage] = useState<string | null>(null);
  const [game, setGame] = useState<LocalGameState | null>(null);
  const [remotePlayers, setRemotePlayers] = useState<Record<string, PublicPlayerState>>({});
  const [onlineIdentity, setOnlineIdentity] = useState<{ id: string; label: string } | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const gameRef = useRef<LocalGameState | null>(null);

  useEffect(() => {
    const readyDecks = loadDeckProjects().filter((deck) => deck.status === "active");
    setDecks(readyDecks);
    setSelectedDeckId(readyDecks[0]?.id ?? "");
  }, []);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    return () => {
      if (channelRef.current) {
        const supabase = createClient();
        void supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  const selectedDeck = useMemo(
    () => decks.find((deck) => deck.id === selectedDeckId) ?? null,
    [decks, selectedDeckId],
  );

  const opponents = (Object.values(remotePlayers) as PublicPlayerState[]).filter(
    (player) => player.playerId !== game?.playerId,
  );

  const broadcastState = async (state: LocalGameState) => {
    const channel = channelRef.current;
    if (!channel) return;

    await channel.send({
      type: "broadcast",
      event: "player-state",
      payload: toPublicPlayerState(state),
    });
  };

  useEffect(() => {
    if (!game || roomMode !== "online" || status !== "Connecté") return;
    const timer = window.setTimeout(() => void broadcastState(game), 80);
    return () => window.clearTimeout(timer);
  }, [game, roomMode, status]);

  const getIdentity = async () => {
    if (!isSupabaseConfigured()) {
      throw new Error("Supabase n’est pas configuré : le mode en ligne est indisponible.");
    }

    const supabase = createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw new Error("Connecte-toi à ton compte cloud pour utiliser le jeu en ligne.");
    }

    const label = data.user.user_metadata?.display_name || data.user.email?.split("@")[0] || "Joueur";
    return { id: data.user.id, label: String(label) };
  };

  const connectRealtime = async (code: string, identity: { id: string; label: string }) => {
    const supabase = createClient();

    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setStatus("Connexion…");
    setRemotePlayers({});

    const channel = supabase.channel(`mtg-game:${code}`, {
      config: {
        presence: { key: identity.id },
        broadcast: { self: false },
      },
    });

    channel
      .on("broadcast", { event: "player-state" }, ({ payload }) => {
        const next = payload as PublicPlayerState;
        if (!next?.playerId) return;
        setRemotePlayers((current) => ({ ...current, [next.playerId]: next }));
      })
      .on("broadcast", { event: "state-request" }, () => {
        const current = gameRef.current;
        if (!current) return;
        void channel.send({
          type: "broadcast",
          event: "player-state",
          payload: toPublicPlayerState(current),
        });
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        setRemotePlayers((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
      });

    channel.subscribe(async (subscriptionStatus) => {
      if (subscriptionStatus === "SUBSCRIBED") {
        channelRef.current = channel;
        setStatus("Connecté");
        await channel.track({
          playerId: identity.id,
          playerLabel: identity.label,
          joinedAt: new Date().toISOString(),
        });
        await channel.send({ type: "broadcast", event: "state-request", payload: {} });
        const current = gameRef.current;
        if (current) await broadcastState(current);
      }

      if (subscriptionStatus === "CHANNEL_ERROR" || subscriptionStatus === "TIMED_OUT") {
        setStatus("Erreur réseau");
        setMessage("Impossible de rejoindre le canal Realtime Supabase.");
      }
    });
  };

  const openLocalTable = () => {
    if (!selectedDeck) {
      setMessage("Sélectionne d’abord un deck prêt.");
      return;
    }

    const identity = { id: "local-player", label: "Joueur local" };
    setOnlineIdentity(identity);
    setRoomMode("local");
    setRoomCode(null);
    setRemotePlayers({});
    setGame(createInitialGameState(selectedDeck, identity.id, identity.label));
    setStatus("Local");
    setMessage(null);
    setScreen("table");
  };

  const openOnlineTable = async (code: string) => {
    if (!selectedDeck) {
      setMessage("Sélectionne d’abord un deck prêt.");
      return;
    }

    try {
      const identity = await getIdentity();
      const initial = createInitialGameState(selectedDeck, identity.id, identity.label);
      gameRef.current = initial;
      setOnlineIdentity(identity);
      setRoomMode("online");
      setRoomCode(code);
      setGame(initial);
      setMessage(null);
      setScreen("table");
      await connectRealtime(code, identity);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Connexion en ligne impossible.");
    }
  };

  const createOnlineRoom = () => void openOnlineTable(createRoomCode());
  const joinOnlineRoom = () => {
    const code = normalizeRoomCode(joinCode);
    if (code.length !== 6) {
      setMessage("Le code de salle doit contenir 6 caractères.");
      return;
    }
    void openOnlineTable(code);
  };

  const updateGame = (updater: (current: LocalGameState) => LocalGameState) => {
    setGame((current) => (current ? updater(current) : current));
  };

  const leaveTable = async () => {
    if (channelRef.current && isSupabaseConfigured()) {
      const supabase = createClient();
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setRemotePlayers({});
    setGame(null);
    setRoomCode(null);
    setStatus("Prêt");
    setScreen("lobby");
  };

  if (screen === "table" && game) {
    return (
      <main className="mtg-play-table-page">
        <header className="mtg-play-table-topbar">
          <button type="button" onClick={() => void leaveTable()} className="mtg-play-back-button">← Lobby</button>
          <div>
            <span>{roomMode === "online" ? "SALLE EN LIGNE" : "TABLE LOCALE"}</span>
            <strong>{roomCode ?? "Solo"}</strong>
          </div>
          <div className={`mtg-play-network-status is-${status === "Connecté" ? "online" : "neutral"}`}>
            <span />{status}
          </div>
        </header>

        <section className="mtg-play-table">
          <div className="mtg-play-table__opponents">
            {opponents.length ? (
              opponents.map((player) => <RemoteBoard key={player.playerId} player={player} />)
            ) : (
              <div className="mtg-play-waiting-seat">
                <span>{roomMode === "online" ? "EN ATTENTE D’UN ADVERSAIRE" : "MODE LOCAL"}</span>
                <strong>{roomMode === "online" ? roomCode : "Table d’entraînement"}</strong>
                <p>
                  {roomMode === "online"
                    ? "Partage ce code. L’autre joueur choisit son deck puis utilise « Rejoindre une salle »."
                    : "Le plateau fonctionne déjà localement. Utilise-le pour tester les zones et les actions de base."}
                </p>
              </div>
            )}
          </div>

          <section className="mtg-play-self">
            <header className="mtg-play-self__header">
              <div>
                <span>TON PLATEAU</span>
                <strong>{game.deckName}</strong>
                <small>{onlineIdentity?.label} · {game.format} · Tour {game.turn || "—"}</small>
              </div>

              <Counter
                label="Points de vie"
                value={game.life}
                onMinus={() => updateGame((current) => ({ ...current, life: current.life - 1, updatedAt: Date.now() }))}
                onPlus={() => updateGame((current) => ({ ...current, life: current.life + 1, updatedAt: Date.now() }))}
              />
            </header>

            <div className="mtg-play-toolbar">
              <button type="button" className="mtg-primary-button" onClick={() => updateGame(startGame)}>
                {game.started ? "Recommencer / Mélanger" : "Commencer · piocher 7"}
              </button>
              <button type="button" className="mtg-secondary-button" onClick={() => updateGame((current) => drawCards(current, 1))} disabled={!game.started || !game.library.length}>
                Piocher 1
              </button>
              <button type="button" className="mtg-secondary-button" onClick={() => updateGame((current) => ({ ...current, library: shuffleCards(current.library), updatedAt: Date.now() }))}>
                Mélanger
              </button>
              <button type="button" className="mtg-secondary-button" onClick={() => updateGame((current) => ({ ...current, turn: Math.max(1, current.turn + 1), battlefield: current.battlefield.map((card) => ({ ...card, tapped: false })), updatedAt: Date.now() }))}>
                Nouveau tour
              </button>
            </div>

            <div className="mtg-play-self__zones">
              <aside className="mtg-play-side-zones">
                <ZonePile title="Bibliothèque" cards={game.library} hidden />
                <ZonePile title="Cimetière" cards={game.graveyard} />
                <ZonePile title="Exil" cards={game.exile} />
              </aside>

              <div className="mtg-play-main-zones">
                {game.command.length > 0 && (
                  <section className="mtg-play-command-zone">
                    <span>ZONE DE COMMANDEMENT</span>
                    <div>
                      {game.command.map((card) => (
                        <PlayCardTile
                          key={card.instanceId}
                          item={card}
                          compact
                          actions={
                            <button type="button" onClick={() => updateGame((current) => moveCard(current, card.instanceId, "command", "battlefield"))}>
                              Jouer
                            </button>
                          }
                        />
                      ))}
                    </div>
                  </section>
                )}

                <section className="mtg-play-battlefield-zone">
                  <div className="mtg-play-zone-title">
                    <span>CHAMP DE BATAILLE</span>
                    <small>Clique une carte pour l’engager / dégager.</small>
                  </div>
                  <div className="mtg-play-battlefield-grid">
                    {game.battlefield.length ? (
                      game.battlefield.map((card) => (
                        <PlayCardTile
                          key={card.instanceId}
                          item={card}
                          onClick={() => updateGame((current) => toggleTapped(current, card.instanceId))}
                          actions={
                            <>
                              <button type="button" onClick={() => updateGame((current) => moveCard(current, card.instanceId, "battlefield", "hand"))}>Main</button>
                              <button type="button" onClick={() => updateGame((current) => moveCard(current, card.instanceId, "battlefield", "graveyard"))}>Cimetière</button>
                              <button type="button" onClick={() => updateGame((current) => moveCard(current, card.instanceId, "battlefield", "exile"))}>Exil</button>
                            </>
                          }
                        />
                      ))
                    ) : (
                      <div className="mtg-play-zone-placeholder">Joue une carte depuis ta main pour commencer.</div>
                    )}
                  </div>
                </section>
              </div>
            </div>

            <section className="mtg-play-hand-zone">
              <div className="mtg-play-zone-title">
                <span>MAIN · {game.hand.length}</span>
                <small>Ta main reste privée : elle n’est jamais envoyée aux autres joueurs.</small>
              </div>
              <div className="mtg-play-hand-scroll">
                {game.hand.length ? (
                  game.hand.map((card) => (
                    <PlayCardTile
                      key={card.instanceId}
                      item={card}
                      actions={
                        <>
                          <button type="button" onClick={() => updateGame((current) => moveCard(current, card.instanceId, "hand", "battlefield"))}>Jouer</button>
                          <button type="button" onClick={() => updateGame((current) => moveCard(current, card.instanceId, "hand", "graveyard"))}>Défausser</button>
                          <button type="button" onClick={() => updateGame((current) => moveCard(current, card.instanceId, "hand", "exile"))}>Exiler</button>
                        </>
                      }
                    />
                  ))
                ) : (
                  <div className="mtg-play-zone-placeholder">Ta main est vide.</div>
                )}
              </div>
            </section>
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className="mtg-play-lobby">
      <div className="mtg-play-lobby__background" aria-hidden="true" />

      <header className="mtg-play-lobby__header">
        <Link href="/mtg" className="mtg-play-lobby__back">← Magic</Link>
        <span>PLAY · PROTOTYPE V0.1</span>
      </header>

      <section className="mtg-play-lobby__hero">
        <div>
          <p>MAGIC · TABLE</p>
          <h1>Prépare ta <span>partie.</span></h1>
          <p>
            Choisis un deck prêt. Tu peux tester le tapis localement ou ouvrir une salle Realtime
            et partager son code avec un autre utilisateur connecté.
          </p>
        </div>
        <div className="mtg-play-lobby__status-card">
          <span>ÉTAT DU PROTOTYPE</span>
          <strong>Table synchronisable</strong>
          <p>Le moteur de règles reste manuel : les joueurs pilotent eux-mêmes les zones et les actions.</p>
        </div>
      </section>

      <section className="mtg-play-lobby__content">
        <article className="mtg-play-panel mtg-play-panel--deck">
          <div className="mtg-play-panel__index">01</div>
          <div className="mtg-play-panel__heading">
            <span>DECK</span>
            <h2>Choisir un deck prêt</h2>
            <p>Seuls les decks marqués « Prêt » sont proposés pour jouer.</p>
          </div>

          {decks.length ? (
            <div className="mtg-play-deck-list">
              {decks.map((deck) => {
                const commander = deck.commanders[0]?.card;
                const selected = selectedDeckId === deck.id;
                return (
                  <button
                    key={deck.id}
                    type="button"
                    className={`mtg-play-deck-option ${selected ? "is-selected" : ""}`}
                    onClick={() => setSelectedDeckId(deck.id)}
                  >
                    <div className="mtg-play-deck-option__art">
                      {commander?.imageUri ? <img src={commander.imageUri} alt="" /> : <span>{deck.format.slice(0, 1)}</span>}
                    </div>
                    <div>
                      <strong>{deck.name}</strong>
                      <span>{deck.format}</span>
                      <small>{deck.format === "Commander" ? commander?.name ?? "Commandant" : `${deck.cards.filter((entry) => entry.section === "mainboard").reduce((sum, entry) => sum + entry.quantity, 0)} cartes`}</small>
                    </div>
                    <span className="mtg-play-deck-option__check">{selected ? "✓" : ""}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mtg-play-empty-decks">
              <strong>Aucun deck prêt</strong>
              <p>Termine un deck dans l’espace Construction, puis marque-le comme prêt.</p>
              <Link href="/mtg/decks">Ouvrir le deck builder →</Link>
            </div>
          )}
        </article>

        <article className="mtg-play-panel">
          <div className="mtg-play-panel__index">02</div>
          <div className="mtg-play-panel__heading">
            <span>MODE</span>
            <h2>Ouvrir une table</h2>
            <p>Le mode local fonctionne sans compte. Le mode en ligne utilise Supabase Realtime.</p>
          </div>

          <div className="mtg-play-mode-grid">
            <button type="button" className="mtg-play-mode-card" onClick={openLocalTable} disabled={!selectedDeck}>
              <span>LOCAL</span>
              <strong>Table d’entraînement</strong>
              <p>Teste les zones, la pioche, les permanents et les PV sur ton appareil.</p>
              <b>Ouvrir →</b>
            </button>

            <button type="button" className="mtg-play-mode-card is-online" onClick={createOnlineRoom} disabled={!selectedDeck}>
              <span>ONLINE · REALTIME</span>
              <strong>Créer une salle</strong>
              <p>Génère un code à 6 caractères à envoyer à un autre utilisateur.</p>
              <b>Créer →</b>
            </button>
          </div>

          <div className="mtg-play-join">
            <div>
              <span>REJOINDRE</span>
              <strong>Tu as reçu un code ?</strong>
            </div>
            <input
              value={joinCode}
              onChange={(event) => setJoinCode(normalizeRoomCode(event.target.value))}
              placeholder="ABC123"
              maxLength={6}
              aria-label="Code de salle"
            />
            <button type="button" onClick={joinOnlineRoom} disabled={!selectedDeck || joinCode.length !== 6}>
              Rejoindre
            </button>
          </div>

          {message && <div className="mtg-play-message">{message}</div>}
        </article>
      </section>

      <section className="mtg-play-roadmap">
        <span>CE QUI EST DÉJÀ LÀ</span>
        <div>
          <article><strong>01</strong><h3>Lobby + codes</h3><p>Créer ou rejoindre une table à partir d’un deck prêt.</p></article>
          <article><strong>02</strong><h3>État public</h3><p>PV, battlefield, cimetière, exil et compteurs de main/bibliothèque.</p></article>
          <article><strong>03</strong><h3>Zones privées</h3><p>Ta main et l’ordre de ta bibliothèque restent uniquement dans ton navigateur.</p></article>
          <article><strong>04</strong><h3>Prochaine couche</h3><p>Drag & drop, tokens, dés, marqueurs, dégâts de commandant, journal et sauvegarde de partie.</p></article>
        </div>
      </section>
    </main>
  );
}
