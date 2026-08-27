// kernel_digest_at_authoring: sha256:a8d8f41dc80af6482131e4333caca8533cb1f95a85979a3f51e7b6f45865f878
//
// FV-PROPFLOOR-SHARD-B6-1 — property-test floor for art-223-conforming-loan-limit.
// Class B (bounded-numeric), FLOAT-SENSITIVE (the tier comparison is a direct continuous
// loan_amount-vs-limit test, and county_limit_override lets a caller supply an arbitrary
// float boundary) — ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3.
// Zero external dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as
// B1-B5's float harnesses. This file is READ-ONLY with respect to the kernel it imports.
//
// ORACLE INDEPENDENCE (SO #34, and the reason this floor was rebuilt):
//   The previous version's P3 restated the kernel's own line `loan_amount > 0 &&
//   loan_amount <= applicable_limit` and read `applicable_limit` straight back out of the
//   output under test, so it could not disagree with the kernel about anything. P4 labelled
//   ten boundary cases and then asserted only that the result was finite, so two labels that
//   the kernel contradicted still passed. This version fixes both:
//     * the limit figures below are pinned from the publisher's own announcement, not read
//       from the kernel or from its output;
//     * P4 asserts each label's own claim, not plausibility;
//     * P5 carries one-directional taxonomy invariants that are consequences of the category
//       definition rather than restatements of the kernel's formula.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-223-conforming-loan-limit.proptest.mjs

import { compute } from '../art-223-conforming-loan-limit.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

// ── Independently pinned figures (FHFA Conforming Loan Limit Values for 2026,
//    announced 2025-11-25). Held here so the oracle does not read the limits it
//    validates out of the artifact under test.
const PINNED_2026_BASELINE = [832750, 1066250, 1288800, 1601750];
const PINNED_2026_CEILING  = [1249125, 1599375, 1933200, 2402625];
const UPLIFT_JURISDICTIONS = ['AK', 'HI', 'GU', 'VI'];
const PINNED_TABLE_YEAR = 2026;

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-223-conforming-loan-limit.fixtures.json');
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
const rand = mulberry32(0x2230A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 12000;

function mkPP(rng, overrides = {}) {
  return {
    loan_amount: randRange(rng, 0, 3000000),
    units: pick(rng, [1, 2, 3, 4]),
    state: pick(rng, ['TX', 'CA', 'AK', 'HI']),
    high_cost_county: rng() < 0.3,
    ...overrides,
  };
}

// ── The independent oracle. Re-derived from the pinned figures above and the Enterprise
//    category definition (a loan subject to the high-cost area limits is its own tier),
//    never from the kernel's reported limits.
function oracle(pp) {
  const supplied = pp.year !== undefined && pp.year !== null && pp.year !== '';
  const yr = supplied ? Number(pp.year) : PINNED_TABLE_YEAR;
  if (!Number.isFinite(yr) || Math.round(yr) !== PINNED_TABLE_YEAR) {
    return { classification: null, flag: 'LOOKUP_YEAR_UNAVAILABLE' };
  }
  const amt = Number(pp.loan_amount);
  if (!Number.isFinite(amt) || !(amt > 0)) {
    return { classification: null, flag: 'LOAN_AMOUNT_MISSING' };
  }
  const rawUnits = Number(pp.units);
  const units = Math.max(1, Math.min(4, Math.round(Number.isFinite(rawUnits) ? rawUnits : 1)));
  const base = PINNED_2026_BASELINE[units - 1];
  const ceiling = PINNED_2026_CEILING[units - 1];
  const st = String(pp.state || '').toUpperCase().trim();
  const uplifted = UPLIFT_JURISDICTIONS.includes(st);
  const areaBaseline = uplifted ? base * 1.5 : base;
  const rawOverride = Number(pp.county_limit_override);
  const override = Number.isFinite(rawOverride) ? rawOverride : 0;
  let applicable;
  if (override > 0) applicable = override;
  else if (Boolean(pp.high_cost_county) && !uplifted) applicable = ceiling;
  else applicable = areaBaseline;

  if (amt > applicable) return { classification: 'jumbo', flag: 'JUMBO_NON_CONFORMING' };
  if (amt > areaBaseline) return { classification: 'super_conforming', flag: null };
  return { classification: 'conforming', flag: null };
}

// ---------- P1: monotone — a higher loan_amount never turns a jumbo loan back into non-jumbo ----------
function checkP1_monotoneClassification() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const base = mkPP(rand);
    const lo = { ...base, loan_amount: Math.min(base.loan_amount, 500000) };
    const hi = { ...base, loan_amount: Math.max(lo.loan_amount + 1, 3000000) };
    const rLo = compute(lo);
    const rHi = compute(hi);
    checked++;
    if (rLo.output_payload.jumbo === true && rHi.output_payload.jumbo !== true) violations++;
  }
  return { name: 'P1_monotone_jumbo_never_reverts_to_nonjumbo_as_loan_amount_grows', trials: checked, violations };
}

