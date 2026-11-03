#!/usr/bin/env node
// check-merge-group-shadow.test.mjs — fixture proof for the automerge-label
// arming refusal keyed on the merge-group-shadow check.
//
// Three layers, all offline:
//   1. decide() fixtures — the four verdict classes over a `gh pr checks
//      --json name,state` payload: PASS proceeds; FAIL refuses (exit 10);
//      MISSING refuses closed (exit 11); PENDING refuses (exit 12). Also:
//      a non-array payload refuses closed, an empty payload refuses, a
//      missing state string refuses as FAIL-shaped, and SUCCESS (the API
//      spelling) proceeds like PASS.
//   2. CLI exit-code fixtures — the helper spawned as a subprocess on each
//      fixture payload: exit code and stdout reason line, exactly the shape
//      automerge-label.yml consumes.
//   3. WIRING pin — .github/workflows/automerge-label.yml really invokes this
//      helper by its literal path, keys the enqueue step on the refusal, and
//      writes the reason to $GITHUB_STEP_SUMMARY; and scripts-verify.yml
//      really declares the merge-group-shadow job this gate reads, NON-required
//      (absent from the scripts-verify-required aggregate's needs list).

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide, SHADOW_CHECK } from './check-merge-group-shadow.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const HELPER = resolve(HERE, 'check-merge-group-shadow.mjs');
const AM_YML = resolve(REPO, '.github', 'workflows', 'automerge-label.yml');
const SV_YML = resolve(REPO, '.github', 'workflows', 'scripts-verify.yml');

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + ' — ' + e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

console.log('decide() fixtures:');

await test('PASS proceeds (exit 0)', () => {
  const v = decide([{ name: SHADOW_CHECK, state: 'PASS' }]);
  assert(v.proceed === true, 'expected proceed');
  assert(v.code === 0, 'expected code 0');
});

await test('SUCCESS (API spelling) proceeds like PASS', () => {
  const v = decide([{ name: SHADOW_CHECK, state: 'SUCCESS' }]);
  assert(v.proceed === true && v.code === 0, 'expected proceed');
});

await test('FAIL refuses (exit 10) and the reason names the check', () => {
  const v = decide([{ name: SHADOW_CHECK, state: 'FAIL' }]);
  assert(v.proceed === false, 'expected refuse');
  assert(v.code === 10, `expected code 10, got ${v.code}`);
  assert(v.reason.includes(SHADOW_CHECK), 'reason must name the shadow check');
});

await test('MISSING refuses closed (exit 11)', () => {
  const v = decide([{ name: 'some other check', state: 'PASS' }]);
  assert(v.proceed === false && v.code === 11, 'expected code 11');
  assert(/MISSING/.test(v.reason), 'reason must say MISSING');
});

await test('empty payload refuses closed', () => {
  const v = decide([]);
  assert(v.proceed === false && v.code === 11, 'expected code 11');
});

await test('non-array payload refuses closed', () => {
  const v = decide(null);
  assert(v.proceed === false && v.code === 11, 'expected code 11');
});

await test('PENDING refuses (exit 12)', () => {
  const v = decide([{ name: SHADOW_CHECK, state: 'PENDING' }]);
  assert(v.proceed === false && v.code === 12, 'expected code 12');
});

await test('unknown state string refuses as fail-shaped (exit 10)', () => {
  const v = decide([{ name: SHADOW_CHECK, state: 'SKIPPING' }]);
  assert(v.proceed === false && v.code === 10, 'expected code 10');
});

console.log('CLI exit-code fixtures (subprocess):');

for (const [payload, code] of [
  ['[{"name":"merge-group-shadow","state":"PASS"}]', 0],
  ['[{"name":"merge-group-shadow","state":"FAIL"}]', 10],
  ['[{"name":"unrelated","state":"PASS"}]', 11],
  ['[{"name":"merge-group-shadow","state":"PENDING"}]', 12],
  ['not json at all', 11],
]) {
  await test(`payload ${payload.slice(0, 46)} -> exit ${code}`, () => {
    const r = spawnSync(process.execPath, [HELPER, payload], { encoding: 'utf8' });
    assert(r.status === code, `expected exit ${code}, got ${r.status}; stderr: ${r.stderr}`);
    assert((r.stdout || '').includes(SHADOW_CHECK), 'stdout must carry the reason line');
  });
}

console.log('workflow wiring pins:');

await test('automerge-label.yml invokes the helper and keys arming on it', () => {
  const yml = readFileSync(AM_YML, 'utf8');
  assert(yml.includes('node scripts/check-merge-group-shadow.mjs'), 'enable-automerge must invoke the helper');
  assert(yml.includes('steps.shadow.outputs.verdict'), 'the enqueue step must gate on the shadow verdict output');
  assert(yml.includes('GITHUB_STEP_SUMMARY'), 'the refusal reason must reach the job summary');
});

await test('rearm-recovered also refuses on a non-green shadow', () => {
  const yml = readFileSync(AM_YML, 'utf8');
  const rearm = yml.slice(yml.indexOf('rearm-recovered:'));
  assert(rearm.includes('check-merge-group-shadow.mjs'), 'the rearm scan must consult the same refusal');
});

await test('scripts-verify.yml declares the merge-group-shadow job, non-required', () => {
  const yml = readFileSync(SV_YML, 'utf8');
  assert(/  merge-group-shadow:\n/.test(yml), 'the shadow job must exist');
  assert(/pull_request/.test(yml.slice(yml.indexOf('merge-group-shadow:'), yml.indexOf('scripts-verify-required:'))), 'shadow job must be pull_request-scoped');
  const required = yml.slice(yml.indexOf('scripts-verify-required:'));
  assert(!required.includes('merge-group-shadow'), 'the shadow job must NOT be in the required aggregate needs');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
