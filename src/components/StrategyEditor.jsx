import { useState } from 'react';
import BoardEditor from './BoardEditor.jsx';
import Icon from './Icon.jsx';
import { OriginBadge } from './StrategyCard.jsx';
import { DetailsForm, SquadForm, StepsForm } from './StrategyForms.jsx';
import { MAPS_BY_ID } from '../lib/maps.js';
import { attribution, cleanDraft } from '../lib/strategies.js';
import { useHistory } from '../state/useHistory.js';
import { useI18n } from '../i18n/index.js';

const TABS = [
  { id: 'board', icon: 'map' },
  { id: 'steps', icon: 'timer' },
  { id: 'squad', icon: 'users' },
  { id: 'details', icon: 'edit' },
];

/**
 * Edit a team strategy: the tactical map (with undo/redo), steps with round
 * clock and per-operator actions, the squad, and details. Saves the whole
 * document at once.
 */
export default function StrategyEditor({ initial, isNew, strategyData, onSaved, onCancel }) {
  const { t } = useI18n();
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
      setError(e.message || t('strategy.saveFailed'));
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
        <h1 className="page__title">{isNew ? t('strategyEditor.newStrategy') : draft.title || t('strategyEditor.strategy')}</h1>
      </header>
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
      <div className="tabs editor-tabs" role="group" aria-label={t('strategyEditor.editorSections')}>
        {TABS.map((tb) => (
          <button key={tb.id} type="button" className="tabs__btn" aria-pressed={tab === tb.id} onClick={() => setTab(tb.id)}>
            <Icon name={tb.icon} size={16} /> {t(`editor.tab.${tb.id}`)}
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
          {t('strategyEditor.cancel')}
        </button>
        <button type="button" className="btn btn--ghost" onClick={history.undo} disabled={!history.canUndo || saving}>
          <Icon name="undo" size={16} /> {t('strategyEditor.undo')}
        </button>
        <button type="button" className="btn btn--primary" onClick={save} disabled={saving || !strategyData.canSave}>
          {saving ? t('strategyEditor.saving') : t('strategyEditor.saveStrategy')}
        </button>
      </div>
    </div>
  );
}
