import { useState } from 'react';
import { Sheet } from './ui.jsx';
import { AVAILABILITY, LINEUP_SIZE, MAIN_ROLES, PLAYER_STATUS, nameError } from '../lib/roster.js';

function Choice({ label, options, value, onChange }) {
  return (
    <fieldset className="field">
      <legend className="field__label">{label}</legend>
      <div className="segmented segmented--full" role="group">
        {Object.entries(options).map(([id, text]) => (
          <button key={id} type="button" className="segmented__btn" aria-pressed={value === id} onClick={() => onChange(id)}>
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Add a player (no `player`) or edit one. Names can't change once created. */
export default function PlayerEditor({ player, roster, detailsEnabled, onSave, onClose }) {
  const isNew = !player;
  const startersElsewhere = roster.filter((p) => p.status === 'starter' && p.name !== player?.name).length;
  const [form, setForm] = useState(() => ({
    name: player?.name ?? '',
    username: player?.username ?? '',
    mainRole: player?.mainRole ?? '',
    status: player?.status ?? (startersElsewhere >= LINEUP_SIZE ? 'sub' : 'starter'),
    availability: player?.availability ?? 'available',
    notes: player?.notes ?? '',
  }));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (isNew) {
      const problem = nameError(form.name, roster);
      if (problem) return setError(problem);
    }
    if (form.status === 'starter' && startersElsewhere >= LINEUP_SIZE) {
      return setError(`There are already ${LINEUP_SIZE} starters. Make someone a substitute first.`);
    }
    setSaving(true);
    try {
      const { name, ...details } = form;
      await onSave(name.trim(), { ...details, username: details.username.trim(), notes: details.notes.trim() });
    } catch (err) {
      setError(err.message || 'Could not save the player.');
      setSaving(false);
    }
  }

  return (
    <Sheet
      title={isNew ? 'Add player' : `Edit ${player.name}`}
      onClose={onClose}
      labelId="player-editor-title"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="player-form" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Add player' : 'Save'}
          </button>
        </>
      }
    >
      <form id="player-form" className="form" onSubmit={submit} noValidate>
        {error && (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        )}
        {isNew && (
          <label className="field">
            <span className="field__label">Name in the app</span>
            <input
              className="input"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              maxLength={24}
              autoFocus
              autoComplete="off"
              placeholder="e.g. Alex"
            />
            <span className="field__hint">This can't be changed later. It's how the app knows who's who.</span>
          </label>
        )}
        {!detailsEnabled && (
          <p className="notice notice--warn" role="status">
            Role, status, availability and notes need the latest database setup. Re-run <code>supabase/schema.sql</code>.
          </p>
        )}
        <fieldset className="form" disabled={!detailsEnabled}>
          <label className="field">
            <span className="field__label">Ubisoft username</span>
            <input
              className="input"
              value={form.username}
              onChange={(e) => set({ username: e.target.value })}
              maxLength={40}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="Used for the R6 Tracker link"
            />
          </label>
          <label className="field">
            <span className="field__label">Main role</span>
            <select className="select" value={form.mainRole} onChange={(e) => set({ mainRole: e.target.value })}>
              <option value="">Not set</option>
              {Object.entries(MAIN_ROLES).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Choice label="Status" options={PLAYER_STATUS} value={form.status} onChange={(status) => set({ status })} />
          <Choice
            label="Availability"
            options={AVAILABILITY}
            value={form.availability}
            onChange={(availability) => set({ availability })}
          />
          <label className="field">
            <span className="field__label">Notes</span>
            <textarea
              className="textarea"
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
              maxLength={2000}
              placeholder="Strengths, what to work on, when they can play…"
            />
          </label>
        </fieldset>
      </form>
    </Sheet>
  );
}
