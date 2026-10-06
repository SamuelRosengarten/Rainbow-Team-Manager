// All message dictionaries, merged. Each module exports { en, fr }.
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
const merge = (lang) => Object.assign({}, ...Object.values(MODULES).map((m) => m[lang]));
export const EN = merge('en');
export const FR = merge('fr');
