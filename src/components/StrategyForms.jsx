import Icon from './Icon.jsx';
import OperatorIcon from './OperatorIcon.jsx';
import SynergyList from './SynergyList.jsx';
import { ROLES, ROLE_LABEL } from '../lib/fit.js';
import { MAPS, sitesFor } from '../lib/maps.js';
import { OPERATORS_BY_ID, operatorsForSide } from '../lib/operators.js';
import { DIFFICULTY, LIMITS, newId, slotColor } from '../lib/strategies.js';
import { STRATEGY_TYPES_BY_SIDE, TACTICAL_ROLES, normalizeClock, normalizeType } from '../lib/tactical.js';

const opName = (id) => OPERATORS_BY_ID[id]?.name ?? 'Any operator';
const move = (list, i, d) => {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

/** Title, map/site/side, type, summary, timing, notes, board image and source. */
export function DetailsForm({ draft, set, compact = false }) {
  const sites = draft.mapId && draft.mapId !== 'any' ? sitesFor(draft.mapId, draft.side) : [];
  const f = (key) => ({ key: `details-${key}` });
  return (
    <div className="form">
      <label className="field">
        <span className="field__label">Title</span>
        <input className="input" value={draft.title} maxLength={120} placeholder="e.g. Oregon Basement Execute" onChange={(e) => set({ title: e.target.value }, f('title'))} />
      </label>
      {draft.version > 1 && (
        <label className="field">
          <span className="field__label">What changed in v{draft.version}</span>
          <input className="input" value={draft.versionNote} maxLength={120} placeholder="e.g. Changed Buck route" onChange={(e) => set({ versionNote: e.target.value }, f('vnote'))} />
        </label>
      )}
      {!compact && (
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
          <label className="field">
            <span className="field__label">Side</span>
            <select
              className="select"
              value={draft.side}
              onChange={(e) =>
                set({
                  side: e.target.value,
                  site: '',
                  type: normalizeType(draft.type, e.target.value),
                  slots: draft.slots.map((s) => (OPERATORS_BY_ID[s.operatorId]?.side === e.target.value ? s : { ...s, operatorId: null, alternatives: [] })),
                })
              }
            >
              <option value="attack">Attack</option>
              <option value="defend">Defense</option>
            </select>
          </label>
        </div>
      )}
      <div className="field">
        <span className="field__label">Strategy type</span>
        <div className="chip-row">
          {Object.entries(STRATEGY_TYPES_BY_SIDE[draft.side]).map(([id, l]) => (
            <button key={id} type="button" className="step-chip" aria-pressed={draft.type === id} onClick={() => set({ type: id })}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="field-row">
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
        <label className="field">
          <span className="field__label">Overall timing</span>
          <input className="input" value={draft.timing} maxLength={200} placeholder="e.g. Breach at 1:50, plant before 0:40" onChange={(e) => set({ timing: e.target.value }, f('timing'))} />
        </label>
      </div>
      <label className="field">
        <span className="field__label">Summary</span>
        <textarea className="textarea" value={draft.summary} maxLength={1000} placeholder="The idea in two sentences." onChange={(e) => set({ summary: e.target.value }, f('summary'))} />
      </label>
      <label className="field">
        <span className="field__label">Tags</span>
        <input
          className="input"
          value={draft.tags.join(', ')}
          placeholder="basement, anti-breach"
          onChange={(e) => set({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) }, f('tags'))}
        />
      </label>
      <label className="field">
        <span className="field__label">Coach notes</span>
        <textarea className="textarea" value={draft.notes} maxLength={2000} onChange={(e) => set({ notes: e.target.value }, f('notes'))} />
      </label>
      {!compact && (
        <>
          <label className="field">
            <span className="field__label">Floor plan image link (optional)</span>
            <input className="input" type="url" value={draft.boardImageUrl} placeholder="https://… your own floor plan screenshot" onChange={(e) => set({ boardImageUrl: e.target.value }, f('img'))} />
            <span className="field__hint">Replaces the schematic. Use an image you're allowed to use; objects keep their positions, so move them to match.</span>
          </label>
          <fieldset className="form field-group">
            <legend>Source</legend>
            <div className="field-row">
              <label className="field">
                <span className="field__label">Source name</span>
                <input className="input" value={draft.sourceName} maxLength={80} placeholder="Website, creator or video" onChange={(e) => set({ sourceName: e.target.value }, f('sn'))} />
              </label>
              <label className="field">
                <span className="field__label">Link</span>
                <input className="input" type="url" value={draft.sourceUrl} placeholder="https://…" onChange={(e) => set({ sourceUrl: e.target.value }, f('su'))} />
              </label>
            </div>
          </fieldset>
        </>
      )}
    </div>
  );
}

/** The five (up to six) operator slots: operator, tactical role, defuser, alternatives, spawn and instructions. */
export function SquadForm({ draft, set, roster = [], assigned = {}, onAssign }) {
  const ops = operatorsForSide(draft.side);
  const update = (i, patch, key) => set({ slots: draft.slots.map((s, j) => (j === i ? { ...s, ...patch } : s)) }, key ? { key: `slot-${i}-${key}` } : undefined);
  return (
    <div className="form">
      <SynergyList ops={draft.slots.map((s) => s.operatorId)} />
      {draft.slots.map((s, i) => {
        const taken = new Set(draft.slots.filter((_, j) => j !== i).map((x) => x.operatorId));
        const op = OPERATORS_BY_ID[s.operatorId];
        return (
          <fieldset key={s.key} className="slot-edit" style={{ '--slot': slotColor(draft, s.key) }}>
            <legend>
              <span className="slot__dot" aria-hidden="true" /> {opName(s.operatorId)}
              <span className="role-tag">{TACTICAL_ROLES[s.tacticalRole]}</span>
            </legend>
            <div className="slot-edit__top">
              <OperatorIcon key={op?.id ?? 'none'} operator={op} size="lg" />
              <div className="field-row field-row--grow">
                <label className="field">
                  <span className="field__label">Operator</span>
                  <select className="select" value={s.operatorId ?? ''} onChange={(e) => update(i, { operatorId: e.target.value || null })}>
                    <option value="">Any ({ROLE_LABEL[s.role]})</option>
                    {ops.map((o) => (
                      <option key={o.id} value={o.id} disabled={taken.has(o.id)}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field__label">Tactical role</span>
                  <select className="select" value={s.tacticalRole} onChange={(e) => update(i, { tacticalRole: e.target.value })}>
                    {Object.entries(TACTICAL_ROLES).map(([id, l]) => (
                      <option key={id} value={id}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                {onAssign && (
                  <label className="field">
                    <span className="field__label">Player</span>
                    <select className="select" value={assigned[s.key] ?? ''} onChange={(e) => onAssign(s.key, e.target.value || null)}>
                      <option value="">Unassigned</option>
                      {roster.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </div>
            <div className="field-row">
              <label className="field">
                <span className="field__label">Operator category</span>
                <select className="select" value={s.role} onChange={(e) => update(i, { role: e.target.value })}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Spawn / start</span>
                <input className="input" value={s.spawn} maxLength={60} onChange={(e) => update(i, { spawn: e.target.value }, 'spawn')} />
              </label>
            </div>
            {draft.side === 'attack' && (
              <label className="check">
                <input
                  type="checkbox"
                  checked={s.defuser}
                  onChange={(e) => set({ slots: draft.slots.map((x, j) => ({ ...x, defuser: j === i ? e.target.checked : e.target.checked ? false : x.defuser })) })}
                />
                Carries the defuser
              </label>
            )}
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
              <span className="field__label">Instructions (one per line)</span>
              <textarea
                className="textarea"
                value={s.instructions.join('\n')}
                onChange={(e) => update(i, { instructions: e.target.value.split('\n') }, 'instr')}
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
                    zones: draft.zones.map((z) => (z.slotKey === s.key ? { ...z, slotKey: null } : z)),
                    crossfires: draft.crossfires.map((c) => ({ ...c, slotA: c.slotA === s.key ? null : c.slotA, slotB: c.slotB === s.key ? null : c.slotB })),
                    steps: draft.steps.map((st) => {
                      const actions = { ...st.actions };
                      delete actions[s.key];
                      return { ...st, slots: st.slots.filter((k) => k !== s.key), actions };
                    }),
                  })
                }
              >
                Remove
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
            set({
              slots: [
                ...draft.slots,
                { key: newId('s'), operatorId: null, role: 'support', tacticalRole: 'support', defuser: false, alternatives: [], spawn: '', instructions: [] },
              ],
            })
          }
        >
          <Icon name="plus" size={18} /> Add operator
        </button>
      )}
    </div>
  );
}

/** Steps: title, round clock, what happens, who acts and what each one does. */
export function StepsForm({ draft, set }) {
  const update = (i, patch, key) => set({ steps: draft.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) }, key ? { key: `step-${i}-${key}` } : undefined);
  return (
    <div className="form">
      {draft.steps.map((s, i) => (
        <fieldset key={s.id} className="slot-edit step-edit">
          <legend>
            <span className="step-edit__n">{i + 1}</span> {s.title}
          </legend>
          <div className="field-row">
            <label className="field step-edit__clock">
              <span className="field__label">Round clock</span>
              <input
                className="input input--mono"
                value={s.clock}
                maxLength={5}
                placeholder="0:45"
                inputMode="numeric"
                onChange={(e) => update(i, { clock: e.target.value }, 'clock')}
                onBlur={(e) => update(i, { clock: normalizeClock(e.target.value) })}
              />
            </label>
            <label className="field field--grow">
              <span className="field__label">Title</span>
              <input className="input" value={s.title} maxLength={80} placeholder="Drone / Clear / Breach / Execute / Plant" onChange={(e) => update(i, { title: e.target.value }, 'title')} />
            </label>
          </div>
          <label className="field">
            <span className="field__label">What happens</span>
            <textarea className="textarea" value={s.description} maxLength={600} onChange={(e) => update(i, { description: e.target.value }, 'desc')} />
          </label>
          <div className="field">
            <span className="field__label">Who acts</span>
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
          {s.slots.length > 0 && (
            <div className="step-actions">
              {draft.slots
                .filter((sl) => s.slots.includes(sl.key))
                .map((sl) => {
                  const op = OPERATORS_BY_ID[sl.operatorId];
                  return (
                    <label key={sl.key} className="step-action" style={{ '--slot': slotColor(draft, sl.key) }}>
                      <OperatorIcon key={op?.id ?? 'none'} operator={op} size="sm" />
                      <span className="visually-hidden">What {opName(sl.operatorId)} does</span>
                      <input
                        className="input input--sm"
                        value={s.actions[sl.key] ?? ''}
                        maxLength={300}
                        placeholder={`${opName(sl.operatorId)}: e.g. "Move to breach position."`}
                        onChange={(e) => update(i, { actions: { ...s.actions, [sl.key]: e.target.value } }, `act-${sl.key}`)}
                      />
                    </label>
                  );
                })}
            </div>
          )}
          <div className="field-row">
            <label className="field">
              <span className="field__label">Utility</span>
              <input className="input" value={s.utility} maxLength={200} onChange={(e) => update(i, { utility: e.target.value }, 'util')} />
            </label>
            <label className="field">
              <span className="field__label">Phase / timing note</span>
              <input className="input" value={s.timing} maxLength={40} placeholder="e.g. After the breach" onChange={(e) => update(i, { timing: e.target.value }, 'timing')} />
            </label>
          </div>
          <label className="field">
            <span className="field__label">Notes</span>
            <input className="input" value={s.notes} maxLength={400} placeholder={'e.g. "Don\'t swing before smoke"'} onChange={(e) => update(i, { notes: e.target.value }, 'notes')} />
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
                  zones: draft.zones.map((z) => (z.stepId === s.id ? { ...z, stepId: null } : z)),
                  crossfires: draft.crossfires.map((c) => (c.stepId === s.id ? { ...c, stepId: null } : c)),
                })
              }
            >
              Remove step
            </button>
          </div>
        </fieldset>
      ))}
      {draft.steps.length < LIMITS.steps && (
        <div className="toolbar">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() =>
              set({
                steps: [
                  ...draft.steps,
                  { id: newId('st'), title: `Step ${draft.steps.length + 1}`, description: '', slots: [], actions: {}, clock: '', timing: '', utility: '', notes: '' },
                ],
              })
            }
          >
            <Icon name="plus" size={18} /> Add step
          </button>
          {draft.steps.length === 0 && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() =>
                set({
                  steps: (draft.side === 'attack'
                    ? [['0:45', 'Drone'], ['0:38', 'Clear'], ['0:31', 'Breach'], ['0:25', 'Execute'], ['0:18', 'Plant']]
                    : [['Prep', 'Reinforce & set up'], ['2:30', 'Early hold'], ['1:30', 'Deny the breach'], ['0:45', 'Late round'], ['0:20', 'Plant denial']]
                  ).map(([clock, title]) => ({
                    id: newId('st'),
                    title,
                    clock: normalizeClock(clock),
                    timing: normalizeClock(clock) ? '' : clock,
                    description: '',
                    slots: [],
                    actions: {},
                    utility: '',
                    notes: '',
                  })),
                })
              }
            >
              Use a {draft.side === 'attack' ? 'Drone → Clear → Breach → Execute → Plant' : 'standard defense'} template
            </button>
          )}
        </div>
      )}
    </div>
  );
}
