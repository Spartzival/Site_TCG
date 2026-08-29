import type { CollectionCard, DeckProject } from "@/types/mtg";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export type CloudState = {
  collection: CollectionCard[] | null;
  decks: DeckProject[] | null;
};

async function currentUserId() {
  if (!isSupabaseConfigured()) return null;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id ?? null;
}

export async function loadCloudState(): Promise<CloudState> {
  if (!isSupabaseConfigured()) {
    return { collection: null, decks: null };
  }

  const userId = await currentUserId();
  if (!userId) {
    return { collection: null, decks: null };
  }

  const supabase = createClient();

  const [collectionResult, deckResult] = await Promise.all([
    supabase
      .from("mtg_collection_state")
      .select("collection")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("mtg_deck_state")
      .select("decks")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (collectionResult.error) throw collectionResult.error;
  if (deckResult.error) throw deckResult.error;

  return {
    collection: Array.isArray(collectionResult.data?.collection)
      ? (collectionResult.data.collection as CollectionCard[])
      : null,
    decks: Array.isArray(deckResult.data?.decks)
      ? (deckResult.data.decks as DeckProject[])
      : null,
  };
}

export async function saveCollectionToCloud(collection: CollectionCard[]) {
  if (!isSupabaseConfigured()) return;

  const userId = await currentUserId();
  if (!userId) return;

  const supabase = createClient();
  const { error } = await supabase.from("mtg_collection_state").upsert(
    {
      user_id: userId,
      collection,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;
}

export async function saveDecksToCloud(decks: DeckProject[]) {
  if (!isSupabaseConfigured()) return;

  const userId = await currentUserId();
  if (!userId) return;

  const supabase = createClient();
  const { error } = await supabase.from("mtg_deck_state").upsert(
    {
      user_id: userId,
      decks,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;
}

let collectionSyncQueue = Promise.resolve();
let deckSyncQueue = Promise.resolve();

export function queueCollectionCloudSync(collection: CollectionCard[]) {
  const snapshot = structuredClone(collection);

  collectionSyncQueue = collectionSyncQueue
    .catch(() => undefined)
    .then(() => saveCollectionToCloud(snapshot))
    .catch((error) => {
      console.warn("Échec de synchronisation de la collection Supabase :", error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? error));
    });
}

export function queueDeckCloudSync(decks: DeckProject[]) {
  const snapshot = structuredClone(decks);

  deckSyncQueue = deckSyncQueue
    .catch(() => undefined)
    .then(() => saveDecksToCloud(snapshot))
    .catch((error) => {
      console.warn("Échec de synchronisation des decks Supabase :", error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? error));
    });
}
