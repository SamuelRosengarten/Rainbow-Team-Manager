import { useEffect, useMemo, useState } from 'react';
import DraftSteps from './builder/DraftSteps.jsx';
import MapStep from './builder/MapStep.jsx';
import OperatorsStep from './builder/OperatorsStep.jsx';
import PlayersStep from './builder/PlayersStep.jsx';
import SideStep from './builder/SideStep.jsx';
import SiteStep from './builder/SiteStep.jsx';
import StartStep from './builder/StartStep.jsx';
import Stepper from './builder/Stepper.jsx';
import Icon from './Icon.jsx';
import { parseSite } from '../lib/diagram.js';
import { MAPS_BY_ID, allSites } from '../lib/maps.js';
import { OPERATORS, OPERATORS_BY_ID } from '../lib/operators.js';
import { rollLineup } from '../lib/roll.js';
import { cleanDraft, createStrategy, duplicateStrategy, filterStrategies, newId, normalizeStrategy } from '../lib/strategies.js';
import { floorIdFromSite } from '../lib/floorPlans.js';
import { prefState, recommendStrategies } from '../lib/recommend.js';
import { fitToComposition } from '../lib/strategyMatch.js';
import { recommendLineup } from '../lib/lineup.js';
import { findStrategies } from '../lib/finder.js';
import { usePreferences } from '../state/usePreferences.js';
import { defaultTacticalRole } from '../lib/tactical.js';
import { boardSpace } from '../lib/space.js';
import { unplacedSlots } from '../lib/tacticStatus.js';
import { useBuilderMode } from '../state/useBuilderMode.js';
import { defaultPhases, nextStep, normalizeStep, prevStep, stepId } from '../lib/builderFlow.js';
import { GlossaryButton } from './Glossary.jsx';
import { useRoster } from '../state/roster-context.js';
import { useSessionState } from '../state/useSessionState.js';
import { tx, useI18n } from '../i18n/index.js';

const KEY = 'r6tp.builder';

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

/**
 * The Strategy Builder: map → site → side → five operators → players →
 * start from a library strategy (adapted to our operators) or a blank board
 * → customize → tactics on the map → steps and timing → save.
 */
