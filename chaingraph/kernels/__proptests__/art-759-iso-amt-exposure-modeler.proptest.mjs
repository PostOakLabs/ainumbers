// art-759-iso-amt-exposure-modeler.proptest.mjs — class-K property-test FLOOR
// kernel_digest_at_authoring: sha256:ca6aae702afb676f7736a5e1e754cb2c58885eb4117eb3d4dfe93d85f5747941
// (FV-PBT-FLOOR-BUILD-SPEC.md). Authored against the APEXPORT-109 porting payload
// (kernel + fixtures + VECTORS/DIFFERS/CITES records, GRADES PASS-PENDING-XV
// 2026-10-09T02:05Z, Builder-verifies-at-land 15/15 pre-build, Tim extend ruling
// 2026-10-18T21:20Z).
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof, NOT Dafny. Internal engineering QC only.
// float_sensitive: PARTIAL — the kernel deliberately keeps the Apex page's float
// arithmetic so its outputs match the ported-from page to the digit (double-precision
// artifacts like amt_owed 0.20000000000436557 are preserved, payload VECTORS.md).
// The properties below assert only relations that are exact under IEEE-754
// (monotone comparisons on shared arithmetic, equality on already-computed outputs,
// integer relations on rounded share counts) or restatements of the published
// formula with the SAME operation order, never fragile float equals on arbitrary draws.
//
// Checks: fixture-oracle gate (the 4 Apex live vectors and the 11 comparator-boundary
// pairs — 26%/28% breakpoint at/past $244,500, phase-out start at/past $500,000/$1,000,000,
// AMT trigger at/past, exemption fully eliminated, MFJ million-dollar phase-out — plus
// the 4 ART759-AMT-PHASEOUT-2026-FIX-1 rate vectors: single AMTI $600,000 and MFJ
// AMTI $1,100,000 pinning the 50-percent reduction, and the IRS 2026 complete-phaseout
// boundary pair at AMTI $680,200/$680,201 single; plus the ART759-REGULAR-TAX-DEDUCTION-
// FIX-1 standard-deduction vectors H1..H5, and the pre-deduction D1 trigger inputs kept
// under the D1-old-boundary ids — 26 vectors total);
// P1 amt_owed is non-decreasing in shares and in fmv (both filing statuses); P2
// regular_tax restated as brackets over max(0, ordinary_income - standard_deduction)
// against an independently implemented deduction table and bracket walk, and
// non-decreasing in ordinary_income; P3 determinism (two runs agree byte-for-byte) and
// output shape (no undefined/NaN/non-finite anywhere in output_payload); P4 domain
// refusals: unknown filing_status and every non-finite numeric input yield
// output_payload.refused with a named code and a compliance flag (the payload
// contract — not a throw); P5 the max_shares_no_amt binary-search contract: TMT at
// max_shares_no_amt <= regular_tax and, when the search is not saturated, TMT at
// max_shares_no_amt + 1 > regular_tax; P6 the exemption phase-out restated:
// effective_exemption == max(0, exemption - 0.50 * max(0, amti - threshold)) with the
// fixed 2026 amounts (IRC 55(d)(4)(A)(ii)(IV): 50 percent for tax years beginning
// after Dec. 31, 2025 — Rev. Proc. 2025-32 sec. 4.10 complete phaseout $680,200
// unmarried / $1,280,400 joint), and amt_triggered == (amt_owed > 0); P7 the
// standard-deduction contract (Rev. Proc. 2025-32 sec. 4.14(1), IRC 63(b)(1) for the
// regular-tax leg, IRC 56(b)(1)(D) for the AMTI leg): taxable_income == max(0,
// ordinary_income - standard_deduction), amti == ordinary_income + iso_spread +
// other_amt_adjustments (independent of the deduction), amt_owed == max(0,
// tentative_minimum_tax - regular_tax), regular_tax == 0 whenever ordinary_income <=
// standard_deduction, and the deduction boundary (just under, exactly at, just over)
// for both statuses.
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-759-iso-amt-exposure-modeler.proptest.mjs

import { compute } from '../art-759-iso-amt-exposure-modeler.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick } from './_pbt-common.mjs';

const KERNEL_ID = 'art-759-iso-amt-exposure-modeler';

const STATUSES = ['single', 'mfj'];

const basePP = () => ({
  shares: 10000, strike_price: 2.5, fmv: 18, ordinary_income: 175000,
  other_amt_adjustments: 0, filing_status: 'single',
});

