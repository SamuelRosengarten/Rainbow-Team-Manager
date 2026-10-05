import { useEffect, useState } from 'react';
import { copyText } from '../lib/clipboard.js';

export default function CopyButton({ getText, disabled, label = 'Copy lineup' }) {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    if (!status) return undefined;
    const t = setTimeout(() => setStatus(null), 2000);
    return () => clearTimeout(t);
  }, [status]);

  return (
    <>
      <button
        type="button"
        className="btn btn--secondary"
        disabled={disabled}
        onClick={async () => setStatus((await copyText(getText())) ? 'Copied!' : 'Copy failed')}
      >
        {status ?? label}
      </button>
      <span className="visually-hidden" aria-live="polite">{status}</span>
    </>
  );
}
