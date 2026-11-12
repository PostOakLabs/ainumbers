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
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
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

// ── 5. PENDING-RECORD RESUME — the never-re-stamp rule (SIGSUM-REGISTER-PENDING-RECORD-1) ──
// A 200/202 add-leaf means the leaf IS in the log; a run that then times out
// polling must leave a PUBLIC pending sidecar (<out>.pending.json, schema
// ain-sigsum-pending-v1) so a rerun RESUMES the poll instead of re-submitting
// the leaf (seasalp: 288 add-leaf per 24 h per domain suffix — a re-submit
// burns a budget entry and duplicates the leaf).
// Everything here is OFFLINE: a mock seasalp is injected as a `-r` preload
// that replaces global fetch, counts add-leaf calls into a state file, and
// answers get-inclusion-proof 404 (timeout mode) or 200 (include mode). The
// mock fails closed — with no state env it refuses to install, and unknown
// URLs get a 500 from the mock, never a pass-through to the real log.

const PENDING_SCHEMA = 'ain-sigsum-pending-v1';
const PENDING_KEYS = ['anchored_hash', 'checksum', 'leaf_hash', 'leaf_signature', 'log_url', 'public_key', 'schema', 'submitted_at'];
const HASH_MAIN = `sha256:${'aa'.repeat(32)}`;
const HASH_OTHER = `sha256:${'bb'.repeat(32)}`;

function writeMockSeasalp(dir) {
  const mockPath = join(dir, 'mock-seasalp.cjs');
  // Written to the test's own temp dir at runtime (not a fourth repo file) so
  // this row's diff stays inside its three-file fence.
  writeFileSync(mockPath, [
    "const fs = require('node:fs');",
    'const statePath = process.env.SIGSUM_TEST_MOCK_STATE;',
    "if (!statePath) throw new Error('mock-seasalp: SIGSUM_TEST_MOCK_STATE not set — refusing to install (fail closed, never pass through to real fetch)');",
    'globalThis.fetch = async (url, opts = {}) => {',
    '  const st = JSON.parse(fs.readFileSync(statePath, "utf8"));',
    '  const u = String(url);',
    '  const done = (status, text) => Promise.resolve(new Response(text, { status }));',
    "  if (u.endsWith('/add-leaf') && (opts.method || 'GET') === 'POST') {",
    '    st.addLeafCalls = (st.addLeafCalls || 0) + 1;',
    '    fs.writeFileSync(statePath, JSON.stringify(st));',
    "    return done(200, '');",
    '  }',
    "  if (u.endsWith('/get-tree-head')) {",
    "    return done(200, 'size=100\\nroot_hash=' + '11'.repeat(32) + '\\nsignature=' + '22'.repeat(64)",
    "      + '\\ncosignature=' + '33'.repeat(32) + ' 1234567890 ' + '44'.repeat(64) + '\\n');",
    '  }',
    '  if (/\\/get-inclusion-proof\\/\\d+\\/[0-9a-f]{64}$/.test(u)) {',
    "    if (st.mode === 'include') return done(200, 'leaf_index=42\\nnode_hash=' + '55'.repeat(32) + '\\nnode_hash=' + '66'.repeat(32) + '\\n');",
    "    return done(404, '');",
    '  }',
    "  return done(500, 'mock-seasalp: unexpected URL ' + u);",
    '};',
  ].join('\n'));
  return mockPath;
}

function genKey(dir, prefix) {
  execFileSync('node', [SCRIPT, 'keygen', '--out-prefix', join(dir, prefix)], { encoding: 'utf8', timeout: 30000 });
  return join(dir, `${prefix}.priv.jwk.json`);
}

