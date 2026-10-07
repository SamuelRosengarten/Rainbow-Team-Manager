import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import OperatorIcon from './OperatorIcon.jsx';
import TacticalBoard from './TacticalBoard.jsx';
import { SETUP } from '../lib/board.js';
import { OPERATORS_BY_ID } from '../lib/operators.js';
import { slotColor } from '../lib/strategies.js';
import { TACTICAL_ROLES, stepBriefing, utilityName } from '../lib/tactical.js';
import { t as translate, useI18n } from '../i18n/index.js';

const opName = (id) => OPERATORS_BY_ID[id]?.name ?? translate('card.anyOperator');

function Actor({ strategy, slot, player, action, utility = [], sub }) {
  const { t } = useI18n();
  const op = OPERATORS_BY_ID[slot.operatorId];
  return (
    <li className="actor" style={{ '--slot': slotColor(strategy, slot.key) }}>
      <OperatorIcon key={op?.id ?? 'none'} operator={op} size="lg" />
      <div className="actor__body">
        <p className="actor__who">
          <span className="actor__op">{opName(slot.operatorId)}</span>
          {player && <span className="actor__player">{player}</span>}
          <span className="role-tag">{TACTICAL_ROLES[slot.tacticalRole]}</span>
          {slot.defuser && <span className="defuser-tag">{t('coachMode.defuser')}</span>}
        </p>
        {action ? <p className="actor__action">“{action}”</p> : <p className="actor__action actor__action--none">{sub || t('coachMode.involvedInThisStep')}</p>}
        {utility.length > 0 && (
          <p className="actor__util">
            {utility.map((m) => (m.kind === 'utility' ? utilityName(m.gadget, slot.operatorId) : m.label || m.kind)).join(' · ')}
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * Full-screen presentation for explaining a strategy to the team: one step
 * at a time, who acts, where they go, what they do, what happens next.
 * Arrow keys / space move between steps; Escape exits.
 */
export default function CoachMode({ strategy, mapName, assigned = {}, onExit }) {
  const { t } = useI18n();
  const [i, setI] = useState(0); // 0 = setup, 1..n = steps
  const n = strategy.steps.length;
  const step = i > 0 ? strategy.steps[i - 1] : null;
  const next = strategy.steps[i] ?? null;
  const go = (d) => setI((x) => Math.min(n, Math.max(0, x + d)));

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        setI((x) => Math.min(n, x + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setI((x) => Math.max(0, x - 1));
      } else if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, [n, onExit]);

  const briefing = step ? stepBriefing(strategy, i - 1) : [];

  return (
    <div className="coach" role="dialog" aria-modal="true" aria-labelledby="coach-step">
      <header className="coach__bar">
        <div className="coach__title">
          <span className={`side-tag side-tag--${strategy.side}`}>{strategy.side === 'attack' ? t('coachMode.attack') : t('coachMode.defense')}</span>
          <h1 className="coach__name">{strategy.title}</h1>
          <span className="muted small">{[mapName, strategy.site].filter(Boolean).join(' · ')}</span>
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onExit}>
          <Icon name="close" size={18} /> {t('coachMode.exitCoachMode')}
        </button>
      </header>

      <div className="coach__progress" aria-hidden="true">
        {Array.from({ length: n + 1 }, (_, k) => (
          <button key={k} type="button" tabIndex={-1} className={`coach__tick${k === i ? ' coach__tick--on' : k < i ? ' coach__tick--done' : ''}`} onClick={() => setI(k)} />
        ))}
      </div>

      <div className="coach__main">
        <div className="coach__board">
          <TacticalBoard strategy={strategy} mapName={mapName} stepId={step ? step.id : SETUP} labels="auto" />
        </div>

        <section className="coach__brief" aria-live="polite" aria-labelledby="coach-step" tabIndex={0}>
          <p id="coach-step" className="coach__step">
            {step ? (
              <>
                {t('coach.stepWord')} {i} <span className="muted">/ {n}</span>
              </>
            ) : (
              t('coachMode.setup')
            )}
            {step?.clock && <span className="coach__clock">{step.clock}</span>}
          </p>
          <h2 className="coach__heading">{step ? step.title : t('coachMode.roundStartWhoPlaysWhat')}</h2>
          {step?.description && <p className="coach__desc">{step.description}</p>}

          <ul className="actors">
            {step
              ? briefing.map((b) => <Actor key={b.slot.key} strategy={strategy} slot={b.slot} player={assigned[b.slot.key]} action={b.action} utility={b.utility} />)
              : strategy.slots.map((s) => (
                  <Actor
                    key={s.key}
                    strategy={strategy}
                    slot={s}
                    player={assigned[s.key]}
                    action={s.spawn ? t('coach.spawn', { spawn: s.spawn }) : s.instructions[0] ?? ''}
                    sub={t('coach.ready')}
                  />
                ))}
          </ul>
          {step && !briefing.length && <p className="muted">{t('coachMode.noOperatorsAreAssignedTo')}</p>}
          {step?.utility && (
            <p className="coach__util">
              <strong>{t('coachMode.utility')}</strong> {step.utility}
            </p>
          )}
          {step?.notes && <p className="coach__note">{step.notes}</p>}

          {next && (
            <div className="coach__next">
              <span className="coach__next-label">{t('coachMode.next')}</span>
              <span>
                {next.clock && <span className="clock-tag">{next.clock}</span>} {next.title}
              </span>
            </div>
          )}
        </section>
      </div>

      <footer className="coach__nav">
        <button type="button" className="btn btn--secondary btn--lg" onClick={() => go(-1)} disabled={i === 0}>
          <Icon name="chevron" size={20} className="icon--flip" /> {t('coachMode.back')}
        </button>
        <span className="muted small coach__keys">{t('coachMode.orSpace')}</span>
        {i < n ? (
          <button type="button" className="btn btn--primary btn--lg" onClick={() => go(1)}>
            {t('coachMode.nextStep')} <Icon name="arrow" size={20} />
          </button>
        ) : (
          <button type="button" className="btn btn--primary btn--lg" onClick={onExit}>
            {t('coachMode.done')} <Icon name="check" size={20} />
          </button>
        )}
      </footer>
    </div>
  );
}
