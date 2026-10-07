import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import ObjectInspector from './ObjectInspector.jsx';
import ContextStrip from './board/ContextStrip.jsx';
import LayoutNotice from './board/LayoutNotice.jsx';
import StatusBar from './board/StatusBar.jsx';
import SubTools from './board/SubTools.jsx';
import ToolRail from './board/ToolRail.jsx';
import { ActionBar, Toast, ZoomControls } from './board/CanvasOverlays.jsx';
import { useActionBarPosition, useBoardViewport, useEditorFeedback, useEditorKeys } from './board/hooks.js';
import TacticalBoard from './TacticalBoard.jsx';
import { dist, liveStepId, moveItem, nearestPlayer, rectFrom, resizeZone, stepState, toBoardPoint } from '../lib/board.js';
import { OPERATORS_BY_ID } from '../lib/operators.js';
import { boardSpace, primaryFloor, projectItem, projectStrategy, unprojectPatch } from '../lib/space.js';
import { LIMITS, newId } from '../lib/strategies.js';
import { BREACH_TYPES, OBJECTS, TOOL_GROUPS, describeItem, toolLabel, utilityName } from '../lib/tactical.js';
import { duplicateItem, panBy, tacticProgress } from '../lib/tacticStatus.js';
import { BY_KEY, SIMPLE_KEY, TOOL_HINT } from '../lib/editorTools.js';
import { useFullscreen } from '../state/useFullscreen.js';
import { usePlans } from '../state/usePlans.js';
import { useI18n } from '../i18n/index.js';

