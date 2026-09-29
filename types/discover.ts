import type { DeckStatus, MtgCard } from "@/types/mtg";

export type DiscoverRoleNeed = {
  role: string;
  label: string;
  count: number;
  target: number;
};

export type DiscoverDeckInput = {
  id: string;
  name: string;
  status: DeckStatus;
  updatedAt: string;
  commander: Pick<
    MtgCard,
    "name" | "oracleText" | "typeLine" | "colorIdentity" | "keywords" | "faces"
  >;
  cardNames: string[];
  roleNeeds: DiscoverRoleNeed[];
};

export type DiscoverTrendingCard = {
  card: MtgCard;
  popularityRank?: number;
};

export type DiscoverPersonalCard = {
  card: MtgCard;
  score: number;
  reasons: string[];
  deckIds: string[];
  deckNames: string[];
  popularityRank?: number;
};

export type DiscoverResponse = {
  available: boolean;
  recentSince: string;
  trending: DiscoverTrendingCard[];
  personalized: DiscoverPersonalCard[];
  error?: string;
};
