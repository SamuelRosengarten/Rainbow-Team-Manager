import { describe, it, expect } from 'vitest';
import raw from '../data/strategies.json';
import utility from '../data/operatorUtility.json';
import { OPERATORS, OPERATORS_BY_ID } from './operators.js';
import { createStrategy, normalizeStrategy } from './strategies.js';
import { preferenceSet, rankCompare, recommendStrategy } from './recommend.js';
import { genericSlots, recommendLineup } from './lineup.js';
import { findStrategies } from './finder.js';
import { compositionCheck, integrityIssues, keySlots, requiredUtilities, swapNotes, synergyDelta, utilityOf } from './composition.js';

const LIB = raw.map((s) => normalizeStrategy(s));
const byTitle = (title) => LIB.find((s) => s.title === title);
const CHURCH_EXECUTE = byTitle('Church wall execute'); // thermite, thatcher, iq, sledge, nomad
const BREACH_DENIAL = byTitle('Basement breach denial'); // bandit, jager, smoke, azami, mira
const FIVE = ['Samuel', 'Anthony', 'Xavier', 'Mathis', 'William'];
const ops = (rec) => rec.lineup.map((l) => l.operatorId);
const roster = FIVE.map((name) => ({ name, stats: null }));

describe('utility data', () => {
  it('tags only real operators with known tags, and lists every other operator as unconfirmed', () => {
    for (const id of [...Object.keys(utility.tags), ...utility._unconfirmed]) expect(OPERATORS_BY_ID[id], id).toBeTruthy();
    for (const op of OPERATORS) {
      const tagged = Boolean(utility.tags[op.id]);
      const listed = utility._unconfirmed.includes(op.id);
      expect(tagged !== listed, `${op.id} must be tagged xor unconfirmed`).toBe(true);
    }
    expect(utilityOf('thatcher')).toContain('electric-clear');
    expect(utilityOf('montagne')).not.toContain('electric-clear');
    expect(utilityOf('bandit')).toContain('breach-denial');
    expect(utilityOf('echo')).not.toContain('breach-denial');
  });
});

describe('requiredUtilities / keySlots', () => {
  it('an attack plan with a hard breacher needs the breach and its denial clear', () => {
    expect(CHURCH_EXECUTE.slots.map((s) => s.operatorId)).toEqual(['thermite', 'thatcher', 'iq', 'sledge', 'nomad']);
    const req = requiredUtilities(CHURCH_EXECUTE);
    expect(req.map((r) => r.tag).sort()).toEqual(['electric-clear', 'hard-breach']);
    expect(req.find((r) => r.tag === 'electric-clear').partner).toBe('thermite');
    expect([...keySlots(CHURCH_EXECUTE).values()].sort()).toEqual(['electric-clear', 'hard-breach']);
  });

  it('a defensive denial or hold plan needs its breach denial; a roam plan does not', () => {
    expect(BREACH_DENIAL.type).toMatch(/denial|hold/);
    expect(requiredUtilities(BREACH_DENIAL).map((r) => r.tag)).toEqual(['breach-denial']);
    const roam = createStrategy({ title: 'r', side: 'defend', type: 'roam', slots: [{ key: 's1', operatorId: 'bandit' }] });
    expect(requiredUtilities(roam)).toEqual([]);
  });

  it('a slot marked essential requires its operator’s utilities', () => {
    const s = createStrategy({ title: 'x', side: 'attack', slots: [{ key: 's1', operatorId: 'montagne', essential: true }] });
    expect(s.slots[0].essential).toBe(true);
    expect(requiredUtilities(s).map((r) => r.tag)).toEqual(['shield']);
  });

  it('two providers of the same utility make neither slot key, but losing both is still caught', () => {
    const s = createStrategy({ title: 'x', side: 'attack', slots: [{ key: 'a', operatorId: 'thermite' }, { key: 'b', operatorId: 'thatcher' }, { key: 'c', operatorId: 'kali' }] });
    expect(keySlots(s).get('b')).toBeUndefined();
    expect(integrityIssues(s, [{ slotKey: 'a', operatorId: 'thermite' }, { slotKey: 'b', operatorId: 'montagne' }, { slotKey: 'c', operatorId: 'blitz' }])).toHaveLength(1);
  });
});

