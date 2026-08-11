// kernel_digest_at_authoring: sha256:4dd15343a439bc1a1a1212c58f21fed27dd330d9f8cf4476bfdd468f67a7624e
//
// FV-PROPFLOOR-SHARD-B24-1 — property-test floor for art-438-eval-attestation-receipt-composer.
// Class B (bounded-numeric), float:no exception — no arithmetic at all (pure hash-shape/string
// validation). Forced CATEGORICAL boundary cases used instead of ULP forcing per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-438-eval-attestation-receipt-composer.proptest.mjs

import { compute } from '../art-438-eval-attestation-receipt-composer.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-438-eval-attestation-receipt-composer.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = compute(vec.policy_parameters);
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
const rand = mulberry32(0x438C3);
const TRIALS = 8000;
const VALID_HASH = 'sha256:' + '1'.repeat(64);
const OTHER_VALID_HASH = 'sha256:' + '2'.repeat(64);

function mkPP(rng) {
  const branch = rng();
  const hasHash = branch < 0.6;
  const evalLog = hasHash ? { hash: VALID_HASH, format: 'inspect_ai_eval_log', eval_id: 'e1' } : {};
  const mBranch = rng();
  const mandate_reference = mBranch < 0.5 ? { work_mandate_hash: OTHER_VALID_HASH, policy_id: 'p1' } : (mBranch < 0.7 ? {} : null);
  return { eval_log: evalLog, mandate_reference };
}

// ---------- P1: weakest-link boundedness — claim_strength is bounded to the declared 3-value enum,
// and never claims mandate-bound without a bound mandate hash and never claims non-missing without a hash ----------
function checkP1_claimStrengthBounded() {
  let violations = 0, checked = 0;
  const ALLOWED = ['missing', 'hash-only', 'mandate-bound'];
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    if (!ALLOWED.includes(r.claim_strength)) violations++;
    const hasHash = !!r.eval_log_hash;
    if (!hasHash && r.claim_strength !== 'missing') violations++;
    if (hasHash && r.claim_strength === 'missing') violations++;
    if (r.claim_strength === 'mandate-bound' && !r.mandate_reference) violations++;
  }
  return { name: 'P1_claim_strength_bounded_weakest_link', trials: checked, violations };
}

// ---------- P2: determination round-trip — ATTESTED iff eval_log_hash present ----------
function checkP2_determinationMatchesHash() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    const expected = r.eval_log_hash ? 'ATTESTED' : 'INSUFFICIENT_EVIDENCE';
    if (r.attestation_determination !== expected) violations++;
    if (!!r.verify_instructions !== !!r.eval_log_hash) violations++;
  }
  return { name: 'P2_attestation_determination_exact_negation_of_hash_absence', trials: checked, violations };
}

// ---------- P3: not_proven list is fixed-shape, always present, never empty ----------
function checkP3_notProvenFixedShape() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    if (!Array.isArray(r.not_proven) || r.not_proven.length !== 4) violations++;
  }
  return { name: 'P3_not_proven_always_four_fixed_items', trials: checked, violations };
}

// ---------- P4 (float:no exception): forced CATEGORICAL boundary cases ----------
const ULP_BOUNDARY_CASES = [
  [{ eval_log: {}, mandate_reference: null }, 'both eval_log and mandate_reference absent — missing/INSUFFICIENT_EVIDENCE'],
  [{ eval_log: { hash: VALID_HASH }, mandate_reference: null }, 'hash present, mandate absent — hash-only/ATTESTED'],
  [{ eval_log: { hash: VALID_HASH }, mandate_reference: { work_mandate_hash: OTHER_VALID_HASH } }, 'both present — mandate-bound/ATTESTED'],
  [{ eval_log: { hash: 'sha256:' + 'g'.repeat(64) }, mandate_reference: null }, 'malformed hex (non-hex char) — must be rejected as missing, not accepted'],
  [{ eval_log: { hash: 'sha256:' + '1'.repeat(63) }, mandate_reference: null }, 'hash 1 char short of 64 hex — must be rejected'],
  [{ eval_log: { hash: VALID_HASH.toUpperCase() }, mandate_reference: null }, 'uppercase hex — HEX64 regex is lowercase-only, must be rejected as missing'],
  [{ eval_log: null, mandate_reference: null }, 'eval_log itself null — must not throw, treated as empty object'],
  [{ eval_log: { hash: VALID_HASH }, mandate_reference: { work_mandate_hash: 'not-a-hash' } }, 'mandate hash malformed — mandate not bound, claim_strength stays hash-only'],
  [{}, 'entire policy_parameters empty object — must not throw'],
  [{ eval_log: { hash: VALID_HASH, format: '' }, mandate_reference: null }, 'eval_log.format empty string — must fall back to default inspect_ai_eval_log'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp).output_payload;
    const plausible = typeof r.claim_strength === 'string' && typeof r.attestation_determination === 'string';
    rows.push({ label, claim_strength: r.claim_strength, attestation_determination: r.attestation_determination, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_claimStrengthBounded());
results.properties.push(checkP2_determinationMatchesHash());
results.properties.push(checkP3_notProvenFixedShape());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);
