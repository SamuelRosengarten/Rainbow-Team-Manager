import Icon from './Icon.jsx';
import OperatorIcon from './OperatorIcon.jsx';
import TacticalBoard from './TacticalBoard.jsx';
import { MAPS, MAPS_BY_ID } from '../lib/maps.js';
import { OPERATORS_BY_ID } from '../lib/operators.js';
import { STRATEGY_TYPES, latestVersions } from '../lib/strategies.js';

const FEATURE_OPS = ['thermite', 'ash', 'buck', 'smoke', 'jager', 'mira', 'bandit', 'hibana'];

function builderInProgress() {
  try {
    const w = JSON.parse(sessionStorage.getItem('r6tp.builder') ?? 'null');
    return w && (w.draft || w.mapId) ? w : null;
  } catch {
    return null;
  }
}

function MiniRow({ s, navigate }) {
  return (
    <li className="mini-strat">
      <button type="button" className="mini-strat__main" onClick={() => navigate(`strategies/s/${s.id}`)}>
        <span className={`side-dot side-dot--${s.side}`} aria-hidden="true" />
        <span className="mini-strat__text">
          <span className="mini-strat__title">
            {s.favorite && <Icon name="star" size={13} className="icon--fav" />} {s.title} <span className="version-chip version-chip--sm">v{s.version}</span>
          </span>
          <span className="muted small">
            {MAPS_BY_ID[s.mapId]?.name ?? 'Any map'} · {STRATEGY_TYPES[s.type]}
          </span>
        </span>
        <span className="mini-strat__ops" aria-hidden="true">
          {s.slots.slice(0, 5).map((x) => (
            <OperatorIcon key={x.key} operator={OPERATORS_BY_ID[x.operatorId]} size="xs" />
          ))}
        </span>
      </button>
      <button type="button" className="btn btn--ghost btn--icon" aria-label={`Coach mode: ${s.title}`} onClick={() => navigate(`strategies/s/${s.id}/coach`)} disabled={!s.steps.length}>
        <Icon name="play" size={16} />
      </button>
    </li>
  );
}

/**
 * Home: the tactical command center. Starts tactical planning straight away:
 * create a strategy, open attack or defense plans, maps, operators, and the
 * team's saved strategies, with the featured plan on the board.
 */
