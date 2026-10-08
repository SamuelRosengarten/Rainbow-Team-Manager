import { describe, expect, it } from 'vitest';
import { overlayConnectSrc } from './csp.js';

describe('overlay connect-src', () => {
  it('allows only the Supabase project, over https and wss', () => {
    expect(overlayConnectSrc('https://abc.supabase.co')).toBe("connect-src 'self' https://abc.supabase.co wss://abc.supabase.co");
    expect(overlayConnectSrc('https://db.team.example/rest/v1')).toBe("connect-src 'self' https://db.team.example wss://db.team.example");
  });

  it('allows nothing else without a (secure) project URL', () => {
    for (const url of ['', undefined, 'not a url', 'http://abc.supabase.co']) expect(overlayConnectSrc(url)).toBe("connect-src 'self'");
  });
});
