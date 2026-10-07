import Icon from '../Icon.jsx';
import { floorLabel } from '../../lib/floorPlans.js';
import { toFloorLayout } from '../../lib/strategies.js';
import { useI18n } from '../../i18n/index.js';

/** Plain-language notices about the floor plan: approximate positions, no map, missing plan. */
export default function LayoutNotice({ space, reviewing, setReviewing, set, undo, notify, pickTool }) {
  const { t } = useI18n();
  return (
    <>
      {space.approximate &&
        (reviewing ? (
          <div className="tnotice tnotice--slim" role="status">
            <Icon name="cursor" size={16} />
            <span>{t('planner.approx.reviewing', { floor: floorLabel(space.floorId) })}</span>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => {
                set((d) => toFloorLayout(d));
                setReviewing(false);
                notify(t('planner.toast.kept'), { label: t('planner.toast.undo'), run: undo });
              }}
            >
              <Icon name="check" size={16} /> {t('planner.approx.done')}
            </button>
          </div>
        ) : (
          <div className="tnotice" role="status">
            <Icon name="map" size={18} className="tnotice__icon" />
            <div className="tnotice__text">
              <strong>{t('planner.approx.title')}</strong>
              <span>{t('planner.approx.body')}</span>
            </div>
            <div className="tnotice__actions">
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => {
                  set((d) => toFloorLayout(d));
                  notify(t('planner.toast.kept'), { label: t('planner.toast.undo'), run: undo });
                }}
              >
                {t('planner.approx.keep')}
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  setReviewing(true);
                  pickTool('select');
                }}
              >
                {t('planner.approx.review')}
              </button>
            </div>
          </div>
        ))}
      {space.kind === 'none' && <p className="tnotice tnotice--slim">{t('boardEditor.thisPlanIsnTTied')}</p>}
      {space.kind === 'missing' && <p className="tnotice tnotice--slim">{t('board.missingPlan', { floor: floorLabel(space.floorId) })}</p>}
    </>
  );
}
