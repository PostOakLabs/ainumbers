#!/usr/bin/env node
/**
 * scripts/session-root-parity.test.mjs — COMPOSER-PLAN-AND-ROOT-WEBMCP-1, parity
 * gate B, SITE side.
 *
 * Proves, over the committed fixture set repo/data/session-root-fixtures.json:
 *   1. The SSOT routine (gen-webmcp-registrations.mjs SESSION_ROOT_SOURCE, the
 *      exact bytes emitted into every chain composer page AND shipped in the
 *      bridge snippet v1.2 as window.AINBridge.sessionRoot) reproduces the
 *      expected Merkle session root for every fixture hash list.
 *   2. The bridge snippet (scripts/ain-bridge-v1.snippet.html) carries the
 *      IDENTICAL routine bytes and is version 1.2 — the "one routine, two
 *      surfaces" law; a drifted copy is RED.
 *   3. RED control: a mutated routine (odd-leaf rule removed) fails the fixture
 *      set — the test is seen red, so its green means something.
 *
 * The WORKER side of the same fixtures is asserted by
 * mcp-apps-poc/tests/chain-plan-and-session-root.test.mjs against the REAL
 * build_session_receipt tool; both sides share this one fixture file (vendored
 * via the worker's generate.mjs cycle).
 *
 * Usage: node scripts/session-root-parity.test.mjs  (also under `node --test`)
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { SESSION_ROOT_SOURCE } from './gen-webmcp-registrations.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

/** Evaluate the routine source in a sandbox scope and return the function. */
function loadRoutine(source) {
  const fn = new Function(`${source}; return ainSessionRoot;`)();
  return fn;
}

test('session-root parity: SSOT routine reproduces every committed fixture root', async () => {
  const fixtures = JSON.parse(readFileSync(resolve(REPO, 'data', 'session-root-fixtures.json'), 'utf8'));
  assert.ok(fixtures.fixture_count >= 5, 'at least 5 fixture hash lists');
  const ainSessionRoot = loadRoutine(SESSION_ROOT_SOURCE);
  for (const fx of fixtures.fixtures) {
    const root = await ainSessionRoot(fx.execution_hashes);
    assert.equal(root, fx.expected_session_receipt_root, `fixture ${fx.name} root mismatch`);
  }
});

test('session-root parity: bridge snippet v1.2 carries the identical routine bytes', () => {
  const snippet = readFileSync(resolve(REPO, 'scripts', 'ain-bridge-v1.snippet.html'), 'utf8');
  assert.ok(snippet.includes("version:'1.2'"), 'bridge snippet must be version 1.2 (COMPOSER-PLAN-AND-ROOT-WEBMCP-1 bump)');
  // The byte-identical core: everything between the signature line and the final closing brace.
  const core = SESSION_ROOT_SOURCE.slice(SESSION_ROOT_SOURCE.indexOf('  if (!Array.isArray'), SESSION_ROOT_SOURCE.lastIndexOf('}')).trimEnd();
  assert.ok(snippet.includes(core), 'bridge snippet must contain the byte-identical session-root core');
  assert.ok(snippet.includes('sessionRoot:ainSessionRoot'), 'bridge must expose AINBridge.sessionRoot');
});

test('session-root parity: RED control, mutated routine fails the fixtures', async () => {
  const mutated = SESSION_ROOT_SOURCE.replace(
    "var right = level[i + 1] !== undefined ? level[i + 1] : level[i]; // duplicate last leaf when odd",
    "var right = level[i + 1] !== undefined ? level[i + 1] : 'sha256:' + '0'.repeat(64); // MUTATED: zero-pad instead of duplicate-last",
  );
  assert.notEqual(mutated, SESSION_ROOT_SOURCE, 'mutation must change the source');
  const ainSessionRoot = loadRoutine(mutated);
  const fixtures = JSON.parse(readFileSync(resolve(REPO, 'data', 'session-root-fixtures.json'), 'utf8'));
  const odd = fixtures.fixtures.find((f) => f.execution_hashes.length % 2 === 1 && f.execution_hashes.length > 1);
  assert.ok(odd, 'fixture set must contain an odd (>1) list for the control');
  const root = await ainSessionRoot(odd.execution_hashes);
  assert.notEqual(root, odd.expected_session_receipt_root, 'mutated routine must NOT reproduce the odd-list root');
});

test('session-root parity: empty input throws (worker parity)', async () => {
  const ainSessionRoot = loadRoutine(SESSION_ROOT_SOURCE);
  await assert.rejects(() => ainSessionRoot([]), /non-empty/);
});
