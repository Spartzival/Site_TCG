# MTG Deck Builder — live analysis

## Added
- Create Commander deck projects from the "Decks en construction" tab.
- Choose commander with Scryfall autocomplete.
- Add cards one by one with Scryfall.
- Import plain text lists (`1 Sol Ring`, `1x Sol Ring`) with optional `// Commander` and `// Main` sections.
- Batch-resolve imports through Scryfall `/cards/collection`.
- Persist deck projects in browser localStorage.
- Local live analysis: 100-card count, mana curve, average mana value, mana pips, card types, color identity, Commander legality, singleton checks.
- Collection availability against the global bulk collection.
- Commander Spellbook server proxy for `/estimate-bracket` + `/find-my-combos`.
- Live bracket estimate/minimum and combo / almost-combo panels.
- Manual cEDH intent switch because bracket 5 is a metagame/intention label, not purely a card-list rule.

## Important
Commander Spellbook may evolve its response schema. The API proxy intentionally normalizes several known response shapes and degrades gracefully if the service is unavailable.

## Export de decklist

Chaque deck prêt ou en construction dispose maintenant d'un bouton **Copier la decklist** dans la barre supérieure.

Le texte copié contient uniquement les quantités et les noms canoniques des cartes, séparés en sections COMMANDANT, DECK, SIDEBOARD et MAYBEBOARD. Les informations d'impression (set, numéro de collection) ne sont pas exportées afin de garder un format portable vers Archidekt, Moxfield, MTGGoldfish et les imports texte similaires.

## Analyse avancée (septembre 2026)

- Combos Commander Spellbook développées : cartes, prérequis, étapes, résultats et pièces manquantes.
- Les pièces manquantes d'une combo peuvent être ajoutées au deck depuis le panneau d'analyse.
- Bracket détaillé : Game Changers, combos à deux cartes, locks, extra turns, mass land denial et cartes interdites.
- Nouveau panneau Cartes clés / Suggestions : synergie avec le commandant + rôles faibles de la decklist + popularité Commander Scryfall.
- Les suggestions indiquent si la carte est déjà possédée dans le bulk et peuvent être ajoutées en un clic dans un deck en construction.
- Les suggestions sont heuristiques et explicables ; elles n'utilisent pas d'API EDHREC privée/non officielle.

## Tokens liés au deck

Le dock d'analyse contient désormais un panneau **Tokens** pour Commander et Standard.

- Détection à la demande afin de ne pas surcharger Scryfall.
- Les cartes du deck sont résolues via `/cards/collection` par lots de 75 maximum.
- Les relations officielles `all_parts` de Scryfall sont utilisées pour trouver tokens et emblèmes.
- Plusieurs impressions du même token sont regroupées par identité de règles (ex. Treasure).
- Les tokens copie / variables sont signalés même lorsqu'aucune carte token précise n'existe.
- Les sources du deck (commandant, mainboard, sideboard) sont affichées pour chaque token.
- Le maybeboard n'est volontairement pas inclus dans la liste des tokens à préparer.
- La réponse est conservée en cache serveur pendant 6 h pour limiter les appels Scryfall.
