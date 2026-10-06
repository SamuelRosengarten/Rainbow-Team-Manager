import OperatorIcon from './OperatorIcon.jsx';
import { OPERATORS_BY_ID, operatorsForSide } from '../lib/operators.js';
import { useI18n } from '../i18n/index.js';
import { useRoster } from '../state/roster-context.js';

/**
 * Five rows of player + operator. Players and operators are picked
 * separately so a strategy can be reused when the roster changes. Each row
 * marks that player's favourites (★) and can't pick what they blocked (🚫).
 * With owned operators only on, a player's list is limited to what they own, and
 * a pick they don't own is flagged with a one-tap fix (`fixes`: player -> operator).
 */
export default function CompositionPicker({ side, picks, players, onChange, fixes = {} }) {
  const { t } = useI18n();
  const { prefs = {}, bans = [], ownedOnly = false } = useRoster();
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
        // Owned-only: this player's list is limited to what they own (when they've marked any).
        const owned = new Set(prefs[p.player]?.owned ?? []);
        const limited = ownedOnly && owned.size > 0;
        const isBlocked = op && (blocked.has(op.id) || banned.has(op.id));
        const fixOp = OPERATORS_BY_ID[fixes[p.player]];
        return (
          <li key={i} className={`comp__row${isBlocked ? ' comp__row--blocked' : ''}`}>
            <OperatorIcon key={op?.id ?? 'none'} operator={op} size="md" />
            <label className="comp__field">
              <span className="visually-hidden">{t('comp.player', { n: i + 1 })}</span>
              <select className="select" value={p.player ?? ''} onChange={(e) => set(i, { player: e.target.value || null })}>
                <option value="">{t('comp.playerPlaceholder')}</option>
                {players.map((name) => (
                  <option key={name} value={name} disabled={takenPlayers.has(name)}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="comp__field">
              <span className="visually-hidden">{t('comp.operator', { n: i + 1 })}</span>
              <select className="select" value={p.operatorId ?? ''} onChange={(e) => set(i, { operatorId: e.target.value || null })}>
                <option value="">{t('comp.operatorPlaceholder')}</option>
                {[...ops]
                  .filter((o) => !limited || owned.has(o.id) || o.id === p.operatorId)
                  .sort((a, b) => Number(favs.has(b.id)) - Number(favs.has(a.id)))
                  .map((o) => {
                    const no = blocked.has(o.id) || banned.has(o.id);
                    const note = no ? t(banned.has(o.id) ? 'comp.banned' : 'comp.blocked') : limited && !owned.has(o.id) ? t('comp.notOwned') : '';
                    return (
                      <option key={o.id} value={o.id} disabled={takenOps.has(o.id) || no}>
                        {favs.has(o.id) ? '★ ' : no ? '🚫 ' : ''}
                        {o.name}
                        {note ? ` (${note})` : ''}
                      </option>
                    );
                  })}
              </select>
            </label>
            {!isBlocked && op && limited && !owned.has(op.id) && (
              <span className="comp__warn">
                ⚠ {t('comp.unownedWarn', { player: p.player, operator: op.name })}
                {fixOp && fixOp.id !== op.id && (
                  <>
                    {' '}
                    <button type="button" className="btn btn--secondary btn--sm" onClick={() => set(i, { operatorId: fixOp.id })}>
                      {t('finder.warn.useOperator', { player: p.player, operator: fixOp.name })}
                    </button>
                  </>
                )}
              </span>
            )}
            {isBlocked && <span className="comp__warn">🚫 {p.player ? t('comp.playerBlocked', { player: p.player, operator: op.name }) : t('comp.bannedWarn')}</span>}
          </li>
        );
      })}
    </ol>
  );
}
