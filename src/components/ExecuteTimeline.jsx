import { executeTimeline } from '../lib/tactical.js';

/**
 * The round clock as a track: each step with a clock sits where it happens
 * (counting down, left to right). Click a step to show it on the board.
 */
export default function ExecuteTimeline({ strategy, stepId, onSelect }) {
  const points = executeTimeline(strategy);
  if (points.length < 2) return null;
  const hi = Math.max(...points.map((p) => p.seconds));
  const lo = Math.min(...points.map((p) => p.seconds));
  const span = Math.max(1, hi - lo);
  return (
    <div className="timeline" role="group" aria-label="Execute timeline">
      <div className="timeline__track" aria-hidden="true" />
      {points.map(({ step, index, seconds }) => {
        const left = 4 + ((hi - seconds) / span) * 92;
        return (
          <button
            key={step.id}
            type="button"
            className="timeline__pt"
            style={{ left: `${left}%` }}
            aria-pressed={stepId === step.id}
            onClick={() => onSelect?.(stepId === step.id ? null : step.id)}
            title={`Step ${index + 1}: ${step.title}`}
          >
            <span className="timeline__clock">{step.clock}</span>
            <span className="timeline__dot" />
            <span className="timeline__title">{step.title}</span>
          </button>
        );
      })}
    </div>
  );
}
