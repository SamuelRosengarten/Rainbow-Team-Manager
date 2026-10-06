import { useState } from 'react';
import Notice from './Notice.jsx';
import TacticDiagram from './TacticDiagram.jsx';
import { MAPS_BY_ID } from '../lib/maps.js';
import { ROLE_LABEL, checkFit, filterTactics, rerollToFit, rollTactic } from '../lib/fit.js';
import { msg, useI18n } from '../i18n/index.js';

// Deterministic matching so the covered-role chips don't shuffle on every render.
const STABLE_RNG = () => 0;

/**
 * Current tactic for the selected map/side/site, its role-fit check against
 * the lineup, and the "re-roll to fit" action.
 */
export default function TacticPanel({ team, updateTeam, tactics, lineup, players, operators, operatorsById, rollOptions, onRerolled }) {
  const { t } = useI18n();
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
      setError(msg('tacticPanel.noTactics', { side }));
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
    setInfo(res.rerolled.length ? msg('tacticPanel.rerolled', { players: res.rerolled }) : msg('tacticPanel.alreadyFits'));
    onRerolled(res.lineup, res.rerolled);
  }

  const mapName = MAPS_BY_ID[mapId]?.name;
  const where = mapName ? `${mapName}${site ? ` · ${site}` : ''}` : t('tacticPanel.where.any');

  return (
    <section className="panel" aria-labelledby="tactic-title">
      <div className="panel__head">
        <h2 id="tactic-title" className="panel__title">{t('tacticPanel.tactic')}</h2>
        <button type="button" className="btn btn--secondary btn--sm" onClick={roll}>
          {tactic ? t('tacticPanel.rollAnother') : t('tacticPanel.rollTactic')}
        </button>
      </div>
      <p className="panel__sub">
        {t(fallback ? (mapId ? 'tacticPanel.countGenericNone' : 'tacticPanel.countGeneric') : 'tacticPanel.countMatching', { count: candidates.length, where })}
      </p>
      <Notice onDismiss={() => setError('')}>{error}</Notice>
      {info && <Notice kind="ok" onDismiss={() => setInfo('')}>{info}</Notice>}

      {!tactic ? (
        <p className="empty">{t('tacticPanel.noTacticPickedRollOne')}</p>
      ) : (
        <article className="tactic">
          <h3 className="tactic__name">
            {tactic.name}
            {tactic.example && <span className="tag tag--example">{t('tacticPanel.example')}</span>}
          </h3>
          <p className="tactic__meta muted">
            {tactic.mapId === 'any' ? t('tacticPanel.anyMap') : MAPS_BY_ID[tactic.mapId]?.name ?? tactic.mapId}
            {tactic.site ? ` · ${tactic.site}` : ''}
            {tactic.owner ? t('tacticPanel.by', { owner: tactic.owner }) : t('tacticPanel.team')}
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
                {t('tacticPanel.requiredRoles')}{' '}
                {fit && (
                  <span className={fit.fits ? 'fit__ok' : 'fit__bad'}>
                    {fit.fits ? t('tacticPanel.teamFits') : t('tacticPanel.missingCount', { count: fit.missing.length })}
                  </span>
                )}
              </h4>
              <ul className="fit__roles">
                {fit
                  ? [
                      ...fit.covered.map((c, i) => (
                        <li key={`c${i}`} className="role role--covered">
                          {t('tacticPanel.roleCovered', { role: ROLE_LABEL[c.role], player: c.player })}
                        </li>
                      )),
                      ...fit.missing.map((r, i) => (
                        <li key={`m${i}`} className="role role--missing">
                          {t('tacticPanel.roleMissing', { role: ROLE_LABEL[r] })}
                        </li>
                      )),
                    ]
                  : tactic.requiredRoles.map((r, i) => (
                      <li key={i} className={`role role--${r}`}>{ROLE_LABEL[r]}</li>
                    ))}
              </ul>
              {!lineup && <p className="muted">{t('tacticPanel.rollTheLineupToCheck')}</p>}
              {fit && !fit.fits && (
                <button type="button" className="btn btn--primary btn--sm fit__btn" onClick={fitLineup}>
                  {t('tacticPanel.reRollToFit')}
                </button>
              )}
            </div>
          )}
        </article>
      )}
    </section>
  );
}
