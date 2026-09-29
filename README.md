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
Dashboard `/mtg` avec 5 onglets :
- Mes decks.
- Toutes les cartes.
- Decks en construction.
- Amis & partages.
- Découvrir : tendances récentes et recommandations selon les decks.

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

### Social / partage de decks

Le dashboard MTG possède un onglet **Amis & partages** : pseudo public, demandes d'amis, partage/révocation de decks et consultation en lecture seule des decks reçus.
Pour une base Supabase existante, exécuter `supabase/social_migration.sql` avant utilisation.

### Découvrir

Le nouvel onglet **Découvrir** affiche les nouvelles cartes Commander populaires sorties sur les six derniers mois, puis des recommandations calculées à partir des commandants et rôles manquants des decks locaux.

Le menu compte est désormais compact et fixé sur le côté de l’écran afin de ne plus masquer le contenu.
