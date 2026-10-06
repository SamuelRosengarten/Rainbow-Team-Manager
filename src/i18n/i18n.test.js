import fs from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { argNames, parse, pseudoLiteral, render } from './format.js';
import { EN, FR, SOURCES } from './messages/index.js';
import { formatNumber, formatPercent, fromNavigator, getLocale, relativeTime, setLocale, t, tm, msg } from './index.js';
import { keyReferences } from '../../scripts/i18n-keys.mjs';
import { projectFiles, scanSource } from '../../scripts/i18n-scan.mjs';

const fmt = (src, values, locale = 'en-CA') => render(parse(src), values, { locale });

describe('message format', () => {
  it('fills placeholders, plurals and lists in the active language', () => {
    expect(fmt('{used} of {total, plural, one {# player} other {# players}}', { used: 2, total: 4 })).toBe('2 of 4 players');
    expect(fmt('{n, plural, =0 {none} one {# player} other {# players}}', { n: 0 })).toBe('none');
    expect(fmt('{names, list} {count, plural, =2 {both} other {all}} like it', { names: ['Anthony', 'Mathis'], count: 2 })).toBe('Anthony and Mathis both like it');
    expect(fmt('{names, list}', { names: ['Anthony', 'Mathis', 'William'] }, 'fr-CA')).toBe('Anthony, Mathis et William');
    expect(fmt('{names, list-or}', { names: ['a', 'b'] }, 'fr-CA')).toBe('a ou b');
  });

  it('knows French plurals (0 and 1 are singular) and number formats', () => {
    const msgFr = '{n, plural, one {# joueur} other {# joueurs}}';
    expect(fmt(msgFr, { n: 0 }, 'fr-CA')).toBe('0 joueur');
    expect(fmt(msgFr, { n: 1 }, 'fr-CA')).toBe('1 joueur');
    expect(fmt(msgFr, { n: 2 }, 'fr-CA')).toBe('2 joueurs');
    expect(fmt('{n, number}', { n: 1234.5 }, 'fr-CA')).toMatch(/^1\s234,5$/);
  });

  it('supports select, nesting, escaped braces and apostrophes', () => {
    expect(fmt('{k, select, a {A {n}} other {Other {n}}}', { k: 'z', n: 5 })).toBe('Other 5');
    expect(fmt("l’opérateur {x} d'Anthony \\{braces\\}", { x: 'Mute' }, 'fr-CA')).toBe("l’opérateur Mute d'Anthony {braces}");
  });

  it('rejects broken templates', () => {
    expect(() => parse('{n, plural, one {# a}}')).toThrow(/other/);
    expect(() => parse('{unclosed')).toThrow();
  });

  it('the pseudo-locale accents text and pads it', () => {
    expect(pseudoLiteral('Save')).toMatch(/^Šávé~+$/);
  });
});

