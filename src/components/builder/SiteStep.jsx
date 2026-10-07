import ChoiceGrid from './ChoiceGrid.jsx';
import { parseSite } from '../../lib/diagram.js';
import { floorIdFromSite, floorPlan, planSrc, planSrcSet } from '../../lib/floorPlans.js';
import { useI18n } from '../../i18n/index.js';

/** Step 2: pick the site (or plan without one). */
export default function SiteStep({ w, set, map, sites }) {
  const { t } = useI18n();
  return (
    <>
      {!sites.length && (
        <p className="notice notice--info" role="status">
          {t('builder.noSites', { map: map?.name })}
        </p>
      )}
      <ChoiceGrid>
        {sites.map((s) => {
          const { floor, rooms } = parseSite(s);
          const plan = floorPlan(w.mapId, floorIdFromSite(s));
          return (
            <li key={s}>
              <button type="button" className="choice choice--site" aria-pressed={w.site === s} onClick={() => set((x) => ({ site: s, step: 3, reached: Math.max(x.reached, 3) }))}>
                {plan && <img className="choice__plan" src={planSrc(plan, 0)} srcSet={planSrcSet(plan)} sizes="(max-width: 720px) 100vw, 320px" alt="" loading="lazy" decoding="async" />}
                <span className="choice__floor">{floor}</span>
                <span className="choice__name">{rooms.join(' / ')}</span>
              </button>
            </li>
          );
        })}
        <li>
          <button type="button" className="choice choice--site" aria-pressed={w.site === '' && w.reached > 2} onClick={() => set((x) => ({ site: '', step: 3, reached: Math.max(x.reached, 3) }))}>
            <span className="choice__name">{sites.length ? t('strategyBuilder.anySite') : t('strategyBuilder.noSitesListedContinue')}</span>
            <span className="choice__meta">{t('strategyBuilder.aPlanThatIsnT')}</span>
          </button>
        </li>
      </ChoiceGrid>
    </>
  );
}
