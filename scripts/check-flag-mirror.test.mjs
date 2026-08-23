#!/usr/bin/env node
/**
 * check-flag-mirror.test.mjs — SO #40(b) pairing for the FLAG-MIRROR-DOCTRINE gate.
 *
 * A new gate proves RED before GREEN, and it proves it by MUTATION rather than by reading
 * (SO #34). Every case below builds a throwaway kernel estate in a temp dir and runs the real
 * gate against it, so a future edit that quietly stops detecting the defect fails here.
 *
 * The load-bearing case is #2: take a kernel that PASSES, delete its mirrored member, and require
 * the gate to go red. A gate proven only by "the baseline shields everything" would pass while
 * detecting nothing.
 *
 * Usage: node scripts/check-flag-mirror.test.mjs   (exit 0 = all cases pass)
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SELF = resolve(dirname(fileURLToPath(import.meta.url)), 'check-flag-mirror.mjs');
const { run, classifyKernel, MIRROR_MEMBERS } = await import(pathToFileURL(SELF).href);

let failures = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `  expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`);
  if (!ok) failures++;
};

/** A kernel whose flag set varies with input, with or without a mirrored payload member. */
const conditionalKernel = (withMirror) => `
export function compute(pp) {
  pp = pp || {};
  const flags = ['SCOPE_ASSESSED'];
  let review = false;
  if (typeof pp.amount !== 'number') { flags.push('AMOUNT_MISSING'); review = true; }
  return { output_payload: { verdict: review ? null : 'ok'${withMirror ? ', manual_review_required: review' : ''} }, compliance_flags: flags };
}
`;

/** Same flag set on every input — the *_ASSESSED marker class, which owes no mirror. */
const constantKernel = `
export function compute() { return { output_payload: { verdict: 'ok' }, compliance_flags: ['SCOPE_ASSESSED'] }; }
`;

function sandbox(kernels, { baseline = [] } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'flagmirror-'));
  mkdirSync(join(root, 'chaingraph', 'kernels', 'fixtures'), { recursive: true });
  mkdirSync(join(root, 'scripts'), { recursive: true });
  for (const [id, src] of Object.entries(kernels)) {
    writeFileSync(join(root, 'chaingraph', 'kernels', `${id}.kernel.mjs`), src);
    // Two authored vectors, so conditionality is observable from real inputs and not only from {}.
    writeFileSync(join(root, 'chaingraph', 'kernels', 'fixtures', `${id}.fixtures.json`),
      JSON.stringify({ tool_id: id, vectors: [{ name: 'priced', policy_parameters: { amount: 10 } }, { name: 'unpriced', policy_parameters: {} }] }, null, 2));
  }
  writeFileSync(join(root, 'scripts', 'flag-mirror-baseline.json'), JSON.stringify({ entries: baseline }, null, 2));
  return root;
}

const quiet = async (fn) => {
  const log = console.log, err = console.error;
  console.log = () => {}; console.error = () => {};
  try { return await fn(); } finally { console.log = log; console.error = err; }
};

console.log('check-flag-mirror.test.mjs — RED-first proof by mutation\n');

// 1. GREEN: a conditional kernel that mirrors passes with an empty baseline.
{
  const root = sandbox({ 'k-mirrored': conditionalKernel(true) });
  check('mirrored conditional kernel -> exit 0', await quiet(() => run({ repo: root, argv: [] })), 0);
  check('  classified CONDITIONAL', (await classifyKernel('k-mirrored', {
    kernelsDir: join(root, 'chaingraph', 'kernels'), fixturesDir: join(root, 'chaingraph', 'kernels', 'fixtures'),
  })).verdict, 'CONDITIONAL');
  rmSync(root, { recursive: true, force: true });
}

// 2. RED BY MUTATION — the load-bearing case. Same kernel, mirrored member deleted.
{
  const root = sandbox({ 'k-mirrored': conditionalKernel(false) });
  check('mutation: mirror removed -> exit 1 (gate detects the defect)', await quiet(() => run({ repo: root, argv: [] })), 1);
  rmSync(root, { recursive: true, force: true });
}

