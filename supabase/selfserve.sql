-- R6 Tactical Command: self-serve accounts and teams.
--
-- People sign up themselves, then create a team (they become its captain) or
-- join one with an invite code. Captains manage their team from the website.
-- Every change goes through the functions below, which check who's asking;
-- the website still can't write to teams or team_members directly, and a
-- member still only reaches their own team.
--
-- UPGRADING an existing setup? Run THIS file first (Supabase -> SQL Editor).
-- It only adds things (roles, invite codes, the functions): existing teams
-- keep working, and the earliest member of each team becomes its captain.
-- Then deploy the new website, run schema.sql LAST, and only then turn
-- sign-ups on (README, "Upgrading an existing setup").
--
-- New setups don't need this file: schema.sql contains the same statements
-- (a test keeps them identical). Safe to run again.

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

-- ---------------------------------------------------------------------------
-- Roles: a team has captains (manage the team) and members.
-- ---------------------------------------------------------------------------
alter table public.team_members add column if not exists role text not null default 'member';
select pg_temp.ensure_constraint('public.team_members', 'team_members_role_check', $c$check (role in ('captain', 'member'))$c$);

-- Existing teams: the earliest member becomes captain (only for a team that
-- has no captain yet, so running this again changes nothing).
update public.team_members m
set role = 'captain'
where m.profile_id in (
  select distinct on (team_id) profile_id from public.team_members order by team_id, created_at, profile_id
)
and not exists (select 1 from public.team_members c where c.team_id = m.team_id and c.role = 'captain');

-- Members who joined themselves are linked by their login only (no email or
-- Steam ID needed on the list). Deleting a login removes its membership.
alter table public.team_members drop constraint if exists team_members_check;
select pg_temp.ensure_constraint('public.team_members', 'team_members_identity_check', 'check (user_id is not null or email is not null or steam_id is not null)');
alter table public.team_members drop constraint if exists team_members_user_id_fkey;
select pg_temp.ensure_constraint('public.team_members', 'team_members_user_fkey', 'foreign key (user_id) references auth.users (id) on delete cascade');

-- ---------------------------------------------------------------------------
-- Invite codes: 10 characters without look-alikes (no 0/O/1/I), from
-- Postgres's secure random source (gen_random_uuid), only using the fully
-- random bytes of the UUID so every character is equally likely.
-- ---------------------------------------------------------------------------
create or replace function public.new_invite_code()
returns text
language sql
volatile
set search_path = public
as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', get_byte(r.b, i) % 32 + 1, 1), '' order by i)
  from (select uuid_send(gen_random_uuid()) as b) as r, unnest(array[0, 1, 2, 3, 4, 5, 9, 10, 11, 12]) as i;
$$;
revoke all on function public.new_invite_code() from public, anon, authenticated;

alter table public.teams add column if not exists invite_code text;
alter table public.teams add column if not exists invite_enabled boolean not null default true;
alter table public.teams add column if not exists created_by uuid references auth.users (id) on delete set null;
update public.teams set invite_code = public.new_invite_code() where invite_code is null;
alter table public.teams alter column invite_code set default public.new_invite_code();
alter table public.teams alter column invite_code set not null;
select pg_temp.ensure_constraint('public.teams', 'teams_invite_code_key', 'unique (invite_code)');
select pg_temp.ensure_constraint('public.teams', 'teams_invite_code_check', $c$check (invite_code ~ '^[A-HJ-NP-Z2-9]{10}$')$c$);

-- Members can read their team's name, never its invite code (captains get it
-- from my_team()).
revoke select on public.teams from authenticated;
grant select (id, name, created_at) on public.teams to authenticated;

