import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Card Projects",
  description: "A personal hub for card-game projects, decks and experiments.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
