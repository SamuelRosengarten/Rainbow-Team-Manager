// Self-serve teams on the website: invite codes and links, name rules, and the
// errors a confirmation link can come back with. Pure functions, tested in
// invite.test.js. The database checks everything again (supabase/selfserve.sql).

/** Characters an invite code can have: no 0/O/1/I look-alikes. */
export const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** What someone types or pastes -> the code as stored ("abcd-efgh 23" -> "ABCDEFGH23"), like clean_invite_code(). */
export const cleanInviteCode = (text) => String(text ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

/** A code that could be valid (10 characters of the alphabet). */
export const isInviteCode = (code) => new RegExp(`^[${INVITE_ALPHABET}]{10}$`).test(cleanInviteCode(code));

/** The invite code in "#/join/<CODE>", or null. */
export function inviteCodeFromHash(hash) {
  const m = /^#\/join\/([^/?#]+)/.exec(String(hash ?? ''));
  if (!m) return null;
  let raw = m[1];
  try {
    raw = decodeURIComponent(raw);
  } catch {
    // keep it as is
  }
  const code = cleanInviteCode(raw);
  return isInviteCode(code) ? code : null;
}

/** The link a captain shares: https://site/#/join/CODE (the page itself, without any query). */
export const inviteLink = (loc, code) => `${loc.origin}${loc.pathname}#/join/${cleanInviteCode(code)}`;

/** "ABCDEFGH23" -> "ABCDE-FGH23", easier to read out. */
export const formatInviteCode = (code) => cleanInviteCode(code).replace(/^(.{5})(.+)$/, '$1-$2');

/** Team names: 1–40 characters once trimmed. Player names: 1–24. (Same rules as the database.) */
export const validTeamName = (name) => {
  const n = String(name ?? '').trim();
  return n.length >= 1 && n.length <= 40;
};
export const validPlayerName = (name) => {
  const n = String(name ?? '').trim();
  return n.length >= 1 && n.length <= 24;
};

/** Passwords for new accounts: at least 8 characters. */
export const validNewPassword = (password) => String(password ?? '').length >= 8;

const JOIN_KEY = 'r6tp.join';

/** Remember an invite code from the address while the player signs in or signs up. */
export function rememberInvite(code, storage = globalThis.sessionStorage) {
  try {
    if (code) storage?.setItem(JOIN_KEY, cleanInviteCode(code));
    else storage?.removeItem(JOIN_KEY);
  } catch {
    // storage blocked: they can type the code
  }
}

export function rememberedInvite(storage = globalThis.sessionStorage) {
  try {
    const code = storage?.getItem(JOIN_KEY);
    return code && isInviteCode(code) ? code : null;
  } catch {
    return null;
  }
}

/**
 * An error a Supabase email link came back with (e.g. an expired
 * confirmation link): "?error_code=otp_expired" or "#error_code=…". Returns
 * the error code ('otp_expired', 'access_denied', …) or null, and removes it
 * from the address bar.
 */
export function takeAuthLinkError(loc = globalThis.location, history = globalThis.history) {
  const read = (s) => {
    const p = new URLSearchParams(String(s ?? '').replace(/^[?#]/, ''));
    return p.get('error_code') || p.get('error') || null;
  };
  const fromSearch = read(loc.search);
  const fromHash = /(^#|&)error(_code)?=/.test(loc.hash ?? '') ? read(loc.hash) : null;
  const code = fromSearch || fromHash;
  if (!code) return null;
  history?.replaceState?.(null, '', `${loc.pathname}${fromHash ? '' : loc.hash ?? ''}`);
  return code.slice(0, 40);
}
