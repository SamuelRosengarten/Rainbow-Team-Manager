import { useState } from 'react';
import { Sheet } from './ui.jsx';
import { MAPS, sitesFor } from '../lib/maps.js';
import { operatorsForSide } from '../lib/operators.js';
import { STRATEGY_TYPES, createStrategy, newId } from '../lib/strategies.js';
import { useI18n } from '../i18n/index.js';
import { T } from '../i18n/Rich.jsx';
import { CodedError } from '../lib/errors.js';

/**
 * Add (or edit) a link to a strategy found online. Only metadata is stored:
 * where it is, what it covers and which operators it uses. The text and
 * positions stay on the original page.
 */
export default function ReferenceForm({ initial, defaults = {}, profile, onSave, onClose }) {
  const { t } = useI18n();
  const [form, setForm] = useState(() => ({
    sourceName: initial?.sourceName ?? '',
    sourceUrl: initial?.sourceUrl ?? '',
    sourceTitle: initial?.sourceTitle ?? '',
    title: initial?.title ?? '',
    mapId: initial?.mapId ?? defaults.mapId ?? 'any',
    site: initial?.site ?? defaults.site ?? '',
    side: initial?.side ?? defaults.side ?? 'attack',
    type: initial?.type ?? 'execute',
    summary: initial?.summary ?? '',
    operators: initial ? initial.slots.map((s) => s.operatorId) : [],
  }));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const sites = form.mapId !== 'any' ? sitesFor(form.mapId, form.side) : [];
  const ops = operatorsForSide(form.side);

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      if (!/^https:\/\/\S+$/i.test(form.sourceUrl.trim())) throw new CodedError('ref.badLink');
      if (!form.sourceName.trim()) throw new CodedError('ref.noSource');
      const operators = form.operators.filter(Boolean);
      const strategy = createStrategy({
        ...(initial ?? {}),
        id: initial?.id ?? newId('ref'),
        origin: 'reference',
        title: form.title.trim() || form.sourceTitle.trim(),
        mapId: form.mapId,
        site: form.site,
        floor: '',
        side: form.side,
        type: form.type,
        summary: form.summary,
        sourceName: form.sourceName,
        sourceUrl: form.sourceUrl.trim(),
        sourceTitle: form.sourceTitle,
        license: 'link-only',
        tags: ['external'],
        slots: operators.map((id, i) => ({ key: `s${i + 1}`, operatorId: id })),
        steps: [],
        markers: [],
        paths: [],
        owner: initial?.owner ?? profile,
      });
      setSaving(true);
      await onSave(strategy);
    } catch (err) {
      setError(err.message || t('ref.saveFailed'));
      setSaving(false);
    }
  }

  return (
    <Sheet
      title={initial ? t('ref.titleEdit') : t('ref.titleAdd')}
      onClose={onClose}
      labelId="ref-title"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>
            {t('referenceForm.cancel')}
          </button>
          <button type="submit" form="ref-form" className="btn btn--primary" disabled={saving}>
            {saving ? t('referenceForm.saving') : t('referenceForm.saveReference')}
          </button>
        </>
      }
    >
      <form id="ref-form" className="form" onSubmit={submit} noValidate>
        <p className="notice notice--info" role="note">
          <span>
            <T id="ref.intro" />
          </span>
        </p>
        {error && (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        )}
        <label className="field">
          <span className="field__label">{t('referenceForm.linkToTheOriginal')}</span>
          <input className="input" type="url" inputMode="url" value={form.sourceUrl} placeholder={t('referenceForm.https')} onChange={(e) => set({ sourceUrl: e.target.value })} />
        </label>
        <div className="field-row">
          <label className="field">
            <span className="field__label">{t('referenceForm.source')}</span>
            <input className="input" value={form.sourceName} maxLength={80} placeholder={t('referenceForm.websiteCreatorOrChannel')} onChange={(e) => set({ sourceName: e.target.value })} />
          </label>
          <label className="field">
            <span className="field__label">{t('referenceForm.originalTitle')}</span>
            <input className="input" value={form.sourceTitle} maxLength={160} onChange={(e) => set({ sourceTitle: e.target.value })} />
          </label>
        </div>
        <label className="field">
          <span className="field__label">{t('referenceForm.nameInOurLibrary')}</span>
          <input className="input" value={form.title} maxLength={120} placeholder={t('referenceForm.defaultsToTheOriginalTitle')} onChange={(e) => set({ title: e.target.value })} />
        </label>
        <div className="field-row">
          <label className="field">
            <span className="field__label">{t('referenceForm.map')}</span>
            <select className="select" value={form.mapId} onChange={(e) => set({ mapId: e.target.value, site: '' })}>
              <option value="any">{t('referenceForm.anyMap')}</option>
              {MAPS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">{t('referenceForm.site')}</span>
            <select className="select" value={form.site} onChange={(e) => set({ site: e.target.value })} disabled={!sites.length}>
              <option value="">{t('referenceForm.anySite')}</option>
              {sites.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span className="field__label">{t('referenceForm.side')}</span>
            <select className="select" value={form.side} onChange={(e) => set({ side: e.target.value, site: '', operators: [] })}>
              <option value="attack">{t('referenceForm.attack')}</option>
              <option value="defend">{t('referenceForm.defense')}</option>
            </select>
          </label>
          <label className="field">
            <span className="field__label">{t('referenceForm.type')}</span>
            <select className="select" value={form.type} onChange={(e) => set({ type: e.target.value })}>
              {Object.entries(STRATEGY_TYPES).map(([id, l]) => (
                <option key={id} value={id}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset className="field">
          <legend className="field__label">{t('referenceForm.operatorsItUsesOptionalUp')}</legend>
          <div className="ref-ops">
            {[0, 1, 2, 3, 4].map((i) => (
              <select
                key={i}
                className="select input--sm"
                aria-label={t('ref.operatorN', { n: i + 1 })}
                value={form.operators[i] ?? ''}
                onChange={(e) => {
                  const next = [...form.operators];
                  next[i] = e.target.value || null;
                  set({ operators: next });
                }}
              >
                <option value="">—</option>
                {ops.map((o) => (
                  <option key={o.id} value={o.id} disabled={form.operators.includes(o.id) && form.operators[i] !== o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            ))}
          </div>
          <span className="field__hint">{t('referenceForm.listingTheOperatorsLetsThe')}</span>
        </fieldset>
        <label className="field">
          <span className="field__label">{t('referenceForm.shortSummaryYourOwnWords')}</span>
          <textarea className="textarea" value={form.summary} maxLength={1000} onChange={(e) => set({ summary: e.target.value })} />
        </label>
      </form>
    </Sheet>
  );
}
