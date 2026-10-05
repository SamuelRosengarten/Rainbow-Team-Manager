export const PLAYERS = ['Samuel', 'Anthony', 'Xavier', 'Mathis', 'William'];

export const SIDES = [
  { id: 'attack', label: 'Attackers' },
  { id: 'defend', label: 'Defenders' },
];

export const EMPTY_TEAM_STATE = {
  side: 'attack',
  mapId: '',
  site: '',
  bans: [],
  lineup: null, // { side, players: { [name]: operatorId } }
  tacticId: null,
};