const hasBadNumber = (x) => {
  if (typeof x === 'number') return !Number.isFinite(x);
  if (x === null || typeof x !== 'object') return false;
  return Object.values(x).some(hasBadNumber);
};

// Apex-exact AMT machinery, restated for the properties (same constants as the kernel;
// this is a restatement of the published 2026 parameters, not a copy of kernel internals).
function restatedParams(status) {
  return status === 'single'
    ? { exemption: 90100, phaseoutStart: 500000, threshold: 244500 }
    : { exemption: 140200, phaseoutStart: 1000000, threshold: 244500 };
}
function restatedTMT(amti, status) {
  const p = restatedParams(status);
  const eff = Math.max(0, p.exemption - 0.50 * Math.max(0, amti - p.phaseoutStart));
  const base = Math.max(0, amti - eff);
  return base <= p.threshold ? base * 0.26 : p.threshold * 0.26 + (base - p.threshold) * 0.28;
}

// P1 — amt_owed non-decreasing in shares and in fmv (both statuses).
function checkP1Monotone() {
  let checked = 0, violations = 0;
  const rng = mulberry32(75901);
  for (let i = 0; i < 50; i++) {
    const status = pick(rng, STATUSES);
    const pp = basePP();
    pp.filing_status = status;
    pp.shares = 1 + Math.floor(rng() * 200000);
    pp.strike_price = Math.round(rng() * 5000) / 100 + 0.01;
    pp.fmv = pp.strike_price + Math.round(rng() * 4000) / 100;
    pp.ordinary_income = Math.floor(rng() * 1000000);
    pp.other_amt_adjustments = Math.floor(rng() * 100000);
    const owed0 = compute(pp).output_payload.amt_owed;
    const owedShares = compute({ ...pp, shares: pp.shares + 500 }).output_payload.amt_owed;
    const owedFmv = compute({ ...pp, fmv: pp.fmv + 0.5 }).output_payload.amt_owed;
    for (const [label, o1] of [['shares', owedShares], ['fmv', owedFmv]]) {
      checked++;
      if (o1 < owed0) { violations++; console.log(`P1 violation: amt_owed ${o1} < ${owed0} when raising ${label} (${status})`); }
    }
  }
  return { name: 'P1 amt_owed non-decreasing in shares/fmv (both statuses)', checked, violations };
}

// P2 — regular_tax restated (independent deduction table + bracket walk over taxable
// income, ART759-REGULAR-TAX-DEDUCTION-FIX-1) and monotone in ordinary_income.
function checkP2RegularTax() {
  let checked = 0, violations = 0;
  const rng = mulberry32(75902);
  // 2026 standard deduction, written independently of the kernel's constant from
  // Rev. Proc. 2025-32 sec. 4.14(1): joint/surviving spouses $32,200, unmarried $16,100
  // (MFS equals the unmarried amount; head of household $24,150 is not modelled).
  const deduction = (s) => (s === 'single' ? 16100 : 32200);
  const brackets = (s) => (s === 'single'
    ? [[12400, 0.10], [50400, 0.12], [105700, 0.22], [201775, 0.24], [256225, 0.32], [640600, 0.35]]
    : [[24800, 0.10], [100800, 0.12], [211400, 0.22], [403550, 0.24], [512450, 0.32], [768700, 0.35]]);
  const walk = (income, status) => {
    let tax = 0, prev = 0;
    for (const [top, rate] of [...brackets(status), [Infinity, 0.37]]) {
      if (income <= prev) break;
      tax += (Math.min(income, top) - prev) * rate;
      prev = top;
    }
    return tax;
  };
  for (let i = 0; i < 60; i++) {
    const status = pick(rng, STATUSES);
    const pp = basePP();
    pp.filing_status = status;
    pp.ordinary_income = Math.floor(rng() * 1500000);
    const out = compute(pp).output_payload;
    const taxable = Math.max(0, pp.ordinary_income - deduction(status));
    checked += 3;
    if (out.regular_tax !== walk(taxable, status)) { violations++; console.log('P2 violation: regular_tax != restated bracket walk over taxable income'); }
    if (out.taxable_income !== taxable) { violations++; console.log('P2 violation: taxable_income != max(0, ordinary_income - deduction)'); }
    const out2 = compute({ ...pp, ordinary_income: pp.ordinary_income + 1000 }).output_payload;
    if (out2.regular_tax < out.regular_tax) { violations++; console.log('P2 violation: regular_tax decreased with income'); }
  }
  return { name: 'P2 regular_tax brackets over max(0, income - deduction) + monotone', checked, violations };
}

