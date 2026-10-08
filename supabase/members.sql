-- R6 Tactical Command: logins (team members and Steam sign-in).
--
-- UPGRADING an existing setup? Run THIS file first (Supabase -> SQL Editor).
-- It only ADDS things: the team_members list, the membership check and the
-- Steam sign-in tables. Nobody's access changes yet, so the current website
-- keeps working while you create the logins. Then follow the README
-- ("Upgrading an existing setup") and run schema.sql LAST.
--
-- New setups don't need this file: schema.sql contains the same statements
-- (a test keeps them identical). Safe to run again.

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
