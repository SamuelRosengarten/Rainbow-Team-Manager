import { useState } from 'react';
import Icon from './Icon.jsx';
import OperatorIcon from './OperatorIcon.jsx';
import { OPERATORS_BY_ID } from '../lib/operators.js';
import { MAPS_BY_ID } from '../lib/maps.js';
import { STATS_CONFIGURED, STATS_REASON } from '../lib/statsProvider.js';
import {
  PLATFORMS,
  PLAYER_ROLES,
  bestOperators,
  fmtPct,
  fmtRatio,
  inferRole,
  rankLabel,
  strongMaps,
  teamSnapshot,
  timeAgo,
  weakMaps,
} from '../lib/playerStats.js';
import { useI18n } from '../i18n/index.js';

const mapName = (id) => MAPS_BY_ID[id]?.name ?? id;

/** The few numbers that help coaching, nothing else. */
function Essentials({ stats }) {
  const { t } = useI18n();
  const items = [
    [fmtRatio(stats.kd), 'K/D'],
    [fmtPct(stats.winRate), t('playerStats.winRate')],
    [fmtPct(stats.hsPct), 'HS%'],
    [stats.matches ?? '', t('playerStats.matches')],
  ].filter(([v]) => v !== '' && v !== null);
  return (
    <>
      {stats.rank && <p className="pstats__rank">{rankLabel(stats)}</p>}
      {items.length > 0 && (
        <dl className="pstats__nums">
          {items.map(([v, label]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}

/**
 * Compact stats for one player: rank, K/D, win rate, HS%, matches, best
 * operators and maps; the rest behind "View detailed stats". With no stats it
 * says so ("Stats unavailable") and keeps the player fully usable.
 * `onRefresh` re-runs the lookup from the saved username (no re-entry).
 */
export default function PlayerStats({ player, onRefresh }) {
  const { t } = useI18n();
  const { stats } = player;
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  async function refresh() {
    setBusy(true);
    setProblem('');
    try {
      const res = await onRefresh();
      if (!res.ok) setProblem(STATS_REASON[res.reason] ?? STATS_REASON.unavailable);
    } catch (e) {
      setProblem(e.message || t('playerStats.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  const refreshRow = STATS_CONFIGURED && player.username && onRefresh && (
    <div className="pstats__refresh">
      {stats && player.statsUpdatedAt && (
        <span className="muted small">{t('playerStats.updated', { when: timeAgo(player.statsUpdatedAt) || t('playerStats.earlier') })}</span>
      )}
      <button type="button" className="btn btn--ghost btn--sm" onClick={refresh} disabled={busy} aria-label={t('playerStats.refreshFor', { player: player.name })}>
        <Icon name="refresh" size={15} /> {busy ? t('playerStats.refreshing') : t('playerStats.refresh')}
      </button>
    </div>
  );

  if (!stats) {
    if (!player.username) return null;
    return (
      <div className="pstats pstats--empty">
        <span className="eyebrow">{t('playerStats.stats')}</span>
        <span className="pstats__none">{t('playerStats.noData')}</span>
        <span className="muted small">{STATS_CONFIGURED ? t('playerStats.statsUnavailable') : t('playerStats.noSourceShort')}</span>
        {refreshRow}
        {problem && (
          <p className="muted small" role="status">
            {problem}
          </p>
        )}
      </div>
    );
  }

  const ops = bestOperators(stats, { limit: 3 });
  const best = strongMaps(stats, 3);
  const weak = weakMaps(stats, 3);
  const role = inferRole(stats);
  return (
    <div className="pstats">
      <Essentials stats={stats} />
      {ops.length > 0 && (
        <p className="pstats__line">
          <span className="pstats__label">{t('playerStats.bestOperators')}</span>
          {ops.map((o) => (
            <span key={o.id} className="pstats__op">
              <OperatorIcon operator={OPERATORS_BY_ID[o.id]} size="xs" /> {OPERATORS_BY_ID[o.id].name}
            </span>
          ))}
        </p>
      )}
      {best.length > 0 && (
        <p className="pstats__line">
          <span className="pstats__label">{t('playerStats.bestMaps')}</span> {best.map((m) => mapName(m.id)).join(' • ')}
        </p>
      )}
      <details className="pstats__more">
        <summary>{t('playerStats.viewDetailedStats')}</summary>
        <div className="pstats__detail">
          <p className="muted small">
            {PLATFORMS[stats.platform]} · {stats.username}
            {role && ` · ${t('playerStats.playsRole', { role: PLAYER_ROLES[role].toLowerCase() })}`}
          </p>
          {(stats.attack || stats.defense) && (
            <p className="pstats__line">
              <span className="pstats__label">{t('playerStats.attackDefense')}</span>
              {[
                [t('playerStats.attack'), stats.attack],
                [t('playerStats.defense'), stats.defense],
              ]
                .filter(([, s]) => s)
                .map(([label, s]) => (
                  <span key={label}>
                    {t('playerStats.splitLine', { label, parts: [fmtRatio(s.kd) && t('playerStats.kdPart', { kd: fmtRatio(s.kd) }), fmtPct(s.winRate) && t('playerStats.winsPart', { win: fmtPct(s.winRate) })].filter(Boolean).join(', ') })}
                  </span>
                ))}
            </p>
          )}
          {weak.length > 0 && (
            <p className="pstats__line">
              <span className="pstats__label">{t('playerStats.needsImprovement')}</span> {weak.map((m) => mapName(m.id)).join(' • ')}
            </p>
          )}
          {stats.operators.length > 0 && (
            <table className="pstats__table">
              <caption className="visually-hidden">{t('playerStats.operatorPerformance')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('playerStats.operator')}</th>
                  <th scope="col">K/D</th>
                  <th scope="col">{t('playerStats.wins')}</th>
                  <th scope="col">{t('playerStats.games')}</th>
                </tr>
              </thead>
              <tbody>
                {[...stats.operators]
                  .sort((a, b) => b.matches - a.matches)
                  .slice(0, 8)
                  .map((o) => (
                    <tr key={o.id}>
                      <th scope="row">{OPERATORS_BY_ID[o.id].name}</th>
                      <td>{fmtRatio(o.kd) || '–'}</td>
                      <td>{fmtPct(o.winRate) || '–'}</td>
                      <td>{o.matches}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </details>
      {refreshRow}
      {problem && (
        <p className="muted small" role="status">
          {t('playerStats.lastSaved', { problem })}
        </p>
      )}
    </div>
  );
}

/** Compact team table: who is strong where, at a glance. Hidden until anyone has stats. */
export function TeamSnapshot({ players }) {
  const { t } = useI18n();
  const rows = teamSnapshot(players);
  if (!rows.some((r) => r.hasStats)) return null;
  return (
    <section className="snapshot" aria-labelledby="snapshot-title">
      <h2 id="snapshot-title" className="snapshot__title">
        {t('playerStats.teamSnapshot')}
      </h2>
      <table className="snapshot__table">
        <thead>
          <tr>
            <th scope="col">{t('playerStats.player')}</th>
            <th scope="col">{t('playerStats.rank')}</th>
            <th scope="col">K/D</th>
            <th scope="col">{t('playerStats.bestRole')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <th scope="row">{r.name}</th>
              <td>{r.rank || '–'}</td>
              <td>{r.kd === null ? '–' : fmtRatio(r.kd)}</td>
              <td>{r.roleLabel || '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
