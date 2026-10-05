export default function Notice({ kind = 'error', children, onDismiss }) {
  if (!children) return null;
  return (
    <div className={`notice notice--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <span>{children}</span>
      {onDismiss && (
        <button type="button" className="btn btn--ghost btn--sm" onClick={onDismiss} aria-label="Dismiss message">
          ✕
        </button>
      )}
    </div>
  );
}
