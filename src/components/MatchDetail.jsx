import { useState } from 'react';
import Icon from './Icon.jsx';
import Notice from './Notice.jsx';
import { MatchBadge } from './MatchCard.jsx';
import { Avatar, Sheet } from './ui.jsx';
import { MAPS_BY_ID } from '../lib/maps.js';
import {
  CHECKLIST,
  RSVP,
  countdown,
  formatWhen,
  matchPhase,
  matchResult,
  normalizeMatch,
  rsvpSummary,
} from '../lib/matches.js';

const RSVP_TONE = { yes: 'ok', maybe: 'warn', no: 'danger', pending: 'neutral' };

function ResultForm({ match, onSave }) {
  const [us, setUs] = useState('');
  const [them, setThem] = useState('');
  const [saving, setSaving] = useState(false);
  const valid = us !== '' && them !== '';
  return (
    <form
      className="result-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          await onSave({ ...match, status: 'completed', scoreUs: us, scoreThem: them });
        } finally {
          setSaving(false);
        }
      }}
    >
      <p className="result-form__q">
        <Icon name="trophy" size={18} /> How did it go? Log the final score.
      </p>
      <div className="result-form__row">
        <label className="field">
          <span className="field__label">Us</span>
          <input className="input input--score" type="number" inputMode="numeric" min={0} max={99} value={us} onChange={(e) => setUs(e.target.value)} />
        </label>
        <span className="score-fields__dash" aria-hidden="true">–</span>
        <label className="field">
          <span className="field__label">Them</span>
          <input className="input input--score" type="number" inputMode="numeric" min={0} max={99} value={them} onChange={(e) => setThem(e.target.value)} />
        </label>
        <button type="submit" className="btn btn--primary" disabled={!valid || saving}>
          {saving ? 'Saving…' : 'Save result'}
        </button>
      </div>
    </form>
  );
}

/**
 * Everything about one match: when/where, result, who's playing (RSVP),
 * the prep checklist and notes.
 */
export default function MatchDetail({ match, now, players, profile, matchData, onEdit, onPlan, onClose }) {
  const { availability, checklist, setRsvp, toggleChecklist, saveMatch, deleteMatch } = matchData;
  const [error, setError] = useState('');
  const phase = matchPhase(match, now);
  const result = matchResult(match);
  const map = MAPS_BY_ID[match.mapId]?.name;
  const rsvp = rsvpSummary(availability, match.id, players);
  const mine = availability.find((a) => a.matchId === match.id && a.player === profile)?.status ?? null;
  const done = new Set(checklist.filter((c) => c.matchId === match.id).map((c) => c.itemId));
  const doneBy = Object.fromEntries(checklist.filter((c) => c.matchId === match.id).map((c) => [c.itemId, c.doneBy]));
  const open = phase === 'upcoming' || phase === 'live';
  const statusOf = (p) => (rsvp.yes.includes(p) ? 'yes' : rsvp.maybe.includes(p) ? 'maybe' : rsvp.no.includes(p) ? 'no' : 'pending');

  const guard = (fn) => async (...args) => {
    setError('');
    try {
      await fn(...args);
    } catch (e) {
      setError(e.message || 'Something went wrong.');
    }
  };

  return (
    <Sheet
      title={`vs ${match.opponent}`}
      onClose={onClose}
      labelId="match-detail-title"
      footer={
        <>
          <button
            type="button"
            className="btn btn--danger btn--sm"
            onClick={guard(async () => {
              if (window.confirm(`Delete the match vs ${match.opponent}? This can't be undone.`)) {
                await deleteMatch(match.id);
                onClose();
              }
            })}
          >
            <Icon name="trash" size={16} /> Delete
          </button>
          <span className="grow" />
          <button type="button" className="btn btn--secondary btn--sm" onClick={onEdit}>
            <Icon name="edit" size={16} /> Edit
          </button>
          {open && (
            <button type="button" className="btn btn--primary btn--sm" onClick={onPlan}>
              <Icon name="crosshair" size={16} /> Plan
            </button>
          )}
        </>
      }
    >
      <div className="match-detail">
        <div className="match-detail__head">
          <MatchBadge match={match} now={now} />
          {phase === 'upcoming' && <span className="muted small">{countdown(match.scheduledAt, now)}</span>}
        </div>
        <ul className="match-detail__facts">
          <li>
            <Icon name="clock" size={16} /> {formatWhen(match.scheduledAt, now)}
          </li>
          <li>
            <Icon name="map" size={16} /> {map ?? 'Map not decided'}
          </li>
          {match.competition && (
            <li>
              <Icon name="trophy" size={16} /> {match.competition}
            </li>
          )}
        </ul>

        <Notice onDismiss={() => setError('')}>{error}</Notice>

        {result && (
          <div className={`scoreline scoreline--${result}`}>
            <span className="scoreline__side">Us</span>
            <span className="scoreline__score">
              {match.scoreUs}
              <span aria-hidden="true">–</span>
              {match.scoreThem}
            </span>
            <span className="scoreline__side">Them</span>
          </div>
        )}
        {phase === 'needs-result' && <ResultForm match={match} onSave={guard((m) => saveMatch(normalizeMatch(m)))} />}

        {phase !== 'cancelled' && (
          <section className="match-detail__section" aria-labelledby="rsvp-title">
            <h3 id="rsvp-title" className="section-title">
              Who's playing <span className="muted">{rsvp.yes.length}/{players.length} in</span>
            </h3>
            {open && players.includes(profile) && (
              <div className="rsvp-picker" role="group" aria-label="Your availability">
                {Object.entries(RSVP).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`rsvp-btn rsvp-btn--${id}`}
                    aria-pressed={mine === id}
                    onClick={guard(() => setRsvp(match.id, profile, mine === id ? null : id))}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <ul className="rsvp-list">
              {players.map((p) => {
                const s = statusOf(p);
                return (
                  <li key={p} className="rsvp-list__item">
                    <Avatar name={p} size="sm" />
                    <span className="rsvp-list__name">
                      {p}
                      {p === profile && <span className="tag tag--me">you</span>}
                    </span>
                    <span className={`badge badge--${RSVP_TONE[s]}`}>{s === 'pending' ? 'No reply' : RSVP[s]}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {open && (
          <section className="match-detail__section" aria-labelledby="prep-title">
            <h3 id="prep-title" className="section-title">
              Prep checklist <span className="muted">{done.size}/{CHECKLIST.length}</span>
            </h3>
            <div className="progress" aria-hidden="true">
              <span className="progress__bar" style={{ width: `${(done.size / CHECKLIST.length) * 100}%` }} />
            </div>
            <ul className="checklist">
              {CHECKLIST.map((item) => (
                <li key={item.id}>
                  <label className="checklist__item">
                    <input
                      type="checkbox"
                      checked={done.has(item.id)}
                      onChange={guard((e) => toggleChecklist(match.id, item.id, e.target.checked))}
                    />
                    <span className="checklist__label">{item.label}</span>
                    {done.has(item.id) && doneBy[item.id] && <span className="muted small">{doneBy[item.id]}</span>}
                  </label>
                </li>
              ))}
            </ul>
          </section>
        )}

        {match.notes && (
          <section className="match-detail__section" aria-labelledby="mnotes-title">
            <h3 id="mnotes-title" className="section-title">Notes</h3>
            <p className="notes-text">{match.notes}</p>
          </section>
        )}
        {match.updatedBy && <p className="muted small">Last updated by {match.updatedBy}</p>}
      </div>
    </Sheet>
  );
}