// P3 — determinism + output shape.
function checkP3DeterminismShape() {
  let checked = 0, violations = 0;
  const rng = mulberry32(75903);
  for (let i = 0; i < 40; i++) {
    const pp = basePP();
    pp.filing_status = pick(rng, STATUSES);
    pp.shares = 1 + Math.floor(rng() * 1000000);
    pp.ordinary_income = Math.floor(rng() * 2000000);
    const a = compute(pp), b = compute(pp);
    checked += 2;
    if (JSON.stringify(a) !== JSON.stringify(b)) { violations++; console.log('P3 violation: nondeterministic output'); }
    const v = hasBadNumber(a.output_payload);
    if (v) { violations++; console.log('P3 violation: NaN/undefined/non-finite in output_payload'); }
  }
  return { name: 'P3 determinism + output shape (no NaN/undefined/non-finite)', checked, violations };
}

// P4 — domain refusals (named reason, never a silent guess): unknown filing_status and
// every non-finite numeric slot.
function checkP4DomainRefusal() {
  let checked = 0, violations = 0;
  const bads = [NaN, Infinity, -Infinity, '10000', null];
  for (const bad of bads) {
    for (const key of ['shares', 'strike_price', 'fmv', 'ordinary_income', 'other_amt_adjustments']) {
      const r = compute({ ...basePP(), [key]: bad });
      checked++;
      if (!r.output_payload || !r.output_payload.refused || r.compliance_flags.length === 0) {
        violations++; console.log(`P4 violation: ${key}=${String(bad)} not refused with a flag`);
      }
    }
  }
  for (const status of [undefined, 'mfs', 'MARRIED', '']) {
    const r = compute({ ...basePP(), filing_status: status });
    checked++;
    if (r.output_payload.refused !== 'REFUSED_UNKNOWN_FILING_STATUS') {
      violations++; console.log(`P4 violation: filing_status=${String(status)} not refused with the named code`);
    }
  }
  return { name: 'P4 refusals: unknown status + non-finite/type-bad numerics', checked, violations };
}

// P5 — max_shares_no_amt binary-search contract (Apex lines 335-342): TMT at the reported
// count is <= regular_tax; one more share pushes TMT above regular_tax, unless the search
// saturates at the shares*10 cap or the answer is 0 with TMT(0) already > regular_tax.
function checkP5MaxShares() {
  let checked = 0, violations = 0;
  const rng = mulberry32(75905);
  for (let i = 0; i < 40; i++) {
    const status = pick(rng, STATUSES);
    const pp = basePP();
    pp.filing_status = status;
    pp.shares = 1 + Math.floor(rng() * 50000);
    pp.strike_price = Math.round(rng() * 2000) / 100 + 0.01;
    pp.fmv = pp.strike_price + Math.round(rng() * 1000) / 100;
    pp.ordinary_income = Math.floor(rng() * 900000);
    const out = compute(pp).output_payload;
    const tmtAt = (n) => restatedTMT(pp.ordinary_income + n * (pp.fmv - pp.strike_price) + pp.other_amt_adjustments, status);
    checked += 2;
    if (!(tmtAt(out.max_shares_no_amt) <= out.regular_tax)) { violations++; console.log('P5 violation: TMT at max_shares_no_amt > regular_tax'); }
    const saturated = out.max_shares_no_amt >= pp.shares * 10;
    if (!saturated && out.max_shares_no_amt + 1 <= pp.shares * 10 && !(tmtAt(out.max_shares_no_amt + 1) > out.regular_tax)) {
      violations++; console.log('P5 violation: TMT at max_shares_no_amt+1 still <= regular_tax');
    }
  }
  return { name: 'P5 max-shares search contract (<= at N, > at N+1)', checked, violations };
}