describe('confirmed bug 1: a favourite that only shares a role replaces a key operator', () => {
  it('Montagne as a favourite no longer replaces Thatcher on a Thermite plan', () => {
    const pref = preferenceSet({ Samuel: { favorites: ['montagne'] } }, FIVE);
    const rec = recommendStrategy(CHURCH_EXECUTE, { pref });
    expect(ops(rec)).toContain('thatcher');
    expect(ops(rec)).toContain('thermite');
    expect(rec.brokenKeys).toEqual([]);
    // Montagne may still take a slot that isn't key (Nomad's support slot here).
    expect(rec.lineup.find((l) => l.operatorId === 'montagne')?.original ?? 'nomad').toBe('nomad');
  });

  it('with Thatcher the only support, the idle favourite is explained, not silently dropped', () => {
    const plan = createStrategy({ title: 'Lone EMP', side: 'attack', slots: ['thermite', 'thatcher', 'iq', 'sledge', 'ash'].map((operatorId, i) => ({ key: `s${i}`, operatorId })) });
    const rec = recommendStrategy(plan, { pref: preferenceSet({ Samuel: { favorites: ['montagne'] } }, FIVE) });
    expect(ops(rec)).toContain('thatcher');
    expect(ops(rec)).not.toContain('montagne');
    expect(rec.favoritesIdle.find((f) => f.id === 'montagne').msg.id).toBe('comp.idle.key');
  });

  it('Echo as a favourite no longer replaces Bandit on “Basement breach denial”', () => {
    const pref = preferenceSet({ Samuel: { favorites: ['smoke', 'rook', 'echo'] } }, FIVE);
    const rec = recommendStrategy(BREACH_DENIAL, { pref });
    expect(ops(rec)).toContain('bandit');
    expect(rec.brokenKeys).toEqual([]);
  });

  it('a favourite with the same utility may still take a key slot, and the swap says so', () => {
    const plan = createStrategy({ title: 'Lone EMP', side: 'attack', slots: ['thermite', 'thatcher', 'iq', 'sledge', 'ash'].map((operatorId, i) => ({ key: `s${i}`, operatorId })) });
    const rec = recommendStrategy(plan, { pref: preferenceSet({ Samuel: { favorites: ['kali'] } }, FIVE) });
    expect(ops(rec)).toContain('kali');
    expect(rec.brokenKeys).toEqual([]);
    const note = rec.reasons.find((r) => r.msg.id === 'comp.swap.keeps');
    expect(note.msg.values).toMatchObject({ replacement: 'Kali', original: 'Thatcher' });
  });

  it('when a key operator is banned and nothing can replace its utility, the break is explained', () => {
    const pref = preferenceSet({}, FIVE, ['thatcher', 'kali', 'twitch', 'flores', 'brava']);
    const rec = recommendStrategy(CHURCH_EXECUTE, { pref });
    expect(rec.brokenKeys.map((b) => b.tag)).toEqual(['electric-clear']);
    const note = rec.reasons.find((r) => r.msg.id === 'comp.swap.breaks.partner');
    expect(note.ok).toBe(false);
    expect(note.msg.values).toMatchObject({ original: 'Thatcher', partner: 'Thermite' });
  });

  it('the player lineup keeps the key operator too', () => {
    const prefs = { Samuel: { favorites: ['montagne'] } };
    const pref = preferenceSet(prefs, FIVE);
    const plan = recommendLineup({ strategy: CHURCH_EXECUTE, side: 'attack', players: roster, prefs, pref });
    expect(plan.slots.map((s) => s.operatorId)).toContain('thatcher');
    const prefs2 = { Samuel: { favorites: ['echo'] }, Anthony: { favorites: ['rook'] } };
    const plan2 = recommendLineup({ strategy: BREACH_DENIAL, side: 'defend', players: roster, prefs: prefs2, pref: preferenceSet(prefs2, FIVE) });
    expect(plan2.slots.map((s) => s.operatorId)).toContain('bandit');
  });
});

describe('confirmed bug 2: synergy pairs', () => {
  it('reports the pairs a lineup keeps, loses and gains', () => {
    const lineup = CHURCH_EXECUTE.slots.map((s) => ({ slotKey: s.key, operatorId: s.operatorId === 'thatcher' ? 'montagne' : s.operatorId }));
    const d = synergyDelta(CHURCH_EXECUTE, lineup);
    expect(d.lost).toContain('thatcher+thermite');
    expect(d.kept).toContain('iq+thermite');
  });

  it('the engine keeps a pair the plan relies on when the alternative is only as good', () => {
    // No preferences: both engines keep the plan's own pairs.
    const rec = recommendStrategy(CHURCH_EXECUTE, { pref: preferenceSet({}, FIVE) });
    expect(synergyDelta(CHURCH_EXECUTE, rec.lineup).lost).toEqual([]);
  });

  it('a lost pairing is listed in the reasons', () => {
    const s = createStrategy({ title: 'x', side: 'attack', slots: [{ key: 'a', operatorId: 'thermite' }, { key: 'b', operatorId: 'iq' }] });
    const notes = swapNotes(s, [{ slotKey: 'a', operatorId: 'thermite' }, { slotKey: 'b', operatorId: 'lion' }]);
    expect(notes.map((n) => n.msg.id)).toContain('comp.pair.lost');
  });
});

