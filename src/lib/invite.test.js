import { describe, expect, it } from 'vitest';
import { cleanInviteCode, formatInviteCode, inviteCodeFromHash, inviteLink, isInviteCode, rememberInvite, rememberedInvite, takeAuthLinkError, validNewPassword, validPlayerName, validTeamName } from './invite.js';

const memory = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

describe('invite codes and links', () => {
  it('cleans what people type and checks the shape', () => {
    expect(cleanInviteCode(' abcde-fgh23 ')).toBe('ABCDEFGH23');
    expect(isInviteCode('abcde-fgh23')).toBe(true);
    expect(isInviteCode('ABCDEFGH2')).toBe(false); // 9 characters
    expect(isInviteCode('ABCDEFGH01')).toBe(false); // 0 and 1 aren't used
    expect(isInviteCode('OIOIOIOIOI')).toBe(false);
  });

  it('reads the code from an invite link', () => {
    expect(inviteCodeFromHash('#/join/ABCDEFGH23')).toBe('ABCDEFGH23');
    expect(inviteCodeFromHash('#/join/abcde-fgh23')).toBe('ABCDEFGH23');
    expect(inviteCodeFromHash('#/join/ABCDE%20FGH23')).toBe('ABCDEFGH23');
    for (const bad of ['#/join/', '#/join/short', '#/team', '', null, '#/join/%E0%A4%A']) expect(inviteCodeFromHash(bad)).toBeNull();
  });

  it('builds the link to share and a readable code', () => {
    expect(inviteLink({ origin: 'https://team.example', pathname: '/' }, 'abcdefgh23')).toBe('https://team.example/#/join/ABCDEFGH23');
    expect(formatInviteCode('ABCDEFGH23')).toBe('ABCDE-FGH23');
  });

  it('remembers a code through sign-in', () => {
    const s = memory();
    rememberInvite('abcde-fgh23', s);
    expect(rememberedInvite(s)).toBe('ABCDEFGH23');
    rememberInvite(null, s);
    expect(rememberedInvite(s)).toBeNull();
    expect(rememberedInvite({ getItem: () => { throw new Error('blocked'); } })).toBeNull();
  });
});

describe('form rules', () => {
  it('team names 1–40, player names 1–24, passwords 8+', () => {
    expect(validTeamName(' Night Owls ')).toBe(true);
    expect(validTeamName('   ')).toBe(false);
    expect(validTeamName('x'.repeat(41))).toBe(false);
    expect(validPlayerName('x'.repeat(24))).toBe(true);
    expect(validPlayerName('x'.repeat(25))).toBe(false);
    expect(validNewPassword('1234567')).toBe(false);
    expect(validNewPassword('12345678')).toBe(true);
  });
});

describe('errors from email links', () => {
  const hist = () => {
    const calls = [];
    return { calls, replaceState: (_s, _t, url) => calls.push(url) };
  };

  it('reads an expired link from the query and cleans the address', () => {
    const h = hist();
    expect(takeAuthLinkError({ pathname: '/', search: '?error=access_denied&error_code=otp_expired&error_description=x', hash: '#/team' }, h)).toBe('otp_expired');
    expect(h.calls).toEqual(['/#/team']);
  });

  it('reads it from the hash too', () => {
    const h = hist();
    expect(takeAuthLinkError({ pathname: '/', search: '', hash: '#error=access_denied&error_code=otp_expired' }, h)).toBe('otp_expired');
    expect(h.calls).toEqual(['/']);
  });

  it('ignores normal addresses', () => {
    expect(takeAuthLinkError({ pathname: '/', search: '?steam=abc', hash: '#/maps' }, hist())).toBeNull();
  });
});
