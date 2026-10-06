// Errors carry a message ID (and values), never English text: the screen
// translates them (see src/i18n). Database/RPC failures are mapped to IDs in
// api.js, so nothing server-side is shown untranslated except a technical
// detail line.
import { msg, t } from '../i18n/index.js';

/** An error that knows its message id: `new CodedError('strategy.titleRequired')`. */
export class CodedError extends Error {
  constructor(id, values = {}) {
    super(id);
    this.name = 'CodedError';
    this.id = id;
    this.values = values;
    // `.message` reads as the translated text, so catch blocks that show e.message follow the language.
    Object.defineProperty(this, 'message', { configurable: true, get: () => t(this.id, this.values) });
  }
}

/** Message descriptor for any thrown value; unknown errors show their technical detail. */
export function errorMsg(e, fallbackId = 'error.unknown') {
  if (e?.id) return msg(e.id, e.values);
  return msg(fallbackId, { detail: e?.message ?? '' });
}
