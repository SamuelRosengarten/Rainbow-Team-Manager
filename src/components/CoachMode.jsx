import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import OperatorIcon from './OperatorIcon.jsx';
import TacticalBoard from './TacticalBoard.jsx';
import { SETUP } from '../lib/board.js';
import { OPERATORS_BY_ID } from '../lib/operators.js';
import { slotColor } from '../lib/strategies.js';
import { TACTICAL_ROLES, stepBriefing, utilityName } from '../lib/tactical.js';

const opName = (id) => OPERATORS_BY_ID[id]?.name ?? 'Any operator';

function Actor({ strategy, slot, player, action, utility = [], sub }) {
  const op = OPERATORS_BY_ID[slot.operatorId];
  return (
    <li className="actor" style={{ '--slot': slotColor(strategy, slot.key) }}>
      <OperatorIcon key={op?.id ?? 'none'} operator={op} size="lg" />
      <div className="actor__body">
        <p className="actor__who">
          <span className="actor__op">{opName(slot.operatorId)}</span>
          {player && <span className="actor__player">{player}</span>}
          <span className="role-tag">{TACTICAL_ROLES[slot.tacticalRole]}</span>
          {slot.defuser && <span className="defuser-tag">Defuser</span>}
        </p>
        {action ? <p className="actor__action">“{action}”</p> : <p className="actor__action actor__action--none">{sub || 'Involved in this step.'}</p>}
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
          <span className={`side-tag side-tag--${strategy.side}`}>{strategy.side === 'attack' ? 'Attack' : 'Defense'}</span>
          <span className="coach__name">{strategy.title}</span>
          <span className="muted small">{[mapName, strategy.site].filter(Boolean).join(' · ')}</span>
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onExit}>
          <Icon name="close" size={18} /> Exit coach mode
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

        <section className="coach__brief" aria-live="polite">
          <p id="coach-step" className="coach__step">
            {step ? (
              <>
                STEP {i} <span className="muted">/ {n}</span>
              </>
            ) : (
              'SETUP'
            )}
            {step?.clock && <span className="coach__clock">{step.clock}</span>}
          </p>
          <h2 className="coach__heading">{step ? step.title : 'Round start: who plays what'}</h2>
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
                    action={s.spawn ? `Spawn: ${s.spawn}` : s.instructions[0] ?? ''}
                    sub="Ready."
                  />
                ))}
          </ul>
          {step && !briefing.length && <p className="muted">No operators are assigned to this step yet.</p>}
          {step?.utility && (
            <p className="coach__util">
              <strong>Utility:</strong> {step.utility}
            </p>
          )}
          {step?.notes && <p className="coach__note">{step.notes}</p>}

          {next && (
            <div className="coach__next">
              <span className="coach__next-label">Next</span>
              <span>
                {next.clock && <span className="clock-tag">{next.clock}</span>} {next.title}
              </span>
            </div>
          )}
        </section>
      </div>

      <footer className="coach__nav">
        <button type="button" className="btn btn--secondary btn--lg" onClick={() => go(-1)} disabled={i === 0}>
          <Icon name="chevron" size={20} className="icon--flip" /> Back
        </button>
        <span className="muted small coach__keys">← → or space</span>
        {i < n ? (
          <button type="button" className="btn btn--primary btn--lg" onClick={() => go(1)}>
            Next step <Icon name="arrow" size={20} />
          </button>
        ) : (
          <button type="button" className="btn btn--primary btn--lg" onClick={onExit}>
            Done <Icon name="check" size={20} />
          </button>
        )}
      </footer>
    </div>
  );
}
