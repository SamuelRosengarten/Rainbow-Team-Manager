import { useState } from 'react';
import { MAPS, sitesFor } from '../lib/maps.js';
import { ROLES, ROLE_LABEL } from '../lib/fit.js';
import { normalizeTactic } from '../lib/tactics.js';

const countRoles = (roles) => Object.fromEntries(ROLES.map((r) => [r, roles.filter((x) => x === r).length]));

export default function TacticEditor({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({
    name: initial.name ?? '',
    side: initial.side ?? 'attack',
    mapId: initial.mapId ?? 'any',
    site: initial.site ?? '',
    description: initial.description ?? '',
    imageUrl: initial.imageUrl ?? '',
    roleCounts: countRoles(initial.requiredRoles ?? []),
    shared: initial.shared ?? true,
  }));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const sites = form.mapId === 'any' ? [] : sitesFor(form.mapId, form.side);
  const totalRoles = Object.values(form.roleCounts).reduce((a, b) => a + b, 0);
  const teamOwned = initial.owner === null && Boolean(initial.id);

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      const requiredRoles = ROLES.flatMap((r) => Array(form.roleCounts[r]).fill(r));
      const tactic = normalizeTactic(
        {
          ...initial,
          ...form,
          site: sites.includes(form.site) ? form.site : '',
          requiredRoles,
          shared: teamOwned ? true : form.shared,
          owner: initial.owner ?? null,
          // Renaming away from "[Example] ..." marks it as your own tactic.
          example: Boolean(initial.example) && /^\[Example\]/i.test(form.name.trim()),
        },
      );
      setSaving(true);
      await onSave(tactic);
    } catch (err) {
      setError(err.message || 'Could not save the tactic.');
      setSaving(false);
    }
  }

  return (
    <form className="panel editor" onSubmit={submit} aria-labelledby="editor-title">
      <div className="panel__head">
        <h2 id="editor-title" className="panel__title">{initial.id ? 'Edit tactic' : 'New tactic'}</h2>
      </div>
      {error && <p className="notice notice--error" role="alert">{error}</p>}

      <div className="editor__grid">
        <label className="field">
          <span className="field__label">Name</span>
          <input className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} required maxLength={120} />
        </label>

        <div className="field-row">
          <label className="field">
            <span className="field__label">Side</span>
            <select className="select" value={form.side} onChange={(e) => set({ side: e.target.value, site: '' })}>
              <option value="attack">Attack</option>
              <option value="defend">Defense</option>
            </select>
          </label>
          <label className="field">
            <span className="field__label">Map</span>
            <select className="select" value={form.mapId} onChange={(e) => set({ mapId: e.target.value, site: '' })}>
              <option value="any">Any map (generic)</option>
              {MAPS.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Site</span>
            <select
              className="select"
              value={form.site}
              onChange={(e) => set({ site: e.target.value })}
              disabled={sites.length === 0}
            >
              <option value="">{form.mapId !== 'any' && sites.length === 0 ? 'No sites defined' : 'Any site'}</option>
              {sites.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span className="field__label">Description</span>
          <textarea
            className="textarea"
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
            maxLength={4000}
            placeholder="Who does what, where the breach goes, when to plant…"
          />
        </label>

        <label className="field">
          <span className="field__label">Map image link (optional)</span>
          <input
            className="input"
            type="url"
            inputMode="url"
            placeholder="https://… screenshot of the site with your setup drawn on it"
            value={form.imageUrl}
            onChange={(e) => set({ imageUrl: e.target.value })}
            maxLength={1000}
          />
          <span className="muted small">
            Shown above the auto-generated diagram. Use any https image link (Imgur, Discord, a strat tool export…).
          </span>
          {/^https:\/\/\S+$/i.test(form.imageUrl.trim()) && (
            <img className="editor__preview" src={form.imageUrl.trim()} alt="Map image preview" />
          )}
        </label>

        <fieldset>
          <legend>Required roles ({totalRoles}/5)</legend>
          <div className="role-steppers">
            {ROLES.map((r) => (
              <label key={r} className="role-stepper">
                <span className={`role role--${r}`}>{ROLE_LABEL[r]}</span>
                <input
                  className="input input--sm"
                  type="number"
                  min={0}
                  max={5}
                  value={form.roleCounts[r]}
                  onChange={(e) => {
                    const n = Math.max(0, Math.min(5, Number(e.target.value) || 0));
                    set({ roleCounts: { ...form.roleCounts, [r]: n } });
                  }}
                  aria-label={`${ROLE_LABEL[r]} count`}
                />
              </label>
            ))}
          </div>
          {totalRoles > 5 && <p className="notice notice--warn">A team has 5 players. Use at most 5 roles.</p>}
        </fieldset>

        {teamOwned ? (
          <p className="muted">Team tactic: always visible to everyone.</p>
        ) : (
          <label className="checkbox">
            <input type="checkbox" checked={form.shared} onChange={(e) => set({ shared: e.target.checked })} />
            Shared with team (shows in Team tactics and team tactic rolls)
          </label>
        )}
      </div>

      <div className="actions">
        <button type="submit" className="btn btn--secondary" disabled={saving || totalRoles > 5}>
          {saving ? 'Saving…' : 'Save tactic'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}
