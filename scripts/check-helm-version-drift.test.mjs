#!/usr/bin/env node
// check-helm-version-drift.test.mjs — proven-to-reject fixture for the
// HELM-RELEASE-DRIFT-GATES-1 gate 1 (check-helm-version-drift.mjs).
//
// A drift gate never observed to reject drift isn't known to catch it. This
// feeds evaluate() a deliberately-mismatched fixture (version.json says
// 0.2.0, helm.html links still say v0.1.0 — exactly the #44-merges scenario
// the gate exists for) and asserts it fails, then asserts the real committed
// files (should be in sync right now) pass.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate } from './check-helm-version-drift.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + ' — ' + e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// ---- Fixture: a stale helm.html (still v0.1.0 links) after a real v0.2.0 release ----
const STALE_VERSION_JSON = JSON.stringify({
  latest_version: '0.2.0',
  minimum_supported_version: '0.1.0',
  release_url: 'https://github.com/PostOakLabs/ainumbers-helm/releases/tag/v0.2.0',
  published_at: '2026-08-01T00:00:00Z',
});
const STALE_HELM_HTML = `
  <a class="qs-btn" href="https://github.com/PostOakLabs/ainumbers-helm/releases/download/v0.1.0/helmd-windows-x64.exe">Windows</a>
  <a class="qs-btn" href="https://github.com/PostOakLabs/ainumbers-helm/releases/download/v0.1.0/helmd-macos-x64">macOS Intel</a>
`;

test('rejects a v0.2.0 release with v0.1.0 helm.html links (the #44 drift scenario)', () => {
  const r = evaluate({ versionJsonText: STALE_VERSION_JSON, helmHtmlText: STALE_HELM_HTML });
  assert(r.ok === false, 'expected evaluate() to reject stale links, but it passed');
  assert(/v0\.1\.0/.test(r.reason) && /v0\.2\.0/.test(r.reason), `reason should name both versions, got: ${r.reason}`);
});

test('rejects when helm.html has no release links at all (scope guard)', () => {
  const r = evaluate({ versionJsonText: STALE_VERSION_JSON, helmHtmlText: '<p>no links here</p>' });
  assert(r.ok === false, 'expected evaluate() to reject a page with zero release links');
});

test('rejects malformed helm/version.json', () => {
  const r = evaluate({ versionJsonText: '{not json', helmHtmlText: STALE_HELM_HTML });
  assert(r.ok === false, 'expected evaluate() to reject unparseable version.json');
});

test('accepts a fixture where every link matches version.json', () => {
  const r = evaluate({
    versionJsonText: STALE_VERSION_JSON,
    helmHtmlText: STALE_HELM_HTML.replace(/v0\.1\.0/g, 'v0.2.0'),
  });
  assert(r.ok === true, `expected a fully-synced fixture to pass, got: ${r.reason}`);
});

test('accepts the real committed helm.html + helm/version.json (must be in sync now)', () => {
  const versionJsonText = readFileSync(resolve(REPO, 'helm', 'version.json'), 'utf8');
  const helmHtmlText = readFileSync(resolve(REPO, 'helm.html'), 'utf8');
  const r = evaluate({ versionJsonText, helmHtmlText });
  assert(r.ok === true, `real repo state should be drift-free right now, got: ${r.reason}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
