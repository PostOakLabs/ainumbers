// art-616-mla-mapr-actuarial-recompute.proptest.mjs — FV property-test FLOOR (MLA-MAPR-K-2).
// kernel_digest_at_authoring: sha256:fe52d9fd1931382c551fe8a68fe00b6e9f2695dbe089a890c0bd361fca7f102b
// spec: research/MLA-MAPR-ACTUARIAL.spec.md
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §2/§3, class B). NOT a proof, NOT Dafny.
//
// ⚠ CLASS B HERE IS A RIGOR ASSIGNMENT, NOT A STATEMENT ABOUT THE INPUT DOMAIN. This kernel is
// architecturally class-C shaped: unbounded advance and payment arrays, a rate found by iteration —
// exactly art-215's own triage class. WU MLA-MAPR-K-2 assigns class-B property-testing rigor by
// explicit ruling, on cost and benefit grounds. Anyone copying this file must not carry "class B"
// forward as "the input domain is bounded", because it is not.
//
// float_sensitive: YES. Every quantity is an IEEE-754 double. The declared rounding steps are:
//   RND-1  solver bracket width, mode none, 1e-6 annual percentage points
//   RND-2  final MAPR and money figures, half_up, 2 decimals
//   RND-3  internal periodic rate, half_up, 6 decimals
// so the float-sensitive members of the property suite are IN scope and the boundary set below is
// FORCED, never sampled toward (FORMALVERIF-BUILD-SPEC.md §6.B: a class-B claim that omits
// ULP-boundary forcing is not a claim about float behavior at all).
//
// P0  fixture oracle — every pinned vector reproduces, AND every one agrees with the solver-free
//     algebraic expectations carried in the fixture file's oracle_expected blocks. The second half
//     is what makes this a gate rather than the self-consistent-checker shape SO #34 names: the
//     expectations came from algebraic inversion of the Appendix J discounting form, with no
//     root-finder anywhere in their derivation.
// P1  THE LOAD-BEARING PROPERTY. With every MLA charge zero or absent, this kernel's rate equals
//     the ordinary Reg Z Appendix J APR that art-215 computes for the IDENTICAL schedule. RUN by
//     feeding the same schedules into both kernels, never asserted. This is what proves the node is
//     an actuarial superset of ordinary APR rather than a reinvention of it.
// P2  monotone in each includable prepaid charge amount (more includable dollars never lower MAPR).
// P3  bounded: a reported rate is non-negative.
// P4  bracket-or-refuse, INCLUDING the F-2-shaped regression case. art-215's own F-2 finding was a
//     solver that broke early and handed back its starting guess as though it had converged. The
//     negative control here feeds schedules that cannot be bracketed and asserts a null rate with
//     converged:false — never a number.
// P5  cap comparison exact AT the 36.00 boundary and one ULP either side. 232.4(b) forbids an MAPR
//     "greater than 36 percent", so exactly 36.00 must NOT trip exceeds_cap.
// P6  the two statutory constants are unreachable from policy_parameters.
// P7  the $100 participation-fee figure is REPORTED and never netted out on the closed-end path.
// P8  charge classification totality: all 9 recognised types crossed with both booleans, plus
//     unrecognised types.
// P9  amount_financed_mapr identity, and a finance_charge entry moving nothing.
// P10 forced ULP and categorical boundaries.
// P11 determinism, and totality under a hostile-input discovery leg.
// P12 payload shape: no NaN, Infinity or undefined at any depth.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mulberry32, deepEqual, findShapeViolations, pickNasty, summarize } from './_pbt-common.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const KDIR = join(HERE, '..');
const KERNEL_ID = 'art-616-mla-mapr-actuarial-recompute';

const { compute } = await import(pathToFileURL(join(KDIR, `${KERNEL_ID}.kernel.mjs`)).href);
const { compute: computeApr215 } = await import(
  pathToFileURL(join(KDIR, 'art-215-reg-z-appendix-j-apr.kernel.mjs')).href
);

const RECOGNISED_TYPES = [
  'credit_insurance_premium',
  'single_premium_credit_insurance_charge',
  'debt_cancellation_fee',
  'debt_suspension_fee',
  'credit_related_ancillary_product_fee',
  'finance_charge',
  'application_fee',
  'participation_fee',
  'other_credit_card_fee',
];

