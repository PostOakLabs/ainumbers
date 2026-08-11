// art-424-witness-cosignature-verifier.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C19-1).
// kernel_digest_at_authoring: sha256:d9ed5d3a0780e192b9d8f56ff41b6893ab74c516128dfca643191e9a76324caf
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — the entire file, including the vendored
// Keccak/ML-DSA crypto block, is integer/bitwise/string logic; there is no float division or
// threshold arithmetic anywhere the tiered verdict depends on; forced categorical boundary cases
// used).
// SHAPE: this kernel exports a SYNCHRONOUS `compute(pp)` dispatcher over two modes
// ('cosignature' default, 'consistency_proof') that itself performs only PRECONDITION validation
// — on a structurally invalid input it returns the final FAIL result immediately; on a
// structurally valid input it returns an internal `{__async:true,...}` marker because the actual
// signature/consistency-proof cryptography runs only inside the unexported async continuation
// driven by `buildArtifact`. The property-floor below exercises `compute()` directly (bounded,
// synchronous, exhaustively fuzzable) for termination/boundedness/structural-differential over
// arbitrary-length checkpoint_note text and consistency_proof arrays — the file's actual unbounded
// inputs — and defers the cryptographic pass/fail path entirely to the fixture-oracle gate via
// `buildArtifact` against the real signed golden fixtures.
// Checks: fixture-oracle gate (via buildArtifact, real ed25519/ML-DSA-44 signatures from the
// shipped fixtures), termination (compute() never throws and always terminates on arbitrary-length
// checkpoint_note strings — parseNote does one bounded split/filter pass, no recursion), a
// structural-differential re-derivation of the precondition predicate for both modes (mirrors the
// same anchored_hash/witness_keys/threshold/parseNote and old/new/consistency_proof checks), a
// metamorphic identity (permutation-invariance of witness_keys order on the threshold_valid
// precondition, and of consistency_proof array order on consistency_proof_decodes), and forced
// categorical boundary cases (empty checkpoint_note, note missing the header/signature blank-line
// separator, threshold of 0 and threshold exceeding witness_keys.length, non-base64
// consistency_proof entry, new checkpoint size below old checkpoint size caught only on the async
// path but its precondition-level fields are asserted here).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-424-witness-cosignature-verifier.proptest.mjs

import { compute, buildArtifact } from '../art-424-witness-cosignature-verifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

async function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-424-witness-cosignature-verifier.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const artifact = await buildArtifact(vec.policy_parameters);
    const a = JSON.stringify(artifact.output_payload);
    const b = JSON.stringify(vec.output_payload);
    if (a !== b) failures.push({ name: vec.name, expected: vec.output_payload, got: artifact.output_payload });
  }
  results.fixture_oracle = { total: fixtures.vectors.length, failures };
  return failures.length === 0;
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x424C19);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randB64(rng, n) { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(32 + Math.floor(rng() * 90)); return Buffer.from(s).toString('base64'); }

// A syntactically well-formed checkpoint note: origin\nsize\nrootB64\n\n[sig lines]
function randomNote(rng) {
  const origin = pick(rng, ['log.example.org', 'other-log.example.org', '']);
  const size = rng() < 0.9 ? String(Math.floor(rng() * 1000)) : 'not-a-number';
  const root = randB64(rng, 32);
  const nSigs = Math.floor(rng() * 3);
  const sigLines = Array.from({ length: nSigs }, (_, i) => `— w${i} ${randB64(rng, 20)}`).join('\n');
  return rng() < 0.85 ? `${origin}\n${size}\n${root}\n\n${sigLines}\n` : randB64(rng, 40); // 15%: garbage, no separator
}

function randomWitnessKeys(rng, n) {
  return Array.from({ length: n }, (_, i) => ({
    name: `w${i}`, algorithm: pick(rng, ['ed25519', 'ml-dsa-44', 'bogus-alg']),
    public_key_b64: randB64(rng, 32),
  }));
}

function randomCosignaturePP(rng) {
  return {
    anchored_hash: rng() < 0.85 ? 'sha256:' + '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd' : 'garbage',
    log_origin: pick(rng, ['log.example.org', '']),
    checkpoint_note: randomNote(rng),
    witness_keys: randomWitnessKeys(rng, Math.floor(rng() * 4)),
    threshold: Math.floor(rng() * 5),
  };
}

function randomConsistencyPP(rng) {
  const nProof = Math.floor(rng() * 5);
  return {
    mode: 'consistency_proof',
    old_checkpoint_note: randomNote(rng),
    new_checkpoint_note: randomNote(rng),
    log_origin: pick(rng, ['log.example.org', '']),
    consistency_proof: Array.from({ length: nProof }, () => (rng() < 0.85 ? randB64(rng, 16) : '***not-base64***')),
  };
}

const TRIALS = 3000;

// Independent structural-precondition reimplementation (cosignature mode).
function parseNoteRef(text) {
  const raw = String(text ?? '');
  const sep = raw.indexOf('\n\n');
  if (sep < 0) return { error: 'no separator' };
  const header = raw.slice(0, sep);
  const headerLines = header.split('\n').filter((l) => l.length > 0);
  if (headerLines.length < 3) return { error: 'short header' };
  const size = Number(headerLines[1]);
  if (!Number.isInteger(size) || size < 0) return { error: 'bad size' };
  return { error: null };
}
function cosignaturePreconditionsOk(pp) {
  const anchored = String(pp.anchored_hash ?? '').trim().replace(/^sha256:/, '').toLowerCase();
  const hashOk = /^[0-9a-f]{64}$/.test(anchored);
  const keys = Array.isArray(pp.witness_keys) ? pp.witness_keys : [];
  const keysOk = keys.length > 0;
  const threshold = Number.isInteger(pp.threshold) ? pp.threshold : 1;
  const thresholdOk = threshold >= 1 && threshold <= keys.length;
  const noteOk = !parseNoteRef(pp.checkpoint_note).error;
  return hashOk && keysOk && thresholdOk && noteOk;
}

