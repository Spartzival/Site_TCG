# Magic Play — prototype v0.1

## Navigation

Après avoir sélectionné Magic depuis l'accueil :

- `/mtg` : hub Magic avec **Construction de deck** et **Jeu**.
- `/mtg/decks` : dashboard/deck builder existant.
- `/mtg/play` : lobby et table de jeu prototype.

## Déjà implémenté

- sélection d'un deck marqué `Prêt` ;
- table locale d'entraînement ;
- création d'un code de salle à 6 caractères ;
- rejoindre une salle avec un code ;
- synchronisation prototype avec Supabase Realtime Broadcast ;
- présence des adversaires ;
- état public synchronisé : PV, battlefield, cimetière, exil, zone de commandement, taille de main et bibliothèque ;
- main et ordre de bibliothèque gardés localement ;
- mélange, pioche initiale de 7, pioche 1, nouveau tour ;
- déplacement main → battlefield / cimetière / exil ;
- engagement / dégagement d'un permanent ;
- zone de commandement Commander.

## Important

Le prototype ne contient pas encore de moteur de règles Magic. Les joueurs pilotent eux-mêmes les actions, comme sur une table virtuelle.

Les salons Realtime sont éphémères : ils existent tant que les joueurs sont connectés. Il n'y a pas encore de table SQL de sauvegarde de partie.

Le mode en ligne nécessite :

- Supabase configuré ;
- un utilisateur authentifié ;
- Supabase Realtime disponible sur le projet.

Aucune nouvelle migration SQL n'est nécessaire pour ce prototype.

## Prochaines étapes naturelles

- drag & drop ;
- mulligan ;
- tokens et marqueurs sur le battlefield ;
- dégâts de commandant ;
- dés / pile / compteurs ;
- journal des actions ;
- lobby persistant et invitations d'amis ;
- sauvegarde / reprise d'une partie ;
- spectateurs ;
- sécurité serveur des salles privées.
