import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { checkPasscode, hashPasscode } from './passcode.js';

describe('passcode hashing', () => {
  it('matches the SQL formula sha256("r6tp:" || passcode) in hex', async () => {
    const expected = createHash('sha256').update('r6tp:hunter2', 'utf8').digest('hex');
    expect(await hashPasscode('hunter2')).toBe(expected);
  });

  it('checks a passcode against a stored hash, ignoring surrounding spaces', async () => {
    const stored = createHash('sha256').update('r6tp:open sesame', 'utf8').digest('hex');
    expect(await checkPasscode(' open sesame ', stored)).toBe(true);
    expect(await checkPasscode('wrong', stored)).toBe(false);
    expect(await checkPasscode('anything', null)).toBe(false);
  });
});
