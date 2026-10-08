// What the app remembers in this browser.

const PROFILE_KEY = 'r6tp.profile';

// Offline mode only: localStorage holds the selected profile. (Online, the
// profile is the signed-in team member's.) Without `valid`, the stored name
// is returned as is (checked later, once the roster has loaded).
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
