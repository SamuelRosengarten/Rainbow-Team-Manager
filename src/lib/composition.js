// Tactical integrity of a composition. Pure functions, no React, no network.
//
// Roles (fit.js) are broad: "support" covers Thatcher's EMPs and Montagne's
// shield alike. A plan usually depends on a few specific utilities instead:
// the hard breach and whatever clears denial for it on attack, the breach
// denial on a defensive hold. This module says which utilities a plan needs,
// which slots are the only source of one (key slots), what a swap breaks or
// keeps, which synergy pairs survive, and whether any lineup has the basics.
//
// Operator utility tags live in src/data/operatorUtility.json. Operators whose
// gadget we're not sure how to tag are left untagged (listed under
// `_unconfirmed`), so they never count as providing anything.
import data from '../data/operatorUtility.json';
import { OPERATORS_BY_ID } from './operators.js';
import { SYNERGIES } from './synergy.js';
import { msg } from '../i18n/index.js';

export const UTILITY_TAGS = [
  'hard-breach',
  'electric-clear',
  'breach-denial',
  'anti-projectile',
  'anti-drone',
  'shield',
  'smoke',
  'flash',
  'vertical',
  'soft-breach',
  'intel-cam',
  'anti-roam',
  'trap',
  'flank-watch',
];
export const UNCONFIRMED_UTILITY = data._unconfirmed;

/** Utility tags of an operator ([] when untagged or unknown). */
export const utilityOf = (id) => data.tags[id] ?? [];
export const hasUtility = (id, tag) => utilityOf(id).includes(tag);

// Defensive plan types that hold the site, so they depend on stopping the
// breach (strategy types as normalised by tactical.js; v1 'hold' and 'denial'
// become 'standard' and 'site-denial'). Roam, aggressive and retake plans don't.
const HOLD_TYPES = new Set(['standard', 'site-denial', 'extended-hold', 'passive', 'turtle', 'utility-heavy']);

const opsOf = (slots) => slots.map((s) => s.operatorId).filter(Boolean);

/**
 * Utilities the plan depends on, from its own operators:
 *   - a slot marked `essential` requires every tag its operator has;
 *   - attack: the hard breach, and denial clearing when the plan brings both;
 *   - defense hold/denial plans: the breach denial.
 * @returns {{ tag, providers: string[] (slot keys), partner: string|null (operator relying on it) }[]}
 */
export function requiredUtilities(strategy) {
  const out = new Map();
  const add = (tag, slot, partner = null) => {
    if (!out.has(tag)) out.set(tag, { tag, providers: [], partner });
    const r = out.get(tag);
    if (!r.providers.includes(slot.key)) r.providers.push(slot.key);
    if (!r.partner && partner) r.partner = partner;
  };
  const slots = strategy.slots.filter((s) => s.operatorId);
  for (const s of slots) if (s.essential) utilityOf(s.operatorId).forEach((tag) => add(tag, s));
  if (strategy.side === 'attack') {
    const breachers = slots.filter((s) => hasUtility(s.operatorId, 'hard-breach'));
    breachers.forEach((s) => add('hard-breach', s));
    if (breachers.length) {
      for (const s of slots) if (hasUtility(s.operatorId, 'electric-clear')) add('electric-clear', s, breachers[0].operatorId);
    }
  } else if (HOLD_TYPES.has(strategy.type)) {
    for (const s of slots) if (hasUtility(s.operatorId, 'breach-denial')) add('breach-denial', s);
  }
  return [...out.values()];
}

/**
 * Slots that are the only source of a required utility: slotKey -> tag. Only
 * an operator with that tag should take one of these slots.
 */
export function keySlots(strategy) {
  const out = new Map();
  for (const r of requiredUtilities(strategy)) if (r.providers.length === 1) out.set(r.providers[0], r.tag);
  return out;
}

/**
 * Required utilities missing from a lineup (slot key -> operator):
 * [{ tag, original, replacement, partner }], [] when the plan is intact.
 * @param lineup {slotKey, operatorId}[]
 */
export function integrityIssues(strategy, lineup) {
  const ops = lineup.map((l) => l.operatorId).filter(Boolean);
  const out = [];
  for (const r of requiredUtilities(strategy)) {
    if (ops.some((id) => hasUtility(id, r.tag))) continue;
    const slotKey = r.providers[0];
    const original = strategy.slots.find((s) => s.key === slotKey)?.operatorId ?? null;
    const replacement = lineup.find((l) => l.slotKey === slotKey)?.operatorId ?? null;
    out.push({ tag: r.tag, original, replacement, partner: r.partner && ops.includes(r.partner) ? r.partner : null });
  }
  return out;
}

