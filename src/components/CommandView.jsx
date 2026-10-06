import Icon from './Icon.jsx';
import OperatorIcon from './OperatorIcon.jsx';
import { Card, EmptyState, Meter } from './ui.jsx';
import { MAPS_BY_ID } from '../lib/maps.js';
import { OPERATORS_BY_ID } from '../lib/operators.js';
import { latestVersions } from '../lib/strategies.js';
import { AVAILABILITY, LINEUP_SIZE } from '../lib/roster.js';
import { allMapPreparation, lineupReadiness, nextActions, strategyReadiness, teamStrategies } from '../lib/readiness.js';
import { usePlans } from '../state/usePlans.js';
import { useRoster } from '../state/roster-context.js';
import { useI18n } from '../i18n/index.js';

const AVAIL_TONE = { available: 'ok', limited: 'warn', unavailable: 'danger' };

function builderInProgress() {
  try {
    const w = JSON.parse(sessionStorage.getItem('r6tp.builder') ?? 'null');
    return w && (w.draft || w.mapId) ? w : null;
  } catch {
    return null;
  }
}

/** One prep line: done or not, said in words as well as with the icon. */
function Check({ done, children }) {
  const { t } = useI18n();
  return (
    <li className={`check${done ? ' check--done' : ''}`}>
      <Icon name={done ? 'check' : 'close'} size={14} className="check__icon" />
      <span className="visually-hidden">{done ? t('cmd.prep.yes') : t('cmd.prep.no')}: </span>
      {children}
    </li>
  );
}

