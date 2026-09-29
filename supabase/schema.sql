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

-- ---------------------------------------------------------------------------
-- Social / friends / deck sharing
-- Safe to execute after the original schema.
-- ---------------------------------------------------------------------------

create table if not exists public.mtg_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists mtg_profiles_username_lower_unique
on public.mtg_profiles (lower(username));

create table if not exists public.mtg_friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (sender_id <> recipient_id)
);

create index if not exists mtg_friend_requests_sender_idx
on public.mtg_friend_requests (sender_id, status);

create index if not exists mtg_friend_requests_recipient_idx
on public.mtg_friend_requests (recipient_id, status);

create table if not exists public.mtg_friendships (
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

create table if not exists public.mtg_deck_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  deck_id text not null,
  deck_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, recipient_id, deck_id),
  check (owner_id <> recipient_id)
);

create index if not exists mtg_deck_shares_owner_idx
on public.mtg_deck_shares (owner_id, updated_at desc);

create index if not exists mtg_deck_shares_recipient_idx
on public.mtg_deck_shares (recipient_id, updated_at desc);

alter table public.mtg_profiles enable row level security;
alter table public.mtg_friend_requests enable row level security;
alter table public.mtg_friendships enable row level security;
alter table public.mtg_deck_shares enable row level security;

grant select, insert, update, delete on public.mtg_profiles to authenticated;
grant select, insert, update, delete on public.mtg_friend_requests to authenticated;
grant select, insert, update, delete on public.mtg_friendships to authenticated;
grant select, insert, update, delete on public.mtg_deck_shares to authenticated;

-- Public social profiles expose only the pseudo/display name fields stored here,
-- never auth.users emails.
drop policy if exists "Authenticated users can read MTG profiles" on public.mtg_profiles;
create policy "Authenticated users can read MTG profiles"
on public.mtg_profiles
for select
to authenticated
using (true);

drop policy if exists "Users manage their own MTG profile" on public.mtg_profiles;
create policy "Users manage their own MTG profile"
on public.mtg_profiles
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users see their MTG friend requests" on public.mtg_friend_requests;
create policy "Users see their MTG friend requests"
on public.mtg_friend_requests
for select
to authenticated
using ((select auth.uid()) = sender_id or (select auth.uid()) = recipient_id);

drop policy if exists "Users create their own MTG friend requests" on public.mtg_friend_requests;
create policy "Users create their own MTG friend requests"
on public.mtg_friend_requests
for insert
to authenticated
with check ((select auth.uid()) = sender_id);

drop policy if exists "Recipients respond to MTG friend requests" on public.mtg_friend_requests;
create policy "Recipients respond to MTG friend requests"
on public.mtg_friend_requests
for update
to authenticated
using ((select auth.uid()) = recipient_id)
with check ((select auth.uid()) = recipient_id);

drop policy if exists "Users see their MTG friendships" on public.mtg_friendships;
create policy "Users see their MTG friendships"
on public.mtg_friendships
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users see MTG deck shares involving them" on public.mtg_deck_shares;
create policy "Users see MTG deck shares involving them"
on public.mtg_deck_shares
for select
to authenticated
using ((select auth.uid()) = owner_id or (select auth.uid()) = recipient_id);

drop policy if exists "Owners manage their MTG deck shares" on public.mtg_deck_shares;
create policy "Owners manage their MTG deck shares"
on public.mtg_deck_shares
for all
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);
