// art-752-freelance-quarterly-estimated-tax — port of ApexLogics Apex #116 "Freelance
// Quarterly Estimated Tax Calculator" (AL-123, tool_id 116-freelance-quarterly-estimated-tax,
// v1.0.0) inline compute, landed from the APEXPORT-116 porting payload (msi bus
// workbuddy/APEXPORT-116/.d, GRADES PASS-PENDING-XV 2026-10-07, Builder-verifies-at-land:
// 19/19 payload fixture vectors re-executed through compute() matching the stored outputs,
// APEX-PORT-116-LAND-1).
//
// Source bytes pinned in APEXPORT-116-REPORT.md (Apex page 30,666 bytes, fetched
// 2026-10-06, https://apexlogics.org/tools/116-freelance-quarterly-estimated-tax/; inline
// <script> lines 277-540 of the fetched HTML). Apex HTML line numbers cited as "Apex L<n>".
//
// Pure function: no Date, no clock, no randomness, no I/O. The Apex page uses no wall
// clock in the arithmetic; the quarterly due dates are fixed 2026 calendar literals.
//
// DIFFERS adjudication (payload DIFFERS.md, escalated as REPORT ITEMS R1-R3, quoted
// in-report, not silently applied):
// - D1/R1: Apex Q2 due date "Jun 16, 2026" vs official IRS 1040-ES (2026) voucher
//   "June 15, 2026" — OFFICIAL USED (Jun 15 below).
// - D2/R2: Apex does not model the 0.9% Additional Medicare Tax — port keeps Apex
//   arithmetic for parity (understates above the $200k/$250k/$125k thresholds).
// - D3/R3: Apex safe-harbor prior-year prong fixed at 100% (no 110% high-earner branch
//   over $150k AGI / $75k MFS) — port keeps Apex as-is.
// - D4/R3: $1,000 de minimis underpayment exemption not surfaced — port mirrors Apex.
//
// Tax premises grounded in payload CITES.md (C1-C8): SS rate 12.4% / Medicare 2.9% (C1),
// SE factor 92.35% (C2), 2026 SS wage base $184,500 (C3), half-SE-tax AGI deduction (C4),
// 2026 standard deductions $16,100/$32,200 (C5), 2026 bracket schedule (C6), safe harbor
// min(100% prior, 90% current) (C7), 2026 quarterly due dates (C8). The state bucket
// (none/low/mid/high = 0/0.03/0.05/0.093) is an ILLUSTRATIVE user-selectable assumption,
// not a regulatory fact, exposed as an enum.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-752-freelance-quarterly-estimated-tax';
const TOOL_VERSION = '1.0.0';
const APEX_SOURCE = {
  al_id: 'AL-123',
  tool_id: '116-freelance-quarterly-estimated-tax',
  display_number: '#116',
  page_url: 'https://apexlogics.org/tools/116-freelance-quarterly-estimated-tax/',
  page_bytes: 30666,
  fetch_date: '2026-10-06',
};

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'estimate_quarterly_tax',
  mandate_type: 'consumer_finance', gpu: false,
};

// --- Named constants -------------------------------------------------------
// SS_RATE 0.124 = 12.4% Social Security; MC_RATE 0.029 = 2.9% Medicare (C1; Apex L281-282).
export const SS_RATE = 0.124;
export const MC_RATE = 0.029;
// SE_FACTOR 0.9235: SE tax base is 92.35% of net earnings (C2; Topic 554; Apex L280).
export const SE_FACTOR = 0.9235;
// SS_WAGE_BASE 184500: 2026 Social Security wage base limit (C3; Pub 15; Apex L279).
// Comparator Math.min(netSESubject, SS_WAGE_BASE) is tested at equality by fixtures
// B1-sscap-at-boundary / B1b / B2.
export const SS_WAGE_BASE = 184500;

// Standard deduction, tax year 2026 (C5; Apex L283). Head-of-household ($24,150) is not
// offered by the Apex UI, which exposes only "single"/"mfj"; the port preserves that
// input domain. AGI floor at 0 (Math.max) is tested by fixtures B7 / B7b / B8.
export const STD_DEDUCTION = { single: 16100, mfj: 32200 };

// Federal income tax brackets, tax year 2026 (C6; Apex L296-297): [upperThreshold, rate].
export const BRACKETS_SINGLE = [
  [12400, 0.10], [50400, 0.12], [105700, 0.22], [201775, 0.24],
  [256225, 0.32], [640600, 0.35], [Infinity, 0.37],
];
export const BRACKETS_MFJ = [
  [24800, 0.10], [100800, 0.12], [211400, 0.22], [403550, 0.24],
  [512450, 0.32], [768700, 0.35], [Infinity, 0.37],
];

// State tax rates: ILLUSTRATIVE, user-selectable assumptions (not a regulatory fact).
// Upstream groups states by approximate effective rate; enum, not a jurisdiction lookup.
export const STATE_RATES = { none: 0, low: 0.03, mid: 0.05, high: 0.093 };

// 2026 estimated-tax due dates (C8; 1040-ES vouchers 1-4). Q2 corrected to the official
// voucher date June 15, 2026 — DIFFERS.md D1 (Apex listed Jun 16, 2026).
export const Q_DATES = [
  { label: 'Q1', due: 'Apr 15, 2026', isoDate: '2026-04-15' },
  { label: 'Q2', due: 'Jun 15, 2026', isoDate: '2026-06-15' },
  { label: 'Q3', due: 'Sep 15, 2026', isoDate: '2026-09-15' },
  { label: 'Q4', due: 'Jan 15, 2027', isoDate: '2027-01-15' },
];

