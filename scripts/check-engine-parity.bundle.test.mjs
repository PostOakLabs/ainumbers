#!/usr/bin/env node
/**
 * scripts/check-engine-parity.bundle.test.mjs — ENGINE-BUNDLE-ESM-LINT-1 selftest.
 *
 * Pins the ESM stripping done by check-engine-parity.mjs --bundle so a PR kernel
 * can never reach QuickJS with a raw top-level `export` (measured 2026-10-12:
 * CI runs 38264357350, 38264539837, 38270564551 all died with
 * "SyntaxError: unsupported keyword: export" AFTER the QuickJS download).
 *
 * RED half: the unstrippable forms (export { a as b } rename, an export list
 * naming an undeclared name, export * from) must make the bundler exit 1 with
 * the ENGINE-BUNDLE-ESM-LINT-1 error BEFORE emitting anything.
 * GREEN half: the strippable forms (default, class, generator, async generator,
 * multi-line import, and since ENGINE-BUNDLE-EXPORT-LIST-REWRITE-1 a plain
 * top-level export list of names declared at top level in the same file) must
 * yield a bundle with no top-level export|import.
 *
 * Run: node scripts/check-engine-parity.bundle.test.mjs
 * (registered in scripts/preflight.mjs next to the node parity leg)
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNNER = resolve(HERE, 'check-engine-parity.mjs');

// A fixture kernel exercising every strippable form ahead of buildArtifact.
// Bundle mode reads kernel source as TEXT (no real import happens), so the
// temp tree needs no _hash.mjs.
const GOOD_KERNEL = [
  "import { executionHash } from './_hash.mjs';",
  'import {',
  '  existsSync as _unused,',
  "} from 'node:fs';",                          // multi-line import block: must be stripped
  "import 'side-effect-only.mjs';",             // bare side-effect import: must be stripped
  'export const meta = { id: "bundle-esm-lint" };',
  'export default function fallback() { return 1; }',   // export default
  'export class Helper { tag() { return "h"; } }',      // export class
  'export function* seq(n) { for (let i = 0; i < n; i++) yield i; }',  // generator
  'export async function* aseq(n) { for (let i = 0; i < n; i++) yield i; }',  // async generator
  'export let counter = 0;',
  'export function compute(pp) {',
  '  counter += 1;',
  '  return { output_payload: { ok: counter, meta: meta.id, t: [...seq(2)] } };',
  '}',
  'export async function buildArtifact(pp) { return compute(pp); }',
  '',
].join('\n');

const FIXTURE = JSON.stringify({
  tool_id: 'bundle-esm-lint',
  note: 'ENGINE-BUNDLE-ESM-LINT-1 selftest fixture',
  vectors: [{ name: 'basic', policy_parameters: {} }],
});

function makeTree(kernelText = GOOD_KERNEL) {
  const root = mkdtempSync(resolve(tmpdir(), 'bundle-esm-lint-'));
  mkdirSync(resolve(root, 'fixtures'), { recursive: true });
  writeFileSync(resolve(root, 'fixtures', 'bundle-esm-lint.fixtures.json'), FIXTURE);
  if (kernelText !== null) {
    writeFileSync(resolve(root, 'bundle-esm-lint.kernel.mjs'), kernelText);
  }
  return root;
}

function runBundle(root) {
  const bundlePath = resolve(root, 'pb.js');
  const r = spawnSync(process.execPath, [RUNNER, '--bundle', bundlePath], {
    encoding: 'utf8',
    env: { ...process.env, PARITY_BUNDLE_KERNELS_DIR: root },
  });
  return { r, bundlePath };
}

let pass = 0, fail = 0;
function check(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ok - ${label}`); }
  else { fail++; console.error(`  NOT OK - ${label}${detail ? `: ${detail}` : ''}`); }
}

const TOPLEVEL = /^[ \t]*(?:export|import)\b/m;

// --- GREEN: strippable forms produce a clean bundle ------------------------
{
  const root = makeTree();
  const { r, bundlePath } = runBundle(root);
  check('good kernel: bundler exits 0', r.status === 0, r.stderr.slice(0, 400));
  check('good kernel: bundle file emitted', existsSync(bundlePath));
  if (existsSync(bundlePath)) {
    const bundle = readFileSync(bundlePath, 'utf8');
    check('good kernel: no top-level export|import in bundle', !TOPLEVEL.test(bundle),
      (bundle.match(/^[ \t]*(?:export|import)\b.*$/m) || [''])[0]);
    check('good kernel: export default rewritten', bundle.includes('const _bundle_default = '));
    check('good kernel: export class rewritten', !/^[ \t]*export[ \t]+class\b/m.test(bundle) && bundle.includes('class Helper'));
    check('good kernel: generator rewritten', bundle.includes('function* seq(n)'));
    check('good kernel: async generator rewritten', bundle.includes('async function* aseq(n)'));
    check('good kernel: multi-line import stripped', !bundle.includes("from 'node:fs'"));
  }
  rmSync(root, { recursive: true, force: true });
}

// --- RED: unstrippable forms are a loud generation-time error, exit 1 ------
// Bad forms are planted BEFORE buildArtifact: only the region ahead of
// buildArtifact is inlined, so that is the region the lint guards.
const plantBeforeBuildArtifact = (text) =>
  GOOD_KERNEL.replace('export async function buildArtifact', `${text}export async function buildArtifact`);

const BAD_FORMS = [
  // ENGINE-BUNDLE-EXPORT-LIST-REWRITE-1: a rename stays refused even when the
  // renamed name is declared at top level in the same file.
  ['export { a as b };', 'const a = 1;\nexport { a as b };\n', 'export { a as b };'],
  // ...and an export list naming an undeclared name stays refused.
  ['export { a, missing };', 'const a = 1;\nexport { a, missing };\n', 'export { a, missing };'],
  ['export * from', "export * from './other.mjs';\n", "export * from './other.mjs';"],
  ['bare export *;', 'export *;\n', 'export *;'],
];
for (const [label, text, offendingLine] of BAD_FORMS) {
  const root = makeTree(plantBeforeBuildArtifact(text));
  const { r, bundlePath } = runBundle(root);
  check(`${label}: exits 1`, r.status === 1, `status=${r.status} stderr=${r.stderr.slice(0, 200)}`);
  check(`${label}: names ENGINE-BUNDLE-ESM-LINT-1`, r.stderr.includes('ENGINE-BUNDLE-ESM-LINT-1'));
  check(`${label}: quotes the offending text`, r.stderr.includes(JSON.stringify(offendingLine)));
  check(`${label}: no bundle emitted`, !existsSync(bundlePath));
  rmSync(root, { recursive: true, force: true });
}

// --- GREEN (ENGINE-BUNDLE-EXPORT-LIST-REWRITE-1): a plain top-level export
// list whose every name is declared at top level in the same file is rewritten
// by dropping the export line; the declarations (and compute) stay. ----------
// `counter` is declared in GOOD_KERNEL via `export let counter = 0;`.
{
  const root = makeTree(plantBeforeBuildArtifact('export { counter };\n'));
  const { r, bundlePath } = runBundle(root);
  check('declared export list: exits 0', r.status === 0, r.stderr.slice(0, 400));
  check('declared export list: bundle file emitted', existsSync(bundlePath));
  if (existsSync(bundlePath)) {
    const bundle = readFileSync(bundlePath, 'utf8');
    check('declared export list: no top-level export|import in bundle', !TOPLEVEL.test(bundle),
      (bundle.match(/^[ \t]*(?:export|import)\b.*$/m) || [''])[0]);
    check('declared export list: let counter = 0 kept', bundle.includes('let counter = 0;'));
  }
  rmSync(root, { recursive: true, force: true });
}

// --- GREEN (ENGINE-PARITY-PROTO-LITERAL-FIX-1): a `__proto__` key in a fixture's
// policy_parameters must survive the bundle's literal embedding as own DATA.
// Before the cure the bundler emitted `const _v = <object literal>`; a
// `"__proto__"` member in an object literal sets the prototype instead of
// creating an own key, so the bundle's manifest diverges from the Node manifest
// (which reads the same fixture through JSON.parse). After the cure the bundler
// emits `const _v = JSON.parse(<json string>)` and the two manifests agree.
{
  const root = mkdtempSync(resolve(tmpdir(), 'bundle-proto-key-'));
  mkdirSync(resolve(root, 'fixtures'), { recursive: true });
  const kernelId = 'proto-key-vector';
  writeFileSync(
    resolve(root, `${kernelId}.kernel.mjs`),
    [
      'export function compute(pp) {',
      "  return { output_payload: { keys: Object.keys(pp), hasOwnProto: Object.prototype.hasOwnProperty.call(pp, '__proto__') } };",
      '}',
      'export async function buildArtifact(pp) { return compute(pp); }',
      '',
    ].join('\n'),
  );
  // Written as raw JSON so `"__proto__"` is an OWN data key: an object literal
  // `{ __proto__: ... }` would set the prototype and drop the key before it ever
  // reached the bundler.
  writeFileSync(
    resolve(root, 'fixtures', `${kernelId}.fixtures.json`),
    '{"tool_id":"proto-key-vector","note":"ENGINE-PARITY-PROTO-LITERAL-FIX-1 selftest fixture",'
    + '"vectors":[{"name":"proto-key","policy_parameters":{"__proto__":"sentinel","normal":1}}]}',
  );
  const env = { ...process.env, PARITY_BUNDLE_KERNELS_DIR: root };
  const nodeOut = resolve(root, 'node-manifest.json');
  const bundlePath = resolve(root, 'pb.js');
  const rNode = spawnSync(process.execPath, [RUNNER, '--out', nodeOut], { encoding: 'utf8', env });
  const rBundle = spawnSync(process.execPath, [RUNNER, '--bundle', bundlePath], { encoding: 'utf8', env });
  check('proto key: node-mode runner exits 0', rNode.status === 0, rNode.stderr.slice(0, 300));
  check('proto key: bundler exits 0', rBundle.status === 0, rBundle.stderr.slice(0, 300));
  if (rNode.status === 0 && rBundle.status === 0) {
    const bundle = readFileSync(bundlePath, 'utf8');
    check('proto key: bundle embeds _v via JSON.parse (not an object literal)',
      /const _v = JSON\.parse\(/.test(bundle),
      (bundle.split('\n').find((l) => l.includes('const _v =')) || '').slice(0, 200));
    const rRun = spawnSync(process.execPath, [bundlePath], { encoding: 'utf8', env });
    check('proto key: bundle runs under node', rRun.status === 0, rRun.stderr.slice(0, 300));
    if (rRun.status === 0) {
      const nodeManifest = readFileSync(nodeOut, 'utf8');
      check('proto key: bundle manifest equals node manifest', rRun.stdout.trim() === nodeManifest.trim(),
        `node=${nodeManifest.trim().slice(0, 400)} bundle=${rRun.stdout.trim().slice(0, 400)}`);
    }
  }
  rmSync(root, { recursive: true, force: true });
}

// --- REAL TREE (ENGINE-BUNDLE-REAL-KERNELS-SELFTEST-1): bundle the repo's own
// chaingraph/kernels/ exactly as cross-engine-parity.yml does. The cases above
// prove the lint on a synthetic tree; this one proves every kernel actually on
// the branch is bundleable. Cross-Engine Parity is not a required check, so
// without this case a kernel the bundler refuses (art-753's export list, PR
// 3110) merges and turns that job red on every PR built on main. This selftest
// runs in preflight, which the required scripts-verify job runs.
// Only the QuickJS execution leg stays outside preflight (needs the qjs binary).
{
  const out = mkdtempSync(resolve(tmpdir(), 'bundle-real-tree-'));
  const bundlePath = resolve(out, 'parity-bundle.js');
  const env = { ...process.env };
  delete env.PARITY_BUNDLE_KERNELS_DIR;
  const r = spawnSync(process.execPath, [RUNNER, '--bundle', bundlePath], { encoding: 'utf8', env });
  check('real kernel tree: bundler exits 0', r.status === 0,
    (r.stderr || '').split('\n').filter((l) => l.includes('ENGINE-BUNDLE-ESM-LINT-1')).slice(0, 2).join(' | ')
      || `status=${r.status} ${(r.stderr || '').slice(0, 300)}`);
  check('real kernel tree: bundle file emitted', existsSync(bundlePath));
  if (existsSync(bundlePath)) {
    const bundle = readFileSync(bundlePath, 'utf8');
    check('real kernel tree: no top-level export|import in bundle', !TOPLEVEL.test(bundle),
      (bundle.match(/^[ \t]*(?:export|import)\b.*$/m) || [''])[0]);
  }
  rmSync(out, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
