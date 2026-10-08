import { useState } from 'react';
import { Chooser } from '../components/PlayerMode.jsx';
import { checkPasscode } from '../lib/passcode.js';
import { errorMsg } from '../lib/errors.js';
import { checkPasscodeOnServer, passcodeStatus } from './readApi.js';
import { mapsWithStrategies, strategiesFor } from './playerView.js';
import { tm, useI18n } from '../i18n/index.js';

/** Team passcode, checked the same way as the web app (check_team_passcode() on the server). */
export function PasscodeStep({ onPass }) {
  const { t } = useI18n();
  const [value, setValue] = useState('');
  const [wrong, setWrong] = useState(false);
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setChecking(true);
    setError(null);
    try {
      const gate = await passcodeStatus();
      const ok = !gate.set || (gate.mode === 'server' ? await checkPasscodeOnServer(value) : await checkPasscode(value, gate.hash));
      if (ok) onPass();
      else setWrong(true);
    } catch (err) {
      setError(errorMsg(err));
    } finally {
      setChecking(false);
    }
  }

  return (
    <form className="ov-setup__body" onSubmit={submit}>
      <h1 className="ov-setup__title">{t('overlay.passcode.title')}</h1>
      <label className="field">
        <span className="field__label">{t('screens.passcode')}</span>
        <input
          className="input input--lg"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setWrong(false);
          }}
          aria-invalid={wrong}
          required
        />
      </label>
      {wrong && (
        <p className="notice notice--error" role="alert">
          {t('screens.wrongPasscodeAskATeammate')}
        </p>
      )}
      {error && (
        <p className="notice notice--error" role="alert">
          {tm(error)}
        </p>
      )}
      <button type="submit" className="btn btn--primary btn--block" disabled={checking || !value}>
        {t('overlay.passcode.unlock')}
      </button>
    </form>
  );
}

/** One row of big choice buttons. */
function Choices({ items, onPick }) {
  return (
    <ul className="ov-choices">
      {items.map((it) => (
        <li key={it.id}>
          <button type="button" className={`ov-choice${it.side ? ` ov-choice--${it.side}` : ''}`} onClick={() => onPick(it.id)}>
            <span className="ov-choice__name">{it.name}</span>
            {it.sub && <span className="ov-choice__sub">{it.sub}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Before the match: map, then side, then strategy, then "who are you
 * playing?". These choices only decide what the overlay shows.
 */
export default function Setup({ choice, strategies, assignments, onChange }) {
  const { t } = useI18n();
  const { mapId, side, strategyId } = choice;
  const strategy = strategies.find((s) => s.id === strategyId);
  const back = (patch) => (
    <button type="button" className="btn btn--ghost btn--sm" onClick={() => onChange(patch)}>
      {t('overlay.setup.back')}
    </button>
  );

  if (!mapId) {
    const maps = mapsWithStrategies(strategies);
    return (
      <div className="ov-setup__body">
        <h1 className="ov-setup__title">{t('overlay.setup.pickMap')}</h1>
        {maps.length ? <Choices items={maps} onPick={(id) => onChange({ mapId: id })} /> : <p className="muted">{t('overlay.setup.noStrategies')}</p>}
      </div>
    );
  }

  if (!side) {
    return (
      <div className="ov-setup__body">
        <div className="ov-setup__nav">{back({ mapId: '' })}</div>
        <h1 className="ov-setup__title">{t('overlay.setup.pickSide')}</h1>
        <Choices
          items={['attack', 'defend'].map((id) => ({ id, side: id, name: t(`side.${id}`), sub: t('overlay.setup.strategyCount', { n: strategiesFor(strategies, mapId, id).length }) }))}
          onPick={(id) => onChange({ side: id })}
        />
      </div>
    );
  }

  if (!strategy) {
    const list = strategiesFor(strategies, mapId, side);
    return (
      <div className="ov-setup__body">
        <div className="ov-setup__nav">{back({ side: '' })}</div>
        <h1 className="ov-setup__title">{t('overlay.setup.pickStrategy')}</h1>
        {list.length ? (
          <Choices items={list.map((s) => ({ id: s.id, name: s.title, sub: s.site }))} onPick={(id) => onChange({ strategyId: id, slotKey: '' })} />
        ) : (
          <p className="muted">{t('overlay.setup.noStrategiesHere')}</p>
        )}
      </div>
    );
  }

  return (
    <div className="ov-setup__body">
      <div className="ov-setup__nav">{back({ strategyId: '', slotKey: '' })}</div>
      <Chooser strategy={strategy} assigned={assignments[strategy.id] ?? {}} profile={null} onPick={(key) => onChange({ slotKey: key })} />
    </div>
  );
}
