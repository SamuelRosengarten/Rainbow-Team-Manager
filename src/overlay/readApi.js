// The overlay's only door to the team's tables: the read functions of
// lib/api.js and nothing else. The overlay never saves, deletes or assigns
// anything (noWrites.test.js fails if any overlay file imports another api
// function or calls .insert / .update / .upsert / .delete). Signing in goes
// through state/useAuth.js, shared with the website.
export {
  isConfigured,
  fetchProfiles,
  fetchStrategies,
  fetchStrategyAssignments,
  subscribe,
} from '../lib/api.js';
