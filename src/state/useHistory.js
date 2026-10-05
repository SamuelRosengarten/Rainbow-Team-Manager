import { useCallback, useReducer } from 'react';

const LIMIT = 80;

function reducer(state, action) {
  switch (action.type) {
    case 'set': {
      const patch = typeof action.patch === 'function' ? action.patch(state.present) : action.patch;
      const present = { ...state.present, ...patch };
      // Typing in one field (same key) is one undo step, not one per letter.
      const skip = action.record === false || (action.key && action.key === state.lastKey);
      return {
        past: skip ? state.past : [...state.past, state.present].slice(-LIMIT),
        present,
        future: skip && action.record === false ? state.future : [],
        lastKey: action.key ?? null,
      };
    }
    case 'checkpoint':
      return { ...state, past: [...state.past, state.present].slice(-LIMIT), future: [], lastKey: null };
    case 'undo':
      if (!state.past.length) return state;
      return { past: state.past.slice(0, -1), present: state.past[state.past.length - 1], future: [state.present, ...state.future], lastKey: null };
    case 'redo':
      if (!state.future.length) return state;
      return { past: [...state.past, state.present], present: state.future[0], future: state.future.slice(1), lastKey: null };
    default:
      return state;
  }
}

/**
 * A document with undo/redo. `set(patch, { record, key })` merges a patch
 * (object or function of the current value). `record: false` changes without
 * adding an undo step (dragging after `checkpoint()`); `key` groups edits.
 */
export function useHistory(initial) {
  const [state, dispatch] = useReducer(reducer, null, () => ({ past: [], present: initial, future: [], lastKey: null }));
  const set = useCallback((patch, opts = {}) => dispatch({ type: 'set', patch, ...opts }), []);
  const checkpoint = useCallback(() => dispatch({ type: 'checkpoint' }), []);
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'redo' }), []);
  return {
    value: state.present,
    set,
    checkpoint,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
