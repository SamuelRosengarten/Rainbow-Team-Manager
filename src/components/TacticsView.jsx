import { useState } from 'react';
import Icon from './Icon.jsx';
import QuickTacticsView from './QuickTacticsView.jsx';
import ReferenceForm from './ReferenceForm.jsx';
import StrategyDetail from './StrategyDetail.jsx';
import StrategyEditor from './StrategyEditor.jsx';
import StrategyLibrary from './StrategyLibrary.jsx';
import { EmptyState, Skeleton } from './ui.jsx';
import { normalizeStrategy } from '../lib/strategies.js';
import { useRoster } from '../state/roster-context.js';
import { useSessionState } from '../state/useSessionState.js';

/** Library setup from the Plan screen: map, site, side and the rolled lineup. */
function setupFromPlan(team, lineupPlayers) {
  const lineup = team.lineup?.side === team.side ? team.lineup.players : {};
  return {
    mapId: team.mapId || '',
    site: team.site || '',
    side: team.side || 'attack',
    picks: Array.from({ length: 5 }, (_, i) => ({ player: lineupPlayers[i] ?? null, operatorId: lineup[lineupPlayers[i]] ?? null })),
    filters: {},
  };
}

/** "s/abc/edit" -> { mode: 'edit', id: 'abc' } */
function parseSub(sub) {
  if (sub === 'quick') return { mode: 'quick' };
  if (sub === 'new') return { mode: 'new' };
  const m = /^s\/([^/]+)(\/edit)?$/.exec(sub ?? '');
  if (m) return { mode: m[2] ? 'edit' : 'view', id: m[1] };
  return { mode: 'library' };
}

/**
 * Tactics: the strategy library (find, adapt, customize) and the original
 * quick tactics the Plan screen rolls.
 */
export default function TacticsView({ profile, sub, navigate, tacticsStore, strategyData, team, updateTeam }) {
  const { players, lineupPlayers } = useRoster();
  const [setup, setSetup] = useSessionState('r6tp.strategy-setup', () => setupFromPlan(team, lineupPlayers));
  const [referenceFor, setReferenceFor] = useState(null); // null | 'new' | strategy
  const { mode, id } = parseSub(sub);
  const strategy = id ? strategyData.strategies.find((s) => s.id === id) : null;
  const loading = strategyData.status === 'loading';

  const loadIntoPlan = (s, assigned) => {
    const players = Object.fromEntries(
      s.slots.filter((slot) => assigned[slot.key] && slot.operatorId).map((slot) => [assigned[slot.key], slot.operatorId]),
    );
    updateTeam({
      side: s.side,
      ...(s.mapId !== 'any' ? { mapId: s.mapId, site: s.site || '' } : {}),
      tacticId: null,
      lineup: { side: s.side, players },
    });
    navigate('plan');
  };

  const header = (
    <header className="page__head">
      <div>
        <h1 className="page__title">Tactics</h1>
        <p className="page__sub">Pick your operators, find strategies that fit, adapt them and save your team's version.</p>
      </div>
    </header>
  );
  const tabs = (
    <div className="segmented segmented--full" role="group" aria-label="Tactics sections">
      <button type="button" className="segmented__btn" aria-pressed={mode !== 'quick'} onClick={() => navigate('tactics')}>
        <Icon name="book" size={16} /> Strategies
      </button>
      <button type="button" className="segmented__btn" aria-pressed={mode === 'quick'} onClick={() => navigate('tactics/quick')}>
        <Icon name="dice" size={16} /> Quick tactics
      </button>
    </div>
  );

  let body;
  if (mode === 'quick') {
    body = <QuickTacticsView profile={profile} tacticsStore={tacticsStore} />;
  } else if (mode === 'new') {
    const blank = normalizeStrategy({
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
        onCancel={() => navigate('tactics')}
        onSaved={(s) => navigate(`tactics/s/${s.id}`)}
      />
    );
  } else if (mode === 'view' || mode === 'edit') {
    if (!strategy) {
      body = loading ? (
        <Skeleton lines={6} />
      ) : (
        <EmptyState
          icon="book"
          title="Strategy not found"
          action={
            <button type="button" className="btn btn--secondary" onClick={() => navigate('tactics')}>
              Back to strategies
            </button>
          }
        >
          It may have been deleted or hidden.
        </EmptyState>
      );
    } else if (mode === 'edit' && strategy.origin === 'team' && !strategy.builtin) {
      body = (
        <StrategyEditor
          key={strategy.id}
          initial={strategy}
          strategyData={strategyData}
          onCancel={() => navigate(`tactics/s/${strategy.id}`)}
          onSaved={(s) => navigate(`tactics/s/${s.id}`)}
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
          navigate={(to) => (to === `tactics/s/${strategy.id}/edit` && strategy.origin === 'reference' ? setReferenceFor(strategy) : navigate(to))}
          onLoadIntoPlan={loadIntoPlan}
        />
      );
    }
  } else {
    body = (
      <StrategyLibrary
        setup={setup}
        setSetup={setSetup}
        players={players}
        onSyncPlan={() => setSetup(setupFromPlan(team, lineupPlayers))}
        strategyData={strategyData}
        navigate={navigate}
        onAddReference={() => setReferenceFor('new')}
      />
    );
  }

  return (
    <section className="page" aria-label="Tactics">
      {(mode === 'library' || mode === 'quick') && header}
      {(mode === 'library' || mode === 'quick') && tabs}
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
            navigate(`tactics/s/${s.id}`);
          }}
        />
      )}
    </section>
  );
}
