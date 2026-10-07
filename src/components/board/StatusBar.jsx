import Icon from '../Icon.jsx';
import { LIMITS } from '../../lib/strategies.js';
import { useI18n } from '../../i18n/index.js';

/** What's placed, limits, hidden items and the suggestion checklist. */
export default function StatusBar({ progress, near, hidden, setHidden }) {
  const { t } = useI18n();
  return (
    <div className="tstatus">
      <p className="tstatus__main">
        <strong>{t('planner.status.placed', { count: progress.items })}</strong>
        {progress.items > 0 && (
          <>
            <span className="tstatus__dot" aria-hidden="true">·</span>
            <span>{t('planner.status.routes', { count: progress.routes })}</span>
            <span className="tstatus__dot" aria-hidden="true">·</span>
            <span>{t('planner.status.crossfires', { count: progress.crossfires })}</span>
          </>
        )}
        {near && <span className="tstatus__warn">{t('planner.status.limit', { n: near[1], max: LIMITS[near[0]] })}</span>}
      </p>
      {hidden.size > 0 && (
        <button type="button" className="btn btn--ghost btn--sm tstatus__hidden" onClick={() => setHidden(new Set())}>
          <Icon name="eye" size={16} /> {t('planner.hidden', { count: hidden.size })} · {t('planner.showHidden')}
        </button>
      )}
      <details className="tcheck">
        <summary>
          <Icon name="list" size={16} /> {t('planner.checklist')}
          <span className="tcheck__count">
            {progress.checklist.filter((c) => c.done).length}/{progress.checklist.length}
          </span>
        </summary>
        <div className="tcheck__pop">
        <ul className="tcheck__list">
          {progress.checklist.map((c) => (
            <li key={c.id} className={c.done ? 'is-done' : undefined}>
              <Icon name={c.done ? 'check' : 'target'} size={16} />
              <span className="visually-hidden">{t(c.done ? 'planner.check.done' : 'planner.check.todo')} </span>
              {t(`planner.check.${c.id}`, { n: c.n ?? 0, total: c.total ?? 0 })}
            </li>
          ))}
        </ul>
        <p className="muted small">{t('planner.checklist.note')}</p>
        </div>
      </details>
    </div>
  );
}
