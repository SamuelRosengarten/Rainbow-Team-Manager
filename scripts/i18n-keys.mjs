// Which message keys the source code refers to. Used by the i18n test and by hand:
//   node scripts/i18n-keys.mjs
// A reference is any string literal that looks like a key (ns.name…) or a template
// literal with a static key prefix (`role.${id}` -> prefix "role."). labelTable('role', …) and
// labelled(defs, { label: 'object' }) are prefixes too. The test then checks that every
// reference exists in the dictionaries and that no dictionary key is unused.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as espree from 'espree';
import { walk } from './i18n-scan.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEYISH = /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9_-]+)+$/;

function sourceFiles() {
  const out = [];
  const dir = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name === 'messages') continue; // the dictionaries themselves
        dir(p);
      } else if (/\.(jsx?|mjs)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
    }
  };
  dir(path.join(ROOT, 'src'));
  return out;
}

/** @returns {{ literals: Map<string,string[]>, prefixes: Map<string,string[]> }} reference -> locations */
export function keyReferences() {
  const literals = new Map();
  const prefixes = new Map();
  const add = (map, k, loc) => map.set(k, [...(map.get(k) ?? []), loc]);
  for (const f of sourceFiles()) {
    const src = fs.readFileSync(f, 'utf8');
    const ast = espree.parse(src, { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true }, loc: true });
    const rel = path.relative(ROOT, f);
    const skip = new Set(); // literals that are prefixes handed to labelTable / labelled
    walk(ast, (n) => {
      if (n.type !== 'CallExpression' || n.callee.type !== 'Identifier') return;
      if (n.callee.name === 'labelTable' && n.arguments[0]?.type === 'Literal') {
        skip.add(n.arguments[0]);
        add(prefixes, `${n.arguments[0].value}.`, `${rel}:${n.loc.start.line}`);
      }
      if (n.callee.name === 'labelled' && n.arguments[1]?.type === 'ObjectExpression') {
        for (const p of n.arguments[1].properties) {
          if (p.value?.type === 'Literal') {
            skip.add(p.value);
            add(prefixes, `${p.value.value}.`, `${rel}:${n.loc.start.line}`);
          }
        }
      }
    });
    walk(ast, (n) => {
      const loc = `${rel}:${n.loc.start.line}`;
      if (n.type === 'Literal' && typeof n.value === 'string' && KEYISH.test(n.value) && !skip.has(n)) add(literals, n.value, loc);
      if (n.type === 'TemplateLiteral' && n.quasis.length > 1) {
        // a static prefix that ends right before an interpolation, e.g. "role." or "lineup.job."
        const first = n.quasis[0].value.cooked;
        if (/^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9_-]+)*\.?[A-Za-z0-9_-]*$/.test(first) && first.includes('.')) add(prefixes, first, loc);
      }
    });
  }
  return { literals, prefixes };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { literals, prefixes } = keyReferences();
  console.log(`${literals.size} literal key references, ${prefixes.size} dynamic prefixes`);
}