// Drives register as a subprocess the way an operator would; the timeout
// (expectFailure) run asserts its own non-zero exit in the caller.
function runRegister({ mockPath, statePath, hash, keyPath, outPath, pollAttempts = '2' }) {
  const args = ['-r', mockPath, SCRIPT, 'register', '--hash', hash, '--out', outPath, '--poll-attempts', pollAttempts, '--poll-interval-ms', '1'];
  if (keyPath) args.push('--key', keyPath);
  try {
    const stdout = execFileSync('node', args, {
      encoding: 'utf8', timeout: 30000,
      env: { ...process.env, SIGSUM_TEST_MOCK_STATE: statePath },
    });
    return { status: 0, stdout, stderr: '' };
  } catch (e) {
    return { status: e.status, stdout: e.stdout ? e.stdout.toString() : '', stderr: e.stderr ? e.stderr.toString() : '' };
  }
}

function writeStalePending(pendingPath, hash) {
  writeFileSync(pendingPath, JSON.stringify({
    schema: PENDING_SCHEMA,
    anchored_hash: hash,
    log_url: 'https://seasalp.glasklar.is',
    checksum: 'cd'.repeat(32),
    leaf_signature: 'ef'.repeat(64),
    public_key: 'ab'.repeat(32),
    leaf_hash: '12'.repeat(32),
    submitted_at: '2026-11-01T00:00:00.000Z',
  }, null, 2));
}

// Proof-record shape check: same key sets at every level, same types, same
// string LENGTHS (all hex fields are fixed-width), pure-hex charset where the
// fixture field is pure hex — array element shape via the first element, since
// witness/path counts are log-state, not shape.
function assertShape(value, shape, at = 'record') {
  if (Array.isArray(shape)) {
    assert(Array.isArray(value), `${at}: expected array, got ${typeof value}`);
    assert(value.length >= 1, `${at}: expected a non-empty array`);
    assertShape(value[0], shape[0], `${at}[0]`);
  } else if (shape !== null && typeof shape === 'object') {
    assert(value !== null && typeof value === 'object' && !Array.isArray(value), `${at}: expected object, got ${typeof value}`);
    const gotKeys = Object.keys(value).sort();
    const wantKeys = Object.keys(shape).sort();
    assert(JSON.stringify(gotKeys) === JSON.stringify(wantKeys), `${at}: key set mismatch: got [${gotKeys}] want [${wantKeys}]`);
    for (const k of wantKeys) assertShape(value[k], shape[k], `${at}.${k}`);
  } else if (typeof shape === 'number') {
    assert(typeof value === 'number' && Number.isFinite(value), `${at}: expected a number, got ${typeof value}`);
  } else {
    assert(typeof value === 'string', `${at}: expected a string, got ${typeof value}`);
    assert(value.length === shape.length, `${at}: expected length ${shape.length}, got ${value.length} (${JSON.stringify(value).slice(0, 60)})`);
    if (/^[0-9a-f]+$/.test(shape)) assert(/^[0-9a-f]+$/.test(value), `${at}: expected pure lowercase hex`);
  }
}

