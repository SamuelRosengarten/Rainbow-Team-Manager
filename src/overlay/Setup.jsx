import { useState } from 'react';
import { Chooser } from '../components/PlayerMode.jsx';
import LoginForm from '../components/LoginForm.jsx';
import { steamLogin } from './bridge.js';
import { mapsWithStrategies, strategiesFor } from './playerView.js';
import { msg, useI18n } from '../i18n/index.js';

/**
 * Signed out: email + password, or Steam (the overlay opens Steam in the
 * browser and waits for it on a one-shot local server, see overlay/loopback.js).
 */
export function SignInStep({ auth }) {
  const { t } = useI18n();
  const [waiting, setWaiting] = useState(false);

  async function steam() {
    auth.setError(null);
    setWaiting(true);
    try {
      const params = await steamLogin();
      await auth.signInSteam(params);
    } catch (e) {
      if (e?.message !== 'cancelled') auth.setError(e?.id ? msg(e.id, e.values) : msg('auth.error.steamFailed'));
    } finally {
      setWaiting(false);
    }
  }

  return (
    <div className="ov-setup__body">
      <h1 className="ov-setup__title">{t('auth.title')}</h1>
      <LoginForm auth={auth} onSteam={steam} allowReset={false} steamWaiting={waiting} />
    </div>
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