-- ---------------------------------------------------------------------------
-- Private logs for the limits (only these functions use them).
-- ---------------------------------------------------------------------------
create table if not exists public.team_join_attempts (
  user_id uuid not null,
  at timestamptz not null default now()
);
create index if not exists team_join_attempts_user_at_idx on public.team_join_attempts (user_id, at);
create table if not exists public.team_creations (
  user_id uuid not null,
  at timestamptz not null default now()
);
create index if not exists team_creations_user_at_idx on public.team_creations (user_id, at);
alter table public.team_join_attempts enable row level security;
alter table public.team_creations enable row level security;
revoke all on public.team_join_attempts, public.team_creations from anon, authenticated;
delete from public.team_join_attempts where at < now() - interval '1 day';
delete from public.team_creations where at < now() - interval '2 days';

-- ---------------------------------------------------------------------------
-- The signed-in member's team: { id, name, role, player }, plus
-- { inviteCode, inviteEnabled } for captains. null when not in a team.
-- ---------------------------------------------------------------------------
create or replace function public.my_team()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select (
    jsonb_build_object('id', t.id, 'name', t.name, 'role', m.role, 'player', p.name)
    || case when m.role = 'captain' then jsonb_build_object('inviteCode', t.invite_code, 'inviteEnabled', t.invite_enabled) else '{}'::jsonb end
  )::json
  from public.team_members m
  join public.teams t on t.id = m.team_id
  join public.profiles p on p.id = m.profile_id
  where m.user_id = auth.uid();
$$;

