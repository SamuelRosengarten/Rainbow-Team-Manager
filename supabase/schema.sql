-- R6 Team Planner: Supabase schema
-- Paste this whole file into Supabase -> SQL Editor -> New query, and run it.
-- It is safe to run again: everything uses IF NOT EXISTS / ON CONFLICT.
--
-- SECURITY MODEL (read this):
-- There is no authentication. Every table below is readable AND writable by
-- anyone who has your project URL + anon key (which ship inside the website).
-- That is deliberate: the app is a shared whiteboard for five friends.
-- The team passcode is a light gate in the UI, not real security.
-- Do not store anything private here.

-- ---------------------------------------------------------------------------
-- Profiles: five fixed teammates
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

insert into public.profiles (name)
values ('Samuel'), ('Anthony'), ('Xavier'), ('Mathis'), ('William')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Owned and preferred operators (operator ids match src/data/operators.json)
-- ---------------------------------------------------------------------------
create table if not exists public.owned_operators (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  operator_id text not null,
  primary key (profile_id, operator_id)
);

create table if not exists public.preferred_operators (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  operator_id text not null,
  kind text not null check (kind in ('favorite', 'avoid')),
  primary key (profile_id, operator_id)
);

-- ---------------------------------------------------------------------------
-- Tactics. owner_profile_id NULL = team tactic (or an edited built-in).
-- Ids are text so edits to built-ins from src/data/tactics.json keep their id.
-- deleted = true hides a built-in tactic from the app.
-- ---------------------------------------------------------------------------
create table if not exists public.tactics (
  id text primary key,
  owner_profile_id uuid references public.profiles (id) on delete set null,
  name text not null,
  side text not null check (side in ('attack', 'defend')),
  map_id text not null default 'any',
  site text not null default '',
  description text not null default '',
  required_roles text[] not null default '{}',
  shared boolean not null default true,
  example boolean not null default false,
  deleted boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Added later: optional link to a map image for a tactic.
alter table public.tactics add column if not exists image_url text not null default '';

-- ---------------------------------------------------------------------------
-- Map notes. owner_profile_id NULL = team notes. One row per owner + map.
-- ---------------------------------------------------------------------------
create table if not exists public.map_notes (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid references public.profiles (id) on delete cascade,
  map_id text not null,
  notes text not null default '',
  updated_at timestamptz not null default now()
);

create unique index if not exists map_notes_owner_map_idx
  on public.map_notes (coalesce(owner_profile_id::text, 'team'), map_id);

-- ---------------------------------------------------------------------------
-- Team state: exactly one row (id = 1), synced live to everyone.
-- ---------------------------------------------------------------------------
create table if not exists public.team_state (
  id int primary key default 1 check (id = 1),
  side text not null default 'attack' check (side in ('attack', 'defend')),
  map_id text not null default '',
  site text not null default '',
  bans text[] not null default '{}',
  lineup jsonb,               -- { "side": "attack", "players": { "Samuel": "ash", ... } }
  tactic_id text,
  owned_only boolean not null default false,
  updated_by text,
  updated_at timestamptz not null default now()
);

insert into public.team_state (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Team settings: exactly one row holding the passcode hash.
-- Set the passcode with the statement in the README (never commit it).
-- ---------------------------------------------------------------------------
create table if not exists public.team_settings (
  id int primary key default 1 check (id = 1),
  passcode_hash text
);

insert into public.team_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Row Level Security: enabled, with permissive policies for the anon role.
-- Open to the team by design (see the README).
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.owned_operators enable row level security;
alter table public.preferred_operators enable row level security;
alter table public.tactics enable row level security;
alter table public.map_notes enable row level security;
alter table public.team_state enable row level security;
alter table public.team_settings enable row level security;

drop policy if exists "team read profiles" on public.profiles;
create policy "team read profiles" on public.profiles
  for select to anon, authenticated using (true);

drop policy if exists "team all owned_operators" on public.owned_operators;
create policy "team all owned_operators" on public.owned_operators
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "team all preferred_operators" on public.preferred_operators;
create policy "team all preferred_operators" on public.preferred_operators
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "team all tactics" on public.tactics;
create policy "team all tactics" on public.tactics
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "team all map_notes" on public.map_notes;
create policy "team all map_notes" on public.map_notes
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "team read team_state" on public.team_state;
create policy "team read team_state" on public.team_state
  for select to anon, authenticated using (true);
drop policy if exists "team update team_state" on public.team_state;
create policy "team update team_state" on public.team_state
  for update to anon, authenticated using (id = 1) with check (id = 1);

-- The passcode hash is NOT readable from the website. The app checks a
-- passcode through check_team_passcode() below, which runs on the server.
-- Set the passcode from the SQL editor (see the README).
drop policy if exists "team read team_settings" on public.team_settings;
revoke all on public.team_settings from anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant select, update on public.team_state to anon, authenticated;
grant select, insert, update, delete on
  public.owned_operators, public.preferred_operators, public.tactics, public.map_notes
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: live updates for team state and shared data.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['team_state', 'tactics', 'map_notes', 'owned_operators', 'preferred_operators']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Deletes on these tables need the full old row in realtime payloads.
alter table public.owned_operators replica identity full;
alter table public.preferred_operators replica identity full;

-- ===========================================================================
-- Roster details and the server-side passcode check (added later).
-- Additive only: nothing above is renamed or removed. Safe to run again.
-- ===========================================================================

-- Passcode check on the server, so the hash never reaches the browser.
create or replace function public.team_passcode_is_set()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_settings
    where id = 1 and coalesce(btrim(passcode_hash), '') <> ''
  );
$$;

create or replace function public.check_team_passcode(attempt text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select lower(btrim(passcode_hash)) = encode(sha256(convert_to('r6tp:' || btrim(attempt), 'UTF8')), 'hex')
    from public.team_settings
    where id = 1 and coalesce(btrim(passcode_hash), '') <> ''
  ), false);
