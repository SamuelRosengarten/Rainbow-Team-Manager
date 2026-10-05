import { useRef, useState } from 'react';
import TacticEditor from './TacticEditor.jsx';
import Notice from './Notice.jsx';
import TacticDiagram from './TacticDiagram.jsx';
import { useRoster } from '../state/roster-context.js';
import { OPERATORS_BY_ID } from '../lib/operators.js';
import { MAPS_BY_ID } from '../lib/maps.js';
import { ROLE_LABEL } from '../lib/fit.js';
import { exportTactics, parseImport, tacticsForTab } from '../lib/tactics.js';

const TABS = [
  { id: 'mine', label: 'My tactics' },
  { id: 'team', label: 'Team tactics' },
  { id: 'profile', label: 'By player' },
];

function download(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function TacticsView({ profile, tacticsStore }) {
  const { tactics, saveTactic, deleteTactic, importTactics } = tacticsStore;
  const [tab, setTab] = useState('team');
  const { players, lineupPlayers } = useRoster();
  const [viewing, setViewing] = useState(() => players.find((p) => p !== profile) ?? players[0]);
  const [sideFilter, setSideFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [shown, setShown] = useState(() => new Set());
  const fileRef = useRef(null);

  const list = tacticsForTab(tactics, { tab, profile, viewing })
    .filter((t) => sideFilter === 'all' || t.side === sideFilter)
    .sort(
      (a, b) =>
        a.side.localeCompare(b.side) ||
        (a.mapId || '').localeCompare(b.mapId || '') ||
        a.name.localeCompare(b.name),
    );

  const canEdit = (t) => t.owner === null || t.owner === profile;

  async function run(action, success) {
    setError('');
    setInfo('');
    try {
      await action();
      if (success) setInfo(success);
    } catch (e) {
      setError(e.message || 'Something went wrong.');
    }
  }

  async function onImport(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const owner = tab === 'mine' ? profile : null;
    const { tactics: parsed, errors } = parseImport(await file.text(), { owner });
    if (parsed.length === 0) {
      setError(errors.join(' ') || 'No tactics found in the file.');
      return;
    }
    const skipped = errors.length ? ` (${errors.length} skipped: ${errors.join(' ')})` : '';
    await run(() => importTactics(parsed), `Imported ${parsed.length} tactic${parsed.length === 1 ? '' : 's'}${skipped}.`);
  }

  if (editing) {
    return (
      <TacticEditor
        initial={editing}
        onCancel={() => setEditing(null)}
        onSave={async (t) => {
          await saveTactic(t);
          setEditing(null);
          setError('');
          setInfo(`Saved "${t.name}".`);
        }}
      />
    );
  }

  return (
    <section className="page" aria-labelledby="tactics-title">
      <header className="page__head">
        <div>
          <h1 id="tactics-title" className="page__title">Tactics</h1>
          <p className="page__sub">Your team's strats, with diagrams. Roll one from the Plan screen.</p>
        </div>
        <div className="toolbar">
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() =>
              setEditing({ owner: profile ?? null, shared: true, side: 'attack', mapId: 'any', requiredRoles: [] })
            }
          >
            + New tactic
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => download('tactics.json', exportTactics(list))}
            disabled={list.length === 0}
          >
            Export JSON
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()}>
            Import JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={onImport}
            aria-label="Import tactics JSON file"
          />
        </div>
      </header>

      <div className="panel">
        <div className="tabs-row">
          <div className="segmented" role="group" aria-label="Tactic lists">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={tab === t.id}
                className="segmented__btn"
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          {tab === 'profile' && (
            <label className="inline-field">
              <span className="visually-hidden">Player</span>
              <select className="select input--sm" value={viewing} onChange={(e) => setViewing(e.target.value)}>
                {players.map((p) => (
                  <option key={p} value={p}>{p === profile ? `${p} (you)` : p}</option>
                ))}
              </select>
            </label>
          )}
          <label className="inline-field">
            <span className="visually-hidden">Side</span>
            <select className="select input--sm" value={sideFilter} onChange={(e) => setSideFilter(e.target.value)}>
              <option value="all">Both sides</option>
              <option value="attack">Attack</option>
              <option value="defend">Defense</option>
            </select>
          </label>
        </div>

        <Notice onDismiss={() => setError('')}>{error}</Notice>
        {info && <Notice kind="ok" onDismiss={() => setInfo('')}>{info}</Notice>}
        {tab === 'mine' && !profile && <Notice kind="info">Pick a profile to see your tactics.</Notice>}

        {list.length === 0 ? (
          <p className="empty">No tactics here yet.</p>
        ) : (
          <ul className="tactic-list">
            {list.map((t) => (
              <li key={t.id} className={`tactic-card tactic-card--${t.side}`}>
                <div className="tactic-card__head">
                  <h3 className="tactic__name">
                    {t.name}
                    {t.example && <span className="tag tag--example">example</span>}
                    {t.owner && t.shared && <span className="tag tag--shared">shared</span>}
                  </h3>
                  <span className="muted tactic__meta">
                    {t.side === 'attack' ? 'Attack' : 'Defense'} ·{' '}
                    {t.mapId === 'any' ? 'Any map' : MAPS_BY_ID[t.mapId]?.name ?? t.mapId}
                    {t.site ? ` · ${t.site}` : ''} · {t.owner ? `by ${t.owner}` : 'team'}
                  </span>
                </div>
                {t.description && <p className="tactic__desc">{t.description}</p>}
                {t.requiredRoles.length > 0 && (
                  <ul className="fit__roles" aria-label="Required roles">
                    {t.requiredRoles.map((r, i) => (
                      <li key={i} className={`role role--${r}`}>{ROLE_LABEL[r]}</li>
                    ))}
                  </ul>
                )}
                {shown.has(t.id) && (
                  <TacticDiagram
                    tactic={t}
                    players={lineupPlayers}
                    operatorsById={OPERATORS_BY_ID}
                    mapName={MAPS_BY_ID[t.mapId]?.name}
                    compact
                  />
                )}
                <div className="tactic-card__actions">
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    aria-expanded={shown.has(t.id)}
                    onClick={() =>
                      setShown((prev) => {
                        const next = new Set(prev);
                        if (next.has(t.id)) next.delete(t.id);
                        else next.add(t.id);
                        return next;
                      })
                    }
                  >
                    {shown.has(t.id) ? 'Hide diagram' : 'Diagram'}
                    <span className="visually-hidden"> for {t.name}</span>
                  </button>
                  {canEdit(t) && (
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(t)}>
                      Edit<span className="visually-hidden"> {t.name}</span>
                    </button>
                  )}
                  {profile && (
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() =>
                        setEditing({
                          ...t,
                          id: undefined,
                          owner: profile,
                          example: false,
                          builtin: false,
                          name: `${t.name.replace(/^\[Example\]\s*/, '')} (copy)`,
                        })
                      }
                    >
                      Duplicate<span className="visually-hidden"> {t.name}</span>
                    </button>
                  )}
                  {canEdit(t) && (
                    <button
                      type="button"
                      className="btn btn--danger btn--sm"
                      onClick={() => {
                        if (window.confirm(`Delete "${t.name}"? Everyone on the team will lose it.`)) {
                          run(() => deleteTactic(t), `Deleted "${t.name}".`);
                        }
                      }}
                    >
                      Delete<span className="visually-hidden"> {t.name}</span>
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
