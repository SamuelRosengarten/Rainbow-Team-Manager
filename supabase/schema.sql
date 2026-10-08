-- R6 Team Planner: Supabase schema
-- Paste this whole file into Supabase -> SQL Editor -> New query, and run it.
-- It is safe to run again: everything uses IF NOT EXISTS / ON CONFLICT.
--
-- SECURITY MODEL (read this, and "Security model" in the README):
-- One database, several teams. Each team member is a row in
-- public.team_members (filled by an admin from the Supabase dashboard): a
-- Supabase Auth user (email + password or Steam), the team they belong to, and
-- their roster player. Every table row has a team_id, and every policy lets a
-- signed-in member see and change only rows of their own team
-- (public.current_team_id()). The anon key (shipped inside the website) can
-- do nothing on its own.
--
-- ORDER MATTERS when upgrading an existing setup: run members.sql (logins)
-- and/or teams.sql (several teams) first, deploy the new website, and run this
-- file LAST. See "Upgrading an existing setup" in the README.

-- ---------------------------------------------------------------------------
-- Profiles: five fixed teammates
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- New setups get the five starter players in the first team (see "Several
-- teams" below).

-- ---------------------------------------------------------------------------
-- Team members: who may sign in, and which roster player each login is.
-- Admins fill this from the Supabase dashboard (Table Editor); the website
-- can't read or change it. Give each member an email (email + password login),
-- a steam_id (SteamID64, 17 digits, for "Sign in through Steam"), or both.
-- user_id is filled automatically on their first login.
-- ---------------------------------------------------------------------------
create table if not exists public.team_members (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  user_id uuid unique references auth.users (id) on delete set null,
  email text unique check (email is null or email = lower(btrim(email))),
  steam_id text unique check (steam_id is null or steam_id ~ '^[0-9]{17}$'),
  created_at timestamptz not null default now(),
  check (email is not null or steam_id is not null)
);

alter table public.team_members enable row level security;
revoke all on public.team_members from anon, authenticated;

-- True when the signed-in user is on the team. Every table policy uses it.
create or replace function public.is_team_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.team_members where user_id = auth.uid());
$$;

