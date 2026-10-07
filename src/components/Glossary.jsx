import { useId, useState } from 'react';
import Icon from './Icon.jsx';
import { GLOSSARY_TERMS } from '../lib/glossary.js';
import { useI18n } from '../i18n/index.js';

/**
 * A small "?" that explains one word in a sentence. Shows on hover or focus,
 * and toggles on tap (touch screens have no hover).
 */
export function HelpTip({ term }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const id = useId();
  const name = t(`glossary.${term}.name`);
  return (
    <span className={`help-tip${open ? ' help-tip--open' : ''}`}>
      <button
        type="button"
        className="help-tip__btn"
        aria-label={t('glossary.ask', { term: name })}
        aria-describedby={id}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        onBlur={() => setOpen(false)}
      >
        ?
      </button>
      <span className="help-tip__pop" role="tooltip" id={id}>
        <strong>{name}</strong> {t(`glossary.${term}.text`)}
      </span>
    </span>
  );
}

/** "R6 words": every glossary word in one small popover. */
export function GlossaryButton() {
  const { t } = useI18n();
  return (
    <details className="glossary">
      <summary className="btn btn--ghost btn--sm">
        <Icon name="book" size={16} /> {t('glossary.title')}
      </summary>
      <div className="glossary__pop">
        <p className="muted small">{t('glossary.intro')}</p>
        <dl className="glossary__list">
          {GLOSSARY_TERMS.map((term) => (
            <div key={term}>
              <dt>{t(`glossary.${term}.name`)}</dt>
              <dd>{t(`glossary.${term}.text`)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </details>
  );
}