// Safe-harbor rate on current-year federal tax (C7; Apex L350-354).
export const SAFE_HARBOR_CURRENT_RATE = 0.90;

// Progressive tax over the given bracket table. Mirrors Apex `calcIncomeTax`.
function incomeTax(taxableIncome, status) {
  const B = status === 'mfj' ? BRACKETS_MFJ : BRACKETS_SINGLE;
  let tax = 0, prev = 0;
  for (const [top, rate] of B) {
    if (taxableIncome <= prev) break;
    tax += (Math.min(taxableIncome, top) - prev) * rate;
    prev = top;
  }
  return tax;
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * compute(pp) — pure arithmetic kernel (port of Apex #116 inline `calcFreelanceTax`).
 * Numeric inputs are coerced with +pp.<k> || 0 (Apex parseFloat read style); unknown
 * state keys fall to rate 0 and unknown filing statuses to "single", matching the Apex
 * page's own fallback behaviour. See fixtures/proptest for the boundary grid.
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  const gross = +pp.gross_income || 0;
  const expenses = +pp.business_expenses || 0;
  const otherIncome = +pp.other_income || 0;
  const status = pp.filing_status === 'mfj' ? 'mfj' : 'single';
  const stateKey = pp.state || 'none';
  const stateRate = STATE_RATES[stateKey] || 0;
  const priorYearTax = +pp.prior_year_tax || 0;
  const ytdPaid = +pp.ytd_paid || 0;

  // Net SE income = gross − business expenses (Apex L313).
  const netSE = gross - expenses;
  // SE tax base = 92.35% of net earnings (C2).
  const netSESubject = netSE * SE_FACTOR;

  // SE tax: SS portion capped at the 2026 wage base (C3), Medicare uncapped (C1).
  const ssTax = Math.min(netSESubject, SS_WAGE_BASE) * SS_RATE;
  const mcTax = netSESubject * MC_RATE;
  const seTax = ssTax + mcTax;

  // Federal income tax: AGI less the employer-equivalent half of SE tax (C4) and the
  // 2026 standard deduction (C5), taxed on the 2026 brackets (C6).
  const halfSE = seTax / 2;
  const agi = netSE + otherIncome - halfSE;
  const stdDed = STD_DEDUCTION[status];
  const taxableIncome = Math.max(0, agi - stdDed);
  const fedIncomeTax = incomeTax(taxableIncome, status);
  const effectiveFedRate = agi > 0 ? fedIncomeTax / agi : 0;

  // State tax on (netSE + otherIncome) at the illustrative elective rate.
  const stateTax = (netSE + otherIncome) * stateRate;

  const totalFed = fedIncomeTax + seTax;
  const totalTax = totalFed + stateTax;
  const effectiveTotal = (netSE + otherIncome) > 0 ? totalTax / (netSE + otherIncome) : 0;

  // Equal quarterly installments of the full annual total.
  const perQtr = totalTax / 4;
  const remaining = Math.max(0, totalTax - ytdPaid);

  // Safe harbor (C7): lesser of 100% prior-year tax or 90% of current-year federal tax.
  // Apex applies the min() only when priorYearTax > 0; otherwise it falls back to 90% of
  // current. Port preserves that branch exactly (fixtures B3/B4/B5/B6).
  const safeHarborPriorYear = priorYearTax;
  const safeHarborCurrentYear = totalFed * SAFE_HARBOR_CURRENT_RATE;
  const safeHarborAmt = priorYearTax > 0
    ? Math.min(safeHarborPriorYear, safeHarborCurrentYear)
    : safeHarborCurrentYear;
  const safeHarborQtr = safeHarborAmt / 4;

  const output_payload = {
    net_se_income: round2(netSE),
    se_tax: round2(seTax),
    ss_tax: round2(ssTax),
    mc_tax: round2(mcTax),
    agi: round2(agi),
    taxable_income: round2(taxableIncome),
    federal_income_tax: round2(fedIncomeTax),
    effective_fed_rate: round2(effectiveFedRate),
    state_tax: round2(stateTax),
    total_federal_tax: round2(totalFed),
    total_annual_tax: round2(totalTax),
    effective_total_rate: round2(effectiveTotal),
    per_quarter: round2(perQtr),
    remaining_after_ytd: round2(remaining),
    safe_harbor_total: round2(safeHarborAmt),
    safe_harbor_quarterly: round2(safeHarborQtr),
    quarters: Q_DATES.map((q) => ({ quarter: q.label, due: q.due, amount: round2(perQtr) })),
  };

  const compliance_flags = (netSE + otherIncome) > 0 ? ['FREELANCE_QUARTERLY_ESTIMATED'] : [];
  if (netSESubject > SS_WAGE_BASE) compliance_flags.push('SS_WAGE_BASE_EXCEEDED');
  if (priorYearTax > 0) compliance_flags.push('SAFE_HARBOR_PRIOR_YEAR_APPLIED');
  if (ytdPaid > 0) compliance_flags.push('YTD_PAYMENTS_ENTERED');

  // FLAG-MIRROR-DOCTRINE (AUTHORING-STANDARD §2.2): the conditional flags mirror into
  // output_payload.warnings so the payload itself carries them. The base
  // FREELANCE_QUARTERLY_ESTIMATED flag is unconditional and stays flag-only.
  const warnings = compliance_flags.filter((f) => f !== 'FREELANCE_QUARTERLY_ESTIMATED');
  output_payload.warnings = warnings;

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
