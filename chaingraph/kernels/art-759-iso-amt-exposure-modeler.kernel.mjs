// art-759-iso-amt-exposure-modeler — port of ApexLogics Apex #109 "ISO AMT Exposure Modeler"
// (al_id AL-116, tool_id 109-iso-amt-exposure-modeler) inline compute, landed from the
// APEXPORT-109 porting payload (bus msi, GRADES PASS-PENDING-XV 2026-10-09T02:05Z re-grade
// superseding the 10-08 FAIL; Tim 2026-10-18T21:20Z extend ruling: Builder-verifies-at-land —
// 15/15 payload fixture vectors re-executed through compute() matching the stored apex_output
// and kernel_output byte-for-byte, APEX-PORT-109-LAND-1).
//
// Source of record (fetched 2026-10-08, pinned in the payload and APEXPORT-109-REPORT.md):
//   https://apexlogics.org/tools/109-iso-amt-exposure-modeler/
//   HTTP 200, 26904 raw bytes, sha256 88C023648C95288A311A98BE88B699A8E549EDA70A8AF74E13FC78A0A0BCA6EF
//   last-modified Fri, 02 Oct 2026 19:43:35 GMT
//   Inline compute = lines 271-497 of the pinned page: AMT_PARAMS, calcAMT, calcRegularTax,
//   calcISOAMT (numeric leg). This module is a pure-function port of that arithmetic.
//
// NOTHING here is a live quote. Every tax constant is either
//   (a) read verbatim from IRS Rev. Proc. 2025-32 (fetched 2026-10-08, quoted in the payload
//       CITES.md), or
//   (b) re-derived from the IRC statute (Cornell LII, quoted in the payload CITES.md).
// See the payload CITES.md for the fetch log and DIFFERS.md for every place Apex's value and
// the official 2026 value were compared (D1/D3/D4 MATCH; D2 filing-status scope and D6
// credit-as-simplification are Apex-value-kept report items, flagged below).
//
// Pure function: no Date, no clock, no randomness, no I/O. The binary search for
// max_shares_no_amt uses a FIXED 60-iteration bound (Apex lines 335-342), never a bound
// taken from policy_parameters.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-759-iso-amt-exposure-modeler';
const TOOL_VERSION = '1.0.0';
const APEX_SOURCE = {
  al_id: 'AL-116',
  tool_id: '109-iso-amt-exposure-modeler',
  display_number: '#109',
  page_url: 'https://apexlogics.org/tools/109-iso-amt-exposure-modeler/',
  page_bytes: 26904,
  page_sha256: '88C023648C95288A311A98BE88B699A8E549EDA70A8AF74E13FC78A0A0BCA6EF',
  fetch_date: '2026-10-08',
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — 2026 AMT parameters (Apex value == official 2026 value, payload
// DIFFERS.md D1/D3/D4)
// ─────────────────────────────────────────────────────────────────────────────

// 2026 AMT exemption amounts. IRS Rev. Proc. 2025-32, sec. 4.10 ("Exemption Amounts for
// Alternative Minimum Tax. For taxable years beginning in 2026, the exemption amounts under
// sec. 55(d)(1) are:"): Joint Returns/Surviving Spouses $140,200; Unmarried Individuals $90,100;
// MIRS $70,100; Estates/Trusts $31,400. Statutory base: IRC sec. 55(d)(1)(A) $78,750 / (B) $50,600.
const AMT_EXEMPTION_SINGLE = 90100;   // Apex AMT_PARAMS.single.exemption (line 274) — MATCHES official
const AMT_EXEMPTION_MFJ = 140200;     // Apex AMT_PARAMS.mfj.exemption    (line 275) — MATCHES official

// 2026 AMT phase-out threshold (the AMTI above which the exemption is reduced).
// Rev. Proc. 2025-32 sec. 4.10 ("the amounts used under sec. 55(d)(2) to determine the phaseout"):
// Joint $1,000,000; Unmarried $500,000. IRC sec. 55(d)(2): reduction is
// "25 percent of the amount by which the [AMTI] ... exceeds" the threshold.
const AMT_PHASEOUT_START_SINGLE = 500000;   // Apex AMT_PARAMS.single.phaseoutStart (line 274) — MATCHES
const AMT_PHASEOUT_START_MFJ = 1000000;     // Apex AMT_PARAMS.mfj.phaseoutStart    (line 275) — MATCHES

// AMT exemption phase-out rate. IRC sec. 55(d)(2) verbatim: "reduced ... by an amount equal to
// 25 percent of the amount by which the alternative minimum taxable income ... exceeds" the
// threshold. Apex uses the literal 0.25 at line 284 ("phaseoutAmt * 0.25") — MATCHES statute.
const AMT_PHASEOUT_RATE = 0.25;

// AMT two-rate structure. IRC sec. 55(b)(1)(A) (Cornell LII): "26 percent of so much of the taxable
// excess as does not exceed $175,000, plus 28 percent of so much of the taxable excess as exceeds
// $175,000." The $175,000 statutory figure is inflation-adjusted for 2026 to $244,500 by
// Rev. Proc. 2025-32 sec. 4.10 ("the excess taxable income above which the 28 percent tax rate
// applies is ... All Other Taxpayers $244,500"; MIRS $122,250).
const AMT_RATE_1 = 0.26;               // Apex rate1 (lines 274-275) — MATCHES IRC 55(b)(1)(A) as adjusted
const AMT_RATE_2 = 0.28;               // Apex rate2 (lines 274-275) — MATCHES IRC 55(b)(1)(A) as adjusted
const AMT_RATE2_THRESHOLD = 244500;    // Apex threshold (lines 274-275) — MATCHES Rev. Proc. 2025-32 sec. 4.10

// 2026 ordinary-income regular-tax brackets. IRS Rev. Proc. 2025-32 sec. 4.01, Table 3 (single)
// and Table 1 (MFJ). Each entry is [upperBound, marginalRate]; the last bound is Infinity.
// DIFFERS.md D1: MATCH — bounds and rates identical to the official tables.
const REGULAR_BRACKETS_SINGLE = [
  [12400, 0.10], [50400, 0.12], [105700, 0.22], [201775, 0.24],
  [256225, 0.32], [640600, 0.35], [Infinity, 0.37],
];
const REGULAR_BRACKETS_MFJ = [
  [24800, 0.10], [100800, 0.12], [211400, 0.22], [403550, 0.24],
  [512450, 0.32], [768700, 0.35], [Infinity, 0.37],
];

// Scenario ladder exercised by the Apex results table (line 385): 0%, 25%, 50%, 75%, 100%.
const SCENARIO_PERCENTS = [0, 0.25, 0.5, 0.75, 1];

// Guard for the max-no-AMT binary search. Apex searches [0, shares*10] for a fixed 60 iterations.
const MAX_SEARCH_FACTOR = 10;
const MAX_SEARCH_ITERATIONS = 60;

// ─────────────────────────────────────────────────────────────────────────────
// PURE COMPUTE
// ─────────────────────────────────────────────────────────────────────────────

/** Tentative minimum tax & exemption machinery. Mirrors Apex calcAMT() (lines 281-294). */
function calcAMT(amti, params) {
  // Phase-out: exemption reduced by $0.25 per $1 above phaseout start (IRC sec. 55(d)(2)).
  const phaseoutAmt = Math.max(0, amti - params.phaseoutStart);
  const effectiveExemption = Math.max(0, params.exemption - phaseoutAmt * AMT_PHASEOUT_RATE);
  const amtBase = Math.max(0, amti - effectiveExemption);
  // Two-rate: 26% on the first $244,500 of amtBase, 28% on the rest (IRC sec. 55(b)(1)(A) as adjusted).
  let tmt;
  if (amtBase <= params.threshold) {
    tmt = amtBase * AMT_RATE_1;
  } else {
    tmt = params.threshold * AMT_RATE_1 + (amtBase - params.threshold) * AMT_RATE_2;
  }
  return { tmt, effectiveExemption, amtBase };
}

/** Regular tax on ordinary income only. Mirrors Apex calcRegularTax() (lines 296-308).
 * The ISO spread is NOT added to regular taxable income (IRC sec. 56(b)(3): an ISO exercise
 * is not ordinary income for regular tax at exercise) — payload DIFFERS.md D5, MATCH. */
function calcRegularTax(income, status) {
  const brackets = status === 'single' ? REGULAR_BRACKETS_SINGLE : REGULAR_BRACKETS_MFJ;
  let tax = 0, prev = 0;
  for (const [top, rate] of brackets) {
    if (income <= prev) break;
    tax += (Math.min(income, top) - prev) * rate;
    prev = top;
  }
  return tax;
}

function paramsFor(status) {
  if (status === 'single') {
    // Apex folds MFS into the 'single' option label ("Single / MFS") and applies the
    // unmarried figures to it. DIFFERS.md D2 (DIFFERS scope, Apex value kept — the port
    // reproduces Apex exactly; a true-MFS regime is a report item, not a numeric divergence).
    return { exemption: AMT_EXEMPTION_SINGLE, phaseoutStart: AMT_PHASEOUT_START_SINGLE,
      threshold: AMT_RATE2_THRESHOLD };
  }
  if (status === 'mfj') {
    return { exemption: AMT_EXEMPTION_MFJ, phaseoutStart: AMT_PHASEOUT_START_MFJ,
      threshold: AMT_RATE2_THRESHOLD };
  }
  return null;
}

/**
 * Ported ISO AMT exposure computation. Pure function of the policy parameters.
 *
 * pp = {
 *   shares:        integer, shares to exercise (Apex default 10000, min 1)
 *   strike_price:  number (USD/share),  option strike (Apex default 2.50, min 0.01)
 *   fmv:           number (USD/share),  FMV at exercise (Apex default 18.00, min 0.01)
 *   ordinary_income: number (USD), W-2 + other ordinary income (Apex default 175000, min 0)
 *   other_amt_adjustments: number (USD), other AMT preferences (Apex default 0, min 0)
 *   filing_status: 'single' | 'mfj' (Apex default 'single')
 * }
 *
 * Returns a snapshot object with every field the Apex results panel renders, plus the
 * 5-row scenario ladder. Refusal is a named reason, never a silent guess: an unknown
 * filing_status or a non-finite input yields an output_payload of {refused: <code>,
 * detail} plus a compliance flag (the payload contract).
 */
function computeFlat(pp) {
  pp = pp || {};
  const status = pp.filing_status;
  const params = paramsFor(status);
  if (!params) {
    return { refused: 'REFUSED_UNKNOWN_FILING_STATUS',
      detail: "filing_status must be 'single' or 'mfj'; received " + JSON.stringify(status) };
  }

  const shares = pp.shares;
  const strike = pp.strike_price;
  const fmv = pp.fmv;
  const ordIncome = pp.ordinary_income;
  const otherAMT = pp.other_amt_adjustments;

  const numeric = { shares, strike_price: strike, fmv, ordinary_income: ordIncome,
    other_amt_adjustments: otherAMT };
  for (const k of Object.keys(numeric)) {
    if (typeof numeric[k] !== 'number' || !Number.isFinite(numeric[k])) {
      return { refused: 'REFUSED_NON_FINITE_INPUT',
        detail: k + ' must be a finite number; received ' + JSON.stringify(numeric[k]) };
    }
  }

  // ISO spread is an AMT preference (IRC sec. 56(b)(3): sec. 421 does not apply to the transfer
  // of stock on exercise of an ISO, so the bargain element is included in AMTI for the year).
  const isoSpread = shares * (fmv - strike);
  // AMTI = ordinary income + ISO spread + other adjustments (Apex line 325).
  const amti = ordIncome + isoSpread + otherAMT;

  const { tmt, effectiveExemption, amtBase } = calcAMT(amti, params);
  const regularTax = calcRegularTax(ordIncome, status);
  // IRC sec. 55(a): the AMT is the excess of tentative minimum tax over the regular tax.
  const amtOwed = Math.max(0, tmt - regularTax);
  // AMT paid becomes a minimum tax credit carried to future years (IRC sec. 53).
  // DIFFERS.md D6 (SIMPLIFICATION, Apex value kept): Apex models the credit as the full AMT
  // owed this year; flagged as a report item, never a silent pick.
  const amtCredit = amtOwed;

  // Max shares exercisable without triggering AMT: binary search for the largest N with
  // TMT(AMTI with N shares) <= regularTax. Mirrors Apex lines 335-342 exactly
  // (DIFFERS.md D7: REPRODUCED EXACTLY — same cap, same 60 iterations, same predicate).
  let lo = 0, hi = shares * MAX_SEARCH_FACTOR, maxNoAMTShares = 0;
  for (let iter = 0; iter < MAX_SEARCH_ITERATIONS; iter++) {
    const mid = Math.floor((lo + hi) / 2);
    const testSpread = mid * (fmv - strike);
    const testAMTI = ordIncome + testSpread + otherAMT;
    const { tmt: t } = calcAMT(testAMTI, params);
    if (t <= regularTax) { maxNoAMTShares = mid; lo = mid + 1; } else { hi = mid - 1; }
  }

  // Scenario ladder — Apex lines 385-402. netValue = spread - AMT owed.
  const scenarios = SCENARIO_PERCENTS.map((p) => {
    const n = Math.round(shares * p);
    const sp = n * (fmv - strike);
    const testAMTI = ordIncome + sp + otherAMT;
    const { tmt: t, effectiveExemption: ee } = calcAMT(testAMTI, params);
    const owed = Math.max(0, t - regularTax);
    const netVal = sp - owed;
    return { shares_exercised: n, iso_spread: sp, amti: testAMTI,
      effective_exemption: ee, amt_owed: owed, net_value_after_amt: netVal,
      is_entered: n === shares };
  });

  return {
    shares_exercised: shares,
    strike_price: strike,
    fmv_at_exercise: fmv,
    ordinary_income: ordIncome,
    other_amt_adjustments: otherAMT,
    filing_status: status,
    iso_spread: isoSpread,
    amti,
    effective_exemption: effectiveExemption,
    amt_base: amtBase,
    tentative_minimum_tax: tmt,
    regular_tax: regularTax,
    amt_owed: amtOwed,
    amt_credit_generated: amtCredit,
    max_shares_no_amt: maxNoAMTShares,
    amt_triggered: amtOwed > 0,
    scenarios,
  };
}

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'estimate_iso_amt_exposure',
  mandate_type: 'consumer_finance', gpu: false,
};

/**
 * compute(pp) — pure decision kernel (port of Apex #109 inline compute).
 * Domain refusals surface as output_payload {refused, detail} with a named compliance flag
 * (the payload contract); happy-path output_payload is the Apex results snapshot.
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  const out = computeFlat(pp);
  if (out && typeof out === 'object' && out.refused) {
    return { output_payload: out, compliance_flags: [out.refused] };
  }
  return { output_payload: out, compliance_flags: [] };
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

