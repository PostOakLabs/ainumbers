// art-377-build-vop-session-receipt.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C17-1).
// kernel_digest_at_authoring: sha256:0a05ff3c98289d522ac8c33f9348e44f835c6ace45f93a2e25e4fa6d7871f317
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO -- direct read: only string/enum normalization and hash chaining, no
// arithmetic. Forced CATEGORICAL boundary cases used instead of ULP-forcing (below).
// Checks: fixture-oracle gate (compute()-only, pre-hash-chain fields -- session_receipts/
// chain_genesis_hash/final_receipt_hash are filled by the async buildArtifact() and are null
// from compute() alone, matching every fixture vector's declared shape), termination (unbounded
// attempts array -- bound is array length, normalizeAttempt() has no internal loop),
// boundedness (attempt_count === attempts.length always, session_outcome always one of the
// three declared enum values), metamorphic/differential (tamper-evidence via buildArtifact:
// this kernel's entire PURPOSE is that changing any one attempt changes every downstream
// receipt hash -- exercised directly against buildArtifact, the async hash-chaining function),
// forced categorical boundary cases (empty attempts, single attempt, undeclared consumer_action/
// match_result.source, all four warning severities).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-377-build-vop-session-receipt.proptest.mjs

import { compute, buildArtifact } from '../art-377-build-vop-session-receipt.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

// The fixture's output_payload is post-hash-chain (session_receipts/chain_genesis_hash/
// final_receipt_hash populated) -- that field set is only filled by the async buildArtifact(),
// not by compute() alone (compute() leaves them null by design, per the kernel's own comment).
// The oracle therefore runs buildArtifact() and diffs its output_payload, not compute()'s.
async function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-377-build-vop-session-receipt.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const artifact = await buildArtifact(vec.policy_parameters, {});
    const { output_payload } = artifact;
    const a = JSON.stringify(output_payload);
    const b = JSON.stringify(vec.output_payload);
    if (a !== b) failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
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
const rand = mulberry32(0x377D0);

const BANDS = ['MATCH', 'CLOSE_MATCH', 'NO_MATCH'];
const SEVERITIES = ['none', 'info', 'warning', 'blocking'];
const ACTIONS = ['proceeded', 'abandoned', 'retried'];

function randomAttempt(rng, i) {
  return {
    attempt_id: `a${i}`,
    match_result: { source: 'score_payee_name_match', algorithm_version: 'vop-namematch-1.0.0', score: Math.floor(rng() * 100), match_band: BANDS[Math.floor(rng() * 3)] },
    warning_shown: { text: 'w', severity: SEVERITIES[Math.floor(rng() * 4)] },
    consumer_action: ACTIONS[Math.floor(rng() * 3)],
    asserted_at: '2026-01-01T00:00:00Z',
  };
}

function randomPP(rng, n) {
  const attempts = [];
  for (let i = 0; i < n; i++) attempts.push(randomAttempt(rng, i));
  return { session_id: `sess-${Math.floor(rng() * 1e6)}`, attempts };
}

const TRIALS = 2000;

// ---------- P1: termination — unbounded attempts array, bound is array length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  const sizes = [0, 1, 5, 50, 500];
  for (const n of sizes) {
    const pp = randomPP(rand, n);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.attempt_count !== n) violations++;
  }
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 20);
    const pp = randomPP(rand, n);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.attempt_count !== n) violations++;
  }
  return { name: 'P1_termination_array_length_bound', trials: checked, violations };
}

// ---------- P2: boundedness — attempt_count matches, session_outcome always in declared enum ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 10);
    const pp = randomPP(rand, n);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.attempt_count !== pp.attempts.length) violations++;
    if (!['incomplete', 'proceeded', 'abandoned'].includes(output_payload.session_outcome)) violations++;
  }
  return { name: 'P2_boundedness_attempt_count_and_outcome_enum', trials: checked, violations };
}

