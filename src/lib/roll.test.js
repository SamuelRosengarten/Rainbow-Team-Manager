import { en } from './testUtils.js';
import { describe, it, expect } from 'vitest';
import {
  FAVORITE_WEIGHT,
  formatLineupText,
  maxMatching,
  rerollPlayer,
  rerollPlayers,
  rollLineup,
  weightedPick,
} from './roll.js';
import { OPS, OPS_BY_ID, PLAYERS, seededRng, values } from './testUtils.js';

const base = { players: PLAYERS, operators: OPS, side: 'attack' };

describe('rollLineup', () => {
  it('gives every player a distinct operator from the selected side', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const res = rollLineup({ ...base, rng: seededRng(seed) });
      expect(res.ok).toBe(true);
      const ids = values(res.lineup);
      expect(ids).toHaveLength(5);
      expect(new Set(ids).size).toBe(5);
      ids.forEach((id) => expect(OPS_BY_ID[id].side).toBe('attack'));
    }
  });

  it('keeps the players in their fixed order', () => {
    const res = rollLineup({ ...base, rng: seededRng(3) });
    expect(Object.keys(res.lineup)).toEqual(PLAYERS);
  });

  it('never rolls a banned operator', () => {
    const bans = ['thermite', 'ash', 'iq'];
    for (let seed = 1; seed <= 200; seed += 1) {
      const res = rollLineup({ ...base, bans, rng: seededRng(seed) });
      expect(res.ok).toBe(true);
      values(res.lineup).forEach((id) => expect(bans).not.toContain(id));
    }
  });

  it('returns a clear error when bans leave too few operators', () => {
    const res = rollLineup({ ...base, bans: ['thermite', 'hibana', 'ash', 'sledge'] });
    expect(res.ok).toBe(false);
    expect(en(res.error)).toMatch(/Only 4 attackers available after bans and blocks, but 5 are needed/);
  });

  it('returns an error naming the player when their owned pool is empty', () => {
    const prefs = Object.fromEntries(PLAYERS.map((p) => [p, { owned: ['thermite', 'ash', 'iq', 'lion', 'sledge'] }]));
    prefs.Xavier = { owned: [] };
    const res = rollLineup({ ...base, prefs, ownedOnly: true });
    expect(res.ok).toBe(false);
    expect(en(res.error)).toMatch(/Xavier/);
  });

  it('uses only each player\'s owned operators when owned-only is on', () => {
    const prefs = {
      Samuel: { owned: ['thermite', 'hibana'] },
      Anthony: { owned: ['thermite'] },
      Xavier: { owned: ['ash', 'sledge', 'iq'] },
      Mathis: { owned: ['iq'] },
      William: { owned: ['lion', 'montagne'] },
    };
    for (let seed = 1; seed <= 100; seed += 1) {
      const res = rollLineup({ ...base, prefs, ownedOnly: true, rng: seededRng(seed) });
      expect(res.ok).toBe(true);
      for (const p of PLAYERS) expect(prefs[p].owned).toContain(res.lineup[p]);
      expect(res.lineup.Anthony).toBe('thermite');
      expect(res.lineup.Samuel).toBe('hibana');
      expect(res.lineup.Mathis).toBe('iq');
      expect(new Set(values(res.lineup)).size).toBe(5);
    }
  });

  it('errors when owned pools overlap too much to give everyone a distinct operator', () => {
    const prefs = Object.fromEntries(PLAYERS.map((p) => [p, { owned: ['thermite', 'ash', 'iq'] }]));
    const res = rollLineup({ ...base, prefs, ownedOnly: true });
    expect(res.ok).toBe(false);
    expect(en(res.error)).toMatch(/Not enough different attackers/);
  });

  it('ignores owned lists when owned-only is off', () => {
    const prefs = Object.fromEntries(PLAYERS.map((p) => [p, { owned: [] }]));
    expect(rollLineup({ ...base, prefs, ownedOnly: false }).ok).toBe(true);
  });

  it('never rolls a blocked operator for the player who blocked it', () => {
    const avoid = ['thermite', 'hibana', 'ash'];
    for (let seed = 1; seed <= 200; seed += 1) {
      const res = rollLineup({ ...base, prefs: { Samuel: { avoid } }, rng: seededRng(seed) });
      expect(avoid).not.toContain(res.lineup.Samuel);
    }
  });

  it('fails clearly instead of rolling a blocked operator when nothing else is left', () => {
    const prefs = { Samuel: { owned: ['thermite'], avoid: ['thermite'] } };
    for (const p of PLAYERS.slice(1)) prefs[p] = { owned: ['ash', 'iq', 'lion', 'sledge'] };
    const res = rollLineup({ ...base, prefs, ownedOnly: true, rng: seededRng(9) });
    expect(res.ok).toBe(false);
    expect(en(res.error)).toMatch(/Samuel.*blocked/);
  });

  it('weights favourites more heavily', () => {
    const counts = { fav: 0, total: 0 };
    const rng = seededRng(42);
    const players = ['Samuel'];
    for (let i = 0; i < 4000; i += 1) {
      const res = rollLineup({ players, operators: OPS, side: 'attack', prefs: { Samuel: { favorites: ['iq'] } }, rng });
      counts.total += 1;
      if (res.lineup.Samuel === 'iq') counts.fav += 1;
    }
    // 8 attackers, iq weighted 5 => expected 5/12 = 0.42; uniform would be 0.125.
    const share = counts.fav / counts.total;
    expect(share).toBeGreaterThan(0.37);
    expect(share).toBeLessThan(0.47);
    expect(FAVORITE_WEIGHT).toBe(5);
  });
});

