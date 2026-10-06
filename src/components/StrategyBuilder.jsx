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
import { findStrategies } from '../lib/finder.js';
import { usePreferences } from '../state/usePreferences.js';
import { TACTICAL_ROLES, defaultTacticalRole } from '../lib/tactical.js';
import { boardSpace } from '../lib/space.js';
import { unplacedSlots } from '../lib/tacticStatus.js';
import { useHistory } from '../state/useHistory.js';
import { useRoster } from '../state/roster-context.js';
import { useSessionState } from '../state/useSessionState.js';
import { tx, useI18n } from '../i18n/index.js';

// Step ids (names: builder.step.<id>).
const STEPS = ['map', 'site', 'side', 'operators', 'players', 'startFrom', 'customize', 'tactics', 'steps', 'save'];
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
  const { t } = useI18n();
  const listRef = useRef(null);
  // Keep the current step in view when the list scrolls sideways on a phone.
  useEffect(() => {
    listRef.current?.querySelector('[aria-current="step"]')?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
  }, [step]);
  return (
    <>
    <p className="stepper__summary" aria-live="polite">
      {t('builder.stepOf', { n: step, total: STEPS.length, name: t(`builder.step.${STEPS[step - 1]}`) })}
    </p>
    <ol className="stepper" aria-label={t('strategyBuilder.builderSteps')} ref={listRef}>
      {STEPS.map((stepId, i) => {
        const n = i + 1;
        const can = n <= reached && (n <= 6 || hasDraft);
        return (
          <li key={stepId} className={`stepper__item${n === step ? ' stepper__item--on' : ''}${n < step ? ' stepper__item--done' : ''}`}>
            <button
              type="button"
              aria-disabled={!can || undefined}
              title={can ? t(`builder.step.${stepId}`) : t('builder.locked')}
              onClick={() => can && go(n)}
              aria-current={n === step ? 'step' : undefined}
            >
              <span className="stepper__n">{n < step ? <Icon name="check" size={13} /> : n}</span>
              <span className="stepper__label">{t(`builder.step.${stepId}`)}</span>
              {n < step && <span className="visually-hidden"> {t('builder.stepDone')}</span>}
              {!can && <span className="visually-hidden"> {t('builder.locked')}</span>}
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
  const { t } = useI18n();
  const history = useHistory(initial);
  const draft = history.value;
  useEffect(() => {
    onChange(draft);
  }, [draft, onChange]);
  return (
    <>
      {step === 7 && (
        <section className="panel">
          <h2 className="panel__title">{t('strategyBuilder.customize')}</h2>
          <DetailsForm draft={draft} set={history.set} compact />
        </section>
      )}
      {step === 8 && (
        <BoardEditor draft={draft} history={history} mapName={mapName} inBuilder />
      )}
      {step === 9 && (
        <section className="panel">
          <h2 className="panel__title">{t('strategyBuilder.stepsAndTiming')}</h2>
          <StepsForm draft={draft} set={history.set} />
        </section>
      )}
      {step === 10 && (
        <section className="panel review">
          <h2 className="panel__title">{t('strategyBuilder.reviewAndSave')}</h2>
          <div className="review__grid">
            <TacticalBoard strategy={draft} mapName={mapName} />
            <div>
              <p className="review__title">{draft.title || t('strategyBuilder.untitledStrategy')}</p>
              <p className="muted small">
                {mapName || t('strategyBuilder.anyMap')} {draft.site ? `· ${draft.site}` : ''} · {draft.side === 'attack' ? t('strategyBuilder.attack') : t('strategyBuilder.defense')} · {STRATEGY_TYPES[draft.type]}
              </p>
              <ul className="squad squad--compact">
                {draft.slots.map((s) => {
                  const op = OPERATORS_BY_ID[s.operatorId];
                  return (
                    <li key={s.key} className="squad__row" style={{ '--slot': slotColor(draft, s.key) }}>
                      <span className="squad__who">
                        <OperatorIcon key={op?.id ?? 'none'} operator={op} size="sm" />
                        <span className="squad__id">
                          <span className="squad__op">{op?.name ?? t('strategyBuilder.any')}</span>
                          <span className="role-tag">{TACTICAL_ROLES[s.tacticalRole]}</span>
                        </span>
                      </span>
                      <span className="muted small">{nav.players[s.operatorId] ?? t('strategyBuilder.unassigned')}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="muted small">
                {t('builder.counts', { steps: draft.steps.length, markers: draft.markers.length, paths: draft.paths.length, zones: draft.zones.length, crossfires: draft.crossfires.length })}
              </p>
            </div>
          </div>
          {!draft.title.trim() && <p className="notice notice--warn">{t('strategyBuilder.giveTheStrategyATitle')}</p>}
          {error && (
            <p className="notice notice--error" role="alert">
              {tx(error)}
            </p>
          )}
          <button type="button" className="btn btn--primary btn--lg" onClick={() => onSave(draft)} disabled={saving || !draft.title.trim() || !strategyData.canSave}>
            <Icon name="check" size={20} /> {saving ? t('strategyBuilder.saving') : t('strategyBuilder.saveToTeamLibrary')}
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
  const { t } = useI18n();
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

  // Same search as the finder: a real assignment per plan, widening to other sites and maps (labelled).
  const found = useMemo(() => {
    if (!w.side) return { results: [], excluded: [] };
    const picks = w.ops.filter(Boolean).map((operatorId) => ({ player: w.players[operatorId] ?? null, operatorId }));
    return findStrategies(strategyData.strategies, { mapId: w.mapId, site: w.site, side: w.side, pref, prefs, roster: rosterEntries, picks, ownedOnly, limit: 12 });
  }, [strategyData.strategies, w.mapId, w.site, w.side, w.ops, w.players, pref, prefs, rosterEntries, ownedOnly]);
  const ranked = found.results.filter((x) => x.rec.status !== 'unscored').slice(0, 12);
  const { excluded } = found;

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
        title: base.origin === 'team' ? t('strategy.copyTitle', { title: base.title }) : base.title,
        mapId: w.mapId || copy.mapId,
        site: w.site || copy.site,
        slots: [...copy.slots, ...extras.map((id) => ({ key: newId('s'), operatorId: id, role: OPERATORS_BY_ID[id].roles[0] }))].slice(0, 6),
      });
    } else {
      draft = createStrategy({
        title: t('library.newStrategy'),
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
      setError(e.message || t('strategy.saveFailed'));
      setSaving(false);
    }
  };

  // Why Next is blocked, in words (null when it isn't).
  const nextBlock =
    { 1: !w.mapId && t('builder.block.map'), 3: !w.side && t('builder.block.side'), 4: ops.length < 1 && t('builder.block.ops') }[w.step] ||
    (w.step >= 6 && !w.draft ? t('builder.block.start') : null);
  const canNext = !nextBlock;
  // Tactics: say what's still missing, without blocking.
  const tacticWarn = (() => {
    if (w.step !== 8 || !w.draft) return null;
    const space = boardSpace(w.draft);
    const items = w.draft.markers.length + w.draft.paths.length + w.draft.zones.length + w.draft.crossfires.length;
    if (space.approximate && items) return t('builder.warn.approx', { count: items });
    const missing = unplacedSlots(w.draft);
    if (missing.length) return t('builder.warn.unplaced', { count: missing.length, names: missing.map((s) => OPERATORS_BY_ID[s.operatorId]?.name ?? s.operatorId) });
    return null;
  })();
  const summary = [map?.name, w.site && parseSite(w.site).rooms.join(' / '), w.side && t(w.side === 'attack' ? 'card.side.attack' : 'card.side.defend')].filter(Boolean).join(' · ');

  return (
    <section className="page builder" aria-labelledby="builder-title">
      <header className="page__head">
        <div>
          <p className="page__kicker">{t('strategyBuilder.strategyBuilder')}</p>
          <h1 id="builder-title" className="page__title">
            {t(`builder.step.${STEPS[w.step - 1]}`)}
          </h1>
          <p className="builder__desc">{t(`builder.desc.${STEPS[w.step - 1]}`)}</p>
          {summary && <p className="page__sub builder__summary">{summary}</p>}
        </div>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => {
            if (!w.draft || window.confirm(t('builder.startOverConfirm'))) setW(fresh());
          }}
        >
          <Icon name="refresh" size={16} /> {t('strategyBuilder.startOver')}
        </button>
      </header>

      <Stepper step={w.step} reached={w.reached} hasDraft={Boolean(w.draft)} go={go} />
      {error && w.step < 10 && (
        <p className="notice notice--error" role="alert">
          {tx(error)}
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
                    {m.sites.attack.length ? t('mapPicker.sites', { count: m.sites.attack.length }) : t('strategyBuilder.noSitesListedPlanWithout')} · {t('builder.strategyCount', { count })}
                  </span>
                </button>
              </li>
            );
          })}
        </ChoiceGrid>
      )}

      {w.step === 2 && !sites.length && (
        <p className="notice notice--info" role="status">
          {t('builder.noSites', { map: map?.name })}
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
              <span className="choice__name">{sites.length ? t('strategyBuilder.anySite') : t('strategyBuilder.noSitesListedContinue')}</span>
              <span className="choice__meta">{t('strategyBuilder.aPlanThatIsnT')}</span>
            </button>
          </li>
        </ChoiceGrid>
      )}

      {w.step === 3 && (
        <ChoiceGrid className="choice-grid--sides">
          {[
            ['attack', t('card.side.attack'), t('builder.side.attack.sub'), 'swords'],
            ['defend', t('card.side.defend'), t('builder.side.defend.sub'), 'shield'],
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
          <div className="picked" aria-label={t('strategyBuilder.yourFiveOperators')}>
            {w.ops.map((id, i) => {
              const op = OPERATORS_BY_ID[id];
              return (
                <button key={i} type="button" className={`picked__slot${op ? '' : ' picked__slot--empty'}`} onClick={() => op && toggleOp(id)} aria-label={op ? t('builder.remove', { operator: op.name }) : t('builder.emptySlot', { n: i + 1 })}>
                  <OperatorIcon key={id ?? `e${i}`} operator={op} size="lg" />
                  <span>{op?.name ?? t('builder.slot', { n: i + 1 })}</span>
                </button>
              );
            })}
            <button type="button" className="btn btn--secondary" onClick={roll}>
              <Icon name="dice" size={18} /> {t('strategyBuilder.rollForTheStarters')}
            </button>
          </div>
          <div className="op-filter" role="group" aria-label={t('strategyBuilder.filterByRole')}>
            <button type="button" className="step-chip" aria-pressed={!roleFilter} onClick={() => setRoleFilter('')}>
              {t('strategyBuilder.all')}
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
            <h2 className="panel__title">{t('strategyBuilder.whoPlaysWhat')}</h2>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => set((x) => ({ players: Object.fromEntries(x.ops.filter(Boolean).map((id, i) => [id, x.players[id] ?? lineupPlayers[i] ?? null])) }))}
            >
              {t('strategyBuilder.fillWithStarters')}
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
                    <span className="field__label">{t('strategyBuilder.player')}</span>
                    <select className="select" value={w.players[id] ?? ''} onChange={(e) => set((x) => ({ players: { ...x.players, [id]: e.target.value || null } }))}>
                      <option value="">{t('strategyBuilder.unassigned')}</option>
                      {roster.map((p) => (
                        <option key={p} value={p} disabled={taken.has(p)}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span className="field__label">{t('strategyBuilder.tacticalRole')}</span>
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
              {t('builder.alreadyStarted', { title: w.draft.title || t('strategyBuilder.aStrategy') })}{' '}
              <button type="button" className="link-btn" onClick={() => go(7)}>
                {t('strategyBuilder.continueIt')}
              </button>{' '}
              {t('builder.orPick')}
            </p>
          )}
          <ul className="strat-list">
            <li className="strat-card strat-card--blank">
              <button type="button" className="strat-card__main" onClick={() => start(null)}>
                <span className="strat-card__top">
                  <span className="strat-card__title">
                    <Icon name="plus" size={18} /> {t('strategyBuilder.blankTacticalBoard')}
                  </span>
                </span>
                <span className="strat-card__meta">{t('builder.blankMeta', { count: ops.length })}</span>
              </button>
            </li>
            {ranked.map((item, i) => (
              <RecommendationCard
                key={item.strategy.id}
                item={item}
                pref={pref}
                top={i === 0}
                fits={whereFavoritesFit(found.results, item)}
                onOpen={() => start(item.strategy, item.rec)}
              />
            ))}
          </ul>
          {!ranked.length && <p className="muted">{t('strategyBuilder.noStrategiesInTheLibrary')}</p>}
          {excluded.length > 0 && (
            <p className="muted small">
              {t('builder.excluded', { count: excluded.length, titles: excluded.map((x) => x.strategy.title) })}
            </p>
          )}
          <p className="muted small">{t('strategyBuilder.startingFromAStrategyAdapts')}</p>
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
            <Icon name="chevron" size={18} className="icon--flip" /> {t('strategyBuilder.back')}
          </button>
          {w.step !== 6 && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => canNext && next()}
              aria-disabled={!canNext || undefined}
              aria-describedby={nextBlock ? 'builder-next-hint' : undefined}
            >
              {t('builder.next', { name: t(`builder.step.${STEPS[w.step]}`) })} <Icon name="arrow" size={18} />
            </button>
          )}
          {nextBlock && (
            <p id="builder-next-hint" className="builder__hint" role="status">
              {nextBlock}
            </p>
          )}
          {!nextBlock && tacticWarn && (
            <p className="builder__hint builder__hint--warn" role="status">
              <Icon name="alert" size={16} /> {tacticWarn}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
