import { useRef, useState } from 'react';
import CopyButton from './CopyButton.jsx';
import { CalloutLayer } from './MapLayer.jsx';
import { Badge } from './ui.jsx';
import {
  CALLOUT_KINDS,
  VERIFY_CHECKS,
  floorLabel,
  floorPlan,
  floorsFor,
  manifestEntry,
  planSize,
  setLocalPlan,
  setSessionCallouts,
} from '../lib/floorPlans.js';
import { usePlans } from '../state/usePlans.js';
import { CodedError } from '../lib/errors.js';
import { T } from '../i18n/Rich.jsx';
import { useI18n } from '../i18n/index.js';

const today = () => new Date().toISOString().slice(0, 10);

/** Read an image file's pixel size. */
function imageSize(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new CodedError('fplan.badImage'));
    img.src = url;
  });
}

/**
 * Floor plans for one map: which floors have a real plan, how to add a
 * missing one, and tools to try an image, calibrate callouts and verify a
 * plan. Calibration lives in this session only; "Copy manifest entry" gives
 * the JSON to commit in src/data/floorPlans.json.
 */
export default function FloorPlanPanel({ map }) {
  const { t } = useI18n();
  usePlans();
  const floors = floorsFor(map.id);
  const [floorId, setFloorId] = useState(floors[0] ?? '');
  const [calibrating, setCalibrating] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState('room');
  const [checks, setChecks] = useState(() => new Set());
  const [reviewer, setReviewer] = useState('');
  const [source, setSource] = useState('');
  const [license, setLicense] = useState('');
  const [error, setError] = useState('');
  const svgRef = useRef(null);
  const fileRef = useRef(null);

  if (!floors.length) {
    return (
      <section className="panel" aria-labelledby="fp-title">
        <h2 id="fp-title" className="panel__title">{t('floorPlanPanel.floorPlans')}</h2>
        <p className="muted">
          <T id="fplan.notListed" values={{ map: map.name }} />
        </p>
      </section>
    );
  }

  const plan = floorPlan(map.id, floorId);
  const size = plan ? planSize(plan) : null;
  const allChecked = VERIFY_CHECKS.every((id) => checks.has(id));
  const pick = (f) => {
    setFloorId(f);
    setCalibrating(false);
    setChecks(new Set());
    setError('');
  };

  const tryLocal = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    const url = URL.createObjectURL(file);
    try {
      const dims = await imageSize(url);
      setLocalPlan(map.id, floorId, { url, ...dims, source, license, callouts: plan?.callouts ?? [] });
    } catch (err) {
      URL.revokeObjectURL(url);
      setError(err.message);
    }
  };

  const addCallout = (e) => {
    if (!calibrating || !plan || !svgRef.current) return;
    const name_ = name.trim();
    if (!name_) {
      setError(t('fplan.typeNameFirst'));
      return;
    }
    const p = svgRef.current.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const b = p.matrixTransform(svgRef.current.getScreenCTM().inverse());
    const x = Math.min(1, Math.max(0, b.x / size.w));
    const y = Math.min(1, Math.max(0, b.y / size.h));
    const id = name_.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    setSessionCallouts(map.id, floorId, [...plan.callouts.filter((c) => c.id !== id), { id, name: name_, kind, x, y }]);
    setName('');
    setError('');
  };

  const removeCallout = (id) => setSessionCallouts(map.id, floorId, plan.callouts.filter((c) => c.id !== id));

  const entry = () =>
    manifestEntry(map.id, floorId, plan, {
      source: source || plan.source,
      license: license || plan.license,
      verified: allChecked && Boolean(reviewer.trim()),
      verifiedBy: allChecked ? reviewer.trim() : '',
      verifiedAt: allChecked && reviewer.trim() ? today() : '',
      checks: [...checks],
    });

  return (
    <section className="panel fplan" aria-labelledby="fp-title">
      <div className="panel__head">
        <h2 id="fp-title" className="panel__title">{t('floorPlanPanel.floorPlans')}</h2>
        <span className="muted small">
          {t('fplan.haveAPlan', { with: floors.filter((f) => floorPlan(map.id, f)).length, floors: floors.length })}
        </span>
      </div>
      <div className="floor-tabs fplan__tabs" role="group" aria-label={t('floorPlanPanel.floor')}>
        {floors.map((f) => {
          const p = floorPlan(map.id, f);
          return (
            <button key={f} type="button" className="floor-tab" aria-pressed={f === floorId} onClick={() => pick(f)}>
              {floorLabel(f)}
              {!p ? <span className="floor-tab__missing">{t('floorPlanPanel.missing')}</span> : p.verified ? <span className="floor-tab__ok">{t('floorPlanPanel.verified')}</span> : <span className="floor-tab__missing">{t('floorPlanPanel.unverified')}</span>}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}

      {!plan && (
        <div className="fplan__missing">
          <p>
            <strong>{t('fplan.missingTitle', { map: map.name, floor: floorLabel(floorId) })}</strong> {t('fplan.missingBody')}
          </p>
          <ol className="fplan__steps">
            <li>{t('floorPlanPanel.getAnAccurateTopDown')}</li>
            <li>
              <T id="fplan.saveAs" values={{ map: map.id, floor: floorId }} />
            </li>
            <li>
              <T id="fplan.addEntry" />
            </li>
          </ol>
        </div>
      )}

      <div className="fplan__toolbar toolbar">
        <input ref={fileRef} type="file" accept="image/png,image/webp,image/jpeg,image/svg+xml" hidden onChange={tryLocal} />
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => fileRef.current?.click()}>
          {plan?.local ? t('floorPlanPanel.tryAnotherImage') : plan ? t('floorPlanPanel.tryAReplacementImage') : t('floorPlanPanel.tryAnImageFromThis')}
        </button>
        {plan?.local && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setLocalPlan(map.id, floorId, null)}>
            {t('floorPlanPanel.stopUsingThisImage')}
          </button>
        )}
        {plan && (
          <button type="button" className="btn btn--ghost btn--sm" aria-pressed={calibrating} onClick={() => setCalibrating(!calibrating)}>
            {calibrating ? t('floorPlanPanel.doneCalibrating') : t('floorPlanPanel.calibrateCallouts')}
          </button>
        )}
      </div>

      {plan && (
        <>
          <p className="fplan__meta">
            {plan.local && <Badge tone="warn">{t('floorPlanPanel.sessionOnlyNotSaved')}</Badge>}
            {plan.verified ? <Badge tone="ok">{t(plan.verifiedAt ? 'fplan.verifiedByDate' : 'fplan.verifiedBy', { name: plan.verifiedBy || t('floorPlanPanel.theTeam'), date: plan.verifiedAt })}</Badge> : <Badge tone="warn">{t('floorPlanPanel.notVerifiedAgainstTheGame')}</Badge>}
            <span className="muted small">
              {t('fplan.dims', { width: plan.width, height: plan.height, callouts: plan.callouts.length })}
              {plan.source ? t('fplan.sourceLine', { source: plan.source }) : ''}
              {plan.license ? ` · ${plan.license}` : ''}
            </span>
          </p>

          {calibrating && (
            <div className="fplan__calib">
              <label className="field">
                <span className="field__label">{t('floorPlanPanel.calloutName')}</span>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('floorPlanPanel.ceoOffice')} maxLength={40} />
              </label>
              <label className="field">
                <span className="field__label">{t('floorPlanPanel.kind')}</span>
                <select className="select" value={kind} onChange={(e) => setKind(e.target.value)}>
                  {Object.entries(CALLOUT_KINDS).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="muted small">{t('floorPlanPanel.typeANameThenClick')}</p>
            </div>
          )}

          <div className={`tboard tboard--floor fplan__board${calibrating ? ' fplan__board--calib' : ''}`}>
            <svg ref={svgRef} className="tboard__svg" viewBox={`0 0 ${size.w} ${size.h}`} onClick={addCallout} role="img" aria-label={t('fplan.boardAria', { map: map.name, floor: floorLabel(floorId) })}>
              <rect x="0" y="0" width={size.w} height={size.h} className="tboard__bg" />
              <image href={plan.url} x="0" y="0" width={size.w} height={size.h} preserveAspectRatio="none" />
              <CalloutLayer plan={plan} size={size} mapId={map.id} />
            </svg>
          </div>

          {plan.callouts.length > 0 && (
            <ul className="fplan__callouts">
              {plan.callouts.map((c) => (
                <li key={c.id}>
                  <span>
                    {c.name} <span className="muted small">{CALLOUT_KINDS[c.kind]} · {c.x.toFixed(3)}, {c.y.toFixed(3)}</span>
                  </span>
                  {calibrating && (
                    <button type="button" className="link-btn" onClick={() => removeCallout(c.id)}>
                      {t('floorPlanPanel.remove')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <details className="fplan__verify">
            <summary>{t('floorPlanPanel.verifyAndExport')}</summary>
            <p className="muted small">
              {t('floorPlanPanel.compareThePlanWithThe')}
            </p>
            <ul className="fplan__checks">
              {VERIFY_CHECKS.map((id) => (
                <li key={id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={checks.has(id)}
                      onChange={(e) =>
                        setChecks((s) => {
                          const n = new Set(s);
                          if (e.target.checked) n.add(id);
                          else n.delete(id);
                          return n;
                        })
                      }
                    />{' '}
                    {t(`verify.${id}`)}
                  </label>
                </li>
              ))}
            </ul>
            <div className="setup-grid">
              <label className="field">
                <span className="field__label">{t('floorPlanPanel.reviewedBy')}</span>
                <input className="input" value={reviewer} onChange={(e) => setReviewer(e.target.value)} maxLength={60} />
              </label>
              <label className="field">
                <span className="field__label">{t('floorPlanPanel.source')}</span>
                <input className="input" value={source} onChange={(e) => setSource(e.target.value)} placeholder={plan.source || t('fplan.sourcePlaceholder')} maxLength={300} />
              </label>
              <label className="field">
                <span className="field__label">{t('floorPlanPanel.licensePermission')}</span>
                <input className="input" value={license} onChange={(e) => setLicense(e.target.value)} placeholder={plan.license || t('fplan.licensePlaceholder')} maxLength={200} />
              </label>
            </div>
            <pre className="fplan__json">{entry()}</pre>
            <CopyButton getText={entry} label={t('fplan.copyEntry')} />
          </details>
        </>
      )}
    </section>
  );
}
