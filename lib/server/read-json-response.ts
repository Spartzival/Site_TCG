function compactPreview(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 180);
}

export async function readJsonResponse<T>(
  response: Response,
  source: string,
): Promise<T> {
  const text = await response.text();

  if (!text.trim()) {
    throw new Error(`${source} a renvoyé une réponse vide (HTTP ${response.status}).`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    const preview = compactPreview(text);
    throw new Error(
      `${source} a renvoyé une réponse non JSON (HTTP ${response.status})${
        preview ? ` : ${preview}` : ""
      }`,
    );
  }
}