$$;

revoke all on function public.team_passcode_is_set() from public;
revoke all on function public.check_team_passcode(text) from public;
grant execute on function public.team_passcode_is_set() to anon, authenticated;
grant execute on function public.check_team_passcode(text) to anon, authenticated;

-- Adding players from the Roster screen. Names are the player's identity in
-- the app, so they can be added but not renamed or deleted from the website.
drop policy if exists "team add profiles" on public.profiles;
create policy "team add profiles" on public.profiles
  for insert to anon, authenticated
  with check (char_length(btrim(name)) between 1 and 24);
grant insert on public.profiles to anon, authenticated;

-- Per-player details. A profile without a row here is a starter.
create table if not exists public.player_details (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  username text not null default '' check (char_length(username) <= 40),
  main_role text not null default '' check (
    main_role in ('', 'hard-breacher', 'soft-breacher', 'intel', 'anchor', 'roamer', 'support', 'igl', 'flex')
  ),
  status text not null default 'starter' check (status in ('starter', 'sub', 'archived')),
  availability text not null default 'available' check (availability in ('available', 'limited', 'unavailable')),
  notes text not null default '' check (char_length(notes) <= 2000),
  updated_at timestamptz not null default now()
);

-- The app used to schedule matches (tables matches, match_availability and
-- match_checklist). That feature was removed: the app is now a tactical
-- planner. Nothing else uses those tables, so new setups don't create them
-- and existing ones are left as they are (your old data stays). To delete
-- them for good, run this by hand:
--
--   drop table if exists public.match_checklist, public.match_availability, public.matches;

alter table public.player_details enable row level security;

drop policy if exists "team all player_details" on public.player_details;
create policy "team all player_details" on public.player_details
  for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.player_details to anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'player_details']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;


-- ===========================================================================
-- Strategy library (added later). Additive only; safe to run again.
--
-- Built-in strategies (AI suggestions and linked references) ship in
-- src/data/strategies.json. This table holds the team's own strategies,
-- team-added references, and "hidden" markers for built-ins (deleted = true).
--
-- Each strategy is one document (`doc`): slots, steps, markers and paths are
-- saved together so a save can't half-apply. The columns next to it copy the
-- fields the library filters on, so they can be indexed and queried.
-- ===========================================================================
create table if not exists public.strategies (
  id text primary key check (char_length(id) between 1 and 80),
  origin text not null default 'team' check (origin in ('team', 'reference', 'suggested')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  map_id text not null default 'any' check (char_length(map_id) <= 40),
  site text not null default '' check (char_length(site) <= 80),
  floor text not null default '' check (char_length(floor) <= 20),
  side text not null check (side in ('attack', 'defend')),
  type text not null default 'execute' check (char_length(type) <= 20),
  difficulty int not null default 2 check (difficulty between 1 and 3),
  operators text[] not null default '{}' check (cardinality(operators) <= 6),
  tags text[] not null default '{}' check (cardinality(tags) <= 10),
  source_name text not null default '' check (char_length(source_name) <= 80),
  source_url text not null default '' check (source_url = '' or source_url ~ '^https://'),
  owner_profile_id uuid references public.profiles (id) on delete set null,
  shared boolean not null default true,
  deleted boolean not null default false,
  schema_version int not null default 1,
  doc jsonb not null default '{}'::jsonb check (pg_column_size(doc) <= 200000),
  updated_by text check (char_length(updated_by) <= 24),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists strategies_map_side_idx on public.strategies (map_id, side);
create index if not exists strategies_operators_idx on public.strategies using gin (operators);

-- Who plays which slot of a strategy. Kept apart from the strategy itself so
-- the same strategy works when the roster changes. strategy_id can point at a
-- built-in strategy, so it has no foreign key.
create table if not exists public.strategy_assignments (
  strategy_id text not null check (char_length(strategy_id) between 1 and 80),
  slot_key text not null check (char_length(slot_key) between 1 and 20),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (strategy_id, slot_key)
);

alter table public.strategies enable row level security;
alter table public.strategy_assignments enable row level security;

drop policy if exists "team all strategies" on public.strategies;
create policy "team all strategies" on public.strategies
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "team all strategy_assignments" on public.strategy_assignments;
create policy "team all strategy_assignments" on public.strategy_assignments
  for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.strategies, public.strategy_assignments to anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['strategies', 'strategy_assignments']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

alter table public.strategy_assignments replica identity full;
