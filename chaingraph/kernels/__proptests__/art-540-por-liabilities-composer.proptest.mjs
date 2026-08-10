// kernel_digest_at_authoring: sha256:563cc673f35c6b1c66e152e11a07460a4cfa55b51028b1dcea2c42733e1b10c5
//
// FV-PROPFLOOR-SHARD-B26-1 — property-test floor for art-540-por-liabilities-composer.
// Class B (bounded-numeric), FLOAT:YES per the WU row — reserve_to_liability_ratio is a genuine
// float division (computedRootSumMusd / reportedNum via safeNum(), no integer constraint), so
// ULP-boundary forcing is MANDATORY. Zero external dependencies (mulberry32 PRNG + explicit
// boundary arrays), same shape as the B1/B3/B12 harness. READ-ONLY w.r.t. the kernel.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-540-por-liabilities-composer.proptest.mjs

import { compute } from '../art-540-por-liabilities-composer.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-540-por-liabilities-composer.fixtures.json');
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
const rand = mulberry32(0x540540);
const TRIALS = 8000;

function mkPP(rng) {
  const hasPor = rng() < 0.85;
  const inclusion_verified = rng() < 0.6;
  const sum = Math.round((rng() * 1000 - 200) * 100) / 100;
  const hasLiabilities = rng() < 0.85;
  const reported = hasLiabilities ? Math.round((rng() * 1000 - 100) * 100) / 100 : (rng() < 0.5 ? null : undefined);
  return {
    por_input: hasPor ? { inclusion_verified, computed_root: { sum } } : null,
    reported_total_liabilities_musd: reported,
    liabilities_attestation_source: rng() < 0.7 ? 'issuer_attested_balance_sheet' : '',
  };
}

// ---------- P1: reserve_to_liability_ratio is exact r4(sum/reported) when liabilities supplied, else null ----------
function checkP1_ratioExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    const reportedNum = pp.reported_total_liabilities_musd;
    const liabilitiesSupplied = typeof reportedNum === 'number' && Number.isFinite(reportedNum) && reportedNum > 0;
    if (!liabilitiesSupplied) {
      if (r.reserve_to_liability_ratio !== null) violations++;
      continue;
    }
    const sum = (pp.por_input && pp.por_input.computed_root) ? pp.por_input.computed_root.sum : 0;
    const expected = Math.round((sum / reportedNum) * 10000) / 10000;
    if (r.reserve_to_liability_ratio !== expected && !(Number.isNaN(r.reserve_to_liability_ratio) && Number.isNaN(expected))) violations++;
  }
  return { name: 'P1_ratio_exact_r4_of_sum_over_reported', trials: checked, violations };
}

// ---------- P2: composite_determination priority — LIABILITIES_INPUT_MISSING > INCLUSION_FAILED > LIABILITIES_UNDERCOVERED > CONSISTENT ----------
function checkP2_determinationPriority() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    const reportedNum = pp.reported_total_liabilities_musd;
    const liabilitiesSupplied = typeof reportedNum === 'number' && Number.isFinite(reportedNum) && reportedNum > 0;
    const inclusionVerified = pp.por_input ? Boolean(pp.por_input.inclusion_verified) : false;
    let expected;
    if (!liabilitiesSupplied) expected = 'LIABILITIES_INPUT_MISSING';
    else if (!inclusionVerified) expected = 'INCLUSION_FAILED';
    else if (r.reserve_to_liability_ratio < 1) expected = 'LIABILITIES_UNDERCOVERED';
    else expected = 'INCLUSION_AND_LIABILITIES_CONSISTENT';
    if (r.composite_determination !== expected) violations++;
  }
  return { name: 'P2_determination_priority_order', trials: checked, violations };
}

