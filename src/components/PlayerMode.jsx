import { useState } from 'react';
import Icon from './Icon.jsx';
import OperatorIcon from './OperatorIcon.jsx';
import TacticalBoard from './TacticalBoard.jsx';
import { OPERATORS_BY_ID } from '../lib/operators.js';
import { slotColor } from '../lib/strategies.js';
import { BREACH_TYPES, OBJECTS, PATHS, TACTICAL_ROLES, playerBrief, utilityName } from '../lib/tactical.js';
import { t as translate, useI18n } from '../i18n/index.js';

const opName = (id) => OPERATORS_BY_ID[id]?.name ?? translate('card.anyOperator');

/** "Who are you?" grid of the strategy's operators. */
function Chooser({ strategy, assigned, profile, onPick }) {
  const { t } = useI18n();
  return (
    <section className="panel" aria-labelledby="pick-title">
      <h2 id="pick-title" className="panel__title">{t('playerMode.whoAreYouPlaying')}</h2>
      <p className="muted small">{t('playerMode.youLlSeeOnlyYour')}</p>
      <ul className="who-grid">
        {strategy.slots.map((s) => {
          const op = OPERATORS_BY_ID[s.operatorId];
          const me = assigned[s.key] && assigned[s.key] === profile;
          return (
            <li key={s.key}>
              <button type="button" className={`who-card${me ? ' who-card--me' : ''}`} style={{ '--slot': slotColor(strategy, s.key) }} onClick={() => onPick(s.key)}>
                <OperatorIcon key={op?.id ?? 'none'} operator={op} size="xl" />
                <span className="who-card__op">{opName(s.operatorId)}</span>
                <span className="role-tag">{TACTICAL_ROLES[s.tacticalRole]}</span>
                <span className="who-card__player">{assigned[s.key] ?? t('playerMode.unassigned')}{me ? t('playerMode.you') : ''}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const describe = (m, opId) => {
  if (m.kind === 'utility') return utilityName(m.gadget, opId);
  if (m.kind === 'breach') return BREACH_TYPES[m.breachType];
  return OBJECTS[m.kind]?.label;
};

/**
 * One player's slice of a strategy: their operator, positions, routes,
 * instructions, utility and timing — and nothing else.
 */
export default function PlayerMode({ strategy, mapName, assigned = {}, profile, slotKey, onPick, onBack }) {
  const { t } = useI18n();
  const [stepId, setStepId] = useState(null);
  const slot = strategy.slots.find((s) => s.key === slotKey);

  if (!slot) {
    return (
      <div className="player-mode">
        <button type="button" className="btn btn--ghost btn--sm back-btn" onClick={onBack}>
          <Icon name="chevron" size={16} className="icon--flip" /> {strategy.title}
        </button>
        <Chooser strategy={strategy} assigned={assigned} profile={profile} onPick={onPick} />
      </div>
    );
  }

  const op = OPERATORS_BY_ID[slot.operatorId];
  const brief = playerBrief(strategy, slot.key);
  const mySteps = brief.steps.filter((s) => s.involved || s.markers.length || s.paths.length);
  const partner = (c) => {
    const other = c.slotA === slot.key ? c.slotB : c.slotA;
    return opName(strategy.slots.find((s) => s.key === other)?.operatorId);
  };

  return (
    <div className="player-mode" style={{ '--slot': slotColor(strategy, slot.key) }}>
      <div className="player-mode__top">
        <button type="button" className="btn btn--ghost btn--sm back-btn" onClick={onBack}>
          <Icon name="chevron" size={16} className="icon--flip" /> {strategy.title}
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => onPick(null)}>
          {t('playerMode.switchOperator')}
        </button>
      </div>

      <header className="pm-hero">
        <OperatorIcon key={op?.id ?? 'none'} operator={op} size="xl" />
        <div>
          <p className="pm-hero__kicker">{t('playerMode.yourJob')}</p>
          <h1 className="pm-hero__op">{opName(slot.operatorId)}</h1>
          <p className="pm-hero__meta">
            <span className="role-tag">{TACTICAL_ROLES[slot.tacticalRole]}</span>
            {assigned[slot.key] && <span>{assigned[slot.key]}</span>}
            {slot.defuser && <span className="defuser-tag">{t('playerMode.youCarryTheDefuser')}</span>}
            {slot.spawn && <span className="muted">{t('coach.spawn', { spawn: slot.spawn })}</span>}
          </p>
        </div>
      </header>

      <div className="pm-grid">
        <section className="pm-board" aria-label={t('playerMode.yourPositionsAndRoutes')}>
          <div className="step-chips" role="group" aria-label={t('playerMode.showStep')}>
            <button type="button" className="step-chip" aria-pressed={!stepId} onClick={() => setStepId(null)}>
              {t('playerMode.wholeRound')}
            </button>
            {mySteps.map(({ step, index }) => (
              <button key={step.id} type="button" className="step-chip" aria-pressed={stepId === step.id} onClick={() => setStepId(step.id)}>
                <span className="step-chip__n">{index + 1}</span>
                {step.clock && <span className="step-chip__clock">{step.clock}</span>} {step.title}
              </button>
            ))}
          </div>
          <TacticalBoard strategy={strategy} mapName={mapName} stepId={stepId} focusSlot={slot.key} isolate labels="all" title={t('playerMode.positionsOf', { operator: opName(slot.operatorId) })} />
        </section>

        <aside className="pm-side">
          <section className="panel">
            <h2 className="panel__title">{t('playerMode.yourTiming')}</h2>
            {mySteps.length ? (
              <ol className="pm-steps">
                {mySteps.map(({ step, index, action, markers, paths }) => (
                  <li key={step.id}>
                    <button type="button" className="pm-step" aria-pressed={stepId === step.id} onClick={() => setStepId(stepId === step.id ? null : step.id)}>
                      <span className="pm-step__clock">{step.clock || `#${index + 1}`}</span>
                      <span className="pm-step__body">
                        <strong>{step.title}</strong>
                        {action && <span className="pm-step__action">{action}</span>}
                        {(markers.length > 0 || paths.length > 0) && (
                          <span className="muted small">
                            {[...markers.map((m) => m.label || describe(m, slot.operatorId)), ...paths.map((p) => PATHS[p.kind].label)].join(' · ')}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted small">{t('playerMode.noStepsForYouYet')}</p>
            )}
          </section>

          {brief.utility.length > 0 && (
            <section className="panel">
              <h2 className="panel__title">{t('playerMode.yourUtility')}</h2>
              <ul className="pm-util">
                {brief.utility.map((m) => (
                  <li key={m.id}>
                    <strong>{describe(m, slot.operatorId)}</strong>
                    {m.label && m.label !== describe(m, slot.operatorId) && <span> · {m.label}</span>}
                    {(m.timing || m.purpose) && <span className="muted small">{[m.timing, m.purpose].filter(Boolean).join(' · ')}</span>}
                    {m.note && <span className="small">{m.note}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {brief.crossfires.length > 0 && (
            <section className="panel">
              <h2 className="panel__title">{t('playerMode.yourCrossfires')}</h2>
              <ul className="pm-util">
                {brief.crossfires.map((c) => (
                  <li key={c.id}>
                    <strong>{t('playerMode.crossfireWith', { partner: partner(c) })}</strong>
                    {c.label && <span>{t('playerMode.crossfireOn', { label: c.label })}</span>}
                    {c.timing && <span className="muted small">{c.timing}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {slot.instructions.length > 0 && (
            <section className="panel">
              <h2 className="panel__title">{t('playerMode.yourInstructions')}</h2>
              <ol className="slot__steps">
                {slot.instructions.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ol>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
