import type { CollectionCard } from "@/types/mtg";
import { queueCollectionCloudSync } from "@/lib/mtg/cloud-storage";
import { isGuestMode } from "@/lib/mtg/storage-mode";

const STORAGE_KEY_V2 = "card-projects:mtg-collection:v2";
const STORAGE_KEY_V1 = "card-projects:mtg-collection:v1";

type LegacyCollectionCard = {
  card: CollectionCard["card"];
  quantity: number;
};

function isCollectionCard(value: unknown): value is CollectionCard {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CollectionCard>;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.quantity === "number" &&
    Array.isArray(item.printings) &&
    !!item.card
  );
}

function migrateLegacyCollection(items: LegacyCollectionCard[]): CollectionCard[] {
  return items
    .filter(
      (item) =>
        item &&
        typeof item.quantity === "number" &&
        item.card &&
        typeof item.card.name === "string",
    )
    .map((item) => {
      const id = item.card.oracleId ?? item.card.id;
      return {
        id,
        name: item.card.name,
        card: item.card,
        quantity: item.quantity,
        printings: [{ card: item.card, quantity: item.quantity }],
      };
    });
}

export function loadCollection(): CollectionCard[] {
  if (typeof window === "undefined") return [];

  try {
    const rawV2 = window.localStorage.getItem(STORAGE_KEY_V2);
    if (rawV2) {
      const parsed = JSON.parse(rawV2) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter(isCollectionCard);
      }
    }

    const rawV1 = window.localStorage.getItem(STORAGE_KEY_V1);
    if (!rawV1) return [];

    const parsedV1 = JSON.parse(rawV1) as LegacyCollectionCard[];
    if (!Array.isArray(parsedV1)) return [];

    const migrated = migrateLegacyCollection(parsedV1);
    writeCollectionCache(migrated);
    return migrated;
  } catch {
    return [];
  }
}

export function writeCollectionCache(collection: CollectionCard[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(collection));
}

export function clearCollectionCache() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY_V2);
  window.localStorage.removeItem(STORAGE_KEY_V1);
}

export function saveCollection(collection: CollectionCard[]) {
  writeCollectionCache(collection);
  if (!isGuestMode()) {
    queueCollectionCloudSync(collection);
  }
}
