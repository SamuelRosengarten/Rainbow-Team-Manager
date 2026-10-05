import operatorList from '../data/operators.json';
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
  return name.slice(0, 2).toUpperCase();
}

export function operatorImage(id) {
  return `${import.meta.env.BASE_URL}operators/${id}.png`;
}
