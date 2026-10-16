#!/usr/bin/env node
/**
 * scripts/check-engine-parity.bundle.test.mjs — ENGINE-BUNDLE-ESM-LINT-1 selftest.
 *
 * Pins the ESM stripping done by check-engine-parity.mjs --bundle so a PR kernel
 * can never reach QuickJS with a raw top-level `export` (measured 2026-10-12:
 * CI runs 38264357350, 38264539837, 38270564551 all died with
 * "SyntaxError: unsupported keyword: export" AFTER the QuickJS download).
 *
 * RED half: the unstrippable forms (export { ... }, export * from) must make the
 * bundler exit 1 with the ENGINE-BUNDLE-ESM-LINT-1 error BEFORE emitting anything.
 * GREEN half: the strippable forms (default, class, generator, async generator,
 * multi-line import) must yield a bundle with no top-level export|import.
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
  ['export { a, b };', 'export const a = 1, b = 2;\nexport { a, b };\n', 'export { a, b };'],
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

// Planted-bad control: an unstrippable form that the OLD three-regex stripper
// silently passed through must now be caught (this is the RED half).
{
  const root = makeTree(plantBeforeBuildArtifact('export { counter };\n'));
  const { r } = runBundle(root);
  check('planted-bad control: export { counter }; exits 1', r.status === 1);
  rmSync(root, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
