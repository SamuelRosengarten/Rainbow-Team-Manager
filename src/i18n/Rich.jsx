import { useI18n } from './index.js';

// Messages may use a few inline tags (<b>, <strong>, <em>, <code>). They are
// turned into React elements here: no HTML is ever injected.
const TAG = /<(b|strong|em|code)>(.*?)<\/\1>/g;

/** Split a translated string into text and tag elements. */
function rich(text) {
  const out = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(TAG)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const Tag = m[1];
    out.push(<Tag key={key++}>{m[2]}</Tag>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** <T id="ui.dbUpdate.body" values={{ n: 3 }} /> renders a message that may contain <code>…</code> tags. */
export function T({ id, values }) {
  const { t } = useI18n();
  return <>{rich(t(id, values))}</>;
}
