export type ProjectAccent = {
  primary: string;
  secondary: string;
  glow: string;
};

export type ProjectTheme = "grimdark" | "oldworld" | "mtg";

export type CardProject = {
  id: string;
  name: string;
  eyebrow: string;
  description: string;
  href: string;
  status?: string;
  meta: string[];
  accent: ProjectAccent;
  theme: ProjectTheme;
};
