import { useRef, useState } from 'react';
import Icon from './Icon.jsx';
import OperatorIcon from './OperatorIcon.jsx';
import StrategyBoard from './StrategyBoard.jsx';
import { OriginBadge } from './StrategyCard.jsx';
import { ROLES, ROLE_LABEL } from '../lib/fit.js';
import { MAPS, MAPS_BY_ID, sitesFor } from '../lib/maps.js';
import { OPERATORS_BY_ID, operatorsForSide } from '../lib/operators.js';
import {
  BOARD_H,
  BOARD_W,
  DIFFICULTY,
  MARKER_KINDS,
  PATH_KINDS,
  STRATEGY_TYPES,
  attribution,
  newId,
  normalizeStrategy,
  slotColor,
} from '../lib/strategies.js';

const TABS = [
  { id: 'details', label: 'Details' },
  { id: 'slots', label: 'Operators' },
  { id: 'steps', label: 'Steps' },
  { id: 'board', label: 'Board' },
];
const opName = (id) => OPERATORS_BY_ID[id]?.name ?? 'Any operator';
const move = (list, i, d) => {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

function Details({ draft, set }) {
  const sites = draft.mapId && draft.mapId !== 'any' ? sitesFor(draft.mapId, draft.side) : [];
  return (
    <div className="form">
      <label className="field">
        <span className="field__label">Title</span>
        <input className="input" value={draft.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} />
      </label>
      <div className="field-row">
        <label className="field">
          <span className="field__label">Map</span>
          <select className="select" value={draft.mapId} onChange={(e) => set({ mapId: e.target.value, site: '' })}>
            <option value="any">Any map</option>
            {MAPS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Site</span>
          <select className="select" value={draft.site} onChange={(e) => set({ site: e.target.value, floor: '' })} disabled={!sites.length}>
            <option value="">Any site</option>
            {sites.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          <span className="field__label">Side</span>
          <select
            className="select"
            value={draft.side}
            onChange={(e) =>
              set({
                side: e.target.value,
                site: '',
                slots: draft.slots.map((s) => (OPERATORS_BY_ID[s.operatorId]?.side === e.target.value ? s : { ...s, operatorId: null, alternatives: [] })),
              })
            }
          >
            <option value="attack">Attack</option>
            <option value="defend">Defense</option>
          </select>
        </label>
        <label className="field">
          <span className="field__label">Type</span>
          <select className="select" value={draft.type} onChange={(e) => set({ type: e.target.value })}>
            {Object.entries(STRATEGY_TYPES).map(([id, l]) => (
              <option key={id} value={id}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Difficulty</span>
          <select className="select" value={draft.difficulty} onChange={(e) => set({ difficulty: Number(e.target.value) })}>
            {Object.entries(DIFFICULTY).map(([id, l]) => (
              <option key={id} value={id}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span className="field__label">Summary</span>
        <textarea className="textarea" value={draft.summary} maxLength={1000} onChange={(e) => set({ summary: e.target.value })} />
      </label>
      <label className="field">
        <span className="field__label">Timing</span>
        <input className="input" value={draft.timing} maxLength={200} placeholder="e.g. Breach at 1:50, plant before 2:40" onChange={(e) => set({ timing: e.target.value })} />
      </label>
      <label className="field">
        <span className="field__label">Tags</span>
        <input
          className="input"
          value={draft.tags.join(', ')}
          placeholder="basement, anti-breach"
          onChange={(e) => set({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
        />
      </label>
      <label className="field">
        <span className="field__label">Notes</span>
        <textarea className="textarea" value={draft.notes} maxLength={2000} onChange={(e) => set({ notes: e.target.value })} />
      </label>
      <label className="field">
        <span className="field__label">Board image link (optional)</span>
        <input
          className="input"
          type="url"
          value={draft.boardImageUrl}
          placeholder="https://… your own floor plan screenshot"
          onChange={(e) => set({ boardImageUrl: e.target.value })}
        />
        <span className="field__hint">
          Replaces the schematic background. Use an image you're allowed to use. Markers keep their positions, so move them to match.
        </span>
      </label>
      <fieldset className="form field-group">
        <legend>Source</legend>
        <label className="field">
          <span className="field__label">Source name</span>
          <input className="input" value={draft.sourceName} maxLength={80} placeholder="Website, creator or video" onChange={(e) => set({ sourceName: e.target.value })} />
        </label>
        <label className="field">
          <span className="field__label">Original title</span>
          <input className="input" value={draft.sourceTitle} maxLength={160} onChange={(e) => set({ sourceTitle: e.target.value })} />
        </label>
        <label className="field">
          <span className="field__label">Link</span>
          <input className="input" type="url" value={draft.sourceUrl} placeholder="https://…" onChange={(e) => set({ sourceUrl: e.target.value })} />
        </label>
      </fieldset>
    </div>
  );
}

function Slots({ draft, set }) {
  const ops = operatorsForSide(draft.side);
  const update = (i, patch) => set({ slots: draft.slots.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  return (
    <div className="form">
      {draft.slots.map((s, i) => {
        const taken = new Set(draft.slots.filter((_, j) => j !== i).map((x) => x.operatorId));
        return (
          <fieldset key={s.key} className="slot-edit" style={{ '--slot': slotColor(draft, s.key) }}>
            <legend>
              <span className="slot__dot" aria-hidden="true" /> Slot {i + 1}: {opName(s.operatorId)}
            </legend>
            <div className="field-row">
              <label className="field">
                <span className="field__label">Operator</span>
                <span className="op-select">
                  <OperatorIcon key={s.operatorId ?? 'none'} operator={OPERATORS_BY_ID[s.operatorId]} size="sm" />
                  <select className="select" value={s.operatorId ?? ''} onChange={(e) => update(i, { operatorId: e.target.value || null })}>
                    <option value="">Any ({ROLE_LABEL[s.role]})</option>
                    {ops.map((o) => (
                      <option key={o.id} value={o.id} disabled={taken.has(o.id)}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
              <label className="field">
                <span className="field__label">Role</span>
                <select className="select" value={s.role} onChange={(e) => update(i, { role: e.target.value })}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="field">
              <span className="field__label">Alternatives</span>
              <div className="chip-row">
                {s.alternatives.map((id) => (
                  <button key={id} type="button" className="op-pill op-pill--sub" onClick={() => update(i, { alternatives: s.alternatives.filter((x) => x !== id) })}>
                    {opName(id)} <span aria-hidden="true">✕</span>
                    <span className="visually-hidden"> remove</span>
                  </button>
                ))}
                {s.alternatives.length < 6 && (
                  <select
                    className="select input--sm alt-add"
                    value=""
                    aria-label={`Add an alternative to ${opName(s.operatorId)}`}
                    onChange={(e) => e.target.value && update(i, { alternatives: [...s.alternatives, e.target.value] })}
                  >
                    <option value="">+ Add</option>
                    {ops
                      .filter((o) => o.id !== s.operatorId && !s.alternatives.includes(o.id))
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                  </select>
                )}
              </div>
            </div>
            <label className="field">
              <span className="field__label">Spawn / start</span>
              <input className="input" value={s.spawn} maxLength={60} onChange={(e) => update(i, { spawn: e.target.value })} />
            </label>
            <label className="field">
              <span className="field__label">Instructions (one step per line)</span>
              <textarea
                className="textarea"
                value={s.instructions.join('\n')}
                onChange={(e) => update(i, { instructions: e.target.value.split('\n') })}
                placeholder={'Drone the main wall.\nOpen it when the support calls clear.\nHold the breach.'}
              />
            </label>
            <div className="toolbar">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => set({ slots: move(draft.slots, i, -1) })} disabled={i === 0}>
                Move up
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => set({ slots: move(draft.slots, i, 1) })} disabled={i === draft.slots.length - 1}>
                Move down
              </button>
              <button
                type="button"
                className="btn btn--danger btn--sm"
                onClick={() =>
                  set({
                    slots: draft.slots.filter((_, j) => j !== i),
                    markers: draft.markers.map((m) => (m.slotKey === s.key ? { ...m, slotKey: null } : m)),
                    paths: draft.paths.map((p) => (p.slotKey === s.key ? { ...p, slotKey: null } : p)),
                    steps: draft.steps.map((st) => ({ ...st, slots: st.slots.filter((k) => k !== s.key) })),
                  })
                }
              >
                Remove slot
              </button>
            </div>
          </fieldset>
        );
      })}
      {draft.slots.length < 6 && (
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() =>
            set({ slots: [...draft.slots, { key: newId('s'), operatorId: null, role: 'support', alternatives: [], spawn: '', instructions: [] }] })
          }
        >
          <Icon name="plus" size={18} /> Add operator slot
        </button>
      )}
    </div>
  );
}

function Steps({ draft, set }) {
  const update = (i, patch) => set({ steps: draft.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  return (
    <div className="form">
      {draft.steps.map((s, i) => (
        <fieldset key={s.id} className="slot-edit">
          <legend>Step {i + 1}</legend>
          <div className="field-row">
            <label className="field">
              <span className="field__label">Title</span>
              <input className="input" value={s.title} maxLength={80} onChange={(e) => update(i, { title: e.target.value })} />
            </label>
            <label className="field">
              <span className="field__label">Timing</span>
              <input className="input" value={s.timing} maxLength={40} placeholder="1:30–2:00" onChange={(e) => update(i, { timing: e.target.value })} />
            </label>
          </div>
          <label className="field">
            <span className="field__label">What happens</span>
            <textarea className="textarea" value={s.description} maxLength={600} onChange={(e) => update(i, { description: e.target.value })} />
          </label>
          <div className="field">
            <span className="field__label">Operators involved</span>
            <div className="chip-row">
              {draft.slots.map((sl) => (
                <button
                  key={sl.key}
                  type="button"
                  className="slot-tag slot-tag--toggle"
                  style={{ '--slot': slotColor(draft, sl.key) }}
                  aria-pressed={s.slots.includes(sl.key)}
                  onClick={() => update(i, { slots: s.slots.includes(sl.key) ? s.slots.filter((k) => k !== sl.key) : [...s.slots, sl.key] })}
                >
                  {opName(sl.operatorId)}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span className="field__label">Utility</span>
            <input className="input" value={s.utility} maxLength={200} onChange={(e) => update(i, { utility: e.target.value })} />
          </label>
          <label className="field">
            <span className="field__label">Notes</span>
            <input className="input" value={s.notes} maxLength={400} onChange={(e) => update(i, { notes: e.target.value })} />
          </label>
          <div className="toolbar">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => set({ steps: move(draft.steps, i, -1) })} disabled={i === 0}>
              Move up
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => set({ steps: move(draft.steps, i, 1) })} disabled={i === draft.steps.length - 1}>
              Move down
            </button>
            <button
              type="button"
              className="btn btn--danger btn--sm"
              onClick={() =>
                set({
                  steps: draft.steps.filter((_, j) => j !== i),
                  markers: draft.markers.map((m) => (m.stepId === s.id ? { ...m, stepId: null } : m)),
                  paths: draft.paths.map((p) => (p.stepId === s.id ? { ...p, stepId: null } : p)),
                })
              }
            >
              Remove step
            </button>
          </div>
        </fieldset>
      ))}
      {draft.steps.length < 15 && (
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() =>
            set({ steps: [...draft.steps, { id: newId('st'), title: `Step ${draft.steps.length + 1}`, description: '', slots: [], timing: '', utility: '', notes: '' }] })
          }
        >
          <Icon name="plus" size={18} /> Add step
        </button>
      )}
    </div>
  );
}

function BoardEditor({ draft, set, mapName }) {
  const svgRef = useRef(null);
  const [tool, setTool] = useState('position');
  const [slotKey, setSlotKey] = useState(draft.slots[0]?.key ?? null);
  const [stepId, setStepId] = useState(draft.steps[0]?.id ?? null);
  const [selected, setSelected] = useState(null);
  const [pathKind, setPathKind] = useState('move');
  const [draftPath, setDraftPath] = useState([]);
  const marker = draft.markers.find((m) => m.id === selected);

  const toPoint = (e) => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    const r = (v, max) => Math.round(Math.min(max, Math.max(0, v)) * 10) / 10;
    return [r(p.x, BOARD_W), r(p.y, BOARD_H)];
  };
  const updateMarker = (id, patch) => set((d) => ({ markers: d.markers.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));

  const onBoardPointer = (e) => {
    const [x, y] = toPoint(e);
    if (tool === 'path') {
      setDraftPath((p) => [...p, [x, y]]);
      return;
    }
    if (tool === 'select') {
      setSelected(null);
      return;
    }
    if (draft.markers.length >= 80) return;
    const op = OPERATORS_BY_ID[draft.slots.find((s) => s.key === slotKey)?.operatorId];
    const label = tool === 'plant' ? 'Plant' : op ? `${op.name}${tool === 'position' ? '' : `: ${MARKER_KINDS[tool].toLowerCase()}`}` : MARKER_KINDS[tool];
    const m = { id: newId('m'), kind: tool, x, y, label, slotKey: tool === 'plant' ? null : slotKey, stepId };
    set((d) => ({ markers: [...d.markers, m] }));
    setSelected(m.id);
  };

  const onMarkerPointerDown = (e, m) => {
    setSelected(m.id);
    if (tool !== 'select') return;
    e.preventDefault();
    const moveTo = (ev) => {
      const [x, y] = toPoint(ev);
      updateMarker(m.id, { x, y });
    };
    const stop = () => {
      window.removeEventListener('pointermove', moveTo);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', moveTo);
    window.addEventListener('pointerup', stop);
  };

  const finishPath = () => {
    if (draftPath.length >= 2) set((d) => ({ paths: [...d.paths, { id: newId('p'), kind: pathKind, points: draftPath, slotKey, stepId }] }));
    setDraftPath([]);
  };

  return (
    <div className="board-editor">
      <div className="field-row">
        <label className="field">
          <span className="field__label">Operator</span>
          <select className="select" value={slotKey ?? ''} onChange={(e) => setSlotKey(e.target.value || null)}>
            <option value="">None (team)</option>
            {draft.slots.map((s) => (
              <option key={s.key} value={s.key}>
                {opName(s.operatorId)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Step</span>
          <select className="select" value={stepId ?? ''} onChange={(e) => setStepId(e.target.value || null)}>
            <option value="">Setup (always shown)</option>
            {draft.steps.map((s, i) => (
              <option key={s.id} value={s.id}>
                {i + 1}. {s.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="tool-row" role="group" aria-label="Board tool">
        {[['select', 'Move'], ...Object.entries(MARKER_KINDS), ['path', 'Path']].map(([id, label]) => (
          <button key={id} type="button" className="step-chip" aria-pressed={tool === id} onClick={() => setTool(id)}>
            {label}
          </button>
        ))}
      </div>
      <p className="muted small">
        {tool === 'select'
          ? 'Drag a marker to move it. Tap one to edit or delete it.'
          : tool === 'path'
            ? 'Tap points on the board, then press Finish path.'
            : `Tap the board to place a ${MARKER_KINDS[tool].toLowerCase()} marker for the chosen operator and step.`}
      </p>
      <StrategyBoard
        strategy={draft}
        mapName={mapName}
        stepId={stepId}
        selectedSlot={null}
        selectedMarker={selected}
        draftPath={draftPath}
        svgRef={svgRef}
        editing
        onBoardPointer={onBoardPointer}
        onMarkerPointerDown={onMarkerPointerDown}
      />
      {tool === 'path' && (
        <div className="toolbar path-bar">
          <select className="select input--sm" value={pathKind} onChange={(e) => setPathKind(e.target.value)} aria-label="Path type">
            {Object.entries(PATH_KINDS).map(([id, l]) => (
              <option key={id} value={id}>
                {l}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn--primary btn--sm" onClick={finishPath} disabled={draftPath.length < 2}>
            Finish path
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDraftPath((p) => p.slice(0, -1))} disabled={!draftPath.length}>
            Undo point
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDraftPath([])} disabled={!draftPath.length}>
            Cancel
          </button>
        </div>
      )}
      {marker && (
        <fieldset className="slot-edit marker-inspector">
          <legend>Selected marker</legend>
          <div className="field-row">
            <label className="field">
              <span className="field__label">Label</span>
              <input className="input" value={marker.label} maxLength={60} onChange={(e) => updateMarker(marker.id, { label: e.target.value })} />
            </label>
            <label className="field">
              <span className="field__label">Kind</span>
              <select className="select" value={marker.kind} onChange={(e) => updateMarker(marker.id, { kind: e.target.value })}>
                {Object.entries(MARKER_KINDS).map(([id, l]) => (
                  <option key={id} value={id}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span className="field__label">Operator</span>
              <select className="select" value={marker.slotKey ?? ''} onChange={(e) => updateMarker(marker.id, { slotKey: e.target.value || null })}>
                <option value="">None (team)</option>
                {draft.slots.map((s) => (
                  <option key={s.key} value={s.key}>
                    {opName(s.operatorId)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Step</span>
              <select className="select" value={marker.stepId ?? ''} onChange={(e) => updateMarker(marker.id, { stepId: e.target.value || null })}>
                <option value="">Setup</option>
                {draft.steps.map((s, i) => (
                  <option key={s.id} value={s.id}>
                    {i + 1}. {s.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            className="btn btn--danger btn--sm"
            onClick={() => {
              set((d) => ({ markers: d.markers.filter((m) => m.id !== marker.id) }));
              setSelected(null);
            }}
          >
            <Icon name="trash" size={16} /> Delete marker
          </button>
        </fieldset>
      )}
      {draft.paths.length > 0 && (
        <div className="field">
          <span className="field__label">Paths</span>
          <ul className="path-list">
            {draft.paths.map((p) => (
              <li key={p.id} style={{ '--slot': slotColor(draft, p.slotKey) }}>
                <span className="slot__dot" aria-hidden="true" />
                <span className="path-list__text">
                  {opName(draft.slots.find((s) => s.key === p.slotKey)?.operatorId)} · {PATH_KINDS[p.kind]} ·{' '}
                  {draft.steps.find((s) => s.id === p.stepId)?.title ?? 'Setup'}
                </span>
                <button
                  type="button"
                  className="btn btn--ghost btn--icon"
                  aria-label="Delete path"
                  onClick={() => set((d) => ({ paths: d.paths.filter((x) => x.id !== p.id) }))}
                >
                  <Icon name="trash" size={16} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Edit a team strategy: details, operator slots with instructions, steps,
 * and the board (markers and paths). Saves the whole document at once.
 */
export default function StrategyEditor({ initial, isNew, strategyData, onSaved, onCancel }) {
  const [draft, setDraft] = useState(initial);
  const [tab, setTab] = useState('details');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (patch) => setDraft((d) => ({ ...d, ...(typeof patch === 'function' ? patch(d) : patch) }));
  const mapName = MAPS_BY_ID[draft.mapId]?.name ?? '';

  async function save() {
    setError('');
    setSaving(true);
    try {
      const clean = normalizeStrategy({
        ...draft,
        slots: draft.slots.map((s) => ({ ...s, instructions: s.instructions.map((t) => t.trim()).filter(Boolean) })),
      });
      await strategyData.saveStrategy({ ...clean, owner: draft.owner ?? null });
      onSaved(clean);
    } catch (e) {
      setError(e.message || 'Could not save the strategy.');
      setSaving(false);
    }
  }

  return (
    <div className="strat-editor">
      <header className="strat-detail__head">
        <div className="strat-detail__badges">
          <OriginBadge strategy={draft} />
          <span className="muted small">{attribution(draft)}</span>
        </div>
        <h1 className="page__title">{isNew ? 'New strategy' : `Edit: ${draft.title || 'strategy'}`}</h1>
      </header>
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
      <div className="segmented segmented--full editor-tabs" role="group" aria-label="Editor sections">
        {TABS.map((t) => (
          <button key={t.id} type="button" className="segmented__btn" aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <section className="panel">
        {tab === 'details' && <Details draft={draft} set={set} />}
        {tab === 'slots' && <Slots draft={draft} set={set} />}
        {tab === 'steps' && <Steps draft={draft} set={set} />}
        {tab === 'board' && <BoardEditor draft={draft} set={set} mapName={mapName} />}
      </section>
      <div className="strat-actions strat-actions--sticky">
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="button" className="btn btn--primary" onClick={save} disabled={saving || !strategyData.canSave}>
          {saving ? 'Saving…' : 'Save strategy'}
        </button>
      </div>
    </div>
  );
}
