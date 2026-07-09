-- ============================================================
-- B SHARP — social upgrade (run AFTER schema.sql, or on an
-- existing project: Supabase Dashboard → SQL Editor → Run)
-- Safe to run more than once.
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