const COLLECTION = { marker: 'markers', zone: 'zones', crossfire: 'crossfires', path: 'paths' };


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
export default function BoardEditor({ draft, history, mapName, inBuilder = false, simple = false }) {
  const { t } = useI18n();
  const { set, checkpoint, undo, redo, canUndo, canRedo } = history;
  const svgRef = useRef(null);
  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  const inspectorRef = useRef(null);
  const [tool, setTool] = useState('position');
  const [group, setGroup] = useState('units');
  const [slotKey, setSlotKey] = useState(draft.slots[0]?.key ?? null);
  const [pickedStepId, setStepId] = useState(draft.steps[0]?.id ?? null);
  const stepId = liveStepId(draft.steps, pickedStepId) ?? (simple && draft.steps.length ? draft.steps[0].id : null);
  const [selected, setSelected] = useState(null);
  const [path, setPath] = useState([]);
  const [zoneDraft, setZoneDraft] = useState(null);
  const [xf, setXf] = useState(null); // { a, slotA, b, slotB }
  const [gadget, setGadget] = useState('ability');
  const [breachType, setBreachType] = useState('hard');
  const [floorId, setFloorId] = useState(draft.floorId);
  const [hidden, setHidden] = useState(() => new Set());
  const [reviewing, setReviewing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [moreTools, setMoreTools] = useState(false);
  const [full, enterFull, exitFull] = useFullscreen(rootRef);
  // Simple mode shows six tools until "More tools" is pressed.
  const basic = simple && !moreTools;
  // Simple mode with phases: no separate "Setup" (always shown) choice; new items go in a phase.
  const plainPhases = simple && draft.steps.length > 0;
  usePlans();
  // The board works in board units on one floor; the draft stores normalised
  // coordinates. `view` is the projected floor; every write is unprojected.
  const space = boardSpace(draft, floorId);
  const projected = projectStrategy(draft, space);
  const multiFloor = space.kind === 'floor' || space.kind === 'missing';
  const itemFloor = multiFloor && space.floorId !== primaryFloor(draft) ? space.floorId : null;
  const latest = useRef(projected);
  const latestDoc = useRef(draft);
  useEffect(() => {
    latest.current = projected;
    latestDoc.current = draft;
  });
  const { setView, vr, zoomBy, latestView } = useBoardViewport({ space, svgRef, canvasRef, full, latest });
  const pt = (e) => toBoardPoint(svgRef.current, e, space);

  const [toolKind, toolArg] = tool.split(':');
  const progress = tacticProgress(draft);
  const op = OPERATORS_BY_ID[draft.slots.find((s) => s.key === slotKey)?.operatorId];

  const { toast, setToast, notify, fresh, setFresh, doUndo, doRedo } = useEditorFeedback({ undo, redo, t });

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

  useEditorKeys({
    selected,
    path,
    remove,
    doUndo,
    doRedo,
    finishPath,
    updateBoard,
    space,
    pickGroup,
    pickTool,
    zoomBy,
    setView,
    basic,
    full,
    enterFull,
    exitFull,
    cancel: () => {
      setPath([]);
      setXf(null);
      setSelected(null);
    },
  });

  // The action bar follows the selected item on screen.
  const selItem = selected ? projected[COLLECTION[selected.type]]?.find((x) => x.id === selected.id) : null;
  const anchor = selItem && !hidden.has(selItem.id) && stepState(draft, stepId, selItem.stepId) !== 'hidden' ? anchorOf(selected.type, selItem) : null;
  const selStored = selected ? draft[COLLECTION[selected.type]]?.find((x) => x.id === selected.id) : null;
  const selName = selStored ? describeItem(draft, selected.type, selStored) : '';
  const barPos = useActionBarPosition({ anchor, svgRef, canvasRef, inspectorRef, dragging, vr, floorId, full });

  const changeFloor = (f) => {
    setFloorId(f);
    setSelected(null);
    setPath([]);
    setXf(null);
  };

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
  const phaseLine = step ? (simple ? step.title : `${t('planner.phase.step', { n: stepIndex + 1, title: step.title })}${step.clock ? ` · ${step.clock}` : ''}`) : null;
  const near = [
    ['markers', progress.items - progress.routes - progress.areas - progress.crossfires],
    ['paths', progress.routes],
    ['zones', progress.areas],
    ['crossfires', progress.crossfires],
  ].find(([k, n]) => n >= LIMITS[k] * 0.8);

  return (
    <div
      ref={rootRef}
      className={`beditor${inBuilder ? ' beditor--builder' : ''}${simple ? ' beditor--simple' : ''}${full ? ' beditor--full' : ''}${full && selected ? ' beditor--drawer' : ''}`}
    >
      {full && (
        <button type="button" className="btn btn--secondary btn--sm tfs-exit" onClick={exitFull}>
          <Icon name="shrink" size={16} /> <span className="tfs-exit__label">{t('planner.exitFullscreen')}</span>
        </button>
      )}
      <ContextStrip draft={draft} slotKey={slotKey} setSlotKey={setSlotKey} stepId={stepId} setStepId={setStepId} plainPhases={plainPhases} simple={simple} step={step} phaseLine={phaseLine} />

      <ToolRail tool={tool} group={group} basic={basic} simple={simple} moreTools={moreTools} setMoreTools={setMoreTools} pickTool={pickTool} pickGroup={pickGroup} doUndo={doUndo} doRedo={doRedo} canUndo={canUndo} canRedo={canRedo} />

      <div className="beditor__stage">
        {tool !== 'select' && activeGroup && (basic ? path.length > 0 : activeGroup.tools.length > 1 || tool === 'utility' || tool === 'breach' || path.length > 0) && (
          <SubTools draft={draft} tool={tool} toolKind={toolKind} activeGroup={activeGroup} basic={basic} path={path} setPath={setPath} finishPath={finishPath} toolsOf={toolsOf} pickTool={pickTool} gadget={gadget} setGadget={setGadget} breachType={breachType} setBreachType={setBreachType} op={op} />
        )}

        <p className={`tguide tguide--${busy ? 'busy' : progress.stage}`} aria-live="polite">
          <Icon name={busy ? 'crossfire' : progress.stage === 'ready' ? 'check' : 'target'} size={18} className="tguide__icon" />
          <span>
            <strong>{busy ?? guide}</strong> <span className="tguide__how">{toolHint}</span>
          </span>
        </p>

        <LayoutNotice space={space} reviewing={reviewing} setReviewing={setReviewing} set={set} undo={undo} notify={notify} pickTool={pickTool} />

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
          <ZoomControls vr={vr} zoomBy={zoomBy} setView={setView} full={full} enterFull={enterFull} exitFull={exitFull} />
          {barPos && selected && (
            <ActionBar barPos={barPos} selected={selected} full={full} selName={selName} editSelected={editSelected} duplicate={duplicate} hide={hide} remove={remove} />
          )}
          <Toast toast={toast} setToast={setToast} />
        </div>

        <StatusBar progress={progress} near={near} hidden={hidden} setHidden={setHidden} />
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
          simple={simple}
        />
      </aside>
    </div>
  );
}
