import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-342-compute-escrow-analysis';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_escrow_analysis',
  mandate_type: 'compliance_mandate', gpu: false,
};

// RESPA aggregate escrow accounting analysis -- 12 CFR 1024.17 (Reg X).
//
// METHOD (§1024.17(c)/(d)/(k), aggregate accounting method):
//   1. Build a 12-month TRIAL RUNNING BALANCE: starting balance + monthly
//      escrow deposit each month, minus the projected disbursement due that
//      month (property taxes, hazard/flood insurance, etc.), §1024.17(d).
//   2. CUSHION (§1024.17(c)(1)(iii)/(b)): a servicer MAY require a cushion no
//      greater than 1/6 of the estimated total annual disbursements from the
//      account ("no more than 2 months' worth"). A lower (or zero) cushion is
//      permitted; a value above 1/6 supplied to this kernel is capped, flagged.
//   3. LOW POINT: the lowest scheduled trial balance during the computation
//      year. Comparing the low point to the target (cushion) low point
//      classifies the account (§1024.17(f)):
//        - DEFICIENCY: the trial balance is NEGATIVE at any point in the year.
//          §1024.17(f)(1): servicer may (i) allow the deficiency to exist and
//          make up the shortfall through normal monthly payments over a period
//          of at least 1 year, (ii) demand payment within 30 days, or (iii)
//          require repayment in equal monthly payments over at least 2 years.
//        - SHORTAGE: the low point is BELOW the target cushion but never goes
//          negative. §1024.17(f)(2): if the shortage is less than 1 month's
//          escrow payment, the servicer may let it ride or spread it; if the
//          shortage is 1 month's escrow payment amount OR MORE, the servicer
//          MUST either demand payment within 30 days or spread repayment in
//          equal installments over at least 12 months.
//        - SURPLUS: the low point exceeds the target cushion. §1024.17(f)(2)/
//          (3): a surplus of $50 or more MUST be refunded to the borrower
//          within 30 days of the analysis (if the account will not be closed);
//          a surplus under $50 may, at the servicer's option, be refunded or
//          credited against the next year's payments.
//   4. NEW MONTHLY PAYMENT: going forward, the monthly deposit is recalculated
//      as projected total annual disbursements / 12, independent of any
//      shortage/deficiency spread payment (which is layered on top).
//
// Table version: RESPA-1024.17-2026-01-01 (structural regulatory method, not a
// CPI-indexed table -- included for the band's constants_version convention).
//
// Pairs with test_hpml_escrow (art-235): an HPML first-lien loan requires an
// escrow account under §1026.35(b) before this aggregate analysis is ever run
// on it (see the chain fixture, escrow-analysis-hpml-chain.test.mjs).
//
// Pure ECMA-262 arithmetic only -- no Math.pow, no Date.now/new Date(), no
// Math.random. All dollar figures rounded to 2 decimal places (r2). Finite
// gate: non-finite/absent numeric inputs default to 0, never NaN/Infinity.

const CUSHION_FRACTION_MAX = 1 / 6; // §1024.17(c)(1)(iii): no more than 1/6 of estimated total annual disbursements
const SURPLUS_REFUND_THRESHOLD = 50; // §1024.17(f)(2): $50 mandatory-refund floor
const SHORTAGE_SPREAD_MIN_MONTHS = 12; // §1024.17(f)(2): shortage spread minimum
const DEFICIENCY_SPREAD_MIN_MONTHS = 24; // §1024.17(f)(1)(iii): deficiency spread minimum

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }

function normalizeDisbursements(arr) {
  const out = new Array(12).fill(0);
  if (Array.isArray(arr)) {
    for (let i = 0; i < 12; i++) out[i] = safeNum(arr[i], 0);
  }
  return out;
}

