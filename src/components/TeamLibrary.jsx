import { useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import OperatorIcon from './OperatorIcon.jsx';
import { OriginBadge } from './StrategyCard.jsx';
import { DataState, EmptyState } from './ui.jsx';
import { MAPS, MAPS_BY_ID } from '../lib/maps.js';
import { OPERATORS_BY_ID } from '../lib/operators.js';
import { STRATEGY_TYPES, familyOf, filterStrategies, latestVersions } from '../lib/strategies.js';
import { STRATEGY_TYPES_BY_SIDE } from '../lib/tactical.js';
import { useI18n } from '../i18n/index.js';
import { T } from '../i18n/Rich.jsx';

const SIDES = ['attack', 'defend'];

/** One strategy (latest version of its family) in the library tree. */
export function StrategyTile({ strategy, versions = [], onOpen, onFavorite }) {
  const { t } = useI18n();
  const isTeam = strategy.origin === 'team' && !strategy.builtin;
  return (
    <li className={`tile tile--${strategy.side}`}>
      <button type="button" className="tile__main" onClick={() => onOpen(strategy.id)}>
        <span className="tile__top">
          <span className="tile__title">{strategy.title}</span>
          {isTeam ? <span className="version-chip">v{strategy.version}</span> : <OriginBadge strategy={strategy} />}
        </span>
        <span className="tile__meta">
          <span className="type-tag">{STRATEGY_TYPES[strategy.type]}</span>
          {strategy.site && <span className="muted small">{strategy.site}</span>}
        </span>
        <span className="tile__ops" aria-label={strategy.slots.map((s) => OPERATORS_BY_ID[s.operatorId]?.name ?? t('card.anyOperator')).join(', ')}>
          {strategy.slots.map((s) => (
            <OperatorIcon key={s.key} operator={OPERATORS_BY_ID[s.operatorId]} size="sm" />
          ))}
        </span>
        {strategy.updatedBy && <span className="tile__by muted small">{t('teamLib.updatedBy', { player: strategy.updatedBy })}</span>}
      </button>
      {versions.length > 1 && (
        <span className="tile__versions" aria-label={t('teamLibrary.versions')}>
          {versions.map((v) => (
            <button key={v.id} type="button" className="version-pill version-pill--sm" aria-current={v.id === strategy.id ? 'true' : undefined} onClick={() => onOpen(v.id)} title={v.versionNote || t('teamLib.version', { n: v.version })}>
              v{v.version}
            </button>
          ))}
        </span>
      )}
      {isTeam && onFavorite && (
        <button
          type="button"
          className={`fav-btn fav-btn--tile${strategy.favorite ? ' fav-btn--on' : ''}`}
          aria-pressed={strategy.favorite}
          aria-label={t(strategy.favorite ? 'teamLib.favRemove' : 'teamLib.favAdd', { title: strategy.title })}
          onClick={() => onFavorite(strategy)}
        >
          <Icon name="star" size={18} />
        </button>
      )}
    </li>
  );
}

/**
 * MY TEAM → ATTACK / DEFENSE → map → strategies. Shows the latest version of
 * each strategy; older versions are one tap away. Favourites, filters and
 * (optionally) the built-in starting points.
 */
export default function TeamLibrary({ strategyData, navigate, initialSide = '' }) {
  const { t } = useI18n();
  const [side, setSide] = useState(initialSide);
  const [mapId, setMapId] = useState('');
  const [type, setType] = useState('');
  const [favOnly, setFavOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [withBuiltins, setWithBuiltins] = useState(false);
  const [error, setError] = useState('');

  const all = strategyData.strategies;
  const team = useMemo(() => all.filter((s) => s.origin === 'team' && !s.builtin), [all]);
  const pool = useMemo(() => (withBuiltins ? all : team), [all, team, withBuiltins]);

  const shown = useMemo(() => {
    let list = latestVersions(pool);
    list = filterStrategies(list, { side: side || undefined, type: type || undefined, query });
    if (mapId) list = list.filter((s) => s.mapId === mapId);
    if (favOnly) list = list.filter((s) => s.favorite);
    return list;
  }, [pool, side, type, query, mapId, favOnly]);

  const tree = SIDES.filter((id) => !side || side === id).map((id) => {
    const label = t(id === 'attack' ? 'card.side.attack' : 'card.side.defend');
    const list = shown.filter((s) => s.side === id);
    const byMap = new Map();
    for (const s of list) {
      const key = s.mapId;
      if (!byMap.has(key)) byMap.set(key, []);
      byMap.get(key).push(s);
    }
    const maps = [...byMap.entries()]
      .map(([m, items]) => ({ mapId: m, name: MAPS_BY_ID[m]?.name ?? t('card.anyMap'), items: items.sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.title.localeCompare(b.title)) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { id, label, count: list.length, maps };
  });

  const favorite = async (s) => {
    setError('');
    try {
      await strategyData.saveStrategy({ ...s, favorite: !s.favorite });
    } catch (e) {
      setError(e.message || t('teamLib.favFailed'));
    }
  };
  const types = side ? STRATEGY_TYPES_BY_SIDE[side] : STRATEGY_TYPES;

  return (
    <div className="library">
      <div className="lib-filters">
        <div className="segmented" role="group" aria-label={t('teamLibrary.side')}>
          {['', ...SIDES].map((id) => (
            <button key={id || 'all'} type="button" className={`segmented__btn${id ? ` segmented__btn--${id}` : ''}`} aria-pressed={side === id} onClick={() => { setSide(id); setType(''); }}>
              {id ? t(id === 'attack' ? 'card.side.attack' : 'card.side.defend') : t('ui.all')}
            </button>
          ))}
        </div>
        <select className="select input--sm" value={mapId} onChange={(e) => setMapId(e.target.value)} aria-label={t('teamLibrary.map')}>
          <option value="">{t('teamLibrary.allMaps')}</option>
          {MAPS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <select className="select input--sm" value={type} onChange={(e) => setType(e.target.value)} aria-label={t('teamLibrary.strategyType')}>
          <option value="">{t('teamLibrary.allTypes')}</option>
          {Object.entries(types).map(([id, l]) => (
            <option key={id} value={id}>
              {l}
            </option>
          ))}
        </select>
        <input className="input input--sm lib-filters__search" type="search" value={query} placeholder={t('teamLibrary.searchTitleOperatorTag')} onChange={(e) => setQuery(e.target.value)} aria-label={t('teamLibrary.search')} />
        <button type="button" className="chip-toggle" aria-pressed={favOnly} onClick={() => setFavOnly(!favOnly)}>
          <Icon name="star" size={15} /> {t('teamLibrary.favourites')}
        </button>
        <button type="button" className="chip-toggle" aria-pressed={withBuiltins} onClick={() => setWithBuiltins(!withBuiltins)}>
          <Icon name="book" size={15} /> {t('teamLibrary.includeStartingPoints')}
        </button>
      </div>

      {error && <p className="notice notice--error" role="alert">{error}</p>}
      {strategyData.status === 'missing' && (
        <p className="notice notice--warn" role="status">
          <T id="teamLib.missing" />
        </p>
      )}

      <DataState status={strategyData.status === 'missing' ? 'ready' : strategyData.status} error={strategyData.error} onRetry={strategyData.retry} lines={5}>
        {shown.length === 0 ? (
          <EmptyState
            icon="book"
            title={team.length ? t('teamLib.emptyFiltered') : t('teamLib.empty')}
            action={
              <span className="toolbar">
                <button type="button" className="btn btn--primary" onClick={() => navigate('build')}>
                  <Icon name="plus" size={18} /> {t('teamLibrary.createStrategy')}
                </button>
                {!withBuiltins && (
                  <button type="button" className="btn btn--secondary" onClick={() => setWithBuiltins(true)}>
                    {t('teamLibrary.showStartingPoints')}
                  </button>
                )}
              </span>
            }
          >
            {team.length ? t('teamLibrary.clearAFilterOrCreate') : t('teamLibrary.buildYourFirstStrategyOr')}
          </EmptyState>
        ) : (
          <div className="tree">
            {tree
              .filter((branch) => branch.count > 0)
              .map((branch) => (
                <section key={branch.id} className={`tree__side tree__side--${branch.id}`} aria-labelledby={`side-${branch.id}`}>
                  <h2 id={`side-${branch.id}`} className="tree__side-title">
                    <Icon name={branch.id === 'attack' ? 'swords' : 'shield'} size={18} /> {branch.label}
                    <span className="muted">{branch.count}</span>
                  </h2>
                  {branch.maps.map((m) => (
                    <div key={m.mapId} className="tree__map">
                      <h3 className="tree__map-title">
                        <button type="button" className="link-btn" onClick={() => m.mapId !== 'any' && navigate(`maps/${m.mapId}`)}>
                          {m.name}
                        </button>
                        <span className="muted small">{m.items.length}</span>
                      </h3>
                      <ul className="tile-grid">
                        {m.items.map((s) => (
                          <StrategyTile
                            key={s.id}
                            strategy={s}
                            versions={s.origin === 'team' ? familyOf(all, s) : []}
                            onOpen={(id) => navigate(`strategies/s/${id}`)}
                            onFavorite={strategyData.canSave ? favorite : undefined}
                          />
                        ))}
                      </ul>
                    </div>
                  ))}
                </section>
              ))}
          </div>
        )}
      </DataState>
    </div>
  );
}
