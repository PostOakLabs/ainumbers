#!/usr/bin/env node
// check-s18-freshness-fixture-derived-root.test.mjs — END-TO-END pairing control for
// S18-FIXTURE-PR-DERIVED-ROOT-1.
//
// The pure-function controls in check-s18-digest-freshness.test.mjs prove calibrationVerdict()'s
// two verdict modes; this file proves the WIRING: that the real §18 freshness fixture test, spawned
// as a subprocess with S18_DERIVED_ROOT pointing at an ephemeral monolith, actually READS that tree
// (and fails when the tree is tampered — a tamper the committed-monolith read can never see).
//
// GREEN leg: spawn the repo's own assembler (scripts/assemble-chaingraph.mjs — the same assembler
//   land-verify.yml uses for S18_DERIVED_ROOT on pull_request) to build an ephemeral monolith from
//   THIS checkout into a tmp root, then spawn scripts/check-s18-digest-freshness.test.mjs with
//   S18_DERIVED_ROOT at that root → exit 0. Assembling from the checkout (not copying the committed
//   chaingraph.json, which is main-regen single-writer and lags any kernel re-prove) means the leg
//   tracks the branch's own kernels/receipts, exactly the PR shape this row serves.
// RED leg: a copy of the SAME assembled tree with one live gpu:false node's journal.kernel_digest
//   replaced by a bogus digest → exit 1, and the output names the calibration leg's stale message.
//   This leg is what proves the env path is really read: without the env override the fixture reads
//   the untouched committed monolith and stays green.
//
// DERIVED_ROOT is stripped from the child env in BOTH legs — the gates give DERIVED_ROOT
// (merge_group) precedence via their derivedResolve fallback
// (S18-FRESHNESS-MERGEGROUP-DERIVED-ROOT-1), so a leaked value would silently flip both legs onto
// that tree instead of the S18_DERIVED_ROOT one, and the RED leg could false-green.

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
// Build an ephemeral monolith from THIS checkout into <root>/chaingraph/chaingraph.json,
// exactly as land-verify.yml's s18tree step does.
function assembleTree(root) {
  const out = resolve(root, 'chaingraph', 'chaingraph.json');
  const r = spawnSync(process.execPath, ['scripts/assemble-chaingraph.mjs', '--out', out], {
    cwd: REPO, encoding: 'utf8', timeout: 300_000,
  });
  assert(r.status === 0, `assemble-chaingraph.mjs failed (exit ${r.status})\nstdout: ${(r.stdout || '').slice(-400)}\nstderr: ${(r.stderr || '').slice(-400)}`);
  return JSON.parse(readFileSync(out, 'utf8'));
}

// The RED leg must tamper a FRESH node (stale+1); tampering an already-stale node moves nothing.
// Identify the fresh set with the gate's own computeStaleness over the gate's own kernel-source map.
const committed = JSON.parse(readFileSync(CG_SRC, 'utf8'));
{
  const KDIR = resolve(REPO, 'chaingraph', 'kernels');
  var sourceDigest = (await import(pathToFileURL(resolve(KDIR, '_buildid.mjs')).href)).sourceDigest;
  const live = (committed.nodes ?? []).filter((n) => n.status === 'live' && n.gpu === false);
  var kernelSources = {};
  for (const n of live) {
    try { kernelSources[n.tool_id] = readFileSync(resolve(KDIR, `${n.tool_id}.kernel.mjs`), 'utf8'); } catch { /* left undefined -> NO_KERNEL_FILE */ }
  }
  const { fresh } = await computeStaleness(committed, kernelSources, sourceDigest);
  var FRESH_TOOL_ID = fresh[0] && fresh[0].tool_id;
}
assert(FRESH_TOOL_ID, 'no fresh node found in the committed monolith — the RED leg has no tamper target');

const scratch = mkdtempSync(resolve(tmpdir(), 's18-derived-root-e2e-'));
try {
  var assembled;
  await test('e2e GREEN: the fixture test reads S18_DERIVED_ROOT (monolith assembled from the checkout) and exits 0', async () => {
    const root = resolve(scratch, 'clean');
    assembled = assembleTree(root);
    const r = spawnFixture(root);
    assert(r.status === 0, `expected exit 0, got ${r.status}\nstdout: ${(r.stdout || '').slice(-800)}\nstderr: ${(r.stderr || '').slice(-800)}`);
  });

  await test('e2e RED: bogus journal.kernel_digests in fresh nodes of a tampered copy of the ASSEMBLED tree fail the fixture with the calibration stale message', async () => {
    // S18-E2E-HEADROOM-1 (2026-11-23, KERNEL-BIGINT-F1-SAFE-FORMAT-1 ci-red): the tamper must
    // push recomputed stale PAST the calibration artifact's stale count, not merely by one.
    // A PR that legitimately CURES one of main's pre-existing stale nodes lands with
    // assembled stale = calibration stale - cures, so a single tamper lands ON the budget
    // (measured: calibration 113, assembled 112, tamper -> 113, not > 113) and this leg
    // false-greened while the fixture was in fact reading the tampered tree. Cure count
    // headroom is real PR state, so the leg now tampers headroom+1 fresh nodes; on main
    // (headroom 0) that is the same single tamper as before. If tampering every fresh
    // node still cannot exceed the budget, the assert below fails loudly - a genuine
    // wiring break, not a waived red.
    const { fresh: assembledFresh, stale: assembledStale } = await computeStaleness(assembled, kernelSources, sourceDigest);
    const calibration = JSON.parse(readFileSync(resolve(REPO, 'scripts', 's18-freshness-calibration.json'), 'utf8'));
    const headroom = Math.max(0, (calibration.stale ?? 0) - assembledStale.length);
    const tamperCount = headroom + 1;
    assert(assembledFresh.length >= tamperCount, `only ${assembledFresh.length} fresh node(s) in the assembled tree but the calibration headroom needs ${tamperCount} tamper victim(s)`);
    const tampered = structuredClone(assembled);
    const victimIds = [];
    for (let k = 0; k < tamperCount; k++) {
      const victimId = assembledFresh[k].tool_id;
      const victim = tampered.nodes.find((n) => n.tool_id === victimId);
      assert(victim, `tamper target ${victimId} missing from the assembled tree`);
      (victim.audit_signature?.compute_proof ?? victim.compute_proof).journal.kernel_digest = `bogus-digest-not-a-real-receipt-${k}`;
      victimIds.push(victimId);
    }
    const root = resolve(scratch, 'tampered');
    writeTree(root, tampered);
    const r = spawnFixture(root);
    const out = `${r.stdout || ''}\n${r.stderr || ''}`;
    assert(r.status === 1, `expected exit 1 after tampering ${tamperCount} fresh node(s) (${victimIds.join(', ')}), got ${r.status} — the fixture did not read the tampered tree\nstdout: ${out.slice(-800)}`);
    assert(/recomputed stale \(\d+\) > calibration artifact stale \(\d+\)/.test(out), `calibration-leg PR-context stale message missing from output:\n${out.slice(-1200)}`);
  });
} finally {
  try { rmSync(scratch, { recursive: true, force: true }); } catch { /* best effort */ }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
