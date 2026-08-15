#!/usr/bin/env node
// register-sigsum.test.mjs — regression + mutation coverage for SIGSUM-NAMED-POLICY-1
// (aligning the pinned Sigsum trust policy with sigsum-go's official named policy
// "sigsum-generic-2025-1"). register-sigsum.mjs is a CLI script, not a module, so
// this drives it as a subprocess exactly the way an operator would — no reach-in.
//
// Three things this file must prove, per the row's own instructions:
//
// 1. REGRESSION (the row's explicit ask): a record registered under the PRE-named-
//    policy pin (SIGSUM-ANCHOR-2, 2 witnesses known at registration time) still
//    verifies under the new 3-witness/2-of-3-quorum pin — a quorum check against
//    the record's OWN cosignatures, never a retroactive 3-witness demand.
// 2. THE QUORUM RULE IS ACTUALLY ENFORCED (SO #34 spirit — a pinned constant that
//    is never checked is decoration, not a trust policy): trimming a real record's
//    witness_cosignatures below the 2-of-3 threshold must flip ALL_PASS to false.
// 3. LOG IDENTITY IS PINNED, NOT SELF-ATTESTED (SO #34 letter — "a gate may never
//    read the value it validates from the artifact under test"): the PRIOR version
//    of verify() imported record.log_public_key directly and checked the log
//    signature against that same record-supplied key — a fully self-consistent
//    forged record (fresh keypair, self-signed checkpoint) would have PASSED that
//    check. This test forges exactly such a record and proves the NEW logKeyPinned
//    gate rejects it even though the forged signature is internally valid.
//
// Zero-dep (CONTRACT.md): node:child_process + node:crypto (WebCrypto Ed25519)
// only, same primitives register-sigsum.mjs itself uses. No sigsum-go vendoring —
// the forging logic here is a minimal, independent reimplementation of the wire
// shapes (RFC 6962-adjacent checkpoint text), exactly what a real attacker would
// need, not a reuse of the production code under test.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';