await test('(a) pending-record flow — first run times out: sidecar holds public fields only, error says rerun-to-resume, rerun makes NO second add-leaf call', () => {
  const dir = mkdtempSync(join(tmpdir(), 'register-sigsum-pending-'));
  try {
    const mockPath = writeMockSeasalp(dir);
    const statePath = join(dir, 'state.json');
    const keyPath = genKey(dir, 'k');
    const outPath = join(dir, 'record.json');
    const pendingPath = `${outPath}.pending.json`;
    writeFileSync(statePath, JSON.stringify({ mode: 'timeout', addLeafCalls: 0 }));

    const first = runRegister({ mockPath, statePath, hash: HASH_MAIN, keyPath, outPath });
    assert(first.status !== 0, `timeout run must exit non-zero, got ${first.status}`);
    assert(first.stderr.includes('pending record kept; rerun the same command to resume (it will not re-submit)'), `timeout error must name the resume path, got: ${first.stderr}`);
    assert(!existsSync(outPath), 'no proof record may be written on a poll timeout');
    assert(existsSync(pendingPath), 'pending sidecar must exist after a poll timeout');
    const pending = JSON.parse(readFileSync(pendingPath, 'utf8'));
    assert(pending.schema === PENDING_SCHEMA, `sidecar schema must be ${PENDING_SCHEMA}`);
    assert(pending.anchored_hash === HASH_MAIN, 'sidecar anchored_hash must match the submitted --hash');
    assert(pending.log_url === 'https://seasalp.glasklar.is', 'sidecar log_url must name the log');
    assert(/^[0-9a-f]{64}$/.test(pending.checksum), 'sidecar checksum must be 64-hex');
    assert(/^[0-9a-f]{128}$/.test(pending.leaf_signature), 'sidecar leaf_signature must be 128-hex');
    assert(/^[0-9a-f]{64}$/.test(pending.public_key), 'sidecar public_key must be 64-hex');
    assert(/^[0-9a-f]{64}$/.test(pending.leaf_hash), 'sidecar leaf_hash must be 64-hex');
    assert(typeof pending.submitted_at === 'string' && !Number.isNaN(Date.parse(pending.submitted_at)), 'sidecar submitted_at must be an ISO stamp');
    assert(JSON.stringify(Object.keys(pending).sort()) === JSON.stringify(PENDING_KEYS), `sidecar must hold ONLY the public fields, got: [${Object.keys(pending).sort()}]`);
    // Never any private material: the keygen private JWK's `d` must not appear.
    const privJwk = JSON.parse(readFileSync(keyPath, 'utf8'));
    assert(!readFileSync(pendingPath, 'utf8').includes(privJwk.d), 'sidecar must never contain the private key scalar');

    // The rerun (same hash, mock now including) must skip add-leaf entirely.
    const state = JSON.parse(readFileSync(statePath, 'utf8'));
    writeFileSync(statePath, JSON.stringify({ ...state, mode: 'include' }));
    const rerun = runRegister({ mockPath, statePath, hash: HASH_MAIN, outPath }); // NO --key: resume needs none
    assert(rerun.status === 0, `rerun must exit 0, got ${rerun.status}: ${rerun.stderr}`);
    assert(rerun.stdout.includes('Resuming from'), `rerun must print that it is resuming, got: ${rerun.stdout}`);
    assert(JSON.parse(readFileSync(statePath, 'utf8')).addLeafCalls === 1, `rerun must NOT call add-leaf again (expected 1 total call, got ${JSON.parse(readFileSync(statePath, 'utf8')).addLeafCalls})`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

await test('(b) pending-record flow — the rerun completes: proof record written, pending file deleted', () => {
  const dir = mkdtempSync(join(tmpdir(), 'register-sigsum-pending-'));
  try {
    const mockPath = writeMockSeasalp(dir);
    const statePath = join(dir, 'state.json');
    const keyPath = genKey(dir, 'k');
    const outPath = join(dir, 'record.json');
    const pendingPath = `${outPath}.pending.json`;
    writeFileSync(statePath, JSON.stringify({ mode: 'timeout', addLeafCalls: 0 }));

    const first = runRegister({ mockPath, statePath, hash: HASH_MAIN, keyPath, outPath });
    assert(first.status !== 0 && existsSync(pendingPath), 'arc setup: first run must time out leaving a sidecar');

    const state = JSON.parse(readFileSync(statePath, 'utf8'));
    writeFileSync(statePath, JSON.stringify({ ...state, mode: 'include' }));
    const second = runRegister({ mockPath, statePath, hash: HASH_MAIN, outPath });
    assert(second.status === 0, `rerun must exit 0, got ${second.status}: ${second.stderr}`);
    assert(second.stdout.includes('Registered'), `rerun must print the Registered line, got: ${second.stdout}`);
    assert(existsSync(outPath), 'proof record must be written on completion');
    assert(!existsSync(pendingPath), 'pending sidecar must be deleted after successful sequencing');
    const record = JSON.parse(readFileSync(outPath, 'utf8'));
    assert(record.anchored_hash === HASH_MAIN, 'record anchored_hash');
    assert(record.tree_head.size === 100 && record.inclusion_proof.leaf_index === 42, 'record must carry the log answers (mock head size 100, leaf_index 42)');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

await test('(c) a pending file for a DIFFERENT anchored_hash is reported and ignored — fresh submit proceeds, stale file never resumed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'register-sigsum-pending-'));
  try {
    const mockPath = writeMockSeasalp(dir);
    const statePath = join(dir, 'state.json');
    const keyPath = genKey(dir, 'k');
    const outPath = join(dir, 'record.json');
    const pendingPath = `${outPath}.pending.json`;
    writeFileSync(statePath, JSON.stringify({ mode: 'include', addLeafCalls: 0 }));
    writeStalePending(pendingPath, HASH_OTHER); // same out path, other hash

    const run = runRegister({ mockPath, statePath, hash: HASH_MAIN, keyPath, outPath });
    assert(run.status === 0, `fresh submit with a stale sidecar must exit 0, got ${run.status}: ${run.stderr}`);
    assert(run.stdout.includes('different anchored_hash'), `run must report the ignored stale sidecar, got: ${run.stdout}`);
    assert(JSON.parse(readFileSync(statePath, 'utf8')).addLeafCalls === 1, `stale sidecar must not suppress the fresh add-leaf (expected exactly 1 call, got ${JSON.parse(readFileSync(statePath, 'utf8')).addLeafCalls})`);
    assert(existsSync(outPath), 'proof record written for the new hash');
    assert(JSON.parse(readFileSync(outPath, 'utf8')).anchored_hash === HASH_MAIN, 'record must carry the NEW hash, never the stale one');
    assert(!existsSync(pendingPath), 'the completed fresh submission takes over and cleans the sidecar slot');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

await test('(d) the produced proof record is shape-identical to the existing c2sp-tlog-proof-v1 fixture', () => {
  const dir = mkdtempSync(join(tmpdir(), 'register-sigsum-pending-'));
  try {
    const mockPath = writeMockSeasalp(dir);
    const statePath = join(dir, 'state.json');
    const keyPath = genKey(dir, 'k');
    const outPath = join(dir, 'record.json');
    writeFileSync(statePath, JSON.stringify({ mode: 'include', addLeafCalls: 0 }));

    const run = runRegister({ mockPath, statePath, hash: HASH_MAIN, keyPath, outPath });
    assert(run.status === 0, `register must exit 0, got ${run.status}: ${run.stderr}`);
    const record = JSON.parse(readFileSync(outPath, 'utf8'));
    assertShape(record, REAL_RECORD);
    assert(record.anchor_type === REAL_RECORD.anchor_type, 'anchor_type must stay c2sp-tlog-proof-v1');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

await test('(e) a matching but corrupt pending sidecar aborts WITHOUT re-submitting (never-re-stamp)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'register-sigsum-pending-'));
  try {
    const mockPath = writeMockSeasalp(dir);
    const statePath = join(dir, 'state.json');
    const keyPath = genKey(dir, 'k');
    const outPath = join(dir, 'record.json');
    const pendingPath = `${outPath}.pending.json`;
    writeFileSync(statePath, JSON.stringify({ mode: 'include', addLeafCalls: 0 }));
    writeFileSync(pendingPath, JSON.stringify({
      schema: PENDING_SCHEMA, anchored_hash: HASH_MAIN, log_url: 'https://seasalp.glasklar.is',
      checksum: 'zz', leaf_signature: '', public_key: '', leaf_hash: '',
      submitted_at: '2026-11-01T00:00:00.000Z',
    }));

    const run = runRegister({ mockPath, statePath, hash: HASH_MAIN, keyPath, outPath });
    assert(run.status !== 0, `corrupt matching sidecar must abort, got exit ${run.status}`);
    assert(run.stderr.includes('matches --hash but is unusable'), `error must name the unusable sidecar, got: ${run.stderr}`);
    assert(JSON.parse(readFileSync(statePath, 'utf8')).addLeafCalls === 0, `must NOT re-submit the leaf (expected 0 add-leaf calls, got ${JSON.parse(readFileSync(statePath, 'utf8')).addLeafCalls})`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
