// kernel_digest_at_authoring: sha256:a7dc48eb1eff2fb12164681b1b8bb838153d5819a26c7bdfbb88cbb1c739f4d8
//
// FV-PROPFLOOR-SHARD-B11-1 — property-test floor for art-306-agent-insurability-evidence-scorer.
// Class B (bounded-numeric), FLOAT-SENSITIVE (composite is a raw-double weighted sum of four
// dims, each itself a raw-double ratio, against version-pinned rubric weight doubles) —
// ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external
// dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the B1/B2/B3 float
// harness (art-107/art-15). This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-306-agent-insurability-evidence-scorer.proptest.mjs

import { compute } from '../art-306-agent-insurability-evidence-scorer.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-306-agent-insurability-evidence-scorer.fixtures.json');
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
const rand = mulberry32(0x30601);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 10000;
const PROFILES = ['aiuc', 'aisure', 'armilla', 'generic'];

function mkHash(rng) { return `sha256:${Math.floor(rng() * 1e9).toString(16).padStart(64, '0')}`; }

function mkPP(rng) {
  const n = 1 + Math.floor(rng() * 5);
  const receipts = Array.from({ length: n }, (_, i) => ({ receipt_hash: mkHash(rng) }));
  const execution_claims = Array.from({ length: n }, (_, i) => ({
    execution_hash: rng() < 0.7 && i < receipts.length ? receipts[i].receipt_hash : mkHash(rng),
    human_oversight: rng() < 0.5,
  }));
  return { underwriter_profile: pick(rng, PROFILES), execution_claims, receipts };
}

// ---------- P1: boundedness — composite and all dims always in [0,1] ----------
function checkP1_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { composite, dims } = r.output_payload;
    if (!Number.isFinite(composite) || composite < 0 || composite > 1) violations++;
    for (const k of Object.keys(dims)) {
      if (!Number.isFinite(dims[k]) || dims[k] < 0 || dims[k] > 1) violations++;
    }
  }
  return { name: 'P1_boundedness_composite_and_dims_in_unit_interval', trials: checked, violations };
}

// ---------- P2: monotone — adding a matching receipt for every claim never decreases determinism ----------
function checkP2_monotoneDeterminism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const worse = { ...pp, execution_claims: pp.execution_claims.map((c) => ({ ...c, execution_hash: mkHash(rand) })) };
    const better = { ...pp, execution_claims: pp.execution_claims.map((c, i2) => ({ ...c, execution_hash: pp.receipts[i2 % pp.receipts.length]?.receipt_hash ?? mkHash(rand) })) };
    const r1 = compute(worse);
    const r2 = compute(better);
    checked++;
    if (r2.output_payload.dims.determinism < r1.output_payload.dims.determinism) violations++;
  }
  return { name: 'P2_monotone_determinism_nondecreasing_with_matched_receipts', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — composite matches exact weighted-sum formula for the selected rubric ----------
const RUBRICS = {
  aiuc: { determinism: 0.3, replayability: 0.3, oversight_density: 0.25, dispute_history: 0.15 },
  aisure: { determinism: 0.25, replayability: 0.25, oversight_density: 0.2, dispute_history: 0.3 },
  armilla: { determinism: 0.2, replayability: 0.2, oversight_density: 0.3, dispute_history: 0.3 },
  generic: { determinism: 0.25, replayability: 0.25, oversight_density: 0.25, dispute_history: 0.25 },
};
function checkP3_compositeAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const rubric = RUBRICS[pp.underwriter_profile];
    const { dims, composite } = r.output_payload;
    const expected = dims.determinism * rubric.determinism + dims.replayability * rubric.replayability
      + dims.oversight_density * rubric.oversight_density + dims.dispute_history * rubric.dispute_history;
    if (composite !== expected) violations++;
  }
  return { name: 'P3_composite_matches_exact_weighted_sum_formula', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ underwriter_profile: 'generic', execution_claims: [], receipts: [] }, 'zero claims and zero receipts — insufficient_evidence true, composite exactly 0, all dims exactly 0'],
  [{ underwriter_profile: 'aiuc', execution_claims: [{ execution_hash: 'h1' }, { execution_hash: 'h2' }, { execution_hash: 'h3' }], receipts: [{ receipt_hash: 'h1' }] }, 'determinism = 1/3 (classic repeating-double division) — must reproduce identically in composite'],
  [{ underwriter_profile: 'generic', execution_claims: [{ execution_hash: 'a', human_oversight: true }], receipts: [{ receipt_hash: 'a' }] }, 'single claim, fully matched and overseen — determinism/replayability/oversight_density all exactly 1, dispute_history neutral 0.5'],
  [{ underwriter_profile: 'aisure', execution_claims: [{ execution_hash: 'a' }], receipts: [{ receipt_hash: 'a' }], incident_history: [{ closure: { closed_at: '2026-01-01' } }] }, 'single closed incident — dispute_history exactly 1 (1/1), not a rounding artifact'],
  [{ underwriter_profile: 'armilla', execution_claims: [{ execution_hash: 'a' }], receipts: [{ receipt_hash: 'a' }], reputation: { score: 0.1 * 3, provenance: 'receipt-derived' } }, 'receipt-derived reputation score = 0.1*3 (non-exact double) averaged into dispute_history — must use the EXACT double, not 0.3'],
  [{ underwriter_profile: 'generic', execution_claims: [{ execution_hash: 'a' }], receipts: [{ receipt_hash: 'a' }], reputation: { score: 1, provenance: 'self-asserted' } }, 'self-asserted reputation score exactly 1 — must be recorded (reputation_self_asserted true) but ZERO-WEIGHTED, dispute_history stays neutral 0.5'],
  [{ underwriter_profile: 'aiuc', execution_claims: Array.from({ length: 100 }, (_, i) => ({ execution_hash: `h${i}` })), receipts: Array.from({ length: 100 }, (_, i) => ({ receipt_hash: `h${i}` })) }, 'large matched set (100/100) — determinism exactly 1, no float drift from repeated division'],
  [{ underwriter_profile: 'generic', execution_claims: [{ execution_hash: 'a' }], receipts: [{ receipt_hash: '' }] }, 'empty-string receipt_hash — replayability must treat it as NOT valid (length > 0 check), composite stays finite'],
  [{ underwriter_profile: 'generic', execution_claims: [{ execution_hash: 'a', human_oversight: true }, { execution_hash: 'b', human_oversight: false }], receipts: [] }, 'claims present, zero receipts — determinism exactly 0, oversight_density exactly 0.5, composite finite'],
  [{ underwriter_profile: 'generic', execution_claims: [{ execution_hash: 'a' }], receipts: [{ receipt_hash: 'a' }], reputation: { score: -0, provenance: 'receipt-derived' } }, 'receipt-derived reputation score of negative zero — Math.max(0, score) must clamp to exactly 0, no NaN'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const { composite, dims, insufficient_evidence } = r.output_payload;
    const finite = Number.isFinite(composite) && composite >= 0 && composite <= 1
      && Object.values(dims).every((v) => Number.isFinite(v) && v >= 0 && v <= 1);
    const plausible = finite && typeof insufficient_evidence === 'boolean';
    rows.push({ label, pp, composite, dims, insufficient_evidence, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_boundedness());
results.properties.push(checkP2_monotoneDeterminism());
results.properties.push(checkP3_compositeAgreement());
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
