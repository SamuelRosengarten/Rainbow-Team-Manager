import { useState } from 'react';
import { initials, operatorImage } from '../lib/operators.js';

/**
 * Operator portrait from public/operators/<id>.png, falling back to an
 * initials badge when the image is missing. Remount with key={id} on change.
 */
export default function OperatorIcon({ operator, size = 'md' }) {
  const [failed, setFailed] = useState(false);
  if (!operator) {
    return <span className={`op-icon op-icon--${size} op-icon--empty`} aria-hidden="true">?</span>;
  }
  const sideClass = `op-icon--${operator.side}`;
  if (failed) {
    return (
      <span className={`op-icon op-icon--${size} op-icon--fallback ${sideClass}`} aria-hidden="true">
        {initials(operator.name)}
      </span>
    );
  }
  return (
    <img
      className={`op-icon op-icon--${size} ${sideClass}`}
      src={operatorImage(operator.id)}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
