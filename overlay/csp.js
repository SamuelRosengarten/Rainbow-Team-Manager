// The overlay page's connect-src: only the team's Supabase project (REST,
// Edge Functions and Realtime). Built into the page as a <meta> policy by
// overlay/vite.config.js; main.js's header policy stays broader, and the
// browser enforces both, so this one decides.

/** "https://abc.supabase.co" -> "connect-src 'self' https://abc.supabase.co wss://abc.supabase.co" */
export function overlayConnectSrc(supabaseUrl) {
  let origin = '';
  try {
    const u = new URL(String(supabaseUrl ?? '').trim());
    if (u.protocol === 'https:') origin = u.origin;
  } catch {
    // no or bad URL: offline overlay, nothing to connect to
  }
  return ["connect-src 'self'", origin, origin && origin.replace(/^https:/, 'wss:')].filter(Boolean).join(' ');
}
