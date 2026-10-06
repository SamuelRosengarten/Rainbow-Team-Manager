import { tx, useI18n } from '../i18n/index.js';

/** A message bar. `children` can be a string, a React node or a message descriptor. */
export default function Notice({ kind = 'error', children, onDismiss }) {
  const { t } = useI18n();
  if (!children) return null;
  return (
    <div className={`notice notice--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <span>{children?.id ? tx(children) : children}</span>
      {onDismiss && (
        <button type="button" className="btn btn--ghost btn--sm" onClick={onDismiss} aria-label={t('ui.dismiss')}>
          ✕
        </button>
      )}
    </div>
  );
}
