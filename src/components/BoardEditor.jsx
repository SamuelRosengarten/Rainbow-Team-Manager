import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import ObjectInspector from './ObjectInspector.jsx';
import OperatorIcon from './OperatorIcon.jsx';
import TacticalBoard from './TacticalBoard.jsx';
import { dist, liveStepId, moveItem, nearestPlayer, rectFrom, resizeZone, stepState, toBoardPoint } from '../lib/board.js';
import { floorLabel } from '../lib/floorPlans.js';
import { OPERATORS_BY_ID } from '../lib/operators.js';
import { boardSpace, primaryFloor, projectItem, projectStrategy, unprojectPatch } from '../lib/space.js';
import { LIMITS, newId, slotColor, toFloorLayout } from '../lib/strategies.js';
import { BREACH_TYPES, OBJECTS, TOOL_GROUPS, ZONES, describeItem, gadgetsForSide, toolLabel, utilityName } from '../lib/tactical.js';
import { duplicateItem, panBy, tacticProgress, viewRect, zoomAt } from '../lib/tacticStatus.js';
import { usePlans } from '../state/usePlans.js';
import { useI18n } from '../i18n/index.js';

const GROUP_ICON = {
  units: 'user',
  move: 'route',
  intel: 'drone',
  utility: 'diamond',
  breach: 'burst',
  areas: 'area',
  crossfire: 'crossfire',
  objective: 'flag',
  note: 'note',
};

// The toolbar, grouped by what the user is trying to do (names: planner.intent.<id>).
const INTENTS = [
  ['people', ['units']],
  ['movement', ['move']],
  ['intel', ['intel']],
  ['utility', ['utility', 'breach']],
  ['tactical', ['areas', 'crossfire', 'objective']],
  ['annotation', ['note']],
];
const INTENT_OF = Object.fromEntries(INTENTS.flatMap(([intent, groups]) => groups.map((g) => [g, intent])));

// One key per tool group; pressing it again cycles through the group's tools.
const SHORTCUT = { select: 'V', units: 'P', move: 'R', intel: 'I', utility: 'U', breach: 'B', areas: 'A', crossfire: 'C', objective: 'O', note: 'N' };
const BY_KEY = Object.fromEntries(Object.entries(SHORTCUT).map(([id, k]) => [k.toLowerCase(), id]));

// Tools that have their own hint (board.hint.<tool>); others use the generic placing hint.
const TOOL_HINT = ['select', 'path', 'zone', 'crossfire', 'note'];
const COLLECTION = { marker: 'markers', zone: 'zones', crossfire: 'crossfires', path: 'paths' };

const inField = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

/** Where the action bar sits for an item (board units, projected). */
function anchorOf(type, item) {
  if (!item) return null;
  if (type === 'marker') return [item.x, item.y - 3.2];
  if (type === 'zone') return [item.x + item.w / 2, item.y];
  if (type === 'path') return item.points[0];
  if (type === 'crossfire') return [item.target[0], item.target[1] - item.radius];
  return null;
}

/**
 * The tactical map editor: tactical context (who and when), a toolbar grouped
 * by intent, the board with zoom and an action bar for the selected item, and
 * a side panel listing what's placed (or editing the selected item). All
 * changes go through the history (`set`, `checkpoint`, `undo`, `redo`) owned
 * by the parent. `inBuilder` words the guidance for the builder's next step.
 */
