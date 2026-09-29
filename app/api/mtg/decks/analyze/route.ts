import { NextResponse } from "next/server";
import { readJsonResponse } from "@/lib/server/read-json-response";
import { detectOfficialGameChangers } from "@/lib/mtg/game-changers";
import type {
  CommanderBracket,
  DeckRemoteAnalysis,
  SpellbookBracketFindings,
  SpellbookCombo,
} from "@/types/mtg";

const SPELLBOOK_BASE = "https://backend.commanderspellbook.com";

type AnalyzeRequest = {
  commanders?: { card: string; quantity: number }[];
  main?: { card: string; quantity: number }[];
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(record: UnknownRecord | null, ...keys: string[]) {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function readCardName(value: unknown): string | null {
  if (typeof value === "string") return value;
  const record = asRecord(value);
  if (!record) return null;

  const direct = readString(record, "name", "cardName", "card");
  if (direct && direct !== "[object Object]") return direct;

  const nestedCard = asRecord(record.card);
  return readString(nestedCard, "name") ?? null;
}

function extractCardNames(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return Array.from(
      new Set(value.flatMap((item) => extractCardNames(item)).filter(Boolean)),
    );
  }

  const record = asRecord(value);
  if (!record) return [];

  const ownName = readCardName(record);
  if (ownName) return [ownName];

  for (const key of ["cards", "uses", "data", "results", "items"]) {
    if (key in record) {
      const names = extractCardNames(record[key]);
      if (names.length) return names;
    }
  }

  return [];
}


function extractTextLines(value: unknown): string[] {
  if (!value) return [];

  if (typeof value === "string") {
    return value
      .split(/\r?\n|\s*\d+[.)]\s+/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractTextLines(item));
  }

  const record = asRecord(value);
  if (!record) return [];

  const direct = readString(record, "text", "description", "instruction", "name");
  if (direct) return [direct];

  for (const key of ["steps", "prerequisites", "results", "data", "items"]) {
    if (key in record) {
      const lines = extractTextLines(record[key]);
      if (lines.length) return lines;
    }
  }

  return [];
}

function normalizeCombo(value: unknown, fallbackId: string): SpellbookCombo {
  const record = asRecord(value);
  const uses = asArray(record?.uses);

  const cards = uses.length
    ? uses
        .map((use) => {
          const useRecord = asRecord(use);
          const cardRecord = asRecord(useRecord?.card);
          const name = readString(cardRecord, "name") ?? readCardName(use);
          if (!name) return null;
          const quantity =
            typeof useRecord?.quantity === "number" ? useRecord.quantity : undefined;
          const mustBeCommander =
            typeof useRecord?.mustBeCommander === "boolean"
              ? useRecord.mustBeCommander
              : undefined;
          return { name, quantity, mustBeCommander };
        })
        .filter((card): card is NonNullable<typeof card> => Boolean(card))
    : extractCardNames(record?.cards ?? record).map((name) => ({ name }));

  const produces = asArray(record?.produces)
    .map((item) => {
      const itemRecord = asRecord(item);
      const feature = asRecord(itemRecord?.feature);
      return readString(feature, "name") ?? readString(itemRecord, "name");
    })
    .filter((name): name is string => Boolean(name));

  const missingCards = extractCardNames(
    record?.missingCards ??
      record?.missing_cards ??
      record?.missing ??
      record?.needed ??
      record?.requiresCards,
  );

  const steps = extractTextLines(record?.steps);
  const prerequisites = extractTextLines(record?.prerequisites);
  const description = readString(record, "description");

  return {
    id: readString(record, "id", "variantId", "variant_id") ?? fallbackId,
    cards,
    produces,
    description,
    steps: steps.length ? steps : description ? extractTextLines(description) : [],
    prerequisites,
    easyPrerequisites: readString(record, "easyPrerequisites", "easy_prerequisites"),
    notablePrerequisites: readString(
      record,
      "notablePrerequisites",
      "notable_prerequisites",
    ),
    bracketTag: readString(record, "bracketTag", "bracket_tag"),
    missingCards,
  };
}

function normalizeComboList(value: unknown, prefix: string): SpellbookCombo[] {
  const raw = Array.isArray(value)
    ? value
    : asArray(asRecord(value)?.results ?? asRecord(value)?.data);

  return raw.map((item, index) => normalizeCombo(item, `${prefix}-${index}`));
}

function namesFromField(record: UnknownRecord | null, ...keys: string[]) {
  if (!record) return [];
  for (const key of keys) {
    if (key in record) return extractCardNames(record[key]);
  }
  return [];
}

function mapBracketTag(tag?: string): CommanderBracket | null {
  if (!tag) return null;
  const normalized = tag.trim().toLocaleLowerCase("en");

  const numeric = normalized.match(/[1-5]/)?.[0];
  if (numeric) return Number(numeric) as CommanderBracket;

  // Commander Spellbook has historically exposed both human-readable buckets
  // and compact tags. Keep this mapping intentionally conservative.
  if (normalized.includes("ruthless") || normalized.includes("optimized")) return 4;
  if (
    normalized.includes("spicy") ||
    normalized.includes("powerful") ||
    normalized.includes("upgraded")
  ) {
    return 3;
  }
  if (
    normalized.includes("precon") ||
    normalized.includes("core") ||
    normalized.includes("oddball")
  ) {
    return 2;
  }
  if (normalized.includes("casual") || normalized.includes("exhibition")) return 1;

  return null;
}

