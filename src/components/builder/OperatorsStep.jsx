import Icon from '../Icon.jsx';
import LineupCoach from '../LineupCoach.jsx';
import OwnedOnlyNote from '../OwnedOnlyNote.jsx';
import OperatorIcon from '../OperatorIcon.jsx';
import PrefBadge from '../PrefBadge.jsx';
import SynergyList from '../SynergyList.jsx';
import { ROLES, ROLE_LABEL } from '../../lib/fit.js';
import { OPERATORS_BY_ID, operatorsForSide } from '../../lib/operators.js';
import { isUnowned, prefState, prefWho } from '../../lib/recommend.js';
import { useI18n } from '../../i18n/index.js';

// Operator grid order: favorites first, blocked last.
const PREF_ORDER = { favorite: 0, null: 1, partial: 1, blocked: 2 };

/** Step 4: pick the operators. Simple mode: one suggestion button; Advanced: the full coach, roll and filters. */
export default function OperatorsStep({ w, ops, coach, coachPicks, applyCoachLineup, simple, pref, lineupPlayers, updateTeam, toggleOp, roll, roleFilter, setRoleFilter }) {
  const { t } = useI18n();
  return (
    <div className="op-step">
      {!simple && <OwnedOnlyNote pref={pref} updateTeam={updateTeam} players={lineupPlayers} />}
      {!simple && <LineupCoach lineup={coach?.lineup} strategy={coach?.strategy} onUse={() => applyCoachLineup()} />}
      {simple && (
        <div className="simple-suggest">
          <button type="button" className="btn btn--primary" onClick={() => applyCoachLineup(true)} disabled={!coachPicks.length}>
            <Icon name="star" size={18} /> {t('builder.simple.suggest')}
          </button>
          {!coachPicks.length && <p className="muted small">{t('builder.simple.suggestNone')}</p>}
          {coachPicks.length > 0 && (
            <details className="simple-why">
              <summary>{t('builder.simple.why')}</summary>
              <LineupCoach lineup={coach?.lineup} strategy={coach?.strategy} onUse={() => applyCoachLineup(true)} />
            </details>
          )}
        </div>
      )}
      <div className="picked" aria-label={t('strategyBuilder.yourFiveOperators')}>
        {w.ops.map((id, i) => {
          const op = OPERATORS_BY_ID[id];
          return (
            <button key={i} type="button" className={`picked__slot${op ? '' : ' picked__slot--empty'}`} onClick={() => op && toggleOp(id)} aria-label={op ? t('builder.remove', { operator: op.name }) : t('builder.emptySlot', { n: i + 1 })}>
              <OperatorIcon key={id ?? `e${i}`} operator={op} size="lg" />
              <span>{op?.name ?? t('builder.slot', { n: i + 1 })}</span>
            </button>
          );
        })}
        {!simple && (
          <button type="button" className="btn btn--secondary" onClick={roll}>
            <Icon name="dice" size={18} /> {t('strategyBuilder.rollForTheStarters')}
          </button>
        )}
      </div>
      {!simple && (
      <div className="op-filter" role="group" aria-label={t('strategyBuilder.filterByRole')}>
        <button type="button" className="step-chip" aria-pressed={!roleFilter} onClick={() => setRoleFilter('')}>
          {t('strategyBuilder.all')}
        </button>
        {ROLES.map((r) => (
          <button key={r} type="button" className="step-chip" aria-pressed={roleFilter === r} onClick={() => setRoleFilter(r)}>
            {ROLE_LABEL[r]}
          </button>
        ))}
      </div>
      )}
      <ul className="pick-grid">
        {operatorsForSide(w.side)
          .filter((o) => !roleFilter || o.roles.includes(roleFilter))
          .sort((a, b) => PREF_ORDER[prefState(pref, a.id)] - PREF_ORDER[prefState(pref, b.id)])
          .map((o) => {
            const on = w.ops.includes(o.id);
            return (
              <li key={o.id}>
                <button
                  type="button"
                  className={`op-tile${prefState(pref, o.id) ? ` op-tile--${prefState(pref, o.id)}` : ''}`}
                  aria-pressed={on}
                  disabled={(!on && ops.length >= 5) || (!on && (prefState(pref, o.id) === 'blocked' || isUnowned(pref, o.id)))}
                  title={prefWho(pref, o.id) || undefined}
                  onClick={() => toggleOp(o.id)}
                >
                  <OperatorIcon operator={o} size="lg" />
                  <span className="op-tile__name">{o.name}</span>
                  <PrefBadge pref={pref} id={o.id} />
                </button>
              </li>
            );
          })}
      </ul>
      {!simple && <SynergyList ops={ops} side={w.side} pref={pref} onAdd={ops.length < 5 ? toggleOp : undefined} />}
    </div>
  );
}
