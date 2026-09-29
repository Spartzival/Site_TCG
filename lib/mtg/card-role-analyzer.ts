import type { MtgCard } from "@/types/mtg";
import {
  allCardOracleTexts,
  allCardTypeLines,
  isPureLandCard,
} from "@/lib/mtg/card-identity";

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

type FaceContext = {
  type: string;
  text: string;
  isLand: boolean;
};

function normalize(value: string | undefined) {
  return (value ?? "")
    .toLocaleLowerCase("en")
    .replace(/[’‘]/g, "'")
    .replace(/[−–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function getFaceContexts(card: MtgCard): FaceContext[] {
  if (card.faces?.length) {
    return card.faces.map((face) => {
      const type = normalize(face.typeLine);
      return {
        type,
        text: normalize(face.oracleText),
        isLand: type.includes("land"),
      };
    });
  }

  const type = normalize(card.typeLine);
  return [
    {
      type,
      text: normalize(card.oracleText),
      isLand: type.includes("land"),
    },
  ];
}

function combinedText(card: MtgCard) {
  return normalize(allCardOracleTexts(card).join("\n"));
}

function combinedTypes(card: MtgCard) {
  return normalize(allCardTypeLines(card).join(" // "));
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

function faceHasRealManaAcceleration(face: FaceContext) {
  const text = face.text;

  // Ramp that is ramp regardless of permanent type.
  if (
    hasAny(text, [
      /search your library for [^.]*lands? cards?[^.]*put [^.]* onto the battlefield/,
      /search your library for (?:a|up to [^,.]+) basic land card[^.]*put [^.]* onto the battlefield/,
      /put (?:a|up to [^,.]+) lands? cards? from your hand onto the battlefield/,
      /you may put (?:a|an) land card from your hand onto the battlefield/,
      /you may play an additional land/,
      /you may play [^.]* additional lands?/,
      /create [^.]* treasure tokens?/,
      /untap (?:up to )?[^.]* lands?/,
      /spells? you cast cost \{?[0-9x]+\}? less to cast/,
      /(?:creature|artifact|enchantment|instant|sorcery) spells? you cast cost [^.]* less to cast/,
    ])
  ) {
    return true;
  }

  const addsMana = hasAny(text, [
    /add \{[wubrgc]\}/,
    /add \{[wubrgc]\}\{[wubrgc]\}/,
    /add (?:one|two|three|four|five|six|x|an amount of) mana/,
    /add mana of any color/,
    /add [^.]* mana for each /,
    /add [^.]* mana equal to /,
  ]);

  if (!addsMana) return false;

  // A creature/artifact/enchantment/planeswalker that taps or triggers for mana
  // is acceleration. A land merely tapping for one mana is not.
  if (!face.isLand) return true;

  // Lands only count as ramp when they actually accelerate beyond a normal land.
  return hasAny(text, [
    /add \{[wubrgc]\}\{[wubrgc]\}/,
    /add (?:two|three|four|five|six|x|an amount of) mana/,
    /add [^.]* mana for each /,
    /add [^.]* mana equal to /,
    /add [^.]* plus /,
  ]);
}

function faceHasDrawOrCardAdvantage(face: FaceContext, keywords: string) {
  const text = face.text;
  const searchable = `${text} ${keywords}`;

  return hasAny(searchable, [
    /draw (?:a|one|two|three|four|five|six|seven|x|that many|cards? equal to|a number of) cards?\b/,
    /draw [0-9]+ cards?\b/,
    /draw cards? equal to/,
    /draw that many cards?/,
    /whenever [^.]*, draw (?:a|one) card/,
    /at the beginning of [^.]*, draw (?:a|one) card/,
    /look at the top [^.]* cards? of your library[^.]*put [^.]* into your hand/,
    /reveal the top [^.]* cards? of your library[^.]*put [^.]* into your hand/,
    /reveal cards? from the top of your library[^.]*put [^.]* into your hand/,
    /exile the top [^.]* cards? of your library[^.]*you may (?:play|cast)/,
    /exile [^.]* from the top of your library[^.]*you may (?:play|cast)/,
    /you may play the top card of your library/,
    /you may cast [^.]* from the top of your library/,
    /you may look at the top card of your library any time[^.]*you may (?:play|cast)/,
    /investigate\b/,
    /\bconnive\b/,
  ]);
}

function faceHasTargetedRemoval(face: FaceContext) {
  const text = face.text;
  return hasAny(text, [
    /destroy target /,
    /exile target /,
    /return target [^.]+ to (?:its|their) owner's hand/,
    /put target [^.]+ on (?:the )?(?:top|bottom) of (?:its|their) owner's library/,
    /put target [^.]+ into (?:its|their) owner's library/,
    /target creature gets -[0-9x*]+\/-[0-9x*]+/,
    /target [^.]* gets -x\/-x/,
    /deals? [^,.]+ damage to target (?:creature|planeswalker|permanent|battle)/,
    /target player sacrifices? (?:a|an) (?:creature|artifact|enchantment|permanent)/,
    /target opponent sacrifices? (?:a|an) (?:creature|artifact|enchantment|permanent)/,
    /fights? target creature/,
    /target creature [^.]* fights? /,
  ]);
}

function faceHasBoardWipe(face: FaceContext) {
  const text = face.text;
  return hasAny(text, [
    /destroy all /,
    /destroy each /,
    /exile all /,
    /exile each /,
    /return all [^.]+ to (?:their|its) owners?' hands/,
    /return each [^.]+ to (?:their|its) owners?' hands/,
    /all creatures get -[0-9x*]+\/-[0-9x*]+/,
    /each creature gets -[0-9x*]+\/-[0-9x*]+/,
    /each player sacrifices all /,
    /each player sacrifices all [^.]* creatures? they control/,
    /each opponent sacrifices all [^.]* creatures? they control/,
    /each player chooses [^.]* then sacrifices the rest/,
    /deals? [^,.]+ damage to each creature/,
    /deals? [^,.]+ damage to all creatures/,
    /for each creature[^.]*destroy /,
  ]);
}

function faceHasTutor(face: FaceContext) {
  const text = face.text;
  if (!/search your library/.test(text)) return false;

  const searchesForCard = hasAny(text, [
    /search your library for [^.]* cards?/,
    /search your library for [^.]* card/,
  ]);

  if (!searchesForCard) return false;

  // Pure land fetching belongs to Ramp rather than Tutor. Mixed searches such
  // as "artifact or land" still count as a tutor.
  const landOnly = hasAny(text, [
    /search your library for (?:a|up to [^,.]+) (?:basic )?land cards?\b/,
    /search your library for [^.]* basic land cards?\b/,
  ]) && !hasAny(text, [
    /artifact (?:or|and) land card/,
    /creature (?:or|and) land card/,
    /enchantment (?:or|and) land card/,
    /instant (?:or|and) land card/,
    /sorcery (?:or|and) land card/,
    /planeswalker (?:or|and) land card/,
    /any card/,
  ]);

  return !landOnly;
}

function faceHasRecursion(face: FaceContext) {
  const text = face.text;
  return hasAny(text, [
    /return target [^.]* from (?:your|a|an opponent's) graveyard to (?:your|its owner's|the) hand/,
    /return [^.]* from your graveyard to your hand/,
    /return [^.]* from (?:your|a) graveyard to the battlefield/,
    /put target [^.]* card from (?:a|your) graveyard onto the battlefield/,
    /put [^.]* card from your graveyard onto the battlefield/,
    /you may cast [^.]* from your graveyard/,
    /you may play [^.]* from your graveyard/,
    /cast target [^.]* card from (?:a|your) graveyard/,
    /return up to [^.]* cards? from your graveyard/,
    /return target [^.]* card from your graveyard to the battlefield/,
    /put target [^.]* card from your graveyard on top of your library/,
  ]);
}

export function detectCardRoles(card: MtgCard): CardRole[] {
  const faces = getFaceContexts(card);
  const text = combinedText(card);
  const type = combinedTypes(card);
  const keywords = cardKeywords(card);
  const searchable = `${text} ${keywords}`;
  const roles = new Set<CardRole>();

  if (faces.some(faceHasRealManaAcceleration)) {
    roles.add("ramp");
  }

  if (faces.some((face) => faceHasDrawOrCardAdvantage(face, keywords))) {
    roles.add("draw");
  }

  if (faces.some(faceHasTargetedRemoval)) {
    roles.add("removal");
  }

  if (
    faces.some(faceHasBoardWipe) ||
    (/\boverload\b/.test(keywords) && faces.some(faceHasTargetedRemoval))
  ) {
    roles.add("board-wipe");
  }

  if (faces.some(faceHasTutor)) {
    roles.add("tutor");
  }

  if (faces.some(faceHasRecursion)) {
    roles.add("recursion");
  }

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
      /other [^.]* you control (?:have|has) (?:hexproof|ward|indestructible)/,
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
      /counter that spell/,
      /counter all other spells/,
    ])
  ) {
    roles.add("counterspell");
  }

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
      /opponents'? [^.]* enter(?:s)? the battlefield tapped/,
      /artifacts and lands [^.]* enter(?:s)? the battlefield tapped/,
      /creatures [^.]* enter(?:s)? the battlefield tapped/,
      /players can't /,
      /opponents can't /,
    ])
  ) {
    roles.add("tax-stax");
  }

  if (
    hasAny(searchable, [
      /create [^.]* tokens?/,
      /\binvestigate\b/,
      /\bpopulate\b/,
      /\bamass\b/,
      /\bincubate\b/,
      /\bfabricate\b/,
    ])
  ) {
    roles.add("tokens");
  }

  if (
    hasAny(text, [
      /sacrifice (?:a|an|another|one|two|three|x|any number of)/,
      /whenever you sacrifice/,
      /whenever [^.]* sacrifices/,
      /if you sacrificed/,
      /was sacrificed this turn/,
    ])
  ) {
    roles.add("sacrifice");
  }

  if (
    hasAny(searchable, [
      /\blifelink\b/,
      /you gain [^.]* life/,
      /gain [0-9x]+ life/,
      /whenever you gain life/,
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

  if (
    hasAny(text, [
      /exile target [^.]* you control, then return (?:it|that card) to the battlefield/,
      /exile [^.]*, then return (?:it|that card) to the battlefield under its owner's control/,
      /exile [^.]* you control[^.]* return (?:it|them|those cards) to the battlefield/,
      /return (?:it|that card) to the battlefield at the beginning of the next end step/,
      /exile [^.]* you control[^.]* return [^.]* at the beginning of the next end step/,
    ])
  ) {
    roles.add("blink");
  }

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

  if (
    hasAny(searchable, [
      /\bmill(?:s|ed|ing)?\b/,
      /puts? the top [^.]* cards? of (?:their|his or her|that player's) library into (?:their|his or her|that player's) graveyard/,
      /put the top [^.]* cards? of your library into your graveyard/,
    ])
  ) {
    roles.add("mill");
  }

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
    /double the power and toughness/,
  ]);

  if (
    explicitWin ||
    massPressure ||
    (manaValue >= 7 && hasEvasion && (power >= 5 || hasDoubleStrike)) ||
    (manaValue >= 6 && hasEvasion && hasDoubleStrike)
  ) {
    roles.add("finisher");
  }

  // A MDFC spell // land must still be visible under "Other" if its spell face
  // has no detected function. Only cards whose every playable face is a land
  // are omitted from that catch-all folder.
  if (roles.size === 0 && !isPureLandCard(card)) {
    roles.add("other");
  }

  return [...roles];
}

export function cardHasRole(card: MtgCard, role: CardRole) {
  return detectCardRoles(card).includes(role);
}
