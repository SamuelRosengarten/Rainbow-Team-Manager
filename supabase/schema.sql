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

-- The app only reads the passcode hash; set it from the SQL editor.
drop policy if exists "team read team_settings" on public.team_settings;
create policy "team read team_settings" on public.team_settings
  for select to anon, authenticated using (true);

grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.team_settings to anon, authenticated;
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
