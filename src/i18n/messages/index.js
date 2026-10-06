// All message dictionaries, merged.
//  - Hand-written modules export { en, fr } (shared words, finder, lib text…).
//  - screens/<name>.en.js and screens/<name>.fr.js hold the text of each screen (default export).
// The i18n test checks that every key exists in both languages with the same placeholders.
import * as common from './common.js';
import * as roles from './roles.js';
import * as rec from './rec.js';
import * as lineup from './lineup.js';
import * as finder from './finder.js';
import * as tactical from './tactical.js';
import * as lib from './lib.js';
import * as ui from './ui.js';
import * as cards from './cards.js';

export const MODULES = { common, roles, rec, lineup, finder, tactical, lib, ui, cards };
const screensEn = import.meta.glob('./screens/*.en.js', { eager: true, import: 'default' });
const screensFr = import.meta.glob('./screens/*.fr.js', { eager: true, import: 'default' });
// Hand-written { en, fr } pairs for text with placeholders (manual/*.js).
const manual = import.meta.glob('./manual/*.js', { eager: true });

const merge = (lang, screens) => Object.assign({}, ...Object.values(MODULES).map((m) => m[lang]), ...Object.values(manual).map((m) => m[lang]), ...Object.values(screens));
export const EN = merge('en', screensEn);
export const FR = merge('fr', screensFr);
/** Which module each key came from (for duplicate detection in tests). */
export const SOURCES = [
  ...Object.entries(MODULES).map(([name, m]) => [name, Object.keys(m.en)]),
  ...Object.entries(manual).map(([path, m]) => [path, Object.keys(m.en)]),
  ...Object.entries(screensEn).map(([path, d]) => [path, Object.keys(d)]),
];
