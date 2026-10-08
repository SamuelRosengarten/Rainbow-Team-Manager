// A small stateful stand-in for Supabase, for the self-serve end-to-end tests
// (selfserve.spec.js): Auth (sign up, confirm, sign in, resend, sign out) and
// the self-serve team functions, answering like supabase/selfserve.sql does.
// The online build used by those tests points at https://e2e.supabase.co.
import { randomUUID } from 'node:crypto';

export const SUPABASE = 'https://e2e.supabase.co';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (user) =>
  `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 10 }, () => CODE_CHARS[Math.floor(Math.random() * 32)]).join('');

export function createBackend() {
  const users = new Map(); // email -> { id, email, password, confirmed }
  const teams = new Map(); // id -> { id, name, inviteCode, inviteEnabled }
  const profiles = []; // { id, team_id, name, created_at }
  const members = []; // { profileId, teamId, userId, role }
  const calls = [];

  const memberOf = (user) => members.find((m) => m.userId === user?.id);
  const teamJson = (user) => {
    const m = memberOf(user);
    if (!m) return null;
    const t = teams.get(m.teamId);
    const p = profiles.find((x) => x.id === m.profileId);
    return { id: t.id, name: t.name, role: m.role, player: p.name, ...(m.role === 'captain' ? { inviteCode: t.inviteCode, inviteEnabled: t.inviteEnabled } : {}) };
  };

  const rpc = {
    claim_membership: (u) => {
      const m = memberOf(u);
      return m ? profiles.find((p) => p.id === m.profileId).name : null;
    },
    my_team: (u) => teamJson(u),
    create_my_team: (u, { team_name, player_name }) => {
      if (memberOf(u)) return { ok: false, reason: 'already-in-team' };
      if ([...teams.values()].some((t) => t.name.toLowerCase() === team_name.toLowerCase())) return { ok: false, reason: 'team-name-taken' };
      const team = { id: randomUUID(), name: team_name, inviteCode: newCode(), inviteEnabled: true };
      teams.set(team.id, team);
      const p = { id: randomUUID(), team_id: team.id, name: player_name, created_at: new Date().toISOString() };
      profiles.push(p);
      members.push({ profileId: p.id, teamId: team.id, userId: u.id, role: 'captain' });
      return { ok: true, team: teamJson(u) };
    },
    peek_invite: (u, { code }) => {
      if (memberOf(u)) return { ok: false, reason: 'already-in-team' };
      const t = [...teams.values()].find((x) => x.inviteCode === code && x.inviteEnabled);
      if (!t) return { ok: false, reason: 'invalid-code' };
      const free = profiles.filter((p) => p.team_id === t.id && !members.some((m) => m.profileId === p.id));
      return { ok: true, team: { name: t.name }, players: free.map((p) => ({ id: p.id, name: p.name })) };
    },
    join_team: (u, { code, player_name, existing_profile_id }) => {
      if (memberOf(u)) return { ok: false, reason: 'already-in-team' };
      const t = [...teams.values()].find((x) => x.inviteCode === code && x.inviteEnabled);
      if (!t) return { ok: false, reason: 'invalid-code' };
      let p = existing_profile_id ? profiles.find((x) => x.id === existing_profile_id && x.team_id === t.id && !members.some((m) => m.profileId === x.id)) : null;
      if (existing_profile_id && !p) return { ok: false, reason: 'player-taken' };
      if (!p) {
        p = { id: randomUUID(), team_id: t.id, name: player_name, created_at: new Date().toISOString() };
        profiles.push(p);
      }
      members.push({ profileId: p.id, teamId: t.id, userId: u.id, role: 'member' });
      return { ok: true, team: teamJson(u) };
    },
    my_team_members: (u) => {
      const me = memberOf(u);
      return members
        .filter((m) => m.teamId === me?.teamId)
        .map((m) => ({ profile_id: m.profileId, player: profiles.find((p) => p.id === m.profileId).name, role: m.role, is_me: m.userId === u.id }));
    },
    leave_team: (u) => {
      const i = members.findIndex((m) => m.userId === u.id);
      if (i >= 0) members.splice(i, 1);
      return null;
    },
    regenerate_invite: (u) => {
      const t = teams.get(memberOf(u).teamId);
      t.inviteCode = newCode();
      return t.inviteCode;
    },
  };

  /** Add a confirmed user (e.g. a teammate who already has an account). */
  const addUser = (email, password, confirmed = true) => {
    const u = { id: randomUUID(), email, password, confirmed };
    users.set(email, u);
    return u;
  };

  /** Add a roster player without a login to a team. */
  const addRosterPlayer = (teamName, name) => {
    const t = [...teams.values()].find((x) => x.name === teamName);
    profiles.push({ id: randomUUID(), team_id: t.id, name, created_at: new Date().toISOString() });
  };

  async function attach(page) {
    // Realtime: accept the socket, never send anything (live updates aren't tested here).
    await page.routeWebSocket(/e2e\.supabase\.co/, () => {});
    await page.route(`${SUPABASE}/**`, async (route) => {
      const r = route.request();
      const url = new URL(r.url());
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
      const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(body) });
      if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      const body = r.postData() ? JSON.parse(r.postData()) : {};
      const token = (r.headers().authorization ?? '').replace(/^Bearer /, '');
      let me = null;
      try {
        const sub = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()).sub;
        me = [...users.values()].find((x) => x.id === sub) ?? null;
      } catch {
        // the anon key: nobody signed in
      }
      calls.push(`${r.method()} ${url.pathname}`);
      const session = (u) => ({ access_token: jwt(u), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: `r-${u.id}`, user: { id: u.id, email: u.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, identities: [{ id: u.id }] } });

      switch (url.pathname) {
        case '/auth/v1/signup': {
          const known = users.get(body.email);
          if (known?.confirmed) return json({ id: known.id, email: known.email, identities: [] }); // Supabase hides that it exists
          const u = known ?? addUser(body.email, body.password, false);
          return json({ id: u.id, email: u.email, identities: [{ id: u.id }] });
        }
        case '/auth/v1/token': {
          const u = users.get(body.email);
          if (!u || u.password !== body.password) return json({ code: 'invalid_credentials', error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400);
          if (!u.confirmed) return json({ code: 'email_not_confirmed', error_code: 'email_not_confirmed', msg: 'Email not confirmed' }, 400);
          return json(session(u));
        }
        case '/auth/v1/resend':
          return json({});
        case '/auth/v1/logout':
          return route.fulfill({ status: 204, headers: cors });
        case '/auth/v1/user':
          return me ? json(session(me).user) : json({ msg: 'no user' }, 401);
        default:
          break;
      }
      if (url.pathname.startsWith('/rest/v1/rpc/')) {
        const fn = url.pathname.slice('/rest/v1/rpc/'.length);
        if (!rpc[fn]) return json({ code: 'PGRST202', message: `Could not find the function public.${fn}` }, 404);
        if (!me) return json({ code: '42501', message: 'permission denied' }, 401);
        return json(rpc[fn](me, body));
      }
      const table = url.pathname.slice('/rest/v1/'.length);
      const m = memberOf(me);
      if (table === 'profiles') return json(profiles.filter((p) => p.team_id === m?.teamId).map(({ id, name, created_at }) => ({ id, name, created_at })));
      if (table === 'team_state') return json(m ? [{ team_id: m.teamId, side: 'attack', map_id: '', site: '', bans: [], lineup: null, tactic_id: null, owned_only: false }] : []);
      return json([]);
    });
  }

  return { attach, addUser, addRosterPlayer, users, teams, members, calls };
}
