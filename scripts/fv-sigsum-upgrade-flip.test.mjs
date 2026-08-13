#!/usr/bin/env node
// fv-sigsum-upgrade-flip.test.mjs — proven-to-reject fixture for FV-SIGSUM-UPGRADE-FLIP-1.
//
// Exercises planFlip()/runFlip() — the pure/injectable orchestration this row builds — via
// injected fake sign()/registerAndVerify() functions, never a real key or a real network call
// to Sigsum (that proof is run manually, once, and quoted in the check-off — see the row's own
// "don't manufacture a fake public artifact" instruction). Red-before-green: each guard is shown
// refusing the case it exists to refuse before the calibration case is shown passing.

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planFlip, runFlip } from './fv-sigsum-upgrade-flip.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const artifactFixtures = JSON.parse(readFileSync(resolve(HERE, 'fv-sigsum-upgrade-flip.fixtures.json'), 'utf8'));
const gateFixtures = JSON.parse(readFileSync(resolve(HERE, 'fv-policy-sign-gate.fixtures.json'), 'utf8'));

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + ' — ' + e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// ── planFlip guards ─────────────────────────────────────────────────────────

await test('OBSERVED RED — planFlip refuses when the gate verdict is not eligible', () => {
  const plan = planFlip({ artifact: artifactFixtures.expired_upgraded_artifact, gateEvidence: gateFixtures.ineligible_example_lapsed_quota });
  assert(plan.proceed === false, 'expected proceed=false');
  assert(/gate verdict/.test(plan.reason), `expected gate-verdict reason, got: ${plan.reason}`);
});

await test('OBSERVED RED — planFlip refuses an artifact still status=PROVISIONAL even with an eligible gate verdict', () => {
  const plan = planFlip({ artifact: artifactFixtures.still_provisional_artifact, gateEvidence: gateFixtures.eligible_example });
  assert(plan.proceed === false, 'expected proceed=false');
  assert(/PROVISIONAL/.test(plan.reason), `expected PROVISIONAL guard reason, got: ${plan.reason}`);
});

await test('OBSERVED RED — planFlip refuses an artifact with no challenge-window-expiry status_history entry on record', () => {
  const plan = planFlip({ artifact: artifactFixtures.flipped_but_no_expiry_history_artifact, gateEvidence: gateFixtures.eligible_example });
  assert(plan.proceed === false, 'expected proceed=false');
  assert(/status_history/.test(plan.reason), `expected status_history guard reason, got: ${plan.reason}`);
});

await test('calibration — planFlip proceeds for an eligible gate verdict over a properly expired-and-flipped artifact', () => {
  const plan = planFlip({ artifact: artifactFixtures.expired_upgraded_artifact, gateEvidence: gateFixtures.eligible_example });
  assert(plan.proceed === true, `expected proceed=true, got reason: ${plan.reason}`);
});

// ── runFlip end-to-end, injected fake sign/registerAndVerify (no key, no network) ──────────────

function fakeSign() {
  return { armoredText: '-----BEGIN SSH SIGNATURE-----\nfake\n-----END SSH SIGNATURE-----\n' };
}

function fakeRegisterAndVerify({ digestHex, outDir }) {
  const recordPath = join(outDir, `sigsum-record-${digestHex.slice(0, 16)}.json`);
  const record = {
    anchor_type: 'c2sp-tlog-proof-v1',
    log_url: 'https://seasalp.glasklar.is',
    anchored_hash: `sha256:${digestHex}`,
    tree_head: { size: 12345, root_hash: 'aa'.repeat(32) },
    inclusion_proof: { leaf_index: 999, path: [] },
  };
  writeFileSync(recordPath, JSON.stringify(record, null, 2));
  return { recordPath, record, verifyJson: { ALL_PASS: true } };
}

await test('runFlip refuses (no I/O side effects) when planFlip refuses', async () => {
  const workDir = mkdtempSync(join(tmpdir(), 'fv-sigsum-flip-test-'));
  try {
    const artifactPath = join(workDir, 'artifact.json');
    writeFileSync(artifactPath, JSON.stringify(artifactFixtures.still_provisional_artifact, null, 2));
    const before = readFileSync(artifactPath, 'utf8');
    const result = await runFlip({
      artifactPath,
      artifact: JSON.parse(before),
      gateEvidence: gateFixtures.eligible_example,
      sign: fakeSign,
      registerAndVerify: fakeRegisterAndVerify,
      outDir: workDir,
      dryRun: false,
    });
    assert(result.flipped === false, 'expected flipped=false');
    const after = readFileSync(artifactPath, 'utf8');
    assert(after === before, 'artifact file must be byte-identical — a refused flip must never touch the file');
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

await test('calibration — runFlip stamps status_history with the Sigsum leaf reference and writes the record file', async () => {
  const workDir = mkdtempSync(join(tmpdir(), 'fv-sigsum-flip-test-'));
  try {
    const artifactPath = join(workDir, 'artifact.json');
    const artifact = JSON.parse(JSON.stringify(artifactFixtures.expired_upgraded_artifact));
    writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
    const result = await runFlip({
      artifactPath,
      artifact,
      gateEvidence: gateFixtures.eligible_example,
      sign: fakeSign,
      registerAndVerify: fakeRegisterAndVerify,
      outDir: workDir,
      dryRun: false,
    });
    assert(result.flipped === true, `expected flipped=true, got reason: ${result.reason}`);
    assert(result.historyEntry.sigsum_leaf_index === 999, 'leaf index should be carried from the Sigsum record');
    assert(result.historyEntry.attestation_basis === 'challenge-window-expiry', 'the existing attestation_basis is restated, never overwritten with an invented value');
    assert(result.historyEntry.actor === 'fv-sigsum-upgrade-flip.mjs', 'actor must identify this script, not a human');

    const onDisk = JSON.parse(readFileSync(artifactPath, 'utf8'));
    assert(onDisk.status_history.length === 2, `expected 2 status_history entries (expiry + countersignature), got ${onDisk.status_history.length}`);
    assert(onDisk.status_history[1].sigsum_leaf_index === 999, 'the SECOND status_history entry (this scripts own) must carry the leaf reference');
    assert(onDisk.status_history[0].actor === 'check-fv-provisional-expiry.mjs', 'the FIRST entry (the expiry flip this countersigns) must be preserved, not overwritten');

    const record = JSON.parse(readFileSync(result.sigsumRecordPath, 'utf8'));
    assert(record.inclusion_proof.leaf_index === 999, 'stored record must match what was stamped into status_history');
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

await test('dry-run leaves the artifact file untouched but still reports the would-be stamp', async () => {
  const workDir = mkdtempSync(join(tmpdir(), 'fv-sigsum-flip-test-'));
  try {
    const artifactPath = join(workDir, 'artifact.json');
    const artifact = JSON.parse(JSON.stringify(artifactFixtures.expired_upgraded_artifact));
    writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
    const before = readFileSync(artifactPath, 'utf8');
    const result = await runFlip({
      artifactPath,
      artifact,
      gateEvidence: gateFixtures.eligible_example,
      sign: fakeSign,
      registerAndVerify: fakeRegisterAndVerify,
      outDir: workDir,
      dryRun: true,
    });
    assert(result.flipped === true && result.dryRun === true, 'expected flipped=true, dryRun=true');
    const after = readFileSync(artifactPath, 'utf8');
    assert(after === before, 'dry-run must never write the artifact file');
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
