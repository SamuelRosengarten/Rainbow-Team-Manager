import { useState } from 'react';
import FloorPlanPanel from './FloorPlanPanel.jsx';
import Icon from './Icon.jsx';
import MapNotes from './MapNotes.jsx';
import TacticalBoard from './TacticalBoard.jsx';
import { StrategyTile } from './TeamLibrary.jsx';
import { EmptyState, Meter } from './ui.jsx';
import { parseSite } from '../lib/diagram.js';
import { MAPS, MAPS_BY_ID, allSites } from '../lib/maps.js';
import { allMapPreparation } from '../lib/readiness.js';
import { missingFloorPlans, planCoverage, verifyState } from '../lib/floorPlans.js';
import { createStrategy, latestVersions } from '../lib/strategies.js';
import { usePlans } from '../state/usePlans.js';
import { T } from '../i18n/Rich.jsx';
import { useI18n } from '../i18n/index.js';

const MAP_FILTERS = ['all', 'ready', 'partial', 'none'];
const STATUS_TONE = { ready: 'ok', partial: 'accent', none: 'neutral', 'no-sites': 'neutral' };

function VerifyState({ cov }) {
  const { t } = useI18n();
  const state = verifyState(cov);
  return (
    <span className={`map-card__verify map-card__verify--${state}`}>
      <span aria-hidden="true">{state === 'verified' ? '✓' : '●'}</span> {t(`maps.verify.${state}`, { verified: cov.verified, total: cov.floors })}
    </span>
  );
}

function MapCard({ map, prep, navigate }) {
  const { t } = useI18n();
  const cov = planCoverage(map.id);
  return (
    <button type="button" className={`map-card map-card--${prep.status}`} onClick={() => navigate(`maps/${map.id}`)}>
      <span className="map-card__top">
        <span className="map-card__name">{map.name}</span>
        <span className={`badge badge--${STATUS_TONE[prep.status]}`}>{t(`maps.status.${prep.status}`)}</span>
      </span>
      <span className="map-card__meta">
        {[
          prep.sites ? t('mapPicker.sites', { count: prep.sites }) : null,
          cov.floors ? t('maps.floorsPlans', { with: cov.withPlan, floors: cov.floors }) : null,
        ].filter(Boolean).join(' · ')}
      </span>
      {cov.withPlan > 0 && <VerifyState cov={cov} />}
      {prep.coverage === null ? (
        <span className="map-card__nosites">{t('maps.noSitesBody')}</span>
      ) : (
        <span className="map-card__coverage">
          <span className="map-card__label">
            {t('maps.coverage')}
            <span className="tnum">{Math.round(prep.coverage * 100)}%</span>
          </span>
          <Meter value={prep.coverage} tone={prep.status === 'ready' ? 'ok' : 'accent'} label={t('cmd.maps.coverage', { covered: prep.covered, sites: prep.sites })} />
        </span>
      )}
      <span className="map-card__counts">
        <span className={`side-stat side-stat--attack${prep.attack ? '' : ' side-stat--zero'}`}>
          <span className="side-stat__label">{t('maps.side.attack')}</span>
          <span className="side-stat__n tnum">{prep.attack}</span>
        </span>
        <span className={`side-stat side-stat--defend${prep.defend ? '' : ' side-stat--zero'}`}>
          <span className="side-stat__label">{t('maps.side.defend')}</span>
          <span className="side-stat__n tnum">{prep.defend}</span>
        </span>
        {prep.team > 0 && <span className="map-card__team">{t('maps.teamPlans', { count: prep.team })}</span>}
      </span>
    </button>
  );
}

