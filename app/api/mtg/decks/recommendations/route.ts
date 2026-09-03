import { NextResponse } from "next/server";
import { readJsonResponse } from "@/lib/server/read-json-response";
import { detectCardRoles, type CardRole } from "@/lib/mtg/card-role-analyzer";
import { detectOfficialGameChangers } from "@/lib/mtg/game-changers";
import {
  normalizeScryfallCard,
  SCRYFALL_HEADERS,
  type ScryfallCard,
} from "@/lib/mtg/scryfall";
import type {
  CommanderBracket,
  DeckCardSuggestion,
  DeckRecommendations,
  MtgCard,
} from "@/types/mtg";

type RoleNeed = {
  role: CardRole;
  label: string;
  count: number;
  target: number;
};

type RecommendationRequest = {
  commander?: Pick<
    MtgCard,
    "name" | "oracleText" | "typeLine" | "colorIdentity" | "keywords" | "faces"
  >;
  deckCardNames?: string[];
  roleNeeds?: RoleNeed[];
  bracket?: CommanderBracket | null;
  gameChangerCount?: number;
};

type ScryfallSearchPayload = {
  data?: ScryfallCard[];
  details?: string;
};

type QuerySpec = {
  query: string;
  kind: "commander-synergy" | "role-gap" | "staple";
  reason: string;
  bonus: number;
};

type Candidate = {
  card: MtgCard;
  score: number;
  kinds: Set<DeckCardSuggestion["kinds"][number]>;
  reasons: Set<string>;
};

