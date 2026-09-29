import { NextResponse } from "next/server";
import { readJsonResponse } from "@/lib/server/read-json-response";

const SCRYFALL_HEADERS = {
  Accept: "application/json",
  "User-Agent": "CardProjects/0.1 (personal MTG collection manager)",
};

type ScryfallCatalog = {
  data?: string[];
  details?: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json({ data: [] });
  }

  const endpoint = new URL("https://api.scryfall.com/cards/autocomplete");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("include_extras", "false");

  try {
    const response = await fetch(endpoint, {
      headers: SCRYFALL_HEADERS,
      cache: "no-store",
    });

    const payload = await readJsonResponse<ScryfallCatalog>(response, "Scryfall autocomplete");

    if (!response.ok) {
      return NextResponse.json(
        { error: payload.details ?? "Impossible de rechercher les cartes." },
        { status: response.status },
      );
    }

    return NextResponse.json({ data: payload.data ?? [] });
  } catch {
    return NextResponse.json(
      { error: "Scryfall est momentanément inaccessible." },
      { status: 502 },
    );
  }
}
