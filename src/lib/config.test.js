import { describe, it, expect } from 'vitest';
import { parseRequirePasscode } from './config.js';

describe('parseRequirePasscode', () => {
  it('honours explicit values', () => {
    expect(parseRequirePasscode('true', false)).toBe(true);
    expect(parseRequirePasscode('FALSE', true)).toBe(false);
    expect(parseRequirePasscode('1', false)).toBe(true);
  });

  it('defaults to on in production and off in dev', () => {
    expect(parseRequirePasscode(undefined, true)).toBe(true);
    expect(parseRequirePasscode('', false)).toBe(false);
  });
});
