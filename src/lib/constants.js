import { t } from '../i18n/index.js';
export const PLAYERS = ['Samuel', 'Anthony', 'Xavier', 'Mathis', 'William'];

/** The two sides; `label` follows the current language (side.<id>). */
export const SIDES = ['attack', 'defend'].map((id) => Object.defineProperty({ id }, 'label', { enumerable: true, get: () => t(`side.${id}`) }));

export const EMPTY_TEAM_STATE = {
  side: 'attack',
  mapId: '',
  site: '',
  bans: [],
  lineup: null, // { side, players: { [name]: operatorId } }
  tacticId: null,
  ownedOnly: false,
};
