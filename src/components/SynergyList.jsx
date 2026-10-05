import OperatorIcon from './OperatorIcon.jsx';
import { OPERATORS_BY_ID } from '../lib/operators.js';
import { compositionSynergies, suggestedPartners } from '../lib/synergy.js';

function Pair({ ids, label, text }) {
  const [a, b] = ids.map((id) => OPERATORS_BY_ID[id]);
  return (
    <li className="synergy">
      <span className="synergy__ops" aria-hidden="true">
        <OperatorIcon operator={a} size="sm" />
        <span className="synergy__plus">+</span>
        <OperatorIcon operator={b} size="sm" />
      </span>
      <span className="synergy__body">
        <span className="synergy__names">
          {a.name} + {b.name}
        </span>
        <span className="synergy__label">{label}</span>
        {text && <span className="synergy__text">{text}</span>}
      </span>
    </li>
  );
}

/**
 * Synergies inside a composition, and (with `side`) operators that would
 * pair with it. `onAdd(id)` makes suggestions clickable.
 */
export default function SynergyList({ ops, side, onAdd, pref = null, compact = false }) {
  const pairs = compositionSynergies(ops);
  // Blocked operators are never suggested; favorites come first.
  const suggestions = side ? suggestedPartners(ops, side, 4, pref) : [];
  if (!pairs.length && !suggestions.length) return null;
  return (
    <section className={`synergies${compact ? ' synergies--compact' : ''}`} aria-label="Operator synergy">
      {pairs.length > 0 && (
        <>
          <h3 className="section-title">Synergy in this squad</h3>
          <ul className="synergy-list">
            {pairs.map((p) => (
              <Pair key={p.ops.join('+')} ids={p.ops} label={p.label} text={compact ? '' : p.text} />
            ))}
          </ul>
        </>
      )}
      {suggestions.length > 0 && (
        <>
          <h3 className="section-title">Pairs well with your picks</h3>
          <ul className="partner-list">
            {suggestions.map((s) => {
              const op = OPERATORS_BY_ID[s.id];
              const why = s.pairs.map((p) => `${p.label} with ${OPERATORS_BY_ID[p.with].name}`).join(' · ');
              const body = (
                <>
                  <OperatorIcon operator={op} size="sm" />
                  <span>
                    <strong>
                      {s.favorite && <span aria-label="Favorite">★ </span>}
                      {op.name}
                    </strong>
                    <span className="partner__why">{why}</span>
                  </span>
                </>
              );
              return (
                <li key={s.id}>
                  {onAdd ? (
                    <button type="button" className="partner" onClick={() => onAdd(s.id)}>
                      {body}
                    </button>
                  ) : (
                    <span className="partner">{body}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
