import { describe, it, expect } from 'vitest';
import { SYNERGIES, compositionSynergies, suggestedPartners, synergiesFor } from './synergy.js';
import { OPERATORS_BY_ID } from './operators.js';

describe('synergy', () => {
  it('only lists pairs of known operators on the same side', () => {
    for (const p of SYNERGIES) {
      expect(p.ops).toHaveLength(2);
      expect(OPERATORS_BY_ID[p.ops[0]].side).toBe(OPERATORS_BY_ID[p.ops[1]].side);
    }
  });

  it('names the partner of each pair for an operator', () => {
    const partners = synergiesFor('thatcher').map((p) => p.partner);
    expect(partners).toContain('thermite');
    expect(partners).not.toContain('thatcher');
  });

  it('finds pairs inside a composition, ignoring empty slots', () => {
    const found = compositionSynergies(['thermite', 'thatcher', null, 'ash', '']);
    expect(found.map((p) => [...p.ops].sort().join('+'))).toEqual(expect.arrayContaining(['thatcher+thermite', 'ash+thermite']));
  });

  it('suggests missing partners on the same side, most pairs first', () => {
    const out = suggestedPartners(['thermite', 'hibana'], 'attack');
    expect(out[0].id).toBe('thatcher');
    expect(out[0].pairs.map((p) => p.with).sort()).toEqual(['hibana', 'thermite']);
    expect(out.every((x) => OPERATORS_BY_ID[x.id].side === 'attack')).toBe(true);
    expect(out.some((x) => x.id === 'thermite' || x.id === 'hibana')).toBe(false);
  });

  it('leaves out blocked and banned operators and puts favorites first', () => {
    const pref = { blockedForAll: new Set(['thatcher']), banned: new Set(['maverick']), favorites: new Set(['twitch']) };
    const out = suggestedPartners(['thermite'], 'attack', 6, pref);
    expect(out.map((x) => x.id)).not.toContain('thatcher');
    expect(out.map((x) => x.id)).not.toContain('maverick');
    expect(out[0]).toMatchObject({ id: 'twitch', favorite: true });
  });
});
