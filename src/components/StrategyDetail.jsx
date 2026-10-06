import { useMemo, useState } from 'react';
import ExecuteTimeline from './ExecuteTimeline.jsx';
import Icon from './Icon.jsx';
import Notice from './Notice.jsx';
import { ObjectCard } from './ObjectInspector.jsx';
import OperatorIcon from './OperatorIcon.jsx';
import SynergyList from './SynergyList.jsx';
import TacticalBoard from './TacticalBoard.jsx';
import { FitStars, OriginBadge } from './StrategyCard.jsx';
import { liveStepId } from '../lib/board.js';
import { ROLE_LABEL } from '../lib/fit.js';
import { MAPS_BY_ID } from '../lib/maps.js';
import { OPERATORS_BY_ID } from '../lib/operators.js';
import {
  DIFFICULTY,
  ORIGINS,
  STRATEGY_TYPES,
  adaptStrategy,
  attribution,
  canEditStrategy,
  duplicateStrategy,
  familyOf,
  newVersion,
  slotColor,
} from '../lib/strategies.js';
import { recommendStrategy } from '../lib/recommend.js';
import { autoAssign, matchStrategy, substitutionsFor } from '../lib/strategyMatch.js';
import { usePreferences } from '../state/usePreferences.js';
import { TACTICAL_ROLES, slotAction } from '../lib/tactical.js';
import { t as translate, tm, useI18n } from '../i18n/index.js';
import { T } from '../i18n/Rich.jsx';

const opName = (id) => OPERATORS_BY_ID[id]?.name ?? translate('card.anyOperator');
// Blocked-by lists mix player names with the team ban.
const byNames = (by) => by.map((x) => (x === 'team ban' ? translate('detail.teamBan') : x));

/**
 * A strategy that needs a blocked operator: say so, and offer the engine's
 * replacement. Blocked operators are never used silently.
 */
