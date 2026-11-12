import { executionHash } from './_hash.mjs';

// art-713-scorp-election-break-even — S-Corp election break-even modeler.
// Ported from ApexLogics display_number #111 "S-Corp Election Break-Even
// Modeler" (al_id AL-118, CC BY 4.0 sister suite), per the APEX-PORT fleet
// plan (row APEX-PORT-ART713-1; payload APEXPORT-SC111, GRADES 8fb2772d).
//
// The kernel compares, for a net self-employment income level, the
// sole-proprietor SE tax against the S-Corp payroll tax on the reasonable W-2
// salary share, nets the annual S-Corp admin cost, and reports the smallest
// grid income at which electing saves at least the admin cost.
//
// ── D4 TREATMENT OF RECORD (adjudicated, binding) ────────────────────────────
// The 92.35% SE factor applies to SE NET EARNINGS ONLY (IRS Topic 554 / C4),
// never to W-2 wages (Pub 15 applies employer+employee SS/MC to full wages).
// Apex #111 applies 0.9235 to the wage (its calcSCorpSETax, page line 285) —
// that is the one material divergence (payload DIFFERS.md D4) and Apex #111
// carries the error. Tim adjudicated 2026-10-06 (web-search-grounded): official
// treatment stands; port the CORRECT arithmetic. This kernel therefore computes
// the S-Corp side as min(salary, wage_base)·12.4% + salary·2.9% (uncapped
// Medicare), and its S-Corp-side outputs deliberately differ from Apex #111 by
// the documented 7.65%-of-wage amount while the sole-prop side stays
// Apex-identical. The remaining payload divergences are carried as marked:
//   ⚠ DIFFERS-D1 — filing_status is accepted and echoed but enters NO tax
//     formula (Apex advertises a 0.9% surtax term it never implements). It
//     feeds only the section 199A threshold caveat flag (this port's add-on), never
//     the tax arithmetic.
//   ⚠ DIFFERS-D2 — owner_health_premium_annual is accepted and echoed, provably
//     inert (Apex reads it into its result and never uses it).
//   ⚠ DIFFERS-D3 — half_se_tax_deduction is the section 164(f) one-half figure exposed
//     as a diagnostic exactly as Apex exposes it; it feeds no verdict.
//   ⚠ DIFFERS-D6 — break_even_income is the first point of Apex's 500-step grid
//     (30,000..1,000,000) whose savings reach the admin cost: a 500-quantized
//     value within one grid step of the continuous break-even, preserved for
//     source fidelity; the grid bounds are page behavior, not IRS facts.
//
// ── 2026 constants (grounded in payload CITES.md; every quote fetched) ──────
//   C1  SS wage base 2026 = $184,500          (IRS Pub 15, 2026)
//   C2  SS rate 12.4% total                   (IRS Pub 15, 2026)
//   C3  Medicare 2.9% total, no wage base     (IRS Pub 15, 2026)
//   C4  SE tax on 92.35% of net SE earnings   (IRS Topic 554)
//   C5  Additional Medicare 0.9% > $200K/$250K/$125K — NOT modeled (D1); Apex
//       advertises but never implements it; adding it would be a silent model
//       change beyond the adjudicated scope, so it stays a stated caveat.
//   C7  Reasonable compensation required before distributions; non-wage
//       distributions are not subject to employment taxes (IRS S-Corp Comp).
//
// ── Tim's ADD/MODIFY items (row bytes, 2026-10-06 — binding build content) ──
//   (1) 2026 SS wage base $184,500 with cap logic; Medicare 2.9% continues
//       uncapped above the base — on BOTH sides (C1/C3).
//   (2) QBI section 199A trade-off output: reasonable-comp wages reduce pass-through
//       income eligible for the 20% deduction, so the election's payroll-tax
//       saving is weighed against the QBI value given up, at the ADJUDICATED
//       19.8% effective rate (QBI_TRADEOFF_EFFECTIVE_RATE, row bytes:
//       "payroll-tax saved vs QBI lost (19.8% effective)", Tim 2026-10-06),
//       with income-threshold and SSTB caveats carried as flags/scope note:
//       the section 199A thresholds test TAXABLE INCOME (2026: $201,775 single /
//       $403,500 MFJ, OBBBA-permanent) and this kernel uses net_se_income only
//       as a proxy to raise the caveat; an SSTB owner inside the phase-out band
//       loses the deduction entirely, which this flag cannot see.
//   (3) Admin/compliance-cost input carries the ~$1,500–$3,000/yr guidance
//       band: values outside the band are honored (never clamped) and raise
//       ART713_ADMIN_COST_OUTSIDE_GUIDANCE_BAND.
//
// Pure function of the declared inputs: no DOM, no clock, no randomness, no I/O.

