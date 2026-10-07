import { HelpTip } from '../Glossary.jsx';
import { BREACH_TYPES, ZONES, gadgetsForSide, toolLabel, utilityName } from '../../lib/tactical.js';
import { TOOL_TERM } from '../../lib/glossary.js';
import { useI18n } from '../../i18n/index.js';

/** The active group's tools (and gadget / breach type, finishing a route). */
export default function SubTools({ draft, tool, toolKind, activeGroup, basic, path, setPath, finishPath, toolsOf, pickTool, gadget, setGadget, breachType, setBreachType, op }) {
  const { t } = useI18n();
  return (
    <div className="beditor__subtools" role="group" aria-label={t('board.toolsAria', { group: activeGroup.label })}>
      {!basic &&
        activeGroup.tools.length > 1 &&
        toolsOf(activeGroup).map((x) => (
          <span key={x} className="subtool-wrap">
            <button type="button" className="subtool" aria-pressed={tool === x} onClick={() => pickTool(x, activeGroup.id)}>
              <ToolSwatch tool={x} />
              {toolLabel(x)}
            </button>
            {TOOL_TERM[x] && <HelpTip term={TOOL_TERM[x]} />}
          </span>
        ))}
      {!basic && activeGroup.tools.length === 1 && TOOL_TERM[tool] && <HelpTip term={TOOL_TERM[tool]} />}
      {!basic && tool === 'utility' && (
        <label className="subtool-opt">
          <span>{t('boardEditor.gadget')}</span>
          <select className="select input--sm" value={gadget} onChange={(e) => setGadget(e.target.value)}>
            {gadgetsForSide(draft.side).map(([id, g]) => (
              <option key={id} value={id}>
                {id === 'ability' ? t('gadget.operatorSuffix', { name: utilityName('ability', op?.id) }) : g.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {!basic && tool === 'breach' && (
        <label className="subtool-opt">
          <span>{t('boardEditor.type')}</span>
          <select className="select input--sm" value={breachType} onChange={(e) => setBreachType(e.target.value)}>
            {Object.entries(BREACH_TYPES).map(([id, l]) => (
              <option key={id} value={id}>
                {l}
              </option>
            ))}
          </select>
        </label>
      )}
      {toolKind === 'path' && path.length > 0 && (
        <span className="subtool-opt">
          <button type="button" className="btn btn--primary btn--sm" onClick={() => finishPath()} disabled={path.length < 2}>
            {t('boardEditor.finishRoute')}
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPath((p) => p.slice(0, -1))}>
            {t('boardEditor.undoPoint')}
          </button>
        </span>
      )}
    </div>
  );
}

/** Tiny preview of what a tool draws, for the sub-toolbar. */
function ToolSwatch({ tool }) {
  const [kind, arg] = tool.split(':');
  let inner;
  if (kind === 'zone') inner = <rect x="2" y="4" width="16" height="12" rx="2" fill={ZONES[arg].color} fillOpacity="0.3" stroke={ZONES[arg].color} strokeDasharray="3 2" />;
  else if (kind === 'path') inner = <path d="M2 15 Q8 3 18 6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray={arg === 'move' || arg === 'entry' ? undefined : arg === 'rotate' ? '1 3' : '4 2'} />;
  else if (kind === 'crossfire') inner = <path d="M3 4 L14 10 M3 16 L14 10" stroke="currentColor" strokeWidth="2" fill="none" />;
  else {
    const fill = { enemy: '#ff4757', breach: '#ff7a1a', plant: '#f5a623', objective: '#e8463b', reinforce: '#7d8ba1' }[tool] ?? 'currentColor';
    inner =
      tool === 'utility' ? <rect x="6" y="6" width="8" height="8" transform="rotate(45 10 10)" fill={fill} /> : tool === 'trap' ? <polygon points="10,3 17,16 3,16" fill="none" stroke={fill} strokeWidth="2" /> : <circle cx="10" cy="10" r={tool === 'waypoint' ? 3 : 6} fill={fill} />;
  }
  return (
    <svg className="subtool__swatch" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      {inner}
    </svg>
  );
}
