export type ParsedCollectionLine = {
  name: string;
  quantity: number;
  setCode?: string;
  collectorNumber?: string;
};

export type ParsedCollectionText = {
  entries: ParsedCollectionLine[];
  ignored: string[];
};

export function parseCollectionText(text: string): ParsedCollectionText {
  const entries: ParsedCollectionLine[] = [];
  const ignored: string[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^\/\//.test(line) || /^#/.test(line)) {
      continue;
    }

    const match = line.match(/^\s*(\d+)\s*[xX]?\s+(.+?)\s*$/);
    if (!match) {
      ignored.push(rawLine);
      continue;
    }

    const quantity = Number.parseInt(match[1], 10);
    let remainder = match[2].trim();

    if (!Number.isFinite(quantity) || quantity <= 0 || !remainder) {
      ignored.push(rawLine);
      continue;
    }

    let setCode: string | undefined;
    let collectorNumber: string | undefined;

    // Common Moxfield / Archidekt form: "Sol Ring (CMM) 396"
    const exactPrinting = remainder.match(
      /^(.*?)\s+\(([A-Za-z0-9]{2,8})\)\s+([^\s]+)\s*(?:\*F\*)?$/i,
    );

    if (exactPrinting) {
      remainder = exactPrinting[1].trim();
      setCode = exactPrinting[2].toLowerCase();
      collectorNumber = exactPrinting[3].trim();
    } else {
      // Also accepts "Sol Ring (CMM)" or "Sol Ring [CMM]".
      const setOnly = remainder.match(
        /^(.*?)\s+(?:\(([A-Za-z0-9]{2,8})\)|\[([A-Za-z0-9]{2,8})\])\s*(?:\*F\*)?$/i,
      );

      if (setOnly) {
        remainder = setOnly[1].trim();
        setCode = (setOnly[2] ?? setOnly[3])?.toLowerCase();
      } else {
        remainder = remainder.replace(/\s+\*F\*\s*$/i, "").trim();
      }
    }

    if (!remainder) {
      ignored.push(rawLine);
      continue;
    }

    entries.push({
      name: remainder,
      quantity,
      setCode,
      collectorNumber,
    });
  }

  return { entries, ignored };
}
