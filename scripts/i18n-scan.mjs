// Finds user-facing text that is not going through t(): JSX text, user-facing
// attributes (aria-label, title, placeholder, alt) and string literals shown
// from inside JSX. Used by the i18n test (src/i18n/i18n.test.js) and by hand:
//   node scripts/i18n-scan.mjs [files...]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as espree from 'espree';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const USER_ATTRS = new Set(['aria-label', 'aria-description', 'aria-roledescription', 'aria-valuetext', 'title', 'placeholder', 'alt']);
const hasWords = (s) => /\p{L}{2,}/u.test(s.replace(/\{\{.*?\}\}/g, ''));

/** Text that is allowed untranslated: symbols, units, product names. */
const ALLOWED = new Set(['K/D', 'HS%', 'RP', 'PC', 'Xbox', 'PlayStation', 'R6', 'Siege', 'Supabase', 'Ubisoft', 'IGL', 'EN', 'FR', 'OK', 'WASD']);

export function walk(node, visit, parent = null) {
  if (!node || typeof node.type !== 'string') return;
  visit(node, parent);
  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range' || key.startsWith('__')) continue;
    const v = node[key];
    if (Array.isArray(v)) v.forEach((c) => c && typeof c.type === 'string' && walk(c, visit, node));
    else if (v && typeof v.type === 'string') walk(v, visit, node);
  }
}

const isTCall = (n) => n?.type === 'CallExpression' && ((n.callee.type === 'Identifier' && ['t', 'tm', 'tx'].includes(n.callee.name)) || (n.callee.type === 'MemberExpression' && ['t', 'tm'].includes(n.callee.property?.name)));

/** @returns {{ file, line, kind, text }[]} */
export function scanSource(src, file = '') {
  const ast = espree.parse(src, { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true }, loc: true });
  const found = [];
  const add = (node, kind, text) => {
    const t = text.replace(/\s+/g, ' ').trim();
    if (!hasWords(t) || ALLOWED.has(t)) return;
    found.push({ file, line: node.loc.start.line, kind, text: t.slice(0, 80) });
  };
  // Strings inside {expressions} that are children of JSX (not attributes, not t() arguments).
  const inChildExpression = (node, parents) => parents.some((p) => p.type === 'JSXExpressionContainer' && p.__child);
  const stack = [];
  const visit = (node, parent) => {
    node.__parent = parent;
    if (node.type === 'JSXText') add(node, 'text', node.value);
    if (node.type === 'JSXAttribute' && USER_ATTRS.has(node.name.name) && node.value) {
      if (node.value.type === 'Literal') add(node, `attr ${node.name.name}`, String(node.value.value));
      else if (node.value.type === 'JSXExpressionContainer') {
        const e = node.value.expression;
        if (e.type === 'Literal' && typeof e.value === 'string') add(node, `attr ${node.name.name}`, e.value);
        if (e.type === 'TemplateLiteral') add(node, `attr ${node.name.name} (template)`, e.quasis.map((q) => q.value.cooked).join('…'));
      }
    }
    if ((node.type === 'Literal' && typeof node.value === 'string') || node.type === 'TemplateLiteral') {
      // walk up: is this inside a JSX child expression, with nothing but conditional/logical/template wrappers in between?
      let p = parent;
      let cur = node;
      let ok = true;
      while (p && !['JSXExpressionContainer', 'JSXAttribute', 'Program'].includes(p.type)) {
        if (!['ConditionalExpression', 'LogicalExpression', 'TemplateLiteral', 'BinaryExpression', 'ArrayExpression'].includes(p.type)) {
          ok = false;
          break;
        }
        if (p.type === 'ConditionalExpression' && p.test === cur) ok = false;
        if (p.type === 'LogicalExpression' && p.left === cur) ok = false;
        cur = p;
        p = p.__parent;
      }
      if (ok && p?.type === 'JSXExpressionContainer' && p.__parent && ['JSXElement', 'JSXFragment'].includes(p.__parent.type)) {
        if (node.type === 'Literal') add(node, 'expression', node.value);
        else if (!(parent?.type === 'TaggedTemplateExpression')) add(node, 'expression (template)', node.quasis.map((q) => q.value.cooked).join('…'));
      }
    }
    stack.push(node);
  };
  walk(ast, visit);
  return found.filter((f) => !isTCallLine(f));
}
const isTCallLine = () => false;

export function projectFiles() {
  const out = [];
  const dir = (d) => {
    for (const name of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, name.name);
      if (name.isDirectory()) dir(p);
      else if (/\.jsx$/.test(name.name) && !/\.test\./.test(name.name)) out.push(p);
    }
  };
  dir(path.join(ROOT, 'src'));
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const files = args.length ? args : projectFiles();
  let total = 0;
  for (const f of files) {
    const hits = scanSource(fs.readFileSync(f, 'utf8'), path.relative(ROOT, f));
    total += hits.length;
    if (process.argv.includes('--count')) console.log(String(hits.length).padStart(4), path.relative(ROOT, f));
    else for (const h of hits) console.log(`${h.file}:${h.line}  [${h.kind}] ${h.text}`);
  }
  console.log(`\n${total} untranslated user-facing strings`);
  process.exitCode = total ? 1 : 0;
}
