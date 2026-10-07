import OperatorIcon from '../OperatorIcon.jsx';
import { OPERATORS_BY_ID } from '../../lib/operators.js';
import { TACTICAL_ROLES } from '../../lib/tactical.js';
import { useI18n } from '../../i18n/index.js';

/** Step 5 (Advanced): who plays which operator, and their tactical role. */
export default function PlayersStep({ w, set, ops, lineupPlayers, roster, roleOf }) {
  const { t } = useI18n();
  return (
    <section className="panel">
      <div className="panel__head">
        <h2 className="panel__title">{t('strategyBuilder.whoPlaysWhat')}</h2>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => set((x) => ({ players: Object.fromEntries(x.ops.filter(Boolean).map((id, i) => [id, x.players[id] ?? lineupPlayers[i] ?? null])) }))}
        >
          {t('strategyBuilder.fillWithStarters')}
        </button>
      </div>
      <ul className="assign">
        {ops.map((id) => {
          const op = OPERATORS_BY_ID[id];
          const taken = new Set(Object.entries(w.players).filter(([k, p]) => k !== id && p).map(([, p]) => p));
          return (
            <li key={id} className="assign__row">
              <OperatorIcon operator={op} size="lg" />
              <span className="assign__op">{op.name}</span>
              <label className="field">
                <span className="field__label">{t('strategyBuilder.player')}</span>
                <select className="select" value={w.players[id] ?? ''} onChange={(e) => set((x) => ({ players: { ...x.players, [id]: e.target.value || null } }))}>
                  <option value="">{t('strategyBuilder.unassigned')}</option>
                  {roster.map((p) => (
                    <option key={p} value={p} disabled={taken.has(p)}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">{t('strategyBuilder.tacticalRole')}</span>
                <select className="select" value={roleOf(id)} onChange={(e) => set((x) => ({ roles: { ...x.roles, [id]: e.target.value } }))}>
                  {Object.entries(TACTICAL_ROLES).map(([r, l]) => (
                    <option key={r} value={r}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
