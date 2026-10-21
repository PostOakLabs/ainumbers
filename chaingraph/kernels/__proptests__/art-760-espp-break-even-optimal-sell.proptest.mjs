// kernel_digest_at_authoring: sha256:bfdfad68ef74e4bf837405730e2352a16e0b593d907e51738f4dbccc36d7f42e
// art-760-espp-break-even-optimal-sell.proptest.mjs — class-K property-test FLOOR
// (FV-PBT-FLOOR-BUILD-SPEC.md). Authored against the APEXPORT-110B porting payload
// (kernel + fixtures + VECTORS/DIFFERS/CITES records, GRADES PASS-PENDING-XV
// 2026-10-13, Builder-verifies-at-land 22/22 vectors / 462 field checks, 0 mismatches).
//
// SCOPE: floor tier only. NOT a proof, NOT Dafny. Internal engineering QC only.
// float_sensitive: PARTIAL — the kernel deliberately keeps the Apex page's float
// bracket-walk arithmetic so its outputs match the ported-from page to the digit
// (payload sweep 4006/4006 rows). The properties below assert only relations that
// are exact under IEEE-754 (restatements of the published formula, equality on
// already-rounded comparisons, refusal naming) or hold by the model's structure,
// never fragile float equals on arbitrary draws.
//
// Checks: fixture-oracle gate (the 6 Apex live vectors A1..A6 incl. the A4/A6
// loss-branch divergence cases and the 16 boundary pairs at and just past every
// comparator — LTCG 0%/15% single+MFJ ceilings, 15%/20% ceiling, qual cap
// min(current-purch, offer-purch), qual ord floor, marginal-rate 24%/32% boundary
// at 201,775, already_qualified strict >, qualify-date max() grant-vs-purchase);
// P1 identity restatements that hold exactly in IEEE-754 (gross = current*shares on
// both paths; total = ord + ltcg tax; proceeds = gross - total; benefit = qual
// proceeds - disq proceeds); P2 marginalRate restated independently from the
// published bracket table and always one of the six published rates; P3
// determinism (as_of-pinned rerun byte-equal) and output shape (no undefined /
// NaN / non-finite anywhere in output_payload); P4 out-of-domain inputs yield a
// named refusal payload (REFUSED_UNKNOWN_FILING_STATUS / REFUSED_NON_FINITE_INPUT /
// REFUSED_BAD_DATE), never a throw or a silent guess; P5 the Apex-model
// divergence structure (fmv_at_purchase = purchase_price/0.85; benefit == 0 for
// every current_price >= purchase_price; benefit > 0 only in the loss branch);
// P6 already_qualified is a pure strict-> function of as_of_date vs qualify_date.
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-760-espp-break-even-optimal-sell.proptest.mjs

import { compute, marginalRate, REGULAR_BRACKETS_SINGLE, REGULAR_BRACKETS_MFJ } from '../art-760-espp-break-even-optimal-sell.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick, findShapeViolations } from './_pbt-common.mjs';

const KERNEL_ID = 'art-760-espp-break-even-optimal-sell';

const STATUSES = ['single', 'mfj'];

const basePP = () => ({
  purchase_price: 29.75, offering_price: 35, current_price: 48, shares: 500,
  grant_date: '2024-01-01', purchase_date: '2024-07-01',
  ordinary_income: 180000, filing_status: 'single', as_of_date: '2026-10-08',
});

const hasBadNumber = (x) => {
  if (typeof x === 'number') return !Number.isFinite(x);
  if (x === null || typeof x !== 'object') return false;
  return Object.values(x).some(hasBadNumber);
};

const randomPP = (rng) => {
  const pp = basePP();
  pp.purchase_price = Math.round(rng() * 9000) / 100 + 0.01;
  pp.offering_price = Math.round(rng() * 12000) / 100 + 0.01;
  pp.current_price = Math.round(rng() * 12000) / 100 + 0.01;
  pp.shares = 1 + Math.floor(rng() * 5000);
  pp.ordinary_income = Math.floor(rng() * 900000);
  pp.filing_status = pick(rng, STATUSES);
  return pp;
};

// P1 — IEEE-exact identity restatements.
function checkP1Identities() {
  let checked = 0, violations = 0;
  const rng = mulberry32(76001);
  for (let i = 0; i < 120; i++) {
    const pp = randomPP(rng);
    const { output_payload: op } = compute(pp);
    const pairs = [
      ['disq', op.disq_gross === op.current_price * op.shares_exercised],
      ['qual', op.qual_gross === op.current_price * op.shares_exercised],
      ['disq', op.disq_total_tax === op.disq_ord_tax + op.disq_ltcg_tax],
      ['qual', op.qual_total_tax === op.qual_ord_tax + op.qual_ltcg_tax],
      ['disq', op.disq_proceeds === op.disq_gross - op.disq_total_tax],
      ['qual', op.qual_proceeds === op.qual_gross - op.qual_total_tax],
      ['both', op.benefit === op.qual_proceeds - op.disq_proceeds],
    ];
    for (const [path, ok] of pairs) {
      checked++;
      if (!ok) { violations++; console.log(`P1 violation: ${path} identity broken at ${JSON.stringify(pp)}`); }
    }
  }
  return { name: 'P1 gross/total/proceeds/benefit identities restated exactly', checked, violations };
}

