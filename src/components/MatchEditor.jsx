import { useState } from 'react';
import { Sheet } from './ui.jsx';
import { MAPS } from '../lib/maps.js';
import { MATCH_STATUS, defaultKickoff, normalizeMatch, toLocalInput } from '../lib/matches.js';

/** Create or edit a match. `initial` without an id creates a new one. */
export default function MatchEditor({ initial, competitions = [], onSave, onClose }) {
  const [form, setForm] = useState(() => ({
    opponent: initial.opponent ?? '',
    when: toLocalInput(initial.scheduledAt ?? defaultKickoff()),
    competition: initial.competition ?? '',
    mapId: initial.mapId ?? '',
    status: initial.status ?? 'scheduled',
    scoreUs: initial.scoreUs ?? '',
    scoreThem: initial.scoreThem ?? '',
    notes: initial.notes ?? '',
  }));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const isNew = !initial.id;

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      const match = normalizeMatch({ ...initial, ...form, scheduledAt: new Date(form.when) });
      setSaving(true);
      await onSave(match);
    } catch (err) {
      setError(err.message || 'Could not save the match.');
      setSaving(false);
    }
  }

  return (
    <Sheet
      title={isNew ? 'Schedule match' : 'Edit match'}
      onClose={onClose}
      labelId="match-editor-title"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="match-form" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Schedule' : 'Save'}
          </button>
        </>
      }
    >
      <form id="match-form" className="form" onSubmit={submit} noValidate>
        {error && (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        )}
        <label className="field">
          <span className="field__label">Opponent</span>
          <input
            className="input"
            value={form.opponent}
            onChange={(e) => set({ opponent: e.target.value })}
            maxLength={80}
            required
            autoFocus={isNew}
            placeholder="Team name"
          />
        </label>
        <div className="field-row">
          <label className="field">
            <span className="field__label">Date and time</span>
            <input
              className="input"
              type="datetime-local"
              value={form.when}
              onChange={(e) => set({ when: e.target.value })}
              required
            />
          </label>
          <label className="field">
            <span className="field__label">Competition</span>
            <input
              className="input"
              value={form.competition}
              onChange={(e) => set({ competition: e.target.value })}
              maxLength={80}
              list="competition-list"
              placeholder="Scrim, league, cup…"
            />
            <datalist id="competition-list">
              {competitions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span className="field__label">Map</span>
            <select className="select" value={form.mapId} onChange={(e) => set({ mapId: e.target.value })}>
              <option value="">Not decided</option>
              {MAPS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Status</span>
            <select className="select" value={form.status} onChange={(e) => set({ status: e.target.value })}>
              {Object.entries(MATCH_STATUS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {form.status === 'completed' && (
          <fieldset className="score-fields">
            <legend>Final score (rounds)</legend>
            <label className="field">
              <span className="field__label">Us</span>
              <input
                className="input input--score"
                type="number"
                inputMode="numeric"
                min={0}
                max={99}
                value={form.scoreUs}
                onChange={(e) => set({ scoreUs: e.target.value })}
              />
            </label>
            <span className="score-fields__dash" aria-hidden="true">–</span>
            <label className="field">
              <span className="field__label">Them</span>
              <input
                className="input input--score"
                type="number"
                inputMode="numeric"
                min={0}
                max={99}
                value={form.scoreThem}
                onChange={(e) => set({ scoreThem: e.target.value })}
              />
            </label>
          </fieldset>
        )}
        <label className="field">
          <span className="field__label">Notes</span>
          <textarea
            className="textarea"
            value={form.notes}
            onChange={(e) => set({ notes: e.target.value })}
            maxLength={4000}
            placeholder="Server, lobby details, who hosts, what to review afterwards…"
          />
        </label>
      </form>
    </Sheet>
  );
}
