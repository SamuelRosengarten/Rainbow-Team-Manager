import { describe, it, expect } from 'vitest';
import { combineLive, liveFromChannels } from './live.js';

describe('live indicator', () => {
  it('is live only when every expected channel is subscribed', () => {
    expect(liveFromChannels(['live', 'live'], 3)).toBe('connecting');
    expect(liveFromChannels(['live', 'live', 'live'], 3)).toBe('live');
  });
  it('shows reconnecting as soon as any channel drops', () => {
    expect(liveFromChannels(['live', 'reconnecting', 'live'], 3)).toBe('reconnecting');
  });
  it('combines team and strategy channels, ignoring idle strategies', () => {
    expect(combineLive('live', 'idle')).toBe('live');
    expect(combineLive('live', 'live')).toBe('live');
    expect(combineLive('live', 'connecting')).toBe('connecting');
    expect(combineLive('live', 'reconnecting')).toBe('reconnecting');
    expect(combineLive('connecting', 'idle')).toBe('connecting');
  });
});
