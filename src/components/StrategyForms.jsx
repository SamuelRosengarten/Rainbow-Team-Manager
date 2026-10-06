import Icon from './Icon.jsx';
import OperatorIcon from './OperatorIcon.jsx';
import SynergyList from './SynergyList.jsx';
import { ROLES, ROLE_LABEL } from '../lib/fit.js';
import { MAPS, sitesFor } from '../lib/maps.js';
import { OPERATORS_BY_ID, operatorsForSide } from '../lib/operators.js';
import { DIFFICULTY, LIMITS, newId, slotColor } from '../lib/strategies.js';
import { STRATEGY_TYPES_BY_SIDE, TACTICAL_ROLES, normalizeClock, normalizeType } from '../lib/tactical.js';
import { keySlots } from '../lib/composition.js';
import { t as translate, useI18n } from '../i18n/index.js';

const opName = (id) => OPERATORS_BY_ID[id]?.name ?? translate('card.anyOperator');
const move = (list, i, d) => {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

/** Title, map/site/side, type, summary, timing, notes, board image and source. */
export function DetailsForm({ draft, set, compact = false }) {
  const { t } = useI18n();
  const sites = draft.mapId && draft.mapId !== 'any' ? sitesFor(draft.mapId, draft.side) : [];
  const f = (key) => ({ key: `details-${key}` });
  return (
    <div className="form">
      <label className="field">
        <span className="field__label">{t('strategyForms.title')}</span>
        <input className="input" value={draft.title} maxLength={120} placeholder={t('strategyForms.eGOregonBasementExecute')} onChange={(e) => set({ title: e.target.value }, f('title'))} />
      </label>
      {draft.version > 1 && (
        <label className="field">
          <span className="field__label">{t('forms.versionNote', { version: draft.version })}</span>
          <input className="input" value={draft.versionNote} maxLength={120} placeholder={t('strategyForms.eGChangedBuckRoute')} onChange={(e) => set({ versionNote: e.target.value }, f('vnote'))} />
        </label>
      )}
      {!compact && (
        <div className="field-row">
          <label className="field">
            <span className="field__label">{t('strategyForms.map')}</span>
            <select className="select" value={draft.mapId} onChange={(e) => set({ mapId: e.target.value, site: '' })}>
              <option value="any">{t('strategyForms.anyMap')}</option>
              {MAPS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">{t('strategyForms.site')}</span>
            <select className="select" value={draft.site} onChange={(e) => set({ site: e.target.value, floor: '' })} disabled={!sites.length}>
              <option value="">{t('strategyForms.anySite')}</option>
              {sites.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">{t('strategyForms.side')}</span>
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
              <option value="attack">{t('strategyForms.attack')}</option>
              <option value="defend">{t('strategyForms.defense')}</option>
            </select>
          </label>
        </div>
      )}
      <div className="field">
        <span className="field__label">{t('strategyForms.strategyType')}</span>
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
          <span className="field__label">{t('strategyForms.difficulty')}</span>
          <select className="select" value={draft.difficulty} onChange={(e) => set({ difficulty: Number(e.target.value) })}>
            {Object.entries(DIFFICULTY).map(([id, l]) => (
              <option key={id} value={id}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">{t('strategyForms.overallTiming')}</span>
          <input className="input" value={draft.timing} maxLength={200} placeholder={t('strategyForms.eGBreachAt1')} onChange={(e) => set({ timing: e.target.value }, f('timing'))} />
        </label>
      </div>
      <label className="field">
        <span className="field__label">{t('strategyForms.summary')}</span>
        <textarea className="textarea" value={draft.summary} maxLength={1000} placeholder={t('strategyForms.theIdeaInTwoSentences')} onChange={(e) => set({ summary: e.target.value }, f('summary'))} />
      </label>
      <label className="field">
        <span className="field__label">{t('strategyForms.tags')}</span>
        <input
          className="input"
          value={draft.tags.join(', ')}
          placeholder={t('strategyForms.basementAntiBreach')}
          onChange={(e) => set({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) }, f('tags'))}
        />
      </label>
      <label className="field">
        <span className="field__label">{t('strategyForms.coachNotes')}</span>
        <textarea className="textarea" value={draft.notes} maxLength={2000} onChange={(e) => set({ notes: e.target.value }, f('notes'))} />
      </label>
      {!compact && (
        <>
          <label className="field">
            <span className="field__label">{t('strategyForms.attachedImageLinkOptional')}</span>
            <input className="input" type="url" value={draft.boardImageUrl} placeholder={t('strategyForms.httpsAScreenshotOrDrawing')} onChange={(e) => set({ boardImageUrl: e.target.value }, f('img'))} />
            <span className="field__hint">{t('strategyForms.shownAsALinkUnder')}</span>
          </label>
          <fieldset className="form field-group">
            <legend>{t('strategyForms.source')}</legend>
            <div className="field-row">
              <label className="field">
                <span className="field__label">{t('strategyForms.sourceName')}</span>
                <input className="input" value={draft.sourceName} maxLength={80} placeholder={t('strategyForms.websiteCreatorOrVideo')} onChange={(e) => set({ sourceName: e.target.value }, f('sn'))} />
              </label>
              <label className="field">
                <span className="field__label">{t('strategyForms.link')}</span>
                <input className="input" type="url" value={draft.sourceUrl} placeholder={t('strategyForms.https')} onChange={(e) => set({ sourceUrl: e.target.value }, f('su'))} />
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
  // Key slots the plan gets automatically (hard breach, its denial clear, a hold's breach denial).
  const derivedKeys = keySlots({ ...draft, slots: draft.slots.map(({ essential: _e, ...x }) => x) });
  const { t } = useI18n();
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
                  <span className="field__label">{t('strategyForms.operator')}</span>
                  <select className="select" value={s.operatorId ?? ''} onChange={(e) => update(i, { operatorId: e.target.value || null })}>
                    <option value="">{t('forms.anyRole', { role: ROLE_LABEL[s.role] })}</option>
                    {ops.map((o) => (
                      <option key={o.id} value={o.id} disabled={taken.has(o.id)}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field__label">{t('strategyForms.tacticalRole')}</span>
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
                    <span className="field__label">{t('strategyForms.player')}</span>
                    <select className="select" value={assigned[s.key] ?? ''} onChange={(e) => onAssign(s.key, e.target.value || null)}>
                      <option value="">{t('strategyForms.unassigned')}</option>
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
                <span className="field__label">{t('strategyForms.operatorCategory')}</span>
                <select className="select" value={s.role} onChange={(e) => update(i, { role: e.target.value })}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">{t('strategyForms.spawnStart')}</span>
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
                {t('strategyForms.carriesTheDefuser')}
              </label>
            )}
            <label className="check">
              <input
                type="checkbox"
                checked={Boolean(s.essential) || derivedKeys.has(s.key)}
                disabled={derivedKeys.has(s.key) && !s.essential}
                aria-describedby={`key-hint-${s.key}`}
                onChange={(e) => update(i, { essential: e.target.checked || undefined })}
              />
              {t('comp.keySlot')}
              <span id={`key-hint-${s.key}`} className="muted small">
                {' '}
                {derivedKeys.has(s.key) ? `(${t(`utility.${derivedKeys.get(s.key)}`)}) ` : ''}
                {t('comp.keySlot.hint')}
              </span>
            </label>
            <div className="field">
              <span className="field__label">{t('strategyForms.alternatives')}</span>
              <div className="chip-row">
                {s.alternatives.map((id) => (
                  <button key={id} type="button" className="op-pill op-pill--sub" onClick={() => update(i, { alternatives: s.alternatives.filter((x) => x !== id) })}>
                    {opName(id)} <span aria-hidden="true">✕</span>
                    <span className="visually-hidden"> {t('strategyForms.remove')}</span>
                  </button>
                ))}
                {s.alternatives.length < 6 && (
                  <select
                    className="select input--sm alt-add"
                    value=""
                    aria-label={t('forms.addAlternative', { operator: opName(s.operatorId) })}
                    onChange={(e) => e.target.value && update(i, { alternatives: [...s.alternatives, e.target.value] })}
                  >
                    <option value="">{t('strategyForms.add')}</option>
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
              <span className="field__label">{t('strategyForms.instructionsOnePerLine')}</span>
              <textarea
                className="textarea"
                value={s.instructions.join('\n')}
                onChange={(e) => update(i, { instructions: e.target.value.split('\n') }, 'instr')}
                placeholder={t('strategyForms.droneTheMainWallOpen')}
              />
            </label>
            <div className="toolbar">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => set({ slots: move(draft.slots, i, -1) })} disabled={i === 0}>
                {t('strategyForms.moveUp')}
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => set({ slots: move(draft.slots, i, 1) })} disabled={i === draft.slots.length - 1}>
                {t('strategyForms.moveDown')}
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
                {t('strategyForms.remove2')}
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
          <Icon name="plus" size={18} /> {t('strategyForms.addOperator')}
        </button>
      )}
    </div>
  );
}

/** Steps: title, round clock, what happens, who acts and what each one does. */
export function StepsForm({ draft, set }) {
  const { t } = useI18n();
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
              <span className="field__label">{t('strategyForms.roundClock')}</span>
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
              <span className="field__label">{t('strategyForms.title')}</span>
              <input className="input" value={s.title} maxLength={80} placeholder={t('strategyForms.droneClearBreachExecutePlant')} onChange={(e) => update(i, { title: e.target.value }, 'title')} />
            </label>
          </div>
          <label className="field">
            <span className="field__label">{t('strategyForms.whatHappens')}</span>
            <textarea className="textarea" value={s.description} maxLength={600} onChange={(e) => update(i, { description: e.target.value }, 'desc')} />
          </label>
          <div className="field">
            <span className="field__label">{t('strategyForms.whoActs')}</span>
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
                      <span className="visually-hidden">{t('forms.whatDoes', { operator: opName(sl.operatorId) })}</span>
                      <input
                        className="input input--sm"
                        value={s.actions[sl.key] ?? ''}
                        maxLength={300}
                        placeholder={t('forms.actionPlaceholder', { operator: opName(sl.operatorId) })}
                        onChange={(e) => update(i, { actions: { ...s.actions, [sl.key]: e.target.value } }, `act-${sl.key}`)}
                      />
                    </label>
                  );
                })}
            </div>
          )}
          <div className="field-row">
            <label className="field">
              <span className="field__label">{t('strategyForms.utility')}</span>
              <input className="input" value={s.utility} maxLength={200} onChange={(e) => update(i, { utility: e.target.value }, 'util')} />
            </label>
            <label className="field">
              <span className="field__label">{t('strategyForms.phaseTimingNote')}</span>
              <input className="input" value={s.timing} maxLength={40} placeholder={t('strategyForms.eGAfterTheBreach')} onChange={(e) => update(i, { timing: e.target.value }, 'timing')} />
            </label>
          </div>
          <label className="field">
            <span className="field__label">{t('strategyForms.notes')}</span>
            <input className="input" value={s.notes} maxLength={400} placeholder={t('strategyForms.eGDonTSwing')} onChange={(e) => update(i, { notes: e.target.value }, 'notes')} />
          </label>
          <div className="toolbar">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => set({ steps: move(draft.steps, i, -1) })} disabled={i === 0}>
              {t('strategyForms.moveUp')}
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => set({ steps: move(draft.steps, i, 1) })} disabled={i === draft.steps.length - 1}>
              {t('strategyForms.moveDown')}
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
              {t('strategyForms.removeStep')}
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
                  { id: newId('st'), title: t('strategy.stepTitle', { n: draft.steps.length + 1 }), description: '', slots: [], actions: {}, clock: '', timing: '', utility: '', notes: '' },
                ],
              })
            }
          >
            <Icon name="plus" size={18} /> {t('strategyForms.addStep')}
          </button>
          {draft.steps.length === 0 && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() =>
                set({
                  steps: (draft.side === 'attack'
                    ? [['0:45', t('forms.tpl.a1')], ['0:38', t('forms.tpl.a2')], ['0:31', t('forms.tpl.a3')], ['0:25', t('forms.tpl.a4')], ['0:18', t('forms.tpl.a5')]]
                    : [[t('forms.tpl.prep'), t('forms.tpl.d1')], ['2:30', t('forms.tpl.d2')], ['1:30', t('forms.tpl.d3')], ['0:45', t('forms.tpl.d4')], ['0:20', t('forms.tpl.d5')]]
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
              {t(draft.side === 'attack' ? 'forms.templateAttack' : 'forms.templateDefense')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
