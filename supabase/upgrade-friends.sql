-- ============================================================
-- B SHARP — friends & presence upgrade
-- Run in: Supabase Dashboard → SQL Editor. Safe to run twice.
-- ============================================================

-- last-seen timestamp on profiles (profiles + signup trigger already exist)
alter table public.profiles add column if not exists last_active_at timestamptz default now();

-- ---------- friendships ----------
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);

-- one row per pair, whichever direction it was sent in
create unique index if not exists friendships_unique_pair
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

alter table public.friendships enable row level security;

drop policy if exists "parties read their friendships" on public.friendships;
create policy "parties read their friendships"
  on public.friendships for select
  using (auth.uid() in (requester_id, addressee_id));

drop policy if exists "users send requests as themselves" on public.friendships;
create policy "users send requests as themselves"
  on public.friendships for insert
  with check (auth.uid() = requester_id);

drop policy if exists "addressee accepts" on public.friendships;
create policy "addressee accepts"
  on public.friendships for update
  using (auth.uid() = addressee_id)
  with check (status = 'accepted');

drop policy if exists "either party removes" on public.friendships;
create policy "either party removes"
  on public.friendships for delete
  using (auth.uid() in (requester_id, addressee_id));