-- Called by the app right after sign-in: links the user to their member row
-- by email on the first login, and returns their roster name (null when this
-- account isn't on the team).
create or replace function public.claim_membership()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  mail text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  who text;
begin
  if me is null then
    return null;
  end if;
  if not exists (select 1 from public.team_members where user_id = me) and mail <> '' then
    update public.team_members set user_id = me where email = mail and user_id is null;
  end if;
  select p.name into who
  from public.team_members m join public.profiles p on p.id = m.profile_id
  where m.user_id = me;
  return who;
end;
$$;

revoke all on function public.is_team_member() from public, anon;
revoke all on function public.claim_membership() from public, anon;
grant execute on function public.is_team_member() to authenticated;
grant execute on function public.claim_membership() to authenticated;

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
-- Image links must be https (the app checks too). NOT VALID: older rows aren't rechecked.
alter table public.tactics drop constraint if exists tactics_image_url_https;
alter table public.tactics add constraint tactics_image_url_https check (image_url = '' or image_url ~ '^https://') not valid;

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

-- Each team gets its row when the team is created (see "Several teams" below).

-- ---------------------------------------------------------------------------
-- Row Level Security: on for every table. Each signed-in member sees only
-- their own team's rows (policies at the end of this file).
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.owned_operators enable row level security;
alter table public.preferred_operators enable row level security;
alter table public.tactics enable row level security;
alter table public.map_notes enable row level security;
alter table public.team_state enable row level security;

-- Policies and grants: at the end of this file ("Who can see what").

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
-- Roster details (added later).
-- Additive only: nothing above is renamed or removed. Safe to run again.
-- ===========================================================================

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

-- Player stats (added later; additive). The app works without them.
alter table public.player_details add column if not exists platform text not null default 'pc' check (platform in ('pc', 'xbox', 'playstation'));
alter table public.player_details add column if not exists stats jsonb;
alter table public.player_details add column if not exists stats_updated_at timestamptz;

alter table public.player_details enable row level security;

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


-- ===========================================================================
-- Security hardening (added later). Additive; safe to run again.
-- ===========================================================================

-- Text limits matching what the app already allows. NOT VALID: older rows
-- aren't rechecked, so re-running this file never fails on existing data.
alter table public.tactics drop constraint if exists tactics_name_length;
alter table public.tactics add constraint tactics_name_length check (char_length(name) <= 120) not valid;
alter table public.tactics drop constraint if exists tactics_description_length;
alter table public.tactics add constraint tactics_description_length check (char_length(description) <= 4000) not valid;
alter table public.map_notes drop constraint if exists map_notes_notes_length;
alter table public.map_notes add constraint map_notes_notes_length check (char_length(notes) <= 5000) not valid;

-- Private tables of the steam-auth Edge Function (it uses the service role,
-- which bypasses RLS). Nobody else can read or write them.
create table if not exists public.steam_nonces (
  nonce text primary key check (char_length(nonce) <= 255),
  used_at timestamptz not null default now()
);
create table if not exists public.steam_auth_attempts (
  ip text not null check (char_length(ip) <= 64),
  at timestamptz not null default now()
);
create index if not exists steam_auth_attempts_ip_at_idx on public.steam_auth_attempts (ip, at);
alter table public.steam_nonces enable row level security;
alter table public.steam_auth_attempts enable row level security;
revoke all on public.steam_nonces, public.steam_auth_attempts from anon, authenticated;

-- Steam nonces only matter for 5 minutes; older ones are removed now and then.
delete from public.steam_nonces where used_at < now() - interval '1 day';

-- ===========================================================================
-- Several teams (added later). The same statements as supabase/teams.sql,
-- the first step of that upgrade (a test keeps them identical).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Teams. Admins create them (Table Editor -> teams, or create_team() below).
-- A signed-in member can read their own team's row only (schema.sql).
-- ---------------------------------------------------------------------------
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) between 1 and 40),
  created_at timestamptz not null default now()
);
alter table public.teams enable row level security;
revoke all on public.teams from anon, authenticated;

-- The first team. Existing data (and the five starter players of a new setup)
-- goes into it. To give it another name, change it here before the first run,
-- or rename it later in Table Editor -> teams.
do $$
declare
  first_team_name text := 'Team 1';
begin
  if not exists (select 1 from public.teams) then
    insert into public.teams (name) values (first_team_name);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- team_id on every team table. Existing rows go into the first team.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  first_team uuid := (select id from public.teams order by created_at, id limit 1);
begin
  foreach t in array array['profiles', 'player_details', 'owned_operators', 'preferred_operators', 'tactics', 'map_notes', 'team_state', 'strategies', 'strategy_assignments'] loop
    execute format('alter table public.%I add column if not exists team_id uuid references public.teams (id) on delete cascade', t);
    execute format('update public.%I set team_id = $1 where team_id is null', t) using first_team;
    execute format('create index if not exists %I on public.%I (team_id)', t || '_team_id_idx', t);
  end loop;
end $$;

-- A login belongs to exactly one team: the team of its roster player.
alter table public.team_members add column if not exists team_id uuid references public.teams (id) on delete cascade;
update public.team_members m set team_id = p.team_id from public.profiles p where p.id = m.profile_id and m.team_id is null;
create index if not exists team_members_team_id_idx on public.team_members (team_id);
alter table public.team_members alter column team_id set not null;

-- The signed-in user's team (null when they aren't a member). Every table
-- policy compares a row's team_id with it (schema.sql).
create or replace function public.current_team_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select team_id from public.team_members where user_id = auth.uid();
$$;

