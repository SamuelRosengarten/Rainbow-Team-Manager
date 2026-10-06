import { useEffect, useMemo, useRef, useState } from 'react';
import BoardEditor from './BoardEditor.jsx';
import Icon from './Icon.jsx';
import LineupCoach from './LineupCoach.jsx';
import OwnedOnlyNote from './OwnedOnlyNote.jsx';
import OperatorIcon from './OperatorIcon.jsx';
import PrefBadge from './PrefBadge.jsx';
import RecommendationCard from './RecommendationCard.jsx';
import SynergyList from './SynergyList.jsx';
import TacticalBoard from './TacticalBoard.jsx';
import { DetailsForm, StepsForm } from './StrategyForms.jsx';
import { ROLES, ROLE_LABEL } from '../lib/fit.js';
import { parseSite } from '../lib/diagram.js';
import { floorIdFromSite, floorPlan } from '../lib/floorPlans.js';
import { MAPS, MAPS_BY_ID, allSites } from '../lib/maps.js';
import { OPERATORS, OPERATORS_BY_ID, operatorsForSide } from '../lib/operators.js';
import { rollLineup } from '../lib/roll.js';
import { STRATEGY_TYPES, cleanDraft, createStrategy, duplicateStrategy, filterStrategies, newId, normalizeStrategy, slotColor } from '../lib/strategies.js';
import { isUnowned, prefState, prefWho, recommendStrategies, whereFavoritesFit } from '../lib/recommend.js';
import { fitToComposition } from '../lib/strategyMatch.js';
import { recommendLineup } from '../lib/lineup.js';
import { usePreferences } from '../state/usePreferences.js';
import { TACTICAL_ROLES, defaultTacticalRole } from '../lib/tactical.js';
import { useHistory } from '../state/useHistory.js';
import { useRoster } from '../state/roster-context.js';
import { useSessionState } from '../state/useSessionState.js';

const STEPS = ['Map', 'Site', 'Side', 'Operators', 'Players', 'Start from', 'Customize', 'Tactics', 'Steps', 'Save'];
const KEY = 'r6tp.builder';
// Operator grid order: favorites first, blocked last.
const PREF_ORDER = { favorite: 0, null: 1, partial: 1, blocked: 2 };

const fresh = (preset = {}) => {
  const step = preset.mapId ? (preset.site !== undefined ? (preset.side ? 4 : 3) : 2) : 1;
  return {
    step,
    reached: step,
    mapId: '',
    site: '',
    side: '',
    ops: [null, null, null, null, null],
    players: {}, // operatorId -> player
    roles: {}, // operatorId -> tactical role
    draft: null,
    ...preset,
  };
};

/** Wizard header: ten numbered steps; reached ones are clickable. */
function Stepper({ step, reached, hasDraft, go }) {
  const listRef = useRef(null);
  // Keep the current step in view when the list scrolls sideways on a phone.
  useEffect(() => {
    listRef.current?.querySelector('[aria-current="step"]')?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
  }, [step]);
  return (
    <>
    <p className="stepper__summary" aria-live="polite">
      Step {step} of {STEPS.length}: {STEPS[step - 1]}
    </p>
    <ol className="stepper" aria-label="Builder steps" ref={listRef}>
      {STEPS.map((label, i) => {
        const n = i + 1;
        const can = n <= reached && (n <= 6 || hasDraft);
        return (
          <li key={label} className={`stepper__item${n === step ? ' stepper__item--on' : ''}${n < step ? ' stepper__item--done' : ''}`}>
            <button
              type="button"
              aria-disabled={!can || undefined}
              title={can ? undefined : 'Finish the earlier steps first'}
              onClick={() => can && go(n)}
              aria-current={n === step ? 'step' : undefined}
            >
              <span className="stepper__n">{n < step ? <Icon name="check" size={13} /> : n}</span>
              <span className="stepper__label">{label}</span>
              {!can && <span className="visually-hidden"> (finish the earlier steps first)</span>}
            </button>
          </li>
        );
      })}
    </ol>
    </>
  );
}

function ChoiceGrid({ children, className = '' }) {
  return <ul className={`choice-grid ${className}`}>{children}</ul>;
}