const TOOL_ID = 'art-713-scorp-election-break-even';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'model_scorp_break_even',
  mandate_type: 'readiness_diagnostic',
  gpu: false,
  source_apex_display_number: 111,
  source_apex_al_id: 'AL-118',
};

const SS_WAGE_BASE = 184500;   // C1: IRS Pub 15 (2026): "The social security wage base limit is $184,500."
const SS_RATE      = 0.124;    // C2: IRS Pub 15 (2026): 6.2% each for employer and employee (12.4% total).
const MC_RATE      = 0.029;    // C3: IRS Pub 15 (2026): 2.9% total; "There is no wage base limit for Medicare tax".
const SE_FACTOR    = 0.9235;   // C4: IRS Topic 554 — applies to NET SE EARNINGS ONLY (see D4 block above).

const FIVE_YEAR_HORIZON = 5;   // Apex models a flat undiscounted 5-year horizon (page line 318).

/* Break-even search grid — Apex page lines 323–326, preserved (D6). */
const BE_SCAN_START = 30000;
const BE_SCAN_END   = 1000000;
const BE_SCAN_STEP  = 500;

/* Tim item (2): section 199A trade-off constants. QBI_TRADEOFF_EFFECTIVE_RATE is the
 * adjudicated 19.8% effective rate of record (row bytes, 2026-10-06).
 * QBI_DEDUCTION_RATE is the section 199A(a) 20% tentative deduction, displayed only.
 * Threshold/band values feed caveat FLAGS only (never the tax arithmetic). */
const QBI_TRADEOFF_EFFECTIVE_RATE = 0.198;
const QBI_DEDUCTION_RATE = 0.20;
const QBI_THRESHOLD_SINGLE = 201775; // 2026 section 199A threshold, single (OBBBA-permanent)
const QBI_THRESHOLD_MFJ    = 403500; // 2026 section 199A threshold, married filing jointly
const QBI_BAND_SINGLE      = 75000;  // section 199A(b)(3)(B) phase-in band
const QBI_BAND_MFJ         = 150000;

/* Tim item (3): admin/compliance-cost guidance band (typical small-business
 * accounting + payroll range). Guidance only — inputs outside it are honored. */
const ADMIN_COST_GUIDANCE_LOW  = 1500;
const ADMIN_COST_GUIDANCE_HIGH = 3000;

const SCOPE_NOTE =
  'Deterministic 2026 model, not tax advice. The 92.35% SE factor is applied to ' +
  'net earnings from self-employment only, never to W-2 wages (IRS Topic 554) — ' +
  'the port corrects Apex #111 on this point by adjudication of record. The 0.9% ' +
  'Additional Medicare Tax above $200K single / $250K MFJ is NOT modeled. The QBI ' +
  'section 199A trade-off values wages at the adjudicated 19.8% effective rate, ' +
  'flags (from net income as a taxable-income proxy) the $201,775 single / ' +
  '$403,500 MFJ threshold and phase-out band, and cannot see SSTB status, which ' +
  'disallows the deduction inside the band. Break-even is the first point of a ' +
  '500-step grid, within one step of the continuous break-even.';

/** Sole-proprietor SE tax: 92.35% of net earnings, SS capped at the wage base, Medicare uncapped (C2–C4). Apex-identical. */
function calcSETax(netIncome) {
  const netSE = netIncome * SE_FACTOR;
  const ssTax = Math.min(netSE, SS_WAGE_BASE) * SS_RATE;
  const mcTax = netSE * MC_RATE;
  return ssTax + mcTax;
}

