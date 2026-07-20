#!/usr/bin/env node
/**
 * scripts/verify-proposals.test.mjs — 3 synthetic tests for AGENTPR-1's CI gate
 * (verify-proposals.mjs), per the WU's done-criteria: valid passes, out-of-dir
 * PR rejected, colliding slug rejected. Zero-dep (node: builtins only), spawns
 * verify-proposals.mjs as a subprocess so its process.exit() calls don't kill
 * the test runner.
 *
 * Usage: node scripts/verify-proposals.test.mjs
 * Exit 0 = all 3 scenarios behaved as expected. Exit 1 = at least one didn't.
 */
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = resolve(REPO, 'scripts', 'verify-proposals.mjs');
const FIXTURES = resolve(REPO, 'scripts', 'fixtures', 'proposals-test');

function run(args) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

let failed = 0;

// 1. Valid proposal passes.
{
  const f = 'valid-fee-router.json';
  const r = run([resolve(FIXTURES, f)]);
  if (r.code !== 0) {
    failed++;
    console.error(`FAIL [valid passes]: expected exit 0, got ${r.code}\n${r.stdout}${r.stderr}`);
  } else if (!/receipt-verified/.test(r.stdout)) {
    failed++;
    console.error(`FAIL [valid passes]: expected receipt-verified line, got:\n${r.stdout}`);
  } else {
    console.log('PASS [valid proposal passes, receipt fast-track verified]');
  }
}

// 2. Out-of-dir PR rejected.
{
  const f = 'valid-but-touches-other-files.json';
  const r = run([resolve(FIXTURES, f), `--changed-files=proposals/${f},tools/some-other-tool.html`]);
  if (r.code !== 1 || !/out-of-dir/.test(r.stderr)) {
    failed++;
    console.error(`FAIL [out-of-dir rejected]: expected exit 1 + "out-of-dir", got exit ${r.code}\n${r.stdout}${r.stderr}`);
  } else {
    console.log('PASS [out-of-dir PR rejected]');
  }
}

// 3. Colliding slug rejected.
{
  const f = '01-a2a-fee-route-optimizer.json';
  const r = run([resolve(FIXTURES, f)]);
  if (r.code !== 1 || !/collides with a live/.test(r.stderr)) {
    failed++;
    console.error(`FAIL [colliding slug rejected]: expected exit 1 + collision message, got exit ${r.code}\n${r.stdout}${r.stderr}`);
  } else {
    console.log('PASS [colliding slug rejected]');
  }
}

if (failed) {
  console.error(`\nverify-proposals.test.mjs: FAILED — ${failed}/3 scenario(s) did not behave as expected.`);
  process.exit(1);
}
console.log('\nverify-proposals.test.mjs: OK — all 3 synthetic scenarios passed.');
