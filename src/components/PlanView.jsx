import { useState } from 'react';
import SideToggle from './SideToggle.jsx';
import Lineup from './Lineup.jsx';
import BansPanel from './BansPanel.jsx';
import CopyButton from './CopyButton.jsx';
import Notice from './Notice.jsx';
import MapPicker from './MapPicker.jsx';
import MapNotes from './MapNotes.jsx';
import TacticPanel from './TacticPanel.jsx';
import { useRoster } from '../state/roster-context.js';
import { OPERATORS, OPERATORS_BY_ID } from '../lib/operators.js';
import { MAPS_BY_ID, sitesFor } from '../lib/maps.js';
import { formatLineupText, rerollPlayer, rollLineup } from '../lib/roll.js';

const describe = (lineup, players) =>
  players.map((p) => `${p}: ${OPERATORS_BY_ID[lineup[p]]?.name ?? 'none'}`).join(', ');

export default function PlanView({ team, updateTeam, currentProfile, rollOptions = {}, notes, tactics, onFindStrategies }) {
  const { lineupPlayers } = useRoster();
  const [error, setError] = useState('');
  const [changed, setChanged] = useState([]);
  const [announce, setAnnounce] = useState('');
  const { side, bans, mapId, site } = team;
  const lineup = team.lineup?.side === side ? team.lineup.players : null;
  const common = { players: lineupPlayers, operators: OPERATORS, side, bans, ...rollOptions };

  function applyResult(res, changedPlayers) {
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError('');
    setChanged(changedPlayers);
    setAnnounce(describe(res.lineup, changedPlayers));
    updateTeam({ lineup: { side, players: res.lineup } });
  }

  const roll = () => applyResult(rollLineup(common), lineupPlayers);
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
      players: lineupPlayers,
      operatorsById: OPERATORS_BY_ID,
      side,
      mapName: MAPS_BY_ID[mapId]?.name,
      site,
      tacticName: tactics.find((t) => t.id === team.tacticId)?.name,
    });

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title">Plan</h1>
          <p className="page__sub">Map, lineup, tactic and bans. Every change is shared with the team live.</p>
        </div>
        {onFindStrategies && (
          <button type="button" className="btn btn--secondary btn--sm" onClick={onFindStrategies}>
            Find strategies for this lineup
          </button>
        )}
      </header>
      <div className="plan">
        <div className="plan__col">
          <MapPicker mapId={mapId} site={site} side={side} onMapChange={changeMap} onSiteChange={changeSite} />

          <section className="panel panel--lineup" aria-labelledby="lineup-title">
            <div className="panel__head">
              <h2 id="lineup-title" className="panel__title">Lineup</h2>
              <SideToggle side={side} onChange={changeSide} />
            </div>
            <Notice onDismiss={() => setError('')}>{error}</Notice>
            <p className="visually-hidden" aria-live="polite">{announce}</p>
            <Lineup
              players={lineupPlayers}
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
            <div className="lineup-foot">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={Boolean(team.ownedOnly)}
                  onChange={(e) => updateTeam({ ownedOnly: e.target.checked })}
                />
                Use owned operators only
              </label>
              {team.updatedBy && <span className="muted small">Last change by {team.updatedBy}</span>}
            </div>
          </section>

          <TacticPanel
            team={team}
            updateTeam={updateTeam}
            tactics={tactics}
            lineup={lineup}
            players={lineupPlayers}
            operators={OPERATORS}
            operatorsById={OPERATORS_BY_ID}
            rollOptions={rollOptions}
            onRerolled={(next, rerolled) => {
              setChanged(rerolled);
              setAnnounce(describe(next, rerolled));
              updateTeam({ lineup: { side, players: next } });
            }}
          />
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
    </div>
  );
}
