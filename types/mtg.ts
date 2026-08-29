export type DeckStatus = "active" | "building" | "archived";

export type CommanderBracket = 1 | 2 | 3 | 4 | 5;

export type MtgLegality = "legal" | "not_legal" | "restricted" | "banned";

export type MtgCardFace = {
  name: string;
  manaCost?: string;
  typeLine?: string;
  oracleText?: string;
  imageUri?: string;
  colors?: string[];
  power?: string;
  toughness?: string;
};

export type MtgCard = {
  // Logical identity. All physical printings of the same Oracle card share it.
  id: string;

  // Exact Scryfall printing identity.
  scryfallId: string;
  oracleId?: string;

  name: string;
  manaCost?: string;
  manaValue?: number;
  typeLine?: string;
  oracleText?: string;
  imageUri?: string;

  colors: string[];
  colorIdentity: string[];
  keywords?: string[];
  legalities?: Record<string, MtgLegality>;

  setCode?: string;
  setName?: string;
  collectorNumber?: string;
  rarity?: string;
  power?: string;
  toughness?: string;
  releasedAt?: string;
  language?: string;

  // Present for transform / modal DFC / split / adventure / other multi-face cards.
  // The physical card still counts as ONE card in a deck.
  faces?: MtgCardFace[];
};

export type CollectionPrinting = {
  card: MtgCard;
  quantity: number;
};

export type CollectionCard = {
  // oracleId when available, otherwise Scryfall id.
  id: string;
  name: string;

  // Representative printing used in the global list.
  card: MtgCard;

  // Total quantity across all physical printings.
  quantity: number;

  // Exact versions owned.
  printings: CollectionPrinting[];
};

export type DeckSection =
  | "commander"
  | "mainboard"
  | "sideboard"
  | "maybeboard";

export type DeckCardEntry = {
  card: MtgCard;
  quantity: number;
  section: DeckSection;
};

export type MtgDeck = {
  id: string;
  name: string;
  slug: string;
  format: string;
  bracket?: CommanderBracket;
  status: DeckStatus;
  description?: string;
};

export type DeckProject = MtgDeck & {
  commanders: DeckCardEntry[];
  cards: DeckCardEntry[];
  cedhIntent?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DeckCard = {
  deckId: string;
  cardId: string;
  quantity: number;
  section: DeckSection;
};

export type ManaCurveBucket = {
  manaValue: string;
  count: number;
};

export type DeckTypeStats = {
  creatures: number;
  instants: number;
  sorceries: number;
  artifacts: number;
  enchantments: number;
  planeswalkers: number;
  battles: number;
  lands: number;
  other: number;
};

export type DeckLocalAnalysis = {
  totalCards: number;
  commanderCount: number;
  mainboardCount: number;
  landCount: number;
  nonlandCount: number;
  averageManaValue: number;
  manaCurve: ManaCurveBucket[];
  manaPips: Record<"W" | "U" | "B" | "R" | "G" | "C", number>;
  typeStats: DeckTypeStats;
  commanderIdentity: string[];
  colorIdentityViolations: string[];
  commanderLegalityViolations: string[];
  duplicateViolations: string[];
};

export type SpellbookComboCard = {
  name: string;
  quantity?: number;
  mustBeCommander?: boolean;
};

export type SpellbookCombo = {
  id: string;
  cards: SpellbookComboCard[];
  produces: string[];
  description?: string;
  easyPrerequisites?: string;
  notablePrerequisites?: string;
  bracketTag?: string;
  missingCards?: string[];
};

export type SpellbookBracketFindings = {
  bracketTag?: string;
  bannedCards: string[];
  gameChangerCards: string[];
  massLandDenialCards: string[];
  extraTurnCards: string[];
  twoCardCombos: SpellbookCombo[];
  lockCombos: SpellbookCombo[];
};

export type DeckRemoteAnalysis = {
  available: boolean;
  estimatedBracket: CommanderBracket | null;
  minimumBracket: CommanderBracket;
  bracketLabel: string;
  bracketReason: string[];
  findings: SpellbookBracketFindings;
  includedCombos: SpellbookCombo[];
  almostIncludedCombos: SpellbookCombo[];
  error?: string;
};

export type DeckEligibilityCheck = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
};

export type DeckEligibility = {
  eligible: boolean;
  checks: DeckEligibilityCheck[];
};
