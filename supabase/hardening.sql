-- Hardening (added later): safer Steam sign-in, and each player edits their
-- own player details and operator pool (captains edit anyone's).
-- Paste this whole file into Supabase -> SQL Editor and run it, THEN deploy
-- the steam-auth Edge Function again (see "Upgrading an existing setup" in
-- the README). It changes no data. schema.sql contains the same statements
-- (a test keeps them identical), so new setups get them too.

-- ---------------------------------------------------------------------------
-- Steam sign-in: who already holds an address. The steam-auth Edge Function
-- (service role only) refuses to sign a Steam player into an account someone
-- else registered with a password and never confirmed (or a Steam address
-- it didn't make): otherwise that person could wait for the Steam owner to
-- sign in, then use their password to get into the owner's team.
-- Returns null (no account) or { hasPassword, confirmed, steamId }.
-- ---------------------------------------------------------------------------
create or replace function public.steam_account_check(account_email text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'hasPassword', coalesce(u.encrypted_password, '') <> '',
    'confirmed', u.email_confirmed_at is not null,
    'steamId', u.raw_app_meta_data ->> 'steam_id'
  )
  from auth.users u
  where lower(u.email) = lower(btrim(coalesce(account_email, '')))
  limit 1;
$$;
revoke all on function public.steam_account_check(text) from public, anon, authenticated;
grant execute on function public.steam_account_check(text) to service_role;

-- ---------------------------------------------------------------------------
-- Players edit their own details and operator pool; captains edit anyone's
-- (and add roster players). Everyone in the team still reads everything.
-- ---------------------------------------------------------------------------
create or replace function public.my_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select profile_id from public.team_members where user_id = auth.uid();
$$;

create or replace function public.is_team_captain()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.team_members where user_id = auth.uid() and role = 'captain');
$$;

revoke all on function public.my_profile_id() from public, anon;
revoke all on function public.is_team_captain() from public, anon;
grant execute on function public.my_profile_id() to authenticated;
grant execute on function public.is_team_captain() to authenticated;

drop policy if exists "team add profiles" on public.profiles;
create policy "team add profiles" on public.profiles
  for insert to authenticated
  with check (team_id = (select public.current_team_id()) and (select public.is_team_captain()) and char_length(btrim(name)) between 1 and 24);

drop policy if exists "team all player_details" on public.player_details;
drop policy if exists "team read player_details" on public.player_details;
drop policy if exists "own or captain player_details" on public.player_details;
create policy "team read player_details" on public.player_details
  for select to authenticated using (team_id = (select public.current_team_id()));
create policy "own or captain player_details" on public.player_details
  for all to authenticated
  using (team_id = (select public.current_team_id()) and (profile_id = (select public.my_profile_id()) or (select public.is_team_captain())))
  with check (team_id = (select public.current_team_id()) and (profile_id = (select public.my_profile_id()) or (select public.is_team_captain())));

drop policy if exists "team all owned_operators" on public.owned_operators;
drop policy if exists "team read owned_operators" on public.owned_operators;
drop policy if exists "own or captain owned_operators" on public.owned_operators;
create policy "team read owned_operators" on public.owned_operators
  for select to authenticated using (team_id = (select public.current_team_id()));
create policy "own or captain owned_operators" on public.owned_operators
  for all to authenticated
  using (team_id = (select public.current_team_id()) and (profile_id = (select public.my_profile_id()) or (select public.is_team_captain())))
  with check (team_id = (select public.current_team_id()) and (profile_id = (select public.my_profile_id()) or (select public.is_team_captain())));

drop policy if exists "team all preferred_operators" on public.preferred_operators;
drop policy if exists "team read preferred_operators" on public.preferred_operators;
drop policy if exists "own or captain preferred_operators" on public.preferred_operators;
create policy "team read preferred_operators" on public.preferred_operators
  for select to authenticated using (team_id = (select public.current_team_id()));
create policy "own or captain preferred_operators" on public.preferred_operators
  for all to authenticated
  using (team_id = (select public.current_team_id()) and (profile_id = (select public.my_profile_id()) or (select public.is_team_captain())))
  with check (team_id = (select public.current_team_id()) and (profile_id = (select public.my_profile_id()) or (select public.is_team_captain())));