-- The members of the signed-in member's team (for the team settings screen).
create or replace function public.my_team_members()
returns table (profile_id uuid, player text, role text, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  select m.profile_id, p.name, m.role, m.user_id is not distinct from auth.uid()
  from public.team_members m
  join public.profiles p on p.id = m.profile_id
  where m.team_id = public.current_team_id()
  order by m.role, p.name;
$$;

-- Normalises what people type: "abcd-efgh 23" -> "ABCDEFGH23".
create or replace function public.clean_invite_code(code text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;
revoke all on function public.clean_invite_code(text) from public, anon, authenticated;

-- Counts this attempt and says whether the caller is over the limit
-- (10 invite-code tries per 10 minutes), so codes can't be guessed.
create or replace function public.invite_attempt_allowed(uid uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.team_join_attempts where user_id = uid and at > now() - interval '10 minutes') >= 10 then
    return false;
  end if;
  insert into public.team_join_attempts (user_id) values (uid);
  return true;
end;
$$;
revoke all on function public.invite_attempt_allowed(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Create a team: the caller becomes its first player and captain.
-- Returns { ok: true, team } or { ok: false, reason }:
--   not-signed-in, already-in-team, bad-team-name, bad-player-name,
--   too-many-teams (3 per day), team-name-taken
-- ---------------------------------------------------------------------------
create or replace function public.create_my_team(team_name text, player_name text)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  tname text := btrim(coalesce(team_name, ''));
  pname text := btrim(coalesce(player_name, ''));
  tid uuid;
  pid uuid;
begin
  if uid is null then
    return json_build_object('ok', false, 'reason', 'not-signed-in');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('r6-member:' || uid::text, 0));
  if exists (select 1 from public.team_members where user_id = uid) then
    return json_build_object('ok', false, 'reason', 'already-in-team');
  end if;
  if char_length(tname) not between 1 and 40 then
    return json_build_object('ok', false, 'reason', 'bad-team-name');
  end if;
  if char_length(pname) not between 1 and 24 then
    return json_build_object('ok', false, 'reason', 'bad-player-name');
  end if;
  if (select count(*) from public.team_creations where user_id = uid and at > now() - interval '1 day') >= 3 then
    return json_build_object('ok', false, 'reason', 'too-many-teams');
  end if;
  if exists (select 1 from public.teams where lower(name) = lower(tname)) then
    return json_build_object('ok', false, 'reason', 'team-name-taken');
  end if;
  begin
    insert into public.teams (name, created_by) values (tname, uid) returning id into tid;
  exception when unique_violation then
    return json_build_object('ok', false, 'reason', 'team-name-taken');
  end;
  insert into public.team_creations (user_id) values (uid);
  insert into public.profiles (team_id, name) values (tid, pname) returning id into pid;
  insert into public.team_members (profile_id, team_id, user_id, role) values (pid, tid, uid, 'captain');
  return json_build_object('ok', true, 'team', public.my_team());
end;
$$;

-- ---------------------------------------------------------------------------
-- Look at an invite before joining: the team's name and its roster players
-- who don't have a login yet (to join as one of them). Counts as an attempt.
-- Returns { ok: true, team: { name }, players: [{ id, name }] } or
-- { ok: false, reason }: not-signed-in, already-in-team, rate-limited, invalid-code
-- ---------------------------------------------------------------------------
create or replace function public.peek_invite(code text)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  t record;
begin
  if uid is null then
    return json_build_object('ok', false, 'reason', 'not-signed-in');
  end if;
  if exists (select 1 from public.team_members where user_id = uid) then
    return json_build_object('ok', false, 'reason', 'already-in-team');
  end if;
  if not public.invite_attempt_allowed(uid) then
    return json_build_object('ok', false, 'reason', 'rate-limited');
  end if;
  select id, name into t from public.teams where invite_code = public.clean_invite_code(code) and invite_enabled;
  if not found then
    return json_build_object('ok', false, 'reason', 'invalid-code');
  end if;
  return json_build_object(
    'ok', true,
    'team', json_build_object('name', t.name),
    'players', coalesce((
      select json_agg(json_build_object('id', p.id, 'name', p.name) order by p.name)
      from public.profiles p
      where p.team_id = t.id and not exists (select 1 from public.team_members m where m.profile_id = p.id)
    ), '[]'::json)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Join a team with its invite code, as a new player or as a roster player of
-- that team who has no login yet. Returns { ok: true, team } or
-- { ok: false, reason }: not-signed-in, already-in-team, rate-limited,
-- invalid-code, team-full (20 members), bad-player-name, player-name-taken,
-- player-taken
-- ---------------------------------------------------------------------------
create or replace function public.join_team(code text, player_name text, existing_profile_id uuid default null)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  pname text := btrim(coalesce(player_name, ''));
  t record;
  pid uuid;
begin
  if uid is null then
    return json_build_object('ok', false, 'reason', 'not-signed-in');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('r6-member:' || uid::text, 0));
  if exists (select 1 from public.team_members where user_id = uid) then
    return json_build_object('ok', false, 'reason', 'already-in-team');
  end if;
  if not public.invite_attempt_allowed(uid) then
    return json_build_object('ok', false, 'reason', 'rate-limited');
  end if;
  select id, name into t from public.teams where invite_code = public.clean_invite_code(code) and invite_enabled for update;
  if not found then
    return json_build_object('ok', false, 'reason', 'invalid-code');
  end if;
  if (select count(*) from public.team_members where team_id = t.id) >= 20 then
    return json_build_object('ok', false, 'reason', 'team-full');
  end if;
  if existing_profile_id is not null then
    select p.id into pid from public.profiles p
    where p.id = existing_profile_id and p.team_id = t.id
      and not exists (select 1 from public.team_members m where m.profile_id = p.id)
    for update;
    if pid is null then
      return json_build_object('ok', false, 'reason', 'player-taken');
    end if;
  else
    if char_length(pname) not between 1 and 24 then
      return json_build_object('ok', false, 'reason', 'bad-player-name');
    end if;
    begin
      insert into public.profiles (team_id, name) values (t.id, pname) returning id into pid;
    exception when unique_violation then
      return json_build_object('ok', false, 'reason', 'player-name-taken');
    end;
  end if;
  begin
    insert into public.team_members (profile_id, team_id, user_id, role) values (pid, t.id, uid, 'member');
  exception when unique_violation then
    return json_build_object('ok', false, 'reason', 'player-taken');
  end;
  return json_build_object('ok', true, 'team', public.my_team());
end;
$$;

-- ---------------------------------------------------------------------------
-- Captains only. Each raises an error whose message is "r6:<reason>" when it
-- can't: not-captain, not-in-team, bad-team-name, team-name-taken, bad-role,
-- last-captain, use-leave, wrong-name.
-- ---------------------------------------------------------------------------
create or replace function public.captain_team_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tid uuid;
begin
  select team_id into tid from public.team_members where user_id = auth.uid() and role = 'captain';
  if tid is null then
    raise exception 'r6:not-captain' using errcode = '42501';
  end if;
  return tid;
end;
$$;
revoke all on function public.captain_team_id() from public, anon, authenticated;

-- A new invite code; the old one stops working.
create or replace function public.regenerate_invite()
returns text
language sql
volatile
security definer
set search_path = public
as $$
  update public.teams set invite_code = public.new_invite_code() where id = public.captain_team_id() returning invite_code;
$$;

create or replace function public.set_invite_enabled(enabled boolean)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.teams set invite_enabled = coalesce(enabled, false) where id = public.captain_team_id();
$$;

create or replace function public.rename_team(new_name text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  tid uuid := public.captain_team_id();
  tname text := btrim(coalesce(new_name, ''));
begin
  if char_length(tname) not between 1 and 40 then
    raise exception 'r6:bad-team-name';
  end if;
  if exists (select 1 from public.teams where lower(name) = lower(tname) and id <> tid) then
    raise exception 'r6:team-name-taken';
  end if;
  update public.teams set name = tname where id = tid;
exception when unique_violation then
  raise exception 'r6:team-name-taken';
end;
$$;

-- Removes a member's access. Their roster player and history stay with the team.
create or replace function public.remove_member(member_profile_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  tid uuid := public.captain_team_id();
  target record;
begin
  select * into target from public.team_members where profile_id = member_profile_id and team_id = tid;
  if not found then
    raise exception 'r6:not-in-team';
  end if;
  if target.user_id is not distinct from auth.uid() then
    raise exception 'r6:use-leave';
  end if;
  delete from public.team_members where profile_id = member_profile_id and team_id = tid;
end;
$$;

-- Make someone captain or member. The last captain can't be made a member.
create or replace function public.set_role(member_profile_id uuid, new_role text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  tid uuid := public.captain_team_id();
  target record;
begin
  if new_role not in ('captain', 'member') then
    raise exception 'r6:bad-role';
  end if;
  select * into target from public.team_members where profile_id = member_profile_id and team_id = tid for update;
  if not found then
    raise exception 'r6:not-in-team';
  end if;
  if new_role = 'member' and target.role = 'captain'
     and (select count(*) from public.team_members where team_id = tid and role = 'captain') <= 1 then
    raise exception 'r6:last-captain';
  end if;
  update public.team_members set role = new_role where profile_id = member_profile_id and team_id = tid;
end;
$$;

-- Deletes the team and everything in it. The exact team name must be typed.
create or replace function public.delete_team(confirm_name text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  tid uuid := public.captain_team_id();
begin
  if confirm_name is distinct from (select name from public.teams where id = tid) then
    raise exception 'r6:wrong-name';
  end if;
  delete from public.teams where id = tid;
end;
$$;

-- Anyone in a team can leave. The last captain must first make someone else
-- captain (when there are other members). The team itself stays.
create or replace function public.leave_team()
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  me record;
begin
  select * into me from public.team_members where user_id = auth.uid() for update;
  if not found then
    raise exception 'r6:not-in-team';
  end if;
  if me.role = 'captain'
     and (select count(*) from public.team_members where team_id = me.team_id and role = 'captain') <= 1
     and (select count(*) from public.team_members where team_id = me.team_id) > 1 then
    raise exception 'r6:last-captain';
  end if;
  delete from public.team_members where profile_id = me.profile_id;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'my_team()', 'my_team_members()', 'create_my_team(text, text)', 'peek_invite(text)', 'join_team(text, text, uuid)',
    'regenerate_invite()', 'set_invite_enabled(boolean)', 'rename_team(text)', 'remove_member(uuid)',
    'set_role(uuid, text)', 'delete_team(text)', 'leave_team()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
