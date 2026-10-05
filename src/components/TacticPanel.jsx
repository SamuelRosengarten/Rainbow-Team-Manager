import { useState } from 'react';
import Notice from './Notice.jsx';
import TacticDiagram from './TacticDiagram.jsx';
import { MAPS_BY_ID } from '../lib/maps.js';
import { ROLE_LABEL, checkFit, filterTactics, rerollToFit, rollTactic } from '../lib/fit.js';

// Deterministic matching so the covered-role chips don't shuffle on every render.
const STABLE_RNG = () => 0;

/**
 * Current tactic for the selected map/side/site, its role-fit check against
 * the lineup, and the "re-roll to fit" action.
 */
export default function TacticPanel({ team, updateTeam, tactics, lineup, players, operators, operatorsById, rollOptions, onRerolled }) {
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const { side, mapId, site, tacticId, bans } = team;
  const criteria = { side, mapId, site };
  const { tactics: candidates, fallback } = filterTactics(tactics, criteria);
  const tactic = tactics.find((t) => t.id === tacticId && t.side === side) ?? null;
  const fit = tactic && lineup
    ? checkFit({ lineup, players, operatorsById, requiredRoles: tactic.requiredRoles, rng: STABLE_RNG })
    : null;

  function roll() {
    const { tactic: next } = rollTactic(tactics, criteria, Math.random, tacticId);
    setError('');
    setInfo('');
    if (!next) {
      setError(`No ${side === 'attack' ? 'attack' : 'defense'} tactics for this map yet, and no generic ones either. Add one on the Tactics tab.`);
      return;
    }
    updateTeam({ tacticId: next.id });
  }

  function fitLineup() {
    const res = rerollToFit({
      lineup,
      players,
      operators,
      operatorsById,
      side,
      bans,
      requiredRoles: tactic.requiredRoles,
      ...rollOptions,
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError('');
    setInfo(res.rerolled.length ? `Re-rolled ${res.rerolled.join(', ')}.` : 'Lineup already fits.');
    onRerolled(res.lineup, res.rerolled);
  }

  const mapName = MAPS_BY_ID[mapId]?.name;
  const where = mapName ? `${mapName}${site ? ` · ${site}` : ''}` : 'any map';

  return (
    <section className="panel" aria-labelledby="tactic-title">
      <div className="panel__head">
        <h2 id="tactic-title" className="panel__title">Tactic</h2>
        <button type="button" className="btn btn--secondary btn--sm" onClick={roll}>
          {tactic ? 'Roll another' : 'Roll tactic'}
        </button>
      </div>
      <p className="panel__sub">
        {candidates.length} {fallback ? 'generic' : 'matching'} tactic{candidates.length === 1 ? '' : 's'} for {where}
        {fallback && mapId ? ' (none specific to this map/site yet)' : ''}
      </p>
      <Notice onDismiss={() => setError('')}>{error}</Notice>
      {info && <Notice kind="ok" onDismiss={() => setInfo('')}>{info}</Notice>}

      {!tactic ? (
        <p className="empty">No tactic picked. Roll one once you’ve chosen a map and site.</p>
      ) : (
        <article className="tactic">
          <h3 className="tactic__name">
            {tactic.name}
            {tactic.example && <span className="tag tag--example">example</span>}
          </h3>
          <p className="tactic__meta muted">
            {tactic.mapId === 'any' ? 'Any map' : MAPS_BY_ID[tactic.mapId]?.name ?? tactic.mapId}
            {tactic.site ? ` · ${tactic.site}` : ''}
            {tactic.owner ? ` · by ${tactic.owner}` : ' · team'}
          </p>
          {tactic.description && <p className="tactic__desc">{tactic.description}</p>}
          <TacticDiagram
            tactic={{ ...tactic, site: tactic.site || site }}
            lineup={lineup}
            players={players}
            operatorsById={operatorsById}
            mapName={MAPS_BY_ID[tactic.mapId]?.name ?? mapName}
          />

          {tactic.requiredRoles.length > 0 && (
            <div className="fit">
              <h4 className="fit__title">
                Required roles{' '}
                {fit && (
                  <span className={fit.fits ? 'fit__ok' : 'fit__bad'}>
                    {fit.fits ? '✓ Team fits' : `✕ Missing ${fit.missing.length}`}
                  </span>
                )}
              </h4>
              <ul className="fit__roles">
                {fit
                  ? [
                      ...fit.covered.map((c, i) => (
                        <li key={`c${i}`} className="role role--covered">
                          {ROLE_LABEL[c.role]} · {c.player}
                        </li>
                      )),
                      ...fit.missing.map((r, i) => (
                        <li key={`m${i}`} className="role role--missing">
                          {ROLE_LABEL[r]} · missing
                        </li>
                      )),
                    ]
                  : tactic.requiredRoles.map((r, i) => (
                      <li key={i} className={`role role--${r}`}>{ROLE_LABEL[r]}</li>
                    ))}
              </ul>
              {!lineup && <p className="muted">Roll the lineup to check the fit.</p>}
              {fit && !fit.fits && (
                <button type="button" className="btn btn--primary btn--sm fit__btn" onClick={fitLineup}>
                  Re-roll to fit
                </button>
              )}
            </div>
          )}
        </article>
      )}
    </section>
  );
}
