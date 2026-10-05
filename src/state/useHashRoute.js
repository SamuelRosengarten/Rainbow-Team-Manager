import { useCallback, useSyncExternalStore } from 'react';

export const ROUTES = ['home', 'matches', 'plan', 'tactics', 'team'];

/** "#/matches/abc" -> { view: 'matches', sub: 'abc' }. Unknown views go home. */
export function parseHash(hash) {
  const [view = '', ...rest] = String(hash ?? '').replace(/^#\/?/, '').split('/');
  return ROUTES.includes(view) ? { view, sub: decodeURIComponent(rest.join('/')) } : { view: 'home', sub: '' };
}

const subscribe = (cb) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};
const getHash = () => window.location.hash;

/**
 * Hash-based routing: works on Vercel with no rewrites, and the back button,
 * refresh and shared links keep you on the same screen.
 */
export function useHashRoute() {
  const hash = useSyncExternalStore(subscribe, getHash, () => '');
  const navigate = useCallback((path) => {
    const next = `#/${path}`;
    if (window.location.hash !== next) window.location.hash = next;
    window.scrollTo(0, 0);
  }, []);
  return { ...parseHash(hash), navigate };
}
