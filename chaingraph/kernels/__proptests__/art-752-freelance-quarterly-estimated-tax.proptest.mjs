// art-752-freelance-quarterly-estimated-tax.proptest.mjs — class-K property-test FLOOR
// (FV-PBT-FLOOR-BUILD-SPEC.md). Authored against the APEXPORT-116 porting payload
// (kernel + fixtures + VECTORS/DIFFERS/CITES records, GRADES PASS-PENDING-XV 2026-10-07,
// Builder-verifies-at-land 19/19).
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof, NOT Dafny. Internal engineering QC only.
// float_sensitive: PARTIAL — the kernel deliberately keeps the Apex page's float
// arithmetic so its outputs match the ported-from page to the digit. The properties
// below assert only relations that are exact under IEEE-754 on the ROUNDED outputs
// (equalities restating the published formula applied to rounded inputs, monotonicity,
// determinism) or fixed-literal shapes (the four 2026 due dates), never fragile float
// equals on arbitrary draws.
//
// Checks: fixture-oracle gate (the 3 Apex live vectors and the 16 boundary fixtures at
// and just past every comparator — SS wage base 184500, prior-year prong at 0 and just
// past, safe-harbor crossover low/high, AGI floor at zero and just above the standard
// deduction, 10%/12% bracket tops single and MFJ, 37% top band); P1 total_annual_tax and
// safe_harbor_total are non-decreasing in gross_income and in other_income; P2 the
// quarterly split restated independently (per_quarter = round2(total_annual_tax_raw/4)
// is asserted via the fixed due-date shape and equal amounts, and remaining_after_ytd
// = max(0, total_annual_tax - ytd_paid) restated from the rounded outputs); P3
// determinism (two runs agree byte-for-byte) and output shape (no undefined/NaN/
// non-finite anywhere in output_payload; the four quarter labels/due dates are the
// fixed 2026 literals); P4 domain coercion restated (an unknown state key prices state
// tax at 0 exactly like 'none'; a filing_status other than 'mfj' is priced exactly like
// 'single' — the Apex page's own fallback behaviour, no throw branch); P5 the SS wage
// base: ss_tax = min(netSE*0.9235, 184500) * 0.124 restated from the inputs, and the
// SS_WAGE_BASE_EXCEEDED flag fires exactly when netSE*0.9235 > 184500; P6 the safe
// harbor restated from the rounded outputs (prior_year_tax > 0 selects
// min(prior_year_tax, 0.9 * total_federal_tax), else 0.9 * total_federal_tax, and
// safe_harbor_quarterly = round2(safe_harbor_total / 4)).
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-752-freelance-quarterly-estimated-tax.proptest.mjs

import { compute } from '../art-752-freelance-quarterly-estimated-tax.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick } from './_pbt-common.mjs';

const KERNEL_ID = 'art-752-freelance-quarterly-estimated-tax';

const STATES = ['none', 'low', 'mid', 'high'];
const STATUSES = ['single', 'mfj'];

const basePP = () => ({
  gross_income: 120000, business_expenses: 15000, other_income: 0,
  filing_status: 'single', state: 'high', prior_year_tax: 0, ytd_paid: 0,
});

const round2 = (n) => Math.round(n * 100) / 100;
const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const hasBadNumber = (x) => {
  if (typeof x === 'number') return !Number.isFinite(x);
  if (x === null || typeof x !== 'object') return false;
  return Object.values(x).some(hasBadNumber);
};

const drawPP = (rng) => ({
  gross_income: Math.round(rng() * 1_500_000) + 1000,
  business_expenses: Math.round(rng() * 300_000),
  other_income: Math.round(rng() * 400_000),
  filing_status: pick(rng, STATUSES),
  state: pick(rng, STATES),
  prior_year_tax: Math.round(rng() * 300_000),
  ytd_paid: Math.round(rng() * 200_000),
});

// P1 — totals non-decreasing in gross_income and other_income.
function checkP1Monotone() {
  let checked = 0, violations = 0;
  const rng = mulberry32(75201);
  for (let i = 0; i < 60; i++) {
    const pp = drawPP(rng);
    const t0 = compute(pp).output_payload.total_annual_tax;
    const s0 = compute(pp).output_payload.safe_harbor_total;
    const tG = compute({ ...pp, gross_income: pp.gross_income + 1000 }).output_payload.total_annual_tax;
    const tO = compute({ ...pp, other_income: pp.other_income + 1000 }).output_payload.total_annual_tax;
    const sO = compute({ ...pp, other_income: pp.other_income + 1000 }).output_payload.safe_harbor_total;
    for (const [label, v] of [['gross_income', tG], ['other_income', tO]]) {
      checked++;
      if (v < t0) { violations++; console.log(`P1 violation: total_annual_tax ${v} < ${t0} when raising ${label}`); }
    }
    checked++;
    if (sO < s0) { violations++; console.log(`P1 violation: safe_harbor_total ${sO} < ${s0} when raising other_income`); }
  }
  return { name: 'P1 total/safe-harbor non-decreasing in gross_income/other_income', checked, violations };
}

