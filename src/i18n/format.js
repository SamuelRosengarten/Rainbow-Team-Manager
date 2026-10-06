// A small ICU-style message formatter (no dependency). Pure functions.
//
//   "Hello {name}"                              placeholder
//   "{n, number}"  "{p, percent}"               Intl.NumberFormat
//   "{names, list}"  "{names, list-or}"         Intl.ListFormat (and / or)
//   "{when, date}"  "{when, time}"              Intl.DateTimeFormat
//   "{n, plural, =0 {none} one {# player} other {# players}}"   Intl.PluralRules; # is the number
//   "{kind, select, attack {Attack} other {Defense}}"
//
// Messages are whole templates with placeholders, never sentences glued
// together, so each language controls its own word order, gender and plurals.
// An apostrophe is just an apostrophe (French needs them). Use \{ and \} for
// literal braces (written \{ and \}).

/** Parse a template into text and argument nodes. Cached by the caller. */
export function parse(src) {
  let i = 0;
  const parseNodes = (stop) => {
    const nodes = [];
    let text = '';
    const flush = () => {
      if (text) nodes.push({ text });
      text = '';
    };
    while (i < src.length) {
      const c = src[i];
      if (c === '\\' && (src[i + 1] === '{' || src[i + 1] === '}')) {
        text += src[i + 1];
        i += 2;
      } else if (c === '{') {
        flush();
        i += 1;
        nodes.push(parseArg());
      } else if (c === '}' && stop) {
        break;
      } else if (c === '#' && stop === 'plural') {
        flush();
        nodes.push({ hash: true });
        i += 1;
      } else {
        text += c;
        i += 1;
      }
    }
    flush();
    return nodes;
  };
  const readUntil = (chars) => {
    let s = '';
    while (i < src.length && !chars.includes(src[i])) {
      s += src[i];
      i += 1;
    }
    return s;
  };
  const parseArg = () => {
    const name = readUntil(',}').trim();
    if (src[i] === '}') {
      i += 1;
      return { arg: name };
    }
    i += 1; // ,
    const type = readUntil(',}').trim();
    if (src[i] === '}') {
      i += 1;
      return { arg: name, type };
    }
    i += 1; // ,
    if (type !== 'plural' && type !== 'select') throw new Error(`Unknown format "${type}" in: ${src}`);
    const cases = {};
    while (i < src.length && src[i] !== '}') {
      while (src[i] === ' ') i += 1;
      if (src[i] === '}') break;
      const key = readUntil('{ ').trim();
      while (src[i] === ' ') i += 1;
      if (src[i] !== '{') throw new Error(`Expected { after "${key}" in: ${src}`);
      i += 1;
      cases[key] = parseNodes(type);
      i += 1; // }
    }
    i += 1; // closing }
    if (!cases.other) throw new Error(`Missing "other" case in: ${src}`);
    return { arg: name, type, cases };
  };
  const nodes = parseNodes(null);
  if (i < src.length) throw new Error(`Unbalanced braces in: ${src}`);
  return nodes;
}

/** Argument names a template uses (for the en/fr parity check). */
export function argNames(src) {
  const out = new Set();
  const walk = (nodes) => {
    for (const n of nodes) {
      if (n.arg) out.add(n.arg);
      if (n.cases) Object.values(n.cases).forEach(walk);
    }
  };
  walk(parse(src));
  return [...out].sort();
}

/**
 * Render a parsed template.
 * @param tools { locale, literal(text) }  `literal` post-processes literal text (pseudo-locale)
 */
export function render(nodes, values, tools, count = null) {
  const { locale } = tools;
  const lit = tools.literal ?? ((s) => s);
  let out = '';
  for (const n of nodes) {
    if ('text' in n) out += lit(n.text);
    else if (n.hash) out += new Intl.NumberFormat(locale).format(count);
    else {
      const v = values?.[n.arg];
      if (n.type === 'plural') {
        const num = Number(v);
        const exact = n.cases[`=${num}`];
        const branch = exact ?? n.cases[new Intl.PluralRules(locale).select(num)] ?? n.cases.other;
        out += render(branch, values, tools, num);
      } else if (n.type === 'select') {
        out += render(n.cases[String(v)] ?? n.cases.other, values, tools, count);
      } else if (n.type === 'list' || n.type === 'list-or') {
        const items = Array.isArray(v) ? v.map(String) : [];
        out += new Intl.ListFormat(locale, { style: 'long', type: n.type === 'list' ? 'conjunction' : 'disjunction' }).format(items);
      } else if (n.type === 'number') out += new Intl.NumberFormat(locale).format(Number(v));
      else if (n.type === 'percent') out += new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(Number(v));
      else if (n.type === 'date') out += new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(v));
      else if (n.type === 'time') out += new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v));
      else if (v === undefined || v === null) out += '';
      else out += typeof v === 'number' ? new Intl.NumberFormat(locale).format(v) : String(v);
    }
  }
  return out;
}

const PSEUDO = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú', y: 'ý', A: 'Á', E: 'É', I: 'Í', O: 'Ó', U: 'Ú', c: 'ç', n: 'ñ', s: 'š', S: 'Š' };

/** Pseudo-locale for literal text: accented letters, ~30% longer, so layout and leaks show up. */
export function pseudoLiteral(text) {
  const accented = text.replace(/[A-Za-z]/g, (ch) => PSEUDO[ch] ?? ch);
  const pad = text.trim().length > 3 ? '~'.repeat(Math.ceil(text.length * 0.3)) : '';
  return accented + pad;
}
