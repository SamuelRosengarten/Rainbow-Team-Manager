import { useState } from 'react';
import SideToggle from './SideToggle.jsx';
import Lineup from './Lineup.jsx';
import BansPanel from './BansPanel.jsx';
import CopyButton from './CopyButton.jsx';
import Notice from './Notice.jsx';
import { PLAYERS } from '../lib/constants.js';
import { OPERATORS, OPERATORS_BY_ID } from '../lib/operators.js';
import { formatLineupText, rerollPlayer, rollLineup } from '../lib/roll.js';

export default function PlanView({ team, updateTeam, currentProfile, rollOptions = {} }) {
  const [error, setError] = useState('');
  const [changed, setChanged] = useState([]);
  const { side, bans, site } = team;
  const lineup = team.lineup?.side === side ? team.lineup.players : null;
  const common = { players: PLAYERS, operators: OPERATORS, side, bans, ...rollOptions };

  function applyResult(res, changedPlayers) {
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError('');
    setChanged(changedPlayers);
    updateTeam({ lineup: { side, players: res.lineup } });
  }

  const roll = () => applyResult(rollLineup(common), PLAYERS);
  const reroll = (player) => applyResult(rerollPlayer({ ...common, lineup, player }), [player]);

  const toggleBan = (id) =>
    updateTeam((prev) => ({
      bans: prev.bans.includes(id) ? prev.bans.filter((b) => b !== id) : [...prev.bans, id],
    }));
  const clearBans = () =>
    updateTeam((prev) => ({ bans: prev.bans.filter((id) => OPERATORS_BY_ID[id]?.side !== side) }));

  const shareText = () =>
    formatLineupText({
      lineup,
      players: PLAYERS,
      operatorsById: OPERATORS_BY_ID,
      side,
      mapName: rollOptions.mapName,
      site,
      tacticName: rollOptions.tacticName,
    });

  return (
    <div className="plan">
      <section className="panel panel--lineup" aria-labelledby="lineup-title">
        <div className="panel__head">
          <h2 id="lineup-title" className="panel__title">Lineup</h2>
          <SideToggle side={side} onChange={(s) => updateTeam({ side: s })} />
        </div>
        <Notice onDismiss={() => setError('')}>{error}</Notice>
        <Lineup
          players={PLAYERS}
          lineup={lineup}
          highlight={changed}
          onReroll={reroll}
          currentProfile={currentProfile}
        />
        <div className="actions">
          <button type="button" className={`btn btn--primary btn--${side}`} onClick={roll}>
            Roll {side === 'attack' ? 'attackers' : 'defenders'}
          </button>
          <CopyButton getText={shareText} disabled={!lineup} />
        </div>
      </section>
      <BansPanel side={side} bans={bans} onToggle={toggleBan} onClear={clearBans} />
    </div>
  );
}