// ---------- P2: the three tiers are a PARTITION — exactly one true, and a refused input has none ----------
function checkP2_partition() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { conforming, super_conforming, jumbo, classification } = r.output_payload;
    if (classification === null) {
      // Fail-closed: no verdict at all, never a partially-computed one.
      if (conforming !== null || super_conforming !== null || jumbo !== null) violations++;
      if (r.compliance_flags.length === 0) violations++;
      continue;
    }
    const trueCount = [conforming, super_conforming, jumbo].filter((b) => b === true).length;
    if (trueCount !== 1) violations++;
    const expectedClass = jumbo ? 'jumbo' : (super_conforming ? 'super_conforming' : 'conforming');
    if (classification !== expectedClass) violations++;
  }
  return { name: 'P2_exactly_one_tier_true_and_a_refused_input_has_no_tier', trials: checked, violations };
}

// ---------- P3: agreement with the independently-pinned FHFA table, not with the kernel's own line ----------
function checkP3_independentOracleAgreement() {
  let violations = 0, checked = 0;
  const samples = [];
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const want = oracle(pp);
    if (r.output_payload.classification !== want.classification) {
      violations++;
      if (samples.length < 3) samples.push({ pp, want: want.classification, got: r.output_payload.classification });
    }
  }
  return { name: 'P3_classification_matches_independently_pinned_fhfa_2026_table', trials: checked, violations, samples };
}

// ---------- P4 (mandatory): ULP-boundary forcing, each case asserting ITS OWN label ----------
// `expect` is the label's claim, restated as a machine-checkable value. FAIL_CLOSED means a
// null verdict plus the named flag. These figures come from the FHFA 2026 announcement and
// the Enterprise category definitions, not from running the kernel and recording what it said.
const ULP_BOUNDARY_CASES = [
  [{ loan_amount: 832750, units: 1, state: 'TX', high_cost_county: false }, '1-unit baseline exactly at the $832,750 boundary — must be conforming', 'conforming'],
  [{ loan_amount: 832750.01, units: 1, state: 'TX', high_cost_county: false }, '1-unit baseline 1 cent above the boundary in a baseline county — must be jumbo, because a baseline county has no above-baseline band', 'jumbo'],
  [{ loan_amount: 1000000, units: 1, state: 'TX', high_cost_county: true }, 'high-cost county, above the $832,750 baseline and below the $1,249,125 ceiling — must be super_conforming, not plain conforming', 'super_conforming'],
  [{ loan_amount: 1209750, units: 1, state: 'TX', high_cost_county: true }, 'high-cost county at the 2025 ceiling figure, still inside the 2026 band — must be super_conforming, not jumbo', 'super_conforming'],
  [{ loan_amount: 1249125, units: 1, state: 'TX', high_cost_county: true }, 'high-cost ceiling exactly at $1,249,125 — must be super_conforming under the inclusive upper bound, not jumbo', 'super_conforming'],
  [{ loan_amount: 1249125.01, units: 1, state: 'TX', high_cost_county: true }, 'high-cost ceiling 1 cent above — must be jumbo', 'jumbo'],
  [{ loan_amount: 0, units: 1, state: 'TX', high_cost_county: false }, 'loan_amount exactly zero — must not be conforming and must not classify at all', 'FAIL_CLOSED', 'LOAN_AMOUNT_MISSING'],
  [{ loan_amount: -1, units: 1, state: 'TX', high_cost_county: false }, 'negative loan_amount — must fail closed, never a computed tier', 'FAIL_CLOSED', 'LOAN_AMOUNT_MISSING'],
  [{ loan_amount: 700000, units: 1, state: 'TX', high_cost_county: false, year: 2027 }, 'year 2027 is not in the pinned table — must fail closed, never answered from the 2026 vintage', 'FAIL_CLOSED', 'LOOKUP_YEAR_UNAVAILABLE'],
  [{ loan_amount: 500000, county_limit_override: 500000, units: 1, state: 'TX', high_cost_county: false }, 'county_limit_override exactly equal to loan_amount — must be conforming', 'conforming'],
  [{ loan_amount: 500000.01, county_limit_override: 500000, units: 1, state: 'TX', high_cost_county: false }, 'loan_amount 1 cent above the override — must be jumbo', 'jumbo'],
  [{ loan_amount: 832750 * 0.1 * 3 / 0.3, units: 1, state: 'TX', high_cost_county: false }, 'loan_amount computed via a 0.1*3/0.3 rounding-artifact chain lands exactly on the baseline — must be conforming under the inclusive bound', 'conforming'],
  [{ loan_amount: 1601750, units: 4, state: 'TX', high_cost_county: false }, '4-unit baseline exactly at its own boundary ($1,601,750) — must be conforming', 'conforming'],
  [{ loan_amount: 1249125, units: 1, state: 'AK', high_cost_county: false }, 'AK carries the statutory uplift, so its 1-unit baseline IS $1,249,125 — a loan at exactly that figure is ordinary conforming, not super_conforming', 'conforming'],
  [{ loan_amount: 1300000, units: 1, state: 'AK', high_cost_county: false }, 'AK has no high-cost areas in 2026, so above its uplifted baseline is jumbo with no intervening band', 'jumbo'],
  [{ loan_amount: 832750, units: 1, state: 'AK', high_cost_county: false }, 'a contiguous-baseline-sized loan in AK sits well under the uplifted territory baseline — conforming', 'conforming'],
];

