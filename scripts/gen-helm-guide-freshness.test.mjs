#!/usr/bin/env node
// gen-helm-guide-freshness.test.mjs — proven-to-reject fixture for the
// HELM-RELEASE-DRIFT-GATES-1 gate 2 (gen-helm-guide-freshness.mjs).
//
// Proves: (1) a version bump with an unchanged walkthrough and no escape is
// REJECTED (the "changelog only" trap Tim called out must not satisfy this
// gate); (2) a version bump with a genuinely changed walkthrough is
// ACCEPTED; (3) the documented acknowledged_no_change escape works;
// (4) hashGuide() is deterministic against the real helm.html.
//
// Deliberately does NOT assert the real committed helm/guide-freshness.json
// is in sync right now (HELM-GUIDE-FRESHNESS-REPORTONLY-1, 2026-08-11) — that
// assertion duplicates --check's own staleness finding, and this file is run
// as a crash-detector ahead of --check in the scheduled workflow. A real
// staleness owes a ::notice, not a red unit-test suite. --check is still the
// authority on current staleness; run it directly to ask that question.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate, hashGuide } from './gen-helm-guide-freshness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + ' — ' + e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

test('rejects a version bump with unchanged walkthrough and no escape (changelog-only trap)', () => {
  const r = evaluate({
    latestVersion: '0.2.0',
    guideHash: HASH_A,
    state: { synced_version: '0.1.0', guide_hash: HASH_A, acknowledged_no_change: [] },
  });
  assert(r.ok === false, 'expected evaluate() to reject an unchanged walkthrough on a version bump');
  assert(/0\.2\.0/.test(r.reason) && /0\.1\.0/.test(r.reason), `reason should name both versions, got: ${r.reason}`);
});

test('accepts a version bump where the walkthrough hash actually changed', () => {
  const r = evaluate({
    latestVersion: '0.2.0',
    guideHash: HASH_B,
    state: { synced_version: '0.1.0', guide_hash: HASH_A, acknowledged_no_change: [] },
  });
  assert(r.ok === true && r.action === 'sync', `expected a real change to sync cleanly, got: ${JSON.stringify(r)}`);
});

test('accepts a version bump listed in acknowledged_no_change even with an unchanged walkthrough', () => {
  const r = evaluate({
    latestVersion: '0.2.0',
    guideHash: HASH_A,
    state: { synced_version: '0.1.0', guide_hash: HASH_A, acknowledged_no_change: ['0.2.0'] },
  });
  assert(r.ok === true && r.action === 'sync', `expected the documented escape to pass, got: ${JSON.stringify(r)}`);
});

test('no-op when already synced to the latest version', () => {
  const r = evaluate({
    latestVersion: '0.1.0',
    guideHash: HASH_A,
    state: { synced_version: '0.1.0', guide_hash: HASH_A, acknowledged_no_change: [] },
  });
  assert(r.ok === true && r.action === 'none', `expected a no-op, got: ${JSON.stringify(r)}`);
});

test('hashGuide() is deterministic and scoped to scenes s1-s6', () => {
  const helmHtmlText = readFileSync(resolve(REPO, 'helm.html'), 'utf8');
  const h1 = hashGuide(helmHtmlText);
  const h2 = hashGuide(helmHtmlText);
  assert(h1 === h2, 'hashGuide() must be deterministic for identical input');
  assert(/^[0-9a-f]{64}$/.test(h1), `expected a sha256 hex digest, got: ${h1}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
