import { useState } from 'react';
import { useRoster } from '../state/roster-context.js';
import { MAPS_BY_ID } from '../lib/maps.js';

/**
 * Notes for the selected map. "Team" notes are shared; each profile also has
 * their own notes, which teammates can read but only the owner edits.
 */
export default function MapNotes({ mapId, currentProfile, getNotes, saveNotes }) {
  const { players } = useRoster();
  const [owner, setOwner] = useState(null); // null = team
  const [draft, setDraft] = useState(null); // null = not editing
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const map = MAPS_BY_ID[mapId];
  if (!map) return null;

  const text = getNotes(owner, mapId);
  const canEdit = owner === null || owner === currentProfile;
  const ownerLabel = owner === null ? 'Team' : owner === currentProfile ? 'My' : `${owner}'s`;

  async function save() {
    setSaving(true);
    setError('');
    try {
      await saveNotes(owner, mapId, draft.trim());
      setDraft(null);
    } catch (e) {
      setError(e.message || 'Could not save notes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="notes-title">
      <div className="panel__head">
        <h2 id="notes-title" className="panel__title">{map.name} notes</h2>
        <label className="visually-hidden" htmlFor="notes-owner">Whose notes</label>
        <select
          id="notes-owner"
          className="select input--sm notes-owner"
          value={owner ?? ''}
          onChange={(e) => {
            setOwner(e.target.value || null);
            setDraft(null);
          }}
        >
          <option value="">Team notes</option>
          {players.map((p) => (
            <option key={p} value={p}>{p === currentProfile ? `My notes (${p})` : `${p}'s notes`}</option>
          ))}
        </select>
      </div>

      {error && <p className="notice notice--error" role="alert">{error}</p>}

      {draft !== null ? (
        <div className="notes-edit">
          <label className="visually-hidden" htmlFor="notes-text">{ownerLabel} notes for {map.name}</label>
          <textarea
            id="notes-text"
            className="textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Rotations, common roam spots, breach points…"
            maxLength={4000}
          />
          <div className="actions">
            <button type="button" className="btn btn--secondary btn--sm" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save notes'}
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDraft(null)} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      ) : text ? (
        <>
          <p className="notes-text">{text}</p>
          {canEdit && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDraft(text)}>
              Edit {ownerLabel.toLowerCase()} notes
            </button>
          )}
        </>
      ) : canEdit ? (
        <button type="button" className="add-notes" onClick={() => setDraft('')}>
          <span aria-hidden="true">＋</span> Add notes for {map.name}
        </button>
      ) : (
        <p className="empty">{owner} hasn’t written notes for {map.name}.</p>
      )}
    </section>
  );
}
