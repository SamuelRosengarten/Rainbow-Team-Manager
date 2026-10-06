import { OPERATORS } from '../lib/operators.js';
import { useRoster } from '../state/roster-context.js';

/**
 * Whether "owned operators only" is on, in words, with the switch. When it's
 * on, recommendations and the operator dropdowns only offer what each player
 * owns (a player who hasn't marked any owned operators isn't limited).
 * `updateTeam` is the shared team switch (the same one the lineup roller uses).
 */
export default function OwnedOnlyNote({ pref, updateTeam, players = [] }) {
  const { prefs = {} } = useRoster();
  const on = Boolean(pref.ownedOnly);
  return (
    <div className={`owned-note owned-note--${on ? 'on' : 'off'}`}>
      <label className="checkbox">
        <input type="checkbox" checked={on} disabled={!updateTeam} onChange={(e) => updateTeam?.({ ownedOnly: e.target.checked })} />
        Owned operators only: <strong>{on ? 'ON' : 'OFF'}</strong>
      </label>
      <p className="muted small">
        {on
          ? 'Players are only offered operators they own.'
          : 'Every operator is available, owned or not. Turn this on to limit players to what they own.'}
        {on && players.length > 0 && (
          <>
            {' '}
            {players.map((n) => `${n} ${(prefs[n]?.owned ?? []).length}/${OPERATORS.length}`).join(' · ')}.
          </>
        )}
        {pref.noOwnedData.length > 0 && ` ${pref.noOwnedData.join(', ')} ${pref.noOwnedData.length === 1 ? "hasn't" : "haven't"} marked any owned operators yet, so ${pref.noOwnedData.length === 1 ? "they aren't" : "they aren't"} limited.`}
      </p>
    </div>
  );
}