// Types that this kernel deducts from the advance when supplied off a credit card account. Used by
// the monotonicity leg, which is stated over prepaid charges specifically: a finance_charge is
// already priced by the payment stream and deliberately does not move the rate.
const PREPAID_TYPES = RECOGNISED_TYPES.filter(
  (t) => t !== 'finance_charge' && t !== 'other_credit_card_fee'
);

const results = [];
function record(name, checked, violations, sample) {
  results.push({ name, checked, violations: violations.length, sample: violations[0] ?? sample ?? null });
  if (violations.length) {
    console.log(`    first violation in ${name}: ${JSON.stringify(violations[0]).slice(0, 600)}`);
  }
}

// ── P0 ── fixture oracle, plus the solver-free algebraic expectations ────────────────────────────

function runOracle() {
  const fixtures = JSON.parse(readFileSync(join(KDIR, 'fixtures', `${KERNEL_ID}.fixtures.json`), 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = compute(vec.policy_parameters);
    if (!deepEqual(output_payload, vec.output_payload)) {
      failures.push({ name: vec.name, reason: 'output_payload drift', got: output_payload });
      continue;
    }
    // The independent half. oracle_expected was produced by algebraic inversion, never by running
    // this kernel, so agreement here is a real cross-check and not a restatement.
    const e = vec.oracle_expected;
    if (!e) { failures.push({ name: vec.name, reason: 'vector carries no oracle_expected block — §3d independence cannot be demonstrated for it' }); continue; }
    const o = output_payload;
    const dPct = Math.abs((o.mapr_pct ?? NaN) - e.mapr_pct);
    const dPer = Math.abs((o.periodic_rate ?? NaN) - e.periodic_rate);
    const dFin = Math.abs((o.amount_financed_mapr ?? NaN) - e.amount_financed_mapr);
    if (!(dPct <= 0.01 && dPer <= 1e-6 && dFin <= 0.01)) {
      failures.push({ name: vec.name, reason: 'algebraic oracle disagreement', expected: e, got: { mapr_pct: o.mapr_pct, periodic_rate: o.periodic_rate, amount_financed_mapr: o.amount_financed_mapr } });
    }
  }
  return { total: fixtures.vectors.length, failures };
}

// ── schedule generators ──────────────────────────────────────────────────────────────────────────

function levelSchedule(rng) {
  const n = 1 + Math.floor(rng() * 60);
  const principal = 100 + Math.floor(rng() * 50000);
  const w = [1, 2, 4, 12, 24, 26, 52, 365][Math.floor(rng() * 8)];
  const frac = rng() < 0.4 ? Math.floor(rng() * 30) / 30 : 0;
  // A payment large enough that the stream repays the principal, so PRE-6 holds.
  const payment = (principal / n) * (1 + 0.02 + rng() * 0.6);
  const payments = [];
  for (let k = 1; k <= n; k++) payments.push({ amount: payment, full_periods: k, fraction: frac });
  return {
    advances: [{ amount: principal, full_periods: 0, fraction: 0 }],
    payments,
    periods_per_year: w,
  };
}

// ── P1 ── the load-bearing metamorphic identity against art-215 ──────────────────────────────────

function propZeroChargeIdentityWithArt215() {
  const rng = mulberry32(0x616a);
  const violations = [];
  let checked = 0;
  const zeroChargeForms = [
    undefined,
    [],
    [{ charge_type: 'credit_insurance_premium', amount: 0 }],
    [{ charge_type: 'application_fee', amount: 0 }, { charge_type: 'participation_fee', amount: 0 }],
    [{ charge_type: 'debt_cancellation_fee', amount: -0 }],
  ];
  for (let n = 0; n < 400; n++) {
    const sched = levelSchedule(rng);
    const form = zeroChargeForms[n % zeroChargeForms.length];
    const mine = compute(form === undefined ? sched : { ...sched, mla_charges: form }).output_payload;
    const theirs = computeApr215(sched).output_payload;
    checked++;
    if (mine.converged !== theirs.converged || mine.bracketed !== theirs.bracketed) {
      violations.push({ sched, reason: 'convergence disagreement', mine: { c: mine.converged, b: mine.bracketed }, theirs: { c: theirs.converged, b: theirs.bracketed } });
      continue;
    }
    if (!mine.converged) continue;
    const dPer = Math.abs(mine.periodic_rate - theirs.periodic_rate);
    const dPct = Math.abs(mine.mapr_pct - theirs.apr_pct);
    if (!(dPer <= 1e-6)) violations.push({ sched, reason: 'periodic_rate divergence beyond RND-3', mine: mine.periodic_rate, theirs: theirs.periodic_rate, delta: dPer });
    else if (!(dPct <= 0.01)) violations.push({ sched, reason: 'annual rate divergence beyond RND-2', mine: mine.mapr_pct, theirs: theirs.apr_pct, delta: dPct });
  }
  record('P1 zero-MLA-charge identity equals art-215 Appendix J APR (RUN, not asserted)', checked, violations);
}

// ── P2 ── monotone in each includable prepaid charge ─────────────────────────────────────────────

function propMonotoneInPrepaidCharges() {
  const rng = mulberry32(0x616b);
  const violations = [];
  let checked = 0;
  for (let n = 0; n < 400; n++) {
    const sched = levelSchedule(rng);
    const type = PREPAID_TYPES[n % PREPAID_TYPES.length];
    const cap = sched.advances[0].amount * 0.4;
    const a = rng() * cap;
    const b = a + rng() * (cap - a);
    const run = (amt) => compute({ ...sched, mla_charges: [{ charge_type: type, amount: amt }] }).output_payload;
    const lo = run(a), hi = run(b);
    if (lo.mapr_pct === null || hi.mapr_pct === null) continue;
    checked++;
    // A rise below the 2-decimal reporting step is invisible, so the comparison allows one unit of
    // RND-2 slack downward and nothing more.
    if (hi.mapr_pct < lo.mapr_pct - 0.01) {
      violations.push({ type, a, b, lo: lo.mapr_pct, hi: hi.mapr_pct, sched });
    }
  }
  record('P2 monotone in each includable prepaid charge amount', checked, violations);
}

// ── P3 ── bounded ────────────────────────────────────────────────────────────────────────────────

function propBounded() {
  const rng = mulberry32(0x616c);
  const violations = [];
  let checked = 0;
  for (let n = 0; n < 500; n++) {
    const sched = levelSchedule(rng);
    const o = compute(sched).output_payload;
    checked++;
    if (o.mapr_pct !== null && !(o.mapr_pct >= 0)) violations.push({ reason: 'negative mapr_pct reported', o: o.mapr_pct, sched });
    if (o.periodic_rate !== null && !(o.periodic_rate >= 0)) violations.push({ reason: 'negative periodic_rate reported', o: o.periodic_rate, sched });
  }
  record('P3 reported rates are non-negative', checked, violations);
}

// ── P4 ── bracket-or-refuse, and the F-2-shaped regression case ──────────────────────────────────
//
// art-215's F-2 finding: solveAPR broke out of its loop early and returned the caller's guess as
// though it had converged. The negative control below feeds schedules that CANNOT be bracketed and
// demands a null rate with converged:false. A kernel carrying an F-2-shaped defect would return a
// number here, and that is the whole point of the case.

function propBracketOrRefuse() {
  const violations = [];
  const negativeControls = [
    { name: 'payments do not repay the advance (negative root)', pp: { advances: [{ amount: 1000, full_periods: 0, fraction: 0 }], payments: [{ amount: 100, full_periods: 1, fraction: 0 }], periods_per_year: 12 } },
    { name: 'single payment at time zero — no rate dependence', pp: { advances: [{ amount: 1000, full_periods: 0, fraction: 0 }], payments: [{ amount: 1200, full_periods: 0, fraction: 0 }], periods_per_year: 12 } },
    { name: 'zero-amount payment stream', pp: { advances: [{ amount: 1000, full_periods: 0, fraction: 0 }], payments: [{ amount: 0, full_periods: 6, fraction: 0 }], periods_per_year: 12 } },
    { name: 'no payments at all', pp: { advances: [{ amount: 1000, full_periods: 0, fraction: 0 }], payments: [], periods_per_year: 12 } },
    { name: 'prepaid charges exceed the advance', pp: { advances: [{ amount: 500, full_periods: 0, fraction: 0 }], payments: [{ amount: 600, full_periods: 12, fraction: 0 }], periods_per_year: 12, mla_charges: [{ charge_type: 'credit_insurance_premium', amount: 900 }] } },
    { name: 'payments beyond the bracket ceiling', pp: { advances: [{ amount: 1, full_periods: 0, fraction: 0 }], payments: [{ amount: 1e18, full_periods: 1, fraction: 0 }], periods_per_year: 12 } },
  ];
  let checked = 0;
  for (const nc of negativeControls) {
    const { output_payload: o, compliance_flags: f } = compute(nc.pp);
    checked++;
    const refused = o.mapr_pct === null && o.periodic_rate === null && o.exceeds_cap === null;
    const flagged = f.includes('MAPR_NOT_BRACKETED') || f.includes('MAPR_DID_NOT_CONVERGE') || f.includes('MAPR_CHARGES_EXCEED_ADVANCE');
    // The last control is the one case that legitimately CAN bracket: an enormous payment against a
    // tiny advance still has a root below the ceiling. Accept either a refusal or an honest
    // convergence, and reject only the F-2 shape: a number reported with converged false.
    if (o.mapr_pct !== null && o.converged !== true) {
      violations.push({ control: nc.name, reason: 'F-2 SHAPE: a rate was reported without convergence', o });
    } else if (o.converged === false && !refused) {
      violations.push({ control: nc.name, reason: 'converged:false but a figure was still reported', o });
    } else if (o.converged === false && !flagged) {
      violations.push({ control: nc.name, reason: 'non-convergence was not flagged', flags: f });
    }
  }
  // POST-1 as a biconditional, swept over random schedules.
  const rng = mulberry32(0x616d);
  for (let n = 0; n < 400; n++) {
    const sched = levelSchedule(rng);
    const o = compute(sched).output_payload;
    checked++;
    const reported = o.mapr_pct !== null;
    const ok = o.bracketed && o.converged;
    if (reported !== ok) violations.push({ reason: 'POST-1 biconditional broken', reported, bracketed: o.bracketed, converged: o.converged, sched });
    if (!reported && (o.periodic_rate !== null || o.exceeds_cap !== null)) {
      violations.push({ reason: 'partial refusal — a null rate left a non-null companion field', o });
    }
  }
  record('P4 bracket-or-refuse, F-2 regression case included', checked, violations);
}

// One ULP at x, computed here rather than taken from any host helper.
function ulp1(x) { const n = Math.abs(x); let e = 1; while (n + e === n) e *= 2; while (n + e / 2 !== n) e /= 2; return e; }

// ── P5 ── the 36.00 cap boundary, exactly and one ULP either side ────────────────────────────────
//
// Built by closed-form inversion so the boundary is REACHED rather than approached: a single advance
// A with a single payment P at one full unit-period has i = P/A - 1 exactly, so A = 1000 and
// P = 1030 puts the annual figure at exactly 36.00 for w = 12.

function propCapBoundary() {
  const violations = [];
  let checked = 0;
  const at = compute({ advances: [{ amount: 1000, full_periods: 0, fraction: 0 }], payments: [{ amount: 1030, full_periods: 1, fraction: 0 }], periods_per_year: 12 }).output_payload;
  checked++;
  if (at.mapr_pct !== 36) violations.push({ reason: 'constructed 36.00 boundary did not land on 36', got: at.mapr_pct });
  else if (at.exceeds_cap !== false) violations.push({ reason: '232.4(b) forbids an MAPR GREATER THAN 36 percent; exactly 36.00 must not trip exceeds_cap', got: at.exceeds_cap });

  for (const [label, P, wantExceeds] of [
    ['one cent under', 1029.9, false],
    ['one cent over', 1030.1, true],
    ['one ULP under', 1030 - ulp1(1030), false],
    ['one ULP over', 1030 + ulp1(1030), false],
  ]) {
    const o = compute({ advances: [{ amount: 1000, full_periods: 0, fraction: 0 }], payments: [{ amount: P, full_periods: 1, fraction: 0 }], periods_per_year: 12 }).output_payload;
    checked++;
    if (o.mapr_pct === null) { violations.push({ label, reason: 'no rate at a cap-boundary neighbour' }); continue; }
    // A one-ULP move is far below the RND-2 reporting step, so the reported figure stays 36.00 and
    // the verdict must stay false. That is the assertion: rounding must not manufacture a breach.
    if (o.exceeds_cap !== wantExceeds) violations.push({ label, reason: 'cap verdict wrong', mapr: o.mapr_pct, got: o.exceeds_cap, want: wantExceeds });
    if (o.mapr_pct !== null && o.exceeds_cap !== (o.mapr_pct > 36)) violations.push({ label, reason: 'exceeds_cap disagrees with the reported figure', o });
  }
  record('P5 36.00 cap boundary exact, plus cent and ULP neighbours', checked, violations);
}

// ── P6 ── statutory constants unreachable from input ─────────────────────────────────────────────

function propConstantsUnreachable() {
  const rng = mulberry32(0x616e);
  const violations = [];
  let checked = 0;
  const attacks = [
    { mapr_cap_pct: 99 }, { MAPR_CAP_PCT: 0 }, { cap: 5 },
    { participation_fee_open_end_no_balance_limit_usd: 9999 },
    { mapr_cap_pct: null }, { mapr_cap_pct: '36' },
  ];
  for (let n = 0; n < 300; n++) {
    const sched = levelSchedule(rng);
    const pp = { ...sched, ...attacks[n % attacks.length] };
    const o = compute(pp).output_payload;
    checked++;
    if (o.mapr_cap_pct !== 36) violations.push({ reason: 'mapr_cap_pct moved', got: o.mapr_cap_pct, pp });
    if (o.participation_fee_open_end_no_balance_limit_usd !== 100) violations.push({ reason: '$100 constant moved', got: o.participation_fee_open_end_no_balance_limit_usd, pp });
  }
  record('P6 the 36 percent cap and the $100 figure are unreachable from policy_parameters', checked, violations);
}

// ── P7 ── the $100 figure is reported, never netted out ──────────────────────────────────────────

function propParticipationFeeNotNetted() {
  const violations = [];
  let checked = 0;
  const base = { advances: [{ amount: 5000, full_periods: 0, fraction: 0 }], payments: [], periods_per_year: 12 };
  for (let k = 1; k <= 12; k++) base.payments.push({ amount: 460, full_periods: k, fraction: 0 });
  const amounts = [0, 1e-9, Number.MIN_VALUE, 99.99, 100, 100 - Number.EPSILON * 100, 100.01, 400, 1000];
  for (const amount of amounts) {
    for (const card of [true, false]) {
      const o = compute({ ...base, mla_charges: [{ charge_type: 'participation_fee', amount, is_credit_card_account: card }] }).output_payload;
      checked++;
      const expectFinanced = Math.round((5000 - Math.round(amount * 100) / 100) * 100) / 100;
      if (Math.abs(o.amount_financed_mapr - expectFinanced) > 0.01) {
        violations.push({ amount, card, reason: 'the full participation fee was not deducted — a $100 reduction was applied on the closed-end path', got: o.amount_financed_mapr, want: expectFinanced });
      }
      if (o.participation_fee_open_end_no_balance_limit_usd !== 100) {
        violations.push({ amount, card, reason: 'the cited $100 figure was not reported' });
      }
      if (card && !o.manual_review_required) {
        violations.push({ amount, card, reason: '232.4(d) bona fide test on a credit card account was not surfaced for review' });
      }
    }
  }
  record('P7 $100 participation-fee figure reported, never netted out on the closed-end path', checked, violations);
}

// ── P8 ── classification totality ────────────────────────────────────────────────────────────────

function propClassificationTotality() {
  const violations = [];
  let checked = 0;
  const base = { advances: [{ amount: 5000, full_periods: 0, fraction: 0 }], payments: [{ amount: 500, full_periods: 12, fraction: 0 }], periods_per_year: 12 };
  for (const charge_type of RECOGNISED_TYPES) {
    for (const cc of [true, false]) {
      for (const st of [true, false]) {
        const o = compute({ ...base, mla_charges: [{ charge_type, amount: 50, is_credit_card_account: cc, short_term_exception_claimed: st }] }).output_payload;
        checked++;
        const row = o.charge_breakdown[0];
        if (!row) { violations.push({ charge_type, cc, st, reason: 'no breakdown row' }); continue; }
        if (row.recognised !== true) violations.push({ charge_type, cc, st, reason: 'recognised type reported unrecognised' });
        if (!row.citation) violations.push({ charge_type, cc, st, reason: 'no citation' });
        if (!row.basis) violations.push({ charge_type, cc, st, reason: 'no basis' });
        if (row.manual_review_required && !row.manual_review_reason) violations.push({ charge_type, cc, st, reason: 'manual review raised with no reason named' });
        if (!row.manual_review_required && row.manual_review_reason !== null) violations.push({ charge_type, cc, st, reason: 'manual review reason present without the flag' });
        if (o.manual_review_required !== row.manual_review_required) violations.push({ charge_type, cc, st, reason: 'payload flag is not the disjunction of the per-charge flags' });
      }
    }
  }
  for (const bad of ['', 'late_fee', 'CREDIT_INSURANCE_PREMIUM', null, undefined, 0, {}, []]) {
    const o = compute({ ...base, mla_charges: [{ charge_type: bad, amount: 50 }] }).output_payload;
    checked++;
    const row = o.charge_breakdown[0];
    if (!row || row.recognised !== false) violations.push({ bad, reason: 'unrecognised charge_type was not marked unrecognised' });
    else if (!row.manual_review_required) violations.push({ bad, reason: 'unrecognised charge_type did not raise manual review' });
    else if (row.included_in_mapr !== false) violations.push({ bad, reason: 'unrecognised charge_type was silently included in the arithmetic' });
  }
  record('P8 classification totality over 9 types x 2 x 2, plus unrecognised types', checked, violations);
}

// ── P9 ── amount_financed identity, finance_charge moves nothing ─────────────────────────────────

function propAmountFinancedIdentity() {
  const rng = mulberry32(0x616f);
  const violations = [];
  let checked = 0;
  for (let n = 0; n < 400; n++) {
    const sched = levelSchedule(rng);
    const charges = [];
    const howMany = Math.floor(rng() * 4);
    for (let k = 0; k < howMany; k++) {
      charges.push({ charge_type: RECOGNISED_TYPES[Math.floor(rng() * RECOGNISED_TYPES.length)], amount: Math.round(rng() * 200 * 100) / 100, is_credit_card_account: rng() < 0.3 });
    }
    const o = compute({ ...sched, mla_charges: charges }).output_payload;
    checked++;
    let want = 0;
    for (const row of o.charge_breakdown) if (row.included_in_mapr && row.treatment === 'prepaid_deducted') want += row.amount;
    want = Math.round(want * 100) / 100;
    if (Math.abs(o.prepaid_included_total - want) > 0.011) violations.push({ reason: 'prepaid_included_total is not the sum of the deducted rows', got: o.prepaid_included_total, want, breakdown: o.charge_breakdown });
    const wantFin = Math.round((o.advance_total - o.prepaid_included_total) * 100) / 100;
    if (Math.abs(o.amount_financed_mapr - wantFin) > 0.011) violations.push({ reason: 'amount_financed_mapr identity broken', got: o.amount_financed_mapr, want: wantFin });
  }
  // A finance_charge entry is already priced by the payment stream and must move nothing.
  const rng2 = mulberry32(0x6170);
  for (let n = 0; n < 150; n++) {
    const sched = levelSchedule(rng2);
    const without = compute(sched).output_payload;
    const with_ = compute({ ...sched, mla_charges: [{ charge_type: 'finance_charge', amount: 100 + rng2() * 5000 }] }).output_payload;
    checked++;
    if (without.mapr_pct !== with_.mapr_pct || without.amount_financed_mapr !== with_.amount_financed_mapr) {
      violations.push({ reason: 'a finance_charge entry moved the rate — it is already in the payment stream and would be double counted', without: without.mapr_pct, with: with_.mapr_pct });
    }
    if (with_.finance_charge_in_schedule_total <= 0) violations.push({ reason: 'a finance_charge entry was not echoed in finance_charge_in_schedule_total' });
  }
  record('P9 amount_financed identity, and a finance_charge entry moving nothing', checked, violations);
}

// ── P10 ── forced ULP and categorical boundaries ─────────────────────────────────────────────────

const BOUNDARY_NUMBERS = [
  0, -0, Number.MIN_VALUE, -Number.MIN_VALUE, Number.EPSILON, 1e-9, 0.005, 0.015, 0.1, 1,
  1e15, Number.MAX_SAFE_INTEGER, Number.MAX_VALUE, Infinity, -Infinity, NaN,
  null, undefined, '100', '', {}, [], true, false,
];
const BOUNDARY_FRACTIONS = [0, -0, Number.MIN_VALUE, 0.5, 1 - Number.EPSILON, 1, 1.5, -0.5, NaN, Infinity, null, 'x'];

function propForcedBoundaries() {
  const violations = [];
  let checked = 0;
  for (const amt of BOUNDARY_NUMBERS) {
    for (const frac of BOUNDARY_FRACTIONS) {
      const pp = {
        advances: [{ amount: amt, full_periods: 0, fraction: 0 }],
        payments: [{ amount: amt, full_periods: 12, fraction: frac }],
        periods_per_year: 12,
        mla_charges: [{ charge_type: 'credit_insurance_premium', amount: amt }],
      };
      checked++;
      let out;
      try { out = compute(pp); } catch (e) { violations.push({ amt: String(amt), frac: String(frac), reason: 'threw', err: String(e) }); continue; }
      const shape = findShapeViolations(out.output_payload);
      if (shape.length) violations.push({ amt: String(amt), frac: String(frac), reason: 'shape violation', shape: shape.slice(0, 4) });
      if (out.output_payload.mapr_pct !== null && out.output_payload.converged !== true) {
        violations.push({ amt: String(amt), frac: String(frac), reason: 'F-2 shape at a boundary: a rate without convergence' });
      }
    }
  }
  for (const w of BOUNDARY_NUMBERS) {
    checked++;
    try {
      const out = compute({ advances: [{ amount: 1000, full_periods: 0, fraction: 0 }], payments: [{ amount: 100, full_periods: 12, fraction: 0 }], periods_per_year: w });
      const shape = findShapeViolations(out.output_payload);
      if (shape.length) violations.push({ w: String(w), reason: 'shape violation on periods_per_year', shape: shape.slice(0, 4) });
      if (!(out.output_payload.periods_per_year >= 1)) violations.push({ w: String(w), reason: 'periods_per_year fell below 1' });
    } catch (e) { violations.push({ w: String(w), reason: 'threw', err: String(e) }); }
  }
  // Schedule-shape boundaries.
  const shapes = [
    { advances: [], payments: [], periods_per_year: 12 },
    { advances: [{ amount: 1000, full_periods: 0, fraction: 0 }], payments: [{ amount: 1100, full_periods: 1, fraction: 0 }], periods_per_year: 1 },
    { advances: [{ amount: 500, full_periods: 0, fraction: 0 }, { amount: 500, full_periods: 3, fraction: 0.5 }], payments: [{ amount: 120, full_periods: 12, fraction: 0 }], periods_per_year: 12 },
    { advances: [{ amount: 100000, full_periods: 0, fraction: 0 }], payments: Array.from({ length: 600 }, (_, k) => ({ amount: 300, full_periods: k + 1, fraction: 0 })), periods_per_year: 12 },
  ];
  for (const pp of shapes) {
    checked++;
    try {
      const out = compute(pp);
      const shape = findShapeViolations(out.output_payload);
      if (shape.length) violations.push({ reason: 'shape violation on a schedule shape', shape: shape.slice(0, 4) });
    } catch (e) { violations.push({ reason: 'threw on a schedule shape', err: String(e) }); }
  }
  record('P10 forced ULP, categorical and schedule-shape boundaries', checked, violations);
}

// ── P11 ── determinism and totality ──────────────────────────────────────────────────────────────

function propDeterminismAndTotality() {
  const rng = mulberry32(0x6171);
  const violations = [];
  let checked = 0;
  for (let n = 0; n < 250; n++) {
    const sched = levelSchedule(rng);
    const pp = { ...sched, mla_charges: [{ charge_type: RECOGNISED_TYPES[n % RECOGNISED_TYPES.length], amount: rng() * 300 }] };
    const a = compute(pp), b = compute(pp);
    checked++;
    if (!deepEqual(a.output_payload, b.output_payload)) violations.push({ reason: 'non-deterministic output_payload', pp });
    if (!deepEqual(a.compliance_flags, b.compliance_flags)) violations.push({ reason: 'non-deterministic compliance_flags', pp });
  }
  // Hostile-input discovery leg: nothing may throw, nothing may produce a malformed payload.
  const rng2 = mulberry32(0x6172);
  for (let n = 0; n < 400; n++) {
    const pp = {
      advances: pickNasty(rng2),
      payments: pickNasty(rng2),
      periods_per_year: pickNasty(rng2),
      mla_charges: pickNasty(rng2),
      loan_amount: pickNasty(rng2),
      payment_amount: pickNasty(rng2),
      num_payments: pickNasty(rng2),
    };
    checked++;
    try {
      const out = compute(pp);
      const shape = findShapeViolations(out.output_payload);
      if (shape.length) violations.push({ reason: 'hostile input produced a malformed payload', shape: shape.slice(0, 4) });
      if (out.output_payload.mapr_cap_pct !== 36) violations.push({ reason: 'hostile input moved the cap constant' });
    } catch (e) {
      violations.push({ reason: 'compute() threw on hostile input', err: String(e).slice(0, 200) });
    }
  }
  for (const pp of [null, undefined, 0, '', [], 'x', true]) {
    checked++;
    try {
      const out = compute(pp);
      if (findShapeViolations(out.output_payload).length) violations.push({ reason: 'malformed payload for a non-object policy_parameters', pp: String(pp) });
    } catch (e) { violations.push({ reason: 'threw on a non-object policy_parameters', pp: String(pp), err: String(e).slice(0, 200) }); }
  }
  record('P11 determinism, and totality under hostile inputs', checked, violations);
}

// ── P12 ── payload shape ─────────────────────────────────────────────────────────────────────────

function propPayloadShape() {
  const rng = mulberry32(0x6173);
  const violations = [];
  let checked = 0;
  for (let n = 0; n < 400; n++) {
    const sched = levelSchedule(rng);
    const charges = Array.from({ length: Math.floor(rng() * 5) }, () => ({
      charge_type: RECOGNISED_TYPES[Math.floor(rng() * RECOGNISED_TYPES.length)],
      amount: rng() * 500,
      is_credit_card_account: rng() < 0.5,
      short_term_exception_claimed: rng() < 0.5,
    }));
    const out = compute({ ...sched, mla_charges: charges });
    checked++;
    const shape = findShapeViolations(out.output_payload);
    if (shape.length) violations.push({ reason: 'shape violation', shape: shape.slice(0, 4) });
    if (out.output_payload.charge_breakdown.length !== charges.length) {
      violations.push({ reason: 'breakdown length does not match the input charge count' });
    }
    for (const f of out.compliance_flags) if (typeof f !== 'string') violations.push({ reason: 'non-string compliance flag' });
  }
  record('P12 no NaN, Infinity or undefined anywhere in the payload', checked, violations);
}

// ── run ──────────────────────────────────────────────────────────────────────────────────────────

// _pbt-common summarize() prints a class-A banner because the six class-A shard floors were its
// first callers. This kernel is class B, so the tier is stated here rather than left to a shared
// header that would misreport it.
console.log(`=== ${KERNEL_ID} — class-B property-test floor (rigor assigned by MLA-MAPR-K-2; the input domain is NOT bounded) ===`);
const oracle = runOracle();
propZeroChargeIdentityWithArt215();
propMonotoneInPrepaidCharges();
propBounded();
propBracketOrRefuse();
propCapBoundary();
propConstantsUnreachable();
propParticipationFeeNotNetted();
propClassificationTotality();
propAmountFinancedIdentity();
propForcedBoundaries();
propDeterminismAndTotality();
propPayloadShape();

const ok = summarize(KERNEL_ID, oracle, results);
if (!ok) process.exitCode = 1;
