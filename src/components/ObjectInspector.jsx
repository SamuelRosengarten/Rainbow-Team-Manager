import Icon from './Icon.jsx';
import OperatorIcon from './OperatorIcon.jsx';
import { OPERATORS_BY_ID } from '../lib/operators.js';
import { slotColor } from '../lib/strategies.js';
import { BREACH_TYPES, OBJECTS, PATHS, ZONES, describeItem, gadgetsForSide, utilityName } from '../lib/tactical.js';

function SlotSelect({ strategy, value, onChange, label = 'Operator', none = 'Team (nobody)' }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <select className="select input--sm" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{none}</option>
        {strategy.slots.map((s) => (
          <option key={s.key} value={s.key}>
            {OPERATORS_BY_ID[s.operatorId]?.name ?? 'Any operator'}
          </option>
        ))}
      </select>
    </label>
  );
}

function StepSelect({ strategy, value, onChange }) {
  return (
    <label className="field">
      <span className="field__label">Step</span>
      <select className="select input--sm" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">Setup (always shown)</option>
        {strategy.steps.map((s, i) => (
          <option key={s.id} value={s.id}>
            {i + 1}. {s.clock ? `${s.clock} ` : ''}
            {s.title}
          </option>
        ))}
      </select>
    </label>
  );
}

function Text({ label, value, onChange, max, area, placeholder, autoFocus }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {area ? (
        <textarea className="textarea textarea--sm" value={value ?? ''} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} />
      ) : (
        <input className="input input--sm" value={value ?? ''} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} />
      )}
    </label>
  );
}

/**
 * Edit the selected board object. With nothing selected, lists the objects
 * (for the chosen step) so they can be picked without the mouse.
 */
