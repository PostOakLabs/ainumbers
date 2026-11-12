// art-713-scorp-election-break-even.proptest.mjs — class-K property-test FLOOR
// (FV-PBT-FLOOR-BUILD-SPEC.md). Authored against the APEX-PORT payload
// APEXPORT-SC111 (GRADES 8fb2772d) as modified by the D4 adjudication of
// record (row APEX-PORT-ART713-1, Tim 2026-10-06: the 92.35% SE factor applies
// to SE net earnings only, IRS Topic 554, never W-2 wages — port the CORRECT
// treatment) and Tim's three ADD/MODIFY items (2026 wage-base cap logic, QBI
// section 199A trade-off at the adjudicated 19.8% effective rate with
// threshold/SSTB caveats, admin-cost ~$1,500–3,000/yr guidance band).
// kernel_digest_at_authoring: sha256:7e1af77a80f8ba34c85d5ad070e0625aea5118c66bb72f50380f9413001b07f8
//
// SCOPE: floor tier only. NOT a proof, NOT Dafny. Internal engineering QC only.
// float_sensitive: PARTIAL — the kernel is float arithmetic rounded to cents
// (round2 = Math.round(x*100)/100); P1/P2 restate the tax formulas
// independently and compare at exact cent equality (the same float ops in the
// same order, so equality is the contract), while P3 uses a half-cent
// tolerance where two independently rounded quantities are subtracted.
//
// Checks: fixture-oracle gate (v1..v16, two-sided boundary pairs for the
// savings comparator and the QBI-adjusted comparator); P1 the S-Corp payroll
// tax is FULL-WAGE FICA (min(salary, 184500)·12.4% + salary·2.9%, uncapped
// Medicare) — the D4 adjudication property, never the 0.9235-on-wages form
// Apex #111 ships; P2 wage-base cap logic on both sides (SS portions cap at
// $184,500, Medicare continues uncapped above); P3 the verdict comparator is
// exactly net_annual_savings >= 0 and the payload identity holds to a cent;
// P4 the break-even grid property (first crossed 500-step: savings at the
// returned income reach the admin cost and one step below it does not, and
// the QBI-adjusted scanner satisfies the same property); P5 determinism
// (byte-identical reruns), output shape (no undefined/NaN/non-finite), and
// admin-cost monotonicity (raising the admin cost never raises
// net_annual_savings).
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-713-scorp-election-break-even.proptest.mjs

import { compute } from '../art-713-scorp-election-break-even.kernel.mjs';
import { runFixtureOracle, summarize, findShapeViolations, mulberry32, pick } from './_pbt-common.mjs';

const KERNEL_ID = 'art-713-scorp-election-break-even';
const SS_WAGE_BASE = 184500;
const SS_RATE = 0.124;
const MC_RATE = 0.029;
const SE_FACTOR = 0.9235;
const QBI_TRADEOFF_EFFECTIVE_RATE = 0.198;

// ---------- shared random domain (declared-domain inputs only) ----------

function baseInputs(rng, over = {}) {
  const net = 20000 + Math.floor(rng() * 1980001 / 1000) * 1000; // 20,000..2,000,000 on 1,000 steps (Apex #netIncome bounds)
  return {
    net_se_income: net,
    reasonable_salary_pct: pick(rng, [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100]),
    annual_admin_cost: 500 + Math.floor(rng() * 60) * 500, // 500..30,000 (Apex #adminCost bounds)
    owner_health_premium_annual: Math.floor(rng() * 21) * 500,
    filing_status: rng() < 0.5 ? 'single' : 'mfj',
    ...over,
  };
}

/** the adjudicated full-wage FICA formula, restated here independently */
function scorpTaxIndependent(salary) {
  return Math.min(salary, SS_WAGE_BASE) * SS_RATE + salary * MC_RATE;
}
/** the sole-prop SE tax, restated independently (SS capped on the 92.35% base, Medicare uncapped) */
function solePropTaxIndependent(net) {
  const netSE = net * SE_FACTOR;
  return Math.min(netSE, SS_WAGE_BASE) * SS_RATE + netSE * MC_RATE;
}

