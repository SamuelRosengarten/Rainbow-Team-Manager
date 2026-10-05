import { useState } from 'react';
import SideToggle from './SideToggle.jsx';
import Lineup from './Lineup.jsx';
import BansPanel from './BansPanel.jsx';
import CopyButton from './CopyButton.jsx';
import Notice from './Notice.jsx';
import MapPicker from './MapPicker.jsx';
import MapNotes from './MapNotes.jsx';
import { PLAYERS } from '../lib/constants.js';
import { OPERATORS, OPERATORS_BY_ID } from '../lib/operators.js';
import { MAPS_BY_ID, sitesFor } from '../lib/maps.js';
import { formatLineupText, rerollPlayer, rollLineup } from '../lib/roll.js';

export default function PlanView({ team, updateTeam, currentProfile, rollOptions = {}, notes }) {
  const [error, setError] = useState('');
  const [changed, setChanged] = useState([]);
  const { side, bans, mapId, site } = team;
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

  const changeSide = (next) =>
    updateTeam((prev) => ({
      side: next,
      site: sitesFor(prev.mapId, next).includes(prev.site) ? prev.site : '',
      tacticId: null,
    }));
  const changeMap = (id) => updateTeam({ mapId: id, site: '', tacticId: null });
  const changeSite = (s) => updateTeam({ site: s, tacticId: null });

  const shareText = () =>
    formatLineupText({
      lineup,
      players: PLAYERS,
      operatorsById: OPERATORS_BY_ID,
      side,
      mapName: MAPS_BY_ID[mapId]?.name,
      site,
    });

  return (
    <div className="plan">
      <div className="plan__col">
        <MapPicker mapId={mapId} site={site} side={side} onMapChange={changeMap} onSiteChange={changeSite} />

        <section className="panel panel--lineup" aria-labelledby="lineup-title">
          <div className="panel__head">
            <h2 id="lineup-title" className="panel__title">Lineup</h2>
            <SideToggle side={side} onChange={changeSide} />
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
      </div>

      <div className="plan__col">
        {mapId && (
          <MapNotes
            key={mapId}
            mapId={mapId}
            currentProfile={currentProfile}
            getNotes={notes.getNotes}
            saveNotes={notes.saveNotes}
          />
        )}
        <BansPanel side={side} bans={bans} onToggle={toggleBan} onClear={clearBans} />
      </div>
    </div>
  );
}
