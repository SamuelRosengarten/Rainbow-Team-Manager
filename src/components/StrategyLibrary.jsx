import { useMemo, useState } from 'react';
import CompositionPicker from './CompositionPicker.jsx';
import OwnedOnlyNote from './OwnedOnlyNote.jsx';
import Icon from './Icon.jsx';
import OperatorIcon from './OperatorIcon.jsx';
import RecommendationCard from './RecommendationCard.jsx';
import { DataState, EmptyState } from './ui.jsx';
import { ROLE_LABEL } from '../lib/fit.js';
import { MAPS, MAPS_BY_ID, sitesFor } from '../lib/maps.js';
import { DIFFICULTY, ORIGINS, STRATEGY_TYPES } from '../lib/strategies.js';
import { FIND_LIMIT, findStrategies } from '../lib/finder.js';
import { OPERATORS_BY_ID } from '../lib/operators.js';
import { prefWho, sharedFavorites, sideFavorites, whereFavoritesFit } from '../lib/recommend.js';
import { usePreferences } from '../state/usePreferences.js';

/** The favorites and blocks the recommendations are using, so it's clear why. */
function PreferenceSummary({ pref, side }) {
  const favs = sideFavorites(pref, side);
  const blocked = [...new Set([...pref.blocked.keys(), ...pref.banned])].filter((id) => OPERATORS_BY_ID[id]?.side === side);
  // A block is personal: say whose, and whether it removes the operator from the whole lineup.
  const blockNote = (id) => {
    if (pref.banned.has(id)) return 'team ban: nobody can play it';
    const by = pref.blocked.get(id) ?? [];
    return pref.blockedForAll.has(id) ? `everyone blocked it` : `${by.join(', ')} only: teammates can still play it`;
  };
  return (
    <div className="pref-summary" aria-label="Operator preferences used">
      <span className="pref-summary__group">
        <span className="pref-summary__label">★ Favorites</span>
        {favs.length ? (
          favs.map((id) => (
            <span key={id} className="pref-summary__op" title={prefWho(pref, id)}>
              <OperatorIcon operator={OPERATORS_BY_ID[id]} size="xs" />
              {OPERATORS_BY_ID[id].name}
            </span>
          ))
        ) : (
          <span className="muted small">None set: mark favorites in Team → Operators</span>
        )}
      </span>
      <span className="pref-summary__group pref-summary__group--blocked">
        <span className="pref-summary__label">🚫 Blocked (personal)</span>
        {blocked.length ? (
          blocked.map((id) => (
            <span key={id} className="pref-summary__op pref-summary__op--blocked" title={prefWho(pref, id)}>
              <OperatorIcon operator={OPERATORS_BY_ID[id]} size="xs" />
              {OPERATORS_BY_ID[id].name}
              <span className="muted small"> · {blockNote(id)}</span>
            </span>
          ))
        ) : (
          <span className="muted small">None</span>
        )}
      </span>
      {sharedFavorites(pref).filter((c) => OPERATORS_BY_ID[c.id].side === side).map((c) => (
        <span key={c.id} className="pref-summary__conflict small">
          ⚠ {c.text}
        </span>
      ))}
      {pref.players.length > 0 && <span className="muted small">From: {pref.players.join(', ')}</span>}
    </div>
  );
}

/**
 * Map → site → side → five players and operators → ranked strategies.
 * `setup` lives in the parent so it survives opening a strategy and coming back.
 */