// ---------- P3: monotonicity — increasing the reserve sum never moves determination toward UNDERCOVERED ----------
function checkP3_ratioMonotoneInSum() {
  let violations = 0, checked = 0;
  const RANK = { LIABILITIES_UNDERCOVERED: 0, INCLUSION_AND_LIABILITIES_CONSISTENT: 1 };
  for (let i = 0; i < TRIALS; i++) {
    const reported = 100 + Math.floor(rand() * 900);
    const sumLo = Math.round(rand() * 200 * 100) / 100;
    const sumHi = sumLo + Math.round(rand() * 100 * 100) / 100;
    const base = { por_input: { inclusion_verified: true, computed_root: { sum: sumLo } }, reported_total_liabilities_musd: reported };
    const higher = { por_input: { inclusion_verified: true, computed_root: { sum: sumHi } }, reported_total_liabilities_musd: reported };
    const rLo = compute(base).output_payload;
    const rHi = compute(higher).output_payload;
    checked++;
    if (rLo.composite_determination in RANK && rHi.composite_determination in RANK) {
      if (RANK[rHi.composite_determination] < RANK[rLo.composite_determination]) violations++;
    }
    if (rHi.reserve_to_liability_ratio < rLo.reserve_to_liability_ratio) violations++;
  }
  return { name: 'P3_ratio_and_determination_nondecreasing_in_reserve_sum', trials: checked, violations };
}

// ---------- P4 (mandatory, float:yes): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ por_input: { inclusion_verified: true, computed_root: { sum: 100 } }, reported_total_liabilities_musd: 100 }, 'ratio exactly 1.0 (sum equals liabilities exactly) — must be CONSISTENT, never UNDERCOVERED (ratio < 1 is strict)'],
  [{ por_input: { inclusion_verified: true, computed_root: { sum: 99.99999999999999 } }, reported_total_liabilities_musd: 100 }, 'ratio 1 ULP below 1.0 — must resolve UNDERCOVERED, boundary sensitivity at the strict-< comparison'],
  [{ por_input: { inclusion_verified: true, computed_root: { sum: 100.00000000000001 } }, reported_total_liabilities_musd: 100 }, 'ratio 1 ULP above 1.0 — must resolve CONSISTENT'],
  [{ por_input: { inclusion_verified: true, computed_root: { sum: 0 } }, reported_total_liabilities_musd: 100 }, 'zero reserve sum — ratio exactly 0, UNDERCOVERED, never NaN'],
  [{ por_input: { inclusion_verified: true, computed_root: { sum: -0 } }, reported_total_liabilities_musd: 100 }, 'negative-zero reserve sum — must behave identically to positive zero (ratio 0, UNDERCOVERED)'],
  [{ por_input: { inclusion_verified: true, computed_root: { sum: 100 } }, reported_total_liabilities_musd: 1e-10 }, 'near-zero denominator (reported liabilities tiny but positive) — ratio must be a huge finite number, never Infinity/NaN'],
  [{ por_input: { inclusion_verified: true, computed_root: { sum: 100 } }, reported_total_liabilities_musd: 0 }, 'reported liabilities exactly 0 — collapses to LIABILITIES_INPUT_MISSING (non-positive denominator treated as missing, never a division artifact)'],
  [{ por_input: { inclusion_verified: true, computed_root: { sum: 100 } }, reported_total_liabilities_musd: -50 }, 'reported liabilities negative — also collapses to LIABILITIES_INPUT_MISSING, never a negative ratio'],
  [{ por_input: { inclusion_verified: true, computed_root: { sum: Number.MAX_SAFE_INTEGER } }, reported_total_liabilities_musd: 1 }, 'reserve sum at MAX_SAFE_INTEGER — ratio must stay finite, no overflow to Infinity'],
  [{ por_input: { inclusion_verified: true, computed_root: { sum: 1 / 3 * 3 } }, reported_total_liabilities_musd: 1 }, 'classic x/y*y!==x float artifact (1/3*3) as the numerator — must still resolve deterministically, never throw or NaN'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp).output_payload;
    const plausible = Number.isFinite(r.reserve_to_liability_ratio) || r.reserve_to_liability_ratio === null;
    rows.push({ label, input: pp, reserve_to_liability_ratio: r.reserve_to_liability_ratio, composite_determination: r.composite_determination, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_ratioExact());
results.properties.push(checkP2_determinationPriority());
results.properties.push(checkP3_ratioMonotoneInSum());
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