const ROLE_QUERIES: Partial<Record<CardRole, string>> = {
  ramp: '(o:"add " OR o:"Treasure token" OR o:"additional land")',
  draw: '(o:"draw a card" OR o:"draw two cards" OR o:"draw cards")',
  removal: '(o:"destroy target" OR o:"exile target")',
  "board-wipe": '(o:"destroy all" OR o:"exile all" OR o:"each creature gets -")',
  recursion: '(o:"from your graveyard" OR o:"from a graveyard")',
  protection: '(o:hexproof OR o:indestructible OR o:ward OR o:"phase out")',
  counterspell: 'o:"counter target"',
  tokens: 'o:"create" o:token',
  sacrifice: 'o:sacrifice',
  "lifegain-drain": '(o:"gain life" OR o:"loses life")',
  "graveyard-hate": '(o:"exile" o:graveyard)',
  blink: '(o:"exile" o:"return" o:"battlefield")',
  discard: 'o:discard',
  mill: 'o:mill',
  evasion: '(o:flying OR o:menace OR o:trample OR o:"can\'t be blocked")',
  "tax-stax": '(o:"unless" o:"pays" OR o:"can\'t" OR o:"cost" o:"more")',
  finisher: '(o:"you win the game" OR o:"each opponent" OR o:"double strike")',
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeText(value: string | undefined) {
  return (value ?? "").toLocaleLowerCase("en");
}

function identityQuery(identity: string[]) {
  const colors = Array.from(new Set(identity)).join("").toLowerCase();
  return colors ? `id<=${colors}` : "id:c";
}

function buildSynergyQueries(commander: NonNullable<RecommendationRequest["commander"]>) {
  const text = normalizeText(
    [commander.oracleText, ...(commander.faces?.map((face) => face.oracleText) ?? [])]
      .filter(Boolean)
      .join(" "),
  );
  const type = normalizeText(commander.typeLine);
  const specs: QuerySpec[] = [];

  const add = (query: string, reason: string, bonus = 48) => {
    if (!specs.some((spec) => spec.query === query)) {
      specs.push({ query, kind: "commander-synergy", reason, bonus });
    }
  };

  if (text.includes("token")) add('o:token', "Le commandant interagit avec les jetons.");
  if (text.includes("treasure")) add('o:"Treasure token"', "Le commandant valorise les Trésors.");
  if (text.includes("food")) add('o:"Food token"', "Le commandant valorise les Food.");
  if (text.includes("clue")) add('o:"Clue token"', "Le commandant valorise les Clues.");
  if (text.includes("+1/+1 counter") || text.includes("counter on")) {
    add('o:"+1/+1 counter"', "Le commandant joue autour des marqueurs +1/+1.");
  } else if (text.includes("counter")) {
    add('o:counter', "Le commandant utilise des marqueurs.");
  }
  if (text.includes("graveyard")) add('o:graveyard', "Le cimetière fait partie du plan du commandant.");
  if (text.includes("sacrifice")) add('o:sacrifice', "Le commandant récompense les sacrifices.");
  if (text.includes("gain life") || text.includes("life total")) {
    add('(o:"gain life" OR o:"lifelink")', "Le commandant profite du gain de vie.");
  }
  if (text.includes("loses life") || text.includes("lose life")) {
    add('o:"loses life"', "Le commandant profite de la perte de vie adverse.");
  }
  if (text.includes("artifact") || type.includes("artifact")) {
    add('(t:artifact OR o:artifact)', "Le commandant a une synergie artefacts.");
  }
  if (text.includes("enchantment") || type.includes("enchantment")) {
    add('(t:enchantment OR o:enchantment)', "Le commandant a une synergie enchantements.");
  }
  if (text.includes("equipment")) add('t:equipment', "Le commandant a une synergie Équipement.");
  if (text.includes("aura")) add('t:aura', "Le commandant a une synergie Aura.");
  if (text.includes("attack") || text.includes("combat damage")) {
    add('(o:"whenever" o:"attack" OR o:"combat damage")', "Le commandant est orienté combat/attaque.");
  }
  if (text.includes("instant") || text.includes("sorcery")) {
    add('(t:instant OR t:sorcery)', "Le commandant récompense les éphémères et rituels.");
  }
  if (text.includes("draw") || text.includes("card in your hand")) {
    add('o:"draw"', "Le commandant s\'appuie sur la pioche ou la main.");
  }
  if (text.includes("discard")) add('o:discard', "Le commandant exploite la défausse.");
  if (text.includes("exile") && text.includes("return") && text.includes("battlefield")) {
    add('(o:"exile" o:"return" o:"battlefield")', "Le commandant s\'intègre à un plan blink/flicker.");
  }

  const subtypeText = commander.typeLine?.split("—")[1]?.trim();
  const subtype = subtypeText?.split(/\s+/)[0]?.replace(/[^A-Za-z'-]/g, "");
  if (subtype && subtype.length > 2 && !["background", "vehicle", "spacecraft"].includes(subtype.toLowerCase())) {
    add(`t:"${subtype}"`, `Synergie tribale avec le type ${subtype}.`, 38);
  }

  return specs.slice(0, 3);
}

async function searchCards(base: string, spec: QuerySpec): Promise<MtgCard[]> {
  const endpoint = new URL("https://api.scryfall.com/cards/search");
  endpoint.searchParams.set("q", `${base} ${spec.query}`);
  endpoint.searchParams.set("unique", "cards");
  endpoint.searchParams.set("order", "edhrec");
  endpoint.searchParams.set("dir", "asc");

  const response: Response = await fetch(endpoint, {
    headers: SCRYFALL_HEADERS,
    cache: "no-store",
  });
  const payload = await readJsonResponse<ScryfallSearchPayload>(response, "Scryfall recommendations");
  if (!response.ok) throw new Error(payload.details ?? `Scryfall HTTP ${response.status}`);
  return (payload.data ?? []).slice(0, 35).map(normalizeScryfallCard);
}

export async function POST(request: Request) {
  let body: RecommendationRequest;
  try {
    body = (await request.json()) as RecommendationRequest;
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  if (!body.commander?.name) {
    return NextResponse.json({ available: true, suggestions: [] } satisfies DeckRecommendations);
  }

  const commander = body.commander;
  const deckNames = new Set(
    [commander.name, ...(body.deckCardNames ?? [])].map((name) => name.toLocaleLowerCase("en")),
  );
  const base = `legal:commander game:paper -is:funny ${identityQuery(commander.colorIdentity ?? [])}`;
  const needs = [...(body.roleNeeds ?? [])]
    .filter((need) => need.count < need.target && ROLE_QUERIES[need.role])
    .sort((a, b) => (b.target - b.count) - (a.target - a.count));

  const rawSpecs: QuerySpec[] = [
    {
      query: "-t:land",
      kind: "staple",
      reason: "Carte fréquemment jouée en Commander dans cette identité couleur.",
      bonus: 12,
    },
    ...buildSynergyQueries(commander),
    ...needs.slice(0, 2).map<QuerySpec>((need) => ({
      query: ROLE_QUERIES[need.role]!,
      kind: "role-gap",
      reason: `Ton deck n'a que ${need.count}/${need.target} source(s) de ${need.label.toLocaleLowerCase("fr")}.`,
      bonus: 42 + Math.min(18, (need.target - need.count) * 3),
    })),
  ];
  const specs = rawSpecs.slice(0, 6);

  const candidates = new Map<string, Candidate>();

  try {
    for (let queryIndex = 0; queryIndex < specs.length; queryIndex += 1) {
      const spec = specs[queryIndex];
      const cards = await searchCards(base, spec);

      cards.forEach((card, index) => {
        if (deckNames.has(card.name.toLocaleLowerCase("en"))) return;
        if (card.legalities?.commander && card.legalities.commander !== "legal") return;

        const id = card.oracleId ?? card.id;
        const existing = candidates.get(id) ?? {
          card,
          score: 0,
          kinds: new Set<DeckCardSuggestion["kinds"][number]>(),
          reasons: new Set<string>(),
        };

        existing.score += spec.bonus + Math.max(0, 26 - index);
        existing.kinds.add(spec.kind);
        existing.reasons.add(spec.reason);
        candidates.set(id, existing);
      });

      if (queryIndex < specs.length - 1) await sleep(115);
    }

    const bracket = body.bracket ?? 2;
    const currentGameChangers = body.gameChangerCount ?? 0;

    const suggestions: DeckCardSuggestion[] = Array.from(candidates.values())
      .map((candidate) => {
        const roles = detectCardRoles(candidate.card);
        const matchingNeeds = needs.filter((need) => roles.includes(need.role));
        for (const need of matchingNeeds) {
          candidate.score += 18;
          candidate.kinds.add("role-gap");
          candidate.reasons.add(
            `Renforce ${need.label} (${need.count}/${need.target} actuellement).`,
          );
        }

        const isGameChanger = detectOfficialGameChangers([candidate.card.name]).length > 0;
        if (isGameChanger) candidate.score -= bracket <= 3 ? 18 : 0;

        return {
          card: candidate.card,
          score: candidate.score,
          kinds: Array.from(candidate.kinds),
          reasons: Array.from(candidate.reasons).slice(0, 3),
          roles,
          isGameChanger,
        };
      })
      .filter((suggestion) => {
        if (!suggestion.isGameChanger) return true;
        if (bracket <= 2) return false;
        if (bracket === 3 && currentGameChangers >= 3) return false;
        return true;
      })
      .sort((a, b) => b.score - a.score || a.card.name.localeCompare(b.card.name))
      .slice(0, 18);

    return NextResponse.json({ available: true, suggestions } satisfies DeckRecommendations);
  } catch (error) {
    return NextResponse.json(
      {
        available: false,
        suggestions: [],
        error: error instanceof Error ? error.message : "Suggestions indisponibles.",
      } satisfies DeckRecommendations,
      { status: 200 },
    );
  }
}