/** The match the team is preparing: map, site, side, lineup and bans from the shared plan. */
function NextMatch({ team, strategies, navigate }) {
  const { t } = useI18n();
  const map = MAPS_BY_ID[team.mapId];
  if (!map) {
    return (
      <Card id="next" kicker title={t('cmd.nextMatch')} className="cmd-next">
        <EmptyState icon="flag" title={t('cmd.nextMatch.none')} action={
          <button type="button" className="btn btn--primary" onClick={() => navigate('plan')}>
            {t('cmd.openMatchPlan')} <Icon name="arrow" size={16} />
          </button>
        }>
          {t('cmd.nextMatch.noneBody')}
        </EmptyState>
      </Card>
    );
  }
  const lineup = team.lineup?.side === team.side ? Object.entries(team.lineup.players ?? {}) : [];
  const plans = latestVersions(strategies.filter((s) => s.mapId === team.mapId && s.side === team.side && (!team.site || s.site === team.site)))
    .sort((a, b) => Number(b.origin === 'team') - Number(a.origin === 'team') || Number(b.favorite) - Number(a.favorite));
  const best = plans[0];
  return (
    <Card id="next" kicker title={t('cmd.nextMatch')} className="cmd-next" action={<span className="muted small">{t('cmd.nextMatch.untracked')}</span>}>
      <div className="cmd-next__body">
        <div className="cmd-next__where">
          <span className={`badge badge--${team.side === 'attack' ? 'attack' : 'defend'}`}>
            {team.side === 'attack' ? t('commandView.attack') : t('commandView.defense')}
          </span>
          <h3 className="cmd-next__map">{map.name}</h3>
          <p className="cmd-next__site">{team.site || t('cmd.nextMatch.anySite')}</p>
          {lineup.length > 0 && (
            <ul className="cmd-next__ops" aria-label={t('cmd.prep.lineup', { count: lineup.length })}>
              {lineup.map(([player, opId]) => (
                <li key={player} title={`${player}: ${OPERATORS_BY_ID[opId]?.name ?? ''}`}>
                  <OperatorIcon operator={OPERATORS_BY_ID[opId]} size="sm" />
                  <span className="cmd-next__player">{player}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <ul className="checks">
          <Check done={Boolean(team.site)}>{t('cmd.prep.site')}</Check>
          <Check done={lineup.length === LINEUP_SIZE}>{t('cmd.prep.lineup', { count: lineup.length })}</Check>
          <Check done={(team.bans ?? []).length > 0}>{t('cmd.prep.bans', { count: (team.bans ?? []).length })}</Check>
          <Check done={plans.length > 0}>{t('cmd.prep.plans', { count: plans.length })}</Check>
        </ul>
      </div>
      <div className="toolbar cmd-next__actions">
        {best ? (
          <button type="button" className="btn btn--primary" onClick={() => navigate(`strategies/s/${best.id}`)}>
            <Icon name="play" size={16} /> {t('cmd.openBriefing', { title: best.title })}
          </button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={() => navigate('strategies/find')}>
            <Icon name="target" size={16} /> {t('cmd.findPlan')}
          </button>
        )}
        <button type="button" className="btn btn--secondary" onClick={() => navigate('plan')}>
          {t('cmd.openMatchPlan')}
        </button>
      </div>
    </Card>
  );
}

function TeamReadiness({ lineup, navigate }) {
  const { t } = useI18n();
  const { roster, lineupPlayers } = useRoster();
  const starters = lineupPlayers.map((n) => roster.find((p) => p.name === n)).filter(Boolean);
  return (
    <Card id="ready" kicker title={t('cmd.readiness')} action={
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('team')}>
        {t('cmd.roster')} <Icon name="chevron" size={14} />
      </button>
    }>
      <p className="bignum">
        {lineup.available.length}
        <span className="bignum__of">/{LINEUP_SIZE}</span>
        <span className={`badge ${lineup.ready ? 'badge--ok' : 'badge--warn'}`}>
          <span className="badge__dot" aria-hidden="true" />
          {lineup.ready ? t('cmd.kpi.ready') : t('cmd.kpi.notReady')}
        </span>
      </p>
      <p className="muted small">{t('cmd.kpi.available', { ready: lineup.available.length, total: LINEUP_SIZE })}</p>
      <ul className="avail-list">
        {starters.map((p) => (
          <li key={p.id ?? p.name}>
            <span className="avail-list__name">{p.name}</span>
            <span className={`status status--${AVAIL_TONE[p.availability]}`}>{AVAILABILITY[p.availability]}</span>
          </li>
        ))}
        {lineup.empty > 0 && (
          <li className="avail-list__empty">{t('cmd.readiness.empty', { count: lineup.empty })}</li>
        )}
      </ul>
      <p className="muted small">{t('cmd.readiness.subs', { count: lineup.subs })}</p>
    </Card>
  );
}

function MapPreparation({ prep, navigate, current }) {
  const { t } = useI18n();
  const count = (status) => prep.filter((p) => p.status === status).length;
  const shown = prep
    .filter((p) => p.status === 'ready' || p.status === 'partial' || p.mapId === current)
    .sort((a, b) => Number(b.mapId === current) - Number(a.mapId === current) || (b.coverage ?? 0) - (a.coverage ?? 0))
    .slice(0, 6);
  return (
    <Card id="maps" kicker title={t('cmd.maps')} className="cmd-maps" action={
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('maps')}>
        {t('cmd.maps.all')} <Icon name="chevron" size={14} />
      </button>
    }>
      <dl className="tally">
        <div><dt>{t('cmd.maps.ready')}</dt><dd className="tally__ok">{count('ready')}</dd></div>
        <div><dt>{t('cmd.maps.partial')}</dt><dd>{count('partial')}</dd></div>
        <div><dt>{t('cmd.maps.none')}</dt><dd className="tally__dim">{count('none') + count('no-sites')}</dd></div>
      </dl>
      {shown.length ? (
        <ul className="prep-list">
          {shown.map((p) => (
            <li key={p.mapId}>
              <button type="button" className="prep-row" onClick={() => navigate(`maps/${p.mapId}`)}>
                <span className="prep-row__name">
                  {MAPS_BY_ID[p.mapId].name}
                  {p.mapId === current && <span className="badge badge--accent">{t('cmd.maps.current')}</span>}
                </span>
                {p.coverage === null ? (
                  <span className="prep-row__meter muted small">{t('cmd.maps.noSites')}</span>
                ) : (
                  <span className="prep-row__meter">
                    <Meter value={p.coverage} label={t('cmd.maps.coverage', { covered: p.covered, sites: p.sites })} tone={p.status === 'ready' ? 'ok' : 'accent'} />
                    <span className="prep-row__pct tnum">{Math.round(p.coverage * 100)}%</span>
                  </span>
                )}
                <span className="prep-row__sides tnum">
                  <span className="side-count side-count--attack" title={t('maps.attackCount', { count: p.attack })}>
                    <span aria-hidden="true">{p.attack}</span>
                    <span className="visually-hidden">{t('maps.attackCount', { count: p.attack })}</span>
                  </span>
                  <span className="side-count side-count--defend" title={t('maps.defenseCount', { count: p.defend })}>
                    <span aria-hidden="true">{p.defend}</span>
                    <span className="visually-hidden">{t('maps.defenseCount', { count: p.defend })}</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">{t('cmd.maps.empty')}</p>
      )}
    </Card>
  );
}

function StrategyReadiness({ strategies, navigate }) {
  const { t } = useI18n();
  const r = strategyReadiness(strategies);
  const recent = [...teamStrategies(strategies)].sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')));
  return (
    <Card id="strats" kicker title={t('cmd.strategies')} action={
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('strategies')}>
        {t('commandView.teamLibrary')} <Icon name="chevron" size={14} />
      </button>
    }>
      {r.total ? (
        <>
          <dl className="tally">
            <div><dt>{t('cmd.strat.ready')}</dt><dd className="tally__ok">{r.ready}</dd></div>
            <div><dt>{t('cmd.strat.review')}</dt><dd className={r.review.length ? 'tally__warn' : ''}>{r.review.length}</dd></div>
            <div><dt>{t('cmd.strat.verified')}</dt><dd>{r.verified}</dd></div>
          </dl>
          <ul className="review-list">
            {(r.review.length ? r.review : recent.slice(0, 4).map((s) => ({ strategy: s, issues: [] }))).slice(0, 4).map(({ strategy: s, issues }) => (
              <li key={s.id}>
                <button type="button" className="review-row" onClick={() => navigate(`strategies/s/${s.id}`)}>
                  <span className={`side-dot side-dot--${s.side}`} aria-hidden="true" />
                  <span className="review-row__text">
                    <span className="review-row__title">{s.title}</span>
                    <span className="review-row__meta">
                      {issues.length ? issues.map((i) => t(`ready.issue.${i}`)).join(' · ') : MAPS_BY_ID[s.mapId]?.name ?? t('commandView.anyMap')}
                    </span>
                  </span>
                  <Icon name="chevron" size={14} className="review-row__go" />
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <EmptyState icon="book" title={t('cmd.strat.empty')} action={
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => navigate('strategies/find')}>
            <Icon name="target" size={14} /> {t('cmd.findPlan')}
          </button>
        }>
          {t('cmd.strat.emptyBody')}
        </EmptyState>
      )}
    </Card>
  );
}

function NextActions({ actions, navigate }) {
  const { t } = useI18n();
  return (
    <Card id="actions" kicker title={t('cmd.actions')} className="cmd-actions">
      {actions.length ? (
        <ol className="action-list">
          {actions.map((a) => (
            <li key={a.id}>
              <button type="button" className="action-row" onClick={() => navigate(a.to)}>
                <span className={`action-row__mark action-row__mark--${a.id === 'lineup' ? 'warn' : 'accent'}`} aria-hidden="true" />
                <span className="action-row__text">{t(`ready.action.${a.id}`, { ...a.values, map: MAPS_BY_ID[a.values.mapId]?.name ?? '' })}</span>
                <Icon name="arrow" size={14} className="action-row__go" />
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted small action-list__none">
          <Icon name="check" size={14} /> {t('cmd.actions.none')}
        </p>
      )}
    </Card>
  );
}

/**
 * Home: the team's command center. Every number comes from the team's own
 * data (shared match plan, roster, strategies); what isn't tracked says so.
 */
export default function CommandView({ profile, strategyData, navigate, team }) {
  const { t } = useI18n();
  const { roster, lineupPlayers } = useRoster();
  usePlans(); // re-render when a floor plan is added or verified
  const all = strategyData.strategies;
  const lineup = lineupReadiness(roster, lineupPlayers);
  const prep = allMapPreparation(all);
  const actions = nextActions({ team, strategies: all, lineup, prep });
  const wip = builderInProgress();

  return (
    <section className="page command" aria-labelledby="cmd-title">
      <header className="page__head">
        <div>
          <p className="eyebrow">{t('cmd.welcome', { name: profile })}</p>
          <h1 id="cmd-title" className="page__title">
            {t('nav.home')}
          </h1>
          <p className="page__sub">{t('commandView.whatAreWePlayingWhere')}</p>
        </div>
        <div className="page__actions">
          {wip && (
            <button type="button" className="btn btn--secondary" onClick={() => navigate('build')}>
              <Icon name="edit" size={16} />{' '}
              {wip.draft?.title ? t('cmd.resume.title', { title: wip.draft.title }) : MAPS_BY_ID[wip.mapId] ? t('cmd.resume.map', { map: MAPS_BY_ID[wip.mapId].name }) : t('cmd.resume')}
            </button>
          )}
          <button type="button" className="btn btn--primary" onClick={() => navigate('build')} title={t('commandView.planANewAttackOr')}>
            <Icon name="plus" size={16} /> {t('commandView.createStrategy')}
          </button>
        </div>
      </header>

      <div className="cmd-grid">
        <NextMatch team={team} strategies={all} navigate={navigate} />
        <TeamReadiness lineup={lineup} navigate={navigate} />
        <MapPreparation prep={prep} navigate={navigate} current={team.mapId} />
        <StrategyReadiness strategies={all} navigate={navigate} />
        <NextActions actions={actions} navigate={navigate} />
        <Card id="results" kicker title={t('cmd.results')}>
          <EmptyState icon="trophy" title={t('cmd.results.empty')}>
            {t('cmd.results.body')}
          </EmptyState>
        </Card>
      </div>
    </section>
  );
}