export default function CommandView({ profile, strategyData, navigate }) {
  const all = strategyData.strategies;
  const team = latestVersions(all.filter((s) => s.origin === 'team' && !s.builtin));
  // "total" counts every plan, including the generic ones that aren't tied to a
  // map. The Maps page only counts plans on a specific map, so show the gap.
  const bySide = (side) => {
    const list = latestVersions(all).filter((s) => s.side === side);
    return { team: team.filter((s) => s.side === side).length, all: list.length, anyMap: list.filter((s) => s.mapId === 'any').length };
  };
  const atk = bySide('attack');
  const def = bySide('defend');
  const recent = [...team].sort((a, b) => Number(b.favorite) - Number(a.favorite) || String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? ''))).slice(0, 5);
  const featured = recent[0] ?? all.find((s) => s.markers.length > 4);
  const mapsWithPlans = new Set(all.map((s) => s.mapId));
  const wip = builderInProgress();

  return (
    <section className="page command" aria-labelledby="cmd-title">
      <header className="command__head">
        <p className="page__kicker">Welcome back, {profile}</p>
        <h1 id="cmd-title" className="command__title">
          R6 Tactical Command
        </h1>
        <p className="command__q">What are we playing, where are we playing it, and what is everyone supposed to do?</p>
      </header>

      <div className="command__grid">
        <div className="command__primary">
          <button type="button" className="cmd-card cmd-card--create" onClick={() => navigate('build')}>
            <span className="cmd-card__icon">
              <Icon name="plus" size={30} />
            </span>
            <span>
              <span className="cmd-card__title">Create strategy</span>
              <span className="cmd-card__sub">Plan a new attack or defense: map, site, five operators, then draw it.</span>
            </span>
            <Icon name="arrow" size={22} className="cmd-card__go" />
          </button>
          {wip && (
            <button type="button" className="cmd-resume" onClick={() => navigate('build')}>
              <Icon name="edit" size={16} /> Continue building{wip.draft?.title ? ` “${wip.draft.title}”` : MAPS_BY_ID[wip.mapId] ? ` on ${MAPS_BY_ID[wip.mapId].name}` : ''}
            </button>
          )}
          <div className="command__sides">
            <button type="button" className="cmd-card cmd-card--attack" onClick={() => navigate('strategies/attack')}>
              <Icon name="swords" size={26} />
              <span className="cmd-card__title">Attack strategies</span>
              <span className="cmd-card__stat">
                <strong>{atk.team}</strong> team · {atk.all} total{atk.anyMap > 0 && ` (${atk.anyMap} not tied to a map)`}
              </span>
            </button>
            <button type="button" className="cmd-card cmd-card--defend" onClick={() => navigate('strategies/defense')}>
              <Icon name="shield" size={26} />
              <span className="cmd-card__title">Defense strategies</span>
              <span className="cmd-card__stat">
                <strong>{def.team}</strong> team · {def.all} total{def.anyMap > 0 && ` (${def.anyMap} not tied to a map)`}
              </span>
            </button>
          </div>
          <section className="panel" aria-labelledby="mine-title">
            <div className="panel__head">
              <h2 id="mine-title" className="panel__title card__title">
                <Icon name="book" size={18} /> My strategies
              </h2>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('strategies')}>
                Team library <Icon name="chevron" size={14} />
              </button>
            </div>
            {recent.length ? (
              <ul className="mini-strats">
                {recent.map((s) => (
                  <MiniRow key={s.id} s={s} navigate={navigate} />
                ))}
              </ul>
            ) : (
              <p className="muted">
                No saved team tactics yet.{' '}
                <button type="button" className="link-btn" onClick={() => navigate('build')}>
                  Build your first strategy
                </button>{' '}
                or{' '}
                <button type="button" className="link-btn" onClick={() => navigate('strategies/find')}>
                  find one that fits your operators
                </button>
                .
              </p>
            )}
          </section>
        </div>

        <section className="command__featured panel" aria-labelledby="feat-title">
          {featured ? (
            <>
              <div className="panel__head">
                <div>
                  <p className="page__kicker">{featured.origin === 'team' ? (featured.favorite ? 'Favourite plan' : 'Latest team plan') : 'Starting point'}</p>
                  <h2 id="feat-title" className="panel__title">
                    {featured.title}
                  </h2>
                  <p className="muted small">
                    {MAPS_BY_ID[featured.mapId]?.name ?? 'Any map'}
                    {featured.site ? ` · ${featured.site}` : ''} · {featured.side === 'attack' ? 'Attack' : 'Defense'}
                  </p>
                </div>
              </div>
              <button type="button" className="featured-board" onClick={() => navigate(`strategies/s/${featured.id}`)} aria-label={`Open ${featured.title}`}>
                <TacticalBoard strategy={featured} mapName={MAPS_BY_ID[featured.mapId]?.name} showFloorTabs={false} />
              </button>
              <div className="toolbar">
                <button type="button" className="btn btn--primary btn--sm" onClick={() => navigate(`strategies/s/${featured.id}/coach`)} disabled={!featured.steps.length}>
                  <Icon name="play" size={16} /> Coach mode
                </button>
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => navigate(`strategies/s/${featured.id}`)}>
                  Open plan
                </button>
              </div>
            </>
          ) : (
            <p className="muted">Your plans show here once you build one.</p>
          )}
        </section>
      </div>

      <div className="command__row">
        <button type="button" className="cmd-card cmd-card--wide" onClick={() => navigate('maps')}>
          <Icon name="map" size={26} />
          <span>
            <span className="cmd-card__title">Maps</span>
            <span className="cmd-card__sub">Browse maps, sites and tactical plans</span>
          </span>
          <span className="cmd-card__stat">
            <strong>{MAPS.filter((m) => mapsWithPlans.has(m.id)).length}</strong>/{MAPS.length} with plans
          </span>
        </button>
        <button type="button" className="cmd-card cmd-card--wide" onClick={() => navigate('operators')}>
          <span className="cmd-card__badges" aria-hidden="true">
            {FEATURE_OPS.slice(0, 4).map((id) => (
              <OperatorIcon key={id} operator={OPERATORS_BY_ID[id]} size="sm" />
            ))}
          </span>
          <span>
            <span className="cmd-card__title">Operator library</span>
            <span className="cmd-card__sub">Operators, roles, utility and synergy</span>
          </span>
        </button>
      </div>

    </section>
  );
}
