import type { DeckProject } from "@/types/mtg";

export type MtgSocialProfile = {
  userId: string;
  username: string;
  displayName?: string | null;
};

export type MtgFriend = MtgSocialProfile & {
  since: string;
};

export type MtgFriendRequest = {
  id: string;
  direction: "incoming" | "outgoing";
  user: MtgSocialProfile;
  createdAt: string;
};

export type MtgDeckShare = {
  id: string;
  deckId: string;
  deck: DeckProject;
  owner: MtgSocialProfile;
  recipient: MtgSocialProfile;
  createdAt: string;
  updatedAt: string;
};

export type MtgSocialState = {
  profile: MtgSocialProfile | null;
  friends: MtgFriend[];
  incomingRequests: MtgFriendRequest[];
  outgoingRequests: MtgFriendRequest[];
  sharesReceived: MtgDeckShare[];
  sharesSent: MtgDeckShare[];
};
