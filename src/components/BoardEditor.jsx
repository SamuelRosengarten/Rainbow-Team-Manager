import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import ObjectInspector from './ObjectInspector.jsx';
import OperatorIcon from './OperatorIcon.jsx';
import TacticalBoard from './TacticalBoard.jsx';
import { dist, moveItem, nearestPlayer, rectFrom, resizeZone, toBoardPoint } from '../lib/board.js';
import { OPERATORS_BY_ID } from '../lib/operators.js';
import { LIMITS, newId, slotColor } from '../lib/strategies.js';
import { BREACH_TYPES, OBJECTS, TOOL_GROUPS, ZONES, gadgetsForSide, toolLabel, utilityName } from '../lib/tactical.js';

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

const TOOL_HINT = {
  select: 'Click an object to edit it. Drag to move; drag corner handles to resize areas.',
  path: 'Click points along the route. Click the last point again (or press Enter) to finish.',
  zone: 'Drag on the map to draw the area. A single click places a default-sized one.',
  crossfire: 'Click player A, then player B, then the area they cover. Clicking a player snaps to them.',
  note: 'Click the map to add a note, or click an object to attach a note to it.',
};

const inField = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

/**
 * The tactical map editor: a grouped toolbar, who/when context, the board,
 * and an inspector for the selected object. All changes go through the
 * history (`set`, `checkpoint`, `undo`, `redo`) owned by the parent.
 */
