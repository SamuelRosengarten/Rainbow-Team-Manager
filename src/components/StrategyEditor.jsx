import { useState } from 'react';
import BoardEditor from './BoardEditor.jsx';
import Icon from './Icon.jsx';
import { OriginBadge } from './StrategyCard.jsx';
import { DetailsForm, SquadForm, StepsForm } from './StrategyForms.jsx';
import { MAPS_BY_ID } from '../lib/maps.js';
import { attribution, cleanDraft } from '../lib/strategies.js';
import { useHistory } from '../state/useHistory.js';

const TABS = [
  { id: 'board', label: 'Tactical map', icon: 'map' },
  { id: 'steps', label: 'Steps & timing', icon: 'timer' },
  { id: 'squad', label: 'Squad', icon: 'users' },
  { id: 'details', label: 'Details', icon: 'edit' },
];

/**
 * Edit a team strategy: the tactical map (with undo/redo), steps with round
 * clock and per-operator actions, the squad, and details. Saves the whole
 * document at once.
 */
export default function StrategyEditor({ initial, isNew, strategyData, onSaved, onCancel }) {
  const history = useHistory(initial);
  const draft = history.value;
  const [tab, setTab] = useState(isNew ? 'details' : 'board');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const mapName = MAPS_BY_ID[draft.mapId]?.name ?? '';

  async function save() {
    setError('');
    setSaving(true);
    try {
      const clean = cleanDraft(draft);
      await strategyData.saveStrategy({ ...clean, owner: draft.owner ?? null });
      onSaved(clean);
    } catch (e) {
      setError(e.message || 'Could not save the strategy.');
      setSaving(false);
    }
  }

  return (
    <div className="strat-editor">
      <header className="strat-detail__head">
        <div className="strat-detail__badges">
          <OriginBadge strategy={draft} />
          {draft.version > 1 && <span className="version-chip">v{draft.version}</span>}
          <span className="muted small">{attribution(draft)}</span>
        </div>
        <h1 className="page__title">{isNew ? 'New strategy' : draft.title || 'Strategy'}</h1>
      </header>
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
      <div className="segmented segmented--full editor-tabs" role="group" aria-label="Editor sections">
        {TABS.map((t) => (
          <button key={t.id} type="button" className="segmented__btn" aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
            <Icon name={t.icon} size={16} /> {t.label}
          </button>
        ))}
      </div>
      {tab === 'board' ? (
        <BoardEditor draft={draft} history={history} mapName={mapName} />
      ) : (
        <section className="panel">
          {tab === 'details' && <DetailsForm draft={draft} set={history.set} />}
          {tab === 'squad' && <SquadForm draft={draft} set={history.set} />}
          {tab === 'steps' && <StepsForm draft={draft} set={history.set} />}
        </section>
      )}
      <div className="strat-actions strat-actions--sticky">
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="button" className="btn btn--ghost" onClick={history.undo} disabled={!history.canUndo || saving}>
          <Icon name="undo" size={16} /> Undo
        </button>
        <button type="button" className="btn btn--primary" onClick={save} disabled={saving || !strategyData.canSave}>
          {saving ? 'Saving…' : 'Save strategy'}
        </button>
      </div>
    </div>
  );
}
