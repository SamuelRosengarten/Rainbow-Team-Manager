import { OPERATORS } from '../lib/operators.js';
import { useI18n } from '../i18n/index.js';
import { T } from '../i18n/Rich.jsx';
import { useRoster } from '../state/roster-context.js';

/**
 * Whether "owned operators only" is on, in words, with the switch. When it's
 * on, recommendations and the operator dropdowns only offer what each player
 * owns (a player who hasn't marked any owned operators isn't limited).
 * `updateTeam` is the shared team switch (the same one the lineup roller uses).
 */
export default function OwnedOnlyNote({ pref, updateTeam, players = [] }) {
  const { t } = useI18n();
  const { prefs = {} } = useRoster();
  const on = Boolean(pref.ownedOnly);
  return (
    <div className={`owned-note owned-note--${on ? 'on' : 'off'}`}>
      <label className="checkbox">
        <input type="checkbox" checked={on} disabled={!updateTeam} onChange={(e) => updateTeam?.({ ownedOnly: e.target.checked })} />
        <T id={on ? 'owned.toggle.on' : 'owned.toggle.off'} />
      </label>
      <p className="muted small">
        {t(on ? 'owned.help.on' : 'owned.help.off')}
        {on && players.length > 0 && <> {players.map((n) => t('owned.count', { name: n, owned: (prefs[n]?.owned ?? []).length, total: OPERATORS.length })).join(' · ')}.</>}
        {pref.noOwnedData.length > 0 && <> {t('owned.noData', { names: pref.noOwnedData, count: pref.noOwnedData.length })}</>}
      </p>
    </div>
  );
}
