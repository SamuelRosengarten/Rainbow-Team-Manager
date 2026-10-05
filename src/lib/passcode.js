// Team passcode hashing. Must match the SQL in the README:
//   encode(sha256(convert_to('r6tp:' || 'your passcode', 'UTF8')), 'hex')
// This is a light gate, not security: the hash is readable by anyone with the
// anon key, and the database itself is open to the team by design.

export const PASSCODE_SALT = 'r6tp:';

export async function hashPasscode(passcode, subtle = globalThis.crypto?.subtle) {
  if (!subtle) throw new Error('This browser cannot hash the passcode (needs HTTPS or localhost).');
  const bytes = new TextEncoder().encode(PASSCODE_SALT + passcode.trim());
  const digest = await subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function checkPasscode(passcode, expectedHash, subtle) {
  if (!expectedHash) return false;
  return (await hashPasscode(passcode, subtle)) === expectedHash.trim().toLowerCase();
}