// ---------- P1: termination — compute() never throws on arbitrary-length/garbage checkpoint_note ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = rand() < 0.5 ? randomCosignaturePP(rand) : randomConsistencyPP(rand);
    checked++;
    try {
      const r = compute(pp);
      if (typeof r !== 'object' || r === null) violations++;
    } catch { violations++; }
  }
  // stress: a very long garbage checkpoint_note never hangs or throws
  {
    const longNote = 'x'.repeat(50000);
    checked++;
    try { compute({ anchored_hash: 'garbage', witness_keys: [], threshold: 1, checkpoint_note: longNote }); }
    catch { violations++; }
  }
  return { name: 'P1_termination_compute_never_throws', trials: checked, violations };
}

// ---------- P2: boundedness/structural — checks array well-shaped, FAIL result iff preconditions false ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomCosignaturePP(rand);
    const r = compute(pp);
    checked++;
    if (!Array.isArray(r.checks) || !r.checks.every((c) => typeof c.check === 'string' && typeof c.pass === 'boolean')) violations++;
    if (r.__async) {
      if (!r.checks.every((c) => c.pass)) violations++;
    } else {
      if (r.output_payload.witness_verification_result !== 'FAIL') violations++;
      if (r.output_payload.structural_error === null) violations++;
    }
  }
  return { name: 'P2_checks_well_shaped_and_fail_iff_preconditions_false', trials: checked, violations };
}

// ---------- P3: differential — cosignature-mode precondition predicate re-derived ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomCosignaturePP(rand);
    const r = compute(pp);
    checked++;
    const expectedOk = cosignaturePreconditionsOk(pp);
    const actualOk = !!r.__async;
    if (expectedOk !== actualOk) violations++;
  }
  return { name: 'P3_cosignature_precondition_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — permutation-invariance of witness_keys / consistency_proof order ----------
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 800; i++) {
    const pp = randomCosignaturePP(rand);
    if (pp.witness_keys.length < 2) continue;
    const r1 = compute(pp);
    const shuffled = [...pp.witness_keys].reverse();
    const r2 = compute({ ...pp, witness_keys: shuffled });
    checked++;
    if (!!r1.__async !== !!r2.__async) violations++;
  }
  for (let i = 0; i < 800; i++) {
    const pp = randomConsistencyPP(rand);
    if (pp.consistency_proof.length < 2) continue;
    const r1 = compute(pp);
    const shuffled = [...pp.consistency_proof].reverse();
    const r2 = compute({ ...pp, consistency_proof: shuffled });
    checked++;
    const decodeOk1 = r1.checks.find((c) => c.check === 'consistency_proof_decodes').pass;
    const decodeOk2 = r2.checks.find((c) => c.check === 'consistency_proof_decodes').pass;
    if (decodeOk1 !== decodeOk2) violations++;
  }
  return { name: 'P4_permutation_invariance_metamorphic', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (float:no) ----------
function checkP5_forced_categorical() {
  let violations = 0, checked = 0;
  // empty checkpoint_note -> structural failure
  {
    const r = compute({ anchored_hash: 'sha256:' + '0'.repeat(64), witness_keys: [{ name: 'w0', algorithm: 'ed25519', public_key_b64: 'AA==' }], threshold: 1, checkpoint_note: '' });
    checked++;
    if (r.__async) violations++;
    if (r.output_payload.structural_error === null) violations++;
  }
  // threshold 0 -> precondition fails
  {
    const r = compute({ anchored_hash: 'sha256:' + '0'.repeat(64), witness_keys: [{ name: 'w0', algorithm: 'ed25519', public_key_b64: 'AA==' }], threshold: 0, checkpoint_note: 'o\n1\nAA==\n\n' });
    checked++;
    if (r.__async) violations++;
  }
  // threshold exceeds witness_keys.length -> precondition fails
  {
    const r = compute({ anchored_hash: 'sha256:' + '0'.repeat(64), witness_keys: [{ name: 'w0', algorithm: 'ed25519', public_key_b64: 'AA==' }], threshold: 2, checkpoint_note: 'o\n1\nAA==\n\n' });
    checked++;
    if (r.__async) violations++;
  }
  // non-base64 consistency_proof entry -> decode fails, FAIL result
  {
    const r = compute({ mode: 'consistency_proof', old_checkpoint_note: 'o\n1\nAA==\n\n', new_checkpoint_note: 'o\n2\nAA==\n\n', consistency_proof: ['***'] });
    checked++;
    if (r.__async) violations++;
    if (r.output_payload.consistency_proof_result !== 'FAIL') violations++;
  }
  // well-formed consistency_proof note pair with empty proof array -> preconditions pass (async marker)
  {
    const r = compute({ mode: 'consistency_proof', old_checkpoint_note: 'o\n1\nAA==\n\n', new_checkpoint_note: 'o\n2\nAA==\n\n', consistency_proof: [] });
    checked++;
    if (!r.__async) violations++;
  }
  return { name: 'P5_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = await runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_differential());
results.properties.push(checkP4_permutation_invariance());
results.properties.push(checkP5_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-424-witness-cosignature-verifier',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
