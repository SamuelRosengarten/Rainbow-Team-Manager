import { useState } from 'react';
import { MAPS, MAPS_BY_ID, sitesFor } from '../lib/maps.js';

export default function MapPicker({ mapId, site, side, onMapChange, onSiteChange }) {
  const [browsing, setBrowsing] = useState(!mapId);
  const map = MAPS_BY_ID[mapId];
  const sites = sitesFor(mapId, side);
  const showGrid = browsing || !map;

  return (
    <section className="panel" aria-labelledby="map-title">
      <div className="panel__head">
        <h2 id="map-title" className="panel__title">
          Map {map && !showGrid && <span className="map-current">{map.name}</span>}
        </h2>
        {map && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setBrowsing(!showGrid)} aria-expanded={showGrid}>
            {showGrid ? 'Hide maps' : 'Change map'}
          </button>
        )}
      </div>

      {showGrid && (
        <ul className="map-grid" aria-label="Ranked map pool">
          {MAPS.map((m) => {
            const count = m.sites[side]?.length ?? 0;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  className="map-card"
                  aria-pressed={m.id === mapId}
                  onClick={() => {
                    onMapChange(m.id);
                    setBrowsing(false);
                  }}
                >
                  <span className="map-card__name">{m.name}</span>
                  <span className="map-card__meta">{count ? `${count} sites` : 'Sites not set'}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {map && !showGrid && (
        <fieldset className="site-picker">
          <legend>Bomb site</legend>
          {sites.length === 0 ? (
            <p className="empty">
              No bomb sites are defined for {map.name} yet. Add them to <code>src/data/maps.json</code>.
            </p>
          ) : (
            <div className="site-list" role="radiogroup" aria-label={`${map.name} bomb sites`}>
              {sites.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={site === s}
                  className="site-chip"
                  onClick={() => onSiteChange(site === s ? '' : s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </fieldset>
      )}
    </section>
  );
}
