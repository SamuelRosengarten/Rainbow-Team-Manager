import { useCallback, useEffect, useState } from 'react';
import * as api from '../lib/api.js';
import { errorMsg } from '../lib/errors.js';
import { msg } from '../i18n/index.js';

// A Steam answer can be swapped for a session once (its nonce is used up), so
// the swap is shared even when React runs the effect twice (StrictMode).
let steamSwap = null;
const swapSteamOnce = (params) => (steamSwap ??= api.signInWithSteam(params));

/**
 * Who is signed in (Supabase Auth) and whether they're on the team.
 *
 * status:
 *   'loading'   session not known yet, or a Steam sign-in is finishing
 *   'signedOut' show the login screen
 *   'recovery'  came back from a password-reset email: choose a new password
 *   'checking'  signed in, looking up team membership
 *   'notMember' signed in, but not on team_members
 *   'error'     the membership lookup failed (retry)
 *   'ready'     a team member: `member` is their roster name
 *
 * @param opts.steamReturn takeSteamReturn() result for this page load (website), or null
 * @param opts.enabled     false without Supabase settings (offline): nobody signs in, status is 'ready'
 */
export function useAuth({ steamReturn = null, enabled = true } = {}) {
  const [session, setSession] = useState(undefined);
  const [recovery, setRecovery] = useState(false);
  const [steamBusy, setSteamBusy] = useState(Boolean(steamReturn?.params));
  const [error, setError] = useState(steamReturn?.error ? msg('auth.error.steamFailed') : null);
  const [membership, setMembership] = useState({ userId: null, name: undefined, error: null });
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
    api
      .claimMembership()
      .then((name) => !cancelled && setMembership({ userId, name, error: null }))
      .catch((e) => !cancelled && setMembership({ userId, name: undefined, error: errorMsg(e) }));
    return () => {
      cancelled = true;
    };
  }, [userId, retryKey]);

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

  const sendReset = useCallback((email) => api.sendPasswordReset(email, `${location.origin}${location.pathname}`), []);

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
    setSession(null);
  }, []);

  return {
    status,
    member: membership.name ?? null,
    email: session?.user?.email ?? '',
    error: status === 'error' ? membership.error : error,
    setError,
    retry: () => setRetryKey((k) => k + 1),
    signIn,
    signInSteam,
    sendReset,
    setPassword,
    signOut,
  };
}
