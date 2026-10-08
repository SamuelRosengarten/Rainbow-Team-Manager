import { useCallback, useEffect, useRef, useState } from 'react';
import RoundView from './RoundView.jsx';
import Setup, { SignInStep } from './Setup.jsx';
import { isDesktop, onEditMode, onReset, onSignOut, onStep, resizeBy, setPhase } from './bridge.js';
import { moveStep, stepCount } from './playerView.js';
import { isConfigured } from './readApi.js';
import { loadChoice, storeChoice } from './storage.js';
import { useOverlayData } from './useOverlayData.js';
import { useAuth } from '../state/useAuth.js';
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
 * The in-game overlay. Setup (sign in, map, side, strategy, operator) is the
 * only screen that takes clicks; the in-round view is click-through and
 * changes step with the F8 / F6 hotkeys. Read-only throughout.
 */
export default function OverlayApp() {
  const { t } = useI18n();
  const [choice, setChoice] = useState(loadChoice);
  const [editing, setEditing] = useState(false);
  const [step, setStep] = useState({ key: '', index: 0 });
  // Online, only signed-in team members get past this; offline (no Supabase
  // settings) there's nothing to protect and no sign-in.
  const auth = useAuth({ enabled: isConfigured });
  const signedIn = auth.status === 'ready' || auth.status === 'recovery';
  const authBusy = auth.status === 'loading' || auth.status === 'checking';
  const locked = !signedIn;
  const data = useOverlayData(signedIn);

  const update = useCallback(
    (patch) =>
      setChoice((c) => {
        const next = { ...c, ...patch };
        storeChoice(next);
        return next;
      }),
    [],
  );
  useEffect(() => onReset(() => update(CLEARED)), [update]);
  useEffect(() => onSignOut(auth.signOut), [auth.signOut]);
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

  // Setup, sign-in and errors take clicks; loading and the round view are click-through.
  const phase = ready || gone || authBusy || (!locked && data.status === 'loading') ? 'round' : 'setup';
  useEffect(() => {
    setPhase(phase);
  }, [phase]);

  let body;
  if (authBusy) body = <p className="ov-status">{t('auth.checking')}</p>;
  else if (auth.status === 'signedOut') body = <SignInStep auth={auth} />;
  else if (auth.status === 'notMember' || auth.status === 'error') {
    body = (
      <div className="ov-setup__body">
        <p className="notice notice--error" role="alert">
          {auth.status === 'notMember' ? t('auth.notMember.body', { who: auth.email || t('auth.notMember.steamAccount') }) : tm(auth.error)}
        </p>
        <div className="ov-setup__nav">
          {auth.status === 'error' && (
            <button type="button" className="btn btn--primary" onClick={auth.retry}>
              {t('overlay.retry')}
            </button>
          )}
          <button type="button" className="btn btn--ghost" onClick={auth.signOut}>
            {t('auth.signOut')}
          </button>
        </div>
      </div>
    );
  } else if (data.status === 'loading') body = <p className="ov-status">{t('screens.connecting')}</p>;
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
