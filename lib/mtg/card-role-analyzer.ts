import type { MtgCard } from "@/types/mtg";

export type CardRole =
  | "ramp"
  | "draw"
  | "removal"
  | "board-wipe"
  | "tutor"
  | "recursion"
  | "protection"
  | "counterspell"
  | "evasion"
  | "tax-stax"
  | "tokens"
  | "sacrifice"
  | "lifegain-drain"
  | "graveyard-hate"
  | "blink"
  | "discard"
  | "mill"
  | "finisher"
  | "other";

function normalize(value: string | undefined) {
  return (value ?? "")
    .toLocaleLowerCase("en")
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function cardText(card: MtgCard) {
  const texts = [
    card.oracleText,
    ...(card.faces?.map((face) => face.oracleText) ?? []),
  ]
    .filter(Boolean)
    .join("\n");

  return normalize(texts);
}

function cardTypes(card: MtgCard) {
  return normalize(
    [card.typeLine, ...(card.faces?.map((face) => face.typeLine) ?? [])]
      .filter(Boolean)
      .join(" // "),
  );
}

function cardKeywords(card: MtgCard) {
  return normalize(card.keywords?.join(" "));
}

function hasAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function numericPower(card: MtgCard) {
  const values = [card.power, ...(card.faces?.map((face) => face.power) ?? [])]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  return values.length ? Math.max(...values) : 0;
}

export function detectCardRoles(card: MtgCard): CardRole[] {
  const text = cardText(card);
  const type = cardTypes(card);
  const keywords = cardKeywords(card);
  const searchable = `${text} ${keywords}`;
  const roles = new Set<CardRole>();

  // Ramp / mana acceleration.
  if (
    hasAny(text, [
      /add \{[wubrgc]\}/,
      /add (?:one|two|three|four|five|x|an amount of) mana/,
      /add mana of any color/,
      /search your library for [^.]*land cards?[^.]*put [^.]* onto the battlefield/,
      /put (?:a|up to [^,.]+) land card from your hand onto the battlefield/,
      /you may play an additional land/,
      /you may play [^.]* additional lands?/,
      /create [^.]* treasure tokens?/,
    ])
  ) {
    roles.add("ramp");
  }

  // Draw / repeatable card advantage.
  if (
    hasAny(text, [
      /draw (?:a|one|two|three|four|five|x|that many|cards equal to|a number of) card/,
      /draw [0-9]+ cards?/,
      /draw cards equal to/,
      /draw that many cards/,
      /whenever [^.]*, draw a card/,
      /at the beginning of [^.]*, draw a card/,
    ])
  ) {
    roles.add("draw");
  }

  // Targeted removal.
  if (
    hasAny(text, [
      /destroy target /,
      /exile target /,
      /return target [^.]+ to (?:its|their) owner's hand/,
      /target creature gets -[0-9x]+\/-[0-9x]+/,
      /deals? [^,.]+ damage to target (?:creature|planeswalker|permanent)/,
      /target player sacrifices? (?:a|an) /,
      /target opponent sacrifices? (?:a|an) /,
    ])
  ) {
    roles.add("removal");
  }

  // Board wipes / mass removal.
  if (
    hasAny(text, [
      /destroy all /,
      /exile all /,
      /return all [^.]+ to (?:their|its) owners?' hands/,
      /all creatures get -[0-9x]+\/-[0-9x]+/,
      /each creature gets -[0-9x]+\/-[0-9x]+/,
      /each player sacrifices all /,
      /each player sacrifices [^.]* creatures/,
      /each player chooses [^.]* then sacrifices the rest/,
      /deals? [^,.]+ damage to each creature/,
    ])
  ) {
    roles.add("board-wipe");
  }

  const isLandOnlyTutor =
    /search your library for [^.]*land card/.test(text) &&
    !/search your library for (?:a|any) card/.test(text);

  if (
    !isLandOnlyTutor &&
    hasAny(text, [
      /search your library for (?:a|any|up to [^,.]+) card/,
      /search your library for [^.]* card[^.]* reveal (?:it|that card)/,
      /search your library for [^.]* card[^.]* put (?:it|that card) into your hand/,
    ])
  ) {
    roles.add("tutor");
  }

  // Recursion.
  if (
    hasAny(text, [
      /return target [^.]* from your graveyard to your hand/,
      /return [^.]* from your graveyard to your hand/,
      /return [^.]* from your graveyard to the battlefield/,
      /put target [^.]* card from (?:a|your) graveyard onto the battlefield/,
      /you may cast [^.]* from your graveyard/,
      /cast target [^.]* card from your graveyard/,
      /return up to [^.]* cards? from your graveyard/,
      /play [^.]* from your graveyard/,
    ])
  ) {
    roles.add("recursion");
  }

  // Protection. Static keywords count too, not only "gains indestructible".
  if (
    hasAny(searchable, [
      /\bhexproof\b/,
      /\bward\b/,
      /\bshroud\b/,
      /\bindestructible\b/,
      /protection from/,
      /phase out/,
      /phases? out/,
      /can't be the target of/,
      /prevent all damage that would be dealt/,
      /prevent all combat damage/,
      /regenerate target /,
      /creatures can't attack you unless/,
      /creatures can't attack planeswalkers you control unless/,
      /can't attack you unless (?:their|that) controller pays/,
    ])
  ) {
    roles.add("protection");
  }

  if (
    hasAny(text, [
      /counter target spell/,
      /counter target activated ability/,
      /counter target triggered ability/,
      /counter target noncreature spell/,
      /counter target creature spell/,
      /counter it unless/,
    ])
  ) {
    roles.add("counterspell");
  }

  // Evasion / combat penetration.
  if (
    hasAny(searchable, [
      /\bflying\b/,
      /\bmenace\b/,
      /\btrample\b/,
      /\bshadow\b/,
      /\bhorsemanship\b/,
      /\bskulk\b/,
      /\bfear\b/,
      /\bintimidate\b/,
      /can't be blocked/,
      /can't be blocked except by/,
      /can't be blocked by more than one creature/,
      /must be blocked by two or more creatures/,
    ])
  ) {
    roles.add("evasion");
  }

  // Taxes / stax / pillow-fort effects.
  if (
    hasAny(text, [
      /creatures can't attack you unless/,
      /creatures can't attack planeswalkers you control unless/,
      /unless (?:that|their|its) controller pays/,
      /unless that player pays/,
      /spells [^.]* cost [^.]* more to cast/,
      /abilities [^.]* cost [^.]* more to activate/,
      /players can't cast more than/,
      /each player can't cast more than/,
      /opponents can't cast more than/,
      /players can't untap/,
      /doesn't untap during/,
      /enter(?:s)? the battlefield tapped/,
      /opponents' [^.]* enter the battlefield tapped/,
      /players can't /,
      /opponents can't /,
    ])
  ) {
    roles.add("tax-stax");
  }

  if (/create [^.]* tokens?/.test(text)) {
    roles.add("tokens");
  }

  if (/sacrifice (?:a|an|another|one|two|three|x|any number of)/.test(text)) {
    roles.add("sacrifice");
  }

  if (
    hasAny(text, [
      /you gain [^.]* life/,
      /gain [0-9x]+ life/,
      /each opponent loses [^.]* life/,
      /target opponent loses [^.]* life/,
      /loses life equal to/,
    ])
  ) {
    roles.add("lifegain-drain");
  }

  if (
    hasAny(text, [
      /exile target card from (?:a|that player's|an opponent's) graveyard/,
      /exile all cards from (?:all )?graveyards/,
      /exile target player's graveyard/,
      /cards? in graveyards? can't/,
      /if a card would be put into a graveyard[^.]* exile it instead/,
      /players can't cast spells from graveyards/,
      /opponents can't cast spells from graveyards/,
    ])
  ) {
    roles.add("graveyard-hate");
  }

  // Blink / flicker.
  if (
    hasAny(text, [
      /exile target [^.]* you control, then return (?:it|that card) to the battlefield/,
      /exile [^.]*, then return (?:it|that card) to the battlefield under its owner's control/,
      /exile [^.]* you control[^.]* return (?:it|them|those cards) to the battlefield/,
      /return (?:it|that card) to the battlefield at the beginning of the next end step/,
    ])
  ) {
    roles.add("blink");
  }

  // Discard / hand attack.
  if (
    hasAny(text, [
      /target (?:player|opponent) discards?/,
      /each opponent discards?/,
      /each player discards?/,
      /opponents discard/,
    ])
  ) {
    roles.add("discard");
  }

  // Mill.
  if (
    hasAny(searchable, [
      /\bmill(?:s|ed|ing)?\b/,
      /puts? the top [^.]* cards? of (?:their|his or her|that player's) library into (?:their|his or her|that player's) graveyard/,
      /put the top [^.]* cards? of your library into your graveyard/,
    ])
  ) {
    roles.add("mill");
  }

  // Conservative finisher heuristic: explicit win conditions, large evasive
  // threats, or high-impact combat closers. We deliberately avoid classifying
  // every expensive card as a finisher.
  const manaValue = card.manaValue ?? 0;
  const power = numericPower(card);
  const hasEvasion = roles.has("evasion");
  const hasDoubleStrike = /\bdouble strike\b/.test(searchable);
  const explicitWin = hasAny(text, [
    /you win the game/,
    /target player loses the game/,
    /each opponent loses the game/,
  ]);
  const massPressure = hasAny(text, [
    /each opponent loses [0-9x]+ life/,
    /deals? [0-9x]+ damage to each opponent/,
    /creatures you control get \+[0-9x]+\/\+[0-9x]+/,
    /creatures you control get \+x\/\+x/,
    /creatures you control gain double strike/,
  ]);

  if (
    explicitWin ||
    massPressure ||
    (manaValue >= 7 && hasEvasion && (power >= 5 || hasDoubleStrike)) ||
    (manaValue >= 6 && hasEvasion && hasDoubleStrike)
  ) {
    roles.add("finisher");
  }

  // Lands with no detectable utility should not make the role view noisy.
  if (roles.size === 0 && !type.includes("land")) {
    roles.add("other");
  }

  return [...roles];
}

export function cardHasRole(card: MtgCard, role: CardRole) {
  return detectCardRoles(card).includes(role);
}