export function compute(pp) {
  pp = pp || {};

  const startingBalance = safeNum(pp.starting_balance, 0);
  const monthlyEscrowPayment = safeNum(pp.monthly_escrow_payment, 0);
  const disbursements = normalizeDisbursements(pp.disbursements);
  const cushionFractionInput = safeNum(pp.cushion_fraction, CUSHION_FRACTION_MAX);

  const compliance_flags = [];

  const totalAnnualDisbursements = r2(disbursements.reduce((a, b) => a + b, 0));

  let cushionFractionUsed = cushionFractionInput;
  if (cushionFractionUsed > CUSHION_FRACTION_MAX + 1e-9) {
    cushionFractionUsed = CUSHION_FRACTION_MAX;
    compliance_flags.push('ESCROW_CUSHION_CAPPED_AT_STATUTORY_MAX');
  }
  if (cushionFractionUsed < 0) cushionFractionUsed = 0;
  const cushionTarget = r2(cushionFractionUsed * totalAnnualDisbursements);

  // Trial running balance, month 0 (starting) through month 12.
  const trialBalances = [r2(startingBalance)];
  for (let m = 1; m <= 12; m++) {
    const prior = trialBalances[m - 1];
    trialBalances.push(r2(prior + monthlyEscrowPayment - disbursements[m - 1]));
  }

  // Low point is evaluated across the 12 scheduled months of the computation
  // year (months 1-12), not the starting balance itself.
  let lowPoint = trialBalances[1];
  let lowPointMonth = 1;
  for (let m = 2; m <= 12; m++) {
    if (trialBalances[m] < lowPoint) { lowPoint = trialBalances[m]; lowPointMonth = m; }
  }
  lowPoint = r2(lowPoint);

  const isDeficiency = lowPoint < -1e-9;
  const spreadVsTarget = r2(lowPoint - cushionTarget);
  const isShortage = !isDeficiency && spreadVsTarget < -1e-9;
  const isSurplus = !isDeficiency && spreadVsTarget > 1e-9;
  const isBalanced = !isDeficiency && !isShortage && !isSurplus;

  let deficiencyAmount = 0, shortageAmount = 0, surplusAmount = 0;
  let monthlyDeficiencySpreadAmount = 0, monthlyShortageSpreadAmount = 0;
  let shortageSpreadRequired = false, surplusRefundRequired = false;

  if (isDeficiency) {
    deficiencyAmount = r2(-lowPoint);
    monthlyDeficiencySpreadAmount = r2(deficiencyAmount / DEFICIENCY_SPREAD_MIN_MONTHS);
    compliance_flags.push('ESCROW_DEFICIENCY');
  } else if (isShortage) {
    shortageAmount = r2(-spreadVsTarget);
    shortageSpreadRequired = shortageAmount >= monthlyEscrowPayment - 1e-9;
    monthlyShortageSpreadAmount = r2(shortageAmount / SHORTAGE_SPREAD_MIN_MONTHS);
    compliance_flags.push('ESCROW_SHORTAGE');
    if (shortageSpreadRequired) compliance_flags.push('ESCROW_SHORTAGE_MANDATORY_SPREAD');
  } else if (isSurplus) {
    surplusAmount = r2(spreadVsTarget);
    surplusRefundRequired = surplusAmount >= SURPLUS_REFUND_THRESHOLD - 1e-9;
    compliance_flags.push('ESCROW_SURPLUS');
    compliance_flags.push(surplusRefundRequired ? 'ESCROW_SURPLUS_REFUND_REQUIRED' : 'ESCROW_SURPLUS_BELOW_REFUND_THRESHOLD');
  } else {
    compliance_flags.push('ESCROW_ANALYSIS_BALANCED');
  }

  const newMonthlyEscrowPayment = r2(totalAnnualDisbursements / 12);

  const output_payload = {
    trial_balances: trialBalances,
    low_point_balance: lowPoint,
    low_point_month: lowPointMonth,
    total_annual_disbursements: totalAnnualDisbursements,
    cushion_fraction_used: cushionFractionUsed,
    cushion_target: cushionTarget,
    spread_vs_target: spreadVsTarget,
    account_status: isDeficiency ? 'deficiency' : isShortage ? 'shortage' : isSurplus ? 'surplus' : 'balanced',
    deficiency_amount: deficiencyAmount,
    shortage_amount: shortageAmount,
    surplus_amount: surplusAmount,
    monthly_deficiency_spread_amount: monthlyDeficiencySpreadAmount,
    monthly_shortage_spread_amount: monthlyShortageSpreadAmount,
    shortage_spread_required: shortageSpreadRequired,
    surplus_refund_required: surplusRefundRequired,
    new_monthly_escrow_payment: newMonthlyEscrowPayment,
    starting_balance: r2(startingBalance),
    monthly_escrow_payment: r2(monthlyEscrowPayment),
    regulatory_basis: '12 CFR 1024.17 (Reg X) aggregate escrow accounting method: (c)/(b) cushion cap (1/6 estimated total annual disbursements); (d) trial running balance; (f)(1) deficiency remedies (30-day demand or spread over at least 2 years); (f)(2) shortage remedies (spread over at least 12 months when the shortage equals or exceeds one month’s escrow payment) and mandatory refund of a surplus of $50 or more within 30 days.',
    note: 'Deficiency = a negative trial balance at any point in the computation year. Shortage = the low point falls short of the cushion target without going negative. Surplus = the low point exceeds the cushion target. Pairs with test_hpml_escrow (art-235), which determines whether an escrow account was required to be established for a first-lien HPML in the first place (§1026.35(b)).',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
