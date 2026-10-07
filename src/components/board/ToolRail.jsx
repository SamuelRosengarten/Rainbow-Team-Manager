import Icon from '../Icon.jsx';
import { TOOL_GROUPS, toolLabel } from '../../lib/tactical.js';
import { useI18n } from '../../i18n/index.js';
import { GROUP_ICON, INTENTS, INTENT_OF, SHORTCUT, SIMPLE_TOOLS, GROUP_TERM } from '../../lib/editorTools.js';

/** The toolbar, grouped by intent: Simple mode's six tools or every tool group, then undo/redo. */
export default function ToolRail({ tool, group, basic, simple, moreTools, setMoreTools, pickTool, pickGroup, doUndo, doRedo, canUndo, canRedo }) {
  const { t } = useI18n();
  return (
    <div className="beditor__rail" role="toolbar" aria-label={t('boardEditor.boardTools')} aria-orientation="vertical">
      <RailButton id="select" icon="cursor" label={t('boardEditor.select')} intent={t('planner.intent.select')} desc={t('planner.tool.select')} shortcut="V" pressed={tool === 'select'} onClick={() => pickTool('select')} />
      {basic && (
        <div className="rail-group" role="group" aria-label={t('boardEditor.boardTools')}>
          {SIMPLE_TOOLS.map((x) => (
            <RailButton
              key={x.tool}
              id={`simple-${x.desc}`}
              icon={x.icon}
              label={x.label ? t(`planner.simpleTool.${x.label}`) : toolLabel(x.tool)}
              intent={t(`planner.intent.${INTENT_OF[x.group]}`)}
              desc={t(`planner.simpleTool.${x.desc}`)}
              shortcut={x.key}
              pressed={tool === x.tool}
              onClick={() => pickTool(x.tool, x.group)}
            />
          ))}
        </div>
      )}
      {!basic && INTENTS.map(([intent, groups]) => (
        <div key={intent} className="rail-group" role="group" aria-label={t(`planner.intent.${intent}`)}>
          {groups.map((id) => {
            const g = TOOL_GROUPS.find((x) => x.id === id);
            return (
              <RailButton
                key={id}
                id={id}
                icon={GROUP_ICON[id]}
                label={g.label}
                intent={t(`planner.intent.${INTENT_OF[id]}`)}
                desc={GROUP_TERM[id] ? `${t(`planner.tool.${id}`)} ${t(`glossary.${GROUP_TERM[id]}.text`)}` : t(`planner.tool.${id}`)}
                shortcut={SHORTCUT[id]}
                pressed={group === id && tool !== 'select'}
                onClick={() => pickGroup(id)}
              />
            );
          })}
        </div>
      ))}
      {simple && (
        <div className="rail-group" role="group" aria-label={t(moreTools ? 'planner.simple.fewer' : 'planner.simple.more')}>
          <RailButton
            id="more"
            icon={moreTools ? 'minus' : 'more'}
            label={t(moreTools ? 'planner.simple.fewer' : 'planner.simple.more')}
            intent={t('builder.mode.simple')}
            desc={t(moreTools ? 'planner.simple.fewerDesc' : 'planner.simple.moreDesc')}
            onClick={() => {
              if (moreTools && !SIMPLE_TOOLS.some((x) => x.tool === tool)) pickTool('position', 'units');
              setMoreTools((m) => !m);
            }}
          />
        </div>
      )}
      <div className="rail-group" role="group" aria-label={t('planner.intent.history')}>
        <RailButton id="undo" icon="undo" label={t('boardEditor.undo')} intent={t('planner.intent.history')} desc={t('planner.tool.undo')} shortcut="Ctrl+Z" onClick={doUndo} disabled={!canUndo} />
        <RailButton id="redo" icon="redo" label={t('boardEditor.redo')} intent={t('planner.intent.history')} desc={t('planner.tool.redo')} shortcut="Ctrl+Shift+Z" onClick={doRedo} disabled={!canRedo} />
      </div>
    </div>
  );
}

/** A toolbar button with a tooltip: name, shortcut and one line on what it does. */
function RailButton({ id, icon, label, intent, desc, shortcut, pressed, onClick, disabled }) {
  const { t } = useI18n();
  const tipId = `rail-tip-${id}`;
  return (
    <div className="rail-item">
      <button
        type="button"
        className="rail-btn"
        aria-pressed={pressed === undefined ? undefined : pressed}
        aria-describedby={tipId}
        aria-keyshortcuts={shortcut ? shortcut.replace('Ctrl', 'Control') : undefined}
        onClick={onClick}
        disabled={disabled}
      >
        <Icon name={icon} size={20} />
        <span className="rail-btn__label">{label}</span>
      </button>
      <span className="rail-tip" role="tooltip" id={tipId}>
        <span className="rail-tip__intent">{intent}</span>
        <span className="rail-tip__head">
          <strong>{label}</strong>
          {shortcut && <kbd>{shortcut}</kbd>}
        </span>
        <span className="rail-tip__desc">{desc}</span>
        {shortcut && <span className="visually-hidden">{t('planner.shortcut', { key: shortcut })}</span>}
      </span>
    </div>
  );
}