export default function BoardEditor({ draft, history, mapName, inBuilder = false }) {
  const { t } = useI18n();
  const { set, checkpoint, undo, redo, canUndo, canRedo } = history;
  const svgRef = useRef(null);
  const canvasRef = useRef(null);
  const inspectorRef = useRef(null);
  const [tool, setTool] = useState('position');
  const [group, setGroup] = useState('units');
  const [slotKey, setSlotKey] = useState(draft.slots[0]?.key ?? null);
  const [pickedStepId, setStepId] = useState(draft.steps[0]?.id ?? null);
  const stepId = liveStepId(draft.steps, pickedStepId);
  const [selected, setSelected] = useState(null);
  const [path, setPath] = useState([]);
  const [zoneDraft, setZoneDraft] = useState(null);
  const [xf, setXf] = useState(null); // { a, slotA, b, slotB }
  const [gadget, setGadget] = useState('ability');
  const [breachType, setBreachType] = useState('hard');
  const [floorId, setFloorId] = useState(draft.floorId);
  const [view, setView] = useState({ z: 1 });
  const [hidden, setHidden] = useState(() => new Set());
  const [fresh, setFresh] = useState(null);
  const [toast, setToast] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [barPos, setBarPos] = useState(null);
  usePlans();
  // The board works in board units on one floor; the draft stores normalised
  // coordinates. `view` is the projected floor; every write is unprojected.
  const space = boardSpace(draft, floorId);
  const projected = projectStrategy(draft, space);
  const multiFloor = space.kind === 'floor' || space.kind === 'missing';
  const itemFloor = multiFloor && space.floorId !== primaryFloor(draft) ? space.floorId : null;
  const vr = viewRect(space, view);
  const latest = useRef(projected);
  const latestDoc = useRef(draft);
  const latestView = useRef({ view, space });
  useEffect(() => {
    latest.current = projected;
    latestDoc.current = draft;
    latestView.current = { view, space };
  });
  const pt = (e) => toBoardPoint(svgRef.current, e, space);

  const [toolKind, toolArg] = tool.split(':');
  const progress = tacticProgress(draft);
  const op = OPERATORS_BY_ID[draft.slots.find((s) => s.key === slotKey)?.operatorId];

  // ---------- Feedback ----------
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

  const pickTool = (next, g = group) => {
    setTool(next);
    setGroup(g);
    setPath([]);
    setXf(null);
    if (next !== 'select') setSelected(null);
  };
  const sideOrder = (x) => (OBJECTS[x]?.side === draft.side || OBJECTS[x]?.side === 'both' || !OBJECTS[x] ? 0 : 1);
  const toolsOf = (g) => [...g.tools].sort((a, b) => sideOrder(a) - sideOrder(b));
  /** Choose a group from the toolbar or its shortcut; again on the same group cycles its tools. */
  const pickGroup = (id, cycle = false) => {
    if (id === 'select') return pickTool('select');
    const g = TOOL_GROUPS.find((x) => x.id === id);
    const tools = toolsOf(g);
    if (cycle && group === id && tool !== 'select' && tools.length > 1) return pickTool(tools[(tools.indexOf(tool) + 1) % tools.length], id);
    return pickTool(g.tools.includes(tool) ? tool : tools[0], id);
  };

  /** Add an item given in board units on the floor being shown. */
  const add = (collection, item) => {
    if (latestDoc.current[collection].length >= LIMITS[collection]) return;
    const type = { markers: 'marker', paths: 'path', zones: 'zone', crossfires: 'crossfire' }[collection];
    const stored = { ...unprojectPatch(type, item, space), floorId: itemFloor };
    set((d) => ({ [collection]: [...d[collection], stored] }));
    setSelected({ type, id: item.id });
    setFresh(item.id);
  };

  const finishPath = (pts = path) => {
    if (pts.length >= 2) add('paths', { id: newId('p'), kind: toolArg || 'move', points: pts, slotKey, stepId, label: '' });
    setPath([]);
  };

  const defaultLabel = (kind) => {
    if (kind === 'position') return op?.name ?? t('object.position');
    if (kind === 'utility') return utilityName(gadget, op?.id);
    if (kind === 'breach') return t(op ? 'board.breachLabelOp' : 'board.breachLabel', { operator: op?.name ?? '', type: BREACH_TYPES[breachType] });
    if (kind === 'note') return t('object.note');
    if (kind === 'enemy') return t('object.enemy');
    return OBJECTS[kind]?.label ?? '';
  };

  const placeMarker = (kind, [x, y], extra = {}) => {
    const teamLevel = kind === 'plant' || kind === 'objective' || kind === 'enemy';
    add('markers', {
      id: newId('m'),
      kind,
      x,
      y,
      label: defaultLabel(kind),
      slotKey: teamLevel ? null : slotKey,
      stepId,
      purpose: '',
      timing: '',
      note: '',
      ...(kind === 'utility' ? { gadget } : {}),
      ...(kind === 'breach' ? { breachType } : {}),
      ...extra,
    });
  };

  const clickAt = (p, snapMarker = null) => {
    if (tool === 'select') {
      setSelected(null);
      return;
    }
    if (toolKind === 'path') {
      const last = path[path.length - 1];
      if (last && dist(last, p) < 1.2) finishPath();
      else setPath((pts) => [...pts, p]);
      return;
    }
    if (tool === 'crossfire') {
      const snap = snapMarker ?? nearestPlayer(latest.current, p);
      const at = snap ? [snap.x, snap.y] : p;
      const sk = snap?.slotKey ?? slotKey;
      if (!xf?.a) setXf({ a: at, slotA: sk });
      else if (!xf.b) setXf({ ...xf, b: at, slotB: sk === xf.slotA ? null : sk });
      else {
        add('crossfires', { id: newId('x'), a: xf.a, b: xf.b, slotA: xf.slotA, slotB: xf.slotB, target: p, radius: 4, label: '', timing: '', note: '', stepId });
        setXf(null);
      }
      return;
    }
    if (toolKind === 'zone') return; // handled by drag
    placeMarker(tool, p);
  };

  const startZone = (e, start) => {
    const move = (ev) => setZoneDraft({ kind: toolArg, ...rectFrom(start, pt(ev)) });
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setZoneDraft(null);
      const end = pt(ev);
      let r = rectFrom(start, end);
      if (r.w < 2 || r.h < 2) r = { x: Math.min(start[0], space.w - 14), y: Math.min(start[1], space.h - 9), w: 14, h: 9 };
      add('zones', { id: newId('z'), kind: toolArg, ...r, label: '', slotKey: null, stepId, note: '' });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  /** Drag the view around (middle button anywhere, or the select tool on empty map when zoomed in). */
  const startPan = (e, onClick) => {
    e.preventDefault();
    const x0 = e.clientX;
    const y0 = e.clientY;
    const start = latestView.current.view;
    const scale = vr.w / (svgRef.current?.getBoundingClientRect().width || 1);
    let moved = false;
    const move = (ev) => {
      const dx = ev.clientX - x0;
      const dy = ev.clientY - y0;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      moved = true;
      setView(panBy(latestView.current.space, start, -dx * scale, -dy * scale));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (!moved) onClick?.();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onPointerDownBoard = (e) => {
    if (e.button === 1) {
      startPan(e);
      return;
    }
    if (e.button !== undefined && e.button !== 0) return;
    if (tool === 'select' && vr.z > 1) {
      startPan(e, () => setSelected(null));
      return;
    }
    const p = pt(e);
    if (toolKind === 'zone') {
      e.preventDefault();
      startZone(e, p);
      return;
    }
    clickAt(p);
  };

  /** Patch in stored coordinates (the inspector edits stored data). */
  const update = (type, id, patch, opts) =>
    set((d) => ({ [COLLECTION[type]]: d[COLLECTION[type]].map((x) => (x.id === id ? { ...x, ...(typeof patch === 'function' ? patch(x) : patch) } : x)) }), opts);
  /** Patch in board units (drags and nudges); a function patch gets the projected item. */
  const updateBoard = (type, id, patch, opts) =>
    update(type, id, (x) => unprojectPatch(type, typeof patch === 'function' ? patch(projectItem(type, x, space)) : patch, space), opts);

  const startDrag = (e, item, handle) => {
    const coll = COLLECTION[item.type];
    const original = latest.current[coll].find((x) => x.id === item.id);
    if (!original) return;
    e.preventDefault();
    const p0 = pt(e);
    let moved = false;
    const move = (ev) => {
      const p = pt(ev);
      if (!moved) {
        if (dist(p, p0) < 0.4) return;
        moved = true;
        setDragging(true);
        checkpoint();
      }
      const dx = p[0] - p0[0];
      const dy = p[1] - p0[1];
      let patch;
      if (item.type === 'zone' && handle && handle !== 'body') patch = resizeZone(original, handle, p);
      else if (item.type === 'crossfire' && handle === 'radius') patch = { radius: Math.round(Math.min(15, Math.max(1.5, dist(original.target, p))) * 10) / 10 };
      else if (item.type === 'crossfire' && ['a', 'b', 'target'].includes(handle)) patch = { [handle]: p };
      else if (item.type === 'path' && handle?.startsWith('p')) {
        const i = Number(handle.slice(1));
        patch = { points: original.points.map((q, j) => (j === i ? p : q)) };
      } else patch = moveItem(item.type, original, dx, dy, space);
      updateBoard(item.type, item.id, patch, { record: false });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDragging(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onItemPointerDown = (e, item, handle) => {
    if (e.button === 1) {
      startPan(e);
      return;
    }
    if (tool === 'select' || handle) {
      setSelected(item);
      startDrag(e, item, handle);
      return;
    }
    const target = item.type === 'marker' ? latest.current.markers.find((m) => m.id === item.id) : null;
    if (tool === 'note' && target) {
      placeMarker('note', [Math.min(space.w - 4, target.x + 7), Math.max(3, target.y - 6)], { anchorId: target.id, slotKey: target.slotKey });
      return;
    }
    if (tool === 'crossfire' && target?.kind === 'position') {
      clickAt([target.x, target.y], target);
      return;
    }
    if (toolKind === 'zone') {
      e.preventDefault();
      startZone(e, pt(e));
      return;
    }
    clickAt(pt(e));
  };

  const nameOf = (item) => {
    const it = latestDoc.current[COLLECTION[item.type]].find((x) => x.id === item.id);
    return it ? describeItem(latestDoc.current, item.type, it) : '';
  };

  const remove = (item) => {
    const name = nameOf(item);
    const coll = COLLECTION[item.type];
    set((d) => ({
      [coll]: d[coll].filter((x) => x.id !== item.id),
      ...(item.type === 'marker' ? { markers: d.markers.filter((x) => x.id !== item.id).map((m) => (m.anchorId === item.id ? { ...m, anchorId: undefined } : m)) } : {}),
    }));
    setSelected(null);
    notify(t('planner.toast.deleted', { name }), { label: t('planner.toast.undo'), run: undo });
  };

  const duplicate = (item) => {
    const coll = COLLECTION[item.type];
    const original = latest.current[coll].find((x) => x.id === item.id);
    if (!original || latestDoc.current[coll].length >= LIMITS[coll]) return;
    const copy = duplicateItem(item.type, original, newId(item.type === 'marker' ? 'm' : item.type[0]), space);
    if (item.type === 'marker') delete copy.anchorId;
    add(coll, copy);
    notify(t('planner.toast.duplicated', { name: nameOf(item) }));
  };

  const hide = (item) => {
    setHidden((h) => new Set(h).add(item.id));
    setSelected(null);
  };

  const editSelected = () => {
    const box = inspectorRef.current;
    box?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    box?.querySelector('input, select, textarea')?.focus({ preventScroll: true });
  };

  const zoomBy = useCallback((factor, at = null) => {
    const { view: v, space: s } = latestView.current;
    setView(zoomAt(s, v, factor, at));
  }, []);

  // Keyboard: undo/redo, delete, escape, enter, nudge, tool shortcuts, zoom.
  const keyState = useRef({});
  useEffect(() => {
    keyState.current = { selected, path, remove, doUndo, doRedo, finishPath, updateBoard, space, pickGroup, zoomBy };
  });
  useEffect(() => {
    const onKey = (e) => {
      if (inField(document.activeElement)) return;
      const k = keyState.current;
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
      } else if (e.key === 'Escape') {
        setPath([]);
        setXf(null);
        setSelected(null);
      } else if (e.key === 'Enter' && k.path.length) {
        e.preventDefault();
        k.finishPath();
      } else if (k.selected?.type === 'marker' && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? 2 : 0.5;
        const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
        k.updateBoard('marker', k.selected.id, (m) => moveItem('marker', m, d[0], d[1], k.space), { key: `nudge-${k.selected.id}` });
      } else if (!mod && !e.altKey && BY_KEY[e.key.toLowerCase()]) {
        e.preventDefault();
        k.pickGroup(BY_KEY[e.key.toLowerCase()], true);
      } else if (!mod && (e.key === '+' || e.key === '=')) {
        k.zoomBy(1.4);
      } else if (!mod && e.key === '-') {
        k.zoomBy(1 / 1.4);
      } else if (!mod && e.key === '0') {
        setView((v) => ({ z: 1, aspect: v.aspect }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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
  }, [zoomBy]);

  // The action bar follows the selected item on screen.
  const selItem = selected ? projected[COLLECTION[selected.type]]?.find((x) => x.id === selected.id) : null;
  const anchor = selItem && !hidden.has(selItem.id) && stepState(draft, stepId, selItem.stepId) !== 'hidden' ? anchorOf(selected.type, selItem) : null;
  const selStored = selected ? draft[COLLECTION[selected.type]]?.find((x) => x.id === selected.id) : null;
  const selName = selStored ? describeItem(draft, selected.type, selStored) : '';
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
      setBarPos(inside ? { left: s.x - c.left, top: s.y - c.top, below: s.y - r.top < 56, width: c.width } : null);
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [ax, ay, dragging, vr.x, vr.y, vr.z, floorId]);

  const changeFloor = (f) => {
    setFloorId(f);
    setSelected(null);
    setPath([]);
    setXf(null);
  };

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
  }, [shownFloor]);

  // ---------- Words ----------
  const toolHint = tool === 'select' ? t('board.hint.select') : TOOL_HINT.includes(toolKind) ? t(`board.hint.${toolKind}`) : t('board.hint.place', { tool: toolLabel(tool), hint: OBJECTS[tool]?.hint ?? '' });
  const missingNames = progress.unplaced.map((s) => OPERATORS_BY_ID[s.operatorId]?.name ?? s.operatorId);
  const guide =
    progress.stage === 'start'
      ? t('planner.guide.start')
      : progress.stage === 'ready'
        ? t(inBuilder ? 'planner.guide.ready' : 'planner.guide.readyEdit')
        : missingNames.length
          ? t('planner.guide.buildMissing', { names: missingNames, count: missingNames.length })
          : t('planner.guide.build');
  const busy = tool === 'crossfire' && xf ? (xf.b ? t('boardEditor.nowClickTheEngagementArea') : t('boardEditor.nowClickPlayerB')) : null;
  const activeGroup = TOOL_GROUPS.find((g) => g.id === group);
  const draftPreview = path.length ? { path, pathKind: toolArg, slotKey } : zoneDraft ? { zone: zoneDraft } : xf ? { crossfire: xf } : null;
  const step = draft.steps.find((s) => s.id === stepId);
  const stepIndex = draft.steps.indexOf(step);
  const phaseLine = step ? `${t('planner.phase.step', { n: stepIndex + 1, title: step.title })}${step.clock ? ` · ${step.clock}` : ''}` : null;
  const near = [
    ['markers', progress.items - progress.routes - progress.areas - progress.crossfires],
    ['paths', progress.routes],
    ['zones', progress.areas],
    ['crossfires', progress.crossfires],
  ].find(([k, n]) => n >= LIMITS[k] * 0.8);

  return (
    <div className={`beditor${inBuilder ? ' beditor--builder' : ''}`}>
      <section className="tctx" aria-label={t('planner.context')}>
        <div className="tctx__row" role="group" aria-label={t('boardEditor.operatorForNewObjects')}>
          <span className="tctx__label" aria-hidden="true">
            {t('boardEditor.who')}
          </span>
          <div className="tctx__chips">
            {draft.slots.map((s) => {
              const o = OPERATORS_BY_ID[s.operatorId];
              return (
                <button
                  key={s.key}
                  type="button"
                  className="ctx-chip"
                  style={{ '--slot': slotColor(draft, s.key) }}
                  aria-pressed={slotKey === s.key}
                  onClick={() => setSlotKey(s.key)}
                  title={t('planner.who.help')}
                >
                  <OperatorIcon key={o?.id ?? 'none'} operator={o} size="xs" />
                  <span className="ctx-chip__name">{o?.name ?? t('boardEditor.any')}</span>
                </button>
              );
            })}
            <button type="button" className="ctx-chip ctx-chip--team" aria-pressed={slotKey === null} onClick={() => setSlotKey(null)} title={t('planner.who.team')}>
              <Icon name="users" size={16} />
              <span className="ctx-chip__name">{t('boardEditor.team')}</span>
            </button>
          </div>
        </div>
        <div className="tctx__row" role="group" aria-label={t('boardEditor.stepForNewObjects')}>
          <span className="tctx__label" aria-hidden="true">
            {t('boardEditor.when')}
          </span>
          <div className="tctx__chips tctx__chips--seq">
            <button type="button" className="ctx-chip ctx-chip--phase" aria-pressed={stepId === null} onClick={() => setStepId(null)} title={t('planner.phase.setup')}>
              <span className="ctx-chip__name">{t('boardEditor.setup')}</span>
            </button>
            {draft.steps.map((s, i) => (
              <span key={s.id} className="tctx__seq">
                <Icon name="chevron" size={14} className="tctx__sep" />
                <button type="button" className="ctx-chip ctx-chip--phase" aria-pressed={stepId === s.id} onClick={() => setStepId(s.id)} title={s.description || s.title}>
                  <span className="ctx-chip__n">{i + 1}</span>
                  {s.clock && <span className="ctx-chip__clock">{s.clock}</span>}
                  <span className="ctx-chip__name">{s.title}</span>
                </button>
              </span>
            ))}
          </div>
        </div>
        <p className="tctx__now" aria-live="polite">
          {step ? (
            <>
              <strong>{phaseLine}</strong> <span>{step.description || t('planner.phase.from')}</span>
            </>
          ) : (
            t('planner.phase.setup')
          )}
        </p>
      </section>

      <div className="beditor__rail" role="toolbar" aria-label={t('boardEditor.boardTools')} aria-orientation="vertical">
        <RailButton id="select" icon="cursor" label={t('boardEditor.select')} intent={t('planner.intent.select')} desc={t('planner.tool.select')} shortcut="V" pressed={tool === 'select'} onClick={() => pickTool('select')} />
        {INTENTS.map(([intent, groups]) => (
          <div key={intent} className="rail-group" role="group" aria-label={t(`planner.intent.${intent}`)}>
            {groups.map((id) => {
              const g = TOOL_GROUPS.find((x) => x.id === id);
              return (
                <RailButton
                  key={id}
                  id={id}
                  icon={GROUP_ICON[id]}
                  label={g.label}
                  intent={t(`planner.intent.${INTENT_OF[id]}`)}
                  desc={t(`planner.tool.${id}`)}
                  shortcut={SHORTCUT[id]}
                  pressed={group === id && tool !== 'select'}
                  onClick={() => pickGroup(id)}
                />
              );
            })}
          </div>
        ))}
        <div className="rail-group" role="group" aria-label={t('planner.intent.history')}>
          <RailButton id="undo" icon="undo" label={t('boardEditor.undo')} intent={t('planner.intent.history')} desc={t('planner.tool.undo')} shortcut="Ctrl+Z" onClick={doUndo} disabled={!canUndo} />
          <RailButton id="redo" icon="redo" label={t('boardEditor.redo')} intent={t('planner.intent.history')} desc={t('planner.tool.redo')} shortcut="Ctrl+Shift+Z" onClick={doRedo} disabled={!canRedo} />
        </div>
      </div>

      <div className="beditor__stage">
        {tool !== 'select' && activeGroup && (activeGroup.tools.length > 1 || tool === 'utility' || tool === 'breach' || path.length > 0) && (
          <div className="beditor__subtools" role="group" aria-label={t('board.toolsAria', { group: activeGroup.label })}>
            {activeGroup.tools.length > 1 &&
              toolsOf(activeGroup).map((x) => (
                <button key={x} type="button" className="subtool" aria-pressed={tool === x} onClick={() => pickTool(x, activeGroup.id)}>
                  <ToolSwatch tool={x} />
                  {toolLabel(x)}
                </button>
              ))}
            {tool === 'utility' && (
              <label className="subtool-opt">
                <span>{t('boardEditor.gadget')}</span>
                <select className="select input--sm" value={gadget} onChange={(e) => setGadget(e.target.value)}>
                  {gadgetsForSide(draft.side).map(([id, g]) => (
                    <option key={id} value={id}>
                      {id === 'ability' ? t('gadget.operatorSuffix', { name: utilityName('ability', op?.id) }) : g.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {tool === 'breach' && (
              <label className="subtool-opt">
                <span>{t('boardEditor.type')}</span>
                <select className="select input--sm" value={breachType} onChange={(e) => setBreachType(e.target.value)}>
                  {Object.entries(BREACH_TYPES).map(([id, l]) => (
                    <option key={id} value={id}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {toolKind === 'path' && path.length > 0 && (
              <span className="subtool-opt">
                <button type="button" className="btn btn--primary btn--sm" onClick={() => finishPath()} disabled={path.length < 2}>
                  {t('boardEditor.finishRoute')}
                </button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPath((p) => p.slice(0, -1))}>
                  {t('boardEditor.undoPoint')}
                </button>
              </span>
            )}
          </div>
        )}

        <p className={`tguide tguide--${busy ? 'busy' : progress.stage}`} aria-live="polite">
          <Icon name={busy ? 'crossfire' : progress.stage === 'ready' ? 'check' : 'target'} size={18} className="tguide__icon" />
          <span>
            <strong>{busy ?? guide}</strong> <span className="tguide__how">{toolHint}</span>
          </span>
        </p>

        {space.approximate &&
          (reviewing ? (
            <div className="tnotice tnotice--slim" role="status">
              <Icon name="cursor" size={16} />
              <span>{t('planner.approx.reviewing', { floor: floorLabel(space.floorId) })}</span>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => {
                  set((d) => toFloorLayout(d));
                  setReviewing(false);
                  notify(t('planner.toast.kept'), { label: t('planner.toast.undo'), run: undo });
                }}
              >
                <Icon name="check" size={16} /> {t('planner.approx.done')}
              </button>
            </div>
          ) : (
            <div className="tnotice" role="status">
              <Icon name="map" size={18} className="tnotice__icon" />
              <div className="tnotice__text">
                <strong>{t('planner.approx.title')}</strong>
                <span>{t('planner.approx.body')}</span>
              </div>
              <div className="tnotice__actions">
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => {
                    set((d) => toFloorLayout(d));
                    notify(t('planner.toast.kept'), { label: t('planner.toast.undo'), run: undo });
                  }}
                >
                  {t('planner.approx.keep')}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => {
                    setReviewing(true);
                    pickTool('select');
                  }}
                >
                  {t('planner.approx.review')}
                </button>
              </div>
            </div>
          ))}
        {space.kind === 'none' && <p className="tnotice tnotice--slim">{t('boardEditor.thisPlanIsnTTied')}</p>}
        {space.kind === 'missing' && <p className="tnotice tnotice--slim">{t('board.missingPlan', { floor: floorLabel(space.floorId) })}</p>}

        <div className={`tcanvas${vr.z > 1 ? ' tcanvas--zoomed' : ''}`} ref={canvasRef}>
          <TacticalBoard
            strategy={draft}
            floorId={space.floorId || null}
            onFloorChange={changeFloor}
            mapName={mapName}
            stepId={stepId}
            selected={selected}
            editing
            draft={draftPreview}
            svgRef={svgRef}
            onPointerDownBoard={onPointerDownBoard}
            onItemPointerDown={onItemPointerDown}
            labels="all"
            view={vr.z > 1 || vr.aspect ? vr : null}
            hidden={hidden}
            fresh={fresh}
            className={`tboard--tool-${toolKind}`}
          />
          <div className="tzoom" role="group" aria-label={t('planner.zoom.group')} title={t('planner.zoom.hint')}>
            <button type="button" className="tzoom__btn" onClick={() => zoomBy(1 / 1.4)} disabled={vr.z <= 1} aria-label={t('planner.zoom.out')} title={t('planner.zoom.out')}>
              <Icon name="minus" size={16} />
            </button>
            <span className="tzoom__level" aria-live="polite">
              {t('planner.zoom.level', { pct: Math.round(vr.z * 100) })}
            </span>
            <button type="button" className="tzoom__btn" onClick={() => zoomBy(1.4)} disabled={vr.z >= 4} aria-label={t('planner.zoom.in')} title={t('planner.zoom.in')}>
              <Icon name="plus" size={16} />
            </button>
            <button type="button" className="tzoom__btn" onClick={() => setView((v) => ({ z: 1, aspect: v.aspect }))} disabled={vr.z <= 1} aria-label={t('planner.zoom.fit')} title={t('planner.zoom.fit')}>
              <Icon name="fullscreen" size={16} />
            </button>
          </div>
          {barPos && selected && (
            <div
              className={`tbar${barPos.below ? ' tbar--below' : ''}`}
              style={{ left: Math.min(Math.max(barPos.left, 120), barPos.width - 120), top: barPos.top }}
              role="toolbar"
              aria-label={t('planner.action.bar', { name: selName })}
            >
              <button type="button" className="tbar__btn" onClick={editSelected}>
                <Icon name="edit" size={16} /> <span className="tbar__label">{t('planner.action.edit')}</span>
              </button>
              <button type="button" className="tbar__btn" onClick={() => duplicate(selected)}>
                <Icon name="copy" size={16} /> <span className="tbar__label">{t('planner.action.duplicate')}</span>
              </button>
              <button type="button" className="tbar__btn" onClick={() => hide(selected)} title={t('planner.action.hideHint')}>
                <Icon name="eyeOff" size={16} /> <span className="tbar__label">{t('planner.action.hide')}</span>
              </button>
              <button type="button" className="tbar__btn tbar__btn--danger" onClick={() => remove(selected)}>
                <Icon name="trash" size={16} /> <span className="tbar__label">{t('planner.action.delete')}</span>
              </button>
            </div>
          )}
          <div className="ttoast-wrap" role="status" aria-live="polite">
            {toast && (
              <div key={toast.id} className="ttoast">
                <span>{toast.msg}</span>
                {toast.action && (
                  <button
                    type="button"
                    className="ttoast__action"
                    onClick={() => {
                      toast.action.run();
                      setToast(null);
                    }}
                  >
                    {toast.action.label}
                  </button>
                )}
                <button type="button" className="ttoast__close" aria-label={t('planner.toast.close')} onClick={() => setToast(null)}>
                  <Icon name="close" size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="tstatus">
          <p className="tstatus__main">
            <strong>{t('planner.status.placed', { count: progress.items })}</strong>
            {progress.items > 0 && (
              <>
                <span className="tstatus__dot" aria-hidden="true">·</span>
                <span>{t('planner.status.routes', { count: progress.routes })}</span>
                <span className="tstatus__dot" aria-hidden="true">·</span>
                <span>{t('planner.status.crossfires', { count: progress.crossfires })}</span>
              </>
            )}
            {near && <span className="tstatus__warn">{t('planner.status.limit', { n: near[1], max: LIMITS[near[0]] })}</span>}
          </p>
          {hidden.size > 0 && (
            <button type="button" className="btn btn--ghost btn--sm tstatus__hidden" onClick={() => setHidden(new Set())}>
              <Icon name="eye" size={16} /> {t('planner.hidden', { count: hidden.size })} · {t('planner.showHidden')}
            </button>
          )}
          <details className="tcheck">
            <summary>
              <Icon name="list" size={16} /> {t('planner.checklist')}
              <span className="tcheck__count">
                {progress.checklist.filter((c) => c.done).length}/{progress.checklist.length}
              </span>
            </summary>
            <div className="tcheck__pop">
            <ul className="tcheck__list">
              {progress.checklist.map((c) => (
                <li key={c.id} className={c.done ? 'is-done' : undefined}>
                  <Icon name={c.done ? 'check' : 'target'} size={16} />
                  <span className="visually-hidden">{t(c.done ? 'planner.check.done' : 'planner.check.todo')} </span>
                  {t(`planner.check.${c.id}`, { n: c.n ?? 0, total: c.total ?? 0 })}
                </li>
              ))}
            </ul>
            <p className="muted small">{t('planner.checklist.note')}</p>
            </div>
          </details>
        </div>
      </div>

      <aside className="beditor__inspector" aria-label={t('boardEditor.inspector')} ref={inspectorRef}>
        <ObjectInspector
          draft={draft}
          selected={selected}
          update={update}
          remove={remove}
          onDuplicate={duplicate}
          onSelect={setSelected}
          stepFilter={stepId}
          hidden={hidden}
        />
      </aside>
    </div>
  );
}

/** A toolbar button with a tooltip: name, shortcut and one line on what it does. */
function RailButton({ id, icon, label, intent, desc, shortcut, pressed, onClick, disabled }) {
  const { t } = useI18n();
  const tipId = `rail-tip-${id}`;
  return (
    <div className="rail-item">
      <button
        type="button"
        className="rail-btn"
        aria-pressed={pressed === undefined ? undefined : pressed}
        aria-describedby={tipId}
        aria-keyshortcuts={shortcut.replace('Ctrl', 'Control')}
        onClick={onClick}
        disabled={disabled}
      >
        <Icon name={icon} size={20} />
        <span className="rail-btn__label">{label}</span>
      </button>
      <span className="rail-tip" role="tooltip" id={tipId}>
        <span className="rail-tip__intent">{intent}</span>
        <span className="rail-tip__head">
          <strong>{label}</strong>
          <kbd>{shortcut}</kbd>
        </span>
        <span className="rail-tip__desc">{desc}</span>
        <span className="visually-hidden">{t('planner.shortcut', { key: shortcut })}</span>
      </span>
    </div>
  );
}

/** Tiny preview of what a tool draws, for the sub-toolbar. */
function ToolSwatch({ tool }) {
  const [kind, arg] = tool.split(':');
  let inner;
  if (kind === 'zone') inner = <rect x="2" y="4" width="16" height="12" rx="2" fill={ZONES[arg].color} fillOpacity="0.3" stroke={ZONES[arg].color} strokeDasharray="3 2" />;
  else if (kind === 'path') inner = <path d="M2 15 Q8 3 18 6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray={arg === 'move' || arg === 'entry' ? undefined : arg === 'rotate' ? '1 3' : '4 2'} />;
  else if (kind === 'crossfire') inner = <path d="M3 4 L14 10 M3 16 L14 10" stroke="currentColor" strokeWidth="2" fill="none" />;
  else {
    const fill = { enemy: '#ff4757', breach: '#ff7a1a', plant: '#f5a623', objective: '#e8463b', reinforce: '#7d8ba1' }[tool] ?? 'currentColor';
    inner =
      tool === 'utility' ? <rect x="6" y="6" width="8" height="8" transform="rotate(45 10 10)" fill={fill} /> : tool === 'trap' ? <polygon points="10,3 17,16 3,16" fill="none" stroke={fill} strokeWidth="2" /> : <circle cx="10" cy="10" r={tool === 'waypoint' ? 3 : 6} fill={fill} />;
  }
  return (
    <svg className="subtool__swatch" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      {inner}
    </svg>
  );
}
