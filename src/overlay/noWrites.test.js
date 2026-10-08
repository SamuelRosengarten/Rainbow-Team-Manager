// Guards for the in-game overlay: it is a read-only viewer.
//  1. No overlay file calls .insert / .update / .upsert / .delete.
//  2. The team's tables are reached only through readApi.js (read functions only);
//     signing in goes through state/useAuth.js (sign-in calls only).
//  3. Nothing reachable from the overlay entry imports the strategy editor or builder.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as espree from 'espree';
import { describe, expect, it } from 'vitest';
import { walk } from '../../scripts/i18n-scan.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');

const READ_ONLY_API = ['fetchProfiles', 'fetchStrategies', 'fetchStrategyAssignments', 'isConfigured', 'subscribe'];
// What state/useAuth.js may call: signing in and out, and the membership check.
const AUTH_API = new Set(['claimMembership', 'fetchMyTeam', 'onAuthChange', 'resendConfirmation', 'sendPasswordReset', 'setTeam', 'signInWithPassword', 'signInWithSteam', 'signOut', 'signUp', 'updatePassword']);
const EDITOR = /(^|\/)(BoardEditor|TacticEditor|StrategyEditor|StrategyBuilder|ObjectInspector|ToolRail|SubTools|TacticPanel|StrategyForms)\.jsx$|\/builder\/|editorTools\.js$|useHistory\.js$|useBuilderMode\.js$/;

function filesIn(dir, test) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!['node_modules', 'dist', 'release'].includes(e.name)) out.push(...filesIn(p, test));
    } else if (test(e.name)) out.push(p);
  }
  return out;
}

/** Every overlay source file: the page (src/overlay) and the Electron shell (overlay/). */
const overlayFiles = () =>
  [...filesIn(path.join(ROOT, 'src/overlay'), (n) => /\.(jsx?|mjs|cjs)$/.test(n)), ...filesIn(path.join(ROOT, 'overlay'), (n) => /\.(jsx?|mjs|cjs)$/.test(n))].filter(
    (f) => !/\.test\.js$/.test(f),
  );

const parse = (file) => espree.parse(fs.readFileSync(file, 'utf8'), { ecmaVersion: 'latest', sourceType: file.endsWith('.cjs') ? 'script' : 'module', ecmaFeatures: { jsx: true }, loc: true });

/** Module specifiers a file imports or re-exports (static and dynamic). */
function importsOf(file) {
  const specs = [];
  walk(parse(file), (n) => {
    if ((n.type === 'ImportDeclaration' || n.type === 'ExportNamedDeclaration' || n.type === 'ExportAllDeclaration') && n.source) specs.push(n.source.value);
    if (n.type === 'ImportExpression' && n.source.type === 'Literal') specs.push(n.source.value);
  });
  return specs;
}

function resolveImport(from, spec) {
  if (!spec.startsWith('.')) return null; // packages
  const base = path.resolve(path.dirname(from), spec);
  return [base, `${base}.js`, `${base}.jsx`].find((p) => fs.existsSync(p) && fs.statSync(p).isFile()) ?? null;
}

/** Every source file reachable from the overlay entry. */
function overlayBundle() {
  const seen = new Set();
  const queue = [path.join(ROOT, 'src/overlay/main.jsx')];
  while (queue.length) {
    const f = queue.pop();
    if (seen.has(f) || !/\.jsx?$/.test(f)) continue;
    seen.add(f);
    for (const spec of importsOf(f)) {
      const next = resolveImport(f, spec);
      if (next) queue.push(next);
    }
  }
  return [...seen];
}

describe('overlay is read-only', () => {
  it('no overlay file calls .insert, .update, .upsert or .delete', () => {
    const hits = [];
    for (const f of overlayFiles()) {
      walk(parse(f), (n) => {
        if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && ['insert', 'update', 'upsert', 'delete'].includes(n.callee.property.name)) {
          hits.push(`${rel(f)}:${n.loc.start.line} .${n.callee.property.name}()`);
        }
      });
    }
    expect(hits).toEqual([]);
  });

  it('only readApi.js touches the database, and it exports read functions only', async () => {
    const direct = overlayFiles().filter((f) => !f.endsWith('readApi.js') && importsOf(f).some((s) => /lib\/api(\.js)?$/.test(s)));
    expect(direct.map(rel)).toEqual([]);
    const readApi = await import('./readApi.js');
    expect(Object.keys(readApi).sort()).toEqual(READ_ONLY_API);
  });

  it('in the whole overlay bundle, only readApi.js and the sign-in hook use the database', () => {
    const users = overlayBundle()
      .filter((f) => !f.endsWith(`${path.sep}lib${path.sep}api.js`) && importsOf(f).some((s) => /lib\/api(\.js)?$/.test(s)))
      .map(rel)
      .sort();
    expect(users).toEqual(['src/overlay/readApi.js', 'src/state/useAuth.js']);
    const calls = new Set();
    walk(parse(path.join(ROOT, 'src/state/useAuth.js')), (n) => {
      if (n.type === 'MemberExpression' && n.object.type === 'Identifier' && n.object.name === 'api') calls.add(n.property.name);
    });
    expect([...calls].filter((c) => !AUTH_API.has(c))).toEqual([]);
  });

  it('the overlay bundle never reaches the editor, builder or undo history', () => {
    const reached = overlayBundle().map(rel);
    expect(reached).toContain('src/components/TacticalBoard.jsx'); // the walk works
    expect(reached.filter((f) => EDITOR.test(f))).toEqual([]);
  });

  it('the board is drawn without any edit handlers', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/overlay/RoundView.jsx'), 'utf8');
    expect(src).toMatch(/<TacticalBoard/);
    expect(src).not.toMatch(/editing|onPointerDownBoard|onItemPointerDown|onItemClick|draft=/);
  });
});
