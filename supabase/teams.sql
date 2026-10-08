-- R6 Tactical Command: several teams in one database.
--
-- UPGRADING an existing setup? Run THIS file first (Supabase -> SQL Editor).
-- It prepares the database for several teams WITHOUT changing who can see
-- what: it adds the teams table, a team_id on every team table (all your
-- current data goes into the first team, below), per-team keys, and the
-- helper functions. Your current website keeps working.
-- Then deploy the new website, then run schema.sql LAST: that's the step that
-- switches the rules to "your own team only". See the README, "Upgrading an
-- existing setup" and "Running several teams".
--
-- New setups don't need this file: schema.sql contains the same statements
-- (a test keeps them identical). Safe to run again.

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
