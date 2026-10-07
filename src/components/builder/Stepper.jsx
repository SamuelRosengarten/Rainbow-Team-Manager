import { useEffect, useRef } from 'react';
import Icon from '../Icon.jsx';
import { stepperItems } from '../../lib/builderFlow.js';
import { useI18n } from '../../i18n/index.js';

/** Wizard header: the mode's steps (ten in Advanced, six in Simple); reached ones are clickable. */
export default function Stepper({ mode, step, reached, hasDraft, go }) {
  const { t } = useI18n();
  const listRef = useRef(null);
  const items = stepperItems(mode, step, reached, hasDraft);
  const at = items.findIndex((x) => x.current);
  // Keep the current step in view when the list scrolls sideways on a phone.
  useEffect(() => {
    listRef.current?.querySelector('[aria-current="step"]')?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
  }, [step]);
  return (
    <>
    <p className="stepper__summary" aria-live="polite">
      {t('builder.stepOf', { n: at + 1, total: items.length, name: t(`builder.step.${items[at]?.id}`) })}
    </p>
    <ol className="stepper" aria-label={t('strategyBuilder.builderSteps')} ref={listRef}>
      {items.map((it, i) => (
        <li key={it.id} className={`stepper__item${it.current ? ' stepper__item--on' : ''}${it.done ? ' stepper__item--done' : ''}`}>
          <button
            type="button"
            aria-disabled={!it.can || undefined}
            title={it.can ? t(`builder.step.${it.id}`) : t('builder.locked')}
            onClick={() => it.can && go(it.target)}
            aria-current={it.current ? 'step' : undefined}
          >
            <span className="stepper__n">{it.done ? <Icon name="check" size={13} /> : i + 1}</span>
            <span className="stepper__label">{t(`builder.step.${it.id}`)}</span>
            {it.done && <span className="visually-hidden"> {t('builder.stepDone')}</span>}
            {!it.can && <span className="visually-hidden"> {t('builder.locked')}</span>}
          </button>
        </li>
      ))}
    </ol>
    </>
  );
}
