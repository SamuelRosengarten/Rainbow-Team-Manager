// The tactics editor's toolbar: groups, intents, shortcuts and Simple mode's six tools.

export const GROUP_ICON = {
  units: 'user',
  move: 'route',
  intel: 'drone',
  utility: 'diamond',
  breach: 'burst',
  areas: 'area',
  crossfire: 'crossfire',
  objective: 'flag',
  note: 'note',
};

// The toolbar, grouped by what the user is trying to do (names: planner.intent.<id>).
export const INTENTS = [
  ['people', ['units']],
  ['movement', ['move']],
  ['intel', ['intel']],
  ['utility', ['utility', 'breach']],
  ['tactical', ['areas', 'crossfire', 'objective']],
  ['annotation', ['note']],
];
export const INTENT_OF = Object.fromEntries(INTENTS.flatMap(([intent, groups]) => groups.map((g) => [g, intent])));

// One key per tool group; pressing it again cycles through the group's tools.
export const SHORTCUT = { select: 'V', units: 'P', move: 'R', intel: 'I', utility: 'U', breach: 'B', areas: 'A', crossfire: 'C', objective: 'O', note: 'N' };
export const BY_KEY = Object.fromEntries(Object.entries(SHORTCUT).map(([id, k]) => [k.toLowerCase(), id]));

// Simple mode: six tools a new team needs, one click each (planner.simpleTool.<desc>).
export const SIMPLE_TOOLS = [
  { tool: 'position', group: 'units', icon: 'user', key: 'P', desc: 'position' },
  { tool: 'enemy', group: 'units', icon: 'target', key: 'E', desc: 'enemy' },
  { tool: 'path:move', group: 'move', icon: 'route', key: 'R', desc: 'route', label: 'routeLabel' },
  { tool: 'utility', group: 'utility', icon: 'diamond', key: 'U', desc: 'utility' },
  { tool: 'zone:hold', group: 'areas', icon: 'area', key: 'A', desc: 'area', label: 'areaLabel' },
  { tool: 'note', group: 'note', icon: 'note', key: 'N', desc: 'note' },
];
export const SIMPLE_KEY = Object.fromEntries(SIMPLE_TOOLS.map((x) => [x.key.toLowerCase(), x]));
// Tool groups whose tooltip also explains an R6 word.
export const GROUP_TERM = { crossfire: 'crossfire', breach: 'hardBreach', intel: 'drone' };

// Tools that have their own hint (board.hint.<tool>); others use the generic placing hint.
export const TOOL_HINT = ['select', 'path', 'zone', 'crossfire', 'note'];
