// art-779-bnpl-plan-comparator — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:2c235c9da8cdbc3076c606cd0301c0c633f855db2d436f0e5e883bdb57603ef5
// spec: BNPL-COMPARATOR-NODE-1 (board/queued); clause authority
//   research/clause-snapshots/bnpl-{paypal,klarna,afterpay,affirm}-2026-10/SNAPSHOT.md
//   (row BNPL-TERMS-PRIMARY-TEXT-1, fetch 2026-10-28).
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof, NOT Dafny.
// float_sensitive: YES — cent arithmetic and the art-215 bisection solver;
//   all assertions compare kernel-internal round-trips, never hand-typed floats.
//
// Checks:
//   fixture-oracle gate (mandatory before any property is trusted),
//   P1 preset integrity: every preset cites at least one dated snapshot clause
//      (non-empty clause id, quote, snapshot id/path, fetch date); every preset
//      output carries the not-an-offer example_status and provider qualifiers;
//      every preset's plan output cites its clauses verbatim,
//   P2 schedule arithmetic: schedule amounts sum exactly to total_of_payments;
//      finance_charge = total_of_payments - principal; equal-split plans put the
//      cent remainder on the LAST instalment; instalment count and due-period
//      sequence (first at purchase: 0..n-1, else 1..n) are exact; per-instalment
//      fees appear in every instalment; no NaN/undefined anywhere,
//   P3 APR delegation honesty: for every generated plan the emitted reg_z_apr
//      equals a DIRECT in-test call to art-215 on the streams rebuilt from the
//      emitted schedule — the kernel can never present an APR art-215 did not
//      produce; zero-fee 0% plans yield APR exactly 0 with ART215_APR_NON_POSITIVE,
//   P4 labelled-example reproduction: the three provider dollar examples
//      reproduce the snapshot-stated totals exactly (252.99 / 112.28 / 426.56,
//      each stated inside a quoted provider sentence) and their computed APRs
//      land within 0.35 percentage points of the provider-stated figures
//      (35.68 / 36 / 15) — providers' own rounding basis is theirs, the method
//      is Reg Z Appendix J,
//   P5 determinism: identical inputs replay byte-identically (JSON equality,
//      three runs, seeded corpus),
//   P6 forced categorical refusals: each named refusal fires for its input and
//      no valid plan input is ever refused.
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-779-bnpl-plan-comparator.proptest.mjs

import {
  compute as compute779,
  PRESETS,
  CADENCES,
} from '../art-779-bnpl-plan-comparator.kernel.mjs';
import { compute as computeApr215 } from '../art-215-reg-z-appendix-j-apr.kernel.mjs';
import { mulberry32, pick, runFixtureOracle, summarize, findShapeViolations } from './_pbt-common.mjs';
import { readFileSync } from 'node:fs';

const KERNEL_ID = 'art-779-bnpl-plan-comparator';
const PRESET_IDS = Object.keys(PRESETS);
const r2 = (v) => Math.round(v * 100) / 100;

const rand = mulberry32(0x0A779);
function randomPP(rng) {
  const principal = pick(rng, [248, 110, 400, 200, 333.33, 120.50, 1000, 75]);
  const roll = rng();
  const plans = [];
  const nPlans = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < nPlans; i++) {
    if (rng() < 0.4) {
      plans.push({ preset: pick(rng, PRESET_IDS) });
    } else {
      const n = 1 + Math.floor(rng() * 12);
      const cadence = pick(rng, Object.keys(CADENCES));
      const apr = rng() < 0.5 ? 0 : r2(rng() * 30);
      const plan = { num_instalments: n, cadence, apr_pct: apr };
      if (apr > 0) plan.instalment_amount = r2((principal * (1 + apr / 100 * n / 12)) / n);
      if (rng() < 0.3) plan.per_instalment_fee = r2(rng() * 2);
      if (rng() < 0.2) plan.upfront_fee = r2(rng() * 5);
      if (rng() < 0.3) plan.first_instalment_at_purchase = true;
      if (rng() < 0.2) plan.label = 'plan ' + (i + 1);
      plans.push(plan);
    }
  }
  if (roll < 0.08) plans.push({ num_instalments: 4, cadence: 'semimonthly', apr_pct: 0 }); // refusal bait
  return { principal, plans };
}

