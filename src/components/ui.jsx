// Reusable building blocks shared by every screen.
import { useEffect, useRef } from 'react';
import Icon from './Icon.jsx';
import { tx, useI18n } from '../i18n/index.js';
import { T } from '../i18n/Rich.jsx';

/** Intentional empty state with an optional call to action. */
export function EmptyState({ icon = 'list', title, children, action }) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon" aria-hidden="true">
        <Icon name={icon} size={26} />
      </span>
      <p className="empty-state__title">{title}</p>
      {children && <p className="empty-state__body">{children}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}

/** Placeholder blocks shown while a section loads (fixed height = no layout jump). */
export function Skeleton({ lines = 3 }) {
  return (
    <div className="skeleton" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="skeleton__line" />
      ))}
    </div>
  );
}

/**
 * Loading / error / "needs the database update" wrapper for a data section.
 * Renders children only when status is 'ready'.
 */
export function DataState({ status, error, onRetry, lines = 3, children }) {
  const { t } = useI18n();
  if (status === 'loading') {
    return (
      <div role="status" aria-label={t('ui.loading')}>
        <Skeleton lines={lines} />
      </div>
    );
  }
  if (status === 'missing') {
    return (
      <EmptyState icon="alert" title={t('ui.dbUpdate.title')}>
        <T id="ui.dbUpdate.body" />
      </EmptyState>
    );
  }
  if (status === 'error') {
    return (
      <EmptyState
        icon="alert"
        title={t('ui.couldntLoad')}
        action={
          onRetry && (
            <button type="button" className="btn btn--secondary btn--sm" onClick={onRetry}>
              <Icon name="refresh" size={16} /> {t('ui.tryAgain')}
            </button>
          )
        }
      >
        {tx(error)}
      </EmptyState>
    );
  }
  return children;
}

/** Coloured status pill. tone: neutral | ok | warn | danger | attack | defend | accent */
export function Badge({ tone = 'neutral', children, dot = false }) {
  return (
    <span className={`badge badge--${tone}`}>
      {dot && <span className="badge__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Round initial badge for a player. */
export function Avatar({ name, size = 'md', tone }) {
  return (
    <span className={`avatar avatar--${size}${tone ? ` avatar--${tone}` : ''}`} aria-hidden="true">
      {name?.[0]?.toUpperCase() ?? '?'}
    </span>
  );
}

/**
 * Modal sheet: slides up from the bottom on phones, centered on desktop.
 * Uses <dialog> for focus trapping and Escape to close.
 */
export function Sheet({ title, onClose, children, footer, labelId = 'sheet-title' }) {
  const { t } = useI18n();
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal?.();
    return () => dialog?.open && dialog.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={labelId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet__inner">
        <header className="sheet__head">
          <h2 id={labelId} className="sheet__title">{title}</h2>
          <button type="button" className="btn btn--ghost btn--icon" onClick={onClose} aria-label={t('ui.close')}>
            <Icon name="close" />
          </button>
        </header>
        <div className="sheet__body">{children}</div>
        {footer && <footer className="sheet__foot">{footer}</footer>}
      </div>
    </dialog>
  );
}

/**
 * Section card with a title row and optional action. `kicker` renders the
 * title as a small tactical label (briefing style) instead of a heading-sized one.
 */
export function Card({ title, icon, action, children, className = '', id, kicker = false }) {
  const titleId = id ? `${id}-title` : undefined;
  return (
    <section className={`panel card${kicker ? ' card--kicker' : ''} ${className}`} aria-labelledby={titleId}>
      {(title || action) && (
        <div className="panel__head">
          {title && (
            <h2 id={titleId} className="panel__title card__title">
              {icon && <Icon name={icon} size={18} className="card__icon" />}
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * Progress bar for a share (0-1). The label is the accessible text, e.g.
 * "3 of 4 sites covered"; the bar itself is decoration.
 */
export function Meter({ value, label, tone = 'accent' }) {
  const pct = Math.round(Math.max(0, Math.min(1, value ?? 0)) * 100);
  return (
    <span className={`meter meter--${tone}`} role="img" aria-label={label}>
      <span className="meter__fill" style={{ width: `${pct}%` }} />
    </span>
  );
}
