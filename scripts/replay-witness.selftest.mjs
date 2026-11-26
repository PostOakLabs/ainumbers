#!/usr/bin/env node
// scripts/replay-witness.selftest.mjs — offline RED/GREEN controls for the
// fork-facing witness workflow and its source-commit guard. The guard refusal
// is the load-bearing property: a run on upstream, or a fork whose checked-out
// commit does not exist upstream, must produce no attestation.
//
// Self-test: node scripts/replay-witness.selftest.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { witnessGuard, UPSTREAM_REPOSITORY } from './replay-witness-guard.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const WORKFLOW = readFileSync(resolve(ROOT, '.github/workflows/replay-witness.yml'), 'utf8');
const PARITY = readFileSync(resolve(ROOT, 'scripts/check-workflow-gate-parity.mjs'), 'utf8');

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

test('the upstream repository is refused at once', () => {
  assert.deepEqual(
    witnessGuard({ repository: UPSTREAM_REPOSITORY, sha: 'a'.repeat(40), upstreamPresent: true }),
    { allow: false, reason: 'upstream-repository' },
  );
});

test('an edited fork at a commit absent upstream is refused', () => {
  assert.deepEqual(
    witnessGuard({ repository: 'someone/ainumbers', sha: 'b'.repeat(40), upstreamPresent: false }),
    { allow: false, reason: 'source-commit-not-in-upstream' },
  );
});

test('a missing or malformed source sha is refused', () => {
  assert.deepEqual(
    witnessGuard({ repository: 'someone/ainumbers', sha: '', upstreamPresent: true }),
    { allow: false, reason: 'source-sha-not-a-commit' },
  );
  assert.deepEqual(
    witnessGuard({ repository: 'someone/ainumbers', sha: 'xyz', upstreamPresent: true }),
    { allow: false, reason: 'source-sha-not-a-commit' },
  );
});

test('a malformed repository value is refused', () => {
  assert.deepEqual(
    witnessGuard({ repository: 'not-a-repo', sha: 'c'.repeat(40), upstreamPresent: true }),
    { allow: false, reason: 'malformed-repository' },
  );
});

test('a fork at an upstream commit is allowed', () => {
  assert.deepEqual(
    witnessGuard({ repository: 'someone/ainumbers', sha: 'd'.repeat(40), upstreamPresent: true }),
    { allow: true, reason: 'fork-at-upstream-commit' },
  );
});

test('the workflow is dispatch only and gates no merge', () => {
  assert.match(WORKFLOW, /^\s*workflow_dispatch:\s*$/m);
  assert.doesNotMatch(WORKFLOW, /^\s*(?:push|pull_request|schedule|merge_group):/m);
  assert.match(WORKFLOW, /if: github\.repository != 'PostOakLabs\/ainumbers'/);
});

test('the workflow carries only the house permissions and no secrets', () => {
  assert.match(WORKFLOW, /contents: read/);
  assert.match(WORKFLOW, /id-token: write/);
  assert.match(WORKFLOW, /attestations: write/);
  assert.doesNotMatch(WORKFLOW, /\$\{\{\s*secrets\./);
});

test('the workflow runs the tracked replay and attests both subjects', () => {
  assert.match(WORKFLOW, /node scripts\/replay-result\.mjs --out replay-out/);
  assert.match(WORKFLOW, /node scripts\/replay-house-subjects\.mjs replay-out/);
  assert.match(WORKFLOW, /uses: actions\/attest@/);
  assert.match(WORKFLOW, /subject-checksums: replay-out\/replay-subjects\.txt/);
  assert.match(WORKFLOW, /predicate-type: ainumbers\.co\/replay-witness\/v1/);
  assert.match(WORKFLOW, /predicate-path: replay-out\/replay-env\.json/);
});

test('the workflow runs on all three hosted operating systems', () => {
  assert.match(WORKFLOW, /ubuntu-latest/);
  assert.match(WORKFLOW, /windows-latest/);
  assert.match(WORKFLOW, /macos-latest/);
  assert.match(WORKFLOW, /node scripts\/replay-witness-guard\.mjs/);
});

test('every third-party action is pinned to a full commit sha', () => {
  const uses = [...WORKFLOW.matchAll(/uses: (\S+)/g)].map((m) => m[1]);
  assert.ok(uses.length >= 4, `expected at least four actions, found ${uses.length}`);
  for (const action of uses) {
    assert.match(action, /@[0-9a-f]{40}$/, `unpinned action: ${action}`);
  }
});

test('the workflow is registered with the gate parity check', () => {
  assert.match(PARITY, /"replay-witness\.yml"/);
});

console.log(`replay-witness selftests: ${passed} passed`);
