import { useState } from 'react';
import { useRoster } from '../state/roster-context.js';
import { MAPS_BY_ID } from '../lib/maps.js';
import { errorMsg } from '../lib/errors.js';
import { useI18n } from '../i18n/index.js';

/**
 * Notes for the selected map. "Team" notes are shared; each profile also has
 * their own notes, which teammates can read but only the owner edits.
 */
export default function MapNotes({ mapId, currentProfile, getNotes, saveNotes }) {
  const { t, tm } = useI18n();
  const { players } = useRoster();
  const [owner, setOwner] = useState(null); // null = team
  const [draft, setDraft] = useState(null); // null = not editing
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const map = MAPS_BY_ID[mapId];
  if (!map) return null;

  const text = getNotes(owner, mapId);
  const canEdit = owner === null || owner === currentProfile;
  // team / mine / someone else's: each its own message (word order differs by language)
  const kind = owner === null ? 'team' : owner === currentProfile ? 'mine' : 'other';
  const values = { map: map.name, player: owner ?? '' };

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await saveNotes(owner, mapId, draft.trim());
      setDraft(null);
    } catch (e) {
      setError(errorMsg(e, 'notes.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="notes-title">
      <div className="panel__head">
        <h2 id="notes-title" className="panel__title">{t('notes.heading', { map: map.name })}</h2>
        <label className="visually-hidden" htmlFor="notes-owner">{t('mapNotes.whoseNotes')}</label>
        <select
          id="notes-owner"
          className="select input--sm notes-owner"
          value={owner ?? ''}
          onChange={(e) => {
            setOwner(e.target.value || null);
            setDraft(null);
          }}
        >
          <option value="">{t('mapNotes.teamNotes')}</option>
          {players.map((p) => (
            <option key={p} value={p}>{t(p === currentProfile ? 'notes.owner.mine' : 'notes.owner.other', { player: p })}</option>
          ))}
        </select>
      </div>

      {error && <p className="notice notice--error" role="alert">{tm(error)}</p>}

      {draft !== null ? (
        <div className="notes-edit">
          <label className="visually-hidden" htmlFor="notes-text">{t(`notes.label.${kind}`, values)}</label>
          <textarea
            id="notes-text"
            className="textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('mapNotes.rotationsCommonRoamSpotsBreach')}
            maxLength={4000}
          />
          <div className="actions">
            <button type="button" className="btn btn--secondary btn--sm" onClick={save} disabled={saving}>
              {saving ? t('mapNotes.saving') : t('mapNotes.saveNotes')}
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDraft(null)} disabled={saving}>
              {t('mapNotes.cancel')}
            </button>
          </div>
        </div>
      ) : text ? (
        <>
          <p className="notes-text">{text}</p>
          {canEdit && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDraft(text)}>
              {t(`notes.edit.${kind}`, values)}
            </button>
          )}
        </>
      ) : canEdit ? (
        <button type="button" className="add-notes" onClick={() => setDraft('')}>
          <span aria-hidden="true">＋</span> {t('notes.add', values)}
        </button>
      ) : (
        <p className="empty">{t('notes.none', values)}</p>
      )}
    </section>
  );
}