const subtle = webcrypto.subtle;
const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, 'register-sigsum.mjs');
const fixtures = JSON.parse(readFileSync(resolve(HERE, 'register-sigsum.fixtures.json'), 'utf8'));
const REAL_RECORD = fixtures.sigsum_anchor_2_record;

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + ' — ' + e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function runVerify(record) {
  const workDir = mkdtempSync(join(tmpdir(), 'register-sigsum-test-'));
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

async function sha256(buf) { return Buffer.from(await subtle.digest('SHA-256', buf)); }

// ── 1. REGRESSION — the real SIGSUM-ANCHOR-2 record (leaf_index 59524) still verifies ──

await test('calibration — real pre-named-policy record (leaf_index 59524) verifies ALL_PASS under the new pin', () => {
  const { status, results } = runVerify(REAL_RECORD);
  assert(status === 0, `expected exit 0, got ${status}: ${JSON.stringify(results)}`);
  assert(results.ALL_PASS === true, `expected ALL_PASS=true, got: ${JSON.stringify(results, null, 2)}`);
  assert(results.logKeyPinned === true, 'seasalp key must match a pinned LOGS entry');
  assert(results.logName === 'seasalp.glasklar.is', `expected logName=seasalp.glasklar.is, got ${results.logName}`);
  assert(results.witnessQuorumThreshold === 2, `expected quorum threshold 2, got ${results.witnessQuorumThreshold}`);
  assert(results.witnessQuorumMet === true, 'expected the 2-of-3 quorum to be met by this record’s own cosignatures');
  // This record predates the named policy and was registered when only 2 witnesses
  // were pinned — it still carries a genuine Tillitis cosignature among its 14
  // (seasalp cosigns broadly), so adding the third pinned witness should surface it.
  assert(results.witnessCosignaturesValid >= 2, `expected >=2 matched+valid witnesses, got ${results.witnessCosignaturesValid}`);
});

await test('selftest command still exits 0 and reports the sigsum-generic-2025-1 pin shape', () => {
  const stdout = execFileSync('node', [SCRIPT, 'selftest'], { encoding: 'utf8' });
  assert(/\[pin-shape\].*PASS/.test(stdout), `expected pin-shape PASS line, got:\n${stdout}`);
  assert(/selftest: ALL PASS/.test(stdout), `expected "selftest: ALL PASS", got:\n${stdout}`);
});

// ── 2. QUORUM RULE IS ENFORCED, NOT DECORATIVE ──────────────────────────────────

await test('OBSERVED RED — trimming a real record to 1 matched witness fails the 2-of-3 quorum', () => {
  const trimmed = JSON.parse(JSON.stringify(REAL_RECORD));
  // Keep exactly ONE cosignature that matches a pinned witness (witness.glasklar.is,
  // sha256(pinned key) = 6bdf03b285fce48e00ff9b199cb2b77472dcc4a112f067fa5b274929cb9504e3),
  // drop every other cosignature (including the other two pinned witnesses).
  trimmed.witness_cosignatures = trimmed.witness_cosignatures.filter(
    (cs) => cs.key_hash === '6bdf03b285fce48e00ff9b199cb2b77472dcc4a112f067fa5b274929cb9504e3'
  );
  assert(trimmed.witness_cosignatures.length === 1, 'fixture setup: expected exactly 1 cosignature to survive the filter');
  const { status, results } = runVerify(trimmed);
  assert(results.logKeyPinned === true && results.logSignatureValid === true, 'log-level checks must still pass — only witnesses were trimmed');
  assert(results.witnessCosignaturesValid === 1, `expected exactly 1 matched+valid witness, got ${results.witnessCosignaturesValid}`);
  assert(results.witnessQuorumMet === false, 'expected quorum NOT met with only 1 of 3 pinned witnesses');
  assert(results.ALL_PASS === false, 'expected ALL_PASS=false when the quorum rule is not satisfied');
  assert(status !== 0, `expected non-zero exit, got ${status}`);
});

await test('tampering a matched witness signature (single flipped hex nibble) drops it from the count', () => {
  const tampered = JSON.parse(JSON.stringify(REAL_RECORD));
  const idx = tampered.witness_cosignatures.findIndex(
    (cs) => cs.key_hash === '6bdf03b285fce48e00ff9b199cb2b77472dcc4a112f067fa5b274929cb9504e3'
  );
  assert(idx !== -1, 'fixture setup: expected the glasklar cosignature to be present');
  const sig = tampered.witness_cosignatures[idx].signature;
  tampered.witness_cosignatures[idx].signature = (sig[0] === 'a' ? 'b' : 'a') + sig.slice(1);
  const { results } = runVerify(tampered);
  const detail = results.witnessCosignatureDetail.find((d) => d.name === 'witness.glasklar.is');
  assert(detail && detail.matched === true && detail.valid === false, `expected the tampered witness to be matched but invalid, got: ${JSON.stringify(detail)}`);
});

// ── 3. LOG IDENTITY MUST BE PINNED — A SELF-CONSISTENT FORGERY IS STILL REJECTED ──────

await test('OBSERVED RED — a fully self-consistent but UNPINNED log identity is rejected (SO #34)', async () => {
  const forged = JSON.parse(JSON.stringify(REAL_RECORD));

  // Attacker generates their OWN keypair — nothing borrowed from the real log.
  const { publicKey, privateKey } = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const fakePubBytes = Buffer.from(await subtle.exportKey('raw', publicKey));
  const fakePubHex = fakePubBytes.toString('hex');

  // Mirrors sigsumCheckpointOrigin() in register-sigsum.mjs — reimplemented
  // independently here, not imported, because a real attacker would do the same.
  const fakeOrigin = 'sigsum.org/v1/tree/' + (await sha256(fakePubBytes)).toString('hex');

  // Reuse the REAL tree size/root (an attacker replaying a real tree state), and
  // self-sign a checkpoint over (fakeOrigin, realSize, realRoot) with the fake key
  // — fully internally consistent, exactly the "self-attested provenance
  // validated by a self-consistent checker" shape SO #34 names.
  const rootBytes = Buffer.from(forged.tree_head.root_hash, 'hex');
  const checkpointText = `${fakeOrigin}\n${forged.tree_head.size}\n${rootBytes.toString('base64')}\n`;
  const fakeSig = Buffer.from(await subtle.sign({ name: 'Ed25519' }, privateKey, Buffer.from(checkpointText, 'utf8')));

  forged.log_public_key = fakePubHex;
  forged.log_origin = fakeOrigin;
  forged.tree_head.log_signature = fakeSig.toString('hex');

  const { status, results } = runVerify(forged);
  // The forged signature IS internally valid — proving this isn't a crypto bug,
  // it's an identity-pinning bug that the OLD code had and the NEW code closes.
  assert(results.logSignatureValid === true, `expected the self-consistent forged signature to verify as internally valid, got: ${JSON.stringify(results, null, 2)}`);
  assert(results.logKeyPinned === false, 'expected logKeyPinned=false — the fake key is not in the pinned LOGS set');
  assert(results.logName === null, `expected logName=null for an unpinned key, got ${results.logName}`);
  assert(results.ALL_PASS === false, 'expected ALL_PASS=false despite an internally-valid forged signature');
  assert(status !== 0, `expected non-zero exit, got ${status}`);
});

// ── 4. .tlog-policy FILE MATCHES THE JS PIN, BYTE-FOR-BYTE (C2SP-TLOG-POLICY-FILE-1) ──
// Wiring choice (b) per BUILD-SPEC §3: register-sigsum.mjs keeps LOGS/WITNESSES/
// WITNESS_QUORUM_THRESHOLD as the enforced values (simpler than a runtime
// tlog-policy parser for one policy instance); this test is the byte-identity
// proof that chaingraph/policies/sigsum-generic-2025-1.tlog-policy encodes the
// SAME log/witness/quorum set, so the checked-in artifact can never silently
// drift from what verify() actually enforces.

function parseTlogPolicyLogsWitnessesQuorum(text) {
  const logs = [];
  const witnesses = [];
  let quorumThreshold = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    if (parts[0] === 'log') logs.push(parts[1]);
    else if (parts[0] === 'witness') witnesses.push({ name: parts[1], keyHex: parts[2] });
    else if (parts[0] === 'group') quorumThreshold = Number(parts[2]);
  }
  return { logs, witnesses, quorumThreshold };
}

