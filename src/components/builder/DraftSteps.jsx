import { useEffect } from 'react';
import BoardEditor from '../BoardEditor.jsx';
import Icon from '../Icon.jsx';
import OperatorIcon from '../OperatorIcon.jsx';
import TacticalBoard from '../TacticalBoard.jsx';
import { DetailsForm, StepsForm } from '../StrategyForms.jsx';
import { OPERATORS_BY_ID } from '../../lib/operators.js';
import { STRATEGY_TYPES, slotColor } from '../../lib/strategies.js';
import { TACTICAL_ROLES } from '../../lib/tactical.js';
import { useHistory } from '../../state/useHistory.js';
import { tx, useI18n } from '../../i18n/index.js';

/** Steps 7–10 edit the draft with undo/redo; changes are mirrored to the wizard. */
export default function DraftSteps({ step, initial, onChange, strategyData, mapName, onSave, saving, error, nav, simple, roster, onPlayer }) {
  const { t } = useI18n();
  const history = useHistory(initial);
  const draft = history.value;
  useEffect(() => {
    onChange(draft);
  }, [draft, onChange]);
  return (
    <>
      {step === 7 && (
        <section className="panel">
          <h2 className="panel__title">{t('strategyBuilder.customize')}</h2>
          <DetailsForm draft={draft} set={history.set} compact />
        </section>
      )}
      {step === 8 && (
        <BoardEditor draft={draft} history={history} mapName={mapName} inBuilder simple={simple} />
      )}
      {step === 9 && (
        <section className="panel">
          <h2 className="panel__title">{t('strategyBuilder.stepsAndTiming')}</h2>
          <StepsForm draft={draft} set={history.set} />
        </section>
      )}
      {step === 10 && (
        <section className="panel review">
          <h2 className="panel__title">{t('strategyBuilder.reviewAndSave')}</h2>
          <div className="review__grid">
            <TacticalBoard strategy={draft} mapName={mapName} />
            <div>
              {simple ? (
                <label className="field review__name">
                  <span className="field__label">{t('builder.simple.name')}</span>
                  <input className="input" value={draft.title} maxLength={120} onChange={(e) => history.set({ title: e.target.value }, { key: 'title' })} />
                </label>
              ) : (
                <p className="review__title">{draft.title || t('strategyBuilder.untitledStrategy')}</p>
              )}
              <p className="muted small">
                {mapName || t('strategyBuilder.anyMap')} {draft.site ? `· ${draft.site}` : ''} · {draft.side === 'attack' ? t('strategyBuilder.attack') : t('strategyBuilder.defense')} · {STRATEGY_TYPES[draft.type]}
              </p>
              {simple ? (
                <fieldset className="field simple-players">
                  <legend className="field__label">{t('builder.simple.players')}</legend>
                  <ul className="assign assign--simple">
                    {draft.slots
                      .filter((s) => s.operatorId)
                      .map((s) => {
                        const op = OPERATORS_BY_ID[s.operatorId];
                        const taken = new Set(Object.entries(nav.players).filter(([k, p]) => k !== s.operatorId && p).map(([, p]) => p));
                        return (
                          <li key={s.key} className="assign__row">
                            <OperatorIcon key={op?.id ?? 'none'} operator={op} size="sm" />
                            <span className="assign__op">{op?.name ?? t('strategyBuilder.any')}</span>
                            <select className="select" aria-label={t('strategyBuilder.player')} value={nav.players[s.operatorId] ?? ''} onChange={(e) => onPlayer(s.operatorId, e.target.value || null)}>
                              <option value="">{t('strategyBuilder.unassigned')}</option>
                              {roster.map((p) => (
                                <option key={p} value={p} disabled={taken.has(p)}>
                                  {p}
                                </option>
                              ))}
                            </select>
                          </li>
                        );
                      })}
                  </ul>
                </fieldset>
              ) : (
              <ul className="squad squad--compact">
                {draft.slots.map((s) => {
                  const op = OPERATORS_BY_ID[s.operatorId];
                  return (
                    <li key={s.key} className="squad__row" style={{ '--slot': slotColor(draft, s.key) }}>
                      <span className="squad__who">
                        <OperatorIcon key={op?.id ?? 'none'} operator={op} size="sm" />
                        <span className="squad__id">
                          <span className="squad__op">{op?.name ?? t('strategyBuilder.any')}</span>
                          <span className="role-tag">{TACTICAL_ROLES[s.tacticalRole]}</span>
                        </span>
                      </span>
                      <span className="muted small">{nav.players[s.operatorId] ?? t('strategyBuilder.unassigned')}</span>
                    </li>
                  );
                })}
              </ul>
              )}
              <p className="muted small">
                {t('builder.counts', { steps: draft.steps.length, markers: draft.markers.length, paths: draft.paths.length, zones: draft.zones.length, crossfires: draft.crossfires.length })}
              </p>
            </div>
          </div>
          {!draft.title.trim() && <p className="notice notice--warn">{t('strategyBuilder.giveTheStrategyATitle')}</p>}
          {error && (
            <p className="notice notice--error" role="alert">
              {tx(error)}
            </p>
          )}
          <button type="button" className="btn btn--primary btn--lg" onClick={() => onSave(draft)} disabled={saving || !draft.title.trim() || !strategyData.canSave}>
            <Icon name="check" size={20} /> {saving ? t('strategyBuilder.saving') : t('strategyBuilder.saveToTeamLibrary')}
          </button>
        </section>
      )}
    </>
  );
}
