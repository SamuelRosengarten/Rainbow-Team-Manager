// Hooks of the tactics editor (BoardEditor): feedback, the board's viewport,
// keyboard shortcuts and where the selected item's action bar sits.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { moveItem, toBoardPoint } from '../../lib/board.js';
import { BY_KEY, SIMPLE_KEY } from '../../lib/editorTools.js';
import { fillZoom, viewRect, zoomAt } from '../../lib/tacticStatus.js';

const inField = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

/**
 * Toasts (one at a time; longer when they carry an Undo), the short
 * "just placed" highlight, and undo/redo that say so.
 */
export function useEditorFeedback({ undo, redo, t }) {
  const [toast, setToast] = useState(null);
  const [fresh, setFresh] = useState(null);
  const notify = useCallback((msg, action = null) => setToast({ id: Date.now(), msg, action }), []);
  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), toast.action ? 6000 : 3000);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    if (!fresh) return undefined;
    const id = setTimeout(() => setFresh(null), 700);
    return () => clearTimeout(id);
  }, [fresh]);
  const doUndo = useCallback(() => {
    undo();
    notify(t('planner.toast.undone'));
  }, [undo, notify, t]);
  const doRedo = useCallback(() => {
    redo();
    notify(t('planner.toast.redone'));
  }, [redo, notify, t]);
  return { toast, setToast, notify, fresh, setFresh, doUndo, doRedo };
}

/**
 * The part of the board on screen: zoom and pan (`view`), Ctrl/⌘ + wheel,
 * how each floor opens (whole on a wide screen, zoomed in on what's placed on
 * a phone) and the fullscreen shape. `latest` holds the projected strategy.
 */
export function useBoardViewport({ space, svgRef, canvasRef, full, latest }) {
  const [view, setView] = useState({ z: 1 });
  const vr = viewRect(space, view);
  const latestView = useRef({ view, space });
  useEffect(() => {
    latestView.current = { view, space };
  });

  const zoomBy = useCallback((factor, at = null) => {
    const { view: v, space: s } = latestView.current;
    setView(zoomAt(s, v, factor, at));
  }, []);

  // Ctrl/⌘ + wheel zooms around the cursor (needs a non-passive listener).
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (!(e.ctrlKey || e.metaKey) || !svgRef.current) return;
      e.preventDefault();
      const s = latestView.current.space;
      zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15, toBoardPoint(svgRef.current, e, s));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomBy, canvasRef, svgRef]);

  // Each floor opens whole on a wide screen. On a phone the whole plan is too
  // small to work on, so it opens zoomed in on what's placed (or the middle).
  const shownFloor = space.floorId;
  useEffect(() => {
    const narrow = (canvasRef.current?.getBoundingClientRect().width ?? 1000) < 560;
    if (!narrow) {
      setView({ z: 1 });
      return;
    }
    const pts = latest.current.markers.map((m) => [m.x, m.y]);
    const s = latestView.current.space;
    const [cx, cy] = pts.length ? [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length] : [s.w / 2, s.h / 2];
    setView({ z: 1.8, cx, cy, aspect: 0.9 });
  }, [shownFloor, canvasRef, latest]);

  // Fullscreen: let the board fill the screen's shape (taller than the plan
  // on a phone in portrait); restore the normal view shape on leaving.
  const savedView = useRef(null);
  useEffect(() => {
    if (!full) {
      if (savedView.current) {
        const v = savedView.current;
        savedView.current = null;
        setView(v);
      }
      return undefined;
    }
    if (!savedView.current) savedView.current = latestView.current.view;
    let frame = 0;
    const fit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = svgRef.current?.getBoundingClientRect();
        if (!r?.width || !r.height) return;
        const s = latestView.current.space;
        const ca = r.height / r.width;
        // Taller than the plan (phone, tablet in portrait): zoom in just
        // enough to fill the screen; "show the whole map" still shows it all.
        const aspect = ca > s.h / s.w ? ca : null;
        setView((v) => ({ ...v, aspect, z: Math.max(v.aspect === aspect ? v.z : 1, fillZoom(s, aspect)) }));
      });
    };
    fit();
    window.addEventListener('resize', fit);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', fit);
    };
  }, [full, shownFloor, svgRef]);

  return { view, setView, vr, zoomBy, latestView };
}

