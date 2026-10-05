import OperatorIcon from './OperatorIcon.jsx';
import { OPERATORS_BY_ID, operatorsForSide } from '../lib/operators.js';
import { useRoster } from '../state/roster-context.js';

/**
 * Five rows of player + operator. Players and operators are picked
 * separately so a strategy can be reused when the roster changes. Each row
 * marks that player's favorites (★) and can't pick what they blocked (🚫).
 */
export default function CompositionPicker({ side, picks, players, onChange }) {
  const { prefs = {}, bans = [] } = useRoster();
  const banned = new Set(bans);
  const ops = operatorsForSide(side);
  const set = (i, patch) => onChange(picks.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <ol className="comp">
      {picks.map((p, i) => {
        const op = OPERATORS_BY_ID[p.operatorId];
        const takenOps = new Set(picks.filter((_, j) => j !== i).map((x) => x.operatorId));
        const takenPlayers = new Set(picks.filter((_, j) => j !== i).map((x) => x.player));
        const favs = new Set(prefs[p.player]?.favorites ?? []);
        const blocked = new Set(prefs[p.player]?.avoid ?? []);
        const isBlocked = op && (blocked.has(op.id) || banned.has(op.id));
        return (
          <li key={i} className={`comp__row${isBlocked ? ' comp__row--blocked' : ''}`}>
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
                {[...ops]
                  .sort((a, b) => Number(favs.has(b.id)) - Number(favs.has(a.id)))
                  .map((o) => {
                    const no = blocked.has(o.id) || banned.has(o.id);
                    return (
                      <option key={o.id} value={o.id} disabled={takenOps.has(o.id) || no}>
                        {favs.has(o.id) ? '★ ' : no ? '🚫 ' : ''}
                        {o.name}
                        {no ? (banned.has(o.id) ? ' (banned)' : ' (blocked)') : ''}
                      </option>
                    );
                  })}
              </select>
            </label>
            {isBlocked && <span className="comp__warn">🚫 {p.player ? `${p.player} blocked ${op.name}` : 'Banned'}</span>}
          </li>
        );
      })}
    </ol>
  );
}
