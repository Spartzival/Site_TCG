import type { DeckProject } from "@/types/mtg";
import { queueDeckCloudSync } from "@/lib/mtg/cloud-storage";
import { isGuestMode } from "@/lib/mtg/storage-mode";

const STORAGE_KEY = "card-projects:mtg-deck-projects:v1";

function isDeckProject(value: unknown): value is DeckProject {
  if (!value || typeof value !== "object") return false;
  const deck = value as Partial<DeckProject>;
  return (
    typeof deck.id === "string" &&
    typeof deck.name === "string" &&
    typeof deck.slug === "string" &&
    (deck.status === "building" ||
      deck.status === "active" ||
      deck.status === "archived") &&
    Array.isArray(deck.commanders) &&
    Array.isArray(deck.cards)
  );
}

export function loadDeckProjects(): DeckProject[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isDeckProject) : [];
  } catch {
    return [];
  }
}

export function writeDeckProjectsCache(projects: DeckProject[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function clearDeckProjectsCache() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function saveDeckProjects(projects: DeckProject[]) {
  writeDeckProjectsCache(projects);
  if (!isGuestMode()) {
    queueDeckCloudSync(projects);
  }
}

export function slugifyDeckName(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("en")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "deck"
  );
}
