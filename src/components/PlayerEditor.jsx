import { useState } from 'react';
import PlayerStats from './PlayerStats.jsx';
import { Sheet } from './ui.jsx';
import { AVAILABILITY, LINEUP_SIZE, MAIN_ROLES, PLAYER_STATUS, nameError } from '../lib/roster.js';
import { PLATFORMS } from '../lib/playerStats.js';
import { STATS_CONFIGURED, STATS_REASON, lookupPlayer } from '../lib/statsProvider.js';

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

/**
 * Add a player (no `player`) or edit one. Names can't change once created.
 * Ubisoft username + platform + "Find Player" fills in the stats; if the
 * player can't be found they are still added, just without stats.
 */
export default function PlayerEditor({ player, roster, detailsEnabled, onSave, onClose }) {
  const isNew = !player;
  const startersElsewhere = roster.filter((p) => p.status === 'starter' && p.name !== player?.name).length;
  const [form, setForm] = useState(() => ({
    name: player?.name ?? '',
    username: player?.username ?? '',
    platform: player?.platform ?? 'pc',
    stats: player?.stats ?? null,
    statsUpdatedAt: player?.statsUpdatedAt ?? null,
    mainRole: player?.mainRole ?? '',
    status: player?.status ?? (startersElsewhere >= LINEUP_SIZE ? 'sub' : 'starter'),
    availability: player?.availability ?? 'available',
    notes: player?.notes ?? '',
  }));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [finding, setFinding] = useState(false);
  const [lookup, setLookup] = useState(null); // null | { ok: true } | { ok: false, reason }
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function find() {
    setFinding(true);
    setLookup(null);
    const res = await lookupPlayer(form.username, form.platform);
    setLookup(res);
    if (res.ok) {
      setForm((f) => ({
        ...f,
        stats: res.stats,
        statsUpdatedAt: new Date().toISOString(),
        // A new player takes their Ubisoft name as the app name unless one was typed.
        name: isNew && !f.name.trim() ? f.username.trim().slice(0, 24) : f.name,
      }));
    }
    setFinding(false);
  }

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
      const username = details.username.trim();
      // Stats belong to the username and platform they were found for.
      const current = details.stats && details.stats.username === username && details.stats.platform === details.platform;
      await onSave(name.trim(), {
        ...details,
        username,
        notes: details.notes.trim(),
        stats: current ? details.stats : null,
        statsUpdatedAt: current ? details.statsUpdatedAt : null,
      });
    } catch (err) {
      setError(err.message || 'Could not save the player.');
      setSaving(false);
    }
  }

  const staleStats = form.stats && (form.stats.username !== form.username.trim() || form.stats.platform !== form.platform);

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
        {!detailsEnabled && (
          <p className="notice notice--warn" role="status">
            Ubisoft username, role, status, availability and notes need the latest database setup. Re-run <code>supabase/schema.sql</code>.
          </p>
        )}
        <fieldset className="form" disabled={!detailsEnabled}>
          <label className="field">
            <span className="field__label">Ubisoft username</span>
            <input
              className="input"
              value={form.username}
              onChange={(e) => set({ username: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && form.username.trim()) {
                  e.preventDefault();
                  find();
                }
              }}
              maxLength={40}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              autoFocus
              placeholder="e.g. Samuie"
            />
          </label>
          <div className="find-row">
            <label className="field">
              <span className="field__label">Platform</span>
              <select className="select" value={form.platform} onChange={(e) => set({ platform: e.target.value })}>
                {Object.entries(PLATFORMS).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {STATS_CONFIGURED && (
              <button type="button" className="btn btn--secondary" onClick={find} disabled={finding || !form.username.trim()}>
                {finding ? 'Searching…' : 'Find Player'}
              </button>
            )}
          </div>
          {!STATS_CONFIGURED && <p className="muted small">{STATS_REASON['not-configured']} The username is still saved, and stats aren't needed to use the team manager.</p>}
          {lookup && !lookup.ok && (
            <p className="notice notice--warn" role="status">
              Stats unavailable. {STATS_REASON[lookup.reason]} {isNew ? 'You can still add the player without stats.' : 'The player is unaffected.'}
            </p>
          )}
          {form.stats && (
            <div className="found" role="status">
              {lookup?.ok && <p className="found__title">Found {form.stats.username}</p>}
              {staleStats && <p className="muted small">These stats are for “{form.stats.username}”. Press Find Player to update them.</p>}
              <PlayerStats player={{ ...form, name: form.name || form.username }} />
            </div>
          )}

          {isNew && (
            <label className="field">
              <span className="field__label">Name in the app</span>
              <input className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} maxLength={24} autoComplete="off" placeholder="e.g. Alex" />
              <span className="field__hint">This can't be changed later. It's how the app knows who's who.</span>
            </label>
          )}
          <label className="field">
            <span className="field__label">Main role</span>
            <select className="select" value={form.mainRole} onChange={(e) => set({ mainRole: e.target.value })}>
              <option value="">{form.stats ? 'Work it out from their stats' : 'Not set'}</option>
              {Object.entries(MAIN_ROLES).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Choice label="Status" options={PLAYER_STATUS} value={form.status} onChange={(status) => set({ status })} />
          <Choice label="Availability" options={AVAILABILITY} value={form.availability} onChange={(availability) => set({ availability })} />
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
