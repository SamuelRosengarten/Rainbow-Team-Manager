import OperatorIcon from './OperatorIcon.jsx';
import { OPERATORS_BY_ID, operatorsForSide } from '../lib/operators.js';

/**
 * Five rows of player + operator. Players and operators are picked
 * separately so a strategy can be reused when the roster changes.
 */
export default function CompositionPicker({ side, picks, players, onChange }) {
  const ops = operatorsForSide(side);
  const set = (i, patch) => onChange(picks.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <ol className="comp">
      {picks.map((p, i) => {
        const op = OPERATORS_BY_ID[p.operatorId];
        const takenOps = new Set(picks.filter((_, j) => j !== i).map((x) => x.operatorId));
        const takenPlayers = new Set(picks.filter((_, j) => j !== i).map((x) => x.player));
        return (
          <li key={i} className="comp__row">
            <OperatorIcon key={op?.id ?? 'none'} operator={op} size="md" />
            <label className="comp__field">
              <span className="visually-hidden">Player {i + 1}</span>
              <select className="select" value={p.player ?? ''} onChange={(e) => set(i, { player: e.target.value || null })}>
                <option value="">Player…</option>
                {players.map((name) => (
                  <option key={name} value={name} disabled={takenPlayers.has(name)}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="comp__field">
              <span className="visually-hidden">Operator for player {i + 1}</span>
              <select className="select" value={p.operatorId ?? ''} onChange={(e) => set(i, { operatorId: e.target.value || null })}>
                <option value="">Operator…</option>
                {ops.map((o) => (
                  <option key={o.id} value={o.id} disabled={takenOps.has(o.id)}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          </li>
        );
      })}
    </ol>
  );
}
