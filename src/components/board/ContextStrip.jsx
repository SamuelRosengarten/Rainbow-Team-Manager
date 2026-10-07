import Icon from '../Icon.jsx';
import OperatorIcon from '../OperatorIcon.jsx';
import { OPERATORS_BY_ID } from '../../lib/operators.js';
import { slotColor } from '../../lib/strategies.js';
import { useI18n } from '../../i18n/index.js';

/** Tactical context: who new items belong to and when (the phase). */
export default function ContextStrip({ draft, slotKey, setSlotKey, stepId, setStepId, plainPhases, simple, step, phaseLine }) {
  const { t } = useI18n();
  return (
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
          {!plainPhases && (
            <button type="button" className="ctx-chip ctx-chip--phase" aria-pressed={stepId === null} onClick={() => setStepId(null)} title={t('planner.phase.setup')}>
              <span className="ctx-chip__name">{t('boardEditor.setup')}</span>
            </button>
          )}
          {draft.steps.map((s, i) => (
            <span key={s.id} className="tctx__seq">
              {(i > 0 || !plainPhases) && <Icon name="chevron" size={14} className="tctx__sep" />}
              <button type="button" className="ctx-chip ctx-chip--phase" aria-pressed={stepId === s.id} onClick={() => setStepId(s.id)} title={s.description || s.title}>
                {!simple && <span className="ctx-chip__n">{i + 1}</span>}
                {!simple && s.clock && <span className="ctx-chip__clock">{s.clock}</span>}
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
  );
}