export default function ObjectInspector({ draft, selected, update, remove, onSelect, stepFilter }) {
  const coll = { marker: 'markers', zone: 'zones', crossfire: 'crossfires', path: 'paths' };
  const item = selected ? draft[coll[selected.type]]?.find((x) => x.id === selected.id) : null;

  if (!item) {
    const inStep = (x) => !stepFilter || !x.stepId || x.stepId === stepFilter;
    const rows = [
      ...draft.markers.filter(inStep).map((x) => ['marker', x]),
      ...draft.paths.filter(inStep).map((x) => ['path', x]),
      ...draft.zones.filter(inStep).map((x) => ['zone', x]),
      ...draft.crossfires.filter(inStep).map((x) => ['crossfire', x]),
    ];
    return (
      <div className="inspector">
        <h3 className="inspector__title">
          <Icon name="layers" size={16} /> Objects {stepFilter ? 'in this step' : ''}
          <span className="muted">{rows.length}</span>
        </h3>
        {rows.length ? (
          <ul className="obj-list">
            {rows.map(([type, x]) => (
              <li key={x.id}>
                <button type="button" className="obj-list__btn" style={{ '--slot': slotColor(draft, x.slotKey ?? x.slotA) }} onClick={() => onSelect({ type, id: x.id })}>
                  <span className="slot__dot" aria-hidden="true" />
                  {describeItem(draft, type, x)}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">Nothing placed yet. Pick a tool and click the map.</p>
        )}
        <p className="muted small inspector__keys">
          <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo · <kbd>Del</kbd> delete · <kbd>Esc</kbd> cancel · arrows nudge
        </p>
      </div>
    );
  }

  const set = (patch, key) => update(selected.type, item.id, patch, key ? { key: `${item.id}-${key}` } : undefined);
  const title = selected.type === 'marker' ? OBJECTS[item.kind].label : selected.type === 'zone' ? 'Area' : selected.type === 'path' ? 'Route' : 'Crossfire';

  return (
    <div className="inspector">
      <div className="inspector__head">
        <h3 className="inspector__title">{title}</h3>
        <button type="button" className="btn btn--ghost btn--icon" aria-label="Close inspector" onClick={() => onSelect(null)}>
          <Icon name="close" size={18} />
        </button>
      </div>

      {selected.type === 'marker' && (
        <div className="form form--tight">
          <label className="field">
            <span className="field__label">Type</span>
            <select
              className="select input--sm"
              value={item.kind}
              onChange={(e) => set({ kind: e.target.value, ...(e.target.value === 'utility' ? { gadget: item.gadget ?? 'ability' } : {}), ...(e.target.value === 'breach' ? { breachType: item.breachType ?? 'hard' } : {}) })}
            >
              {Object.entries(OBJECTS).map(([id, o]) => (
                <option key={id} value={id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <Text label={item.kind === 'note' ? 'Note text' : 'Label'} value={item.label} max={60} onChange={(v) => set({ label: v }, 'label')} autoFocus={item.kind === 'note'} />
          <SlotSelect strategy={draft} value={item.slotKey} onChange={(v) => set({ slotKey: v })} />
          {item.kind === 'utility' && (
            <label className="field">
              <span className="field__label">Utility</span>
              <select className="select input--sm" value={item.gadget ?? 'ability'} onChange={(e) => set({ gadget: e.target.value })}>
                {gadgetsForSide(draft.side).map(([id, g]) => (
                  <option key={id} value={id}>
                    {id === 'ability' ? utilityName('ability', draft.slots.find((s) => s.key === item.slotKey)?.operatorId) : g.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {item.kind === 'breach' && (
            <label className="field">
              <span className="field__label">Breach</span>
              <select className="select input--sm" value={item.breachType ?? 'hard'} onChange={(e) => set({ breachType: e.target.value })}>
                {Object.entries(BREACH_TYPES).map(([id, l]) => (
                  <option key={id} value={id}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          )}
          {item.kind === 'note' && (
            <label className="field">
              <span className="field__label">Attached to</span>
              <select className="select input--sm" value={item.anchorId ?? ''} onChange={(e) => set({ anchorId: e.target.value || undefined })}>
                <option value="">Nothing (a map location)</option>
                {draft.markers
                  .filter((m) => m.id !== item.id && m.kind !== 'note')
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {describeItem(draft, 'marker', m)}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <StepSelect strategy={draft} value={item.stepId} onChange={(v) => set({ stepId: v })} />
          {item.kind !== 'note' && (
            <>
              <Text label="Purpose" value={item.purpose} max={120} placeholder="e.g. Deny the Thermite charge" onChange={(v) => set({ purpose: v }, 'purpose')} />
              <Text label="Timing" value={item.timing} max={30} placeholder="e.g. 0:40 or after breach" onChange={(v) => set({ timing: v }, 'timing')} />
              <Text label="Instructions" area value={item.note} max={300} placeholder="What the player does here" onChange={(v) => set({ note: v }, 'note')} />
            </>
          )}
        </div>
      )}

      {selected.type === 'zone' && (
        <div className="form form--tight">
          <label className="field">
            <span className="field__label">Kind</span>
            <select className="select input--sm" value={item.kind} onChange={(e) => set({ kind: e.target.value })}>
              {Object.entries(ZONES).map(([id, z]) => (
                <option key={id} value={id}>
                  {z.label}
                </option>
              ))}
            </select>
          </label>
          <Text label="Label" value={item.label} max={60} placeholder="e.g. Hold this hallway" onChange={(v) => set({ label: v }, 'label')} />
          <SlotSelect strategy={draft} value={item.slotKey} onChange={(v) => set({ slotKey: v })} label="Who holds it" />
          <StepSelect strategy={draft} value={item.stepId} onChange={(v) => set({ stepId: v })} />
          <Text label="Notes" area value={item.note} max={300} onChange={(v) => set({ note: v }, 'note')} />
        </div>
      )}

      {selected.type === 'crossfire' && (
        <div className="form form--tight">
          <SlotSelect strategy={draft} value={item.slotA} onChange={(v) => set({ slotA: v })} label="Player A" none="Unassigned" />
          <SlotSelect strategy={draft} value={item.slotB} onChange={(v) => set({ slotB: v })} label="Player B" none="Unassigned" />
          <Text label="Engagement area" value={item.label} max={60} placeholder="e.g. Main stairs" onChange={(v) => set({ label: v }, 'label')} />
          <Text label="Timing (optional)" value={item.timing} max={30} placeholder="e.g. after plant" onChange={(v) => set({ timing: v }, 'timing')} />
          <label className="field">
            <span className="field__label">Area size</span>
            <input type="range" min="1.5" max="15" step="0.5" value={item.radius} onChange={(e) => set({ radius: Number(e.target.value) }, 'radius')} />
          </label>
          <StepSelect strategy={draft} value={item.stepId} onChange={(v) => set({ stepId: v })} />
          <Text label="Notes" area value={item.note} max={300} onChange={(v) => set({ note: v }, 'note')} />
        </div>
      )}

      {selected.type === 'path' && (
        <div className="form form--tight">
          <label className="field">
            <span className="field__label">Route type</span>
            <select className="select input--sm" value={item.kind} onChange={(e) => set({ kind: e.target.value })}>
              {Object.entries(PATHS).map(([id, p]) => (
                <option key={id} value={id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <Text label="Label" value={item.label} max={60} onChange={(v) => set({ label: v }, 'label')} />
          <SlotSelect strategy={draft} value={item.slotKey} onChange={(v) => set({ slotKey: v })} />
          <StepSelect strategy={draft} value={item.stepId} onChange={(v) => set({ stepId: v })} />
          <button type="button" className="btn btn--ghost btn--sm" disabled={item.points.length <= 2} onClick={() => set({ points: item.points.slice(0, -1) })}>
            Remove last point
          </button>
        </div>
      )}

      <button type="button" className="btn btn--danger btn--sm inspector__delete" onClick={() => remove(selected)}>
        <Icon name="trash" size={16} /> Delete
      </button>
    </div>
  );
}

/**
 * Read-only card for a clicked board object: operator, utility, purpose,
 * timing and instructions.
 */
export function ObjectCard({ strategy, selected, players = {}, onClose }) {
  const coll = { marker: 'markers', zone: 'zones', crossfire: 'crossfires', path: 'paths' };
  const item = selected ? strategy[coll[selected.type]]?.find((x) => x.id === selected.id) : null;
  if (!item) return null;
  const slotKey = item.slotKey ?? item.slotA;
  const slot = strategy.slots.find((s) => s.key === slotKey);
  const op = OPERATORS_BY_ID[slot?.operatorId];
  const step = strategy.steps.find((s) => s.id === item.stepId);
  const rows = [
    ['Operator', op ? `${op.name}${players[slotKey] ? ` (${players[slotKey]})` : ''}` : null],
    selected.type === 'crossfire' ? ['With', (() => {
      const s2 = strategy.slots.find((s) => s.key === item.slotB);
      const o2 = OPERATORS_BY_ID[s2?.operatorId];
      return o2 ? `${o2.name}${players[item.slotB] ? ` (${players[item.slotB]})` : ''}` : null;
    })()] : null,
    item.kind === 'utility' ? ['Utility', utilityName(item.gadget, op?.id)] : null,
    item.kind === 'breach' ? ['Breach', BREACH_TYPES[item.breachType]] : null,
    ['Purpose', item.purpose],
    ['Timing', item.timing || step?.clock || null],
    ['Step', step ? `${strategy.steps.indexOf(step) + 1}. ${step.title}` : 'Setup'],
    ['Instructions', item.note],
  ].filter((r) => r && r[1]);
  return (
    <div className="obj-card" style={{ '--slot': slotColor(strategy, slotKey) }} role="region" aria-label="Selected object">
      <div className="obj-card__head">
        {op && <OperatorIcon key={op.id} operator={op} size="sm" />}
        <strong>{describeItem(strategy, selected.type, item)}</strong>
        <button type="button" className="btn btn--ghost btn--icon" aria-label="Close" onClick={onClose}>
          <Icon name="close" size={16} />
        </button>
      </div>
      <dl className="obj-card__rows">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