// P6 — phase-out and trigger restatements with the fixed 2026 amounts.
function checkP6PhaseoutRestated() {
  let checked = 0, violations = 0;
  const rng = mulberry32(75906);
  for (let i = 0; i < 40; i++) {
    const status = pick(rng, STATUSES);
    const pp = basePP();
    pp.filing_status = status;
    pp.shares = 1 + Math.floor(rng() * 100000);
    pp.ordinary_income = Math.floor(rng() * 1200000);
    const out = compute(pp).output_payload;
    const p = restatedParams(status);
    const wantEff = Math.max(0, p.exemption - 0.50 * Math.max(0, out.amti - p.phaseoutStart));
    checked += 3;
    if (out.effective_exemption !== wantEff) { violations++; console.log('P6 violation: effective_exemption != restated phase-out'); }
    if (out.amt_triggered !== (out.amt_owed > 0)) { violations++; console.log('P6 violation: amt_triggered != (amt_owed > 0)'); }
    if (!(out.amt_base === Math.max(0, out.amti - out.effective_exemption))) { violations++; console.log('P6 violation: amt_base != max(0, amti - effective_exemption)'); }
  }
  return { name: 'P6 phase-out + trigger + amt_base restated (2026 constants)', checked, violations };
}

// P7 — standard-deduction contract (ART759-REGULAR-TAX-DEDUCTION-FIX-1). Taxable income
// is gross minus the deduction, floored at zero (IRC 63(b)(1); Rev. Proc. 2025-32
// sec. 4.14(1) amounts); AMTI takes NO deduction (IRC 56(b)(1)(D)) so it is exactly
// ordinary_income + iso_spread + other_amt_adjustments; amt_owed is the excess of TMT
// over regular tax (IRC 55(a)); regular tax is zero at or below the deduction; and the
// boundary is pinned just under, exactly at, and just over the deduction for both statuses.
function checkP7StandardDeduction() {
  let checked = 0, violations = 0;
  const rng = mulberry32(75907);
  const ded = (s) => (s === 'single' ? 16100 : 32200);
  for (let i = 0; i < 50; i++) {
    const status = pick(rng, STATUSES);
    const pp = basePP();
    pp.filing_status = status;
    pp.shares = 1 + Math.floor(rng() * 100000);
    pp.ordinary_income = Math.floor(rng() * 900000);
    pp.other_amt_adjustments = Math.floor(rng() * 50000);
    const out = compute(pp).output_payload;
    checked += 4;
    if (out.taxable_income !== Math.max(0, pp.ordinary_income - ded(status))) {
      violations++; console.log('P7 violation: taxable_income != max(0, ordinary_income - deduction)');
    }
    if (out.amti !== pp.ordinary_income + out.iso_spread + pp.other_amt_adjustments) {
      violations++; console.log('P7 violation: amti != ordinary_income + iso_spread + other_amt_adjustments (deduction leaked into AMTI)');
    }
    if (out.amt_owed !== Math.max(0, out.tentative_minimum_tax - out.regular_tax)) {
      violations++; console.log('P7 violation: amt_owed != max(0, tmt - regular_tax)');
    }
    if (pp.ordinary_income <= ded(status) && out.regular_tax !== 0) {
      violations++; console.log('P7 violation: regular_tax != 0 at or below the deduction');
    }
  }
  // Boundary: just under, exactly at, just over (both statuses).
  const edges = [ { status: 'single', d: 16100 }, { status: 'mfj', d: 32200 } ];
  for (const { status, d } of edges) {
    for (const [inc, wantTaxable, wantRegular] of [[d - 1, 0, 0], [d, 0, 0], [d + 1, 1, 0.1]]) {
      const out = compute({ ...basePP(), filing_status: status, ordinary_income: inc }).output_payload;
      checked += 3;
      if (out.taxable_income !== wantTaxable) { violations++; console.log(`P7 violation: boundary taxable_income ${out.taxable_income} != ${wantTaxable} at income ${inc} ${status}`); }
      if (out.regular_tax !== wantRegular) { violations++; console.log(`P7 violation: boundary regular_tax ${out.regular_tax} != ${wantRegular} at income ${inc} ${status}`); }
      if (out.standard_deduction !== d) { violations++; console.log(`P7 violation: standard_deduction ${out.standard_deduction} != ${d} for ${status}`); }
    }
  }
  return { name: 'P7 standard-deduction contract (63(b)(1) regular leg, 56(b)(1)(D) AMTI leg)', checked, violations };
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
  checkP2RegularTax(),
  checkP3DeterminismShape(),
  checkP4DomainRefusal(),
  checkP5MaxShares(),
  checkP6PhaseoutRestated(),
  checkP7StandardDeduction(),
];
console.log(`[${KERNEL_ID}] class-K floor property test`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
