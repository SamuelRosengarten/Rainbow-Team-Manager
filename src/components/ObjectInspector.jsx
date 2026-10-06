import Icon from './Icon.jsx';
import OperatorIcon from './OperatorIcon.jsx';
import { OPERATORS_BY_ID } from '../lib/operators.js';
import { slotColor } from '../lib/strategies.js';
import { BREACH_TYPES, OBJECTS, PATHS, ZONES, describeItem, gadgetsForSide, utilityName } from '../lib/tactical.js';
import { groupItems } from '../lib/tacticStatus.js';
import { useI18n } from '../i18n/index.js';
import { T } from '../i18n/Rich.jsx';

function SlotSelect({ strategy, value, onChange, label, none }) {
  const { t } = useI18n();
  return (
    <label className="field">
      <span className="field__label">{label ?? t('inspector.operator')}</span>
      <select className="select input--sm" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{none ?? t('inspector.teamNobody')}</option>
        {strategy.slots.map((s) => (
          <option key={s.key} value={s.key}>
            {OPERATORS_BY_ID[s.operatorId]?.name ?? t('objectInspector.anyOperator')}
          </option>
        ))}
      </select>
    </label>
  );
}

function StepSelect({ strategy, value, onChange }) {
  const { t } = useI18n();
  return (
    <label className="field">
      <span className="field__label">{t('objectInspector.step')}</span>
      <select className="select input--sm" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{t('objectInspector.setupAlwaysShown')}</option>
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
 * Edit the selected board object. With nothing selected, lists what's placed
 * in the chosen step, grouped (players, routes, utility, areas, notes), so
 * items can be picked without the mouse.
 */
export default function ObjectInspector({ draft, selected, update, remove, onSelect, onDuplicate, stepFilter, hidden = null }) {
  const { t } = useI18n();
  const coll = { marker: 'markers', zone: 'zones', crossfire: 'crossfires', path: 'paths' };
  const item = selected ? draft[coll[selected.type]]?.find((x) => x.id === selected.id) : null;

  if (!item) {
    const groups = groupItems(draft, stepFilter);
    const count = groups.reduce((n, g) => n + g.rows.length, 0);
    return (
      <div className="inspector">
        <div className="items__head">
          <h3 className="items__title">{t(stepFilter ? 'planner.items.step' : 'planner.items.setup')}</h3>
          {count > 0 && <span className="items__count">{t('planner.items.count', { count })}</span>}
        </div>
        {count ? (
          groups.map((g) => (
            <section key={g.id} className="items__group" aria-labelledby={`items-${g.id}`}>
              <h4 id={`items-${g.id}`} className="items__group-title">
                {t(`planner.itemGroup.${g.id}`)}
              </h4>
              <ul className="obj-list">
                {g.rows.map(({ type, item: x }) => {
                  const key = x.slotKey ?? x.slotA;
                  const o = OPERATORS_BY_ID[draft.slots.find((s) => s.key === key)?.operatorId];
                  return (
                    <li key={x.id}>
                      <button type="button" className="obj-list__btn" style={{ '--slot': slotColor(draft, key) }} onClick={() => onSelect({ type, id: x.id })}>
                        {o ? <OperatorIcon key={o.id} operator={o} size="xs" /> : <span className="slot__dot" aria-hidden="true" />}
                        <span className="obj-list__name">{describeItem(draft, type, x)}</span>
                        {hidden?.has(x.id) && <span className="obj-list__tag">{t('planner.items.hiddenTag')}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        ) : (
          <p className="items__empty">{t('planner.items.empty')}</p>
        )}
        <p className="muted small inspector__keys">
          <T id="inspector.keys" />
        </p>
      </div>
    );
  }

  const set = (patch, key) => update(selected.type, item.id, patch, key ? { key: `${item.id}-${key}` } : undefined);
  const title = selected.type === 'marker' ? OBJECTS[item.kind].label : selected.type === 'zone' ? t('inspector.area') : selected.type === 'path' ? t('inspector.route') : t('tool.crossfire');

  return (
    <div className="inspector">
      <button type="button" className="link-btn inspector__back" onClick={() => onSelect(null)}>
        <Icon name="back" size={16} /> {t('planner.items.back')}
      </button>
      <div className="inspector__head">
        <h3 className="inspector__title">{title}</h3>
        <button type="button" className="btn btn--ghost btn--icon" aria-label={t('objectInspector.closeInspector')} onClick={() => onSelect(null)}>
          <Icon name="close" size={18} />
        </button>
      </div>

      {selected.type === 'marker' && (
        <div className="form form--tight">
          <label className="field">
            <span className="field__label">{t('objectInspector.type')}</span>
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
          <Text label={item.kind === 'note' ? t('inspector.noteText') : t('inspector.label')} value={item.label} max={60} onChange={(v) => set({ label: v }, 'label')} autoFocus={item.kind === 'note'} />
          <SlotSelect strategy={draft} value={item.slotKey} onChange={(v) => set({ slotKey: v })} />
          {item.kind === 'utility' && (
            <label className="field">
              <span className="field__label">{t('objectInspector.utility')}</span>
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
              <span className="field__label">{t('objectInspector.breach')}</span>
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
              <span className="field__label">{t('objectInspector.attachedTo')}</span>
              <select className="select input--sm" value={item.anchorId ?? ''} onChange={(e) => set({ anchorId: e.target.value || undefined })}>
                <option value="">{t('objectInspector.nothingAMapLocation')}</option>
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
              <Text label={t('inspector.purpose')} value={item.purpose} max={120} placeholder={t('objectInspector.eGDenyTheThermite')} onChange={(v) => set({ purpose: v }, 'purpose')} />
              <Text label={t('inspector.timing')} value={item.timing} max={30} placeholder={t('objectInspector.eG040Or')} onChange={(v) => set({ timing: v }, 'timing')} />
              <Text label={t('inspector.instructions')} area value={item.note} max={300} placeholder={t('objectInspector.whatThePlayerDoesHere')} onChange={(v) => set({ note: v }, 'note')} />
            </>
          )}
        </div>
      )}

      {selected.type === 'zone' && (
        <div className="form form--tight">
          <label className="field">
            <span className="field__label">{t('objectInspector.kind')}</span>
            <select className="select input--sm" value={item.kind} onChange={(e) => set({ kind: e.target.value })}>
              {Object.entries(ZONES).map(([id, z]) => (
                <option key={id} value={id}>
                  {z.label}
                </option>
              ))}
            </select>
          </label>
          <Text label={t('inspector.label')} value={item.label} max={60} placeholder={t('objectInspector.eGHoldThisHallway')} onChange={(v) => set({ label: v }, 'label')} />
          <SlotSelect strategy={draft} value={item.slotKey} onChange={(v) => set({ slotKey: v })} label={t('inspector.whoHoldsIt')} />
          <StepSelect strategy={draft} value={item.stepId} onChange={(v) => set({ stepId: v })} />
          <Text label={t('inspector.notes')} area value={item.note} max={300} onChange={(v) => set({ note: v }, 'note')} />
        </div>
      )}

      {selected.type === 'crossfire' && (
        <div className="form form--tight">
          <SlotSelect strategy={draft} value={item.slotA} onChange={(v) => set({ slotA: v })} label={t('inspector.playerA')} none={t('inspector.unassigned')} />
          <SlotSelect strategy={draft} value={item.slotB} onChange={(v) => set({ slotB: v })} label={t('inspector.playerB')} none={t('inspector.unassigned')} />
          <Text label={t('inspector.engagementArea')} value={item.label} max={60} placeholder={t('objectInspector.eGMainStairs')} onChange={(v) => set({ label: v }, 'label')} />
          <Text label={t('inspector.timingOptional')} value={item.timing} max={30} placeholder={t('objectInspector.eGAfterPlant')} onChange={(v) => set({ timing: v }, 'timing')} />
          <label className="field">
            <span className="field__label">{t('objectInspector.areaSize')}</span>
            <input type="range" min="1.5" max="15" step="0.5" value={item.radius} onChange={(e) => set({ radius: Number(e.target.value) }, 'radius')} />
          </label>
          <StepSelect strategy={draft} value={item.stepId} onChange={(v) => set({ stepId: v })} />
          <Text label={t('inspector.notes')} area value={item.note} max={300} onChange={(v) => set({ note: v }, 'note')} />
        </div>
      )}

      {selected.type === 'path' && (
        <div className="form form--tight">
          <label className="field">
            <span className="field__label">{t('objectInspector.routeType')}</span>
            <select className="select input--sm" value={item.kind} onChange={(e) => set({ kind: e.target.value })}>
              {Object.entries(PATHS).map(([id, p]) => (
                <option key={id} value={id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <Text label={t('inspector.label')} value={item.label} max={60} onChange={(v) => set({ label: v }, 'label')} />
          <SlotSelect strategy={draft} value={item.slotKey} onChange={(v) => set({ slotKey: v })} />
          <StepSelect strategy={draft} value={item.stepId} onChange={(v) => set({ stepId: v })} />
          <button type="button" className="btn btn--ghost btn--sm" disabled={item.points.length <= 2} onClick={() => set({ points: item.points.slice(0, -1) })}>
            {t('objectInspector.removeLastPoint')}
          </button>
        </div>
      )}

      <div className="inspector__actions">
        {onDuplicate && (
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => onDuplicate(selected)}>
            <Icon name="copy" size={16} /> {t('planner.action.duplicate')}
          </button>
        )}
        <button type="button" className="btn btn--danger btn--sm inspector__delete" onClick={() => remove(selected)}>
          <Icon name="trash" size={16} /> {t('objectInspector.delete')}
        </button>
      </div>
    </div>
  );
}

/**
 * Read-only card for a clicked board object: operator, utility, purpose,
 * timing and instructions.
 */
export function ObjectCard({ strategy, selected, players = {}, onClose }) {
  const { t } = useI18n();
  const coll = { marker: 'markers', zone: 'zones', crossfire: 'crossfires', path: 'paths' };
  const item = selected ? strategy[coll[selected.type]]?.find((x) => x.id === selected.id) : null;
  if (!item) return null;
  const slotKey = item.slotKey ?? item.slotA;
  const slot = strategy.slots.find((s) => s.key === slotKey);
  const op = OPERATORS_BY_ID[slot?.operatorId];
  const step = strategy.steps.find((s) => s.id === item.stepId);
  const rows = [
    ['operator', op ? `${op.name}${players[slotKey] ? ` (${players[slotKey]})` : ''}` : null],
    selected.type === 'crossfire' ? ['with', (() => {
      const s2 = strategy.slots.find((s) => s.key === item.slotB);
      const o2 = OPERATORS_BY_ID[s2?.operatorId];
      return o2 ? `${o2.name}${players[item.slotB] ? ` (${players[item.slotB]})` : ''}` : null;
    })()] : null,
    item.kind === 'utility' ? ['utility', utilityName(item.gadget, op?.id)] : null,
    item.kind === 'breach' ? ['breach', BREACH_TYPES[item.breachType]] : null,
    ['purpose', item.purpose],
    ['timing', item.timing || step?.clock || null],
    ['step', step ? `${strategy.steps.indexOf(step) + 1}. ${step.title}` : t('inspector.setup')],
    ['instructions', item.note],
  ].filter((r) => r && r[1]);
  return (
    <div className="obj-card" style={{ '--slot': slotColor(strategy, slotKey) }} role="region" aria-label={t('objectInspector.selectedObject')}>
      <div className="obj-card__head">
        {op && <OperatorIcon key={op.id} operator={op} size="sm" />}
        <strong>{describeItem(strategy, selected.type, item)}</strong>
        <button type="button" className="btn btn--ghost btn--icon" aria-label={t('objectInspector.close')} onClick={onClose}>
          <Icon name="close" size={16} />
        </button>
      </div>
      <dl className="obj-card__rows">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{t(`inspector.row.${k}`)}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