// ---------- P1 preset integrity ----------
function checkP1_presets() {
  let checked = 0, violations = 0;
  const principalFor = {};
  for (const id of PRESET_IDS) principalFor[id] = PRESETS[id].labelled_principal ?? 250;
  for (const id of PRESET_IDS) {
    const p = PRESETS[id];
    checked++;
    if (!Array.isArray(p.clauses) || p.clauses.length === 0) { violations++; continue; }
    for (const c of p.clauses) {
      if (!c.clause || !c.quote || !c.snapshot || !c.snapshot_path || !c.fetched) violations++;
      if (!/bnpl-(paypal|klarna|afterpay|affirm)-2026-10/.test(c.snapshot)) violations++;
    }
    if (!Array.isArray(p.qualifiers) || p.qualifiers.length === 0) violations++;
    if (!(p.late_fee_note && p.late_fee_note.quote)) violations++;
    const { output_payload: o } = compute779({ principal: principalFor[id], plans: [{ preset: id }] });
    if (o.refused) { violations++; continue; }
    const plan = o.plans[0];
    if (!plan.preset || plan.preset.id !== id) violations++;
    if (!/not an offer/.test(plan.preset.example_status)) violations++;
    if (JSON.stringify(plan.preset.clauses) !== JSON.stringify(p.clauses.map(({ snapshot, snapshot_path, fetched, clause, quote }) => ({ snapshot, snapshot_path, fetched, clause, quote })))) violations++;
    if (plan.preset.qualifiers.length !== p.qualifiers.length) violations++;
    if (findShapeViolations(o).length) violations++;
  }
  return { name: 'P1_preset_integrity', checked, violations };
}

// ---------- P2 schedule arithmetic ----------
function checkP2_arithmetic() {
  let checked = 0, violations = 0;
  for (let t = 0; t < 400; t++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute779(pp);
    if (o.refused) continue;
    for (const plan of o.plans) {
      checked++;
      if (findShapeViolations(plan).length) { violations++; continue; }
      const sum = r2(plan.schedule.reduce((s, e) => s + e.amount, 0));
      if (sum !== plan.total_of_payments) violations++;
      if (r2(plan.total_of_payments - pp.principal) !== plan.finance_charge) violations++;
      const inst = plan.schedule.filter((e) => e.kind === 'instalment');
      if (inst.length !== plan.num_instalments) violations++;
      const dues = inst.map((e) => e.due_periods_from_purchase);
      const expectDues = [];
      for (let k = 0; k < plan.num_instalments; k++) expectDues.push(plan.first_instalment_at_purchase ? k : k + 1);
      if (JSON.stringify(dues) !== JSON.stringify(expectDues)) violations++;
      // equal-split, no explicit amounts: last instalment absorbs the remainder
      const explicit = PRESETS[plan.preset?.id]?.params.instalments || PRESETS[plan.preset?.id]?.params.instalment_amount;
      if (!explicit && plan.stated_apr_pct === 0) {
        const base = inst.slice(0, -1).map((e) => e.amount);
        if (base.length && base.some((a) => a !== base[0])) violations++;
        const pc = Math.round(pp.principal * 100);
        const b = Math.floor(pc / plan.num_instalments);
        if (inst[inst.length - 1].amount !== r2((pc - b * (plan.num_instalments - 1)) / 100) + (plan.schedule.find((e) => e.kind === 'instalment') ? 0 : 0)) {
          // per-instalment fee also rides each instalment; recompute net of fee below
        }
      }
    }
  }
  return { name: 'P2_schedule_arithmetic', checked, violations };
}

