// The strategy builder's steps in its two modes. Pure functions, no React.
//
// Advanced is the full ten-step flow (step numbers 1–10, names builder.step.<id>).
// Simple shows six steps to a beginner and skips the rest, keeping their
// defaults: players move to Save (optional), Customize becomes the plan name
// on Save, Start from opens "Draw the plan", and phases get defaults.
// Internally both modes use the same step numbers, so a plan started in one
// mode continues in the other.

export const STEPS = ['map', 'site', 'side', 'operators', 'players', 'startFrom', 'customize', 'tactics', 'steps', 'save'];
export const MODES = ['simple', 'advanced'];

// Simple-mode items and the internal steps each one covers.
const SIMPLE = [
  { id: 'map', steps: [1] },
  { id: 'site', steps: [2] },
  { id: 'side', steps: [3] },
  { id: 'operators', steps: [4, 5] },
  { id: 'draw', steps: [6, 7, 8, 9] },
  { id: 'save', steps: [10] },
];

/** The step a mode actually shows for an internal step (simple skips 5, 7 and 9). */
export function normalizeStep(mode, step, hasDraft) {
  if (mode !== 'simple') return step;
  if (step === 5) return 4;
  if (step === 7 || step === 9) return hasDraft ? 8 : 6;
  if (step === 8 && !hasDraft) return 6;
  return step;
}

/** Name id of the step being shown (builder.step.<id>, builder.desc.<id>). */
export function stepId(mode, step) {
  if (mode === 'simple') return SIMPLE.find((s) => s.steps.includes(step))?.id ?? STEPS[step - 1];
  return STEPS[step - 1];
}

export function nextStep(mode, step) {
  if (mode !== 'simple') return Math.min(10, step + 1);
  return { 4: 6, 5: 6, 6: 8, 7: 8, 8: 10, 9: 10 }[step] ?? Math.min(10, step + 1);
}

export function prevStep(mode, step) {
  if (mode !== 'simple') return Math.max(1, step - 1);
  return { 10: 8, 9: 8, 8: 6, 7: 6, 6: 4, 5: 4 }[step] ?? Math.max(1, step - 1);
}

/**
 * Stepper items: { id, target, current, done, can }. `target` is the
 * internal step a click goes to; `can` is false until the step is reached
 * (and, past Start from, until there is a draft).
 */
export function stepperItems(mode, step, reached, hasDraft) {
  const items = mode === 'simple' ? SIMPLE : STEPS.map((id, i) => ({ id, steps: [i + 1] }));
  return items.map(({ id, steps }) => {
    const first = steps[0];
    const target = id === 'draw' ? (hasDraft ? 8 : 6) : first;
    return {
      id,
      target,
      current: steps.includes(step),
      done: steps[steps.length - 1] < step,
      can: first <= reached && (first <= 6 || hasDraft),
    };
  });
}

/** Default phase title ids for a blank plan in Simple mode (builder.phase.<id>). */
export const defaultPhases = (side) => ['prep', side === 'attack' ? 'goIn' : 'hold', 'afterPlant'];

/** Library plans for a beginner: easiest first, keeping the ranking within a difficulty. */
export function easiestFirst(items) {
  return items.map((x, i) => [x, i]).sort((a, b) => (a[0].strategy.difficulty ?? 2) - (b[0].strategy.difficulty ?? 2) || a[1] - b[1]).map(([x]) => x);
}