// ---------- properties ----------

// P1 (D4 adjudication of record): the S-Corp payroll tax is the FULL-WAGE
// FICA formula — employer+employee SS capped at the 2026 base, Medicare
// uncapped — for every declared-domain draw. The Apex #111 form (wage ×
// 0.9235 first) would differ by 7.65% of the wage and must never appear.
function checkFullWageFica() {
  const rng = mulberry32(713001);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 120; i++) {
    const pp = baseInputs(rng);
    const { output_payload } = compute(pp);
    const salary = pp.net_se_income * (pp.reasonable_salary_pct / 100);
    checked++;
    const want = Math.round(scorpTaxIndependent(salary) * 100) / 100;
    if (output_payload.scorp_payroll_tax !== want) violations++;
    // and it is never the Apex 0.9235-on-wages form when that form differs
    const apexForm = Math.round((salary * SE_FACTOR * (SS_RATE + MC_RATE)) * 100) / 100;
    if (apexForm !== want) {
      checked++;
      if (output_payload.scorp_payroll_tax === apexForm) violations++;
    }
  }
  return { name: 'P1 the S-Corp payroll tax is full-wage FICA, never the 0.9235-on-wages form (D4 of record)', checked, violations };
}

// P2 wage-base cap logic: with net >= 200,000 the sole-prop 92.35% base
// (>= 184,700) already exceeds the wage base, so its SS leg is capped at
// 184500·12.4% while Medicare continues uncapped on the full base; on the
// S-Corp side the SS leg caps exactly when the salary exceeds 184,500 and
// stays uncapped (salary·15.3%) when it does not. Formulas restated
// independently.
function checkWageBaseCaps() {
  const rng = mulberry32(713002);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 60; i++) {
    const net = 200000 + Math.floor(rng() * 1800001 / 1000) * 1000;
    const pct = rng() < 0.5 ? 100 : pick(rng, [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100]);
    const pp = baseInputs(rng, { net_se_income: net, reasonable_salary_pct: pct });
    const { output_payload } = compute(pp);
    const salary = net * (pct / 100);
    const netSE = net * SE_FACTOR;
    // sole-prop side: base exceeds the wage base, SS leg capped, Medicare uncapped
    checked += 2;
    if (!(netSE > SS_WAGE_BASE)) violations++;
    if (output_payload.sole_prop_se_tax !== Math.round((SS_WAGE_BASE * SS_RATE + netSE * MC_RATE) * 100) / 100) violations++;
    // S-Corp side: cap engaged exactly when the salary exceeds the base
    checked++;
    if (salary > SS_WAGE_BASE) {
      if (output_payload.scorp_payroll_tax !== Math.round((SS_WAGE_BASE * SS_RATE + salary * MC_RATE) * 100) / 100) violations++;
      checked++;
      // the cap is visible: strictly less than the uncapped-SS total
      if (!(output_payload.scorp_payroll_tax < salary * (SS_RATE + MC_RATE))) violations++;
    } else {
      if (output_payload.scorp_payroll_tax !== Math.round((salary * (SS_RATE + MC_RATE)) * 100) / 100) violations++;
    }
  }
  return { name: 'P2 wage-base caps: SS capped at 184500 when the base exceeds it, Medicare uncapped', checked, violations };
}