export default function BoardEditor({ draft, history, mapName }) {
  const { set, checkpoint, undo, redo, canUndo, canRedo } = history;
  const svgRef = useRef(null);
  const [tool, setTool] = useState('position');
  const [group, setGroup] = useState('units');
  const [slotKey, setSlotKey] = useState(draft.slots[0]?.key ?? null);
  const [stepId, setStepId] = useState(draft.steps[0]?.id ?? null);
  const [selected, setSelected] = useState(null);
  const [path, setPath] = useState([]);
  const [zoneDraft, setZoneDraft] = useState(null);
  const [xf, setXf] = useState(null); // { a, slotA, b, slotB }
  const [gadget, setGadget] = useState('ability');
  const [breachType, setBreachType] = useState('hard');
  const latest = useRef(draft);
  useEffect(() => {
    latest.current = draft;
  }, [draft]);

  const [toolKind, toolArg] = tool.split(':');
  const counts = { markers: draft.markers.length, paths: draft.paths.length, zones: draft.zones.length, crossfires: draft.crossfires.length };
  const op = OPERATORS_BY_ID[draft.slots.find((s) => s.key === slotKey)?.operatorId];

  const pickTool = (t, g = group) => {
    setTool(t);
    setGroup(g);
    setPath([]);
    setXf(null);
    if (t !== 'select') setSelected(null);
  };

  const add = (collection, item) => {
    if (latest.current[collection].length >= LIMITS[collection]) return;
    set((d) => ({ [collection]: [...d[collection], item] }));
    setSelected({ type: { markers: 'marker', paths: 'path', zones: 'zone', crossfires: 'crossfire' }[collection], id: item.id });
  };

  const finishPath = (pts = path) => {
    if (pts.length >= 2) add('paths', { id: newId('p'), kind: toolArg || 'move', points: pts, slotKey, stepId, label: '' });
    setPath([]);
  };

  const defaultLabel = (kind) => {
    if (kind === 'position') return op?.name ?? 'Player';
    if (kind === 'utility') return utilityName(gadget, op?.id);
    if (kind === 'breach') return `${op ? `${op.name}: ` : ''}${BREACH_TYPES[breachType]}`;
    if (kind === 'note') return 'Note';
    if (kind === 'enemy') return 'Enemy';
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
      const pt = snap ? [snap.x, snap.y] : p;
      const sk = snap?.slotKey ?? slotKey;
      if (!xf?.a) setXf({ a: pt, slotA: sk });
      else if (!xf.b) setXf({ ...xf, b: pt, slotB: sk === xf.slotA ? null : sk });
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
    const move = (ev) => setZoneDraft({ kind: toolArg, ...rectFrom(start, toBoardPoint(svgRef.current, ev)) });
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setZoneDraft(null);
      const end = toBoardPoint(svgRef.current, ev);
      let r = rectFrom(start, end);
      if (r.w < 2 || r.h < 2) r = { x: Math.min(start[0], 86), y: Math.min(start[1], 55), w: 14, h: 9 };
      add('zones', { id: newId('z'), kind: toolArg, ...r, label: '', slotKey: null, stepId, note: '' });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onPointerDownBoard = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const p = toBoardPoint(svgRef.current, e);
    if (toolKind === 'zone') {
      e.preventDefault();
      startZone(e, p);
      return;
    }
    clickAt(p);
  };

  const collectionOf = { marker: 'markers', zone: 'zones', crossfire: 'crossfires', path: 'paths' };
  const update = (type, id, patch, opts) =>
    set((d) => ({ [collectionOf[type]]: d[collectionOf[type]].map((x) => (x.id === id ? { ...x, ...(typeof patch === 'function' ? patch(x) : patch) } : x)) }), opts);

  const startDrag = (e, item, handle) => {
    const coll = collectionOf[item.type];
    const original = latest.current[coll].find((x) => x.id === item.id);
    if (!original) return;
    e.preventDefault();
    const p0 = toBoardPoint(svgRef.current, e);
    let moved = false;
    const move = (ev) => {
      const p = toBoardPoint(svgRef.current, ev);
      if (!moved) {
        if (dist(p, p0) < 0.4) return;
        moved = true;
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
        patch = { points: original.points.map((pt, j) => (j === i ? p : pt)) };
      } else patch = moveItem(item.type, original, dx, dy);
      update(item.type, item.id, patch, { record: false });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onItemPointerDown = (e, item, handle) => {
    if (tool === 'select' || handle) {
      setSelected(item);
      startDrag(e, item, handle);
      return;
    }
    const target = item.type === 'marker' ? latest.current.markers.find((m) => m.id === item.id) : null;
    if (tool === 'note' && target) {
      placeMarker('note', [Math.min(96, target.x + 7), Math.max(3, target.y - 6)], { anchorId: target.id, slotKey: target.slotKey });
      return;
    }
    if (tool === 'crossfire' && target?.kind === 'position') {
      clickAt([target.x, target.y], target);
      return;
    }
    if (toolKind === 'zone') {
      e.preventDefault();
      startZone(e, toBoardPoint(svgRef.current, e));
      return;
    }
    clickAt(toBoardPoint(svgRef.current, e));
  };

  const remove = (item) => {
    const coll = collectionOf[item.type];
    set((d) => ({
      [coll]: d[coll].filter((x) => x.id !== item.id),
      ...(item.type === 'marker' ? { markers: d.markers.filter((x) => x.id !== item.id).map((m) => (m.anchorId === item.id ? { ...m, anchorId: undefined } : m)) } : {}),
    }));
    setSelected(null);
  };

  // Keyboard: undo/redo, delete, escape, enter, nudge.
  const keyState = useRef({});
  useEffect(() => {
    keyState.current = { selected, path, remove, undo, redo, finishPath, update };
  });
  useEffect(() => {
    const onKey = (e) => {
      if (inField(document.activeElement)) return;
      const k = keyState.current;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) k.redo();
        else k.undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        k.redo();
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
        k.update('marker', k.selected.id, (m) => moveItem('marker', m, d[0], d[1]), { key: `nudge-${k.selected.id}` });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const hint = tool === 'select' ? TOOL_HINT.select : TOOL_HINT[toolKind] ?? `Click the map to place: ${toolLabel(tool)}. ${OBJECTS[tool]?.hint ?? ''}`;
  const activeGroup = TOOL_GROUPS.find((g) => g.id === group);
  const sideOrder = (t) => (OBJECTS[t]?.side === draft.side || OBJECTS[t]?.side === 'both' || !OBJECTS[t] ? 0 : 1);
  const draftPreview = path.length ? { path, pathKind: toolArg, slotKey } : zoneDraft ? { zone: zoneDraft } : xf ? { crossfire: xf } : null;

  return (
    <div className="beditor">
      <div className="beditor__rail" role="toolbar" aria-label="Board tools">
        <button type="button" className="rail-btn" aria-pressed={tool === 'select'} onClick={() => pickTool('select')} title="Select / move (V)">
          <Icon name="cursor" size={20} />
          <span>Select</span>
        </button>
        <span className="rail-sep" aria-hidden="true" />
        {TOOL_GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            className="rail-btn"
            aria-pressed={group === g.id && tool !== 'select'}
            onClick={() => pickTool(g.tools.includes(tool) ? tool : [...g.tools].sort((a, b) => sideOrder(a) - sideOrder(b))[0], g.id)}
            title={g.label}
          >
            <Icon name={GROUP_ICON[g.id]} size={20} />
            <span>{g.label}</span>
          </button>
        ))}
        <span className="rail-sep" aria-hidden="true" />
        <button type="button" className="rail-btn" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <Icon name="undo" size={20} />
          <span>Undo</span>
        </button>
        <button type="button" className="rail-btn" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
          <Icon name="redo" size={20} />
          <span>Redo</span>
        </button>
      </div>

      <div className="beditor__stage">
        <div className="beditor__context">
          <div className="ctx-group" role="group" aria-label="Operator for new objects">
            <span className="ctx-label">Who</span>
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
                  title={o?.name ?? 'Any operator'}
                >
                  <OperatorIcon key={o?.id ?? 'none'} operator={o} size="xs" />
                  <span className="ctx-chip__name">{o?.name ?? 'Any'}</span>
                </button>
              );
            })}
            <button type="button" className="ctx-chip" aria-pressed={slotKey === null} onClick={() => setSlotKey(null)}>
              Team
            </button>
          </div>
          <div className="ctx-group" role="group" aria-label="Step for new objects">
            <span className="ctx-label">When</span>
            <button type="button" className="ctx-chip" aria-pressed={stepId === null} onClick={() => setStepId(null)}>
              Setup
            </button>
            {draft.steps.map((s, i) => (
              <button key={s.id} type="button" className="ctx-chip" aria-pressed={stepId === s.id} onClick={() => setStepId(s.id)} title={s.title}>
                <span className="ctx-chip__n">{i + 1}</span>
                {s.clock && <span className="ctx-chip__clock">{s.clock}</span>}
                <span className="ctx-chip__name">{s.title}</span>
              </button>
            ))}
          </div>
        </div>

        {tool !== 'select' && activeGroup && (
          <div className="beditor__subtools" role="group" aria-label={`${activeGroup.label} tools`}>
            {activeGroup.tools.map((t) => (
              <button key={t} type="button" className="subtool" aria-pressed={tool === t} onClick={() => pickTool(t, activeGroup.id)}>
                <ToolSwatch tool={t} />
                {toolLabel(t)}
              </button>
            ))}
            {tool === 'utility' && (
              <label className="subtool-opt">
                <span>Gadget</span>
                <select className="select input--sm" value={gadget} onChange={(e) => setGadget(e.target.value)}>
                  {gadgetsForSide(draft.side).map(([id, g]) => (
                    <option key={id} value={id}>
                      {id === 'ability' ? `${utilityName('ability', op?.id)} (operator)` : g.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {tool === 'breach' && (
              <label className="subtool-opt">
                <span>Type</span>
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
                  Finish route
                </button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPath((p) => p.slice(0, -1))}>
                  Undo point
                </button>
              </span>
            )}
          </div>
        )}

        <p className="beditor__hint" aria-live="polite">
          {tool === 'crossfire' && xf ? (xf.b ? 'Now click the engagement area.' : 'Now click player B.') : hint}
        </p>

        <TacticalBoard
          strategy={draft}
          mapName={mapName}
          stepId={stepId}
          selected={selected}
          editing
          draft={draftPreview}
          svgRef={svgRef}
          onPointerDownBoard={onPointerDownBoard}
          onItemPointerDown={onItemPointerDown}
          labels="all"
          className={`tboard--tool-${toolKind}`}
        />
        <p className="muted small beditor__counts">
          {counts.markers}/{LIMITS.markers} objects · {counts.paths}/{LIMITS.paths} routes · {counts.zones}/{LIMITS.zones} areas · {counts.crossfires}/{LIMITS.crossfires} crossfires
        </p>
      </div>

      <aside className="beditor__inspector" aria-label="Inspector">
        <ObjectInspector draft={draft} selected={selected} update={update} remove={remove} onSelect={setSelected} stepFilter={stepId} />
      </aside>
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

