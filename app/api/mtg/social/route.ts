import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { DeckProject } from "@/types/mtg";
import type {
  MtgDeckShare,
  MtgFriend,
  MtgFriendRequest,
  MtgSocialProfile,
  MtgSocialState,
} from "@/types/social";


function socialErrorMessage(error: unknown): string {
  let message = "";

  if (error instanceof Error && error.message) {
    message = error.message;
  } else if (error && typeof error === "object" && "message" in error) {
    const value = (error as { message?: unknown }).message;
    if (typeof value === "string") message = value;
  } else if (typeof error === "string") {
    message = error;
  }

  const normalized = message.trim();

  if (
    normalized.includes("mtg_profiles") &&
    (normalized.includes("schema cache") || normalized.includes("Could not find the table"))
  ) {
    return (
      "Les tables sociales ne sont pas encore installées dans Supabase. " +
      "Exécute supabase/social_migration.sql dans Supabase > SQL Editor, puis recharge la page."
    );
  }

  return normalized || "Erreur sociale Supabase.";
}

type ProfileRow = {
  user_id: string;
  username: string;
  display_name: string | null;
};

type FriendRow = {
  friend_id: string;
  created_at: string;
};

type RequestRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
};

type ShareRow = {
  id: string;
  owner_id: string;
  recipient_id: string;
  deck_id: string;
  deck_snapshot: DeckProject;
  created_at: string;
  updated_at: string;
};

type DeckStateRow = {
  decks: DeckProject[];
};

function profileFromRow(row: ProfileRow): MtgSocialProfile {
  return {
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
  };
}

function cleanUsername(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function validateUsername(username: string) {
  if (!/^[a-z0-9_.-]{3,24}$/.test(username)) {
    return "Le pseudo doit contenir 3 à 24 caractères : lettres, chiffres, ., _ ou -.";
  }
  return null;
}

async function authenticatedUserId() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user.id;
}

async function loadProfiles(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  ids: string[],
) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, MtgSocialProfile>();
  if (uniqueIds.length === 0) return map;

  const { data, error } = await admin
    .from("mtg_profiles")
    .select("user_id, username, display_name")
    .in("user_id", uniqueIds);

  if (error) throw error;

  for (const row of (data ?? []) as ProfileRow[]) {
    map.set(row.user_id, profileFromRow(row));
  }

  return map;
}

