import { useState } from 'react';
import { LOCALES, useI18n } from '../i18n/index.js';

/**
 * English / Français switch for the header and the passcode screen: two real
 * buttons in a labelled group, the current one marked aria-pressed, changing
 * the language without a reload. The change is announced politely to screen readers.
 */
export default function LanguageToggle({ className = '' }) {
  const { t, locale, setLocale } = useI18n();
  const [announcement, setAnnouncement] = useState('');
  const choose = (next) => {
    if (next === locale) return;
    setLocale(next);
    setAnnouncement(t(`language.announce.${next}`));
  };
  return (
    <span className={`lang-toggle ${className}`}>
      <span className="segmented lang-toggle__group" role="group" aria-label={t('language.label')}>
        {Object.values(LOCALES).map((l) => (
          <button key={l.id} type="button" lang={l.lang} className="segmented__btn" aria-pressed={locale === l.id} title={l.label} onClick={() => choose(l.id)}>
            {l.short}
            <span className="visually-hidden"> {l.label}</span>
          </button>
        ))}
      </span>
      <span className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </span>
    </span>
  );
}