// P3 the verdict comparator: verdict is SCORP_WINS iff net_annual_savings >= 0,
// and net_annual_savings equals se_tax_savings minus annual_admin_cost to a
// cent (two independently rounded quantities, half-cent tolerance).
function checkVerdictComparator() {
  const rng = mulberry32(713003);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 100; i++) {
    const pp = baseInputs(rng);
    const { output_payload } = compute(pp);
    checked += 2;
    if ((output_payload.verdict === 'SCORP_WINS') !== (output_payload.net_annual_savings >= 0)) violations++;
    if (Math.abs(output_payload.net_annual_savings - (output_payload.se_tax_savings - output_payload.annual_admin_cost)) > 0.011) violations++;
    checked++;
    if (output_payload.net_annual_savings_qbi_adjusted !== Math.round((output_payload.se_tax_savings - output_payload.qbi_199a_value_at_risk - output_payload.annual_admin_cost) * 100) / 100
      && Math.abs(output_payload.net_annual_savings_qbi_adjusted - (output_payload.se_tax_savings - output_payload.qbi_199a_value_at_risk - output_payload.annual_admin_cost)) > 0.011) violations++;
  }
  return { name: 'P3 verdict is exactly net_annual_savings >= 0; payload identity holds to a cent', checked, violations };
}

// P4 the break-even grid property (both scanners): for a non-null
// break_even_income, savings at the returned income reach the admin cost and,
// one 500-step below (when above the scan floor), do not; the QBI-adjusted
// scanner satisfies the same two-sided property at qbi_adjusted_break_even_income.
// savings is restated independently from the P1/P2 tax formulas.
function checkBreakEvenBoundary() {
  const rng = mulberry32(713004);
  let checked = 0;
  let violations = 0;
  const savingsOf = (inc, pct) => solePropTaxIndependent(inc) - scorpTaxIndependent(inc * (pct / 100));
  for (let i = 0; i < 80; i++) {
    const pp = baseInputs(rng);
    const { output_payload } = compute(pp);
    const be = output_payload.break_even_income;
    if (be !== null) {
      checked += 2;
      if (!(savingsOf(be, pp.reasonable_salary_pct) >= pp.annual_admin_cost)) violations++;
      if (be > 30000 && !(savingsOf(be - 500, pp.reasonable_salary_pct) < pp.annual_admin_cost)) violations++;
    }
    const qbe = output_payload.qbi_adjusted_break_even_income;
    if (qbe !== null) {
      checked += 2;
      const s3 = (inc) => savingsOf(inc, pp.reasonable_salary_pct) - inc * (pp.reasonable_salary_pct / 100) * QBI_TRADEOFF_EFFECTIVE_RATE;
      if (!(s3(qbe) >= pp.annual_admin_cost)) violations++;
      if (qbe > 30000 && !(s3(qbe - 500) < pp.annual_admin_cost)) violations++;
    }
    checked++;
    if (be !== null && (be < 30000 || be > 1000000 || be % 500 !== 0)) violations++;
  }
  return { name: 'P4 break-even grid: first crossed 500-step, two-sided, on both scanners', checked, violations };
}

// P5 determinism (two runs agree byte-for-byte), output shape (no
// undefined/NaN/non-finite anywhere), and admin-cost monotonicity (raising
// the admin cost never raises net_annual_savings, and crossing the
// $1,500–$3,000 guidance band raises the flag).
function checkDeterminismShapeMonotonic() {
  const rng = mulberry32(713005);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 25; i++) {
    const pp = baseInputs(rng);
    const r1 = compute(pp);
    const r2 = compute(pp);
    checked++;
    if (JSON.stringify(r1) !== JSON.stringify(r2)) violations++;
    checked++;
    if (findShapeViolations(r1.output_payload).length > 0) violations++;
    const raised = compute({ ...pp, annual_admin_cost: pp.annual_admin_cost + 500 });
    checked++;
    if (raised.output_payload.net_annual_savings > r1.output_payload.net_annual_savings) violations++;
    const outside = 400;
    const flagged = compute({ ...pp, annual_admin_cost: outside });
    checked++;
    if (!flagged.compliance_flags.includes('ART713_ADMIN_COST_OUTSIDE_GUIDANCE_BAND')) violations++;
  }
  return { name: 'P5 determinism, output shape, admin-cost monotonicity and guidance-band flag', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkFullWageFica(),
  checkWageBaseCaps(),
  checkVerdictComparator(),
  checkBreakEvenBoundary(),
  checkDeterminismShapeMonotonic(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — v1..v16 fixture oracle + P1..P5.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
