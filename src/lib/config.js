// Runtime configuration from Vite env vars.

/**
 * VITE_REQUIRE_PASSCODE: "true" / "false". When unset, the gate is on for
 * production builds and off for local dev.
 */
export function parseRequirePasscode(value, isProd) {
  const v = String(value ?? '').trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(v)) return true;
  if (['false', '0', 'no', 'off'].includes(v)) return false;
  return Boolean(isProd);
}

export const REQUIRE_PASSCODE = parseRequirePasscode(import.meta.env.VITE_REQUIRE_PASSCODE, import.meta.env.PROD);

const PROFILE_KEY = 'r6tp.profile';
const PASSCODE_SESSION_KEY = 'r6tp.passcode-ok';

// localStorage holds only the selected profile. Without `valid`, the stored
// name is returned as is (checked later, once the roster has loaded).
export function loadProfile(valid) {
  try {
    const v = localStorage.getItem(PROFILE_KEY);
    if (!valid) return v || null;
    return valid.includes(v) ? v : null;
  } catch {
    return null;
  }
}

export function storeProfile(name) {
  try {
    if (name) localStorage.setItem(PROFILE_KEY, name);
    else localStorage.removeItem(PROFILE_KEY);
  } catch {
    // storage blocked (private mode): the choice lasts until reload
  }
}

// Passing the gate lasts for this browser tab session only.
export function passcodePassed() {
  try {
    return sessionStorage.getItem(PASSCODE_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function markPasscodePassed() {
  try {
    sessionStorage.setItem(PASSCODE_SESSION_KEY, '1');
  } catch {
    // ignore
  }
}