function checkP4_forced() {
  const rows = [];
  for (const [overrides, label, expect, expectFlag] of ULP_BOUNDARY_CASES) {
    const pp = mkPP(rand, overrides);
    const r = compute(pp);
    const op = r.output_payload;
    let pass;
    if (expect === 'FAIL_CLOSED') {
      pass = op.classification === null
          && op.conforming === null && op.super_conforming === null && op.jumbo === null
          && r.compliance_flags.includes(expectFlag);
    } else {
      pass = op.classification === expect
          && ['conforming', 'super_conforming', 'jumbo'].includes(op.classification)
          && Number.isFinite(op.applicable_limit);
    }
    rows.push({
      label,
      overrides,
      expect: expect === 'FAIL_CLOSED' ? 'FAIL_CLOSED:' + expectFlag : expect,
      classification: op.classification,
      applicable_limit: op.applicable_limit ?? null,
      flags: r.compliance_flags,
      pass,
    });
  }
  return rows;
}

// ---------- P5: taxonomy invariants — consequences of the category definition, not the formula ----------
function checkP5_taxonomyInvariants() {
  let violations = 0, checked = 0;
  const samples = [];
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    const op = r.output_payload;
    if (op.classification === null) continue;
    checked++;
    const units = Math.max(1, Math.min(4, Math.round(Number(pp.units) || 1)));
    const contiguousBaseline = PINNED_2026_BASELINE[units - 1];
    const uplifted = UPLIFT_JURISDICTIONS.includes(String(pp.state || '').toUpperCase().trim());

    // (i) At or below the contiguous baseline, no county designation can make a loan anything
    //     but ordinary conforming — the high-balance category starts ABOVE the area baseline.
    if (pp.loan_amount <= contiguousBaseline && op.classification !== 'conforming') {
      violations++;
      if (samples.length < 3) samples.push({ inv: 'i', pp, got: op.classification });
    }

    // (ii) The super-conforming category exists only where a high-cost area limit applies.
    //      In a plain baseline county with no caller override it can never fire. This is the
    //      invariant the pre-fix kernel broke: it set super_conforming AND jumbo together.
    if (op.classification === 'super_conforming' && !pp.high_cost_county && !uplifted && !(Number(pp.county_limit_override) > 0)) {
      violations++;
      if (samples.length < 3) samples.push({ inv: 'ii', pp, got: op.classification });
    }

    // (iii) super_conforming and jumbo are mutually exclusive claims about the same loan.
    if (op.super_conforming === true && op.jumbo === true) {
      violations++;
      if (samples.length < 3) samples.push({ inv: 'iii', pp, got: op.classification });
    }
  }
  return { name: 'P5_high_balance_tier_only_where_a_high_cost_limit_applies', trials: checked, violations, samples };
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneClassification());
results.properties.push(checkP2_partition());
results.properties.push(checkP3_independentOracleAgreement());
results.properties.push(checkP5_taxonomyInvariants());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryFailed = results.boundary_forced.some((b) => !b.pass);

console.log(JSON.stringify({
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryFailed,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryFailed ? 1 : 0);
