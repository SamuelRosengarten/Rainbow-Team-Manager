import { useState } from 'react';
import { MAPS, sitesFor } from '../lib/maps.js';
import { ROLES, ROLE_LABEL } from '../lib/fit.js';
import { normalizeTactic } from '../lib/tactics.js';
import { useI18n } from '../i18n/index.js';

const countRoles = (roles) => Object.fromEntries(ROLES.map((r) => [r, roles.filter((x) => x === r).length]));

export default function TacticEditor({ initial, onSave, onCancel }) {
  const { t } = useI18n();
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
      setError(err.message || t('tacticEditor.saveFailed'));
      setSaving(false);
    }
  }

  return (
    <form className="panel editor" onSubmit={submit} aria-labelledby="editor-title">
      <div className="panel__head">
        <h2 id="editor-title" className="panel__title">{initial.id ? t('tacticEditor.editTactic') : t('tacticEditor.newTactic')}</h2>
      </div>
      {error && <p className="notice notice--error" role="alert">{error}</p>}

      <div className="editor__grid">
        <label className="field">
          <span className="field__label">{t('tacticEditor.name')}</span>
          <input className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} required maxLength={120} />
        </label>

        <div className="field-row">
          <label className="field">
            <span className="field__label">{t('tacticEditor.side')}</span>
            <select className="select" value={form.side} onChange={(e) => set({ side: e.target.value, site: '' })}>
              <option value="attack">{t('tacticEditor.attack')}</option>
              <option value="defend">{t('tacticEditor.defense')}</option>
            </select>
          </label>
          <label className="field">
            <span className="field__label">{t('tacticEditor.map')}</span>
            <select className="select" value={form.mapId} onChange={(e) => set({ mapId: e.target.value, site: '' })}>
              <option value="any">{t('tacticEditor.anyMapGeneric')}</option>
              {MAPS.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">{t('tacticEditor.site')}</span>
            <select
              className="select"
              value={form.site}
              onChange={(e) => set({ site: e.target.value })}
              disabled={sites.length === 0}
            >
              <option value="">{form.mapId !== 'any' && sites.length === 0 ? t('tacticEditor.noSitesDefined') : t('tacticEditor.anySite')}</option>
              {sites.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span className="field__label">{t('tacticEditor.description')}</span>
          <textarea
            className="textarea"
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
            maxLength={4000}
            placeholder={t('tacticEditor.whoDoesWhatWhereThe')}
          />
        </label>

        <label className="field">
          <span className="field__label">{t('tacticEditor.mapImageLinkOptional')}</span>
          <input
            className="input"
            type="url"
            inputMode="url"
            placeholder={t('tacticEditor.httpsScreenshotOfTheSite')}
            value={form.imageUrl}
            onChange={(e) => set({ imageUrl: e.target.value })}
            maxLength={1000}
          />
          <span className="muted small">
            {t('tacticEditor.shownAboveTheAutoGenerated')}
          </span>
          {/^https:\/\/\S+$/i.test(form.imageUrl.trim()) && (
            <img className="editor__preview" src={form.imageUrl.trim()} alt={t('tacticEditor.mapImagePreview')} />
          )}
        </label>

        <fieldset>
          <legend>{t('tacticEditor.requiredRoles', { total: totalRoles })}</legend>
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
                  aria-label={t('tacticEditor.roleCount', { role: ROLE_LABEL[r] })}
                />
              </label>
            ))}
          </div>
          {totalRoles > 5 && <p className="notice notice--warn">{t('tacticEditor.aTeamHas5Players')}</p>}
        </fieldset>

        {teamOwned ? (
          <p className="muted">{t('tacticEditor.teamTacticAlwaysVisibleTo')}</p>
        ) : (
          <label className="checkbox">
            <input type="checkbox" checked={form.shared} onChange={(e) => set({ shared: e.target.checked })} />
            {t('tacticEditor.sharedWithTeamShowsIn')}
          </label>
        )}
      </div>

      <div className="actions">
        <button type="submit" className="btn btn--secondary" disabled={saving || totalRoles > 5}>
          {saving ? t('tacticEditor.saving') : t('tacticEditor.saveTactic')}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={saving}>
          {t('tacticEditor.cancel')}
        </button>
      </div>
    </form>
  );
}
