import type { CardProject } from "@/types/project";

export const projects: CardProject[] = [
  {
    id: "andemium",
    name: "Andemium of Warp",
    eyebrow: "Grimdark card game",
    description:
      "Factions, decks, balance, extensions and the complete evolution of Andemium of Warp.",
    href: "/andemium",
    status: "V1",
    meta: ["Factions", "Decks", "Balance"],
    theme: "grimdark",
    accent: {
      primary: "#b91c1c",
      secondary: "#d4af37",
      glow: "185 28 28",
    },
  },
  {
    id: "project-two",
    name: "Project II",
    eyebrow: "Dark fantasy card game",
    description:
      "An original fantasy card game of ancient realms, magic, war and rival powers.",
    href: "/project-two",
    status: "In development",
    meta: ["World", "Cards", "Rules"],
    theme: "oldworld",
    accent: {
      primary: "#b08d57",
      secondary: "#36543b",
      glow: "176 141 87",
    },
  },
  {
    id: "mtg",
    name: "Magic: The Gathering",
    eyebrow: "Deck library",
    description:
      "Commander decks, upgrades, play lines, statistics and collection notes in one place.",
    href: "/mtg",
    status: "Commander",
    meta: ["Decks", "Stats", "Collection"],
    theme: "mtg",
    accent: {
      primary: "#c98b3c",
      secondary: "#7c3aed",
      glow: "201 139 60",
    },
  },
];
