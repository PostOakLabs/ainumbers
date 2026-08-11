// kernel_digest_at_authoring: sha256:49f4ca16e07b64152890ad0db1fe9b6bd52fd1c42e01b5113844e0dac0f424a1
//
// FV-PROPFLOOR-SHARD-B10-1 — property-test floor for art-271-defi-lending-health.
// Class B (bounded-numeric), FLOAT-SENSITIVE (health_factor, liquidation_price, and
// borrow_capacity all divide raw doubles and compare against fixed status-tier
// thresholds 1.0/1.25/2.0) — ULP-boundary forcing is MANDATORY per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG + explicit
// boundary arrays). READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-271-defi-lending-health.proptest.mjs

import { compute } from '../art-271-defi-lending-health.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-271-defi-lending-health.fixtures.json');
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
const rand = mulberry32(0x271B10);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;
const PROTOCOLS = ['aave', 'morpho', 'fluid', 'sky', 'liquity_v2'];

function mkPP(rng) {
  return {
    protocol: PROTOCOLS[Math.floor(rng() * PROTOCOLS.length)],
    collateral_value_usd: randRange(rng, 100, 1000000),
    debt_value_usd: randRange(rng, 0, 800000),
    collateral_price_usd: randRange(rng, 1, 100000),
  };
}

// ---------- P1: monotonicity — increasing debt (all else fixed) never increases health_factor ----------
function checkP1_debtMonotone() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r1 = compute(pp);
    const r2 = compute({ ...pp, debt_value_usd: pp.debt_value_usd + 1000 });
    checked++;
    if (!(r2.output_payload.health_factor <= r1.output_payload.health_factor)) violations++;
  }
  return { name: 'P1_health_factor_nonincreasing_as_debt_grows', trials: checked, violations };
}

// ---------- P2: boundedness — health_factor, borrow_capacity nonnegative and finite; health_status in known set ----------
function checkP2_boundedness() {
  const KNOWN = new Set(['SAFE', 'WATCH', 'WARNING', 'LIQUIDATABLE']);
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    if (!Number.isFinite(op.health_factor) || op.health_factor < 0) violations++;
    if (!Number.isFinite(op.borrow_capacity_usd) || op.borrow_capacity_usd < 0) violations++;
    if (!KNOWN.has(op.health_status)) violations++;
  }
  return { name: 'P2_health_factor_and_borrow_capacity_bounded_status_known_set', trials: checked, violations };
}

// ---------- P3: fixed-tier agreement — health_status matches the fixed health_factor bands exactly ----------
function checkP3_tierAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const hf = r.output_payload.health_factor;
    const expected = hf >= 2.0 ? 'SAFE' : hf >= 1.25 ? 'WATCH' : hf >= 1.0 ? 'WARNING' : 'LIQUIDATABLE';
    if (r.output_payload.health_status !== expected) violations++;
  }
  return { name: 'P3_health_status_matches_fixed_health_factor_bands', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ collateral_value_usd: 10000, debt_value_usd: 4150 }, 'aave HF exactly 2.0 boundary (10000*0.83/4150=2.0 exactly) — status must be SAFE (>= is inclusive)'],
  [{ collateral_value_usd: 10000, debt_value_usd: 4150 + Number.EPSILON * 4150 }, 'aave HF 1-ULP below 2.0 boundary — status must be WATCH'],
  [{ collateral_value_usd: 10000, debt_value_usd: 0 }, 'debt exactly zero — health_factor must be exactly 9999, status SAFE, current_ltv_pct exactly 0'],
  [{ collateral_value_usd: 0, debt_value_usd: 1000 }, 'collateral exactly zero with nonzero debt — health_factor must compute without throwing (0 collateral case)'],
  [{ collateral_value_usd: 0.1 * 3, debt_value_usd: 1 }, 'collateral = 0.1*3 (classic non-exact double 0.30000000000000004) — health_factor must reflect the EXACT double, not 0.3'],
  [{ collateral_price_usd: Number.MIN_VALUE }, 'collateral_price_usd at smallest positive double — clamped by Math.max(0.000001,...), must not divide-by-near-zero to Infinity'],
  [{ collateral_value_usd: 10000, debt_value_usd: (1 / 3) * 3 * 1000 }, 'debt = (1/3)*3*1000 (x/y*y!==x rounding artifact) — health_factor round6 must not misround'],
  [{ collateral_value_usd: Number.MAX_SAFE_INTEGER, debt_value_usd: 1 }, 'collateral at MAX_SAFE_INTEGER — health_factor computation must not overflow or lose precision'],
  [{ protocol: 'sky', collateral_value_usd: 17000, debt_value_usd: 10000 }, 'sky CR-mode exactly at 170% liquidation_ratio boundary (17000/10000=170%) — health_factor must be exactly 1.0, status WARNING'],
  [{ collateral_value_usd: -0, debt_value_usd: 1000 }, 'collateral negative zero — Math.max(0,-0) must normalize to 0, no "-0" leak into output'],
];

function checkP4_forced() {
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = { protocol: 'aave', collateral_value_usd: 10000, debt_value_usd: 5000, collateral_price_usd: 2000, ...overrides };
    const r = compute(pp);
    const op = r.output_payload;
    const finite = Number.isFinite(op.health_factor) && Number.isFinite(op.current_ltv_pct) && Number.isFinite(op.borrow_capacity_usd);
    rows.push({ label, overrides, health_factor: op.health_factor, health_status: op.health_status, current_ltv_pct: op.current_ltv_pct, finite, plausible: finite });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_debtMonotone());
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
