export class HttpJsonError extends Error {
  status: number;
  url: string;

  constructor(message: string, status: number, url: string) {
    super(message);
    this.name = "HttpJsonError";
    this.status = status;
    this.url = url;
  }
}

function compactPreview(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 160);
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, init);
  const text = await response.text();
  const url = typeof input === "string" ? input : input.toString();

  let payload: unknown = null;

  if (text.trim()) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      const preview = compactPreview(text);
      const looksLikeHtml = /^<!doctype html|^<html/i.test(text.trim());
      throw new HttpJsonError(
        looksLikeHtml
          ? `La route API ${url} a renvoyé une page HTML au lieu de JSON.`
          : `Réponse non JSON reçue depuis ${url}${preview ? ` : ${preview}` : ""}`,
        response.status,
        url,
      );
    }
  }

  if (!response.ok) {
    const record =
      payload && typeof payload === "object"
        ? (payload as Record<string, unknown>)
        : null;

    const message =
      (typeof record?.error === "string" && record.error) ||
      (typeof record?.details === "string" && record.details) ||
      `Erreur HTTP ${response.status} (${url}).`;

    throw new HttpJsonError(message, response.status, url);
  }

  return payload as T;
}
