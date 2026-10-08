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
import { useI18n } from '../i18n/index.js';
import { T } from '../i18n/Rich.jsx';
import { useRoster } from '../state/roster-context.js';
import { usePreferences } from '../state/usePreferences.js';

/** The favourites and blocks the recommendations are using, so it's clear why. */
function PreferenceSummary({ pref, side }) {
  const { t, tm } = useI18n();
  const favs = sideFavorites(pref, side);
  const blocked = [...new Set([...pref.blocked.keys(), ...pref.banned])].filter((id) => OPERATORS_BY_ID[id]?.side === side);
  // Say whose block it is: any block removes the operator from every recommendation.
  const blockNote = (id) => {
    if (pref.banned.has(id)) return t('library.block.ban');
    return t('library.block.all', { by: pref.blocked.get(id) ?? [], count: (pref.blocked.get(id) ?? []).length });
  };
  return (
    <div className="pref-summary" aria-label={t('library.prefs.aria')}>
      <span className="pref-summary__group">
        <span className="pref-summary__label">{t('library.prefs.favorites')}</span>
        {favs.length ? (
          favs.map((id) => (
            <span key={id} className="pref-summary__op" title={tm(prefWho(pref, id))}>
              <OperatorIcon operator={OPERATORS_BY_ID[id]} size="xs" />
              {OPERATORS_BY_ID[id].name}
            </span>
          ))
        ) : (
          <span className="muted small">{t('library.prefs.noneSet')}</span>
        )}
      </span>
      <span className="pref-summary__group pref-summary__group--blocked">
        <span className="pref-summary__label">{t('library.prefs.blocked')}</span>
        {blocked.length ? (
          blocked.map((id) => (
            <span key={id} className="pref-summary__op pref-summary__op--blocked" title={tm(prefWho(pref, id))}>
              <OperatorIcon operator={OPERATORS_BY_ID[id]} size="xs" />
              {OPERATORS_BY_ID[id].name}
              <span className="muted small"> · {blockNote(id)}</span>
            </span>
          ))
        ) : (
          <span className="muted small">{t('ui.none')}</span>
        )}
      </span>
      {sharedFavorites(pref)
        .filter((c) => OPERATORS_BY_ID[c.id].side === side)
        .map((c) => (
          <span key={c.id} className="pref-summary__conflict small">
            ⚠ {tm(c.msg)}
          </span>
        ))}
      {pref.players.length > 0 && <span className="muted small">{t('library.prefs.from', { players: pref.players })}</span>}
    </div>
  );
}

/**
 * Map → site → side → five players and operators → ranked strategies.
 * `setup` lives in the parent so it survives opening a strategy and coming back.
 */
