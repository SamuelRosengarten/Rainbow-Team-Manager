import Icon from '../Icon.jsx';
import { useI18n } from '../../i18n/index.js';

/** Zoom buttons and the fullscreen switch, floating over the map. */
export function ZoomControls({ vr, zoomBy, setView, full, enterFull, exitFull }) {
  const { t } = useI18n();
  return (
    <div className="tzoom" role="group" aria-label={t('planner.zoom.group')} title={t('planner.zoom.hint')}>
      <button type="button" className="tzoom__btn" onClick={() => zoomBy(1 / 1.4)} disabled={vr.z <= 1} aria-label={t('planner.zoom.out')} title={t('planner.zoom.out')}>
        <Icon name="minus" size={16} />
      </button>
      <span className="tzoom__level" aria-live="polite">
        {t('planner.zoom.level', { pct: Math.round(vr.z * 100) })}
      </span>
      <button type="button" className="tzoom__btn" onClick={() => zoomBy(1.4)} disabled={vr.z >= 4} aria-label={t('planner.zoom.in')} title={t('planner.zoom.in')}>
        <Icon name="plus" size={16} />
      </button>
      <button type="button" className="tzoom__btn" onClick={() => setView((v) => ({ z: 1, aspect: v.aspect }))} disabled={vr.z <= 1} aria-label={t('planner.zoom.fit')} title={t('planner.zoom.fit')}>
        <Icon name="fit" size={16} />
      </button>
      <span className="tzoom__sep" aria-hidden="true" />
      <button
        type="button"
        className="tzoom__btn tzoom__btn--full"
        onClick={full ? exitFull : enterFull}
        aria-label={full ? t('planner.exitFullscreen') : t('planner.fullscreen')}
        title={`${full ? t('planner.exitFullscreen') : t('planner.fullscreen.desc')} (F)`}
        aria-pressed={full}
      >
        <Icon name={full ? 'shrink' : 'fullscreen'} size={16} />
      </button>
    </div>
  );
}

/** One short confirmation at a time, with an optional action (Undo). */
export function Toast({ toast, setToast }) {
  const { t } = useI18n();
  return (
    <div className="ttoast-wrap" role="status" aria-live="polite">
      {toast && (
        <div key={toast.id} className="ttoast">
          <span>{toast.msg}</span>
          {toast.action && (
            <button
              type="button"
              className="ttoast__action"
              onClick={() => {
                toast.action.run();
                setToast(null);
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button type="button" className="ttoast__close" aria-label={t('planner.toast.close')} onClick={() => setToast(null)}>
            <Icon name="close" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

/** Edit / duplicate / hide / delete next to the selected item. */
export function ActionBar({ barPos, selected, full, selName, editSelected, duplicate, hide, remove }) {
  const { t } = useI18n();
  return (
    <div
      className={`tbar${barPos.below ? ' tbar--below' : ''}`}
      style={{ left: Math.min(Math.max(barPos.left, full && selected ? 90 : 120), barPos.width - (full && selected ? 90 : 120)), top: barPos.top }}
      role="toolbar"
      aria-label={t('planner.action.bar', { name: selName })}
    >
      <button type="button" className="tbar__btn" onClick={editSelected}>
        <Icon name="edit" size={16} /> <span className="tbar__label">{t('planner.action.edit')}</span>
      </button>
      <button type="button" className="tbar__btn" onClick={() => duplicate(selected)}>
        <Icon name="copy" size={16} /> <span className="tbar__label">{t('planner.action.duplicate')}</span>
      </button>
      <button type="button" className="tbar__btn" onClick={() => hide(selected)} title={t('planner.action.hideHint')}>
        <Icon name="eyeOff" size={16} /> <span className="tbar__label">{t('planner.action.hide')}</span>
      </button>
      <button type="button" className="tbar__btn tbar__btn--danger" onClick={() => remove(selected)}>
        <Icon name="trash" size={16} /> <span className="tbar__label">{t('planner.action.delete')}</span>
      </button>
    </div>
  );
}
