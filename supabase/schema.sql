-- ============================================================
-- B SHARP — database schema
-- Paste this whole file into: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- Public profile (username) linked to each auth user
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null
    check (char_length(username) between 3 and 24),
  created_at timestamptz not null default now()
);

-- Per-user training progress
create table public.progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp integer not null default 0,
  best_streak integer not null default 0,
  answered integer not null default 0,
  correct integer not null default 0,
  miss_by_note jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------- Row Level Security: users only touch their own rows ----------
alter table public.profiles enable row level security;
alter table public.progress enable row level security;

create policy "read own profile"    on public.profiles for select using (auth.uid() = id);
create policy "update own profile"  on public.profiles for update using (auth.uid() = id);

create policy "read own progress"   on public.progress for select using (auth.uid() = user_id);
create policy "insert own progress" on public.progress for insert with check (auth.uid() = user_id);
create policy "update own progress" on public.progress for update using (auth.uid() = user_id);

-- ---------- Auto-create profile + progress rows on signup ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  wanted text := coalesce(new.raw_user_meta_data->>'username',
                          'player_' || substr(new.id::text, 1, 8));
begin
  begin
    insert into public.profiles (id, username) values (new.id, wanted);
  exception when unique_violation then
    -- username taken: fall back to a suffixed variant
    insert into public.profiles (id, username)
    values (new.id, left(wanted, 18) || '_' || substr(new.id::text, 1, 4));
  end;
  insert into public.progress (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- SOCIAL LAYER — see upgrade-social.sql (same content, kept in
-- one place for fresh installs; safe to run repeatedly)
-- ============================================================
-- profile fields for the social layer
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists instagram text
  check (instagram is null or char_length(instagram) <= 60);

-- profiles must be publicly readable so the feed can show names
drop policy if exists "profiles are viewable by everyone" on public.profiles;
create policy "profiles are viewable by everyone"
  on public.profiles for select using (true);

-- ---------- posts ----------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  caption text not null default '' check (char_length(caption) <= 500),
  media_url text not null,
  media_type text not null check (media_type in ('image', 'video')),
  created_at timestamptz not null default now()
);
alter table public.posts enable row level security;

drop policy if exists "posts are viewable by everyone" on public.posts;
create policy "posts are viewable by everyone"
  on public.posts for select using (true);
drop policy if exists "users create own posts" on public.posts;
create policy "users create own posts"
  on public.posts for insert with check (auth.uid() = user_id);
drop policy if exists "users delete own posts" on public.posts;
create policy "users delete own posts"
  on public.posts for delete using (auth.uid() = user_id);

-- ---------- likes ----------
create table if not exists public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.likes enable row level security;

drop policy if exists "likes are viewable by everyone" on public.likes;
create policy "likes are viewable by everyone"
  on public.likes for select using (true);
drop policy if exists "users like as themselves" on public.likes;
create policy "users like as themselves"
  on public.likes for insert with check (auth.uid() = user_id);
drop policy if exists "users unlike as themselves" on public.likes;
create policy "users unlike as themselves"
  on public.likes for delete using (auth.uid() = user_id);

-- ---------- media storage ----------
-- public bucket; files live under a folder named by the uploader's user id,
-- and only that user can write there. 25 MB per file.
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', true, 26214400)
on conflict (id) do update set public = true, file_size_limit = 26214400;

drop policy if exists "media is publicly readable" on storage.objects;
create policy "media is publicly readable"
  on storage.objects for select using (bucket_id = 'media');
drop policy if exists "users upload to own folder" on storage.objects;
create policy "users upload to own folder"
  on storage.objects for insert
  with check (bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "users delete own media" on storage.objects;
create policy "users delete own media"
  on storage.objects for delete
  using (bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- FRIENDS & PRESENCE — see upgrade-friends.sql (same content)
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