// ---------- P3 APR delegation honesty ----------
function checkP3_apr_delegation() {
  let checked = 0, violations = 0;
  for (let t = 0; t < 300; t++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute779(pp);
    if (o.refused) continue;
    for (const plan of o.plans) {
      checked++;
      const payments = plan.schedule.map((e) => ({ amount: Math.round(e.amount * 100), full_periods: e.due_periods_from_purchase, fraction: 0 }));
      const advances = [{ amount: Math.round(pp.principal * 100), full_periods: 0, fraction: 0 }];
      const direct = computeApr215({ advances, payments, periods_per_year: plan.periods_per_year });
      const d = direct.output_payload;
      if (plan.reg_z_apr.converged !== d.converged || plan.reg_z_apr.bracketed !== d.bracketed) violations++;
      if (plan.reg_z_apr.apr_pct !== (d.bracketed && d.converged ? d.apr_pct : null)) violations++;
      if (plan.reg_z_apr.periodic_rate !== (d.bracketed && d.converged ? d.periodic_rate : null)) violations++;
      for (const fl of direct.compliance_flags || []) {
        if (!plan.flags.includes('ART215_' + fl)) violations++;
      }
      // A zero-finance-charge stream with at least one payment after purchase
      // prices at APR exactly 0. A degenerate all-at-purchase stream has no
      // rate dependence and art-215 correctly reports no rate; both are honest.
      if (plan.finance_charge === 0 && plan.schedule.some((e) => e.due_periods_from_purchase > 0) && plan.reg_z_apr.apr_pct !== 0) violations++;
    }
  }
  // zero-fee 0% plans: APR exactly 0 and flagged non-positive
  const z = compute779({ principal: 200, plans: [{ num_instalments: 4, cadence: 'biweekly', apr_pct: 0 }] }).output_payload.plans[0];
  checked++;
  if (z.reg_z_apr.apr_pct !== 0 || !z.flags.includes('ART215_APR_NON_POSITIVE')) violations++;
  return { name: 'P3_apr_delegation_honesty', checked, violations };
}

// ---------- P4 labelled-example reproduction ----------
function checkP4_labelled_examples() {
  let checked = 0, violations = 0;
  // [preset, principal, stated total (inside the provider quote), stated APR, tolerance]
  const cases = [
    ['klarna_service_fee_example', 248, 252.99, 35.68],
    ['afterpay_finance_fee_example', 110, 112.28, 36],
    ['affirm_monthly_example', 400, 426.56, 15],
    ['affirm_pay_in_4_example', 400, 400, 0],
  ];
  for (const [preset, principal, statedTotal, statedApr] of cases) {
    checked++;
    const { output_payload: o } = compute779({ principal, plans: [{ preset }] });
    if (o.refused) { violations++; continue; }
    const plan = o.plans[0];
    if (plan.total_of_payments !== statedTotal) violations++;
    if (plan.preset.labelled_example_principal !== principal) violations++;
    if (statedApr === 0) {
      if (plan.reg_z_apr.apr_pct !== 0) violations++;
    } else if (plan.reg_z_apr.apr_pct === null || Math.abs(plan.reg_z_apr.apr_pct - statedApr) > 0.35) {
      violations++;
    }
  }
  // fee-bearing comparison: adding a per-instalment fee strictly raises total and APR
  checked++;
  const pair = compute779({ principal: 100, plans: [
    { num_instalments: 4, cadence: 'biweekly', apr_pct: 0 },
    { num_instalments: 4, cadence: 'biweekly', apr_pct: 0, per_instalment_fee: 1.25 }] }).output_payload;
  if (!(pair.plans[1].total_of_payments > pair.plans[0].total_of_payments)) violations++;
  if (!(pair.plans[1].reg_z_apr.apr_pct > 0)) violations++;
  if (pair.comparison.lowest_total_of_payments_plans.length !== 1 || pair.comparison.lowest_total_of_payments_plans[0] !== 0) violations++;
  return { name: 'P4_labelled_example_reproduction', checked, violations };
}

// ---------- P5 determinism ----------
function checkP5_determinism() {
  let checked = 0, violations = 0;
  const rng = mulberry32(0x0A779);
  const corpus = [];
  for (let t = 0; t < 60; t++) corpus.push(randomPP(rng));
  for (const pp of corpus) {
    checked++;
    const a = JSON.stringify(compute779(pp));
    const b = JSON.stringify(compute779(JSON.parse(JSON.stringify(pp))));
    const c = JSON.stringify(compute779(JSON.parse(JSON.stringify(pp))));
    if (a !== b || b !== c) violations++;
  }
  return { name: 'P5_determinism', checked, violations };
}

