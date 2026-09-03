# Supabase — mise en place de la sauvegarde persistante

## 1. Créer un projet Supabase

Crée un projet sur Supabase, puis ouvre **SQL Editor**.

## 2. Créer les tables et les règles de sécurité

Copie/colle le contenu de :

`supabase/schema.sql`

Puis exécute le script.

Les deux tables créées sont :

- `mtg_collection_state` : collection + impressions physiques.
- `mtg_deck_state` : decks prêts et decks en construction.

Les deux tables ont Row Level Security activé. Chaque compte ne peut lire et modifier que ses propres données.

## 3. Ajouter les variables d'environnement

Copie `.env.example` vers `.env.local` :

```bash
cp .env.example .env.local
```

Récupère dans Supabase **Connect > API Keys** :

- Project URL
- Publishable key

Puis remplis :

```env
NEXT_PUBLIC_SUPABASE_URL=https://TON-PROJET.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=TA_PUBLISHABLE_KEY
```

Ne mets jamais de `service_role` key dans une variable `NEXT_PUBLIC_*`.

## 4. Installer les nouvelles dépendances

```bash
npm install
```

Le projet utilise :

- `@supabase/supabase-js`
- `@supabase/ssr`

## 5. Lancer

```bash
npm run dev
```

Puis ouvre `/mtg`.

Si Supabase est configuré, une page de connexion/création de compte apparaît.

## Migration automatique du localStorage

Au premier login :

- si Supabase contient déjà des données, elles remplacent le cache local ;
- si Supabase est vide mais que le navigateur contient déjà une collection/des decks, les données locales sont automatiquement envoyées dans Supabase.

Après cela, le `localStorage` reste un cache rapide, tandis que Supabase devient la sauvegarde persistante.

Si les cookies et données du site sont effacés, reconnecte-toi avec le même compte : les données Supabase seront rechargées dans le navigateur.

## Suppression d'un compte depuis le site

Le bouton **Supprimer le compte** utilise une Route Handler Next.js côté serveur.
Il a besoin de la clé `service_role`, qui ne doit jamais être exposée au navigateur.

Ajoute dans `.env.local` :

```env
SUPABASE_SERVICE_ROLE_KEY=ta_service_role_key
```

Tu peux la récupérer dans **Supabase > Settings > API Keys**.
Ne la préfixe jamais avec `NEXT_PUBLIC_`.

Le schéma utilise déjà `on delete cascade` sur les tables MTG : lorsque l'utilisateur
Auth est supprimé, ses états `mtg_collection_state` et `mtg_deck_state` sont également
supprimés.