function buildFindings(raw: unknown): SpellbookBracketFindings {
  const record = asRecord(raw);
  return {
    bracketTag: readString(record, "bracketTag", "bracket_tag"),
    bannedCards: namesFromField(record, "bannedCards", "banned_cards"),
    gameChangerCards: namesFromField(record, "gameChangerCards", "game_changer_cards"),
    massLandDenialCards: namesFromField(
      record,
      "massLandDenialCards",
      "mass_land_denial_cards",
    ),
    extraTurnCards: namesFromField(record, "extraTurnCards", "extra_turn_cards"),
    twoCardCombos: normalizeComboList(
      record?.twoCardCombos ?? record?.two_card_combos,
      "two-card",
    ),
    lockCombos: normalizeComboList(record?.lockCombos ?? record?.lock_combos, "lock"),
  };
}

function extractFindMyCombos(raw: unknown) {
  const record = asRecord(raw);
  const resultRecord = asRecord(record?.results) ?? record;

  return {
    included: normalizeComboList(
      resultRecord?.included ?? resultRecord?.includedCombos ?? resultRecord?.included_combos,
      "included",
    ),
    almostIncluded: normalizeComboList(
      resultRecord?.almostIncluded ??
        resultRecord?.almost_included ??
        resultRecord?.almostIncludedCombos,
      "almost",
    ),
  };
}

function minimumBracket(findings: SpellbookBracketFindings): CommanderBracket {
  if (findings.massLandDenialCards.length > 0) return 4;
  if (findings.gameChangerCards.length > 3) return 4;
  if (findings.twoCardCombos.length > 0) return 4;
  if (findings.lockCombos.length > 0) return 4;
  if (findings.gameChangerCards.length > 0) return 3;
  if (findings.extraTurnCards.length > 0) return 2;
  return 2;
}

function bracketName(bracket: CommanderBracket) {
  return (
    {
      1: "Exhibition",
      2: "Core",
      3: "Upgraded",
      4: "Optimized",
      5: "cEDH",
    } as const
  )[bracket];
}

async function spellbookPost(path: string, body: AnalyzeRequest) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(`${SPELLBOOK_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });

    const payload = await readJsonResponse<unknown>(response, "Commander Spellbook");
    if (!response.ok) throw new Error(`Commander Spellbook HTTP ${response.status}`);
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  let body: AnalyzeRequest;

  try {
    body = (await request.json()) as AnalyzeRequest;
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const commanders = (body.commanders ?? []).filter((entry) => entry.card.trim());
  const main = (body.main ?? []).filter((entry) => entry.card.trim());

  if (commanders.length === 0) {
    return NextResponse.json({ error: "Un commandant est requis." }, { status: 400 });
  }

  const payload = { commanders, main };
  const locallyDetectedGameChangers = detectOfficialGameChangers([
    ...commanders.map((entry) => entry.card),
    ...main.map((entry) => entry.card),
  ]);

  try {
    const [bracketRaw, combosRaw] = await Promise.all([
      spellbookPost("/estimate-bracket", payload),
      spellbookPost("/find-my-combos", payload),
    ]);

    const findings = buildFindings(bracketRaw);
    findings.gameChangerCards = Array.from(
      new Set([...findings.gameChangerCards, ...locallyDetectedGameChangers]),
    );
    const combos = extractFindMyCombos(combosRaw);
    const minimum = minimumBracket(findings);
    const apiBracket = mapBracketTag(findings.bracketTag);
    const estimated = Math.max(apiBracket ?? minimum, minimum) as CommanderBracket;

    const reasons: string[] = [];
    if (findings.gameChangerCards.length) {
      reasons.push(`${findings.gameChangerCards.length} Game Changer(s) détecté(s)`);
    }
    if (findings.twoCardCombos.length) {
      reasons.push(`${findings.twoCardCombos.length} combo(s) à deux cartes signalée(s)`);
    }
    if (findings.massLandDenialCards.length) {
      reasons.push("Mass land denial détecté");
    }
    if (findings.lockCombos.length) reasons.push("Lock combo détectée");
    if (findings.extraTurnCards.length) {
      reasons.push(`${findings.extraTurnCards.length} carte(s) d'extra turn détectée(s)`);
    }
    if (!reasons.length) reasons.push("Aucun marqueur imposant un bracket supérieur détecté");

    const result: DeckRemoteAnalysis = {
      available: true,
      estimatedBracket: estimated,
      minimumBracket: minimum,
      bracketLabel: bracketName(estimated),
      bracketReason: reasons,
      findings,
      includedCombos: combos.included,
      almostIncludedCombos: combos.almostIncluded,
    };

    return NextResponse.json(result);
  } catch (error) {
    const fallbackFindings: SpellbookBracketFindings = {
      bannedCards: [],
      gameChangerCards: locallyDetectedGameChangers,
      massLandDenialCards: [],
      extraTurnCards: [],
      twoCardCombos: [],
      lockCombos: [],
    };
    const fallbackMinimum = minimumBracket(fallbackFindings);
    const fallbackReasons = locallyDetectedGameChangers.length
      ? [`${locallyDetectedGameChangers.length} Game Changer(s) officiel(s) détecté(s)`]
      : [];

    const result: DeckRemoteAnalysis = {
      available: false,
      estimatedBracket: fallbackMinimum,
      minimumBracket: fallbackMinimum,
      bracketLabel: bracketName(fallbackMinimum),
      bracketReason: fallbackReasons,
      findings: fallbackFindings,
      includedCombos: [],
      almostIncludedCombos: [],
      error: error instanceof Error ? error.message : "Commander Spellbook indisponible.",
    };

    return NextResponse.json(result, { status: 200 });
  }
}
