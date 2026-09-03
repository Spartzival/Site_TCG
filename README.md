# Card Projects

Projet Next.js / TypeScript regroupant plusieurs projets de jeux de cartes.

## État actuel

### Accueil
- 3 panneaux plein écran.
- Andemium : thème grimdark sci-fi.
- Projet II : thème dark fantasy.
- Magic: The Gathering : thème arcane.
- Hover dynamique.
- Transition/zoom cinématique au clic avant navigation.

### MTG
Dashboard `/mtg` avec 3 onglets :
- Mes decks.
- Toutes les cartes.
- Decks en construction.

La partie Toutes les cartes contient déjà le squelette prévu pour la collection globale :
- cartes uniques ;
- nombre total d'exemplaires ;
- nombre disponible ;
- future recherche ;
- future liste avec quantité / utilisées / libres.

Les types MTG de base sont dans `types/mtg.ts`.

## Étapes suivantes prévues
- Recherche Scryfall pour ajouter une carte.
- Persistance des cartes / decks (Supabase ou autre base).
- Drawer de détail d'une carte avec localisation par deck.
- Création et édition des decks, formats, bracket et statut.

## Lancer le projet

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:3000
