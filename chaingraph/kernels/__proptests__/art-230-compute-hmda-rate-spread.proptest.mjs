// kernel_digest_at_authoring: sha256:bf8ab4e43a576fd89244c8f1a43a0adb3c8ae4fb433d163a90773584efe86b9b
//
// FV-PROPFLOOR-SHARD-B7-1 — property-test floor for art-230-compute-hmda-rate-spread.
// Class B (bounded-numeric), FLOAT-SENSITIVE (apr_pct - apor_pct subtraction through r3
// rounding, compared against fixed 1.5/3.5/6.5pp thresholds via >=) — ULP-boundary forcing
// is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32
// PRNG + explicit boundary arrays). Read-only w.r.t. the kernel.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-230-compute-hmda-rate-spread.proptest.mjs

import { compute } from '../art-230-compute-hmda-rate-spread.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-230-compute-hmda-rate-spread.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = compute(vec.policy_parameters);
    if (!deepEqual(output_payload, vec.output_payload)) failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
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
const rand = mulberry32(0x23001);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 10000;

function mkPP(rng) {
  return {
    apr_pct: randRange(rng, 0.01, 40),
    apor_pct: randRange(rng, 0.01, 15),
    lien_type: pick(rng, ['first', 'subordinate']),
    product_type: pick(rng, ['closed_end', 'heloc']),
    lock_date: '2026-01-01',
  };
}

// ---------- P1: round-trip identity — rate_spread_pct === r3(apr_pct - apor_pct) exactly ----------
function checkP1_rateSpreadRoundTrip() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    const expected = Math.round((pp.apr_pct - pp.apor_pct) * 1e3) / 1e3;
    if (r.rate_spread_pct !== expected) violations++;
  }
  return { name: 'P1_rate_spread_equals_r3_of_apr_minus_apor', trials: checked, violations };
}

// ---------- P2: fixed-threshold-tier agreement — is_reportable iff rate_spread_pct >= reportability_threshold_pct exactly ----------
function checkP2_reportabilityAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(mkPP(rand)).output_payload;
    checked++;
    if (r.is_reportable !== (r.rate_spread_pct >= r.reportability_threshold_pct)) violations++;
  }
  return { name: 'P2_is_reportable_matches_rate_spread_ge_threshold', trials: checked, violations };
}

// ---------- P3: fixed-tier agreement — threshold selection matches lien_type/product_type rules ----------
function checkP3_thresholdSelectionAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    let expected;
    if (pp.product_type === 'heloc' && pp.lien_type === 'first') expected = 6.5;
    else if (pp.lien_type === 'subordinate') expected = 3.5;
    else expected = 1.5;
    if (r.reportability_threshold_pct !== expected) violations++;
  }
  return { name: 'P3_threshold_selection_matches_lien_and_product_rules', trials: checked, violations };
}

// ---------- P4: monotonicity — is_reportable never flips from true to false as apr_pct increases (rest fixed) ----------
function checkP4_reportableMonotoneInApr() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const base = mkPP(rand);
    const lo = { ...base, apr_pct: base.apor_pct + 1 };
    const hi = { ...base, apr_pct: base.apor_pct + 10 };
    const rLo = compute(lo).output_payload.is_reportable;
    const rHi = compute(hi).output_payload.is_reportable;
    checked++;
    if (rLo && !rHi) violations++;
  }
  return { name: 'P4_is_reportable_monotone_nondecreasing_in_apr', trials: checked, violations };
}

// ---------- P5 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ apr_pct: 8.0, apor_pct: 6.5, lien_type: 'first', product_type: 'closed_end' }, 'rate_spread exactly 1.5 (first-lien threshold) — is_reportable must be true (boundary is >=)'],
  [{ apr_pct: 7.999999999999999, apor_pct: 6.5, lien_type: 'first', product_type: 'closed_end' }, 'rate_spread 1-ULP-below-1.5 — is_reportable must be false'],
  [{ apr_pct: 10.0, apor_pct: 6.5, lien_type: 'subordinate', product_type: 'closed_end' }, 'rate_spread exactly 3.5 (subordinate threshold) — is_reportable must be true'],
  [{ apr_pct: 13.0, apor_pct: 6.5, lien_type: 'first', product_type: 'heloc' }, 'rate_spread exactly 6.5 (HELOC first-lien threshold) — is_reportable must be true'],
  [{ apr_pct: 0, apor_pct: 0 }, 'apr_pct and apor_pct both exactly zero — guard branch returns rate_spread_pct 0, hmda_report_code NA'],
  [{ apr_pct: 6.5 + 0.1 * 3 - 0.3, apor_pct: 5.0 }, 'apr_pct built from (0.1*3-0.3) rounding-noise offset — rate_spread_pct must be the r3()-rounded EXACT double difference'],
  [{ apr_pct: -0, apor_pct: 0 }, 'apr_pct negative zero, apor_pct zero — must hit the (apr==0 && apor==0) guard branch, not fall through'],
];

function checkP5_forced() {
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = { apr_pct: 8, apor_pct: 6, lien_type: 'first', product_type: 'closed_end', lock_date: '2026-01-01', ...overrides };
    const r = compute(pp).output_payload;
    const finite = Number.isFinite(r.rate_spread_pct) && typeof r.is_reportable === 'boolean';
    rows.push({ label, overrides, rate_spread_pct: r.rate_spread_pct, is_reportable: r.is_reportable, hmda_report_code: r.hmda_report_code, finite, plausible: finite });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_rateSpreadRoundTrip());
results.properties.push(checkP2_reportabilityAgreement());
results.properties.push(checkP3_thresholdSelectionAgreement());
results.properties.push(checkP4_reportableMonotoneInApr());
results.boundary_forced = checkP5_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
}, null, 2));

if (anyPropertyViolation || anyBoundaryImplausible) {
  console.error('PROPERTY FLOOR FAILED for art-230-compute-hmda-rate-spread');
  process.exit(1);
}
console.log('PASS art-230-compute-hmda-rate-spread');
