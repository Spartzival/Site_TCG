import type { DeckFormat, DeckSection, MtgCard } from "@/types/mtg";

export type PlayZone =
  | "library"
  | "hand"
  | "battlefield"
  | "graveyard"
  | "exile"
  | "command";

export type PlayCard = {
  instanceId: string;
  card: MtgCard;
  section: DeckSection;
  tapped: boolean;
};

export type LocalGameState = {
  playerId: string;
  playerLabel: string;
  deckId: string;
  deckName: string;
  format: DeckFormat;
  life: number;
  commanderDamage: Record<string, number>;
  library: PlayCard[];
  hand: PlayCard[];
  battlefield: PlayCard[];
  graveyard: PlayCard[];
  exile: PlayCard[];
  command: PlayCard[];
  turn: number;
  started: boolean;
  updatedAt: number;
};

export type PublicPlayerState = {
  playerId: string;
  playerLabel: string;
  deckName: string;
  format: DeckFormat;
  life: number;
  handCount: number;
  libraryCount: number;
  battlefield: PlayCard[];
  graveyard: PlayCard[];
  exile: PlayCard[];
  command: PlayCard[];
  turn: number;
  started: boolean;
  updatedAt: number;
};