// 3. The baseline shields a known violator — and only that one.
{
  const root = sandbox({ 'k-old': conditionalKernel(false) }, { baseline: ['k-old'] });
  check('baselined violator -> exit 0', await quiet(() => run({ repo: root, argv: [] })), 0);
  rmSync(root, { recursive: true, force: true });
}
{
  const root = sandbox({ 'k-old': conditionalKernel(false), 'k-new': conditionalKernel(false) }, { baseline: ['k-old'] });
  check('a NEW violator beside a baselined one -> exit 1', await quiet(() => run({ repo: root, argv: [] })), 1);
  rmSync(root, { recursive: true, force: true });
}

// 4. Stale shield is a failure: the ratchet must move down, never sit.
{
  const root = sandbox({ 'k-fixed': conditionalKernel(true) }, { baseline: ['k-fixed'] });
  check('stale baseline entry (now clean) -> exit 1', await quiet(() => run({ repo: root, argv: [] })), 1);
  check('  --update burns it down -> exit 0', await quiet(() => run({ repo: root, argv: ['--update'] })), 0);
  check('  --update emptied the baseline', JSON.parse(readFileSync(join(root, 'scripts', 'flag-mirror-baseline.json'), 'utf8')).entries, []);
  rmSync(root, { recursive: true, force: true });
}

// 5. ⛔ --update MUST NOT widen the shield. This is the deletable-baseline defence.
{
  const root = sandbox({ 'k-new': conditionalKernel(false) }, { baseline: [] });
  check('--update on an unshielded violation -> exit 1 (refuses to self-shield)', await quiet(() => run({ repo: root, argv: ['--update'] })), 1);
  check('  baseline still empty after --update', JSON.parse(readFileSync(join(root, 'scripts', 'flag-mirror-baseline.json'), 'utf8')).entries, []);
  rmSync(root, { recursive: true, force: true });
}

// 6. The constant-marker class is not gated: *_ASSESSED on every input carries no non-verdict.
{
  const root = sandbox({ 'k-const': constantKernel });
  check('constant marker kernel -> exit 0', await quiet(() => run({ repo: root, argv: [] })), 0);
  check('  classified CONSTANT', (await classifyKernel('k-const', {
    kernelsDir: join(root, 'chaingraph', 'kernels'), fixturesDir: join(root, 'chaingraph', 'kernels', 'fixtures'),
  })).verdict, 'CONSTANT');
  rmSync(root, { recursive: true, force: true });
}

// 7. SO #34c — a kernel that cannot be observed is UNCLASSIFIED, never green-by-omission.
{
  const root = sandbox({ 'k-broken': 'export const compute = 42;\n' });
  check('non-callable compute -> UNCLASSIFIED', (await classifyKernel('k-broken', {
    kernelsDir: join(root, 'chaingraph', 'kernels'), fixturesDir: join(root, 'chaingraph', 'kernels', 'fixtures'),
  })).verdict, 'UNCLASSIFIED');
  rmSync(root, { recursive: true, force: true });
}

// 8. The mirror list is closed, and a payload member outside it does not satisfy the rule.
{
  check('MIRROR_MEMBERS is frozen', Object.isFrozen(MIRROR_MEMBERS), true);
  const root = sandbox({ 'k-offlist': `
export function compute(pp) {
  pp = pp || {};
  const flags = ['SCOPE_ASSESSED'];
  let review = false;
  if (typeof pp.amount !== 'number') { flags.push('AMOUNT_MISSING'); review = true; }
  return { output_payload: { verdict: 'ok', my_own_caveat_field: review }, compliance_flags: flags };
}
` });
  check('off-list payload member does not satisfy the mirror -> exit 1', await quiet(() => run({ repo: root, argv: [] })), 1);
  rmSync(root, { recursive: true, force: true });
}

console.log(`\n${failures === 0 ? '✓ all cases passed' : `✗ ${failures} case(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
