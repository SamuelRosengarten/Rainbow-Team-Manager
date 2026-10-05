import { useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import Notice from './Notice.jsx';
import OperatorIcon from './OperatorIcon.jsx';
import StrategyBoard from './StrategyBoard.jsx';
import { MatchStars, OriginBadge } from './StrategyCard.jsx';
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
  slotColor,
} from '../lib/strategies.js';
import { autoAssign, matchStrategy, substitutionsFor } from '../lib/strategyMatch.js';

const opName = (id) => OPERATORS_BY_ID[id]?.name ?? 'Any operator';

function AdaptPanel({ match, subs, setSubs, strategy }) {
  const pending = [...match.substitutes, ...match.missing].filter((x) => !subs[x.slotKey]);
  const applied = Object.entries(subs);
  if (!pending.length && !applied.length) return null;
  const all = substitutionsFor(match);
  return (
    <section className="adapt" aria-labelledby="adapt-title">
      <div className="adapt__head">
        <h3 id="adapt-title" className="section-title">Adapt to your operators</h3>
        {match.substitutes.some((x) => !subs[x.slotKey]) && (
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => setSubs({ ...subs, ...all })}>
            Use all suggestions
          </button>
        )}
      </div>
      <ul className="adapt__list">
        {match.substitutes
          .filter((x) => !subs[x.slotKey])
          .map((x) => (
            <li key={x.slotKey} className="adapt__item">
              <span>
                <strong>{opName(x.required)}</strong> is in the original strategy. You picked{' '}
                <strong>{opName(x.replacement)}</strong>
                {x.reason === 'listed' ? ', a listed alternative.' : `, same role (${ROLE_LABEL[OPERATORS_BY_ID[x.replacement]?.roles?.[0]] ?? 'similar'}).`}
              </span>
              <button type="button" className="btn btn--primary btn--sm" onClick={() => setSubs({ ...subs, [x.slotKey]: x.replacement })}>
                Use {opName(x.replacement)}
              </button>
            </li>
          ))}
        {match.missing
          .filter((x) => !subs[x.slotKey])
          .map((x) => (
            <li key={x.slotKey} className="adapt__item adapt__item--missing">
              <span>
                <strong>{opName(x.required)}</strong> ({ROLE_LABEL[x.role]}) is needed and nobody in your composition fits.
                {x.suggestions.length > 0 && ' Suggested alternatives:'}
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
                <Icon name="check" size={16} /> {opName(id)} replaces {opName(slot?.operatorId)}.
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
                Undo
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * One strategy: source and fit, the tactical board by step, who plays which
 * slot, each operator's instructions, and adapting it to our operators.
 */
export default function StrategyDetail({ strategy, picks, profile, strategyData, navigate, onLoadIntoPlan }) {
  const [subs, setSubs] = useState({});
  const [stepId, setStepId] = useState(null);
  const [slotKey, setSlotKey] = useState(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const players = picks.map((p) => p.player).filter(Boolean);
  const match = useMemo(() => matchStrategy(strategy, picks.map((p) => p.operatorId).filter(Boolean)), [strategy, picks]);
  const { strategy: view, warnings } = useMemo(() => adaptStrategy(strategy, subs), [strategy, subs]);
  const saved = strategyData.assignments[strategy.id] ?? {};
  const assigned = autoAssign(view, picks, saved);
  const mapName = strategy.mapId === 'any' ? '' : MAPS_BY_ID[strategy.mapId]?.name;
  const step = view.steps.find((s) => s.id === stepId);
  const editable = canEditStrategy(strategy, profile);
  const adapted = Object.keys(subs).length > 0;

  const guard = async (fn) => {
    setError('');
    setInfo('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const duplicate = () =>
    guard(async () => {
      const copy = duplicateStrategy(strategy, { owner: profile, subs });
      await strategyData.saveStrategy(copy);
      // Carry the current player assignments over to the copy.
      await Promise.all(
        Object.entries(assigned)
          .filter(([, p]) => p)
          .map(([key, p]) => strategyData.setAssignment(copy.id, key, p)),
      );
      navigate(`tactics/s/${copy.id}/edit`);
    });

  return (
    <article className="strat-detail" aria-labelledby="strat-title">
      <button type="button" className="btn btn--ghost btn--sm back-btn" onClick={() => navigate('tactics')}>
        <Icon name="chevron" size={16} className="icon--flip" /> Strategies
      </button>

      <header className="strat-detail__head">
        <div className="strat-detail__badges">
          <OriginBadge strategy={strategy} />
          <span className="muted small">
            {mapName || 'Any map'}
            {strategy.site ? ` · ${strategy.site}` : ''} · {strategy.side === 'attack' ? 'Attack' : 'Defense'} · {STRATEGY_TYPES[strategy.type]} ·{' '}
            {DIFFICULTY[strategy.difficulty]}
          </span>
        </div>
        <h1 id="strat-title" className="page__title">
          {view.title}
        </h1>
        <p className="strat-detail__attr">{attribution(strategy)}</p>
        {strategy.origin === 'reference' && strategy.sourceUrl && (
          <a className="source-box" href={strategy.sourceUrl} target="_blank" rel="noopener noreferrer">
            <span>
              <span className="source-box__label">Source: {strategy.sourceName || 'Online'}</span>
              <span className="source-box__title">Original strategy: {strategy.sourceTitle || strategy.sourceUrl}</span>
            </span>
            <Icon name="external" />
            <span className="visually-hidden"> (opens in a new tab)</span>
          </a>
        )}
        {strategy.adaptedFrom && <p className="muted small">Original: “{strategy.adaptedFrom.title}” ({ORIGINS[strategy.adaptedFrom.origin].label.toLowerCase()})</p>}
        {strategy.origin === 'team' && strategy.sourceUrl && (
          <a className="player__link" href={strategy.sourceUrl} target="_blank" rel="noopener noreferrer">
            Source: {strategy.sourceName || strategy.sourceTitle || 'original'} <Icon name="external" size={14} />
          </a>
        )}
        {strategy.origin === 'suggested' && (
          <p className="notice notice--warn" role="note">
            <span>
              <strong>AI suggestion.</strong> {ORIGINS.suggested.note}
            </span>
          </p>
        )}
        <MatchStars match={match} />
      </header>

      <Notice onDismiss={() => setError('')}>{error}</Notice>
      {info && (
        <Notice kind="ok" onDismiss={() => setInfo('')}>
          {info}
        </Notice>
      )}

      {match.scored && <AdaptPanel match={match} subs={subs} setSubs={setSubs} strategy={strategy} />}
      {warnings.length > 0 && (
        <ul className="warn-list">
          {warnings.map((w) => (
            <li key={w}>
              <Icon name="alert" size={15} /> {w}
            </li>
          ))}
        </ul>
      )}

      {view.summary && <p className="strat-detail__summary">{view.summary}</p>}

      <section className="panel board-panel" aria-labelledby="board-title">
        <div className="panel__head">
          <h2 id="board-title" className="panel__title">Tactical board</h2>
          {view.timing && <span className="muted small">{view.timing}</span>}
        </div>
        {view.steps.length > 0 && (
          <div className="step-chips" role="group" aria-label="Show step">
            <button type="button" className="step-chip" aria-pressed={!stepId} onClick={() => setStepId(null)}>
              All
            </button>
            {view.steps.map((s, i) => (
              <button key={s.id} type="button" className="step-chip" aria-pressed={stepId === s.id} onClick={() => setStepId(s.id)}>
                <span className="step-chip__n">{i + 1}</span> {s.title}
              </button>
            ))}
          </div>
        )}
        <StrategyBoard strategy={view} mapName={mapName} stepId={stepId} selectedSlot={slotKey} onSelectSlot={setSlotKey} />
        {!view.markers.length && !view.paths.length && (
          <p className="muted small">
            No positions on this board yet.{' '}
            {strategy.origin === 'reference'
              ? 'The source only describes the strategy in text: duplicate it and place the markers yourself.'
              : editable
                ? 'Edit the strategy to place markers and paths.'
                : 'Duplicate it to place markers and paths.'}
          </p>
        )}
        {step && (
          <div className="step-detail">
            <p className="step-detail__title">
              Step {view.steps.indexOf(step) + 1}: {step.title}
              {step.timing && <span className="muted small"> · {step.timing}</span>}
            </p>
            {step.description && <p>{step.description}</p>}
            {step.slots.length > 0 && (
              <p className="step-detail__ops">
                {step.slots.map((k) => {
                  const s = view.slots.find((x) => x.key === k);
                  return (
                    <span key={k} className="slot-tag" style={{ '--slot': slotColor(view, k) }}>
                      {opName(s?.operatorId)}
                      {assigned[k] ? ` (${assigned[k]})` : ''}
                    </span>
                  );
                })}
              </p>
            )}
            {step.utility && (
              <p className="small">
                <strong>Utility:</strong> {step.utility}
              </p>
            )}
            {step.notes && <p className="small muted">{step.notes}</p>}
          </div>
        )}
      </section>

      {view.slots.length > 0 && (
        <section className="panel" aria-labelledby="slots-title">
          <div className="panel__head">
            <h2 id="slots-title" className="panel__title">Players and operators</h2>
            {!strategyData.canSave && <span className="muted small">Assignments aren't saved until the database is updated.</span>}
          </div>
          <ul className="slot-list">
            {view.slots.map((s) => {
              const op = OPERATORS_BY_ID[s.operatorId];
              const open = slotKey === s.key;
              return (
                <li key={s.key} className={`slot${open ? ' slot--open' : ''}`} style={{ '--slot': slotColor(view, s.key) }}>
                  <div className="slot__row">
                    <button type="button" className="slot__toggle" aria-expanded={open} onClick={() => setSlotKey(open ? null : s.key)}>
                      <span className="slot__dot" aria-hidden="true" />
                      <OperatorIcon key={op?.id ?? 'none'} operator={op} size="sm" />
                      <span className="slot__name">
                        {opName(s.operatorId)}
                        <span className="slot__role">
                          {ROLE_LABEL[s.role]}
                          {s.originalOperatorId ? ` · replaces ${opName(s.originalOperatorId)}` : ''}
                        </span>
                      </span>
                    </button>
                    <label className="slot__player">
                      <span className="visually-hidden">Player for {opName(s.operatorId)}</span>
                      <select
                        className="select input--sm"
                        value={assigned[s.key] ?? ''}
                        onChange={(e) =>
                          guard(() => (strategyData.canSave ? strategyData.setAssignment(strategy.id, s.key, e.target.value || null) : Promise.resolve()))
                        }
                        disabled={!strategyData.canSave}
                      >
                        <option value="">Unassigned</option>
                        {players.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {open && (
                    <div className="slot__body">
                      {s.spawn && (
                        <p className="small">
                          <strong>Spawn:</strong> {s.spawn}
                        </p>
                      )}
                      {s.instructions.length ? (
                        <ol className="slot__steps">
                          {s.instructions.map((t, i) => (
                            <li key={i}>{t}</li>
                          ))}
                        </ol>
                      ) : (
                        <p className="muted small">No instructions for this operator yet.</p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {view.steps.length > 0 && (
        <section className="panel" aria-labelledby="steps-title">
          <h2 id="steps-title" className="panel__title steps-title">Strategy steps</h2>
          <ol className="step-list">
            {view.steps.map((s, i) => (
              <li key={s.id}>
                <button type="button" className="step-list__item" aria-pressed={stepId === s.id} onClick={() => setStepId(s.id)}>
                  <span className="step-list__n">{i + 1}</span>
                  <span className="step-list__body">
                    <strong>{s.title}</strong>
                    {s.timing && <span className="muted small"> · {s.timing}</span>}
                    {s.description && <span className="step-list__desc">{s.description}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      {view.notes && (
        <section className="panel" aria-labelledby="snotes-title">
          <h2 id="snotes-title" className="panel__title steps-title">Notes</h2>
          <p className="notes-text">{view.notes}</p>
        </section>
      )}

      <div className="strat-actions">
        {view.slots.length > 0 && (
          <button type="button" className="btn btn--secondary" onClick={() => onLoadIntoPlan(view, assigned)} disabled={busy}>
            <Icon name="crosshair" size={18} /> Load into Plan
          </button>
        )}
        <button type="button" className="btn btn--primary" onClick={duplicate} disabled={busy || !strategyData.canSave}>
          <Icon name="edit" size={18} /> {adapted ? 'Save adapted copy' : 'Duplicate & customize'}
        </button>
        {editable && (
          <button type="button" className="btn btn--secondary" onClick={() => navigate(`tactics/s/${strategy.id}/edit`)} disabled={busy}>
            Edit
          </button>
        )}
        {strategyData.canSave && (
          <button
            type="button"
            className="btn btn--danger"
            disabled={busy}
            onClick={() => {
              const builtin = strategy.builtin;
              const q = builtin
                ? `Hide "${strategy.title}" from the library for everyone? You can show it again later.`
                : `Delete "${strategy.title}"? Everyone on the team loses it.`;
              if (window.confirm(q)) guard(async () => {
                await strategyData.removeStrategy(strategy);
                navigate('tactics');
              });
            }}
          >
            <Icon name="trash" size={18} /> {strategy.builtin ? 'Hide' : 'Delete'}
          </button>
        )}
      </div>
    </article>
  );
}
