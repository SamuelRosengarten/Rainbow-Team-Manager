import { useRef, useState } from 'react';
import TacticEditor from './TacticEditor.jsx';
import Notice from './Notice.jsx';
import TacticDiagram from './TacticDiagram.jsx';
import { useRoster } from '../state/roster-context.js';
import { OPERATORS_BY_ID } from '../lib/operators.js';
import { MAPS_BY_ID } from '../lib/maps.js';
import { ROLE_LABEL } from '../lib/fit.js';
import { errorMsg } from '../lib/errors.js';
import { exportTactics, parseImport, tacticsForTab } from '../lib/tactics.js';
import { msg, useI18n } from '../i18n/index.js';

const TABS = ['mine', 'team', 'profile'];

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

/** The original quick tactics: role-based tactics the Plan screen can roll. */
export default function QuickTacticsView({ profile, tacticsStore }) {
  const { t } = useI18n();
  const { tactics, saveTactic, deleteTactic, importTactics } = tacticsStore;
  const [tab, setTab] = useState('team');
  const { players, lineupPlayers } = useRoster();
  const [viewing, setViewing] = useState(() => players.find((p) => p !== profile) ?? players[0]);
  const [sideFilter, setSideFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null); // a message descriptor (or null)
  const [info, setInfo] = useState(null);
  const [shown, setShown] = useState(() => new Set());
  const fileRef = useRef(null);

  const list = tacticsForTab(tactics, { tab, profile, viewing })
    .filter((tc) => sideFilter === 'all' || tc.side === sideFilter)
    .sort(
      (a, b) =>
        a.side.localeCompare(b.side) ||
        (a.mapId || '').localeCompare(b.mapId || '') ||
        a.name.localeCompare(b.name),
    );

  const canEdit = (tc) => tc.owner === null || tc.owner === profile;

  async function run(action, success) {
    setError(null);
    setInfo(null);
    try {
      await action();
      if (success) setInfo(success);
    } catch (e) {
      setError(errorMsg(e, 'quick.failed'));
    }
  }

  async function onImport(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const owner = tab === 'mine' ? profile : null;
    const { tactics: parsed, errors } = parseImport(await file.text(), { owner });
    if (parsed.length === 0) {
      setError(errors[0] ?? msg('quick.noneInFile'));
      return;
    }
    await run(() => importTactics(parsed), msg(errors.length ? 'quick.importedSkipped' : 'quick.imported', { count: parsed.length, skipped: errors.length, errors }));
  }

  if (editing) {
    return (
      <TacticEditor
        initial={editing}
        onCancel={() => setEditing(null)}
        onSave={async (saved) => {
          await saveTactic(saved);
          setEditing(null);
          setError(null);
          setInfo(msg('quick.saved', { name: saved.name }));
        }}
      />
    );
  }

  return (
    <div className="page">
      <div className="section-bar">
        <p className="muted small section-bar__text">{t('quickTacticsView.roleBasedTacticsThePlan')}</p>
        <div className="toolbar">
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() =>
              setEditing({ owner: profile ?? null, shared: true, side: 'attack', mapId: 'any', requiredRoles: [] })
            }
          >
            {t('quickTacticsView.newTactic')}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => download('tactics.json', exportTactics(list))}
            disabled={list.length === 0}
          >
            {t('quickTacticsView.exportJson')}
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()}>
            {t('quickTacticsView.importJson')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={onImport}
            aria-label={t('quickTacticsView.importTacticsJsonFile')}
          />
        </div>
      </div>

      <div className="panel">
        <div className="tabs-row">
          <div className="segmented" role="group" aria-label={t('quickTacticsView.tacticLists')}>
            {TABS.map((id) => (
              <button key={id} type="button" aria-pressed={tab === id} className="segmented__btn" onClick={() => setTab(id)}>
                {t(`quick.tab.${id}`)}
              </button>
            ))}
          </div>
          {tab === 'profile' && (
            <label className="inline-field">
              <span className="visually-hidden">{t('quickTacticsView.player')}</span>
              <select className="select input--sm" value={viewing} onChange={(e) => setViewing(e.target.value)}>
                {players.map((p) => (
                  <option key={p} value={p}>{p === profile ? t('opsPool.you', { name: p }) : p}</option>
                ))}
              </select>
            </label>
          )}
          <label className="inline-field">
            <span className="visually-hidden">{t('quickTacticsView.side')}</span>
            <select className="select input--sm" value={sideFilter} onChange={(e) => setSideFilter(e.target.value)}>
              <option value="all">{t('quickTacticsView.bothSides')}</option>
              <option value="attack">{t('quickTacticsView.attack')}</option>
              <option value="defend">{t('quickTacticsView.defense')}</option>
            </select>
          </label>
        </div>

        <Notice onDismiss={() => setError(null)}>{error}</Notice>
        {info && <Notice kind="ok" onDismiss={() => setInfo(null)}>{info}</Notice>}
        {tab === 'mine' && !profile && <Notice kind="info">{t('quickTacticsView.pickAProfileToSee')}</Notice>}

        {list.length === 0 ? (
          <p className="empty">{t('quickTacticsView.noTacticsHereYet')}</p>
        ) : (
          <ul className="tactic-list">
            {list.map((tc) => (
              <li key={tc.id} className={`tactic-card tactic-card--${tc.side}`}>
                <div className="tactic-card__head">
                  <h3 className="tactic__name">
                    {tc.name}
                    {tc.example && <span className="tag tag--example">{t('quick.tag.example')}</span>}
                    {tc.owner && tc.shared && <span className="tag tag--shared">{t('quick.tag.shared')}</span>}
                  </h3>
                  <span className="muted tactic__meta">
                    {[
                      t(tc.side === 'attack' ? 'card.side.attack' : 'card.side.defend'),
                      [tc.mapId === 'any' ? t('card.anyMap') : MAPS_BY_ID[tc.mapId]?.name ?? tc.mapId, tc.site].filter(Boolean).join(' · '),
                      tc.owner ? t('quick.by', { owner: tc.owner }) : t('quick.team'),
                    ].join(' · ')}
                  </span>
                </div>
                {tc.description && <p className="tactic__desc">{tc.description}</p>}
                {tc.requiredRoles.length > 0 && (
                  <ul className="fit__roles" aria-label={t('quick.requiredRoles')}>
                    {tc.requiredRoles.map((r, i) => (
                      <li key={i} className={`role role--${r}`}>{ROLE_LABEL[r]}</li>
                    ))}
                  </ul>
                )}
                {shown.has(tc.id) && (
                  <TacticDiagram
                    tactic={tc}
                    players={lineupPlayers}
                    operatorsById={OPERATORS_BY_ID}
                    mapName={MAPS_BY_ID[tc.mapId]?.name}
                    compact
                  />
                )}
                <div className="tactic-card__actions">
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    aria-expanded={shown.has(tc.id)}
                    aria-label={t(shown.has(tc.id) ? 'quick.hideDiagramAria' : 'quick.diagramAria', { name: tc.name })}
                    onClick={() =>
                      setShown((prev) => {
                        const next = new Set(prev);
                        if (next.has(tc.id)) next.delete(tc.id);
                        else next.add(tc.id);
                        return next;
                      })
                    }
                  >
                    {shown.has(tc.id) ? t('quick.hideDiagram') : t('quick.diagram')}
                  </button>
                  {canEdit(tc) && (
                    <button type="button" className="btn btn--ghost btn--sm" aria-label={t('quick.editAria', { name: tc.name })} onClick={() => setEditing(tc)}>
                      {t('ui.edit')}
                    </button>
                  )}
                  {profile && (
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      aria-label={t('quick.duplicateAria', { name: tc.name })}
                      onClick={() =>
                        setEditing({
                          ...tc,
                          id: undefined,
                          owner: profile,
                          example: false,
                          builtin: false,
                          name: t('strategy.copyTitle', { title: tc.name.replace(/^\[Example\]\s*/, '') }),
                        })
                      }
                    >
                      {t('quick.duplicate')}
                    </button>
                  )}
                  {canEdit(tc) && (
                    <button
                      type="button"
                      className="btn btn--danger btn--sm"
                      aria-label={t('quick.deleteAria', { name: tc.name })}
                      onClick={() => {
                        if (window.confirm(t('quick.deleteConfirm', { name: tc.name }))) {
                          run(() => deleteTactic(tc), msg('quick.deleted', { name: tc.name }));
                        }
                      }}
                    >
                      {t('ui.delete')}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
