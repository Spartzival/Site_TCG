import { NextResponse } from "next/server";
import { readJsonResponse } from "@/lib/server/read-json-response";
import type { MtgCard } from "@/types/mtg";
import {
  normalizeScryfallCard,
  SCRYFALL_HEADERS,
  type ScryfallCard,
} from "@/lib/mtg/scryfall";

type ScryfallList = {
  data?: ScryfallCard[];
  has_more?: boolean;
  next_page?: string;
  details?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name")?.trim() ?? "";
  const oracleId = searchParams.get("oracleId")?.trim() ?? "";

  if (!name && !oracleId) {
    return NextResponse.json(
      { error: "Le nom ou l’identifiant Oracle de la carte est requis." },
      { status: 400 },
    );
  }

  const escapedName = name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const endpoint = new URL("https://api.scryfall.com/cards/search");
  endpoint.searchParams.set(
    "q",
    oracleId ? `oracleid:${oracleId} game:paper` : `!"${escapedName}" game:paper`,
  );
  endpoint.searchParams.set("unique", "prints");
  endpoint.searchParams.set("order", "released");
  endpoint.searchParams.set("dir", "desc");

  try {
    const cards: MtgCard[] = [];
    let nextUrl: string | null = endpoint.toString();

    while (nextUrl) {
      const response = await fetch(nextUrl, {
        headers: SCRYFALL_HEADERS,
        cache: "no-store",
      });

      const payload = await readJsonResponse<ScryfallList>(response, "Scryfall prints");

      if (!response.ok) {
        return NextResponse.json(
          { error: payload.details ?? "Impossible de récupérer les versions." },
          { status: response.status },
        );
      }

      cards.push(...(payload.data ?? []).map(normalizeScryfallCard));

      if (payload.has_more && payload.next_page) {
        nextUrl = payload.next_page;
        await sleep(110);
      } else {
        nextUrl = null;
      }
    }

    return NextResponse.json({ cards });
  } catch {
    return NextResponse.json(
      { error: "Scryfall est momentanément inaccessible." },
      { status: 502 },
    );
  }
}
