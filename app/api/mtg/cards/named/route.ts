import { NextResponse } from "next/server";
import { readJsonResponse } from "@/lib/server/read-json-response";
import {
  normalizeScryfallCard,
  SCRYFALL_HEADERS,
  type ScryfallCard,
} from "@/lib/mtg/scryfall";

async function fetchNamed(name: string, mode: "exact" | "fuzzy") {
  const endpoint = new URL("https://api.scryfall.com/cards/named");
  endpoint.searchParams.set(mode, name);

  const response = await fetch(endpoint, {
    headers: SCRYFALL_HEADERS,
    cache: "no-store",
  });

  const payload = await readJsonResponse<ScryfallCard>(
    response,
    `Scryfall named card (${mode})`,
  );

  return { response, payload };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name")?.trim() ?? "";

  if (!name) {
    return NextResponse.json(
      { error: "Le nom de la carte est requis." },
      { status: 400 },
    );
  }

  try {
    let result = await fetchNamed(name, "exact");

    /*
     * Face-only names from DFC / Adventure / split cards are not always an
     * exact top-level Scryfall card name. Fuzzy lookup resolves them back to
     * the single physical card object instead of treating a face as another
     * deck card.
     */
    if (!result.response.ok) {
      result = await fetchNamed(name, "fuzzy");
    }

    if (!result.response.ok) {
      return NextResponse.json(
        { error: result.payload.details ?? "Carte introuvable." },
        { status: result.response.status },
      );
    }

    return NextResponse.json({ card: normalizeScryfallCard(result.payload) });
  } catch {
    return NextResponse.json(
      { error: "Scryfall est momentanément inaccessible." },
      { status: 502 },
    );
  }
}
