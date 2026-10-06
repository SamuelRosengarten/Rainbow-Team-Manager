import { useState } from 'react';
import CoachMode from './CoachMode.jsx';
import Icon from './Icon.jsx';
import PlayerMode from './PlayerMode.jsx';
import QuickTacticsView from './QuickTacticsView.jsx';
import ReferenceForm from './ReferenceForm.jsx';
import StrategyCompare from './StrategyCompare.jsx';
import StrategyDetail from './StrategyDetail.jsx';
import StrategyEditor from './StrategyEditor.jsx';
import StrategyLibrary from './StrategyLibrary.jsx';
import TeamLibrary from './TeamLibrary.jsx';
import { EmptyState, Skeleton } from './ui.jsx';
import { MAPS_BY_ID } from '../lib/maps.js';
import { createStrategy } from '../lib/strategies.js';
import { autoAssign } from '../lib/strategyMatch.js';
import { useRoster } from '../state/roster-context.js';
import { useSessionState } from '../state/useSessionState.js';
import { parseStrategiesSub, setupFromTeam } from '../lib/strategySetup.js';

const TABS = [
  ['', 'Team library', 'book'],
  ['find', 'Find by composition', 'target'],
  ['quick', 'Quick tactics', 'dice'],
];

/**
 * The strategy library: the team's strategies by side and map, finding
 * strategies that fit a composition, quick tactics, and every strategy view
 * (detail, editor, coach mode, player mode, compare).
 */
export default function StrategiesView({ profile, sub, navigate, tacticsStore, strategyData, team, updateTeam }) {
  const { players, lineupPlayers } = useRoster();
  const [setup, setSetup] = useSessionState('r6tp.strategy-setup', () => setupFromTeam(team, lineupPlayers));
  const [referenceFor, setReferenceFor] = useState(null); // null | 'new' | strategy
  const route = parseStrategiesSub(sub);
  const { mode, id } = route;
  const strategy = id ? strategyData.strategies.find((s) => s.id === id) : null;
  const loading = strategyData.status === 'loading';

  const listMode = mode === 'library' || mode === 'find' || mode === 'quick';
  const header = (
    <header className="page__head">
      <div>
        <p className="page__kicker">Strategy library</p>
        <h1 className="page__title">Strategies</h1>
        <p className="page__sub">Your team's attack and defense plans, by map. Favourite, version and compare them.</p>
      </div>
      <button type="button" className="btn btn--primary" onClick={() => navigate('build')}>
        <Icon name="plus" size={18} /> Create strategy
      </button>
    </header>
  );
  const tabs = (
    <div className="segmented segmented--full" role="group" aria-label="Library sections">
      {TABS.map(([to, label, icon]) => (
        <button key={to || 'lib'} type="button" className="segmented__btn" aria-pressed={(mode === 'library' && !to) || mode === to} onClick={() => navigate(to ? `strategies/${to}` : 'strategies')}>
          <Icon name={icon} size={16} /> {label}
        </button>
      ))}
    </div>
  );

  const notFound = loading ? (
    <Skeleton lines={6} />
  ) : (
    <EmptyState
      icon="book"
      title="Strategy not found"
      action={
        <button type="button" className="btn btn--secondary" onClick={() => navigate('strategies')}>
          Back to the library
        </button>
      }
    >
      It may have been deleted or hidden.
    </EmptyState>
  );

  let body;
  if (mode === 'quick') {
    body = <QuickTacticsView profile={profile} tacticsStore={tacticsStore} />;
  } else if (mode === 'find') {
    body = (
      <StrategyLibrary
        setup={setup}
        setSetup={setSetup}
        players={players}
        onSyncPlan={() => setSetup(setupFromTeam(team, lineupPlayers))}
        strategyData={strategyData}
        navigate={navigate}
        updateTeam={updateTeam}
        onAddReference={() => setReferenceFor('new')}
      />
    );
  } else if (mode === 'new') {
    const blank = createStrategy({
      title: 'New strategy',
      origin: 'team',
      side: setup.side,
      mapId: setup.mapId || 'any',
      site: setup.site,
      owner: profile,
      slots: setup.picks.filter((p) => p.operatorId).map((p, i) => ({ key: `s${i + 1}`, operatorId: p.operatorId })),
    });
    body = (
      <StrategyEditor
        key="new"
        initial={{ ...blank, title: '' }}
        isNew
        strategyData={strategyData}
        onCancel={() => navigate('strategies')}
        onSaved={(s) => navigate(`strategies/s/${s.id}`)}
      />
    );
  } else if (mode === 'compare') {
    const other = route.other ? strategyData.strategies.find((s) => s.id === route.other) : null;
    body = strategy ? <StrategyCompare a={strategy} b={other} strategies={strategyData.strategies} navigate={navigate} /> : notFound;
  } else if (mode !== 'library') {
    if (!strategy) body = notFound;
    else {
      const mapName = MAPS_BY_ID[strategy.mapId]?.name ?? '';
      const assigned = autoAssign(strategy, setup.picks, strategyData.assignments[strategy.id] ?? {});
      const back = () => navigate(`strategies/s/${strategy.id}`);
      if (mode === 'edit' && strategy.origin === 'team' && !strategy.builtin) {
        body = <StrategyEditor key={strategy.id} initial={strategy} strategyData={strategyData} onCancel={back} onSaved={(s) => navigate(`strategies/s/${s.id}`)} />;
      } else if (mode === 'coach') {
        body = <CoachMode strategy={strategy} mapName={mapName} assigned={assigned} onExit={back} />;
      } else if (mode === 'player') {
        body = (
          <PlayerMode
            key={route.slot ?? 'pick'}
            strategy={strategy}
            mapName={mapName}
            assigned={assigned}
            profile={profile}
            slotKey={route.slot}
            onPick={(k) => navigate(`strategies/s/${strategy.id}/player${k ? `/${k}` : ''}`)}
            onBack={back}
          />
        );
      } else {
        body = (
          <StrategyDetail
            key={strategy.id}
            strategy={strategy}
            picks={setup.picks}
            profile={profile}
            strategyData={strategyData}
            navigate={(to) => (to === `strategies/s/${strategy.id}/edit` && strategy.origin === 'reference' ? setReferenceFor(strategy) : navigate(to))}
          />
        );
      }
    }
  } else {
    body = <TeamLibrary key={route.side} strategyData={strategyData} navigate={navigate} initialSide={route.side} />;
  }

  return (
    <section className="page" aria-label="Strategies">
      {listMode && header}
      {listMode && tabs}
      {body}
      {referenceFor && (
        <ReferenceForm
          initial={referenceFor === 'new' ? null : referenceFor}
          defaults={{ mapId: setup.mapId || 'any', site: setup.site, side: setup.side }}
          profile={profile}
          onClose={() => setReferenceFor(null)}
          onSave={async (s) => {
            await strategyData.saveStrategy(s);
            setReferenceFor(null);
            navigate(`strategies/s/${s.id}`);
          }}
        />
      )}
    </section>
  );
}
