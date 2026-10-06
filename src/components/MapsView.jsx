import FloorPlanPanel from './FloorPlanPanel.jsx';
import Icon from './Icon.jsx';
import MapNotes from './MapNotes.jsx';
import TacticalBoard from './TacticalBoard.jsx';
import { StrategyTile } from './TeamLibrary.jsx';
import { EmptyState } from './ui.jsx';
import { parseSite } from '../lib/diagram.js';
import { MAPS, MAPS_BY_ID, allSites } from '../lib/maps.js';
import { missingFloorPlans, planCoverage } from '../lib/floorPlans.js';
import { createStrategy, latestVersions } from '../lib/strategies.js';
import { usePlans } from '../state/usePlans.js';
import { T } from '../i18n/Rich.jsx';
import { useI18n } from '../i18n/index.js';

function MapIndex({ strategies, navigate }) {
  const { t } = useI18n();
  usePlans();
  const missing = missingFloorPlans();
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
      <ul className="map-grid">
        {MAPS.map((m) => {
          const list = latestVersions(strategies.filter((s) => s.mapId === m.id));
          const atk = list.filter((s) => s.side === 'attack').length;
          const def = list.filter((s) => s.side === 'defend').length;
          const cov = planCoverage(m.id);
          return (
            <li key={m.id}>
              <button type="button" className="map-card" onClick={() => navigate(`maps/${m.id}`)}>
                <span className="map-card__name">{m.name}</span>
                <span className="map-card__meta">{allSites(m.id).length ? t('mapPicker.sites', { count: allSites(m.id).length }) : t('mapsView.sitesNotListedYet')}</span>
                <span className={`map-card__plans${cov.floors && cov.withPlan === cov.floors ? ' map-card__plans--ok' : ''}`}>
                  {cov.floors ? t(cov.withPlan ? 'maps.floorPlansVerified' : 'maps.floorPlans', { with: cov.withPlan, floors: cov.floors, verified: cov.verified }) : t('mapsView.floorsNotListed')}
                </span>
                <span className="map-card__counts">
                  <span className={`side-count side-count--attack${atk ? '' : ' side-count--zero'}`}>{t('maps.attackCount', { count: atk })}</span>
                  <span className={`side-count side-count--defend${def ? '' : ' side-count--zero'}`}>{t('maps.defenseCount', { count: def })}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
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
            {t('maps.summary', { sites: sites.length, plans: list.length })}
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