/** Steps 7–10 edit the draft with undo/redo; changes are mirrored to the wizard. */
function DraftSteps({ step, initial, onChange, strategyData, mapName, onSave, saving, error, nav }) {
  const history = useHistory(initial);
  const draft = history.value;
  useEffect(() => {
    onChange(draft);
  }, [draft, onChange]);
  return (
    <>
      {step === 7 && (
        <section className="panel">
          <h2 className="panel__title">Customize</h2>
          <DetailsForm draft={draft} set={history.set} compact />
        </section>
      )}
      {step === 8 && (
        <>
          <p className="muted small">
            Place players, routes, utility, breaches, areas and crossfires. Pick <strong>Who</strong> and <strong>When</strong> first: new objects belong to that operator and step.
          </p>
          <BoardEditor draft={draft} history={history} mapName={mapName} />
        </>
      )}
      {step === 9 && (
        <section className="panel">
          <h2 className="panel__title">Steps and timing</h2>
          <StepsForm draft={draft} set={history.set} />
        </section>
      )}
      {step === 10 && (
        <section className="panel review">
          <h2 className="panel__title">Review and save</h2>
          <div className="review__grid">
            <TacticalBoard strategy={draft} mapName={mapName} />
            <div>
              <p className="review__title">{draft.title || 'Untitled strategy'}</p>
              <p className="muted small">
                {mapName || 'Any map'} {draft.site ? `· ${draft.site}` : ''} · {draft.side === 'attack' ? 'Attack' : 'Defense'} · {STRATEGY_TYPES[draft.type]}
              </p>
              <ul className="squad squad--compact">
                {draft.slots.map((s) => {
                  const op = OPERATORS_BY_ID[s.operatorId];
                  return (
                    <li key={s.key} className="squad__row" style={{ '--slot': slotColor(draft, s.key) }}>
                      <span className="squad__who">
                        <OperatorIcon key={op?.id ?? 'none'} operator={op} size="sm" />
                        <span className="squad__id">
                          <span className="squad__op">{op?.name ?? 'Any'}</span>
                          <span className="role-tag">{TACTICAL_ROLES[s.tacticalRole]}</span>
                        </span>
                      </span>
                      <span className="muted small">{nav.players[s.operatorId] ?? 'Unassigned'}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="muted small">
                {draft.steps.length} steps · {draft.markers.length} objects · {draft.paths.length} routes · {draft.zones.length} areas · {draft.crossfires.length} crossfires
              </p>
            </div>
          </div>
          {!draft.title.trim() && <p className="notice notice--warn">Give the strategy a title in Customize before saving.</p>}
          {error && (
            <p className="notice notice--error" role="alert">
              {error}
            </p>
          )}
          <button type="button" className="btn btn--primary btn--lg" onClick={() => onSave(draft)} disabled={saving || !draft.title.trim() || !strategyData.canSave}>
            <Icon name="check" size={20} /> {saving ? 'Saving…' : 'Save to team library'}
          </button>
        </section>
      )}
    </>
  );
}

/**
 * The Strategy Builder: map → site → side → five operators → players →
 * start from a library strategy (adapted to our operators) or a blank board
 * → customize → tactics on the map → steps and timing → save.
 */
export default function StrategyBuilder({ profile, strategyData, navigate, preset, prefs, ownedOnly, updateTeam }) {
  const { players: roster, lineupPlayers, roster: rosterEntries } = useRoster();
  const [w, setW] = useSessionState(KEY, () => fresh());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [roleFilter, setRoleFilter] = useState('');
  // Favorites and blocks of the starting five (or the viewer's own).
  const pref = usePreferences(lineupPlayers);

  // A link like #/build/<map>/<site>/<side> starts a new build there, then
  // drops back to #/build so a refresh doesn't restart it.
  const presetKey = preset ? JSON.stringify(preset) : '';
  useEffect(() => {
    if (!presetKey) return;
    setW(fresh(JSON.parse(presetKey)));
    navigate('build');
  }, [presetKey, setW, navigate]);

  const set = (patch) => setW((x) => ({ ...x, ...(typeof patch === 'function' ? patch(x) : patch) }));
  const go = (n) => set((x) => ({ step: n, reached: Math.max(x.reached, n) }));
  const next = () => go(w.step + 1);
  const ops = w.ops.filter(Boolean);
  const map = MAPS_BY_ID[w.mapId];
  const sites = w.mapId ? allSites(w.mapId) : [];

  const { ranked, excluded } = useMemo(() => {
    if (!w.side) return { ranked: [], excluded: [] };
    const list = filterStrategies(strategyData.strategies, { mapId: w.mapId || undefined, site: w.site || undefined, side: w.side }).filter((s) => s.slots.length);
    const res = recommendStrategies(list, { pref, selected: ops, mapId: w.mapId, site: w.site });
    return { ranked: res.ranked.slice(0, 12), excluded: res.excluded };
  }, [strategyData.strategies, w.mapId, w.site, w.side, ops, pref]);

  // The coach: best-fitting library plan for this map, site and side, with
  // who should play which operator. Needs only the map and side; stats and
  // roles sharpen it when the players have them.
  const coach = useMemo(() => {
    if (!w.side || !w.mapId) return null;
    const list = filterStrategies(strategyData.strategies, { mapId: w.mapId, site: w.site || undefined, side: w.side }).filter((s) => s.slots.length);
    const strategy = recommendStrategies(list, { pref, selected: [], mapId: w.mapId, site: w.site }).ranked[0]?.strategy ?? null;
    const players = lineupPlayers.map((n) => rosterEntries.find((p) => p.name === n)).filter(Boolean);
    return {
      strategy,
      lineup: recommendLineup({ strategy, side: w.side, mapId: w.mapId, site: w.site, players, prefs, pref, ownedOnly }),
    };
  }, [strategyData.strategies, w.mapId, w.site, w.side, pref, lineupPlayers, rosterEntries, prefs, ownedOnly]);

  const applyCoachLineup = () => {
    const picked = coach.lineup.slots.filter((s) => s.operatorId).slice(0, 5);
    set((x) => ({
      ops: [...picked.map((s) => s.operatorId), null, null, null, null, null].slice(0, 5),
      players: Object.fromEntries(picked.filter((s) => s.player).map((s) => [s.operatorId, s.player])),
      roles: Object.fromEntries(picked.map((s) => [s.operatorId, s.job])),
      step: 6,
      reached: Math.max(x.reached, 6),
    }));
  };

  const toggleOp = (id) =>
    set((x) => {
      if (x.ops.includes(id)) return { ops: x.ops.map((o) => (o === id ? null : o)) };
      if (prefState(pref, id) === 'blocked') return {};
      const i = x.ops.indexOf(null);
      return i < 0 ? {} : { ops: x.ops.map((o, j) => (j === i ? id : o)) };
    });

  const roll = () => {
    const res = rollLineup({ players: lineupPlayers, operators: OPERATORS, side: w.side, bans: [...pref.banned], prefs, ownedOnly });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError('');
    const picked = lineupPlayers.map((p) => res.lineup[p]);
    set({ ops: [...picked, null, null, null, null, null].slice(0, 5), players: Object.fromEntries(lineupPlayers.map((p) => [res.lineup[p], p])) });
  };

  const roleOf = (id) => w.roles[id] ?? defaultTacticalRole(OPERATORS_BY_ID[id]?.roles?.[0], w.side);

  const start = (base, rec = null) => {
    let draft;
    if (base) {
      const { subs, extras } = fitToComposition(base, ops);
      // Never keep a blocked operator: slots our five don't cover take the
      // engine's replacement.
      for (const b of rec?.blockedReplaced ?? []) if (!subs[b.slotKey]) subs[b.slotKey] = b.replacement;
      const copy = duplicateStrategy(base, { owner: profile, subs });
      draft = normalizeStrategy({
        ...copy,
        title: base.origin === 'team' ? `${base.title} (copy)` : base.title,
        mapId: w.mapId || copy.mapId,
        site: w.site || copy.site,
        slots: [...copy.slots, ...extras.map((id) => ({ key: newId('s'), operatorId: id, role: OPERATORS_BY_ID[id].roles[0] }))].slice(0, 6),
      });
    } else {
      draft = createStrategy({
        title: 'New strategy',
        origin: 'team',
        side: w.side,
        mapId: w.mapId || 'any',
        site: w.site,
        owner: profile,
        slots: ops.map((id, i) => ({ key: `s${i + 1}`, operatorId: id, role: OPERATORS_BY_ID[id].roles[0] })),
      });
      draft.title = '';
    }
    draft.slots = draft.slots.map((s) => (s.operatorId && ops.includes(s.operatorId) ? { ...s, tacticalRole: roleOf(s.operatorId) } : s));
    set((x) => ({ draft, step: 7, reached: Math.max(x.reached, 7) }));
  };

  const save = async (draft) => {
    setError('');
    setSaving(true);
    try {
      const clean = cleanDraft(draft);
      await strategyData.saveStrategy({ ...clean, owner: profile });
      await Promise.all(
        clean.slots
          .filter((s) => w.players[s.operatorId])
          .map((s) => strategyData.setAssignment(clean.id, s.key, w.players[s.operatorId]).catch(() => null)),
      );
      setW(fresh());
      navigate(`strategies/s/${clean.id}`);
    } catch (e) {
      setError(e.message || 'Could not save the strategy.');
      setSaving(false);
    }
  };

  // Why Next is blocked, in words (null when it isn't).
  const nextBlock =
    { 1: !w.mapId && 'Pick a map to continue', 3: !w.side && 'Pick attack or defense to continue', 4: ops.length < 1 && 'Pick at least one operator to continue' }[w.step] ||
    (w.step >= 6 && !w.draft ? 'Choose a starting point to continue' : null);
  const canNext = !nextBlock;
  const summary = [map?.name, w.site && parseSite(w.site).rooms.join(' / '), w.side && (w.side === 'attack' ? 'Attack' : 'Defense')].filter(Boolean).join(' · ');

  return (
    <section className="page builder" aria-labelledby="builder-title">
      <header className="page__head">
        <div>
          <p className="page__kicker">Strategy builder</p>
          <h1 id="builder-title" className="page__title">
            {STEPS[w.step - 1]}
          </h1>
          {summary && <p className="page__sub">{summary}</p>}
        </div>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => {
            if (!w.draft || window.confirm('Start over? The strategy you are building will be discarded.')) setW(fresh());
          }}
        >
          <Icon name="refresh" size={16} /> Start over
        </button>
      </header>

      <Stepper step={w.step} reached={w.reached} hasDraft={Boolean(w.draft)} go={go} />
      {error && w.step < 10 && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}

      {w.step === 1 && (
        <ChoiceGrid className="choice-grid--maps">
          {MAPS.map((m) => {
            const count = strategyData.strategies.filter((s) => s.mapId === m.id).length;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  className="choice choice--map"
                  aria-pressed={w.mapId === m.id}
                  onClick={() => set((x) => ({ mapId: m.id, site: x.mapId === m.id ? x.site : '', step: 2, reached: Math.max(x.reached, 2) }))}
                >
                  <span className="choice__name">{m.name}</span>
                  <span className="choice__meta">
                    {m.sites.attack.length ? `${m.sites.attack.length} sites` : 'No sites listed: plan without a site'} · {count} {count === 1 ? 'strategy' : 'strategies'}
                  </span>
                </button>
              </li>
            );
          })}
        </ChoiceGrid>
      )}

      {w.step === 2 && !sites.length && (
        <p className="notice notice--info" role="status">
          {map?.name} has no bomb sites listed yet, so this plan won't be tied to a site. You can still choose the side, pick operators and draw the plan.
        </p>
      )}
      {w.step === 2 && (
        <ChoiceGrid>
          {sites.map((s) => {
            const { floor, rooms } = parseSite(s);
            const plan = floorPlan(w.mapId, floorIdFromSite(s));
            return (
              <li key={s}>
                <button type="button" className="choice choice--site" aria-pressed={w.site === s} onClick={() => set((x) => ({ site: s, step: 3, reached: Math.max(x.reached, 3) }))}>
                  {plan && <img className="choice__plan" src={plan.url} alt="" loading="lazy" />}
                  <span className="choice__floor">{floor}</span>
                  <span className="choice__name">{rooms.join(' / ')}</span>
                </button>
              </li>
            );
          })}
          <li>
            <button type="button" className="choice choice--site" aria-pressed={w.site === '' && w.reached > 2} onClick={() => set((x) => ({ site: '', step: 3, reached: Math.max(x.reached, 3) }))}>
              <span className="choice__name">{sites.length ? 'Any site' : 'No sites listed: continue'}</span>
              <span className="choice__meta">A plan that isn't tied to one site</span>
            </button>
          </li>
        </ChoiceGrid>
      )}

      {w.step === 3 && (
        <ChoiceGrid className="choice-grid--sides">
          {[
            ['attack', 'Attack', 'Drones, breaches, execute, plant and post-plant', 'swords'],
            ['defend', 'Defense', 'Site setup, reinforcements, roams, utility and retakes', 'shield'],
          ].map(([id, label, sub, icon]) => (
            <li key={id}>
              <button
                type="button"
                className={`choice choice--side choice--${id}`}
                aria-pressed={w.side === id}
                onClick={() => set((x) => ({ side: id, ops: x.side === id ? x.ops : [null, null, null, null, null], step: 4, reached: Math.max(x.reached, 4) }))}
              >
                <Icon name={icon} size={34} />
                <span className="choice__name">{label}</span>
                <span className="choice__meta">{sub}</span>
              </button>
            </li>
          ))}
        </ChoiceGrid>
      )}

      {w.step === 4 && (
        <div className="op-step">
          <OwnedOnlyNote pref={pref} updateTeam={updateTeam} players={lineupPlayers} />
          <LineupCoach lineup={coach?.lineup} strategy={coach?.strategy} onUse={applyCoachLineup} />
          <div className="picked" aria-label="Your five operators">
            {w.ops.map((id, i) => {
              const op = OPERATORS_BY_ID[id];
              return (
                <button key={i} type="button" className={`picked__slot${op ? '' : ' picked__slot--empty'}`} onClick={() => op && toggleOp(id)} aria-label={op ? `Remove ${op.name}` : `Empty slot ${i + 1}`}>
                  <OperatorIcon key={id ?? `e${i}`} operator={op} size="lg" />
                  <span>{op?.name ?? `Slot ${i + 1}`}</span>
                </button>
              );
            })}
            <button type="button" className="btn btn--secondary" onClick={roll}>
              <Icon name="dice" size={18} /> Roll for the starters
            </button>
          </div>
          <div className="op-filter" role="group" aria-label="Filter by role">
            <button type="button" className="step-chip" aria-pressed={!roleFilter} onClick={() => setRoleFilter('')}>
              All
            </button>
            {ROLES.map((r) => (
              <button key={r} type="button" className="step-chip" aria-pressed={roleFilter === r} onClick={() => setRoleFilter(r)}>
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>
          <ul className="pick-grid">
            {operatorsForSide(w.side)
              .filter((o) => !roleFilter || o.roles.includes(roleFilter))
              .sort((a, b) => PREF_ORDER[prefState(pref, a.id)] - PREF_ORDER[prefState(pref, b.id)])
              .map((o) => {
                const on = w.ops.includes(o.id);
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      className={`op-tile${prefState(pref, o.id) ? ` op-tile--${prefState(pref, o.id)}` : ''}`}
                      aria-pressed={on}
                      disabled={(!on && ops.length >= 5) || (!on && (prefState(pref, o.id) === 'blocked' || isUnowned(pref, o.id)))}
                      title={prefWho(pref, o.id) || undefined}
                      onClick={() => toggleOp(o.id)}
                    >
                      <OperatorIcon operator={o} size="lg" />
                      <span className="op-tile__name">{o.name}</span>
                      <PrefBadge pref={pref} id={o.id} />
                    </button>
                  </li>
                );
              })}
          </ul>
          <SynergyList ops={ops} side={w.side} pref={pref} onAdd={ops.length < 5 ? toggleOp : undefined} />
        </div>
      )}

      {w.step === 5 && (
        <section className="panel">
          <div className="panel__head">
            <h2 className="panel__title">Who plays what</h2>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => set((x) => ({ players: Object.fromEntries(x.ops.filter(Boolean).map((id, i) => [id, x.players[id] ?? lineupPlayers[i] ?? null])) }))}
            >
              Fill with starters
            </button>
          </div>
          <ul className="assign">
            {ops.map((id) => {
              const op = OPERATORS_BY_ID[id];
              const taken = new Set(Object.entries(w.players).filter(([k, p]) => k !== id && p).map(([, p]) => p));
              return (
                <li key={id} className="assign__row">
                  <OperatorIcon operator={op} size="lg" />
                  <span className="assign__op">{op.name}</span>
                  <label className="field">
                    <span className="field__label">Player</span>
                    <select className="select" value={w.players[id] ?? ''} onChange={(e) => set((x) => ({ players: { ...x.players, [id]: e.target.value || null } }))}>
                      <option value="">Unassigned</option>
                      {roster.map((p) => (
                        <option key={p} value={p} disabled={taken.has(p)}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span className="field__label">Tactical role</span>
                    <select className="select" value={roleOf(id)} onChange={(e) => set((x) => ({ roles: { ...x.roles, [id]: e.target.value } }))}>
                      {Object.entries(TACTICAL_ROLES).map(([r, l]) => (
                        <option key={r} value={r}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {w.step === 6 && (
        <div className="start-from">
          {w.draft && (
            <p className="notice notice--warn">
              You already started “{w.draft.title || 'a strategy'}”.{' '}
              <button type="button" className="link-btn" onClick={() => go(7)}>
                Continue it
              </button>{' '}
              or pick a new starting point below (that replaces it).
            </p>
          )}
          <ul className="strat-list">
            <li className="strat-card strat-card--blank">
              <button type="button" className="strat-card__main" onClick={() => start(null)}>
                <span className="strat-card__top">
                  <span className="strat-card__title">
                    <Icon name="plus" size={18} /> Blank tactical board
                  </span>
                </span>
                <span className="strat-card__meta">Start from scratch with your {ops.length} operators.</span>
              </button>
            </li>
            {ranked.map((item, i) => (
              <RecommendationCard
                key={item.strategy.id}
                strategy={item.strategy}
                rec={item.rec}
                pref={pref}
                top={i === 0}
                fits={whereFavoritesFit(ranked, item)}
                onOpen={() => start(item.strategy, item.rec)}
              />
            ))}
          </ul>
          {!ranked.length && <p className="muted">No strategies in the library for this map, site and side yet. Start from a blank board.</p>}
          {excluded.length > 0 && (
            <p className="muted small">
              {excluded.length} more need a blocked operator with no replacement, so they're not offered: {excluded.map((x) => x.strategy.title).join(', ')}.
            </p>
          )}
          <p className="muted small">Starting from a strategy adapts it to your operators. The original stays as it is.</p>
        </div>
      )}

      {w.step >= 7 && w.draft && (
        <DraftSteps
          key={w.draft.id}
          step={w.step}
          initial={w.draft}
          onChange={(d) => setW((x) => (x.draft === d ? x : { ...x, draft: d }))}
          strategyData={strategyData}
          mapName={map?.name ?? ''}
          onSave={save}
          saving={saving}
          error={error}
          nav={w}
        />
      )}

      {w.step !== 10 && (
        <div className={`strat-actions builder__nav${w.step === 8 ? '' : ' strat-actions--sticky'}`}>
          <button type="button" className="btn btn--ghost" onClick={() => go(Math.max(1, w.step - 1))} disabled={w.step === 1}>
            <Icon name="chevron" size={18} className="icon--flip" /> Back
          </button>
          {w.step !== 6 && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => canNext && next()}
              aria-disabled={!canNext || undefined}
              aria-describedby={nextBlock ? 'builder-next-hint' : undefined}
            >
              Next: {STEPS[w.step]} <Icon name="arrow" size={18} />
            </button>
          )}
          {nextBlock && (
            <p id="builder-next-hint" className="builder__hint" role="status">
              {nextBlock}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
