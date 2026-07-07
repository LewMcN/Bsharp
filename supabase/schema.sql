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
