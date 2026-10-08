import { useLayoutEffect, useRef, useState } from 'react';
import { executeTimeline, timelineLanes } from '../lib/tactical.js';
import { useI18n } from '../i18n/index.js';

const LABEL_PX = 96; // .timeline__pt width plus a little air
const LIST_BELOW_PX = 520; // narrower (phones): a wrapping list of clocks, titles in full

/**
 * The round clock as a track: each step with a clock sits where it happens
 * (counting down, left to right). Click a step to show it on the board.
 * Labels that would overlap (close clocks) drop to a second row; on a narrow
 * screen the steps become a wrapping list instead, so no title is cut short.
 */
export default function ExecuteTimeline({ strategy, stepId, onSelect }) {
  const { t } = useI18n();
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  const points = executeTimeline(strategy);
  const shown = points.length >= 2;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [shown]);

  if (!shown) return null;
  if (width && width < LIST_BELOW_PX) {
    return (
      <div ref={ref} className="timeline timeline--list" role="group" aria-label={t('executeTimeline.executeTimeline')}>
        {points.map(({ step, index }) => (
          <button
            key={step.id}
            type="button"
            className="timeline__chip"
            aria-pressed={stepId === step.id}
            onClick={() => onSelect?.(stepId === step.id ? null : step.id)}
            title={t('timeline.step', { n: index + 1, title: step.title })}
          >
            <span className="timeline__clock">{step.clock}</span>
            <span className="timeline__chip-title">{step.title}</span>
          </button>
        ))}
      </div>
    );
  }
  const hi = Math.max(...points.map((p) => p.seconds));
  const lo = Math.min(...points.map((p) => p.seconds));
  const span = Math.max(1, hi - lo);
  const lefts = points.map(({ seconds }) => 4 + ((hi - seconds) / span) * 92);
  const lanes = width ? timelineLanes(lefts, (LABEL_PX / width) * 100) : lefts.map(() => 0);
  const twoRows = lanes.includes(1);
  return (
    <div ref={ref} className={`timeline${twoRows ? ' timeline--two-rows' : ''}`} role="group" aria-label={t('executeTimeline.executeTimeline')}>
      <div className="timeline__track" aria-hidden="true" />
      {points.map(({ step, index }, i) => (
        <button
          key={step.id}
          type="button"
          className={`timeline__pt${lanes[i] ? ' timeline__pt--low' : ''}`}
          style={{ left: `${lefts[i]}%` }}
          aria-pressed={stepId === step.id}
          onClick={() => onSelect?.(stepId === step.id ? null : step.id)}
          title={t('timeline.step', { n: index + 1, title: step.title })}
        >
          <span className="timeline__clock">{step.clock}</span>
          <span className="timeline__dot" />
          <span className="timeline__title">{step.title}</span>
        </button>
      ))}
    </div>
  );
}