const pairKey = (a, b) => [a, b].sort().join('+');
const SYNERGY_KEYS = new Set(SYNERGIES.map((p) => pairKey(...p.ops)));
export const isPair = (a, b) => a !== b && SYNERGY_KEYS.has(pairKey(a, b));

/** Synergy pairs among a set of operators, as sorted keys ('a+b'). */
export function pairsAmong(ops) {
  const out = new Set();
  for (let i = 0; i < ops.length; i++) for (let j = i + 1; j < ops.length; j++) if (isPair(ops[i], ops[j])) out.add(pairKey(ops[i], ops[j]));
  return out;
}

/** Pairs the plan relies on that the lineup keeps, loses, and new ones it creates. */
export function synergyDelta(strategy, lineup) {
  const before = pairsAmong(opsOf(strategy.slots));
  const after = pairsAmong(lineup.map((l) => l.operatorId).filter(Boolean));
  return {
    kept: [...before].filter((k) => after.has(k)),
    lost: [...before].filter((k) => !after.has(k)),
    gained: [...after].filter((k) => !before.has(k)),
  };
}

const opName = (id) => OPERATORS_BY_ID[id]?.name ?? id;
const utilityMsg = (tag) => msg(`utility.${tag}`);

/**
 * One message per swapped slot, saying what it costs or keeps, then the
 * synergy pairs lost and gained. `skip` holds slot keys already explained
 * elsewhere (a ban or block replacement), which only get a note if they break
 * a key utility.
 * @returns {{ ok: boolean, msg }[]}
 */
export function swapNotes(strategy, lineup, { skip = new Set() } = {}) {
  const issues = integrityIssues(strategy, lineup);
  const required = requiredUtilities(strategy);
  const out = [];
  for (const l of lineup) {
    const original = strategy.slots.find((s) => s.key === l.slotKey)?.operatorId ?? null;
    if (!l.operatorId || !original || l.operatorId === original) continue;
    const broke = issues.find((x) => x.original === original);
    if (broke) {
      out.push({
        ok: false,
        msg: msg(broke.partner && broke.partner !== l.operatorId ? 'comp.swap.breaks.partner' : 'comp.swap.breaks', {
          replacement: opName(l.operatorId),
          original: opName(original),
          partner: opName(broke.partner),
          utility: utilityMsg(broke.tag),
        }),
      });
      continue;
    }
    if (skip.has(l.slotKey)) continue;
    const kept = required.find((r) => hasUtility(original, r.tag) && hasUtility(l.operatorId, r.tag));
    out.push({
      ok: true,
      msg: kept
        ? msg('comp.swap.keeps', { replacement: opName(l.operatorId), original: opName(original), utility: utilityMsg(kept.tag) })
        : msg('comp.swap', { replacement: opName(l.operatorId), original: opName(original) }),
    });
  }
  const { lost, gained } = synergyDelta(strategy, lineup);
  for (const k of lost) {
    const [a, b] = k.split('+');
    out.push({ ok: false, msg: msg('comp.pair.lost', { a: opName(a), b: opName(b) }) });
  }
  for (const k of gained) {
    const [a, b] = k.split('+');
    out.push({ ok: true, msg: msg('comp.pair.gained', { a: opName(a), b: opName(b) }) });
  }
  return out;
}

/**
 * Basics any full lineup should have, as warnings (never a block):
 * attack: a hard breacher and someone to clear denial for it;
 * defense: breach denial and intel.
 * Checked once the lineup has five operators.
 * @param explained utility tags already reported as a broken key (skipped here)
 * @returns {{ id, msg }[]}
 */
const CHECK_TAG = { noHardBreach: 'hard-breach', noClear: 'electric-clear', noDenial: 'breach-denial' };

export function compositionCheck(side, ops, { explained = [] } = {}) {
  const list = ops.filter((id) => OPERATORS_BY_ID[id]);
  if (list.length < 5) return [];
  const has = (tag) => list.some((id) => hasUtility(id, tag));
  const out = [];
  if (side === 'attack') {
    if (!has('hard-breach')) out.push('noHardBreach');
    else if (!has('electric-clear')) out.push('noClear');
  } else {
    if (!has('breach-denial')) out.push('noDenial');
    if (!list.some((id) => OPERATORS_BY_ID[id].roles.includes('intel') || hasUtility(id, 'intel-cam'))) out.push('noIntel');
  }
  // `explained`: utilities a swap note already accounts for; don't say it twice.
  return out.filter((id) => !explained.includes(CHECK_TAG[id])).map((id) => ({ id, msg: msg(`comp.check.${id}`) }));
}