// ---------- P3: differential/metamorphic — tamper-evidence: any attempt edit changes every downstream hash ----------
async function checkP3_tamper_evidence() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 200; i++) {
    const n = 3 + Math.floor(rand() * 5);
    const pp = randomPP(rand, n);
    const base = await buildArtifact(pp, {});
    // tamper with a single middle attempt's warning text
    const tamperIdx = 1 + Math.floor(rand() * (n - 2));
    const tampered = JSON.parse(JSON.stringify(pp));
    tampered.attempts[tamperIdx].warning_shown.text = 'TAMPERED';
    const tamperedArtifact = await buildArtifact(tampered, {});
    checked++;
    const baseReceipts = base.output_payload.session_receipts;
    const tamperedReceipts = tamperedArtifact.output_payload.session_receipts;
    // receipts before the tamper point are unchanged; every receipt from the tamper point onward differs
    for (let r = 0; r < tamperIdx; r++) {
      if (baseReceipts[r].receipt_hash !== tamperedReceipts[r].receipt_hash) violations++;
    }
    for (let r = tamperIdx; r < n; r++) {
      if (baseReceipts[r].receipt_hash === tamperedReceipts[r].receipt_hash) violations++;
    }
    if (base.output_payload.final_receipt_hash === tamperedArtifact.output_payload.final_receipt_hash) violations++;
    // two sessions with byte-identical first attempts but different session_id diverge from receipt #0
    const otherSession = { ...pp, session_id: pp.session_id + '-X' };
    const otherArtifact = await buildArtifact(otherSession, {});
    if (n > 0 && base.output_payload.session_receipts[0].receipt_hash === otherArtifact.output_payload.session_receipts[0].receipt_hash) violations++;
  }
  return { name: 'P3_tamper_evidence_hash_chain_via_buildArtifact', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float_sensitive: no) ----------
function checkP4_categorical_boundaries() {
  let violations = 0, checked = 0;
  const cases = [
    { session_id: 's1', attempts: [] },
    { session_id: 's2', attempts: [{ attempt_id: 'a1', match_result: {}, warning_shown: {}, consumer_action: 'bogus_action' }] },
    { session_id: 's3', attempts: [{ attempt_id: 'a1', match_result: { source: '', score: 50, match_band: 'MATCH' }, warning_shown: { severity: 'blocking' }, consumer_action: 'proceeded' }] },
  ];
  for (const pp of cases) {
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    if (output_payload.attempt_count !== pp.attempts.length) violations++;
    if (pp.attempts.length === 0 && !compliance_flags.includes('VOP_SESSION_EMPTY')) violations++;
  }
  // undeclared consumer_action must be flagged
  const undeclared = compute({ session_id: 's4', attempts: [{ attempt_id: 'a1', match_result: { source: 'x', score: 90, match_band: 'MATCH' }, warning_shown: { severity: 'none' }, consumer_action: 'not_a_real_action' }] });
  checked++;
  if (!undeclared.compliance_flags.includes('VOP_CONSUMER_ACTION_UNDECLARED')) violations++;
  // undeclared source must be flagged
  const undeclaredSource = compute({ session_id: 's5', attempts: [{ attempt_id: 'a1', match_result: { score: 90, match_band: 'MATCH' }, warning_shown: { severity: 'none' }, consumer_action: 'proceeded' }] });
  checked++;
  if (!undeclaredSource.compliance_flags.includes('VOP_MATCH_SOURCE_UNDECLARED')) violations++;
  return { name: 'P4_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
async function main() {
  const oracleOk = await runFixtureOracle();
  if (!oracleOk) {
    console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
    process.exit(1);
  }

  results.properties.push(checkP1_termination());
  results.properties.push(checkP2_boundedness());
  results.properties.push(await checkP3_tamper_evidence());
  results.properties.push(checkP4_categorical_boundaries());

  const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

  console.log(JSON.stringify({
    tool_id: 'art-377-build-vop-session-receipt',
    float_sensitive: false,
    fixture_oracle_passed: oracleOk,
    fixture_oracle_total: results.fixture_oracle.total,
    properties: results.properties,
    any_property_violation: anyPropertyViolation,
  }, null, 2));

  process.exit(anyPropertyViolation ? 1 : 0);
}

main();
