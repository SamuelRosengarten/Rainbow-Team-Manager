import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Fullscreen for one element. Uses the Fullscreen API where it exists and
 * otherwise (iPhone Safari) a fixed full-viewport overlay styled by the
 * caller from `full`. While open the page doesn't scroll; on leaving, the
 * scroll position comes back. A history entry is pushed so the phone's back
 * gesture leaves fullscreen instead of the page.
 * @returns {[boolean, () => void, () => void]} [full, enter, exit]
 */
export function useFullscreen(ref) {
  const [full, setFull] = useState(false);
  const state = useRef({ full: false, scrollY: 0, pushed: false, hash: '' });

  const cleanup = useCallback(() => {
    const st = state.current;
    if (!st.full) return;
    st.full = false;
    setFull(false);
    document.documentElement.classList.remove('is-fullscreen-editor');
    // After the editor is back in the page (next frames), not before: the
    // layout changes when it leaves the overlay.
    const y = st.scrollY;
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
    // Going back over our history entry must not move the page either.
    setTimeout(() => {
      window.scrollTo(0, y);
      try {
        window.history.scrollRestoration = st.restoration ?? 'auto';
      } catch {
        // ignore
      }
    }, 300);
  }, []);

  const exit = useCallback(() => {
    const st = state.current;
    if (!st.full) return;
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    cleanup();
    if (st.pushed) {
      st.pushed = false;
      window.history.back();
    }
  }, [cleanup]);

  const enter = useCallback(() => {
    const st = state.current;
    if (st.full) return;
    st.full = true;
    st.scrollY = window.scrollY;
    try {
      st.restoration = window.history.scrollRestoration;
      window.history.scrollRestoration = 'manual';
    } catch {
      // ignore
    }
    setFull(true);
    document.documentElement.classList.add('is-fullscreen-editor');
    try {
      window.history.pushState({ ...(window.history.state ?? {}), r6tpFullscreen: true }, '');
      st.pushed = true;
      st.hash = window.location.hash;
    } catch {
      st.pushed = false;
    }
    const el = ref.current;
    if (el?.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {}); // the overlay still works
  }, [ref]);

  useEffect(() => {
    // Esc in native fullscreen: the browser leaves it; follow.
    const onChange = () => {
      if (!document.fullscreenElement && state.current.full) exit();
    };
    // Back gesture / back button: the pushed entry is gone already.
    const onPop = () => {
      if (!state.current.full) return;
      state.current.pushed = false;
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      cleanup();
    };
    document.addEventListener('fullscreenchange', onChange);
    window.addEventListener('popstate', onPop);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      window.removeEventListener('popstate', onPop);
    };
  }, [exit, cleanup]);

  // Leaving the page (another step) while fullscreen: undo everything.
  useEffect(
    () => () => {
      const st = state.current;
      if (!st.full) return;
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      document.documentElement.classList.remove('is-fullscreen-editor');
      st.full = false;
      // Only drop our own entry: if the page moved on, going back would undo that.
      if (st.pushed && window.location.hash === st.hash) window.history.back();
      st.pushed = false;
    },
    [],
  );

  return [full, enter, exit];
}