export default function StrategyLibrary({ setup, setSetup, players, onSyncPlan, strategyData, navigate, onAddReference, updateTeam }) {
  const { t, tm } = useI18n();
  const { roster, prefs, ownedOnly } = useRoster();
  const [showFilters, setShowFilters] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const { mapId, site, side, picks, filters } = setup;
  const set = (patch) => setSetup((s) => ({ ...s, ...patch }));
  const setFilter = (patch) => set({ filters: { ...filters, ...patch } });
  const sites = mapId ? sitesFor(mapId, side) : [];
  const composition = picks.map((p) => p.operatorId).filter(Boolean);
  // Preferences of the players in the setup (or the viewer's own).
  const pref = usePreferences(picks.map((p) => p.player));

  // Up to five plans, widening to other sites and maps (and saying so) when the
  // library has few for this setup. Each result carries a real assignment:
  // every player on exactly one operator, respecting ownership, blocks and favourites.
  const found = useMemo(
    () => findStrategies(strategyData.strategies, { mapId, site, side, filters, pref, prefs, roster, picks, ownedOnly, limit: FIND_LIMIT }),
    [strategyData.strategies, mapId, site, side, filters, picks, pref, prefs, roster, ownedOnly],
  );
  const { excluded } = found;
  const ranked = showAll ? found.results : found.results.slice(0, FIND_LIMIT);
  const hidden = found.results.length - ranked.length;

  const activeFilters = Object.values(filters).filter(Boolean).length;
  const mapName = MAPS_BY_ID[mapId]?.name;
  // Operator the top result gives each player: the one-tap fix for a pick they don't own.
  const fixes = Object.fromEntries((found.results[0]?.plan.slots ?? []).filter((s) => s.player && s.operatorId).map((s) => [s.player, s.operatorId]));
  const applyPick = (player, operatorId) => set({ picks: picks.map((p) => (p.player === player ? { ...p, operatorId } : p)) });

  return (
    <div className="strat-lib">
      <section className="panel" aria-labelledby="setup-title">
        <div className="panel__head">
          <h2 id="setup-title" className="panel__title">
            {t('library.setup')}
          </h2>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onSyncPlan}>
            <Icon name="refresh" size={16} /> {t('library.syncPlan')}
          </button>
        </div>
        <div className="setup-grid">
          <label className="field">
            <span className="field__label">{t('library.map')}</span>
            <select className="select" value={mapId} onChange={(e) => set({ mapId: e.target.value, site: '' })}>
              <option value="">{t('card.anyMap')}</option>
              {MAPS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">{t('library.floorSite')}</span>
            <select className="select" value={site} onChange={(e) => set({ site: e.target.value })} disabled={!sites.length}>
              <option value="">{mapId && !sites.length ? t('library.noSites') : t('library.anySite')}</option>
              {sites.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="field">
            <legend className="field__label">{t('library.side')}</legend>
            <div className="segmented segmented--full" role="group">
              {['attack', 'defend'].map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`segmented__btn segmented__btn--${id}`}
                  aria-pressed={side === id}
                  onClick={() => side !== id && set({ side: id, picks: picks.map((p) => ({ ...p, operatorId: null })) })}
                >
                  {t(id === 'attack' ? 'card.side.attack' : 'card.side.defend')}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        <OwnedOnlyNote pref={pref} updateTeam={updateTeam} players={picks.map((p) => p.player).filter(Boolean)} />
        <h3 className="section-title setup-sub">{t('library.picks')}</h3>
        <CompositionPicker side={side} picks={picks} players={players} onChange={(next) => set({ picks: next })} fixes={fixes} />
        <PreferenceSummary pref={pref} side={side} />
      </section>

      <section className="strat-results" aria-labelledby="results-title">
        <div className="results-bar">
          <h2 id="results-title" className="section-title">
            {pref.favorites.size ? t('library.results.favorites') : composition.length ? t('library.results.composition') : t('library.results.all')}
            <span className="muted">{found.results.length}</span>
          </h2>
          <div className="toolbar">
            <button type="button" className="btn btn--ghost btn--sm" aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}>
              {activeFilters ? t('library.filtersCount', { count: activeFilters }) : t('library.filters')}
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={onAddReference} disabled={!strategyData.canSave}>
              <Icon name="external" size={16} /> {t('library.addReference')}
            </button>
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => navigate('build')} disabled={!strategyData.canSave}>
              <Icon name="plus" size={16} /> {t('library.newStrategy')}
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="filters">
            <label className="field filters__search">
              <span className="field__label">{t('library.filter.search')}</span>
              <input
                className="input"
                type="search"
                value={filters.query ?? ''}
                placeholder={t('library.filter.searchPlaceholder')}
                onChange={(e) => setFilter({ query: e.target.value })}
              />
            </label>
            {[
              ['type', t('library.filter.type'), STRATEGY_TYPES],
              ['difficulty', t('library.filter.difficulty'), DIFFICULTY],
              ['origin', t('library.filter.source'), Object.fromEntries(Object.entries(ORIGINS).map(([k, v]) => [k, v.label]))],
              ['role', t('library.filter.role'), ROLE_LABEL],
            ].map(([key, label, options]) => (
              <label key={key} className="field">
                <span className="field__label">{label}</span>
                <select className="select" value={filters[key] ?? ''} onChange={(e) => setFilter({ [key]: e.target.value })}>
                  <option value="">{t('ui.all')}</option>
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
                {t('library.filter.clear')}
              </button>
            )}
          </div>
        )}

        {strategyData.status === 'missing' && (
          <p className="notice notice--warn" role="status">
            <T id="library.missing" />
          </p>
        )}
        {strategyData.hiddenBuiltins.length > 0 && (
          <p className="muted small">
            {t('library.hidden', { count: strategyData.hiddenBuiltins.length })}{' '}
            <button type="button" className="link-btn" onClick={() => strategyData.restoreBuiltins()}>
              {t('library.hidden.show')}
            </button>
          </p>
        )}

        <DataState status={strategyData.status === 'missing' ? 'ready' : strategyData.status} error={strategyData.error} onRetry={strategyData.retry} lines={4}>
          {excluded.length > 0 && (
            <details className="notice notice--info rec-excluded">
              <summary>{t('library.excluded', { count: excluded.length })}</summary>
              <ul>
                {excluded.map(({ strategy, rec }) => (
                  <li key={strategy.id}>
                    {t('library.excluded.item', {
                      title: strategy.title,
                      operators: rec.blockedMissing.map((b) => t('library.excluded.op', { operator: OPERATORS_BY_ID[b.blocked].name, by: b.by })),
                    })}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {found.notes.length > 0 && ranked.length > 0 && (
            <p className="notice notice--info" role="status">
              {found.notes.map((n) => tm(n)).join(' ')}
            </p>
          )}
          {ranked.length ? (
            <>
              <ul className="strat-list">
                {ranked.map((item, i) => (
                  <RecommendationCard
                    key={item.strategy.id}
                    item={item}
                    pref={pref}
                    top={i === 0 && item.rec.status !== 'unscored' && (item.kind === 'exact' || item.kind === 'generic')}
                    fits={whereFavoritesFit(found.results, item)}
                    onOpen={() => navigate(`strategies/s/${item.strategy.id}`)}
                    onOpenOther={(s) => navigate(`strategies/s/${s.id}`)}
                    onApplyPick={applyPick}
                  />
                ))}
              </ul>
              {(hidden > 0 || showAll) && found.results.length > FIND_LIMIT && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowAll(!showAll)}>
                  {showAll ? t('library.showTop', { count: FIND_LIMIT }) : t('library.showMore', { count: hidden })}
                </button>
              )}
            </>
          ) : (
            <EmptyState
              icon="book"
              title={mapName ? t('library.empty.titleMap', { map: mapName }) : t('library.empty.title')}
              action={
                <button type="button" className="btn btn--primary" onClick={() => navigate('build')} disabled={!strategyData.canSave}>
                  <Icon name="plus" size={18} /> {t('library.newStrategy')}
                </button>
              }
            >
              {t('library.empty.body')}
            </EmptyState>
          )}
        </DataState>
      </section>
    </div>
  );
}