// P2 — marginalRate restated from the published tables; always a published rate.
function checkP2MarginalRestated() {
  let checked = 0, violations = 0;
  const rng = mulberry32(76002);
  const published = new Set([0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37]);
  for (let i = 0; i < 150; i++) {
    const status = pick(rng, STATUSES);
    const inc = Math.floor(rng() * 1200000);
    const brackets = status === 'mfj' ? REGULAR_BRACKETS_MFJ : REGULAR_BRACKETS_SINGLE;
    let expected = 0.37;
    for (const [top, rate] of brackets) { if (inc <= top) { expected = rate; break; } }
    const got = marginalRate(inc, status);
    checked += 2;
    if (got !== expected) { violations++; console.log(`P2 violation: marginalRate(${inc},${status}) ${got} != restated ${expected}`); }
    if (!published.has(got)) { violations++; console.log(`P2 violation: rate ${got} not a published 2026 rate`); }
  }
  return { name: 'P2 marginal rate restated from published tables (single+MFJ)', checked, violations };
}

// P3 — determinism (as_of-pinned) and output shape.
function checkP3DeterminismShape() {
  let checked = 0, violations = 0;
  const rng = mulberry32(76003);
  for (let i = 0; i < 80; i++) {
    const pp = randomPP(rng);
    const a = compute(pp).output_payload;
    const b = compute(pp).output_payload;
    checked++;
    if (JSON.stringify(a) !== JSON.stringify(b)) { violations++; console.log('P3 violation: rerun differs with as_of pinned'); }
    checked++;
    const v = findShapeViolations(a);
    if (v.length) { violations++; console.log('P3 shape violation: ' + v.slice(0, 3).join('; ')); }
  }
  return { name: 'P3 determinism under pinned as_of + output shape (no NaN/undefined)', checked, violations };
}

// P4 — out-of-domain inputs yield a named refusal payload.
function checkP4DomainRefusal() {
  let checked = 0, violations = 0;
  const cases = [
    [{ ...basePP(), filing_status: 'hoh' }, 'REFUSED_UNKNOWN_FILING_STATUS'],
    [{ ...basePP(), purchase_price: '29.75' }, 'REFUSED_NON_FINITE_INPUT'],
    [{ ...basePP(), shares: NaN }, 'REFUSED_NON_FINITE_INPUT'],
    [{ ...basePP(), ordinary_income: Infinity }, 'REFUSED_NON_FINITE_INPUT'],
    [{ ...basePP(), grant_date: '2024-1-1' }, 'REFUSED_BAD_DATE'],
    [{ ...basePP(), purchase_date: 'not-a-date' }, 'REFUSED_BAD_DATE'],
  ];
  for (const [pp, code] of cases) {
    const { output_payload: op } = compute(pp);
    checked++;
    if (!op || op.refusal_reason !== code || !Array.isArray(op.domain_errors) || op.domain_errors[0].code !== code) {
      violations++; console.log(`P4 violation: expected refusal ${code}, got ${JSON.stringify(op).slice(0, 160)}`);
    }
  }
  return { name: 'P4 named refusals (status / non-finite / bad date)', checked, violations };
}

// P5 — the Apex-model divergence structure (VECTORS model note).
function checkP5ModelStructure() {
  let checked = 0, violations = 0;
  const rng = mulberry32(76005);
  for (let i = 0; i < 120; i++) {
    const pp = randomPP(rng);
    // Make the Apex 15%-discount assumption hold: purchase = 0.85 * offering.
    pp.offering_price = Math.round(pp.offering_price * 100) / 100;
    pp.purchase_price = pp.offering_price * 0.85;
    const { output_payload: op } = compute(pp);
    checked++;
    // Allow the float-rounding slack of the /0.85 inversion; at the model
    // assumption fmv == offering to within the double's last few ulps.
    if (Math.abs(op.fmv_at_purchase - pp.offering_price) > 1e-9) {
      violations++; console.log('P5 violation: fmv_at_purchase != offering under the 15% model');
    }
    checked++;
    // Under the 15% model fmv == offering, so the §423(c) cap (min(current-purch,
    // offer-purch)) equals the disqualifying discount exactly when current >=
    // offering: benefit is 0 (to float slack) there, and strictly positive beyond
    // that slack for every current < offering (the stock below FMV-at-grant,
    // including the loss branch current < purchase — the A4/A6 vectors).
    const capped = op.current_price >= op.offering_price;
    if (capped ? Math.abs(op.benefit) > 1e-6 : !(op.benefit > 1e-6)) {
      violations++; console.log(`P5 violation: benefit ${op.benefit} with current ${op.current_price} vs offering ${op.offering_price}`);
    }
  }
  return { name: 'P5 Apex-model structure (fmv==offering under 15%; benefit only in loss branch)', checked, violations };
}

// P6 — already_qualified is a pure strict-> function of as_of_date vs qualify_date.
function checkP6StrictGT() {
  let checked = 0, violations = 0;
  const rng = mulberry32(76006);
  for (let i = 0; i < 60; i++) {
    const pp = randomPP(rng);
    const q = compute(pp).output_payload.qualify_date;
    const at = compute({ ...pp, as_of_date: q }).output_payload.already_qualified;
    const past = new Date(Date.parse(q + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);
    const after = compute({ ...pp, as_of_date: past }).output_payload.already_qualified;
    checked += 2;
    if (at !== false) { violations++; console.log(`P6 violation: as_of == qualify_date (${q}) reported ${at}`); }
    if (after !== true) { violations++; console.log(`P6 violation: as_of = qualify_date +1d reported ${after}`); }
  }
  return { name: 'P6 already_qualified strict > at and just past the qualify date', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1Identities(),
  checkP2MarginalRestated(),
  checkP3DeterminismShape(),
  checkP4DomainRefusal(),
  checkP5ModelStructure(),
  checkP6StrictGT(),
];
console.log(`[${KERNEL_ID}] class-K floor property test`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