export default function StrategyBuilder({ profile, strategyData, navigate, preset, prefs, ownedOnly, updateTeam }) {
  const { t } = useI18n();
  const { players: roster, lineupPlayers, roster: rosterEntries } = useRoster();
  const [w, setW] = useSessionState(KEY, () => fresh());
  const [mode, setMode] = useBuilderMode();
  const simple = mode === 'simple';
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
  const next = () => go(nextStep(mode, w.step));
  const back = () => go(prevStep(mode, w.step));
  // Simple mode skips Players, Customize and Steps: land on a step it shows.
  useEffect(() => {
    const n = normalizeStep(mode, w.step, Boolean(w.draft));
    if (n !== w.step) setW((x) => ({ ...x, step: n, reached: Math.max(x.reached, n) }));
  }, [mode, w.step, w.draft, setW]);
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

  const coachPicks = coach?.lineup?.slots?.filter((s) => s.operatorId).slice(0, 5) ?? [];
  // `stay`: Simple mode fills the five and stays on the step so they can be seen.
  const applyCoachLineup = (stay = false) => {
    const picked = coachPicks;
    set((x) => ({
      ops: [...picked.map((s) => s.operatorId), null, null, null, null, null].slice(0, 5),
      players: Object.fromEntries(picked.filter((s) => s.player).map((s) => [s.operatorId, s.player])),
      roles: Object.fromEntries(picked.map((s) => [s.operatorId, s.job])),
      ...(stay ? {} : { step: 6, reached: Math.max(x.reached, 6) }),
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
        // The board opens on our site's floor, not the library plan's.
        floorId: floorIdFromSite(w.site || copy.site) || null,
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
        // Simple mode: three plain phases so the board has a When from the start.
        ...(simple ? { steps: defaultPhases(w.side).map((id, i) => ({ id: `st${i + 1}`, title: t(`builder.phase.${id}`) })) } : {}),
      });
      draft.title = simple ? t('builder.simple.title', { map: map?.name ?? '', site: w.site ? parseSite(w.site).rooms.join(' / ') : 'none', side: w.side }) : '';
    }
    draft.slots = draft.slots.map((s) => (s.operatorId && ops.includes(s.operatorId) ? { ...s, tacticalRole: roleOf(s.operatorId) } : s));
    const to = simple ? 8 : 7;
    set((x) => ({ draft, step: to, reached: Math.max(x.reached, to) }));
  };

  const save = async (draft) => {
    setError('');
    setSaving(true);
    try {
      const clean = cleanDraft(draft);
      await strategyData.saveStrategy({ ...clean, owner: profile });
      // Player assignments are saved separately: a failure must not be lost silently.
      const results = await Promise.allSettled(
        clean.slots
          .filter((s) => w.players[s.operatorId])
          .map((s) => strategyData.setAssignment(clean.id, s.key, w.players[s.operatorId])),
      );
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length) {
        // The strategy is saved; saving again retries the assignments.
        setError(t('builder.assignNotSaved', { count: failed.length, detail: failed[0].reason?.message ?? '' }));
        setSaving(false);
        return;
      }
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
            {t(`builder.step.${stepId(mode, w.step)}`)}
          </h1>
          <p className="builder__desc">{t(`builder.desc.${stepId(mode, w.step)}`)}</p>
          {summary && <p className="page__sub builder__summary">{summary}</p>}
        </div>
        <div className="builder__tools">
          <div className="segmented builder__mode" role="group" aria-label={t('builder.mode.label')} title={t('builder.mode.help')}>
            {['simple', 'advanced'].map((m) => (
              <button key={m} type="button" className="segmented__btn" aria-pressed={mode === m} onClick={() => setMode(m)}>
                {t(`builder.mode.${m}`)}
              </button>
            ))}
          </div>
          <GlossaryButton />
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              if (!w.draft || window.confirm(t('builder.startOverConfirm'))) setW(fresh());
            }}
          >
            <Icon name="refresh" size={16} /> {t('strategyBuilder.startOver')}
          </button>
        </div>
      </header>

      <Stepper mode={mode} step={w.step} reached={w.reached} hasDraft={Boolean(w.draft)} go={go} />
      {error && w.step < 10 && (
        <p className="notice notice--error" role="alert">
          {tx(error)}
        </p>
      )}

      {w.step === 1 && <MapStep w={w} set={set} strategyData={strategyData} />}

      {w.step === 2 && <SiteStep w={w} set={set} map={map} sites={sites} />}

      {w.step === 3 && <SideStep w={w} set={set} />}

      {w.step === 4 && (
        <OperatorsStep
          w={w}
          ops={ops}
          coach={coach}
          coachPicks={coachPicks}
          applyCoachLineup={applyCoachLineup}
          simple={simple}
          pref={pref}
          lineupPlayers={lineupPlayers}
          updateTeam={updateTeam}
          toggleOp={toggleOp}
          roll={roll}
          roleFilter={roleFilter}
          setRoleFilter={setRoleFilter}
        />
      )}

      {w.step === 5 && <PlayersStep w={w} set={set} ops={ops} lineupPlayers={lineupPlayers} roster={roster} roleOf={roleOf} />}

      {w.step === 6 && <StartStep w={w} go={go} ops={ops} simple={simple} pref={pref} ranked={ranked} found={found} excluded={excluded} start={start} />}

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
          simple={simple}
          roster={roster}
          onPlayer={(id, p) => set((x) => ({ players: { ...x.players, [id]: p } }))}
        />
      )}

      {w.step !== 10 && (
        <div className={`strat-actions builder__nav${w.step === 8 ? '' : ' strat-actions--sticky'}`}>
          <button type="button" className="btn btn--ghost" onClick={back} disabled={w.step === 1}>
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
              {t('builder.next', { name: t(`builder.step.${stepId(mode, nextStep(mode, w.step))}`) })} <Icon name="arrow" size={18} />
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