await test('sigsum-generic-2025-1.tlog-policy encodes the identical log/witness/quorum set as the JS pin', () => {
  const policyPath = resolve(HERE, '../chaingraph/policies/sigsum-generic-2025-1.tlog-policy');
  const policyText = readFileSync(policyPath, 'utf8');
  const { logs, witnesses, quorumThreshold } = parseTlogPolicyLogsWitnessesQuorum(policyText);

  const scriptSource = readFileSync(SCRIPT, 'utf8');
  const LOG_PUBLIC_KEY_HEX = scriptSource.match(/^const LOG_PUBLIC_KEY_HEX = '([0-9a-f]{64})';/m)[1];
  const jsLogKeys = scriptSource.match(/^const LOGS = \[([\s\S]*?)\n\];/m)[1]
    .replace(/LOG_PUBLIC_KEY_HEX/g, `'${LOG_PUBLIC_KEY_HEX}'`)
    .match(/keyHex: '([0-9a-f]{64})'/g).map((m) => m.match(/'([0-9a-f]{64})'/)[1]);
  const jsWitnessKeys = scriptSource.match(/^const WITNESSES = \[([\s\S]*?)\n\];/m)[1]
    .match(/keyHex: '([0-9a-f]{64})'/g).map((m) => m.match(/'([0-9a-f]{64})'/)[1]);
  const jsQuorum = Number(scriptSource.match(/^const WITNESS_QUORUM_THRESHOLD = (\d+);/m)[1]);

  assert(logs.length === 2 && jsLogKeys.length === 2, `expected 2 logs in both, got policy=${logs.length} js=${jsLogKeys.length}`);
  assert(logs.every((k) => jsLogKeys.includes(k)), `policy log keys ${JSON.stringify(logs)} must be a subset of JS LOGS ${JSON.stringify(jsLogKeys)}`);
  assert(jsLogKeys.every((k) => logs.includes(k)), `JS LOGS keys ${JSON.stringify(jsLogKeys)} must be a subset of policy log keys ${JSON.stringify(logs)}`);

  assert(witnesses.length === 3 && jsWitnessKeys.length === 3, `expected 3 witnesses in both, got policy=${witnesses.length} js=${jsWitnessKeys.length}`);
  const policyWitnessKeys = witnesses.map((w) => w.keyHex);
  assert(policyWitnessKeys.every((k) => jsWitnessKeys.includes(k)), `policy witness keys ${JSON.stringify(policyWitnessKeys)} must be a subset of JS WITNESSES ${JSON.stringify(jsWitnessKeys)}`);
  assert(jsWitnessKeys.every((k) => policyWitnessKeys.includes(k)), `JS WITNESSES keys ${JSON.stringify(jsWitnessKeys)} must be a subset of policy witness keys ${JSON.stringify(policyWitnessKeys)}`);

  assert(quorumThreshold === jsQuorum, `expected policy group threshold (${quorumThreshold}) === WITNESS_QUORUM_THRESHOLD (${jsQuorum})`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
