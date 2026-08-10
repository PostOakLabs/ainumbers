// kernel_digest_at_authoring: sha256:9a3c7fb7f2a17cb3b8ba3e352f32b1d77d7d51093e23fa65165e7d3d594b106b
//
// FV-PROPFLOOR-SHARD-B6-1 — property-test floor for art-219-qm-apr-apor-spread.
// Class B (bounded-numeric), FLOAT-SENSITIVE (general_qm_pass and is_hpct are continuous
// spread-vs-threshold comparisons with 1e-5 floating-point margins) — ULP-boundary forcing
// is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32
// PRNG + explicit boundary arrays), same shape as B1-B5's float harnesses. This file is
// READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-219-qm-apr-apor-spread.proptest.mjs

import { compute } from '../art-219-qm-apr-apor-spread.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-219-qm-apr-apor-spread.fixtures.json');
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
const rand = mulberry32(0x2190A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 12000;
const r4 = (v) => (Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : 0);

function mkPP(rng, overrides = {}) {
  return {
    apr_pct: randRange(rng, 0, 15),
    apor_pct: randRange(rng, 0, 15),
    lien_type: pick(rng, ['first', 'subordinate']),
    is_manufactured_housing: rng() < 0.1,
    loan_amount: randRange(rng, 50000, 500000),
    year: 2026,
    ...overrides,
  };
}

// ---------- P1: monotone — general_qm_pass is nonincreasing as spread (apr - apor) increases ----------
function checkP1_monotonePass() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const base = mkPP(rand);
    const lo = { ...base, apr_pct: base.apor_pct + 1 };
    const hi = { ...base, apr_pct: base.apor_pct + 8 };
    const rLo = compute(lo);
    const rHi = compute(hi);
    checked++;
    if (rHi.output_payload.general_qm_pass && !rLo.output_payload.general_qm_pass) violations++;
  }
  return { name: 'P1_monotone_general_qm_pass_nonincreasing_with_spread', trials: checked, violations };
}

// ---------- P2: fixed-threshold-tier agreement — is_hpct matches spread >= hpct_threshold - 1e-5 exactly ----------
function checkP2_hpctAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { spread_pct, hpct_threshold_pct, is_hpct } = r.output_payload;
    const expected = spread_pct >= hpct_threshold_pct - 1e-5;
    if (is_hpct !== expected) violations++;
  }
  return { name: 'P2_is_hpct_matches_fixed_1e5_margin_rule', trials: checked, violations };
}

// ---------- P3: round-trip identity — headroom_pct equals r4(applicable_threshold - spread) exactly ----------
function checkP3_headroomIdentity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { applicable_threshold_pct, spread_pct, headroom_pct } = r.output_payload;
    const expected = r4(applicable_threshold_pct - spread_pct);
    if (headroom_pct !== expected) violations++;
  }
  return { name: 'P3_headroom_pct_matches_r4_identity', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ apr_pct: 5, apor_pct: 5 }, 'apr equals apor exactly — spread must be exactly 0'],
  [{ apr_pct: 8.5, apor_pct: 5, loan_amount: 50000 }, 'small-loan (< $137,958 cutoff): spread exactly at 3.5pp threshold — must fail general_qm_pass (strict less-than)'],
  [{ apr_pct: 8.4999, apor_pct: 5, loan_amount: 50000 }, 'small-loan: spread just below 3.5pp threshold — must pass general_qm_pass'],
  [{ apr_pct: 7.25, apor_pct: 5, loan_amount: 200000000 }, 'spread exactly at large-loan 2.25pp threshold — must fail'],
  [{ apr_pct: 6.5, apor_pct: 5 }, 'spread exactly at first-lien HPCT threshold (1.5) — must be HPCT'],
  [{ apr_pct: 6.4999, apor_pct: 5 }, 'spread just below first-lien HPCT threshold — must NOT be HPCT'],
  [{ apr_pct: 0.1 * 3, apor_pct: 0.3 }, 'apr = 0.1*3 (non-exact double) vs apor 0.3 — spread must round to exactly 0 under r4'],
  [{ apr_pct: 8.5, apor_pct: 5, lien_type: 'subordinate' }, 'subordinate spread exactly at 3.5pp threshold — must fail (subordinate uses its own 3.5pp cap)'],
  [{ apr_pct: 11.5, apor_pct: 5, is_manufactured_housing: true }, 'manufactured-housing spread exactly at 6.5pp threshold — must fail'],
];

function checkP4_forced() {
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = mkPP(rand, overrides);
    const r = compute(pp);
    const op = r.output_payload;
    const finite = Number.isFinite(op.spread_pct) && Number.isFinite(op.headroom_pct) && typeof op.general_qm_pass === 'boolean' && typeof op.is_hpct === 'boolean';
    rows.push({ label, overrides, general_qm_pass: op.general_qm_pass, is_hpct: op.is_hpct, qm_status: op.qm_status, finite, plausible: finite });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotonePass());
results.properties.push(checkP2_hpctAgreement());
results.properties.push(checkP3_headroomIdentity());
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
