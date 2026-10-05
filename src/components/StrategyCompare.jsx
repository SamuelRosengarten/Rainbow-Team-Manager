import Icon from './Icon.jsx';
import OperatorIcon from './OperatorIcon.jsx';
import TacticalBoard from './TacticalBoard.jsx';
import { MAPS_BY_ID } from '../lib/maps.js';
import { OPERATORS_BY_ID } from '../lib/operators.js';
import { DIFFICULTY, STRATEGY_TYPES } from '../lib/strategies.js';
import { strategyStats } from '../lib/tactical.js';

const ROWS = [
  ['Type', (s) => STRATEGY_TYPES[s.type]],
  ['Pace', (s, st) => `${st.pace}${st.span !== null ? ` (${st.span}s)` : ''}`],
  ['Utility', (s, st) => `${st.utilityLevel} (${st.utility})`],
  ['Steps', (s, st) => st.steps],
  ['Breaches', (s, st) => st.breaches],
  ['Routes', (s, st) => st.routes],
  ['Areas', (s, st) => st.zones],
  ['Crossfires', (s, st) => st.crossfires],
  ['Difficulty', (s) => DIFFICULTY[s.difficulty]],
];

function Column({ s }) {
  const st = strategyStats(s);
  const mapName = MAPS_BY_ID[s.mapId]?.name ?? '';
  return (
    <div className="cmp__col">
      <h2 className="cmp__title">
        {s.title} {s.origin === 'team' && <span className="version-chip">v{s.version}</span>}
      </h2>
      {s.versionNote && <p className="muted small">{s.versionNote}</p>}
      <div className="cmp__ops">
        {s.slots.map((x) => (
          <span key={x.key} title={OPERATORS_BY_ID[x.operatorId]?.name}>
            <OperatorIcon key={x.operatorId ?? x.key} operator={OPERATORS_BY_ID[x.operatorId]} size="sm" />
          </span>
        ))}
      </div>
      <TacticalBoard strategy={s} mapName={mapName} />
      <dl className="cmp__stats">
        {ROWS.map(([label, fn]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{fn(s, st)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Two strategies side by side: operators, board, pace, utility and size.
 * Without a second strategy, offers the most similar ones to pick from.
 */
export default function StrategyCompare({ a, b, strategies, navigate }) {
  if (!a) return null;
  const candidates = strategies
    .filter((s) => s.id !== a.id && s.side === a.side)
    .sort((x, y) => Number(y.family === a.family) - Number(x.family === a.family) || Number(y.mapId === a.mapId) - Number(x.mapId === a.mapId) || x.title.localeCompare(y.title))
    .slice(0, 30);
  return (
    <div className="cmp">
      <button type="button" className="btn btn--ghost btn--sm back-btn" onClick={() => navigate(`strategies/s/${a.id}`)}>
        <Icon name="chevron" size={16} className="icon--flip" /> {a.title}
      </button>
      <h1 className="page__title">Compare strategies</h1>
      {b ? (
        <div className="cmp__grid">
          <Column s={a} />
          <span className="cmp__vs" aria-hidden="true">VS</span>
          <Column s={b} />
        </div>
      ) : (
        <section className="panel">
          <h2 className="panel__title">Compare “{a.title}” with…</h2>
          <ul className="pick-list">
            {candidates.map((s) => (
              <li key={s.id}>
                <button type="button" className="pick-list__btn" onClick={() => navigate(`strategies/compare/${a.id}/${s.id}`)}>
                  <strong>
                    {s.title}
                    {s.origin === 'team' && ` v${s.version}`}
                  </strong>
                  <span className="muted small">
                    {MAPS_BY_ID[s.mapId]?.name ?? 'Any map'}
                    {s.site ? ` · ${s.site}` : ''} · {STRATEGY_TYPES[s.type]}
                    {s.family === a.family ? ' · same strategy, other version' : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