function BlockedPanel({ rec, subs, setSubs }) {
  const { t } = useI18n();
  const open = rec.blockedReplaced.filter((b) => subs[b.slotKey] !== b.replacement);
  if (!open.length && !rec.blockedMissing.length) return null;
  return (
    <section className="adapt adapt--blocked" aria-labelledby="blocked-title">
      <div className="adapt__head">
        <h3 id="blocked-title" className="section-title">{t('strategyDetail.needsAnOperatorNobodyHere')}</h3>
        {open.length > 1 && (
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => setSubs({ ...subs, ...Object.fromEntries(open.map((b) => [b.slotKey, b.replacement])) })}>
            {t('strategyDetail.useTheAdaptedStrategy')}
          </button>
        )}
      </div>
      <ul className="adapt__list">
        {open.map((b) => (
          <li key={b.slotKey} className="adapt__item adapt__item--missing">
            <span>
              <T id="detail.blocked.replace" values={{ operator: opName(b.blocked), by: byNames(b.by), replacement: opName(b.replacement) }} />
            </span>
            <button type="button" className="btn btn--primary btn--sm" onClick={() => setSubs({ ...subs, [b.slotKey]: b.replacement })}>
              {t('detail.blocked.use', { operator: opName(b.replacement) })}
            </button>
          </li>
        ))}
        {rec.blockedMissing.map((b) => (
          <li key={b.slotKey} className="adapt__item adapt__item--missing">
            <span>
              <T id="detail.blocked.none" values={{ operator: opName(b.blocked), by: byNames(b.by) }} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AdaptPanel({ match, subs, setSubs, strategy }) {
  const { t } = useI18n();
  const pending = [...match.substitutes, ...match.missing].filter((x) => !subs[x.slotKey]);
  const applied = Object.entries(subs);
  if (!pending.length && !applied.length) return null;
  const all = substitutionsFor(match);
  return (
    <section className="adapt" aria-labelledby="adapt-title">
      <div className="adapt__head">
        <h3 id="adapt-title" className="section-title">{t('strategyDetail.adaptToYourOperators')}</h3>
        {match.substitutes.some((x) => !subs[x.slotKey]) && (
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => setSubs({ ...subs, ...all })}>
            {t('strategyDetail.useAllSuggestions')}
          </button>
        )}
      </div>
      <ul className="adapt__list">
        {match.substitutes
          .filter((x) => !subs[x.slotKey])
          .map((x) => (
            <li key={x.slotKey} className="adapt__item">
              <span>
                <T
                  id={x.reason === 'listed' ? 'detail.adapt.listed' : 'detail.adapt.sameRole'}
                  values={{ required: opName(x.required), replacement: opName(x.replacement), role: ROLE_LABEL[OPERATORS_BY_ID[x.replacement]?.roles?.[0]] ?? t('strategyDetail.similar') }}
                />
              </span>
              <button type="button" className="btn btn--primary btn--sm" onClick={() => setSubs({ ...subs, [x.slotKey]: x.replacement })}>
                {t('detail.blocked.use', { operator: opName(x.replacement) })}
              </button>
            </li>
          ))}
        {match.missing
          .filter((x) => !subs[x.slotKey])
          .map((x) => (
            <li key={x.slotKey} className="adapt__item adapt__item--missing">
              <span>
                <T id="detail.adapt.missing" values={{ required: opName(x.required), role: ROLE_LABEL[x.role] }} />{' '}
                {x.suggestions.length > 0 && t('strategyDetail.suggestedAlternatives')}
              </span>
              <span className="adapt__choices">
                {x.suggestions.map((id) => (
                  <button key={id} type="button" className="btn btn--ghost btn--sm" onClick={() => setSubs({ ...subs, [x.slotKey]: id })}>
                    {opName(id)}
                  </button>
                ))}
              </span>
            </li>
          ))}
        {applied.map(([key, id]) => {
          const slot = strategy.slots.find((s) => s.key === key);
          return (
            <li key={key} className="adapt__item adapt__item--done">
              <span>
                <Icon name="check" size={16} /> {t('detail.adapt.done', { operator: opName(id), original: opName(slot?.operatorId) })}
              </span>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  const next = { ...subs };
                  delete next[key];
                  setSubs(next);
                }}
              >
                {t('strategyDetail.undo')}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Step chips plus previous / next. */
export function StepScrubber({ steps, stepId, setStepId, allLabel }) {
  const { t } = useI18n();
  const i = steps.findIndex((s) => s.id === stepId);
  return (
    <div className="scrubber">
      <button type="button" className="btn btn--ghost btn--icon" aria-label={t('strategyDetail.previousStep')} disabled={i < 0} onClick={() => setStepId(i <= 0 ? null : steps[i - 1].id)}>
        <Icon name="chevron" size={18} className="icon--flip" />
      </button>
      <div className="step-chips" role="group" aria-label={t('strategyDetail.showStep')}>
        <button type="button" className="step-chip" aria-pressed={!stepId} onClick={() => setStepId(null)}>
          {allLabel ?? t('ui.all')}
        </button>
        {steps.map((s, n) => (
          <button key={s.id} type="button" className="step-chip" aria-pressed={stepId === s.id} onClick={() => setStepId(s.id)}>
            <span className="step-chip__n">{n + 1}</span>
            {s.clock && <span className="step-chip__clock">{s.clock}</span>} {s.title}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="btn btn--ghost btn--icon"
        aria-label={t('strategyDetail.nextStep')}
        disabled={i >= steps.length - 1}
        onClick={() => setStepId(steps[i + 1]?.id ?? null)}
      >
        <Icon name="chevron" size={18} />
      </button>
    </div>
  );
}

/**
 * One strategy: the tactical board by step, who plays what, steps and
 * timing; adapt, version, favourite, compare, and open coach/player mode.
 */
export default function StrategyDetail({ strategy, picks, profile, strategyData, navigate }) {
  const { t } = useI18n();
  const [subs, setSubs] = useState({});
  const [pickedStepId, setStepId] = useState(null);
  const [slotKey, setSlotKey] = useState(null);
  const [inspect, setInspect] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const players = picks.map((p) => p.player).filter(Boolean);
  const pref = usePreferences(players);
  const match = useMemo(() => matchStrategy(strategy, picks.map((p) => p.operatorId).filter(Boolean), pref), [strategy, picks, pref]);
  const rec = useMemo(() => recommendStrategy(strategy, { pref, selected: picks.map((p) => p.operatorId).filter(Boolean), picks }), [strategy, picks, pref]);
  const { strategy: view, warnings } = useMemo(() => adaptStrategy(strategy, subs), [strategy, subs]);
  const saved = strategyData.assignments[strategy.id] ?? {};
  const assigned = autoAssign(view, picks, saved);
  const mapName = strategy.mapId === 'any' ? '' : MAPS_BY_ID[strategy.mapId]?.name;
  const stepId = liveStepId(view.steps, pickedStepId);
  const step = view.steps.find((s) => s.id === stepId);
  const editable = canEditStrategy(strategy, profile);
  const isTeam = strategy.origin === 'team' && !strategy.builtin;
  const adapted = Object.keys(subs).length > 0;
  const versions = isTeam ? familyOf(strategyData.strategies, strategy) : [];
  const base = `strategies/s/${strategy.id}`;

  const guard = async (fn) => {
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e.message || t('common.wentWrong'));
    } finally {
      setBusy(false);
    }
  };

  const copyAssignments = (toId) =>
    Promise.all(
      Object.entries(assigned)
        .filter(([, p]) => p)
        .map(([key, p]) => strategyData.setAssignment(toId, key, p)),
    );

  const duplicate = () =>
    guard(async () => {
      const copy = duplicateStrategy(strategy, { owner: profile, subs });
      await strategyData.saveStrategy(copy);
      await copyAssignments(copy.id);
      navigate(`strategies/s/${copy.id}/edit`);
    });

  const version = () =>
    guard(async () => {
      const next = newVersion(view, strategyData.strategies, { owner: profile });
      await strategyData.saveStrategy(next);
      await copyAssignments(next.id);
      navigate(`strategies/s/${next.id}/edit`);
    });

  const toggleFavorite = () => guard(() => strategyData.saveStrategy({ ...strategy, favorite: !strategy.favorite }));

  return (
    <article className="sview" aria-labelledby="strat-title">
      <button type="button" className="btn btn--ghost btn--sm back-btn" onClick={() => navigate('strategies')}>
        <Icon name="chevron" size={16} className="icon--flip" /> {t('strategyDetail.strategyLibrary')}
      </button>

      <header className="sview__head">
        <div className="sview__title-row">
          <div>
            <p className="eyebrow sview__where">
              {[mapName || t('strategyDetail.anyMap'), strategy.site].filter(Boolean).join(' / ')}
            </p>
            <h1 id="strat-title" className="page__title sview__title">
              {view.title}
            </h1>
            <div className="sview__chips">
              <span className={`side-tag side-tag--${strategy.side}`}>{strategy.side === 'attack' ? t('strategyDetail.attack') : t('strategyDetail.defense')}</span>
              <span className="type-tag">{STRATEGY_TYPES[strategy.type]}</span>
              <OriginBadge strategy={strategy} />
              {isTeam && <span className="version-chip">v{strategy.version}</span>}
              <span className="sview__fact">{DIFFICULTY[strategy.difficulty]}</span>
              <span className="sview__fact">{t('detail.operators', { count: view.slots.filter((x) => x.operatorId).length })}</span>
              {view.steps.length > 0 && <span className="sview__fact">{t('detail.phases', { count: view.steps.length })}</span>}
              {match.scored && picks.some((p) => p.operatorId) && <FitStars match={match} />}
            </div>
            {view.timing && <p className="sview__timing">{view.timing}</p>}
          </div>
          {isTeam && (
            <button
              type="button"
              className={`fav-btn${strategy.favorite ? ' fav-btn--on' : ''}`}
              aria-pressed={strategy.favorite}
              onClick={toggleFavorite}
              disabled={busy || !strategyData.canSave}
              title={t(strategy.favorite ? 'detail.favRemove' : 'detail.favAdd')}
            >
              <Icon name="star" size={22} />
              <span className="visually-hidden">{t('strategyDetail.favourite')}</span>
            </button>
          )}
        </div>

        <div className="sview__actions">
          <button type="button" className="btn btn--primary" onClick={() => navigate(`${base}/coach`)} disabled={!view.steps.length}>
            <Icon name="play" size={18} /> {t('strategyDetail.coachMode')}
          </button>
          <button type="button" className="btn btn--secondary" onClick={() => navigate(`${base}/player`)} disabled={!view.slots.length}>
            <Icon name="user" size={18} /> {t('strategyDetail.playerView')}
          </button>
          {editable && strategy.origin === 'team' && (
            <button type="button" className="btn btn--secondary" onClick={() => navigate(`${base}/edit`)} disabled={busy}>
              <Icon name="edit" size={18} /> {t('strategyDetail.edit')}
            </button>
          )}
          {isTeam && (
            <button type="button" className="btn btn--ghost" onClick={version} disabled={busy || !strategyData.canSave}>
              <Icon name="layers" size={18} /> {t('strategyDetail.newVersion')}
            </button>
          )}
          <button type="button" className={`btn ${isTeam ? 'btn--ghost' : 'btn--secondary'}`} onClick={duplicate} disabled={busy || !strategyData.canSave}>
            <Icon name="copy" size={18} /> {isTeam ? t('strategyDetail.duplicate') : adapted ? t('strategyDetail.saveAdaptedCopy') : t('strategyDetail.saveToTeamLibrary')}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => navigate(`strategies/compare/${strategy.id}`)}>
            <Icon name="compare" size={18} /> {t('strategyDetail.compare')}
          </button>
          {editable && strategy.origin === 'reference' && (
            <button type="button" className="btn btn--ghost" onClick={() => navigate(`${base}/edit`)} disabled={busy}>
              {t('strategyDetail.editLink')}
            </button>
          )}
        </div>

        {strategy.origin !== 'suggested' && <p className="strat-detail__attr">{attribution(strategy)}</p>}
        {strategy.origin === 'reference' && strategy.sourceUrl && (
          <a className="source-box" href={strategy.sourceUrl} target="_blank" rel="noopener noreferrer">
            <span>
              <span className="source-box__label">{t('detail.source', { name: strategy.sourceName || t('strategyDetail.online') })}</span>
              <span className="source-box__title">{t('detail.original', { title: strategy.sourceTitle || strategy.sourceUrl })}</span>
            </span>
            <Icon name="external" />
            <span className="visually-hidden"> {t('strategyDetail.opensInANewTab')}</span>
          </a>
        )}
        {strategy.origin === 'suggested' && (
          <p className="notice notice--warn" role="note">
            <span>
              <strong>{t('strategyDetail.suggestedStartingPoint')}</strong> {ORIGINS.suggested.note}
            </span>
          </p>
        )}
        {versions.length > 1 && (
          <nav className="versions" aria-label={t('strategyDetail.versions')}>
            {versions.map((v) => (
              <button key={v.id} type="button" className="version-pill" aria-current={v.id === strategy.id ? 'page' : undefined} onClick={() => navigate(`strategies/s/${v.id}`)}>
                <strong>v{v.version}</strong> {v.versionNote || (v.version === 1 ? t('strategyDetail.original') : '')}
              </button>
            ))}
          </nav>
        )}
      </header>

      <Notice onDismiss={() => setError('')}>{error}</Notice>
      <BlockedPanel rec={rec} subs={subs} setSubs={setSubs} />
      {match.scored && !isTeam && picks.some((p) => p.operatorId) && <AdaptPanel match={match} subs={subs} setSubs={setSubs} strategy={strategy} />}
      {warnings.length > 0 && (
        <ul className="warn-list">
          {warnings.map((w, i) => (
            <li key={i}>
              <Icon name="alert" size={15} /> {tm(w)}
            </li>
          ))}
        </ul>
      )}
      {view.summary && <p className="strat-detail__summary">{view.summary}</p>}

      <div className="sview__grid">
        <section className="sview__board" aria-label={t('strategyDetail.tacticalBoard')}>
          {view.steps.length > 0 && <StepScrubber steps={view.steps} stepId={stepId} setStepId={setStepId} />}
          <TacticalBoard
            strategy={view}
            mapName={mapName}
            stepId={stepId}
            focusSlot={slotKey}
            selected={inspect}
            onItemClick={(item) => setInspect(inspect?.id === item.id ? null : item)}
          />
          {inspect && <ObjectCard strategy={view} selected={inspect} players={assigned} onClose={() => setInspect(null)} />}
          {view.boardImageUrl && (
            <p className="small">
              <a href={view.boardImageUrl} target="_blank" rel="noopener noreferrer">
                <Icon name="external" size={13} /> {t('strategyDetail.openTheImageAttachedTo')}
              </a>
            </p>
          )}
          {view.steps.some((x) => x.clock) && (
            <div className="round-clock">
              <span className="eyebrow">{t('detail.roundClock')}</span>
              <ExecuteTimeline strategy={view} stepId={stepId} onSelect={setStepId} />
            </div>
          )}
          {!view.markers.length && !view.paths.length && !view.zones.length && (
            <p className="muted small">
              {t('detail.emptyBoard')}{' '}
              {strategy.origin === 'reference'
                ? t('strategyDetail.theSourceDescribesTheStrategy')
                : editable
                  ? t('strategyDetail.editTheStrategyToPlan')
                  : t('strategyDetail.saveItToYourTeam')}
            </p>
          )}
          {step && (
            <div className="step-detail">
              <p className="step-detail__title">
                {t('timeline.step', { n: view.steps.indexOf(step) + 1, title: step.title })}
                {step.clock && <span className="clock-tag">{step.clock}</span>}
                {step.timing && <span className="muted small"> · {step.timing}</span>}
              </p>
              {step.description && <p>{step.description}</p>}
              {step.slots.length > 0 && (
                <ul className="brief-list">
                  {step.slots.map((k) => {
                    const s = view.slots.find((x) => x.key === k);
                    const op = OPERATORS_BY_ID[s?.operatorId];
                    const action = slotAction(view, step, k);
                    return (
                      <li key={k} className="brief" style={{ '--slot': slotColor(view, k) }}>
                        <OperatorIcon key={op?.id ?? 'none'} operator={op} size="sm" />
                        <span>
                          <strong>{opName(s?.operatorId)}</strong>
                          {assigned[k] ? <span className="muted"> · {assigned[k]}</span> : ''}
                          {action && <span className="brief__action">{action}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {step.utility && (
                <p className="small">
                  <strong>{t('strategyDetail.utility')}</strong> {step.utility}
                </p>
              )}
              {step.notes && <p className="small step-detail__note">{step.notes}</p>}
            </div>
          )}
        </section>

        <aside className="sview__side">
          {view.slots.length > 0 && (
            <section className="panel card--kicker" aria-labelledby="squad-title">
              <div className="panel__head">
                <h2 id="squad-title" className="panel__title">{t('strategyDetail.squad')}</h2>
                {!strategyData.canSave && <span className="muted small">{t('strategyDetail.assignmentsArenTSavedUntil')}</span>}
              </div>
              <ul className="squad">
                {view.slots.map((s) => {
                  const op = OPERATORS_BY_ID[s.operatorId];
                  const open = slotKey === s.key;
                  return (
                    <li key={s.key} className={`squad__row${open ? ' squad__row--open' : ''}`} style={{ '--slot': slotColor(view, s.key) }}>
                      <button type="button" className="squad__who" aria-expanded={open} onClick={() => setSlotKey(open ? null : s.key)}>
                        <OperatorIcon key={op?.id ?? 'none'} operator={op} size="md" />
                        <span className="squad__id">
                          <span className="squad__op">
                            {opName(s.operatorId)}
                            {s.defuser && <span className="defuser-tag" title={t('strategyDetail.defuserCarrier')}>{t('strategyDetail.defuser')}</span>}
                          </span>
                          <span className="role-tag">{TACTICAL_ROLES[s.tacticalRole]}</span>
                          {(step ? slotAction(view, step, s.key) : s.instructions[0]) && (
                            <span className="squad__task">{step ? slotAction(view, step, s.key) : s.instructions[0]}</span>
                          )}
                          {s.originalOperatorId && <span className="muted small">{t('detail.replaces', { operator: opName(s.originalOperatorId) })}</span>}
                        </span>
                      </button>
                      <label className="squad__player">
                        <span className="visually-hidden">{t('detail.playerFor', { operator: opName(s.operatorId) })}</span>
                        <select
                          className="select input--sm"
                          value={assigned[s.key] ?? ''}
                          onChange={(e) => guard(() => (strategyData.canSave ? strategyData.setAssignment(strategy.id, s.key, e.target.value || null) : Promise.resolve()))}
                          disabled={!strategyData.canSave}
                        >
                          <option value="">{t('strategyDetail.unassigned')}</option>
                          {players.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </label>
                      {open && (
                        <div className="squad__body">
                          {s.spawn && (
                            <p className="small">
                              <strong>{t('strategyDetail.spawn')}</strong> {s.spawn}
                            </p>
                          )}
                          {s.instructions.length ? (
                            <ol className="slot__steps">
                              {s.instructions.map((t, i) => (
                                <li key={i}>{t}</li>
                              ))}
                            </ol>
                          ) : (
                            <p className="muted small">{t('strategyDetail.noInstructionsForThisOperator')}</p>
                          )}
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate(`${base}/player/${s.key}`)}>
                            <Icon name="eye" size={16} /> {t('detail.openPlayer', { operator: opName(s.operatorId) })}
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="muted small">{t('strategyDetail.tapAnOperatorToHighlight')}</p>
            </section>
          )}
          <SynergyList ops={view.slots.map((s) => s.operatorId)} compact />
        </aside>
      </div>

      {view.steps.length > 0 && (
        <section className="panel card--kicker" aria-labelledby="steps-title">
          <h2 id="steps-title" className="panel__title steps-title">{t('strategyDetail.steps')}</h2>
          <ol className="step-list">
            {view.steps.map((s, i) => (
              <li key={s.id}>
                <button type="button" className="step-list__item" aria-pressed={stepId === s.id} onClick={() => setStepId(s.id)}>
                  <span className="step-list__n" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <span className="step-list__body">
                    <span className="step-list__top">
                      <strong className="step-list__title">{s.title}</strong>
                      {s.clock && <span className="clock-tag">{s.clock}</span>}
                    </span>
                    {s.timing && <span className="step-list__timing">{s.timing}</span>}
                    {s.description && <span className="step-list__desc">{s.description}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      {view.notes && (
        <section className="panel card--kicker coach-notes" aria-labelledby="snotes-title">
          <h2 id="snotes-title" className="panel__title steps-title">{t('strategyDetail.coachNotes')}</h2>
          <p className="notes-text">{view.notes}</p>
        </section>
      )}

      {strategyData.canSave && (
        <div className="strat-actions strat-actions--end">
          <button
            type="button"
            className="btn btn--danger btn--sm"
            disabled={busy}
            onClick={() => {
              const q = strategy.builtin
                ? t('detail.hideConfirm', { title: strategy.title })
                : t(isTeam ? 'detail.deleteConfirmVersion' : 'detail.deleteConfirm', { title: strategy.title, version: strategy.version });
              if (window.confirm(q))
                guard(async () => {
                  await strategyData.removeStrategy(strategy);
                  navigate('strategies');
                });
            }}
          >
            <Icon name="trash" size={16} /> {strategy.builtin ? t('strategyDetail.hideFromLibrary') : t('strategyDetail.delete')}
          </button>
        </div>
      )}
    </article>
  );
}