describe('rerollPlayer', () => {
  const start = { Samuel: 'thermite', Anthony: 'ash', Xavier: 'iq', Mathis: 'lion', William: 'thatcher' };

  it('changes only the chosen player and keeps the rest exactly', () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const res = rerollPlayer({ ...base, lineup: start, player: 'Xavier', rng: seededRng(seed) });
      expect(res.ok).toBe(true);
      for (const p of PLAYERS.filter((x) => x !== 'Xavier')) expect(res.lineup[p]).toBe(start[p]);
      expect(res.lineup.Xavier).not.toBe('iq');
      expect(new Set(values(res.lineup)).size).toBe(5);
    }
  });

  it('respects bans and never duplicates a teammate', () => {
    const bans = ['hibana', 'sledge'];
    for (let seed = 1; seed <= 100; seed += 1) {
      const res = rerollPlayer({ ...base, lineup: start, player: 'Samuel', bans, rng: seededRng(seed) });
      expect(bans).not.toContain(res.lineup.Samuel);
      expect(res.lineup.Samuel).toBe('montagne');
    }
  });

  it('keeps the current operator if it is the only valid option', () => {
    const prefs = { Samuel: { owned: ['thermite'] } };
    for (const p of PLAYERS.slice(1)) prefs[p] = { owned: OPS.map((o) => o.id) };
    const res = rerollPlayer({ ...base, lineup: start, player: 'Samuel', prefs, ownedOnly: true });
    expect(res.ok).toBe(true);
    expect(res.lineup.Samuel).toBe('thermite');
  });

  it('reports an error when nothing is left for that player', () => {
    const res = rerollPlayer({ ...base, lineup: start, player: 'Samuel', bans: ['thermite', 'hibana', 'sledge', 'montagne'] });
    expect(res.ok).toBe(false);
    expect(en(res.error)).toMatch(/Samuel/);
  });

  it('rerollPlayers can re-roll several players at once', () => {
    const res = rerollPlayers({ ...base, lineup: start, targets: ['Samuel', 'Anthony'], rng: seededRng(5) });
    expect(res.ok).toBe(true);
    expect(res.lineup.Xavier).toBe('iq');
    expect(new Set(values(res.lineup)).size).toBe(5);
  });
});

describe('helpers', () => {
  it('maxMatching finds a full assignment when one exists', () => {
    const m = maxMatching(['a', 'b', 'c'], { a: ['x', 'y'], b: ['x'], c: ['y', 'z'] }, seededRng(1));
    expect(m.b).toBe('x');
    expect(m.a).toBe('y');
    expect(m.c).toBe('z');
  });

  it('weightedPick returns null for an empty list', () => {
    expect(weightedPick([], () => 1)).toBeNull();
  });

  it('formats Discord-friendly lineup text', () => {
    const text = formatLineupText({
      lineup: { Samuel: 'ash', Anthony: 'thermite' },
      players: ['Samuel', 'Anthony'],
      operatorsById: OPS_BY_ID,
      side: 'attack',
      mapName: 'Bank',
      site: 'B Lockers / CCTV Room',
    });
    expect(text).toBe('Map: Bank | Site: B Lockers / CCTV Room | Attackers: Samuel - Ash | Anthony - Thermite');
  });
});