export default function StrategyLibrary({ setup, setSetup, players, onSyncPlan, strategyData, navigate, onAddReference, updateTeam }) {
  const [showFilters, setShowFilters] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const { mapId, site, side, picks, filters } = setup;
  const set = (patch) => setSetup((s) => ({ ...s, ...patch }));
  const setFilter = (patch) => set({ filters: { ...filters, ...patch } });
  const sites = mapId ? sitesFor(mapId, side) : [];
  const composition = picks.map((p) => p.operatorId).filter(Boolean);
  // Preferences of the players in the setup (or the viewer's own).
  const pref = usePreferences(picks.map((p) => p.player));

  // Favorites and blocks drive the search: every candidate is rebuilt around
  // the favorites, blocked operators are removed, then it's ranked.
  // Up to five plans, widening to other sites and maps (and saying so) when
  // the library has few for this setup.
  const found = useMemo(
    () => findStrategies(strategyData.strategies, { mapId, site, side, filters, pref, selected: picks.map((p) => p.operatorId).filter(Boolean), picks, limit: FIND_LIMIT }),
    [strategyData.strategies, mapId, site, side, filters, picks, pref],
  );
  const { excluded } = found;
  const ranked = showAll ? found.results : found.results.slice(0, FIND_LIMIT);
  const hidden = found.results.length - ranked.length;

  const activeFilters = Object.values(filters).filter(Boolean).length;
  const mapName = MAPS_BY_ID[mapId]?.name;

  return (
    <div className="strat-lib">
      <section className="panel" aria-labelledby="setup-title">
        <div className="panel__head">
          <h2 id="setup-title" className="panel__title">Your setup</h2>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onSyncPlan}>
            <Icon name="refresh" size={16} /> Use shared lineup
          </button>
        </div>
        <div className="setup-grid">
          <label className="field">
            <span className="field__label">Map</span>
            <select className="select" value={mapId} onChange={(e) => set({ mapId: e.target.value, site: '' })}>
              <option value="">Any map</option>
              {MAPS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Floor / site</span>
            <select className="select" value={site} onChange={(e) => set({ site: e.target.value })} disabled={!sites.length}>
              <option value="">{mapId && !sites.length ? 'No sites defined' : 'Any site'}</option>
              {sites.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="field">
            <legend className="field__label">Side</legend>
            <div className="segmented segmented--full" role="group">
              {[
                ['attack', 'Attack'],
                ['defend', 'Defense'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`segmented__btn segmented__btn--${id}`}
                  aria-pressed={side === id}
                  onClick={() => side !== id && set({ side: id, picks: picks.map((p) => ({ ...p, operatorId: null })) })}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        <OwnedOnlyNote pref={pref} updateTeam={updateTeam} players={picks.map((p) => p.player).filter(Boolean)} />
        <h3 className="section-title setup-sub">Players and operators</h3>
        <CompositionPicker side={side} picks={picks} players={players} onChange={(next) => set({ picks: next })} />
        <PreferenceSummary pref={pref} side={side} />
      </section>

      <section className="strat-results" aria-labelledby="results-title">
        <div className="results-bar">
          <h2 id="results-title" className="section-title">
            {pref.favorites.size ? 'Recommended for your favorites' : composition.length ? 'Best strategies for your composition' : 'Strategies'}
            <span className="muted">{found.results.length}</span>
          </h2>
          <div className="toolbar">
            <button type="button" className="btn btn--ghost btn--sm" aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}>
              Filters{activeFilters ? ` (${activeFilters})` : ''}
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={onAddReference} disabled={!strategyData.canSave}>
              <Icon name="external" size={16} /> Add reference
            </button>
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => navigate('build')} disabled={!strategyData.canSave}>
              <Icon name="plus" size={16} /> New strategy
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="filters">
            <label className="field filters__search">
              <span className="field__label">Search</span>
              <input
                className="input"
                type="search"
                value={filters.query ?? ''}
                placeholder="Title, operator, tag…"
                onChange={(e) => setFilter({ query: e.target.value })}
              />
            </label>
            {[
              ['type', 'Type', STRATEGY_TYPES],
              ['difficulty', 'Difficulty', DIFFICULTY],
              ['origin', 'Source', Object.fromEntries(Object.entries(ORIGINS).map(([k, v]) => [k, v.label]))],
              ['role', 'Needs role', ROLE_LABEL],
            ].map(([key, label, options]) => (
              <label key={key} className="field">
                <span className="field__label">{label}</span>
                <select className="select" value={filters[key] ?? ''} onChange={(e) => setFilter({ [key]: e.target.value })}>
                  <option value="">All</option>
                  {Object.entries(options).map(([id, text]) => (
                    <option key={id} value={id}>
                      {text}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            {activeFilters > 0 && (
              <button type="button" className="btn btn--ghost btn--sm filters__clear" onClick={() => set({ filters: {} })}>
                Clear filters
              </button>
            )}
          </div>
        )}

        {strategyData.status === 'missing' && (
          <p className="notice notice--warn" role="status">
            Built-in strategies work now. To save team strategies, references and player assignments, re-run{' '}
            <code>supabase/schema.sql</code>.
          </p>
        )}
        {strategyData.hiddenBuiltins.length > 0 && (
          <p className="muted small">
            {strategyData.hiddenBuiltins.length} built-in strateg{strategyData.hiddenBuiltins.length === 1 ? 'y is' : 'ies are'} hidden.{' '}
            <button type="button" className="link-btn" onClick={() => strategyData.restoreBuiltins()}>
              Show them again
            </button>
          </p>
        )}

        <DataState status={strategyData.status === 'missing' ? 'ready' : strategyData.status} error={strategyData.error} onRetry={strategyData.retry} lines={4}>
          {excluded.length > 0 && (
            <details className="notice notice--info rec-excluded">
              <summary>
                {excluded.length} strateg{excluded.length === 1 ? 'y is' : 'ies are'} hidden: they need a blocked operator with no usable replacement.
              </summary>
              <ul>
                {excluded.map(({ strategy, rec }) => (
                  <li key={strategy.id}>
                    {strategy.title}: requires {rec.blockedMissing.map((b) => `${OPERATORS_BY_ID[b.blocked].name} (${b.by.join(', ')})`).join(', ')}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {found.notes.length > 0 && ranked.length > 0 && (
            <p className="notice notice--info" role="status">
              {found.notes.join(' ')}
            </p>
          )}
          {ranked.length ? (
            <>
            <ul className="strat-list">
              {ranked.map((item, i) => (
                <RecommendationCard
                  key={item.strategy.id}
                  strategy={item.strategy}
                  rec={item.rec}
                  pref={pref}
                  top={i === 0 && item.rec.status !== 'unscored' && (item.kind === 'exact' || item.kind === 'generic')}
                  where={item.where}
                  picks={picks}
                  fits={whereFavoritesFit(found.results, item)}
                  onOpen={() => navigate(`strategies/s/${item.strategy.id}`)}
                  onOpenOther={(s) => navigate(`strategies/s/${s.id}`)}
                />
              ))}
            </ul>
            {(hidden > 0 || showAll) && found.results.length > FIND_LIMIT && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowAll(!showAll)}>
                {showAll ? `Show only the top ${FIND_LIMIT}` : `Show ${hidden} more`}
              </button>
            )}
            </>
          ) : (
            <EmptyState
              icon="book"
              title={`No strategies${mapName ? ` for ${mapName}` : ''} yet`}
              action={
                <button type="button" className="btn btn--primary" onClick={() => navigate('build')} disabled={!strategyData.canSave}>
                  <Icon name="plus" size={18} /> New strategy
                </button>
              }
            >
              Try another site or side, clear the filters, or write your own strategy. You can also add a link to one you found online.
            </EmptyState>
          )}
        </DataState>
      </section>
    </div>
  );
}