/**
 * Keyboard: undo/redo, delete, escape, enter, nudge, tool shortcuts, zoom,
 * fullscreen. `keys` is read on each key press, so it can change every render.
 */
export function useEditorKeys(keys) {
  const ref = useRef(keys);
  useEffect(() => {
    ref.current = keys;
  });
  useEffect(() => {
    const onKey = (e) => {
      if (inField(document.activeElement)) return;
      const k = ref.current;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) k.doRedo();
        else k.doUndo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        k.doRedo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && k.selected) {
        e.preventDefault();
        k.remove(k.selected);
      } else if (e.key === 'Escape' && k.full && !k.selected && !k.path.length) {
        k.exitFull();
      } else if (e.key === 'Escape') {
        k.cancel();
      } else if (e.key === 'Enter' && k.path.length) {
        e.preventDefault();
        k.finishPath();
      } else if (k.selected?.type === 'marker' && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? 2 : 0.5;
        const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
        k.updateBoard('marker', k.selected.id, (m) => moveItem('marker', m, d[0], d[1], k.space), { key: `nudge-${k.selected.id}` });
      } else if (!mod && !e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        if (k.full) k.exitFull();
        else k.enterFull();
      } else if (!mod && !e.altKey && k.basic && (SIMPLE_KEY[e.key.toLowerCase()] || e.key.toLowerCase() === 'v')) {
        e.preventDefault();
        const x = SIMPLE_KEY[e.key.toLowerCase()];
        if (x) k.pickTool(x.tool, x.group);
        else k.pickTool('select');
      } else if (!mod && !e.altKey && !k.basic && BY_KEY[e.key.toLowerCase()]) {
        e.preventDefault();
        k.pickGroup(BY_KEY[e.key.toLowerCase()], true);
      } else if (!mod && (e.key === '+' || e.key === '=')) {
        k.zoomBy(1.4);
      } else if (!mod && e.key === '-') {
        k.zoomBy(1 / 1.4);
      } else if (!mod && e.key === '0') {
        k.setView((v) => ({ z: 1, aspect: v.aspect }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/**
 * Where the action bar sits: above the selected item (below it near the top
 * edge), hidden while dragging or when the item is off screen, and left of
 * the drawer in fullscreen. `anchor` is a board point or null.
 */
export function useActionBarPosition({ anchor, svgRef, canvasRef, inspectorRef, dragging, vr, floorId, full }) {
  const [barPos, setBarPos] = useState(null);
  const ax = anchor?.[0];
  const ay = anchor?.[1];
  useLayoutEffect(() => {
    const svg = svgRef.current;
    const box = canvasRef.current;
    if (ax === undefined || !svg || !box || dragging) {
      setBarPos(null);
      return;
    }
    const place = () => {
      const m = svg.getScreenCTM();
      if (!m) return;
      const p = svg.createSVGPoint();
      p.x = ax;
      p.y = ay;
      const s = p.matrixTransform(m);
      const c = box.getBoundingClientRect();
      const r = svg.getBoundingClientRect();
      const inside = s.x >= r.left && s.x <= r.right && s.y >= r.top && s.y <= r.bottom;
      // In fullscreen the drawer covers the right side: keep the bar left of it.
      const drawer = box.closest('.beditor--drawer') ? inspectorRef.current?.getBoundingClientRect() : null;
      const width = drawer && drawer.left > c.left && drawer.top < s.y ? drawer.left - c.left - 8 : c.width;
      setBarPos(inside ? { left: s.x - c.left, top: s.y - c.top, below: s.y - r.top < 56, width } : null);
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [ax, ay, dragging, vr.x, vr.y, vr.z, floorId, full, svgRef, canvasRef, inspectorRef]);
  return barPos;
}