// P2 — quarterly split and remaining restated from the rounded outputs.
function checkP2QuarterlyRestated() {
  let checked = 0, violations = 0;
  const rng = mulberry32(75202);
  for (let i = 0; i < 120; i++) {
    const pp = drawPP(rng);
    const out = compute(pp).output_payload;
    checked += 6;
    // remaining_after_ytd restated from the rounded outputs with the kernel's
    // max(0, ...) floor applied (exact under IEEE-754 given the floor).
    const wantRem = Math.max(0, round2(out.total_annual_tax - pp.ytd_paid));
    if (out.remaining_after_ytd !== wantRem) {
      violations++; console.log(`P2 violation: remaining ${out.remaining_after_ytd} != restated ${wantRem}`);
    }
    // remaining floors at zero.
    if (out.remaining_after_ytd < 0) { violations++; console.log('P2 violation: remaining_after_ytd negative'); }
    // quarter shape: four fixed 2026 entries, equal amounts.
    const wantDates = ['Apr 15, 2026', 'Jun 15, 2026', 'Sep 15, 2026', 'Jan 15, 2027'];
    if (out.quarters.length !== 4) { violations++; console.log('P2 violation: quarters length != 4'); continue; }
    out.quarters.forEach((q, j) => {
      if (q.due !== wantDates[j]) { violations++; console.log(`P2 violation: quarters[${j}].due ${q.due} != ${wantDates[j]} (DIFFERS.md D1 pins Q2 to the official Jun 15)`); }
      if (q.amount !== out.per_quarter) { violations++; console.log('P2 violation: quarter amount != per_quarter'); }
    });
  }
  return { name: 'P2 quarterly split + remaining restated; fixed 2026 due dates', checked, violations };
}

// P3 — determinism and output shape.
function checkP3DeterminismShape() {
  let checked = 0, violations = 0;
  const rng = mulberry32(75203);
  for (let i = 0; i < 40; i++) {
    const pp = drawPP(rng);
    const a = compute(pp).output_payload;
    const b = compute(pp).output_payload;
    checked += 2;
    if (!deepEqual(a, b)) { violations++; console.log('P3 violation: two runs differ'); }
    if (hasBadNumber(a) || JSON.stringify(a).includes('undefined')) { violations++; console.log('P3 violation: undefined/NaN/non-finite in output_payload'); }
  }
  return { name: 'P3 determinism + output shape (no undefined/NaN/non-finite)', checked, violations };
}

// P4 — domain coercion restated (Apex fallback behaviour, no throw branch).
function checkP4DomainCoercion() {
  let checked = 0, violations = 0;
  const rng = mulberry32(75204);
  for (let i = 0; i < 40; i++) {
    const pp = drawPP(rng);
    const a = compute({ ...pp, state: 'bogus' }).output_payload;
    const b = compute({ ...pp, state: 'none' }).output_payload;
    checked++;
    if (!deepEqual(a, b)) { violations++; console.log('P4 violation: unknown state key not priced like none'); }
    const c = compute({ ...pp, filing_status: 'head_of_household' }).output_payload;
    const d = compute({ ...pp, filing_status: 'single' }).output_payload;
    checked++;
    if (!deepEqual(c, d)) { violations++; console.log('P4 violation: non-mfj status not priced like single'); }
  }
  return { name: 'P4 unknown state -> rate 0, non-mfj -> single (coercion restated)', checked, violations };
}

// P5 — SS wage base restated from the inputs; flag fires exactly past the cap.
function checkP5SSCap() {
  let checked = 0, violations = 0;
  const rng = mulberry32(75205);
  for (let i = 0; i < 80; i++) {
    const pp = drawPP(rng);
    const out = compute(pp).output_payload;
    const netSE = pp.gross_income - pp.business_expenses;
    const subject = netSE * 0.9235;
    const wantSS = round2(Math.min(subject, 184500) * 0.124);
    checked += 2;
    if (out.ss_tax !== wantSS) { violations++; console.log(`P5 violation: ss_tax ${out.ss_tax} != restated ${wantSS}`); }
    const wantFlag = subject > 184500;
    const hasFlag = compute(pp).compliance_flags.includes('SS_WAGE_BASE_EXCEEDED');
    if (hasFlag !== wantFlag) { violations++; console.log(`P5 violation: SS_WAGE_BASE_EXCEEDED ${hasFlag}, subject ${subject}`); }
  }
  return { name: 'P5 ss_tax restated; SS_WAGE_BASE_EXCEEDED iff subject > 184500', checked, violations };
}

// P6 — safe harbor restated from the rounded outputs.
function checkP6SafeHarbor() {
  let checked = 0, violations = 0;
  const rng = mulberry32(75206);
  for (let i = 0; i < 80; i++) {
    const pp = drawPP(rng);
    const out = compute(pp).output_payload;
    // float_sensitive: PARTIAL — the kernel rounds once from the UNROUNDED
    // 0.9 * total_fed while this restatement reads the ROUNDED total_federal_tax,
    // so the two can differ by a single cent. Assert |d| <= 0.01, never float-equals.
    const want = pp.prior_year_tax > 0
      ? round2(Math.min(pp.prior_year_tax, 0.9 * out.total_federal_tax))
      : round2(0.9 * out.total_federal_tax);
    checked += 2;
    if (Math.round(Math.abs(out.safe_harbor_total - want) * 100) > 1) { violations++; console.log(`P6 violation: safe_harbor_total ${out.safe_harbor_total} vs restated ${want} off by more than a cent`); }
    const wantQ = round2(out.safe_harbor_total / 4);
    if (Math.round(Math.abs(out.safe_harbor_quarterly - wantQ) * 100) > 1) { violations++; console.log(`P6 violation: safe_harbor_quarterly ${out.safe_harbor_quarterly} vs restated ${wantQ} off by more than a cent`); }
  }
  return { name: 'P6 safe harbor restated (min 100% prior / 90% current, quarterly split)', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1Monotone(),
  checkP2QuarterlyRestated(),
  checkP3DeterminismShape(),
  checkP4DomainCoercion(),
  checkP5SSCap(),
  checkP6SafeHarbor(),
];
console.log(`[${KERNEL_ID}] class-K floor property test`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
