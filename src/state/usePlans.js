import { useSyncExternalStore } from 'react';
import { plansRevision, subscribePlans } from '../lib/floorPlans.js';

/** Re-render when a floor plan is tried out or calibrated in this session. */
export function usePlans() {
  return useSyncExternalStore(subscribePlans, plansRevision, plansRevision);
}
