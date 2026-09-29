export type ParsedDeckLine = {
  name: string;
  quantity: number;
  section: "commander" | "mainboard" | "sideboard" | "maybeboard";
};

export type ParsedDeckText = {
  entries: ParsedDeckLine[];
  ignored: string[];
};

const SECTION_ALIASES: Record<string, ParsedDeckLine["section"]> = {
  commander: "commander",
  commanders: "commander",
  commandant: "commander",
  commandants: "commander",
  main: "mainboard",
  mainboard: "mainboard",
  deck: "mainboard",
  decklist: "mainboard",
  sideboard: "sideboard",
  side: "sideboard",
  maybeboard: "maybeboard",
  maybe: "maybeboard",
  considering: "maybeboard",
};

function cleanHeader(line: string) {
  return line
    .replace(/^\s*\/\/\s*/, "")
    .replace(/^\s*#+\s*/, "")
    .replace(/^\s*\[|\]\s*$/g, "")
    .trim()
    .toLocaleLowerCase("en");
}

export function parseDeckText(text: string): ParsedDeckText {
  const entries: ParsedDeckLine[] = [];
  const ignored: string[] = [];
  let section: ParsedDeckLine["section"] = "mainboard";

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const header = cleanHeader(line.replace(/:$/, ""));
    if (SECTION_ALIASES[header]) {
      section = SECTION_ALIASES[header];
      continue;
    }

    if (/^\/\//.test(line) || /^#/.test(line)) {
      ignored.push(rawLine);
      continue;
    }

    // Accepts: "1 Sol Ring", "1x Sol Ring", "2X Sol Ring".
    const match = line.match(/^\s*(\d+)\s*[xX]?\s+(.+?)\s*$/);
    if (!match) {
      ignored.push(rawLine);
      continue;
    }

    const quantity = Number.parseInt(match[1], 10);
    let name = match[2].trim();

    // Common export suffixes: "(SET) 123", "[SET]", foil markers.
    name = name
      .replace(/\s+\([A-Za-z0-9]{2,8}\)\s+\S+\s*$/, "")
      .replace(/\s+\[[A-Za-z0-9]{2,8}\]\s*$/, "")
      .replace(/\s+\*F\*\s*$/i, "")
      .trim();

    if (!name || !Number.isFinite(quantity) || quantity <= 0) {
      ignored.push(rawLine);
      continue;
    }

    entries.push({ name, quantity, section });
  }

  return { entries, ignored };
}