async function buildState(userId: string): Promise<MtgSocialState> {
  const admin = createAdminSupabaseClient();

  const [profileResult, friendsResult, requestsResult, receivedResult, sentResult] =
    await Promise.all([
      admin
        .from("mtg_profiles")
        .select("user_id, username, display_name")
        .eq("user_id", userId)
        .maybeSingle(),
      admin
        .from("mtg_friendships")
        .select("friend_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      admin
        .from("mtg_friend_requests")
        .select("id, sender_id, recipient_id, status, created_at")
        .eq("status", "pending")
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .order("created_at", { ascending: false }),
      admin
        .from("mtg_deck_shares")
        .select("id, owner_id, recipient_id, deck_id, deck_snapshot, created_at, updated_at")
        .eq("recipient_id", userId)
        .order("updated_at", { ascending: false }),
      admin
        .from("mtg_deck_shares")
        .select("id, owner_id, recipient_id, deck_id, deck_snapshot, created_at, updated_at")
        .eq("owner_id", userId)
        .order("updated_at", { ascending: false }),
    ]);

  if (profileResult.error) throw profileResult.error;
  if (friendsResult.error) throw friendsResult.error;
  if (requestsResult.error) throw requestsResult.error;
  if (receivedResult.error) throw receivedResult.error;
  if (sentResult.error) throw sentResult.error;

  const friendRows = (friendsResult.data ?? []) as FriendRow[];
  const requestRows = (requestsResult.data ?? []) as RequestRow[];
  const receivedRows = (receivedResult.data ?? []) as ShareRow[];
  const sentRows = (sentResult.data ?? []) as ShareRow[];

  const profileIds = [
    ...friendRows.map((row) => row.friend_id),
    ...requestRows.flatMap((row) => [row.sender_id, row.recipient_id]),
    ...receivedRows.flatMap((row) => [row.owner_id, row.recipient_id]),
    ...sentRows.flatMap((row) => [row.owner_id, row.recipient_id]),
  ];

  const profiles = await loadProfiles(admin, profileIds);

  const fallbackProfile = (id: string): MtgSocialProfile =>
    profiles.get(id) ?? {
      userId: id,
      username: "utilisateur",
      displayName: null,
    };

  const friends: MtgFriend[] = friendRows.map((row) => ({
    ...fallbackProfile(row.friend_id),
    since: row.created_at,
  }));

  const incomingRequests: MtgFriendRequest[] = requestRows
    .filter((row) => row.recipient_id === userId)
    .map((row) => ({
      id: row.id,
      direction: "incoming",
      user: fallbackProfile(row.sender_id),
      createdAt: row.created_at,
    }));

  const outgoingRequests: MtgFriendRequest[] = requestRows
    .filter((row) => row.sender_id === userId)
    .map((row) => ({
      id: row.id,
      direction: "outgoing",
      user: fallbackProfile(row.recipient_id),
      createdAt: row.created_at,
    }));

  const makeShare = (row: ShareRow): MtgDeckShare => ({
    id: row.id,
    deckId: row.deck_id,
    deck: row.deck_snapshot,
    owner: fallbackProfile(row.owner_id),
    recipient: fallbackProfile(row.recipient_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  return {
    profile: profileResult.data
      ? profileFromRow(profileResult.data as ProfileRow)
      : null,
    friends,
    incomingRequests,
    outgoingRequests,
    sharesReceived: receivedRows.map(makeShare),
    sharesSent: sentRows.map(makeShare),
  };
}

export async function GET(request: Request) {
  const userId = await authenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim().toLowerCase() ?? "";

  try {
    if (query) {
      const admin = createAdminSupabaseClient();
      const { data, error } = await admin
        .from("mtg_profiles")
        .select("user_id, username, display_name")
        .neq("user_id", userId)
        .ilike("username", `%${query}%`)
        .limit(12);

      if (error) throw error;

      return NextResponse.json({
        users: ((data ?? []) as ProfileRow[]).map(profileFromRow),
      });
    }

    return NextResponse.json(await buildState(userId));
  } catch (error) {
    return NextResponse.json({ error: socialErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const userId = await authenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "";
  const admin = createAdminSupabaseClient();

  try {
    if (action === "save-profile") {
      const username = cleanUsername(body.username);
      const usernameError = validateUsername(username);
      if (usernameError) {
        return NextResponse.json({ error: usernameError }, { status: 400 });
      }

      const displayName =
        typeof body.displayName === "string" && body.displayName.trim()
          ? body.displayName.trim().slice(0, 40)
          : null;

      const { error } = await admin.from("mtg_profiles").upsert(
        {
          user_id: userId,
          username,
          display_name: displayName,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

      if (error) {
        if (error.code === "23505") {
          return NextResponse.json({ error: "Ce pseudo est déjà utilisé." }, { status: 409 });
        }
        throw error;
      }
    } else if (action === "friend-request") {
      const username = cleanUsername(body.username);
      if (!username) {
        return NextResponse.json({ error: "Pseudo requis." }, { status: 400 });
      }

      const { data: recipient, error: recipientError } = await admin
        .from("mtg_profiles")
        .select("user_id, username")
        .ilike("username", username)
        .maybeSingle();

      if (recipientError) throw recipientError;
      if (!recipient) {
        return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
      }

      const recipientId = (recipient as { user_id: string }).user_id;
      if (recipientId === userId) {
        return NextResponse.json({ error: "Tu ne peux pas t'ajouter toi-même." }, { status: 400 });
      }

      const { data: existingFriendship, error: friendshipError } = await admin
        .from("mtg_friendships")
        .select("friend_id")
        .eq("user_id", userId)
        .eq("friend_id", recipientId)
        .maybeSingle();

      if (friendshipError) throw friendshipError;
      if (existingFriendship) {
        return NextResponse.json({ error: "Vous êtes déjà amis." }, { status: 409 });
      }

      const [forwardRequest, reverseRequest] = await Promise.all([
        admin
          .from("mtg_friend_requests")
          .select("id")
          .eq("status", "pending")
          .eq("sender_id", userId)
          .eq("recipient_id", recipientId)
          .maybeSingle(),
        admin
          .from("mtg_friend_requests")
          .select("id")
          .eq("status", "pending")
          .eq("sender_id", recipientId)
          .eq("recipient_id", userId)
          .maybeSingle(),
      ]);

      if (forwardRequest.error) throw forwardRequest.error;
      if (reverseRequest.error) throw reverseRequest.error;
      if (forwardRequest.data || reverseRequest.data) {
        return NextResponse.json(
          { error: "Une demande d'ami existe déjà entre vous." },
          { status: 409 },
        );
      }

      const { error } = await admin.from("mtg_friend_requests").insert({
        sender_id: userId,
        recipient_id: recipientId,
        status: "pending",
      });
      if (error) throw error;
    } else if (action === "friend-response") {
      const requestId = typeof body.requestId === "string" ? body.requestId : "";
      const response = body.response === "accept" ? "accept" : body.response === "reject" ? "reject" : "";
      if (!requestId || !response) {
        return NextResponse.json({ error: "Réponse invalide." }, { status: 400 });
      }

      const { data: friendRequest, error: friendRequestError } = await admin
        .from("mtg_friend_requests")
        .select("id, sender_id, recipient_id, status")
        .eq("id", requestId)
        .maybeSingle();

      if (friendRequestError) throw friendRequestError;
      if (!friendRequest || friendRequest.recipient_id !== userId || friendRequest.status !== "pending") {
        return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
      }

      if (response === "accept") {
        const now = new Date().toISOString();
        const { error: friendshipInsertError } = await admin.from("mtg_friendships").upsert(
          [
            { user_id: userId, friend_id: friendRequest.sender_id, created_at: now },
            { user_id: friendRequest.sender_id, friend_id: userId, created_at: now },
          ],
          { onConflict: "user_id,friend_id" },
        );
        if (friendshipInsertError) throw friendshipInsertError;
      }

      const { error: updateError } = await admin
        .from("mtg_friend_requests")
        .update({
          status: response === "accept" ? "accepted" : "rejected",
          responded_at: new Date().toISOString(),
        })
        .eq("id", requestId);
      if (updateError) throw updateError;
    } else if (action === "remove-friend") {
      const friendUserId = typeof body.friendUserId === "string" ? body.friendUserId : "";
      if (!friendUserId) {
        return NextResponse.json({ error: "Ami invalide." }, { status: 400 });
      }

      const [friendshipDeleteA, friendshipDeleteB, shareDeleteA, shareDeleteB] =
        await Promise.all([
          admin
            .from("mtg_friendships")
            .delete()
            .eq("user_id", userId)
            .eq("friend_id", friendUserId),
          admin
            .from("mtg_friendships")
            .delete()
            .eq("user_id", friendUserId)
            .eq("friend_id", userId),
          admin
            .from("mtg_deck_shares")
            .delete()
            .eq("owner_id", userId)
            .eq("recipient_id", friendUserId),
          admin
            .from("mtg_deck_shares")
            .delete()
            .eq("owner_id", friendUserId)
            .eq("recipient_id", userId),
        ]);

      const deleteError =
        friendshipDeleteA.error ??
        friendshipDeleteB.error ??
        shareDeleteA.error ??
        shareDeleteB.error;
      if (deleteError) throw deleteError;
    } else if (action === "share-deck") {
      const friendUserId = typeof body.friendUserId === "string" ? body.friendUserId : "";
      const deckId = typeof body.deckId === "string" ? body.deckId : "";
      if (!friendUserId || !deckId) {
        return NextResponse.json({ error: "Deck ou ami invalide." }, { status: 400 });
      }

      const { data: friendship, error: friendshipError } = await admin
        .from("mtg_friendships")
        .select("friend_id")
        .eq("user_id", userId)
        .eq("friend_id", friendUserId)
        .maybeSingle();
      if (friendshipError) throw friendshipError;
      if (!friendship) {
        return NextResponse.json({ error: "Ce partage est réservé à tes amis." }, { status: 403 });
      }

      let deck: DeckProject | null = null;
      const bodyDeck = body.deck;

      if (
        bodyDeck &&
        typeof bodyDeck === "object" &&
        (bodyDeck as Partial<DeckProject>).id === deckId &&
        Array.isArray((bodyDeck as Partial<DeckProject>).cards) &&
        Array.isArray((bodyDeck as Partial<DeckProject>).commanders)
      ) {
        deck = bodyDeck as DeckProject;
      } else {
        const { data: deckState, error: deckStateError } = await admin
          .from("mtg_deck_state")
          .select("decks")
          .eq("user_id", userId)
          .maybeSingle();
        if (deckStateError) throw deckStateError;

        const decks = Array.isArray((deckState as DeckStateRow | null)?.decks)
          ? (deckState as DeckStateRow).decks
          : [];
        deck = decks.find((candidate) => candidate.id === deckId) ?? null;
      }

      if (!deck) {
        return NextResponse.json({ error: "Deck introuvable." }, { status: 404 });
      }

      const now = new Date().toISOString();
      const { error } = await admin.from("mtg_deck_shares").upsert(
        {
          owner_id: userId,
          recipient_id: friendUserId,
          deck_id: deckId,
          deck_snapshot: deck,
          updated_at: now,
        },
        { onConflict: "owner_id,recipient_id,deck_id" },
      );
      if (error) throw error;
    } else if (action === "unshare-deck") {
      const shareId = typeof body.shareId === "string" ? body.shareId : "";
      if (!shareId) {
        return NextResponse.json({ error: "Partage invalide." }, { status: 400 });
      }

      const { error } = await admin
        .from("mtg_deck_shares")
        .delete()
        .eq("id", shareId)
        .eq("owner_id", userId);
      if (error) throw error;
    } else {
      return NextResponse.json({ error: "Action sociale inconnue." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, state: await buildState(userId) });
  } catch (error) {
    return NextResponse.json({ error: socialErrorMessage(error) }, { status: 500 });
  }
}