/**
 * S-Corp payroll tax on the W-2 wage: employer+employee SS (12.4%) on wages up
 * to the 2026 base, Medicare (2.9%) uncapped — full-wage treatment per the D4
 * adjudication of record. Apex #111 multiplies the wage by 0.9235 first
 * (DIFFERS.md D4); that form understates this tax by 7.65% of the wage and is
 * deliberately NOT ported.
 */
function calcSCorpSETax(salary) {
  const ss = Math.min(salary, SS_WAGE_BASE) * SS_RATE;
  const mc = salary * MC_RATE;
  return ss + mc;
}

/** First grid point (BE_SCAN_START..BE_SCAN_END step BE_SCAN_STEP) where savingsFn(inc) >= adminCost, else null (D6 grid semantics). */
function scanBreakEven(savingsFn, adminCost) {
  for (let inc = BE_SCAN_START; inc <= BE_SCAN_END; inc += BE_SCAN_STEP) {
    if (savingsFn(inc) >= adminCost) return inc;
  }
  return null;
}

/**
 * compute(pp) — pure S-Corp election break-even over the declared inputs.
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = pp || {};
  const netIncome = num(pp.net_se_income, 150000);
  const salaryPct = num(pp.reasonable_salary_pct, 50) / 100;   // percent → fraction (Apex page line 297)
  const adminCost = num(pp.annual_admin_cost, 3000);
  // ⚠ DIFFERS-D1/D2 — read for schema fidelity; filing_status feeds only the
  // section 199A threshold caveat flag below, healthPremium feeds nothing (Apex never
  // used either in a formula).
  const healthPremium = num(pp.owner_health_premium_annual, 0);
  const status = pp.filing_status === 'mfj' ? 'mfj' : 'single';

  const salary = netIncome * salaryPct;
  const distribution = netIncome - salary;

  const spSETax = calcSETax(netIncome);
  const scSETax = calcSCorpSETax(salary);

  const seSavings = spSETax - scSETax;
  const netSavings = seSavings - adminCost;
  const fiveYrSavings = netSavings * FIVE_YEAR_HORIZON;

  // Tim item (2): the section 199A trade-off. Electing converts `salary` of
  // pass-through income into wages, so QBI income falls to `distribution`;
  // the deduction given up is displayed at the section 199A(a) 20% tentative rate and
  // valued at the adjudicated 19.8% effective rate on the wages paid.
  const qbiIncome = distribution;
  const qbiDeductionTentative = qbiIncome * QBI_DEDUCTION_RATE;
  const qbiValueAtRisk = salary * QBI_TRADEOFF_EFFECTIVE_RATE;
  const netSavingsQbiAdjusted = seSavings - qbiValueAtRisk - adminCost;

  const savingsFn = (inc) => calcSETax(inc) - calcSCorpSETax(inc * salaryPct);
  const savingsQbiFn = (inc) => savingsFn(inc) - (inc * salaryPct) * QBI_TRADEOFF_EFFECTIVE_RATE;
  const breakEvenIncome = scanBreakEven(savingsFn, adminCost);
  const qbiBreakEvenIncome = scanBreakEven(savingsQbiFn, adminCost);

  const threshold = status === 'mfj' ? QBI_THRESHOLD_MFJ : QBI_THRESHOLD_SINGLE;
  const bandWidth = status === 'mfj' ? QBI_BAND_MFJ : QBI_BAND_SINGLE;

  const compliance_flags = [];
  compliance_flags.push(netSavings >= 0 ? 'ART713_SCORP_WINS_AT_INPUT' : 'ART713_SOLE_PROP_WINS_AT_INPUT');
  if (breakEvenIncome === null) compliance_flags.push('ART713_BREAK_EVEN_NOT_REACHED');
  // Earned only when the election actually moves income into wages: with a
  // zero salary share there is no pass-through given up and no trade-off.
  if (salary > 0) compliance_flags.push('ART713_QBI_TRADEOFF_MODELED');
  if (qbiBreakEvenIncome === null) compliance_flags.push('ART713_QBI_ADJ_BREAK_EVEN_NOT_REACHED');
  // Caveats only: net_se_income stands in for taxable income (the section 199A
  // thresholds test taxable income), and SSTB status is not an input.
  if (netIncome > threshold + bandWidth) {
    compliance_flags.push('ART713_QBI_THRESHOLD_RISK');
  } else if (netIncome > threshold) {
    compliance_flags.push('ART713_QBI_PHASEOUT_BAND_RISK');
  }
  if (adminCost < ADMIN_COST_GUIDANCE_LOW || adminCost > ADMIN_COST_GUIDANCE_HIGH) {
    compliance_flags.push('ART713_ADMIN_COST_OUTSIDE_GUIDANCE_BAND');
  }

  // Flag-mirror doctrine (AUTHORING-STANDARD section 2.2): the conditional
  // advisory flags above are mirrored into output_payload.caveats, truthy
  // exactly when an advisory applies, so section 21.4 gates route on the payload.
  const caveats = [];
  if (breakEvenIncome === null) caveats.push('Break-even not reached on the 30,000..1,000,000 grid at this salary share.');
  if (qbiBreakEvenIncome === null) caveats.push('QBI-adjusted break-even never reached: the QBI value given up outweighs the payroll-tax saving at this salary share.');
  if (netIncome > threshold + bandWidth) caveats.push('Net income exceeds the 2026 section 199A threshold; the deduction may be fully phased out (net income stands in for taxable income).');
  else if (netIncome > threshold) caveats.push('Net income is inside the section 199A phase-out band; an SSTB owner loses the deduction entirely inside the band.');
  if (adminCost < ADMIN_COST_GUIDANCE_LOW || adminCost > ADMIN_COST_GUIDANCE_HIGH) caveats.push('Admin cost is outside the typical $1,500-$3,000/yr guidance band; the figure is honored as entered.');

  const output_payload = {
    // Apex verdict comparator (page line 335): netSavings >= 0 ⇒ SCORP_WINS.
    verdict: netSavings >= 0 ? 'SCORP_WINS' : 'SOLE_PROP_WINS',
    net_se_income: round2(netIncome),
    reasonable_salary_pct: round2(num(pp.reasonable_salary_pct, 50)),
    annual_admin_cost: round2(adminCost),
    filing_status: status,                                    // echoed; inert in the tax math (D1)
    owner_health_premium_annual: round2(healthPremium),       // echoed; inert (D2)
    reasonable_w2_salary: round2(salary),
    distribution: round2(distribution),
    sole_prop_se_tax: round2(spSETax),
    scorp_payroll_tax: round2(scSETax),                       // D4-corrected full-wage FICA
    se_tax_savings: round2(seSavings),
    net_annual_savings: round2(netSavings),
    five_year_savings: round2(fiveYrSavings),
    break_even_income: breakEvenIncome,                       // 500-quantized grid point (D6); null ⇒ not reached
    half_se_tax_deduction: round2(spSETax / 2),               // ⚠ DIFFERS-D3 diagnostic only
    scorp_employer_tax: round2(scSETax / 2),                  // diagnostic only
    qbi_199a_income: round2(qbiIncome),
    qbi_199a_deduction_tentative: round2(qbiDeductionTentative),
    qbi_199a_value_at_risk: round2(qbiValueAtRisk),
    net_annual_savings_qbi_adjusted: round2(netSavingsQbiAdjusted),
    qbi_adjusted_break_even_income: qbiBreakEvenIncome,       // same grid, QBI-valued; null ⇒ not reached
    caveats,                                                  // flag-mirror (AUTHORING-STANDARD section 2.2)
    scope_note: SCOPE_NOTE,
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}

/* ── helpers ─────────────────────────────────────────────────────────────── */
function num(v, dflt) {
  return typeof v === 'number' && Number.isFinite(v) ? v : dflt;
}
function round2(x) {
  return Math.round(x * 100) / 100;
}