-- The signed-in member's team, for the app's header: { "id": ..., "name": ... }.
create or replace function public.my_team()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object('id', t.id, 'name', t.name) from public.teams t where t.id = public.current_team_id();
$$;

revoke all on function public.current_team_id() from public, anon;
revoke all on function public.my_team() from public, anon;
grant execute on function public.current_team_id() to authenticated;
grant execute on function public.my_team() to authenticated;

-- New rows get the signed-in member's team: the app never sends team_id, and
-- can't choose another team (the policies check it too).
do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'player_details', 'owned_operators', 'preferred_operators', 'tactics', 'map_notes', 'team_state', 'strategies', 'strategy_assignments'] loop
    execute format('alter table public.%I alter column team_id set not null', t);
    execute format('alter table public.%I alter column team_id set default public.current_team_id()', t);
  end loop;
end $$;

-- A row never moves to another team.
create or replace function public.keep_team_id()
returns trigger
language plpgsql
as $$
begin
  if new.team_id is distinct from old.team_id then
    raise exception 'A row can''t move to another team (team_id can''t change).' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.keep_team_id() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'player_details', 'owned_operators', 'preferred_operators', 'tactics', 'map_notes', 'team_state', 'strategies', 'strategy_assignments'] loop
    execute format('drop trigger if exists keep_team_id on public.%I', t);
    execute format('create trigger keep_team_id before update of team_id on public.%I for each row execute function public.keep_team_id()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Per-team keys. Names, strategy and tactic ids, assignments and map notes
-- are unique within a team, not across teams (so each team can hide or edit a
-- built-in strategy or tactic for itself only).
-- ---------------------------------------------------------------------------
create or replace function pg_temp.ensure_constraint(tbl regclass, name text, def text)
returns void
language plpgsql
as $$
begin
  if not exists (select 1 from pg_constraint where conrelid = tbl and conname = name) then
    execute format('alter table %s add constraint %I %s', tbl, name, def);
  end if;
end;
$$;

alter table public.profiles drop constraint if exists profiles_name_key;
select pg_temp.ensure_constraint('public.profiles', 'profiles_team_name_key', 'unique (team_id, name)');
select pg_temp.ensure_constraint('public.profiles', 'profiles_team_id_id_key', 'unique (team_id, id)');

alter table public.team_state drop constraint if exists team_state_pkey;
alter table public.team_state drop constraint if exists team_state_id_check;
select pg_temp.ensure_constraint('public.team_state', 'team_state_team_pkey', 'primary key (team_id)');

alter table public.strategies drop constraint if exists strategies_pkey;
select pg_temp.ensure_constraint('public.strategies', 'strategies_team_pkey', 'primary key (team_id, id)');

alter table public.tactics drop constraint if exists tactics_pkey;
select pg_temp.ensure_constraint('public.tactics', 'tactics_team_pkey', 'primary key (team_id, id)');

alter table public.strategy_assignments drop constraint if exists strategy_assignments_pkey;
select pg_temp.ensure_constraint('public.strategy_assignments', 'strategy_assignments_team_pkey', 'primary key (team_id, strategy_id, slot_key)');

drop index if exists public.map_notes_owner_map_idx;
create unique index if not exists map_notes_team_owner_map_idx
  on public.map_notes (team_id, coalesce(owner_profile_id::text, 'team'), map_id);

-- A row can only point at a player of its own team.
select pg_temp.ensure_constraint('public.player_details', 'player_details_team_profile_fkey', 'foreign key (team_id, profile_id) references public.profiles (team_id, id) on delete cascade');
select pg_temp.ensure_constraint('public.owned_operators', 'owned_operators_team_profile_fkey', 'foreign key (team_id, profile_id) references public.profiles (team_id, id) on delete cascade');
select pg_temp.ensure_constraint('public.preferred_operators', 'preferred_operators_team_profile_fkey', 'foreign key (team_id, profile_id) references public.profiles (team_id, id) on delete cascade');
select pg_temp.ensure_constraint('public.map_notes', 'map_notes_team_owner_fkey', 'foreign key (team_id, owner_profile_id) references public.profiles (team_id, id) on delete cascade');
select pg_temp.ensure_constraint('public.strategy_assignments', 'strategy_assignments_team_profile_fkey', 'foreign key (team_id, profile_id) references public.profiles (team_id, id) on delete cascade');
select pg_temp.ensure_constraint('public.team_members', 'team_members_team_profile_fkey', 'foreign key (team_id, profile_id) references public.profiles (team_id, id) on delete cascade');
-- Owners are optional: deleting the player clears only the owner, the row stays in its team.
select pg_temp.ensure_constraint('public.tactics', 'tactics_team_owner_fkey', 'foreign key (team_id, owner_profile_id) references public.profiles (team_id, id) on delete set null (owner_profile_id)');
select pg_temp.ensure_constraint('public.strategies', 'strategies_team_owner_fkey', 'foreign key (team_id, owner_profile_id) references public.profiles (team_id, id) on delete set null (owner_profile_id)');

-- ---------------------------------------------------------------------------
-- Every team has its own team state (current side, map, bans, lineup).
-- ---------------------------------------------------------------------------
create or replace function public.team_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.team_state (team_id) values (new.id) on conflict (team_id) do nothing;
  return new;
end;
$$;
revoke all on function public.team_created() from public, anon, authenticated;

drop trigger if exists team_created on public.teams;
create trigger team_created after insert on public.teams for each row execute function public.team_created();

insert into public.team_state (team_id)
select t.id from public.teams t
where not exists (select 1 from public.team_state s where s.team_id = t.id);

-- New setups: the five starter players, in the first team. (Only when there
-- are no players at all: an existing roster is never touched, and a new team
-- starts empty.)
insert into public.profiles (team_id, name)
select (select id from public.teams order by created_at, id limit 1), n
from unnest(array['Samuel', 'Anthony', 'Xavier', 'Mathis', 'William']) as n
where not exists (select 1 from public.profiles);

-- ---------------------------------------------------------------------------
-- Admin helpers, for the SQL editor only (the website can't call them).
--   select public.create_team('Team Alpha');
--   select public.add_member('Team Alpha', 'Lucas', 'lucas@example.com', null);
--   select public.add_member('Team Alpha', 'Noah', null, '76561198000000002');
-- ---------------------------------------------------------------------------
create or replace function public.create_team(team_name text)
returns uuid
language sql
volatile
set search_path = public
as $$
  insert into public.teams (name) values (btrim(team_name)) returning id;
$$;

-- Adds a player to a team's roster (if not there yet) and lets them sign in
-- with that email and/or Steam ID. Returns the player's profile id.
create or replace function public.add_member(team_name text, player_name text, member_email text default null, member_steam_id text default null)
returns uuid
language plpgsql
volatile
set search_path = public
as $$
declare
  tid uuid;
  pid uuid;
begin
  select id into tid from public.teams where name = btrim(team_name);
  if tid is null then
    raise exception 'No team named "%". Create it first: select public.create_team(''%'');', team_name, team_name;
  end if;
  select id into pid from public.profiles where team_id = tid and name = btrim(player_name);
  if pid is null then
    insert into public.profiles (team_id, name) values (tid, btrim(player_name)) returning id into pid;
  end if;
  insert into public.team_members (profile_id, team_id, email, steam_id)
  values (pid, tid, nullif(lower(btrim(member_email)), ''), nullif(btrim(member_steam_id), ''));
  return pid;
end;
$$;

revoke all on function public.create_team(text) from public, anon, authenticated;
revoke all on function public.add_member(text, text, text, text) from public, anon, authenticated;

-- ===========================================================================
-- Who can see what. Every signed-in member sees and changes only their own
-- team's rows: each policy compares the row's team_id with
-- current_team_id(). (Upgrading? This is the step that switches from "every
-- member sees everything" to "own team only": run it after the new website
-- is live, see the README.)
-- ===========================================================================

-- The old "every member" policies (same names) are replaced below; the old
-- team_state id column (always 1) goes first, since a policy used it.
drop policy if exists "team read team_state" on public.team_state;
drop policy if exists "team update team_state" on public.team_state;
alter table public.team_state drop column if exists id;

-- Players: read and add (not renamed or deleted from the website: names are
-- the players' identity in the app).
drop policy if exists "team read profiles" on public.profiles;
create policy "team read profiles" on public.profiles
  for select to authenticated using (team_id = (select public.current_team_id()));
drop policy if exists "team add profiles" on public.profiles;
create policy "team add profiles" on public.profiles
  for insert to authenticated
  with check (team_id = (select public.current_team_id()) and char_length(btrim(name)) between 1 and 24);

-- The team's state: read and change its one row (never add or delete it).
create policy "team read team_state" on public.team_state
  for select to authenticated using (team_id = (select public.current_team_id()));
create policy "team update team_state" on public.team_state
  for update to authenticated using (team_id = (select public.current_team_id())) with check (team_id = (select public.current_team_id()));

-- Everything else: read, add, change and delete the team's own rows.
drop policy if exists "team all player_details" on public.player_details;
create policy "team all player_details" on public.player_details
  for all to authenticated using (team_id = (select public.current_team_id())) with check (team_id = (select public.current_team_id()));
drop policy if exists "team all owned_operators" on public.owned_operators;
create policy "team all owned_operators" on public.owned_operators
  for all to authenticated using (team_id = (select public.current_team_id())) with check (team_id = (select public.current_team_id()));
drop policy if exists "team all preferred_operators" on public.preferred_operators;
create policy "team all preferred_operators" on public.preferred_operators
  for all to authenticated using (team_id = (select public.current_team_id())) with check (team_id = (select public.current_team_id()));
drop policy if exists "team all tactics" on public.tactics;
create policy "team all tactics" on public.tactics
  for all to authenticated using (team_id = (select public.current_team_id())) with check (team_id = (select public.current_team_id()));
drop policy if exists "team all map_notes" on public.map_notes;
create policy "team all map_notes" on public.map_notes
  for all to authenticated using (team_id = (select public.current_team_id())) with check (team_id = (select public.current_team_id()));
drop policy if exists "team all strategies" on public.strategies;
create policy "team all strategies" on public.strategies
  for all to authenticated using (team_id = (select public.current_team_id())) with check (team_id = (select public.current_team_id()));
drop policy if exists "team all strategy_assignments" on public.strategy_assignments;
create policy "team all strategy_assignments" on public.strategy_assignments
  for all to authenticated using (team_id = (select public.current_team_id())) with check (team_id = (select public.current_team_id()));

-- A member can read their own team's row (its name), nothing else.
drop policy if exists "team read own team" on public.teams;
create policy "team read own team" on public.teams
  for select to authenticated using (id = (select public.current_team_id()));

grant usage on schema public to authenticated;
grant select on public.teams to authenticated;
grant select, insert on public.profiles to authenticated;
grant select, update on public.team_state to authenticated;
grant select, insert, update, delete on
  public.player_details, public.owned_operators, public.preferred_operators, public.tactics,
  public.map_notes, public.strategies, public.strategy_assignments
  to authenticated;


-- The anon key can do nothing: no table, view, sequence or function in this
-- schema is open to it (older setups granted it everything, including the
-- removed match tables). Tables the website uses are granted to
-- authenticated above, and their policies allow only the member's own team.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon;

-- ---------------------------------------------------------------------------
-- OPT-IN: remove the old team passcode (setups made before logins existed).
-- Nothing uses it any more. Uncomment and run these three lines once.
-- ---------------------------------------------------------------------------
-- drop function if exists public.check_team_passcode(text);
-- drop function if exists public.team_passcode_is_set();
-- drop table if exists public.team_settings;
