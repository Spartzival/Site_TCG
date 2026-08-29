-- Card Projects / MTG persistent storage
-- Execute this file once in the Supabase SQL Editor.

create table if not exists public.mtg_collection_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  collection jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.mtg_deck_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  decks jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.mtg_collection_state enable row level security;
alter table public.mtg_deck_state enable row level security;

grant select, insert, update, delete on public.mtg_collection_state to authenticated;
grant select, insert, update, delete on public.mtg_deck_state to authenticated;

drop policy if exists "Users manage their own MTG collection" on public.mtg_collection_state;
create policy "Users manage their own MTG collection"
on public.mtg_collection_state
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own MTG decks" on public.mtg_deck_state;
create policy "Users manage their own MTG decks"
on public.mtg_deck_state
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
