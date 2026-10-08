import { useCallback, useEffect, useState } from 'react';
import * as api from '../lib/api.js';
import { errorMsg } from '../lib/errors.js';
import { msg } from '../i18n/index.js';

// A Steam answer can be swapped for a session once (its nonce is used up), so
// the swap is shared even when React runs the effect twice (StrictMode).
let steamSwap = null;
const swapSteamOnce = (params) => (steamSwap ??= api.signInWithSteam(params));

const here = () => `${location.origin}${location.pathname}`;
const CHECK_EVERY_MS = 30_000;

/** The signed-in user's player name and team (claim first: it links an admin-added login on first sign-in). */
async function lookUpMembership() {
  const name = await api.claimMembership();
  const team = name ? await api.fetchMyTeam() : null;
  api.setTeam(team);
  return { name, team };
}

const sameMembership = (a, b) => a.name === b.name && JSON.stringify(a.team) === JSON.stringify(b.team);

/**
 * Who is signed in (Supabase Auth) and whether they're in a team.
 *
 * status:
 *   'loading'   session not known yet, or a Steam sign-in is finishing
 *   'signedOut' show the login screen
 *   'recovery'  came back from a password-reset email: choose a new password
 *   'checking'  signed in, looking up team membership
 *   'notMember' signed in, but not in a team yet: create or join one (Get started)
 *   'error'     the membership lookup failed (retry)
 *   'ready'     in a team: `member` is their roster name, `team` their team
 *               ({ id, name, role, player, and inviteCode / inviteEnabled for captains })
 *
 * While in a team, membership is checked again every 30 s and when the tab
 * comes back into view, so a removed member (or a deleted team) lands back on
 * Get started, and a rename or new role shows up.
 *
 * @param opts.steamReturn takeSteamReturn() result for this page load (website), or null
 * @param opts.enabled     false without Supabase settings (offline): nobody signs in, status is 'ready'
 */
export function useAuth({ steamReturn = null, enabled = true } = {}) {
  const [session, setSession] = useState(undefined);
  const [recovery, setRecovery] = useState(false);
  const [steamBusy, setSteamBusy] = useState(Boolean(steamReturn?.params));
  const [error, setError] = useState(steamReturn?.error ? msg('auth.error.steamFailed') : null);
  const [membership, setMembership] = useState({ userId: null, name: undefined, team: null, error: null });
  const [retryKey, setRetryKey] = useState(0);

  // Session changes: sign-in, sign-out (also when a refresh fails or the session
  // is revoked), token refresh, and the password-recovery link.
  useEffect(() => {
    if (!enabled) return undefined;
    return api.onAuthChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') setRecovery(false);
      setSession(s ?? null);
    });
  }, [enabled]);

  useEffect(() => {
    if (!steamReturn?.params) return undefined;
    let cancelled = false;
    swapSteamOnce(steamReturn.params)
      .catch((e) => !cancelled && setError(errorMsg(e)))
      .finally(() => !cancelled && setSteamBusy(false));
    return () => {
      cancelled = true;
    };
  }, [steamReturn]);

  const userId = session?.user?.id ?? null;
  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    lookUpMembership()
      .then(({ name, team }) => !cancelled && setMembership({ userId, name, team, error: null }))
      .catch((e) => !cancelled && setMembership({ userId, name: undefined, team: null, error: errorMsg(e) }));
    return () => {
      cancelled = true;
    };
  }, [userId, retryKey]);

  /** Look membership up again without a loading screen (after joining, a captain action, or the periodic check). */
  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const next = await lookUpMembership();
      setMembership((cur) => (cur.userId === userId && !cur.error && sameMembership(cur, next) ? cur : { userId, ...next, error: null }));
    } catch {
      // offline for a moment: the next check tries again
    }
  }, [userId]);

  const inTeam = Boolean(userId && membership.userId === userId && membership.name);
  useEffect(() => {
    if (!inTeam) return undefined;
    const timer = setInterval(refresh, CHECK_EVERY_MS);
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [inTeam, refresh]);

  let status;
  if (!enabled) status = 'ready';
  else if (session === undefined || steamBusy) status = 'loading';
  else if (!session) status = 'signedOut';
  else if (recovery) status = 'recovery';
  else if (membership.userId !== userId) status = 'checking';
  else if (membership.error) status = 'error';
  else if (membership.name === null) status = 'notMember';
  else status = 'ready';

  const signIn = useCallback(async (email, password) => {
    setError(null);
    await api.signInWithPassword(email, password);
  }, []);

  /** Overlay: finish a Steam sign-in from the params its local server received. */
  const signInSteam = useCallback(async (params) => {
    setError(null);
    setSteamBusy(true);
    try {
      await api.signInWithSteam(params);
    } finally {
      setSteamBusy(false);
    }
  }, []);

  const sendReset = useCallback((email) => api.sendPasswordReset(email, here()), []);

  /** Create an account; Supabase emails a confirmation link back to this page. */
  const signUp = useCallback((email, password) => {
    setError(null);
    return api.signUp(email, password, here());
  }, []);

  const resendConfirmation = useCallback((email) => api.resendConfirmation(email, here()), []);

  const setPassword = useCallback(async (password) => {
    await api.updatePassword(password);
    setRecovery(false);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.signOut();
    } catch {
      // already signed out on the server, or offline: the local session is cleared anyway
    }
    api.setTeam(null);
    setSession(null);
  }, []);

  return {
    status,
    member: membership.name ?? null,
    team: membership.team,
    email: session?.user?.email ?? '',
    error: status === 'error' ? membership.error : error,
    setError,
    retry: () => setRetryKey((k) => k + 1),
    refresh,
    signIn,
    signUp,
    resendConfirmation,
    signInSteam,
    sendReset,
    setPassword,
    signOut,
  };
}
