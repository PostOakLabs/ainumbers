#!/usr/bin/env node
// check-s18-freshness-fixture-derived-root.test.mjs — END-TO-END pairing control for
// S18-FIXTURE-PR-DERIVED-ROOT-1.
//
// The pure-function controls in check-s18-digest-freshness.test.mjs prove calibrationVerdict()'s
// two verdict modes; this file proves the WIRING: that the real §18 freshness fixture test, spawned
// as a subprocess with S18_DERIVED_ROOT pointing at an ephemeral monolith, actually READS that tree
// (and fails when the tree is tampered — a tamper the committed-monolith read can never see).
//
// GREEN leg: spawn scripts/check-s18-digest-freshness.test.mjs with S18_DERIVED_ROOT at a tmp COPY
//   of the committed chaingraph.json → exit 0. (On this gate-fix row the kernels are untouched, so
//   the copy recomputes exactly to the calibration; on a re-prove PR the assembled-from-branch tree
//   likewise recomputes equal, which is the PR shape this row serves.)
// RED leg: same spawn, but the copy has one live gpu:false node's journal.kernel_digest replaced by
//   a bogus digest → exit 1, and the output names the calibration leg's stale message. This leg is
//   what proves the env path is really read: without the env override the fixture reads the
//   untouched committed monolith and stays green.
//
// DERIVED_ROOT is stripped from the child env in BOTH legs — the gates give DERIVED_ROOT
// (merge_group/main) precedence, so a leaked value would silently flip both legs onto the committed
// monolith and the RED leg would false-green.

import { readFileSync, writeFileSync, mkdirSync, rmSync, mkdtempSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { computeStaleness } from './check-s18-digest-freshness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const CG_SRC = resolve(REPO, 'chaingraph', 'chaingraph.json');

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + ' — ' + e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function childEnv(root) {
  const e = { ...process.env, S18_DERIVED_ROOT: root };
  delete e.DERIVED_ROOT;
  return e;
}
function spawnFixture(root) {
  return spawnSync(process.execPath, ['scripts/check-s18-digest-freshness.test.mjs'], {
    cwd: REPO, env: childEnv(root), encoding: 'utf8', timeout: 300_000,
  });
}
function writeTree(tmpRoot, cgObject) {
  mkdirSync(resolve(tmpRoot, 'chaingraph'), { recursive: true });
  writeFileSync(resolve(tmpRoot, 'chaingraph', 'chaingraph.json'), JSON.stringify(cgObject));
}

const committed = JSON.parse(readFileSync(CG_SRC, 'utf8'));
// The RED leg must tamper a FRESH node (stale+1); tampering an already-stale node moves nothing.
// Identify the fresh set with the gate's own computeStaleness over the gate's own kernel-source map.
{
  const KDIR = resolve(REPO, 'chaingraph', 'kernels');
  const { sourceDigest } = await import(pathToFileURL(resolve(KDIR, '_buildid.mjs')).href);
  const live = (committed.nodes ?? []).filter((n) => n.status === 'live' && n.gpu === false);
  const kernelSources = {};
  for (const n of live) {
    try { kernelSources[n.tool_id] = readFileSync(resolve(KDIR, `${n.tool_id}.kernel.mjs`), 'utf8'); } catch { /* left undefined -> NO_KERNEL_FILE */ }
  }
  const { fresh } = await computeStaleness(committed, kernelSources, sourceDigest);
  var FRESH_TOOL_ID = fresh[0] && fresh[0].tool_id;
}
assert(FRESH_TOOL_ID, 'no fresh node found in the committed monolith — the RED leg has no tamper target');

const scratch = mkdtempSync(resolve(tmpdir(), 's18-derived-root-e2e-'));
try {
  await test('e2e GREEN: the fixture test reads S18_DERIVED_ROOT (clean copy of the committed monolith) and exits 0', async () => {
    const root = resolve(scratch, 'clean');
    writeTree(root, committed);
    const r = spawnFixture(root);
    assert(r.status === 0, `expected exit 0, got ${r.status}\nstdout: ${(r.stdout || '').slice(-800)}\nstderr: ${(r.stderr || '').slice(-800)}`);
  });

  await test('e2e RED: a bogus journal.kernel_digest in the S18_DERIVED_ROOT tree fails the fixture with the calibration stale message', async () => {
    const tampered = structuredClone(committed);
    const victim = tampered.nodes.find(
      (n) => n.tool_id === FRESH_TOOL_ID
    );
    (victim.audit_signature?.compute_proof ?? victim.compute_proof).journal.kernel_digest = 'bogus-digest-not-a-real-receipt';
    const root = resolve(scratch, 'tampered');
    writeTree(root, tampered);
    const r = spawnFixture(root);
    const out = `${r.stdout || ''}\n${r.stderr || ''}`;
    assert(r.status === 1, `expected exit 1, got ${r.status} — the fixture did not read the tampered tree\nstdout: ${out.slice(-800)}`);
    assert(/recomputed stale \(\d+\) > calibration artifact stale \(\d+\)/.test(out), `calibration-leg PR-context stale message missing from output:\n${out.slice(-1200)}`);
  });
} finally {
  try { rmSync(scratch, { recursive: true, force: true }); } catch { /* best effort */ }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
