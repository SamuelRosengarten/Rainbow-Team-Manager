import OperatorIcon from '../components/OperatorIcon.jsx';
import TacticalBoard from '../components/TacticalBoard.jsx';
import { floorLabel } from '../lib/floorPlans.js';
import { MAPS_BY_ID } from '../lib/maps.js';
import { OPERATORS_BY_ID } from '../lib/operators.js';
import { slotColor } from '../lib/strategies.js';
import { BREACH_TYPES, OBJECTS, TACTICAL_ROLES, utilityName } from '../lib/tactical.js';
import { focusView, playerSlice, sliceFloor, stepBrief } from './playerView.js';
import { useI18n } from '../i18n/index.js';

const utilityText = (m, opId) => {
  const what = m.kind === 'utility' ? utilityName(m.gadget, opId) : m.kind === 'breach' ? BREACH_TYPES[m.breachType] : OBJECTS[m.kind]?.label;
  return [what, m.label && m.label !== what ? m.label : '', m.timing].filter(Boolean).join(' · ');
};

/**
 * The in-round view: one player's job at the current step and a mini-map
 * with only their own positions, routes, utility and crossfires. Nothing in
 * it can be clicked; F8 / F6 change the step.
 */
export default function RoundView({ strategy, slotKey, stepIndex }) {
  const { t } = useI18n();
  const slot = strategy.slots.find((s) => s.key === slotKey);
  const op = OPERATORS_BY_ID[slot.operatorId];
  const brief = stepBrief(strategy, slotKey, stepIndex);
  const slice = playerSlice(strategy, slotKey, brief.step?.id ?? null);
  const floorId = sliceFloor(strategy, slice);
  const mapName = MAPS_BY_ID[strategy.mapId]?.name ?? t('overlay.anyMap');
  const opName = (key) => OPERATORS_BY_ID[strategy.slots.find((s) => s.key === key)?.operatorId]?.name ?? t('card.anyOperator');

  return (
    <div className="ov-round" style={{ '--slot': slotColor(strategy, slotKey) }}>
      <p className="ov-round__where">{[mapName, strategy.site, t(`side.${strategy.side}`), strategy.title].filter(Boolean).join(' · ')}</p>

      <header className="ov-me">
        <OperatorIcon key={op?.id ?? 'none'} operator={op} size="lg" />
        <div className="ov-me__who">
          <strong className="ov-me__op">{op?.name ?? t('card.anyOperator')}</strong>
          <span className="role-tag">{TACTICAL_ROLES[slot.tacticalRole]}</span>
        </div>
        <span className="ov-me__step">
          {brief.step ? t('overlay.round.step', { n: brief.index + 1, total: brief.count }) : t('playerMode.wholeRound')}
        </span>
      </header>

      <section className="ov-now" aria-live="polite">
        {brief.step && (
          <p className="ov-now__title">
            {(brief.step.clock || brief.step.timing) && <span className="ov-now__clock">{brief.step.clock || brief.step.timing}</span>} {brief.step.title}
          </p>
        )}
        {brief.bullets.length > 0 && (
          <ul className="ov-bullets">
            {brief.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        )}
        {brief.utility.length > 0 && (
          <ul className="ov-bullets ov-bullets--util">
            {brief.utility.map((m) => (
              <li key={m.id}>
                <span className="ov-tag">{t('overlay.round.place')}</span> {utilityText(m, slot.operatorId)}
              </li>
            ))}
          </ul>
        )}
        {brief.crossfires.length > 0 && (
          <ul className="ov-bullets ov-bullets--util">
            {brief.crossfires.map((c) => (
              <li key={c.id}>
                <span className="ov-tag">{t('overlay.round.crossfire')}</span> {t('playerMode.crossfireWith', { partner: opName(c.slotA === slotKey ? c.slotB : c.slotA) })}
                {c.label && ` · ${c.label}`}
              </li>
            ))}
          </ul>
        )}
        {brief.idle && <p className="ov-now__idle">{t('overlay.round.nothingThisStep')}</p>}
      </section>

      {strategy.mapId !== 'any' && (
        <figure className="ov-map">
          {floorId && <figcaption className="ov-map__floor">{floorLabel(floorId)}</figcaption>}
          <TacticalBoard
            strategy={slice}
            mapName={mapName}
            floorId={floorId}
            view={focusView(slice, floorId)}
            showFloorTabs={false}
            stepId={brief.step?.id ?? null}
            focusSlot={slotKey}
            isolate
            className="ov-map__board"
            title={t('playerMode.positionsOf', { operator: op?.name ?? t('card.anyOperator') })}
          />
        </figure>
      )}
    </div>
  );
}
