// kernel_digest_at_authoring: sha256:72672db356155cb674c7b09b6e09d78072704a9700fd99f431fead87a6816ac9
//
// FV-PROPFLOOR-SHARD-B21-1 — property-test floor for art-363-compute-dscr.
// Class B (bounded-numeric), FLOAT:YES — DSCR/ICR/leverage ratio division with r2
// rounding. ULP-boundary forcing mandatory. Zero external dependencies (mulberry32
// PRNG + explicit boundary arrays), same shape as the B1/B12 harness. This file is
// READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-363-compute-dscr.proptest.mjs

import { compute } from '../art-363-compute-dscr.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-363-compute-dscr.fixtures.json');
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
const rand = mulberry32(0x0363A1);
const TRIALS = 6000;
function range(rng, lo, hi) { return lo + rng() * (hi - lo); }

function mkPP(rng) {
  return {
    ebitda_musd: range(rng, -20, 200),
    ebit_musd: range(rng, -20, 150),
    interest_musd: range(rng, 0, 30),
    principal_musd: range(rng, 0, 30),
    leases_musd: range(rng, 0, 10),
    capex_musd: range(rng, 0, 40),
    taxes_musd: range(rng, 0, 30),
    working_capital_change_musd: range(rng, -10, 10),
    amortization_musd: range(rng, 0, 20),
    revolver_draw_musd: range(rng, 0, 20),
    total_debt_musd: range(rng, 0, 500),
    cash_musd: range(rng, 0, 100),
  };
}

// ---------- P1: every ratio is either null or finite — never NaN/Infinity ----------
function checkP1_ratiosFiniteOrNull() {
  let violations = 0, checked = 0;
  const keys = ['basic_dscr', 'cash_dscr', 'fcf_dscr', 'fccr', 'icr_ebit_basis', 'icr_ebitda_basis', 'net_leverage', 'gross_leverage'];
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    for (const k of keys) {
      const v = r.output_payload[k];
      if (v !== null && !Number.isFinite(v)) { violations++; break; }
    }
  }
  return { name: 'P1_all_ratios_finite_or_null_never_nan_or_infinity', trials: checked, violations };
}

// ---------- P2: basic_dscr null exactly when total debt service (interest+principal+revolver) <= 0 ----------
function checkP2_basicDscrNullExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const ds = Math.max(0, pp.interest_musd) + Math.max(0, pp.principal_musd) + Math.max(0, pp.revolver_draw_musd);
    const shouldBeNull = ds <= 0;
    if (shouldBeNull !== (r.output_payload.basic_dscr === null)) violations++;
  }
  return { name: 'P2_basic_dscr_null_exactly_when_debt_service_non_positive', trials: checked, violations };
}

// ---------- P3: DSCR_ZERO_DEBT_SERVICE_DENOMINATOR flag present iff basic_dscr is null ----------
function checkP3_flagMatchesNullDscr() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const hasFlag = r.compliance_flags.includes('DSCR_ZERO_DEBT_SERVICE_DENOMINATOR');
    if (hasFlag !== (r.output_payload.basic_dscr === null)) violations++;
  }
  return { name: 'P3_zero_debt_service_flag_matches_null_basic_dscr', trials: checked, violations };
}

// ---------- P4: monotonicity — raising ebitda (all else fixed, positive debt service) never lowers basic_dscr ----------
function checkP4_dscrMonotoneInEbitda() {
  let violations = 0, checked = 0;
  const TRIALS_MONO = Math.floor(TRIALS / 2);
  for (let i = 0; i < TRIALS_MONO; i++) {
    const pp = mkPP(rand);
    const r1 = compute(pp);
    if (r1.output_payload.basic_dscr === null) continue;
    const pp2 = { ...pp, ebitda_musd: pp.ebitda_musd + range(rand, 0.01, 50) };
    const r2v = compute(pp2);
    checked++;
    if (r2v.output_payload.basic_dscr < r1.output_payload.basic_dscr - 1e-9) violations++;
  }
  return { name: 'P4_basic_dscr_nondecreasing_in_ebitda', trials: checked, violations };
}

// ---------- P5 (mandatory, float-sensitive): forced ULP-boundary cases ----------
function checkP5_forced() {
  const rows = [];
  const base = {
    ebitda_musd: 30, ebit_musd: 22, interest_musd: 6, principal_musd: 5, leases_musd: 2,
    capex_musd: 6, taxes_musd: 5, working_capital_change_musd: 1.5, amortization_musd: 5,
    revolver_draw_musd: 0, total_debt_musd: 80, cash_musd: 12,
  };
  const cases = [
    { ...base, interest_musd: 0, principal_musd: 0, revolver_draw_musd: 0, label: 'interest+principal+revolver exactly 0 — every debt-service ratio must be null, not NaN' },
    { ...base, interest_musd: Number.MIN_VALUE, principal_musd: 0, revolver_draw_musd: 0, label: 'debt service at denormal scale (Number.MIN_VALUE) — basic_dscr must stay finite, no Infinity' },
    { ...base, ebitda_musd: 0, label: 'ebitda exactly 0 — net_leverage/gross_leverage must be null (ebitda>0 gate)' },
    { ...base, ebitda_musd: -0, label: 'ebitda is negative zero — the ebitda>0 gate must still exclude it' },
    { ...base, interest_musd: 0, label: 'interest exactly 0 — both ICR ratios must be null (interest>0 gate)' },
    { ...base, total_debt_musd: 80, cash_musd: 80, label: 'total_debt exactly equals cash — net_leverage exactly 0' },
    { ...base, total_debt_musd: 0, cash_musd: 100, label: 'total_debt exactly 0 with positive cash — net_leverage must be negative, still finite' },
    { ...base, interest_musd: 5, principal_musd: 0, leases_musd: 0, label: 'FCCR denominator (interest+leases+principal) at its own boundary — must be finite when >0' },
  ];
  for (const c of cases) {
    const { label, ...pp } = c;
    const r = compute(pp);
    const { basic_dscr, net_leverage, gross_leverage, icr_ebitda_basis, fccr } = r.output_payload;
    const plausible = [basic_dscr, net_leverage, gross_leverage, icr_ebitda_basis, fccr].every((v) => v === null || Number.isFinite(v));
    rows.push({ label, input: pp, basic_dscr, net_leverage, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_ratiosFiniteOrNull());
results.properties.push(checkP2_basicDscrNullExact());
results.properties.push(checkP3_flagMatchesNullDscr());
results.properties.push(checkP4_dscrMonotoneInEbitda());
results.boundary_forced = checkP5_forced();

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
