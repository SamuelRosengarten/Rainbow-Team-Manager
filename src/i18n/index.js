// Language support: English and Canadian French (informal "tu"), a pseudo-locale
// for catching untranslated text, and the helpers every screen uses.
//
// Components call `useI18n()` (it re-renders them when the language changes).
// Pure code (lib/*.js) never builds English text: it returns message
// descriptors { id, values } and the screen renders them with `tm()`.
import { useMemo, useSyncExternalStore } from 'react';
import { EN, FR } from './messages/index.js';
import { parse, pseudoLiteral, render } from './format.js';

/** Languages the person can pick. `pseudo` exists only for testing (?lang=pseudo). */
export const LOCALES = {
  en: { id: 'en', label: 'English', short: 'EN', lang: 'en', intl: 'en-CA' },
  fr: { id: 'fr', label: 'Français', short: 'FR', lang: 'fr-CA', intl: 'fr-CA' },
};
const PSEUDO = { id: 'pseudo', label: 'Pseudo', short: 'PS', lang: 'en', intl: 'en-CA' };
const KEY = 'r6tp.lang';
const DICT = { en: EN, fr: FR, pseudo: EN };

/** fr* means French, anything else English. */
export const fromNavigator = (lang) => (String(lang ?? '').toLowerCase().startsWith('fr') ? 'fr' : 'en');

function detect() {
  try {
    const q = new URLSearchParams(globalThis.location?.search ?? '').get('lang');
    if (q === 'pseudo' || q === 'en' || q === 'fr') return q;
  } catch {
    // no location (tests)
  }
  try {
    const stored = globalThis.localStorage?.getItem(KEY);
    if (stored === 'en' || stored === 'fr') return stored;
  } catch {
    // storage blocked: fall through to the browser language
  }
  return fromNavigator(globalThis.navigator?.language);
}

let current = detect();
const listeners = new Set();
const info = (loc) => (loc === 'pseudo' ? PSEUDO : LOCALES[loc]);
if (typeof document !== 'undefined') document.documentElement.lang = info(current).lang;

export const getLocale = () => current;
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Switch language: no reload, saved, <html lang> updated. */
export function setLocale(next) {
  if (!DICT[next] || next === current) return;
  current = next;
  if (next !== 'pseudo') {
    try {
      globalThis.localStorage?.setItem(KEY, next);
    } catch {
      // storage blocked: the choice lasts for this visit
    }
  }
  if (typeof document !== 'undefined') document.documentElement.lang = info(next).lang;
  listeners.forEach((fn) => fn());
}

const compiled = new Map();
const nodesOf = (src) => {
  let n = compiled.get(src);
  if (!n) {
    n = parse(src);
    compiled.set(src, n);
  }
  return n;
};

// Values may themselves be message descriptors (translated first) or arrays of them.
const resolve = (v) => (Array.isArray(v) ? v.map(resolve) : v && typeof v === 'object' && typeof v.id === 'string' && !(v instanceof Date) ? t(v.id, v.values) : v);

/** Translate `key` in the current language. Missing keys fall back to English, then show the key. */
export function t(key, rawValues) {
  const loc = current;
  const values = rawValues && Object.fromEntries(Object.entries(rawValues).map(([k, v]) => [k, resolve(v)]));
  const src = DICT[loc][key] ?? EN[key];
  if (src === undefined) return `⟪${key}⟫`;
  const out = render(nodesOf(src), values, { locale: info(loc).intl, literal: loc === 'pseudo' ? pseudoLiteral : undefined });
  return loc === 'pseudo' ? `⟦${out}⟧` : out;
}

/** Render a message descriptor { id, values } produced by pure code. */
export const tm = (m) => (m ? t(m.id, m.values) : '');
/** A string stays as is; a descriptor is translated (for fields that may hold either). */
export const tx = (v) => (typeof v === 'string' ? v : tm(v));
/** Build a descriptor. */
export const msg = (id, values) => ({ id, values });

export const intlLocale = () => info(current).intl;
export const formatNumber = (n, opts) => new Intl.NumberFormat(intlLocale(), opts).format(n);
/** 54 -> "54%" in English, "54 %" in French. */
export const formatPercent = (n) => new Intl.NumberFormat(intlLocale(), { style: 'percent', maximumFractionDigits: 0 }).format(n / 100);
export const formatList = (items, type = 'conjunction') => new Intl.ListFormat(intlLocale(), { style: 'long', type }).format(items.map(String));
export const formatDate = (d, opts = { dateStyle: 'medium' }) => new Intl.DateTimeFormat(intlLocale(), opts).format(new Date(d));

/** "2 hours ago" / "il y a 2 heures", or 'just now'. `now` is injectable for tests. */
export function relativeTime(iso, now = Date.now()) {
  const ts = Date.parse(iso ?? '');
  if (!Number.isFinite(ts)) return '';
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return t('time.justNow');
  const rtf = new Intl.RelativeTimeFormat(intlLocale(), { numeric: 'auto' });
  if (s < 3600) return rtf.format(-Math.floor(s / 60), 'minute');
  if (s < 86400) return rtf.format(-Math.floor(s / 3600), 'hour');
  return rtf.format(-Math.floor(s / 86400), 'day');
}

/**
 * A { id: label } table whose labels come from the message files and follow
 * the current language every time they're read: labelTable('role', ids) gives
 * { 'hard-breacher': t('role.hard-breacher'), ... }. Object.entries() works.
 */
export function labelTable(prefix, ids) {
  const table = {};
  for (const id of ids) Object.defineProperty(table, id, { enumerable: true, get: () => t(`${prefix}.${id}`) });
  return table;
}

/**
 * Definitions with language-following text fields: labelled('zone', defs, { label: 'zone', text: 'zoneText' })
 * adds getters label -> t('zone.<id>') and text -> t('zoneText.<id>') to each definition.
 */
export function labelled(defs, fields) {
  return Object.fromEntries(
    Object.entries(defs).map(([id, def]) => [
      id,
      Object.defineProperties({ ...def }, Object.fromEntries(Object.entries(fields).map(([prop, ns]) => [prop, { enumerable: true, get: () => t(`${ns}.${id}`) }]))),
    ]),
  );
}

/** The hook screens use. Returns the current locale and bound helpers. */
export function useI18n() {
  const locale = useSyncExternalStore(subscribe, getLocale, getLocale);
  return useMemo(
    () => ({ locale, t, tm, setLocale, number: formatNumber, percent: formatPercent, list: formatList, date: formatDate, relative: relativeTime }),
    // `locale` is the dependency: the helpers read the module's current language.
    [locale],
  );
}
