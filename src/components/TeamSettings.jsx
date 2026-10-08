import { useCallback, useEffect, useState } from 'react';
import CopyButton from './CopyButton.jsx';
import Icon from './Icon.jsx';
import * as api from '../lib/api.js';
import { errorMsg } from '../lib/errors.js';
import { formatInviteCode, inviteLink, validTeamName } from '../lib/invite.js';
import { isCaptain } from '../lib/teamScope.js';
import { tm, useI18n } from '../i18n/index.js';

/**
 * Team settings (Team → Team settings). Everyone: the team, its members and
 * "Leave team". Captains: the invite link and code, rename, roles, remove
 * members, delete the team. The database checks every action again
 * (supabase/selfserve.sql); `onChanged` reloads the member's team afterwards.
 */
export default function TeamSettings({ team, onChanged }) {
  const { t } = useI18n();
  const captain = isCaptain(team);
  const [members, setMembers] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [name, setName] = useState(team.name);
  const [confirmDelete, setConfirmDelete] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .fetchTeamMembers()
      .then((rows) => !cancelled && setMembers(rows))
      .catch((e) => !cancelled && setError(errorMsg(e)));
    return () => {
      cancelled = true;
    };
  }, [reload, team.role]);

  /** Run an action, then reload the team (and the members list). */
  const act = useCallback(
    async (fn, done) => {
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        await fn();
        if (done) setNotice(done);
        setReload((k) => k + 1);
        await onChanged?.();
      } catch (e) {
        setError(errorMsg(e));
      } finally {
        setBusy(false);
      }
    },
    [onChanged],
  );

  const link = team.inviteCode ? inviteLink(location, team.inviteCode) : '';
  const meCount = members?.length ?? 0;

  return (
    <div className="team-settings">
      {error && (
        <p className="notice notice--error" role="alert">
          {tm(error)}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}

      <section className="panel" aria-labelledby="ts-team">
        <h2 id="ts-team" className="panel__title">{team.name}</h2>
        <p className="muted small">{captain ? t('teamSettings.youAreCaptain') : t('teamSettings.youAreMember')}</p>
        {captain && (
          <form
            className="ts-row"
            onSubmit={(e) => {
              e.preventDefault();
              act(() => api.renameTeam(name), t('teamSettings.renamed'));
            }}
          >
            <label className="field field--grow">
              <span className="field__label">{t('teamSettings.teamName')}</span>
              <input className="input" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <button type="submit" className="btn btn--secondary" disabled={busy || !validTeamName(name) || name.trim() === team.name}>
              {t('teamSettings.rename')}
            </button>
          </form>
        )}
      </section>

      {captain && (
        <section className="panel" aria-labelledby="ts-invite">
          <h2 id="ts-invite" className="panel__title">{t('teamSettings.invite.title')}</h2>
          <p className="muted small">{t('teamSettings.invite.body')}</p>
          {team.inviteEnabled ? (
            <>
              <p className="ts-invite">
                <span className="ts-invite__link">{link}</span>
                <span className="ts-invite__code">{t('teamSettings.invite.code', { code: formatInviteCode(team.inviteCode) })}</span>
              </p>
              <div className="actions">
                <CopyButton getText={() => link} label={t('teamSettings.invite.copyLink')} />
                <CopyButton getText={() => team.inviteCode} label={t('teamSettings.invite.copyCode')} />
                <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => act(api.regenerateInvite, t('teamSettings.invite.regenerated'))}>
                  {t('teamSettings.invite.regenerate')}
                </button>
                <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => act(() => api.setInviteEnabled(false), t('teamSettings.invite.turnedOff'))}>
                  {t('teamSettings.invite.turnOff')}
                </button>
              </div>
            </>
          ) : (
            <div className="actions">
              <p className="muted">{t('teamSettings.invite.off')}</p>
              <button type="button" className="btn btn--secondary" disabled={busy} onClick={() => act(() => api.setInviteEnabled(true), t('teamSettings.invite.turnedOn'))}>
                {t('teamSettings.invite.turnOn')}
              </button>
            </div>
          )}
        </section>
      )}

      <section className="panel" aria-labelledby="ts-members">
        <h2 id="ts-members" className="panel__title">{t('teamSettings.members', { n: meCount })}</h2>
        {!members ? (
          <p className="muted">{t('teamSettings.loading')}</p>
        ) : (
          <ul className="ts-members">
            {members.map((m) => (
              <li key={m.profileId} className="ts-member">
                <span className="ts-member__name">
                  {m.player}
                  {m.isMe && <span className="muted small"> {t('teamSettings.you')}</span>}
                </span>
                <span className={`role-tag${m.role === 'captain' ? ' role-tag--captain' : ''}`}>{t(`teamSettings.role.${m.role}`)}</span>
                {captain && !m.isMe && (
                  <span className="ts-member__actions">
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      disabled={busy}
                      onClick={() => act(() => api.setRole(m.profileId, m.role === 'captain' ? 'member' : 'captain'))}
                    >
                      {m.role === 'captain' ? t('teamSettings.makeMember') : t('teamSettings.makeCaptain')}
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      disabled={busy}
                      onClick={() => window.confirm(t('teamSettings.removeConfirm', { player: m.player })) && act(() => api.removeMember(m.profileId), t('teamSettings.removed', { player: m.player }))}
                    >
                      {t('teamSettings.remove')}
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel" aria-labelledby="ts-leave">
        <h2 id="ts-leave" className="panel__title">{t('teamSettings.leave.title')}</h2>
        <p className="muted small">{t('teamSettings.leave.body')}</p>
        <div className="actions">
          <button type="button" className="btn btn--secondary" disabled={busy} onClick={() => window.confirm(t('teamSettings.leave.confirm', { team: team.name })) && act(api.leaveTeam)}>
            <Icon name="close" size={16} /> {t('teamSettings.leave.button')}
          </button>
        </div>
      </section>

      {captain && (
        <section className="panel ts-danger" aria-labelledby="ts-delete">
          <h2 id="ts-delete" className="panel__title">{t('teamSettings.delete.title')}</h2>
          <p className="small">{t('teamSettings.delete.body')}</p>
          <form
            className="ts-row"
            onSubmit={(e) => {
              e.preventDefault();
              act(() => api.deleteTeam(confirmDelete));
            }}
          >
            <label className="field field--grow">
              <span className="field__label">{t('teamSettings.delete.typeName', { team: team.name })}</span>
              <input className="input" value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} autoComplete="off" />
            </label>
            <button type="submit" className="btn btn--danger" disabled={busy || confirmDelete !== team.name}>
              {t('teamSettings.delete.button')}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
