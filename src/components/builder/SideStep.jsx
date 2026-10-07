import ChoiceGrid from './ChoiceGrid.jsx';
import Icon from '../Icon.jsx';
import { useI18n } from '../../i18n/index.js';

/** Step 3: attack or defense. */
export default function SideStep({ w, set }) {
  const { t } = useI18n();
  return (
    <ChoiceGrid className="choice-grid--sides">
      {[
        ['attack', t('card.side.attack'), t('builder.side.attack.sub'), 'swords'],
        ['defend', t('card.side.defend'), t('builder.side.defend.sub'), 'shield'],
      ].map(([id, label, sub, icon]) => (
        <li key={id}>
          <button
            type="button"
            className={`choice choice--side choice--${id}`}
            aria-pressed={w.side === id}
            onClick={() => set((x) => ({ side: id, ops: x.side === id ? x.ops : [null, null, null, null, null], step: 4, reached: Math.max(x.reached, 4) }))}
          >
            <Icon name={icon} size={34} />
            <span className="choice__name">{label}</span>
            <span className="choice__meta">{sub}</span>
          </button>
        </li>
      ))}
    </ChoiceGrid>
  );
}
