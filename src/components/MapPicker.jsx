import { useState } from 'react';
import { MAPS, MAPS_BY_ID, sitesFor } from '../lib/maps.js';
import { useI18n } from '../i18n/index.js';
import { T } from '../i18n/Rich.jsx';

export default function MapPicker({ mapId, site, side, onMapChange, onSiteChange }) {
  const { t } = useI18n();
  const [browsing, setBrowsing] = useState(!mapId);
  const map = MAPS_BY_ID[mapId];
  const sites = sitesFor(mapId, side);
  const showGrid = browsing || !map;

  return (
    <section className="panel" aria-labelledby="map-title">
      <div className="panel__head">
        <h2 id="map-title" className="panel__title">
          {t('mapPicker.map')} {map && !showGrid && <span className="map-current">{map.name}</span>}
        </h2>
        {map && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setBrowsing(!showGrid)} aria-expanded={showGrid}>
            {showGrid ? t('mapPicker.hideMaps') : t('mapPicker.changeMap')}
          </button>
        )}
      </div>

      {showGrid && (
        <ul className="map-grid" aria-label={t('mapPicker.rankedMapPool')}>
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
                  <span className="map-card__meta">{count ? t('mapPicker.sites', { count }) : t('mapPicker.sitesNotSet')}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {map && !showGrid && (
        <fieldset className="site-picker">
          <legend>{t('mapPicker.bombSite')}</legend>
          {sites.length === 0 ? (
            <p className="empty">
              <T id="mapPicker.noSites" values={{ map: map.name }} />
            </p>
          ) : (
            <div className="site-list" role="group" aria-label={t('mapPicker.bombSitesOf', { map: map.name })}>
              {sites.map((s) => (
                <button key={s} type="button" aria-pressed={site === s} className="site-chip" onClick={() => onSiteChange(site === s ? '' : s)}>
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
