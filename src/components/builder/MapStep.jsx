import ChoiceGrid from './ChoiceGrid.jsx';
import { MAPS } from '../../lib/maps.js';
import { useI18n } from '../../i18n/index.js';

/** Step 1: pick the map. */
export default function MapStep({ w, set, strategyData }) {
  const { t } = useI18n();
  return (
    <ChoiceGrid className="choice-grid--maps">
      {MAPS.map((m) => {
        const count = strategyData.strategies.filter((s) => s.mapId === m.id).length;
        return (
          <li key={m.id}>
            <button
              type="button"
              className="choice choice--map"
              aria-pressed={w.mapId === m.id}
              onClick={() => set((x) => ({ mapId: m.id, site: x.mapId === m.id ? x.site : '', step: 2, reached: Math.max(x.reached, 2) }))}
            >
              <span className="choice__name">{m.name}</span>
              <span className="choice__meta">
                {m.sites.attack.length ? t('mapPicker.sites', { count: m.sites.attack.length }) : t('strategyBuilder.noSitesListedPlanWithout')} · {t('builder.strategyCount', { count })}
              </span>
            </button>
          </li>
        );
      })}
    </ChoiceGrid>
  );
}