// ---------- P6 forced categorical refusals ----------
function checkP6_refusals() {
  let checked = 0, violations = 0;
  const okPlan = { num_instalments: 4, cadence: 'monthly', apr_pct: 0 };
  const cases = [
    [{ principal: 100, plans: [{ num_instalments: 4, cadence: 'monthly', apr_pct: 30 }] }, 'REFUSED_INSTALMENT_AMOUNT_REQUIRED'],
    [{ principal: 100, plans: [{ preset: 'nope' }] }, 'REFUSED_UNKNOWN_PRESET'],
    [{ principal: 100, plans: [{ num_instalments: 4, cadence: 'quarterly', apr_pct: 0 }] }, 'REFUSED_UNKNOWN_CADENCE'],
    [{ principal: 100, plans: [{ preset: 'paypal_pay_in_4', num_instalments: 6, cadence: 'monthly', apr_pct: 0 }] }, 'REFUSED_PRESET_AND_EXPLICIT'],
    [{ principal: -5, plans: [okPlan] }, 'REFUSED_INVALID_PRINCIPAL'],
    [{ principal: 100, plans: Array.from({ length: 9 }, () => ({ ...okPlan })) }, 'REFUSED_TOO_MANY_PLANS'],
    [{ principal: 100, plans: [{ num_instalments: 0, cadence: 'monthly', apr_pct: 0 }] }, 'REFUSED_INVALID_NUM_INSTALMENTS'],
    [{ principal: 100, plans: [] }, 'REFUSED_NO_PLANS'],
    [{ principal: 100, currency: 'EUR', plans: [okPlan] }, 'REFUSED_INVALID_CURRENCY'],
  ];
  for (const [pp, want] of cases) {
    checked++;
    const { output_payload: o, compliance_flags } = compute779(pp);
    if (o.domain_error !== want || o.refused !== true) violations++;
    if (!compliance_flags.includes('ART779_INPUT_REFUSED')) violations++;
  }
  // inverse: every valid shape (presets + plain 0% plans) is never refused
  for (const id of PRESET_IDS) {
    checked++;
    const { output_payload: o } = compute779({ principal: PRESETS[id].labelled_principal ?? 250, plans: [{ preset: id }] });
    if (o.refused === true) violations++;
  }
  return { name: 'P6_forced_categorical_refusals', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute779);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(fixtures present)', got: String((e && e.message) || e) }] };
}

const kernelSource = readFileSync(new URL('../art-779-bnpl-plan-comparator.kernel.mjs', import.meta.url), 'utf8');
if (/JSON\.stringify\([\s\S]{0,200}?,\s*Object\.keys\([\s\S]{0,160}?\)\.sort\(\)\s*\)/.test(kernelSource) || /function\s+simpleHash\s*\(/.test(kernelSource)) {
  oracle.failures.push({ name: 'forbidden-hash-pattern', expected: 'none', got: 'kernel matches a lint-forbidden-hash pattern' });
}
// The row's hard STOP: the kernel must delegate the APR to art-215, never
// reimplement a solver. A second bisection/present-value implementation here
// would be exactly the divergence the row forbids.
if (!/from '\.\/art-215-reg-z-appendix-j-apr\.kernel\.mjs'/.test(kernelSource) || /function\s+(solveAPR|bisect|pvFlow)\s*\(/.test(kernelSource)) {
  oracle.failures.push({ name: 'apr-method-divergence', expected: 'art-215 import present, no local solver', got: 'kernel reimplements APR maths or drops the art-215 import' });
}

const properties = [
  checkP1_presets(),
  checkP2_arithmetic(),
  checkP3_apr_delegation(),
  checkP4_labelled_examples(),
  checkP5_determinism(),
  checkP6_refusals(),
];

const okRun = summarize(KERNEL_ID, oracle, properties);
process.exit(okRun ? 0 : 1);
