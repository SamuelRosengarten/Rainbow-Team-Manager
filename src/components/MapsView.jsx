import Icon from './Icon.jsx';
import MapNotes from './MapNotes.jsx';
import TacticalBoard from './TacticalBoard.jsx';
import { StrategyTile } from './TeamLibrary.jsx';
import { EmptyState } from './ui.jsx';
import { parseSite } from '../lib/diagram.js';
import { MAPS, MAPS_BY_ID, allSites } from '../lib/maps.js';
import { latestVersions, normalizeStrategy } from '../lib/strategies.js';

function MapIndex({ strategies, navigate }) {
  return (
    <>
      <header className="page__head">
        <div>
          <p className="page__kicker">Maps</p>
          <h1 className="page__title">Maps and sites</h1>
          <p className="page__sub">Pick a map to see its sites, your plans for each, and the team's map notes.</p>
        </div>
      </header>
      <ul className="map-grid">
        {MAPS.map((m) => {
          const list = latestVersions(strategies.filter((s) => s.mapId === m.id));
          const atk = list.filter((s) => s.side === 'attack').length;
          const def = list.filter((s) => s.side === 'defend').length;
          return (
            <li key={m.id}>
              <button type="button" className="map-card" onClick={() => navigate(`maps/${m.id}`)}>
                <span className="map-card__name">{m.name}</span>
                <span className="map-card__meta">{allSites(m.id).length ? `${allSites(m.id).length} sites` : 'Sites not listed yet'}</span>
                <span className="map-card__counts">
                  <span className="side-count side-count--attack">{atk} attack</span>
                  <span className="side-count side-count--defend">{def} defense</span>
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
 * Maps: the map list, and per map its bomb sites with their schematic, the
 * plans for each site and side, and the team's map notes.
 */
export default function MapsView({ sub, strategyData, navigate, profile, notes }) {
  const map = MAPS_BY_ID[sub];
  if (!sub || !map) return <section className="page">{<MapIndex strategies={strategyData.strategies} navigate={navigate} />}</section>;

  const list = latestVersions(strategyData.strategies.filter((s) => s.mapId === map.id));
  const sites = allSites(map.id);
  const open = (id) => navigate(`strategies/s/${id}`);

  return (
    <section className="page" aria-labelledby="map-title">
      <button type="button" className="btn btn--ghost btn--sm back-btn" onClick={() => navigate('maps')}>
        <Icon name="chevron" size={16} className="icon--flip" /> Maps
      </button>
      <header className="page__head">
        <div>
          <p className="page__kicker">Map</p>
          <h1 id="map-title" className="page__title">
            {map.name}
          </h1>
          <p className="page__sub">
            {sites.length} sites · {list.length} {list.length === 1 ? 'plan' : 'plans'}
          </p>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => navigate(`build/${map.id}`)}>
          <Icon name="plus" size={18} /> Plan on {map.name}
        </button>
      </header>

      {!sites.length && (
        <EmptyState icon="map" title="Bomb sites aren't listed for this map yet">
          Add them to <code>src/data/maps.json</code>. Plans for the whole map still work.
        </EmptyState>
      )}

      <div className="site-cards">
        {sites.map((site, siteIndex) => {
          const { floor, rooms } = parseSite(site);
          const forSite = list.filter((s) => s.site === site);
          const preview = normalizeStrategy({ title: site, side: 'attack', mapId: map.id, site });
          return (
            <section key={site} className="panel site-card" aria-label={site}>
              <div className="site-card__board">
                <TacticalBoard strategy={preview} mapName={map.name} title={`${map.name} ${site} schematic`} />
              </div>
              <div className="site-card__body">
                <p className="page__kicker">{floor}</p>
                <h2 className="site-card__title">{rooms.join(' / ')}</h2>
                <div className="toolbar">
                  <button type="button" className="btn btn--secondary btn--sm side-btn--attack" onClick={() => navigate(`build/${map.id}/${siteIndex}/attack`)}>
                    <Icon name="swords" size={16} /> Plan attack
                  </button>
                  <button type="button" className="btn btn--secondary btn--sm side-btn--defend" onClick={() => navigate(`build/${map.id}/${siteIndex}/defend`)}>
                    <Icon name="shield" size={16} /> Plan defense
                  </button>
                </div>
                {forSite.length ? (
                  <ul className="tile-grid tile-grid--narrow">
                    {forSite.map((s) => (
                      <StrategyTile key={s.id} strategy={s} onOpen={open} />
                    ))}
                  </ul>
                ) : (
                  <p className="muted small">No plans for this site yet.</p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {list.some((s) => !s.site) && (
        <section className="panel">
          <h2 className="panel__title">Whole-map plans</h2>
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
