// art-574-certified-payroll-prevailing-wage-recompute.proptest.mjs -- FV property-test FLOOR
// (FV-PROPFLOOR-SHARD-C29-1).
// kernel_digest_at_authoring: sha256:4da565b656d200c214becb712b820a097894e9edeae66b4275e34854847911c7
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md Sec3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES -- confirmed by direct source read (matches the WU row). `required_gross_minor
// _units = st_hours*base + ot_hours*base*1.5 + (st_hours+ot_hours)*fringe`, then `Math.round(...)`, is
// real IEEE-754 arithmetic (hours are declared as non-negative NUMBERS, not integers, per toHours()),
// and the PWA-mode interest calculation `Math.round(deficiency * (rate_percent/100) *
// (underpayment_days/365))` compounds two further float divisions. display() additionally rounds its
// fractional remainder (`Math.round(abs - whole*MINOR_SCALE)`), a variant of the C25-established
// Math.trunc(abs/100) float-sensitive shape. ULP-boundary forcing is applied around the hours*rate
// multiplication/rounding boundary and the interest-rate/365 division boundary.
// Checks: fixture-oracle gate, termination (bounded by payroll_rows.length/wage_determination.length,
// no unbounded loop), differential re-derivation of the required/paid gross and interest arithmetic,
// ULP-boundary forcing on the required-gross Math.round boundary (fractional hours, 0/-0 hours) and
// the correction-interest division, and a metamorphic permutation-invariance identity (reordering
// payroll_rows never changes total_deficiency_minor_units).
//
// Run: node chaingraph/kernels/__proptests__/art-574-certified-payroll-prevailing-wage-recompute.proptest.mjs

import { compute } from '../art-574-certified-payroll-prevailing-wage-recompute.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-574-certified-payroll-prevailing-wage-recompute.fixtures.json');
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
const rand = mulberry32(0x57400);

function randomWD(rng) {
  const n = 1 + Math.floor(rng() * 3);
  const wd = [];
  for (let i = 0; i < n; i++) wd.push({ classification: `CLASS-${i}`, base_rate_minor_units: 2000 + Math.floor(rng() * 3000), fringe_rate_minor_units: Math.floor(rng() * 1000) });
  return wd;
}

function randomPayroll(rng, classes) {
  const n = 1 + Math.floor(rng() * 4);
  const rows = [];
  for (let i = 0; i < n; i++) {
    rows.push({
      worker_id: `W${i}`,
      classification: classes[Math.floor(rng() * classes.length)],
      st_hours: Math.round(rng() * 40 * 4) / 4,
      ot_hours: Math.round(rng() * 10 * 4) / 4,
      rate_paid_minor_units: 1800 + Math.floor(rng() * 3500),
      fringe_paid_minor_units: Math.floor(rng() * 1200),
    });
  }
  return rows;
}

function randomPP(rng) {
  const wage_determination = randomWD(rng);
  const classes = wage_determination.map((w) => w.classification);
  return { project_ref: 'P1', week_ending_label: 'W1', currency: 'USD', pwa_mode: false, wage_determination, payroll_rows: randomPayroll(rng, classes) };
}

const TRIALS = 2500;

// ---------- P1: termination -- bounded by payroll_rows.length/wage_determination.length ----------
function checkP1_termination_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.payroll_rows.length !== pp.payroll_rows.length) violations++;
    if (output_payload.wage_determination.length !== pp.wage_determination.length) violations++;
  }
  return { name: 'P1_termination_bounded_by_row_counts', trials: checked, violations };
}

