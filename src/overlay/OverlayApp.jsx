import { useCallback, useEffect, useRef, useState } from 'react';
import RoundView from './RoundView.jsx';
import Setup, { PasscodeStep } from './Setup.jsx';
import { isDesktop, onEditMode, onReset, onStep, resizeBy, setPhase } from './bridge.js';
import { moveStep, stepCount } from './playerView.js';
import { isConfigured } from './readApi.js';
import { loadChoice, storeChoice } from './storage.js';
import { useOverlayData } from './useOverlayData.js';
import { REQUIRE_PASSCODE } from '../lib/config.js';
import { tm, useI18n } from '../i18n/index.js';

const CLEARED = { mapId: '', side: '', strategyId: '', slotKey: '' };

/** Edit mode only: drag this corner to resize the window. */
function ResizeGrip() {
  const { t } = useI18n();
  const last = useRef(null);
  return (
    <span
      className="ov-grip"
      role="presentation"
      title={t('overlay.edit.resize')}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        last.current = [e.screenX, e.screenY];
      }}
      onPointerMove={(e) => {
        if (!last.current) return;
        const [x, y] = last.current;
        last.current = [e.screenX, e.screenY];
        resizeBy(e.screenX - x, e.screenY - y);
      }}
      onPointerUp={() => {
        last.current = null;
      }}
    />
  );
}

/**
 * The in-game overlay. Setup (passcode, map, side, strategy, operator) is the
 * only screen that takes clicks; the in-round view is click-through and
 * changes step with the F8 / F6 hotkeys. Read-only throughout.
 */
export default function OverlayApp() {
  const { t } = useI18n();
  const [choice, setChoice] = useState(loadChoice);
  const [editing, setEditing] = useState(false);
  const [step, setStep] = useState({ key: '', index: 0 });
  const locked = REQUIRE_PASSCODE && isConfigured && !choice.passcodeOk;
  const data = useOverlayData(!locked);

  const update = useCallback(
    (patch) =>
      setChoice((c) => {
        const next = { ...c, ...patch };
        storeChoice(next);
        return next;
      }),
    [],
  );
  const unlock = useCallback(() => update({ passcodeOk: true }), [update]);

  useEffect(() => onReset(() => update(CLEARED)), [update]);
  useEffect(() => onEditMode(setEditing), []);

  const strategy = data.strategies.find((s) => s.id === choice.strategyId) ?? null;
  const ready = !locked && data.status === 'ready' && strategy && strategy.slots.some((s) => s.key === choice.slotKey);
  const count = strategy ? stepCount(strategy) : 1;
  // The step starts again at 1 whenever the strategy or operator changes.
  const stepKey = `${choice.strategyId}/${choice.slotKey}`;
  const stepIndex = step.key === stepKey ? step.index : 0;

  useEffect(() => onStep((delta) => setStep((s) => ({ key: stepKey, index: moveStep(s.key === stepKey ? s.index : 0, delta, count) }))), [stepKey, count]);

  // A strategy and operator were picked but are gone now (deleted or changed in
  // the web app, maybe mid-match): say so without taking clicks over the game.
  const gone = !locked && data.status === 'ready' && !ready && Boolean(choice.strategyId && choice.slotKey);

  // Setup and errors take clicks; loading and the round view are click-through.
  const phase = ready || gone || (!locked && data.status === 'loading') ? 'round' : 'setup';
  useEffect(() => {
    setPhase(phase);
  }, [phase]);

  let body;
  if (locked) body = <PasscodeStep onPass={unlock} />;
  else if (data.status === 'loading') body = <p className="ov-status">{t('screens.connecting')}</p>;
  else if (data.status === 'error') {
    body = (
      <div className="ov-setup__body">
        <p className="notice notice--error" role="alert">
          {tm(data.error)}
        </p>
        <button type="button" className="btn btn--primary" onClick={data.retry}>
          {t('overlay.retry')}
        </button>
      </div>
    );
  } else if (ready) body = <RoundView strategy={strategy} slotKey={choice.slotKey} stepIndex={stepIndex} />;
  else if (gone) body = <p className="ov-status">{t('overlay.round.gone')}</p>;
  else {
    body = (
      <Setup
        choice={choice}
        strategies={data.strategies}
        assignments={data.assignments}
        onChange={update}
      />
    );
  }

  return (
    <div className={`ov ov--${phase}${editing ? ' ov--editing' : ''}`}>
      {editing && (
        <div className="ov-edit-bar">
          <span>{t('overlay.edit.hint')}</span>
          {phase === 'round' && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => update(CLEARED)}>
              {t('overlay.edit.change')}
            </button>
          )}
        </div>
      )}
      <main className="ov__body">{body}</main>
      {phase === 'round' && !editing && !isDesktop() && <p className="ov-keys">{t('overlay.keysHint')}</p>}
      {editing && <ResizeGrip />}
    </div>
  );
}
