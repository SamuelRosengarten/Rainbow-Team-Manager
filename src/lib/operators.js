import operatorList from '../data/operators.json';
import profiles from '../data/operatorProfiles.json';
import { indexOperators } from './roll.js';

export const OPERATORS = operatorList;
export const OPERATORS_BY_ID = indexOperators(operatorList);

export function operatorsForSide(side) {
  return OPERATORS.filter((op) => op.side === side).sort((a, b) => a.name.localeCompare(b.name));
}

/** "Solid Snake" -> "SS", "Thermite" -> "TH". */
export function initials(name = '') {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase();
}

export function operatorImage(id) {
  return `${import.meta.env.BASE_URL}operators/${id}.svg`;
}

const EMPTY_PROFILE = { health: 0, speed: 0, ability: '', abilityText: '', primary: [], secondary: [], tip: '', check: false };

/** Stats, ability and loadout for an operator, from operatorProfiles.json. */
export function operatorProfile(id) {
  return profiles[id] ? { ...EMPTY_PROFILE, ...profiles[id] } : { ...EMPTY_PROFILE, check: true };
}

/**
 * Link to the operator's intro video. Uses an exact `video` URL from
 * operatorProfiles.json when set, otherwise a YouTube search that always works.
 */
export function operatorVideoUrl(operator) {
  const exact = profiles[operator.id]?.video;
  if (exact) return exact;
  const q = `Rainbow Six Siege ${operator.name} operator video`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}
