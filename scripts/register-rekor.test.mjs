#!/usr/bin/env node
// register-rekor.test.mjs — regression coverage for C2SP-TLOG-VERIFY-MODULE-1
// (extracting chaingraph/kernels/c2sp-tlog-verify.mjs out of register-sigsum.mjs
// and register-rekor.mjs). register-rekor.mjs is a CLI script, not a module, so
// this drives it as a subprocess exactly the way an operator would — no reach-in.
//
// What this file proves:
//
// 1. REGRESSION (the row's explicit ask): the real PROV-SCITT-REGISTER-1 Rekor
//    record (uuid 108e9186e8...) still verifies ALL_PASS post-refactor, i.e. the
//    shared module's parseSignedNote + hashLeafNode/hashInteriorNode +
//    verifyInclusion produce byte-identical results to the pre-refactor
//    hand-rolled parser. The record's inclusionProof/checkpoint/body_b64 were
//    fetched read-only from Rekor's public GET /api/v1/log/entries/<uuid> API
//    (no new anchor submitted — Rekor recomputes each entry's inclusion proof
//    against the CURRENT tree root on every read, so this is a live, current,
//    genuinely valid proof for a real historical registration, not a stale one).
// 2. TAMPER REJECTION: flipping a byte in the stored root hash, or in the
//    checkpoint's own cosignature, must flip ALL_PASS to false — proving the
//    shared module's checks are load-bearing, not decorative.
//
// Zero-dep (CONTRACT.md): node:child_process only, same primitives
// register-rekor.mjs itself uses. No network calls in this test file.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, 'register-rekor.mjs');
const fixtures = JSON.parse(readFileSync(resolve(HERE, 'register-rekor.fixtures.json'), 'utf8'));
const REAL_RECORD = fixtures.prov_scitt_register_1_record;

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + ' — ' + e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function runVerify(record) {
  const workDir = mkdtempSync(join(tmpdir(), 'register-rekor-test-'));
  try {
    const recordPath = join(workDir, 'record.json');
    writeFileSync(recordPath, JSON.stringify(record, null, 2));
    let stdout, status;
    try {
      stdout = execFileSync('node', [SCRIPT, 'verify', recordPath], { encoding: 'utf8' });
      status = 0;
    } catch (e) {
      stdout = e.stdout ? e.stdout.toString() : '';
      status = e.status;
    }
    return { status, results: JSON.parse(stdout) };
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

// ── 1. REGRESSION — the real PROV-SCITT-REGISTER-1 record still verifies ──

test('calibration — real Rekor record (uuid 108e9186e8...) verifies ALL_PASS post-refactor', () => {
  const { status, results } = runVerify(REAL_RECORD);
  assert(status === 0, `expected exit 0, got ${status}: ${JSON.stringify(results)}`);
  assert(results.digestMatchesAnchoredHash === true, 'expected digestMatchesAnchoredHash=true');
  assert(results.inclusionProofValid === true, 'expected inclusionProofValid=true (shared verifyInclusion)');
  assert(results.checkpointRootMatches === true, 'expected checkpointRootMatches=true');
  assert(results.checkpointSignatureValid === true, 'expected checkpointSignatureValid=true (shared parseSignedNote)');
  assert(results.ALL_PASS === true, `expected ALL_PASS=true, got: ${JSON.stringify(results, null, 2)}`);
});

test('selftest command still exits 0 (shared hashLeafNode/hashInteriorNode/verifyInclusion)', () => {
  const stdout = execFileSync('node', [SCRIPT, 'selftest'], { encoding: 'utf8' });
  assert(/selftest: ALL PASS/.test(stdout), `expected "selftest: ALL PASS", got:\n${stdout}`);
});

// ── 2. TAMPER REJECTION — the shared checks are load-bearing ──────────────

test('OBSERVED RED — tampering the inclusion-proof root hash breaks inclusionProofValid', () => {
  const tampered = JSON.parse(JSON.stringify(REAL_RECORD));
  const root = tampered.inclusionProof.rootHash;
  tampered.inclusionProof.rootHash = (root[0] === 'a' ? 'b' : 'a') + root.slice(1);
  const { status, results } = runVerify(tampered);
  assert(results.inclusionProofValid === false, 'expected inclusionProofValid=false on a tampered root hash');
  assert(results.ALL_PASS === false, 'expected ALL_PASS=false');
  assert(status !== 0, `expected non-zero exit, got ${status}`);
});

test('OBSERVED RED — tampering the checkpoint cosignature breaks checkpointSignatureValid', () => {
  const tampered = JSON.parse(JSON.stringify(REAL_RECORD));
  const cp = tampered.inclusionProof.checkpoint;
  // Flip one base64 character inside the "— rekor.sigstore.dev <sig>" line.
  const marker = '— rekor.sigstore.dev ';
  const idx = cp.indexOf(marker);
  assert(idx !== -1, 'fixture setup: expected a cosignature line');
  // Flip a character well past the base64-encoded 4-byte key-ID hint (first
  // ~6 base64 chars) so the tamper lands inside the DER signature bytes,
  // not the hint register-rekor.mjs checks BEFORE reaching signature verify.
  const sigTailStart = idx + marker.length + 20;
  const ch = cp[sigTailStart];
  const replacement = ch === 'A' ? 'B' : 'A';
  tampered.inclusionProof.checkpoint = cp.slice(0, sigTailStart) + replacement + cp.slice(sigTailStart + 1);
  const { status, results } = runVerify(tampered);
  assert(results.checkpointSignatureValid === false, 'expected checkpointSignatureValid=false on a tampered cosignature');
  assert(results.ALL_PASS === false, 'expected ALL_PASS=false');
  assert(status !== 0, `expected non-zero exit, got ${status}`);
});

// ── 3. rekor-pinned.tlog-policy MATCHES THE JS PIN, BYTE-FOR-BYTE (C2SP-TLOG-POLICY-FILE-1) ──
// Wiring choice (b) per BUILD-SPEC §3: register-rekor.mjs keeps REKOR_PUBLIC_KEY_PEM/
// REKOR_LOG_ID as the enforced values; this test proves
// chaingraph/policies/rekor-pinned.tlog-policy's "log <hex> <url>" line encodes
// the SAME SPKI DER key (as bare hex — the named vkey-encoding deviation the
// policy file's own header comment documents) plus a "quorum none" line, so the
// checked-in artifact can never silently drift from what verify() enforces.

test('rekor-pinned.tlog-policy encodes the identical pinned log key + quorum-none as the JS pin', () => {
  const policyPath = resolve(HERE, '../chaingraph/policies/rekor-pinned.tlog-policy');
  const policyText = readFileSync(policyPath, 'utf8');
  const logLine = policyText.split('\n').find((l) => l.trim().startsWith('log '));
  const quorumLine = policyText.split('\n').find((l) => l.trim().startsWith('quorum '));
  assert(logLine, 'expected a "log <hex> <url>" line in the policy file');
  assert(quorumLine, 'expected a "quorum ..." line in the policy file');
  const [, policyKeyHex, policyUrl] = logLine.trim().split(/\s+/);
  assert(quorumLine.trim() === 'quorum none', `expected "quorum none", got: ${quorumLine.trim()}`);

  const scriptSource = readFileSync(SCRIPT, 'utf8');
  const pem = scriptSource.match(/REKOR_PUBLIC_KEY_PEM = `([\s\S]*?)`;/)[1];
  const b64 = pem.replace(/-----BEGIN PUBLIC KEY-----/, '').replace(/-----END PUBLIC KEY-----/, '').replace(/\s+/g, '');
  const derHex = Buffer.from(b64, 'base64').toString('hex');
  const jsUrl = scriptSource.match(/const REKOR_URL = '([^']+)';/)[1];

  assert(policyKeyHex === derHex, `expected policy log key to equal REKOR_PUBLIC_KEY_PEM's DER hex, got mismatch:\n  policy: ${policyKeyHex}\n  js:     ${derHex}`);
  assert(policyUrl === jsUrl, `expected policy log url ${policyUrl} === REKOR_URL ${jsUrl}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