function MapIndex({ strategies, navigate }) {
  const { t } = useI18n();
  usePlans();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const missing = missingFloorPlans();
  const prep = allMapPreparation(strategies);
  const byMap = Object.fromEntries(prep.map((p) => [p.mapId, p]));
  const matches = (p) => filter === 'all' || p.status === filter || (filter === 'none' && p.status === 'no-sites');
  const q = query.trim().toLowerCase();
  const shown = MAPS.filter((m) => matches(byMap[m.id]) && (!q || m.name.toLowerCase().includes(q)));
  const count = (f) => prep.filter((p) => f === 'all' || p.status === f || (f === 'none' && p.status === 'no-sites')).length;
  return (
    <>
      <header className="page__head">
        <div>
          <p className="page__kicker">{t('mapsView.maps')}</p>
          <h1 className="page__title">{t('mapsView.mapsAndSites')}</h1>
          <p className="page__sub">{t('mapsView.pickAMapToSee')}</p>
        </div>
      </header>
      {missing.length > 0 && (
        <details className="notice notice--warn missing-plans">
          <summary>
            {t('maps.missingFloors', { count: missing.length })}
          </summary>
          <ul>
            {missing.map((m) => (
              <li key={`${m.mapId}/${m.floorId}`}>
                {m.mapName} {m.label}: <code>{m.file}</code>
              </li>
            ))}
          </ul>
          <p className="small">{t('mapsView.seeDocsMapAssetsMd')}</p>
        </details>
      )}
      <div className="filter-bar">
        <div className="segmented" role="group" aria-label={t('maps.filter')}>
          {MAP_FILTERS.map((f) => (
            <button key={f} type="button" className="segmented__btn" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {t(`maps.filter.${f}`)} <span className="count">{count(f)}</span>
            </button>
          ))}
        </div>
        <label className="filter-bar__search">
          <span className="visually-hidden">{t('maps.search')}</span>
          <Icon name="search" size={16} />
          <input className="input" type="search" value={query} placeholder={t('maps.search')} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>
      {shown.length ? (
        <ul className="map-grid">
          {shown.map((m) => (
            <li key={m.id}>
              <MapCard map={m} prep={byMap[m.id]} navigate={navigate} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon="map" title={t('maps.noMatch')}
          action={
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => { setFilter('all'); setQuery(''); }}>
              {t('maps.clearFilters')}
            </button>
          }
        />
      )}
    </>
  );
}

/**
 * Maps: the map list, and per map its floor plans, its bomb sites on the
 * real floor (when the plan exists), the plans for each site and side, and
 * the team's map notes.
 */
export default function MapsView({ sub, strategyData, navigate, profile, notes }) {
  const { t } = useI18n();
  usePlans();
  const map = MAPS_BY_ID[sub];
  if (!sub || !map) return <section className="page">{<MapIndex strategies={strategyData.strategies} navigate={navigate} />}</section>;

  const list = latestVersions(strategyData.strategies.filter((s) => s.mapId === map.id));
  const sites = allSites(map.id);
  const open = (id) => navigate(`strategies/s/${id}`);

  return (
    <section className="page" aria-labelledby="map-title">
      <button type="button" className="btn btn--ghost btn--sm back-btn" onClick={() => navigate('maps')}>
        <Icon name="chevron" size={16} className="icon--flip" /> {t('mapsView.maps')}
      </button>
      <header className="page__head">
        <div>
          <p className="page__kicker">{t('mapsView.map')}</p>
          <h1 id="map-title" className="page__title">
            {map.name}
          </h1>
          <p className="page__sub">
            {sites.length ? t('maps.summary', { sites: sites.length, plans: list.length }) : t('maps.summary.noSites', { plans: list.length })}
          </p>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => navigate(`build/${map.id}`)}>
          <Icon name="plus" size={18} /> {t('maps.planOn', { map: map.name })}
        </button>
      </header>

      <FloorPlanPanel key={map.id} map={map} />

      {!sites.length && (
        <EmptyState icon="map" title={t('mapsView.bombSitesArenTListed')}>
          <T id="maps.addSites" />
        </EmptyState>
      )}

      <div className="site-cards">
        {sites.map((site, siteIndex) => {
          const { floor, rooms } = parseSite(site);
          const forSite = list.filter((s) => s.site === site);
          const preview = createStrategy({ title: site, side: 'attack', mapId: map.id, site });
          return (
            <section key={site} className="panel site-card" aria-label={site}>
              <div className="site-card__board">
                <TacticalBoard strategy={preview} mapName={map.name} title={`${map.name} ${site}`} />
              </div>
              <div className="site-card__body">
                <p className="page__kicker">{floor}</p>
                <h2 className="site-card__title">{rooms.join(' / ')}</h2>
                <div className="toolbar">
                  <button type="button" className="btn btn--secondary btn--sm side-btn--attack" onClick={() => navigate(`build/${map.id}/${siteIndex}/attack`)}>
                    <Icon name="swords" size={16} /> {t('mapsView.planAttack')}
                  </button>
                  <button type="button" className="btn btn--secondary btn--sm side-btn--defend" onClick={() => navigate(`build/${map.id}/${siteIndex}/defend`)}>
                    <Icon name="shield" size={16} /> {t('mapsView.planDefense')}
                  </button>
                </div>
                {forSite.length ? (
                  <ul className="tile-grid tile-grid--narrow">
                    {forSite.map((s) => (
                      <StrategyTile key={s.id} strategy={s} onOpen={open} />
                    ))}
                  </ul>
                ) : (
                  <p className="muted small">{t('mapsView.noPlansForThisSite')}</p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {list.some((s) => !s.site) && (
        <section className="panel">
          <h2 className="panel__title">{t('mapsView.wholeMapPlans')}</h2>
          <ul className="tile-grid">
            {list
              .filter((s) => !s.site)
              .map((s) => (
                <StrategyTile key={s.id} strategy={s} onOpen={open} />
              ))}
          </ul>
        </section>
      )}

      <MapNotes mapId={map.id} currentProfile={profile} getNotes={notes.getNotes} saveNotes={notes.saveNotes} />
    </section>
  );
}