describe('confirmed bug 3: integrity ranks above favourite coverage', () => {
  it('an intact plan outranks a broken adaptation with more favourites', () => {
    const intact = { strategy: CHURCH_EXECUTE, rec: { status: 'ok', brokenKeys: [], favoriteCoverage: 0, favoritesUsed: [], quality: 0.5, compatibility: 0.5 } };
    const broken = { strategy: CHURCH_EXECUTE, rec: { status: 'adapted', brokenKeys: [{ tag: 'electric-clear' }], favoriteCoverage: 1, favoritesUsed: ['montagne'], quality: 0.9, compatibility: 0.9 } };
    expect([broken, intact].sort(rankCompare)[0]).toBe(intact);
  });

  it('the finder carries integrity through the player assignment', () => {
    const prefs = { Samuel: { favorites: ['montagne'] } };
    const pref = preferenceSet(prefs, FIVE);
    const { results } = findStrategies([CHURCH_EXECUTE], { mapId: CHURCH_EXECUTE.mapId, side: 'attack', pref, prefs, roster, picks: FIVE.map((player) => ({ player, operatorId: null })) });
    expect(results[0].rec.brokenKeys).toEqual([]);
    expect(results[0].plan.slots.map((s) => s.operatorId)).toContain('thatcher');
  });
});

describe('finder card warnings', () => {
  it('a forced key-utility break is the first warning, with the reason', () => {
    const bans = ['thatcher', 'kali', 'twitch', 'flores', 'brava'];
    const pref = preferenceSet({}, FIVE, bans);
    const { results } = findStrategies([CHURCH_EXECUTE], { mapId: CHURCH_EXECUTE.mapId, side: 'attack', pref, prefs: {}, roster, picks: FIVE.map((player) => ({ player, operatorId: null })) });
    expect(results[0].rec.brokenKeys.map((b) => b.tag)).toEqual(['electric-clear']);
    expect(results[0].warnings[0].msg.id).toBe('comp.swap.breaks.partner');
    expect([...results[0].warnings, ...results[0].moreWarnings].map((w) => w.msg.id)).not.toContain('comp.check.noClear');
  });
});

describe('compositionCheck', () => {
  it('warns about missing basics on a full lineup only', () => {
    expect(compositionCheck('attack', ['thermite', 'thatcher', 'iq', 'sledge', 'nomad'])).toEqual([]);
    expect(compositionCheck('attack', ['ash', 'iq', 'sledge', 'nomad', 'montagne']).map((c) => c.id)).toEqual(['noHardBreach']);
    expect(compositionCheck('attack', ['thermite', 'iq', 'sledge', 'nomad', 'montagne']).map((c) => c.id)).toEqual(['noClear']);
    expect(compositionCheck('defend', ['smoke', 'rook', 'echo', 'jager', 'castle']).map((c) => c.id)).toEqual(['noDenial']);
    expect(compositionCheck('defend', ['bandit', 'rook', 'castle', 'jager', 'smoke']).map((c) => c.id)).toEqual(['noIntel']);
    expect(compositionCheck('attack', ['ash', 'iq'])).toEqual([]);
    // A utility a swap note already explains isn't repeated.
    expect(compositionCheck('attack', ['thermite', 'iq', 'sledge', 'nomad', 'montagne'], { explained: ['electric-clear'] })).toEqual([]);
  });

  it('the lineup coach shows the check and the generic jobs include the essentials', () => {
    const atk = genericSlots('attack');
    expect(atk.some((s) => s.needs === 'hard-breach')).toBe(true);
    expect(atk.some((s) => s.needs === 'electric-clear')).toBe(true);
    expect(genericSlots('defend').some((s) => s.needs === 'breach-denial')).toBe(true);
    const plan = recommendLineup({ strategy: null, side: 'defend', players: roster, prefs: {}, pref: preferenceSet({}, FIVE) });
    const lineupOps = plan.slots.map((s) => s.operatorId);
    expect(lineupOps.some((id) => utilityOf(id).includes('breach-denial'))).toBe(true);
    expect(plan.checks).toEqual(compositionCheck('defend', lineupOps));
  });
});
