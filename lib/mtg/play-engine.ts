import type { DeckCardEntry, DeckProject } from "@/types/mtg";
import type { LocalGameState, PlayCard, PlayZone, PublicPlayerState } from "@/types/play";

function makeInstanceId(prefix: string, index: number) {
  return `${prefix}:${index}:${Math.random().toString(36).slice(2, 9)}`;
}

function expandEntries(entries: DeckCardEntry[]): PlayCard[] {
  const cards: PlayCard[] = [];

  entries.forEach((entry, entryIndex) => {
    for (let copyIndex = 0; copyIndex < entry.quantity; copyIndex += 1) {
      cards.push({
        instanceId: makeInstanceId(`${entry.card.id}:${entryIndex}`, copyIndex),
        card: entry.card,
        section: entry.section,
        tapped: false,
      });
    }
  });

  return cards;
}

export function shuffleCards<T>(cards: T[]): T[] {
  const next = [...cards];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }

  return next;
}

export function createInitialGameState(
  deck: DeckProject,
  playerId: string,
  playerLabel: string,
): LocalGameState {
  const libraryEntries = deck.cards.filter((entry) => entry.section === "mainboard");
  const commandEntries = deck.format === "Commander" ? deck.commanders : [];

  return {
    playerId,
    playerLabel,
    deckId: deck.id,
    deckName: deck.name,
    format: deck.format,
    life: deck.format === "Commander" ? 40 : 20,
    commanderDamage: {},
    library: shuffleCards(expandEntries(libraryEntries)),
    hand: [],
    battlefield: [],
    graveyard: [],
    exile: [],
    command: expandEntries(commandEntries),
    turn: 0,
    started: false,
    updatedAt: Date.now(),
  };
}

export function drawCards(state: LocalGameState, quantity = 1): LocalGameState {
  if (quantity <= 0 || state.library.length === 0) return state;

  const count = Math.min(quantity, state.library.length);
  const drawn = state.library.slice(0, count);

  return {
    ...state,
    library: state.library.slice(count),
    hand: [...state.hand, ...drawn],
    updatedAt: Date.now(),
  };
}

export function startGame(state: LocalGameState): LocalGameState {
  const shuffled = {
    ...state,
    library: shuffleCards(state.library),
    hand: [],
    battlefield: [],
    graveyard: [],
    exile: [],
    life: state.format === "Commander" ? 40 : 20,
    turn: 1,
    started: true,
    updatedAt: Date.now(),
  };

  return drawCards(shuffled, 7);
}

export function moveCard(
  state: LocalGameState,
  instanceId: string,
  from: PlayZone,
  to: PlayZone,
): LocalGameState {
  if (from === "library" || to === "library") return state;

  const fromCards = state[from] as PlayCard[];
  const card = fromCards.find((item) => item.instanceId === instanceId);
  if (!card) return state;

  const cleanedCard = { ...card, tapped: to === "battlefield" ? card.tapped : false };

  return {
    ...state,
    [from]: fromCards.filter((item) => item.instanceId !== instanceId),
    [to]: [...(state[to] as PlayCard[]), cleanedCard],
    updatedAt: Date.now(),
  } as LocalGameState;
}

export function toggleTapped(state: LocalGameState, instanceId: string): LocalGameState {
  return {
    ...state,
    battlefield: state.battlefield.map((card) =>
      card.instanceId === instanceId ? { ...card, tapped: !card.tapped } : card,
    ),
    updatedAt: Date.now(),
  };
}

export function toPublicPlayerState(state: LocalGameState): PublicPlayerState {
  return {
    playerId: state.playerId,
    playerLabel: state.playerLabel,
    deckName: state.deckName,
    format: state.format,
    life: state.life,
    handCount: state.hand.length,
    libraryCount: state.library.length,
    battlefield: state.battlefield,
    graveyard: state.graveyard,
    exile: state.exile,
    command: state.command,
    turn: state.turn,
    started: state.started,
    updatedAt: state.updatedAt,
  };
}
