import { useEffect, useState } from 'react';
import { copyText } from '../lib/clipboard.js';
import { useI18n } from '../i18n/index.js';

export default function CopyButton({ getText, disabled, label }) {
  const { t } = useI18n();
  const [status, setStatus] = useState(null); // null | 'ok' | 'failed'
  useEffect(() => {
    if (!status) return undefined;
    const timer = setTimeout(() => setStatus(null), 2000);
    return () => clearTimeout(timer);
  }, [status]);
  const shown = status ? t(status === 'ok' ? 'copy.copied' : 'copy.failed') : null;

  return (
    <>
      <button
        type="button"
        className="btn btn--secondary"
        disabled={disabled}
        onClick={async () => setStatus((await copyText(getText())) ? 'ok' : 'failed')}
      >
        {shown ?? label ?? t('copy.lineup')}
      </button>
      <span className="visually-hidden" aria-live="polite">{shown}</span>
    </>
  );
}