describe('dictionaries', () => {
  const enKeys = Object.keys(EN).sort();
  const frKeys = Object.keys(FR).sort();

  it('have the same keys in English and French', () => {
    expect(enKeys.filter((k) => !(k in FR)), 'missing in French').toEqual([]);
    expect(frKeys.filter((k) => !(k in EN)), 'missing in English').toEqual([]);
  });

  it('every message parses, and both languages use the same placeholders', () => {
    const problems = [];
    for (const k of enKeys) {
      try {
        const a = argNames(EN[k]);
        const b = argNames(FR[k] ?? '');
        if (JSON.stringify(a) !== JSON.stringify(b)) problems.push(`${k}: ${a.join(',')} vs ${b.join(',')}`);
      } catch (e) {
        problems.push(`${k}: ${e.message}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('no key is defined twice across files', () => {
    const seen = new Map();
    const dupes = [];
    for (const [file, keys] of SOURCES) for (const k of keys) (seen.has(k) ? dupes.push(`${k} (${seen.get(k)} and ${file})`) : seen.set(k, file));
    expect(dupes).toEqual([]);
  });

  it('French uses the informal "tu", never "vous / votre / vos"', () => {
    const formal = frKeys.filter((k) => /\b(vous|votre|vos)\b/i.test(FR[k]));
    expect(formal).toEqual([]);
  });

  it('no message is empty', () => {
    expect(enKeys.filter((k) => !EN[k].trim() && !k.endsWith('.open'))).toEqual([]);
    expect(frKeys.filter((k) => !FR[k].trim())).toEqual([]);
  });
});

describe('key references in the source', () => {
  const { literals, prefixes } = keyReferences();
  const namespaces = new Set(Object.keys(EN).map((k) => k.split('.')[0]));
  // A literal that starts with one of our namespaces is meant as a key.
  const isOurs = (s) => namespaces.has(s.split('.')[0]);

  it('every key the code asks for exists', () => {
    const missing = [...literals].filter(([k]) => isOurs(k) && !(k in EN)).map(([k, where]) => `${k} (${where[0]})`);
    expect(missing).toEqual([]);
  });

  it('every dynamic key prefix matches some messages', () => {
    const empty = [...prefixes].filter(([p]) => isOurs(p) && !enKeysStartingWith(p)).map(([p, where]) => `${p}… (${where[0]})`);
    expect(empty).toEqual([]);
  });

  it('no message is unused', () => {
    const unused = Object.keys(EN).filter((k) => !literals.has(k) && ![...prefixes.keys()].some((p) => k.startsWith(p)));
    expect(unused).toEqual([]);
  });
});

function enKeysStartingWith(prefix) {
  return Object.keys(EN).some((k) => k.startsWith(prefix));
}

describe('no hardcoded user-facing text in components', () => {
  it('every JSX text, aria-label, title, placeholder and alt goes through t()', () => {
    const hits = projectFiles().flatMap((f) => scanSource(fs.readFileSync(f, 'utf8'), f.replace(/.*src[\\/]/, 'src/')));
    expect(hits.map((h) => `${h.file}:${h.line} [${h.kind}] ${h.text}`)).toEqual([]);
  });
});

describe('every message renders in every language (including the pseudo-locale)', () => {
  const sample = (src) => {
    const values = {};
    const walkNodes = (nodes) => {
      for (const n of nodes) {
        if (n.arg) values[n.arg] = n.type === 'list' || n.type === 'list-or' ? ['A', 'B', 'C'] : n.type === 'plural' || n.type === 'number' || n.type === 'percent' ? 3 : n.type === 'date' || n.type === 'time' ? new Date(0) : n.type === 'select' ? 'x' : 'X';
        if (n.cases) Object.values(n.cases).forEach(walkNodes);
      }
    };
    walkNodes(parse(src));
    return values;
  };
  afterEach(() => setLocale('en'));

  it('renders all keys without throwing and the pseudo-locale marks every one', () => {
    for (const lang of ['en', 'fr', 'pseudo']) {
      setLocale(lang);
      for (const k of Object.keys(EN)) {
        const out = t(k, sample(EN[k]));
        expect(typeof out).toBe('string');
        expect(out.includes('⟪')).toBe(false); // never the "missing key" marker
        if (lang === 'pseudo') expect(out.startsWith('⟦') && out.endsWith('⟧')).toBe(true);
      }
    }
  });

  it('translates nested descriptors and falls back visibly for a missing key', () => {
    setLocale('en');
    expect(t('lineup.why.ownFavorite', { player: 'Anthony', operator: 'Mute' })).toBe('Mute is Anthony’s favourite.');
    expect(tm(msg('rec.noBlocks'))).toBe('Nobody has blocked these operators');
    expect(t('no.such.key')).toBe('⟪no.such.key⟫');
    setLocale('fr');
    expect(t('lineup.why.ownFavorite', { player: 'Anthony', operator: 'Mute' })).toBe('Mute est le favori de Anthony.');
  });
});

describe('language choice', () => {
  it('fr* means French, anything else English', () => {
    for (const l of ['fr', 'fr-CA', 'fr-FR', 'FR-be']) expect(fromNavigator(l)).toBe('fr');
    for (const l of ['en', 'en-US', 'de', '', undefined]) expect(fromNavigator(l)).toBe('en');
  });

  it('switches without a reload, saves the choice and sets <html lang>', () => {
    const store = {};
    globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = v), removeItem: (k) => delete store[k] };
    globalThis.document = { documentElement: { lang: 'en' } };
    setLocale('fr');
    expect(getLocale()).toBe('fr');
    expect(store['r6tp.lang']).toBe('fr');
    expect(globalThis.document.documentElement.lang).toBe('fr-CA');
    setLocale('en');
    expect(globalThis.document.documentElement.lang).toBe('en');
    delete globalThis.document;
    delete globalThis.localStorage;
  });

  it('formats numbers, percents and dates in the active language', () => {
    setLocale('en');
    expect(formatNumber(1234.5)).toBe('1,234.5');
    expect(formatPercent(54)).toBe('54%');
    setLocale('fr');
    expect(formatNumber(1234.5)).toMatch(/^1\s234,5$/);
    expect(formatPercent(54)).toMatch(/^54\s%$/);
    expect(relativeTime('2026-01-01T10:00:00Z', Date.parse('2026-01-01T12:00:00Z'))).toBe('il y a 2 heures');
    setLocale('en');
  });
});