// ---------- P2 (differential): re-derive required/paid gross arithmetic ----------
function checkP2_gross_differential() {
  let violations = 0, checked = 0;
  const wdByClass = (wd) => Object.fromEntries(wd.map((w) => [w.classification, w]));
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const byClass = wdByClass(pp.wage_determination);
    for (let ri = 0; ri < pp.payroll_rows.length; ri++) {
      const r = pp.payroll_rows[ri];
      const wd = byClass[r.classification];
      if (!wd) continue;
      const expectedReq = Math.round(r.st_hours * wd.base_rate_minor_units + r.ot_hours * wd.base_rate_minor_units * 1.5 + (r.st_hours + r.ot_hours) * wd.fringe_rate_minor_units);
      const expectedPaid = Math.round(r.st_hours * r.rate_paid_minor_units + r.ot_hours * r.rate_paid_minor_units * 1.5 + (r.st_hours + r.ot_hours) * r.fringe_paid_minor_units);
      if (output_payload.payroll_rows[ri].required_gross_minor_units !== expectedReq) violations++;
      if (output_payload.payroll_rows[ri].paid_gross_minor_units !== expectedPaid) violations++;
      const expectedDeficiency = Math.max(expectedReq - expectedPaid, 0);
      if (output_payload.payroll_rows[ri].deficiency_minor_units !== expectedDeficiency) violations++;
    }
  }
  return { name: 'P2_required_paid_gross_differential', trials: checked, violations };
}

// ---------- P3: ULP-boundary forcing on the hours*rate Math.round boundary and interest division ----------
function checkP3_ulp_boundary_forcing() {
  let violations = 0, checked = 0;
  const hoursCases = [0, 0.25, 0.1, 1 / 3, 40, 39.75, -0];
  for (const st of hoursCases) {
    checked++;
    const pp = { project_ref: 'P', week_ending_label: 'W', currency: 'USD', pwa_mode: false, wage_determination: [{ classification: 'C1', base_rate_minor_units: 2500, fringe_rate_minor_units: 500 }], payroll_rows: [{ worker_id: 'W1', classification: 'C1', st_hours: Math.max(st, 0), ot_hours: 0, rate_paid_minor_units: 2500, fringe_paid_minor_units: 500 }] };
    const { output_payload } = compute(pp);
    const stHrs = Math.max(st, 0);
    const expected = Math.round(stHrs * 2500 + stHrs * 500);
    if (output_payload.payroll_rows[0].required_gross_minor_units !== expected) violations++;
  }
  // PWA-mode correction interest: exact rate/day boundaries.
  const interestCases = [
    { deficiency: 10000, rate: 9, days: 365 }, // exactly one year at 9% -> interest = deficiency*0.09
    { deficiency: 10000, rate: 9, days: 0 },   // zero days -> zero interest
    { deficiency: 1, rate: 9, days: 1 },        // smallest deficiency, smallest nonzero day count
    { deficiency: Number.MAX_SAFE_INTEGER, rate: 9, days: 30 },
  ];
  for (const c of interestCases) {
    checked++;
    const pp = {
      project_ref: 'P', week_ending_label: 'W', currency: 'USD', pwa_mode: true,
      irc_6621_underpayment_rate_percent: c.rate, underpayment_days: c.days,
      wage_determination: [{ classification: 'C1', base_rate_minor_units: 2500, fringe_rate_minor_units: 500 }],
      payroll_rows: [{ worker_id: 'W1', classification: 'C1', st_hours: 40, ot_hours: 0, rate_paid_minor_units: 0, fringe_paid_minor_units: 0 }],
    };
    const { output_payload } = compute(pp);
    const w = output_payload.pwa_result.worker_corrections[0];
    const expectedInterest = Math.round(w.deficiency_minor_units * (c.rate / 100) * (c.days / 365));
    if (w.interest_minor_units !== expectedInterest) violations++;
  }
  return { name: 'P3_ulp_boundary_forcing_hours_rate_and_interest', trials: checked, violations };
}

// ---------- P4: metamorphic -- reordering payroll_rows never changes total_deficiency_minor_units ----------
function checkP4_payroll_row_order_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 800; i++) {
    const pp = randomPP(rand);
    if (pp.payroll_rows.length < 2) continue;
    const shuffled = { ...pp, payroll_rows: [...pp.payroll_rows].sort(() => rand() - 0.5) };
    checked++;
    const r1 = compute(pp).output_payload;
    const r2 = compute(shuffled).output_payload;
    if (r1.total_deficiency_minor_units !== r2.total_deficiency_minor_units) violations++;
    if (r1.deficient_worker_count !== r2.deficient_worker_count) violations++;
  }
  return { name: 'P4_payroll_row_order_invariance', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_bounded());
results.properties.push(checkP2_gross_differential());
results.properties.push(checkP3_ulp_boundary_forcing());
results.properties.push(checkP4_payroll_row_order_invariance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-574-certified-payroll-prevailing-wage-recompute',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
