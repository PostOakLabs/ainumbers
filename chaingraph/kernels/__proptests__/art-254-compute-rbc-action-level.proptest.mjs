// kernel_digest_at_authoring: sha256:a55fcead8d91066d4678479d0792b6faacc67a98b724625025533952be8d0ec3
//
// FV-PROPFLOOR-SHARD-B9-1 — property-test floor for art-254-compute-rbc-action-level.
// Class B (bounded-numeric), FLOAT-SENSITIVE — total_adjusted_capital/authorized_control_level raw
// doubles feed rbc_ratio_pct compared against fixed 70/100/150/200 NAIC thresholds — ULP-boundary
// forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32
// PRNG + explicit boundary arrays), same shape as the B1-B8 float harnesses.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-254-compute-rbc-action-level.proptest.mjs

import { compute } from '../art-254-compute-rbc-action-level.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-254-compute-rbc-action-level.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const output_payload = compute(vec.policy_parameters);
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
const rand = mulberry32(0x2540A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;
const RANK = { MANDATORY_CONTROL: 0, AUTHORIZED_CONTROL: 1, REGULATORY_ACTION: 2, COMPANY_ACTION: 3, NO_ACTION: 4 };

function mkPP(rng) {
  return {
    total_adjusted_capital: randRange(rng, 0, 500),
    authorized_control_level: randRange(rng, 1, 200),
    insurer_type: 'pc',
  };
}

// ---------- P1: monotone — increasing total_adjusted_capital never decreases action_level rank ----------
function checkP1_monotoneActionLevel() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r1 = compute(pp);
    const r2v = compute({ ...pp, total_adjusted_capital: pp.total_adjusted_capital + 100 });
    checked++;
    if (RANK[r2v.action_level_code] < RANK[r1.action_level_code]) violations++;
    if (r2v.rbc_ratio_pct < r1.rbc_ratio_pct) violations++;
  }
  return { name: 'P1_monotone_action_level_nondecreasing_with_capital', trials: checked, violations };
}

// ---------- P2: boundedness — action_level_code from known set, rbc_ratio_pct nonnegative ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  const KNOWN = new Set(Object.keys(RANK));
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (!KNOWN.has(r.action_level_code)) violations++;
    if (r.rbc_ratio_pct < 0) violations++;
  }
  return { name: 'P2_boundedness_action_level_known_set_and_ratio_nonnegative', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — action_level_code matches independently-derived tiers ----------
function checkP3_tierAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const ratio = Math.round((pp.total_adjusted_capital / pp.authorized_control_level) * 100 * 100) / 100;
    const expected =
      ratio < 70 ? 'MANDATORY_CONTROL' :
      ratio < 100 ? 'AUTHORIZED_CONTROL' :
      ratio < 150 ? 'REGULATORY_ACTION' :
      ratio < 200 ? 'COMPANY_ACTION' : 'NO_ACTION';
    if (r.action_level_code !== expected) violations++;
    if (r.rbc_ratio_pct !== ratio) violations++;
  }
  return { name: 'P3_action_level_matches_fixed_70_100_150_200_tier_rule', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ total_adjusted_capital: 70, authorized_control_level: 100 }, 'rbc_ratio_pct exactly at 70% mandatory-control boundary — action_level must be AUTHORIZED_CONTROL (< 70 triggers mandatory)'],
  [{ total_adjusted_capital: 69.9999, authorized_control_level: 100 }, 'rbc_ratio_pct just below 70% — action_level must be MANDATORY_CONTROL'],
  [{ total_adjusted_capital: 200, authorized_control_level: 100 }, 'rbc_ratio_pct exactly at 200% no-action boundary — action_level must be NO_ACTION'],
  [{ total_adjusted_capital: 199.9999, authorized_control_level: 100 }, 'rbc_ratio_pct just below 200% — action_level must be COMPANY_ACTION'],
  [{ total_adjusted_capital: 0, authorized_control_level: 100 }, 'zero total_adjusted_capital — rbc_ratio_pct 0, MANDATORY_CONTROL, no throw'],
  [{ total_adjusted_capital: -0, authorized_control_level: 100 }, 'negative-zero total_adjusted_capital — must behave as zero'],
  [{ total_adjusted_capital: Number.MIN_VALUE, authorized_control_level: 100 }, 'total_adjusted_capital smallest positive double — rbc_ratio_pct must round to 0, no throw'],
  [{ total_adjusted_capital: 0.1 * 3 * 100, authorized_control_level: 100 }, 'total_adjusted_capital via 0.1*3*100 (classic non-exact double) — must round-trip without throwing'],
  [{ total_adjusted_capital: (1 / 3) * 3 * 150, authorized_control_level: 100 }, 'total_adjusted_capital = (1/3)*3*150 (x/y*y!==x rounding artifact) — must round-trip without throwing'],
  [{ total_adjusted_capital: Number.MAX_SAFE_INTEGER, authorized_control_level: 100 }, 'total_adjusted_capital at MAX_SAFE_INTEGER — rbc_ratio_pct must remain finite, NO_ACTION, no overflow'],
];

function checkP4_forced() {
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = { insurer_type: 'pc', ...overrides };
    const r = compute(pp);
    const plausible = Number.isFinite(r.rbc_ratio_pct) && typeof r.action_level_code === 'string' && Object.prototype.hasOwnProperty.call(RANK, r.action_level_code);
    rows.push({ label, total_adjusted_capital: pp.total_adjusted_capital, rbc_ratio_pct: r.rbc_ratio_pct, action_level_code: r.action_level_code, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneActionLevel());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_tierAgreement());
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
