// art-760-espp-break-even-optimal-sell — port of ApexLogics Apex #110 "ESPP
// Break-Even & Optimal Sell Analyzer" (al_id AL-117, tool_id
// 110-espp-break-even-optimal-sell) inline compute, landed from the
// APEXPORT-110B porting payload (farm-msi workbuddy lane, commit 8a137fa,
// GRADES PASS-PENDING-XV re-grade 2026-10-13; Builder-verifies-at-land:
// 22/22 payload fixture vectors re-executed through compute() matching the
// stored outputs, APEX-PORT-110B-LAND-1).
//
// Source of record (fetched during the APEXPORT-110B run, 2026-10-08/09):
//   https://apexlogics.org/tools/110-espp-break-even-optimal-sell/
//   HTTP 200, 32135 B, sha256
//   ddccf05f8b1dc1d0a986a6839f7109710a59ea4593fd70c573b5eb00b60fe0e7
//   (Last-Modified: Thu, 08 Oct 2026 15:21:12 GMT).
//   Inline compute = the <script> block of the pinned HTML: the LTCG constant,
//   calcOrdTax, marginalRate, calcLTCGtax, calcESPP. This module is a
//   pure-function port of that arithmetic, field-exact at double precision
//   (payload sweep 4006/4006 rows, 0 mismatches vs the live page JS).
//
// NOTHING here is a live quote. Every tax constant is either
//   (a) read verbatim from IRS Rev. Proc. 2025-32 (fetched 2026-10-08, quoted
//       in the payload CITES.md with the fetched sha256), or
//   (b) read from the IRC statute (Cornell LII, fetched 2026-10-08, quoted in
//       CITES.md): §423(b)(6) 15% discount, §423(a)(1) holding periods,
//       §423(c) qualifying-disposition ordinary-income cap.
//
// CLOCK NOTE (deterministic): `already_qualified` is derived from the required
// port-only input `as_of_date` (YYYY-MM-DD), never from a wall clock; a missing
// or malformed as_of_date is a named refusal (REFUSED_BAD_AS_OF_DATE). The whole
// payload is deterministic / zkVM-promotable. Every committed fixture pins
// as_of_date. Nothing in compute() reads the clock, randomness or I/O.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-760-espp-break-even-optimal-sell';
const TOOL_VERSION = '1.0.0';
const APEX_SOURCE = {
  al_id: 'AL-117',
  tool_id: '110-espp-break-even-optimal-sell',
  display_number: '#110',
  page_url: 'https://apexlogics.org/tools/110-espp-break-even-optimal-sell/',
  page_bytes: 32135,
  page_sha256: 'ddccf05f8b1dc1d0a986a6839f7109710a59ea4593fd70c573b5eb00b60fe0e7',
  fetch_date: '2026-10-08',
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — 2026 tax brackets (ordinary income + LTCG)
// ─────────────────────────────────────────────────────────────────────────────

// 2026 ordinary-income regular-tax brackets.
// IRS Rev. Proc. 2025-32 §4.01, Table 3 (single) / Table 1 (MFJ).
// [upperBound, marginalRate]; last bound Infinity.
// Verbatim from the fetched PDF (CITES.md G1): "Not over $12,400 10%";
// "Over $105,700 but not over $201,775 $17,966 plus 24%";
// "Over $211,400 but not over $403,550 $35,932 plus 24%"; "Over $768,700 $206,583.50 plus 37%".
export const REGULAR_BRACKETS_SINGLE = [
  [12400, 0.10], [50400, 0.12], [105700, 0.22], [201775, 0.24],
  [256225, 0.32], [640600, 0.35], [Infinity, 0.37],
];
export const REGULAR_BRACKETS_MFJ = [
  [24800, 0.10], [100800, 0.12], [211400, 0.22], [403550, 0.24],
  [512450, 0.32], [768700, 0.35], [Infinity, 0.37],
];

// 2026 long-term capital gains thresholds.
// IRS Rev. Proc. 2025-32 §4.02 (maximum zero-rate and 15%-rate amounts under §1(j)(5)(B)).
// Verbatim from the fetched PDF (CITES.md G2):
//   "All Other Individuals $49,450 $545,500"
//   "Married Individuals Filing Joint Returns and Surviving Spouse $98,900 $613,700"
// The Apex LTCG constant MATCHES the official 2026 figures exactly.
export const LTCG_SINGLE = [
  { rate: 0, max: 49450 },      // 0% bracket ceiling, all other individuals
  { rate: 0.15, max: 545500 },  // 15% bracket ceiling
  { rate: 0.20, max: Infinity },
];
export const LTCG_MFJ = [
  { rate: 0, max: 98900 },      // 0% bracket ceiling, MFJ
  { rate: 0.15, max: 613700 },  // 15% bracket ceiling
  { rate: 0.20, max: Infinity },
];

// ESPP 15% discount. IRC §423(b)(6) (Cornell LII, fetched this run):
// "the option price is not less than the lesser of— (A) an amount equal to 85 percent of
//  the fair market value of the stock at the time such option is granted, or (B) ... 85
//  percent of the fair market value of the stock at the time such option is exercised".
// The Apex page inverts the discount to recover FMV at purchase:
//   fmvAtPurchase = purchasePrice / 0.85.
export const ESPP_DISCOUNT_RATE = 0.85;

// Qualifying disposition holding period. IRC §423(a)(1) (Cornell LII):
// "no disposition of such share is made by him within 2 years after the date of the
//  granting of the option nor within 1 year after the transfer of such share to him".
// Apex adds +1 day to each anniversary so the day-of-anniversary is the first day
// that still FAILS "more than", i.e. the next day is the first qualifying day.
export const QUAL_GRANT_YEARS = 2;
export const QUAL_PURCHASE_YEARS = 1;
export const QUAL_GRACE_DAYS = 1;

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'analyze_espp_disposition',
  mandate_type: 'compensation_benefits',
  gpu: false,
};

/** Regular tax on ordinary income using the 2026 §1 rate tables. Mirrors Apex calcOrdTax(). */
export function calcOrdTax(inc, status) {
  const brackets = status === 'mfj' ? REGULAR_BRACKETS_MFJ : REGULAR_BRACKETS_SINGLE;
  let tax = 0, prev = 0;
  for (const [top, rate] of brackets) {
    if (inc <= prev) break;
    tax += (Math.min(inc, top) - prev) * rate;
    prev = top;
  }
  return tax;
}

/** Marginal ordinary-income rate at a given income level. Mirrors Apex marginalRate(). */
export function marginalRate(inc, status) {
  const brackets = status === 'mfj' ? REGULAR_BRACKETS_MFJ : REGULAR_BRACKETS_SINGLE;
  for (const [top, rate] of brackets) {
    if (inc <= top) return rate;
  }
  return 0.37;
}

/**
 * Long-term capital gains tax, layered on top of existing ordinary income.
 * Mirrors Apex calcLTCGtax() — fills the 0% LTCG bracket first (up to max - base),
 * then 15%, then 20%.
 */
export function calcLTCGtax(gain, ordIncome, status) {
  const tiers = status === 'mfj' ? LTCG_MFJ : LTCG_SINGLE;
  let remaining = gain, tax = 0, base = ordIncome;
  for (const { rate, max } of tiers) {
    if (remaining <= 0) break;
    const room = Math.max(0, max - base);
    const taxable = Math.min(remaining, room);
    tax += taxable * rate;
    remaining -= taxable;
    base += taxable;
  }
  return tax;
}

/**
 * Qualifying-disposition date: the later of (grant + 2y + 1d) and (purchase + 1y + 1d).
 * Mirrors the Apex inline date arithmetic. Returns a YYYY-MM-DD string.
 * NOTE: Apex builds qualifyDate with Date#setFullYear/setDate (local-time construction),
 * then reads `.toISOString().slice(0,10)` (UTC). This local/UTC mix is reproduced
 * faithfully (payload DIFFERS D6 note); every committed fixture is inside the
 * window where the two agree.
 */
export function calcQualifyDate(grantDateISO, purchaseDateISO) {
  const g = new Date(grantDateISO);
  g.setFullYear(g.getFullYear() + QUAL_GRANT_YEARS);
  g.setDate(g.getDate() + QUAL_GRACE_DAYS);
  const p = new Date(purchaseDateISO);
  p.setFullYear(p.getFullYear() + QUAL_PURCHASE_YEARS);
  p.setDate(p.getDate() + QUAL_GRACE_DAYS);
  const q = g.getTime() > p.getTime() ? g : p;
  return q.toISOString().slice(0, 10);
}

function validateISODate(v) {
  if (typeof v !== 'string' || v.length !== 10 || v[4] !== '-' || v[7] !== '-') return false;
  const y = Number(v.slice(0, 4)), m = Number(v.slice(5, 7)), d = Number(v.slice(8, 10));
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  return true;
}

function refusedPayload(code, detail) {
  return {
    refused: code,
    detail,
    domain_errors: [{ code }],
    refusal_reason: code,
  };
}

/**
 * compute(pp) — ported ESPP disposition computation. Pure function of the policy
 * parameters; the valuation date for `already_qualified` is the required
 * `as_of_date` input (kernel-determinism: the kernel never reads a clock).
 *
 * pp = {
 *   purchase_price:  number (USD/share), the actual price paid, after the 15% discount
 *   offering_price:  number (USD/share), FMV at grant / offering start
 *   current_price:   number (USD/share), current / sale price per share
 *   shares:          number, number of shares (Apex parses with +value)
 *   grant_date:      string YYYY-MM-DD, offering start date
 *   purchase_date:   string YYYY-MM-DD, date shares were purchased
 *   ordinary_income: number (USD), W-2 + all other ordinary income for the year
 *   filing_status:   'single' | 'mfj'
 *   as_of_date:      string YYYY-MM-DD. Valuation date for the `already_qualified`
 *                    field; the kernel never reads a wall clock.
 * }
 *
 * Returns { output_payload, compliance_flags }. An out-of-domain input yields an
 * output_payload carrying { refused, detail, domain_errors, refusal_reason } — a
 * named refusal, never a silent guess.
 */
export function compute(pp) {
  pp = pp || {};
  const status = pp.filing_status;
  if (status !== 'single' && status !== 'mfj') {
    return {
      output_payload: refusedPayload(
        'REFUSED_UNKNOWN_FILING_STATUS',
        "filing_status must be 'single' or 'mfj'; received " + JSON.stringify(status)
      ),
      compliance_flags: ['ART760_INPUT_REFUSED'],
    };
  }

  const purchasePrice = pp.purchase_price;
  const offeringPrice = pp.offering_price;
  const currentPrice = pp.current_price;
  const shares = pp.shares;
  const grantDate = pp.grant_date;
  const purchaseDate = pp.purchase_date;
  const ordIncome = pp.ordinary_income;

  const numeric = { purchase_price: purchasePrice, offering_price: offeringPrice,
    current_price: currentPrice, shares, ordinary_income: ordIncome };
  for (const k of Object.keys(numeric)) {
    if (typeof numeric[k] !== 'number' || !Number.isFinite(numeric[k])) {
      return {
        output_payload: refusedPayload(
          'REFUSED_NON_FINITE_INPUT',
          k + ' must be a finite number; received ' + JSON.stringify(numeric[k])
        ),
        compliance_flags: ['ART760_INPUT_REFUSED'],
      };
    }
  }

  if (!validateISODate(grantDate) || !validateISODate(purchaseDate)) {
    return {
      output_payload: refusedPayload(
        'REFUSED_BAD_DATE',
        'grant_date and purchase_date must be YYYY-MM-DD strings'
      ),
      compliance_flags: ['ART760_INPUT_REFUSED'],
    };
  }

  // Marginal ordinary rate at the filer's ordinary income (used for both disq and qual
  // ordinary-income tax) — mirrors Apex `marginalRate(ordIncome, status)`.
  const mrate = marginalRate(ordIncome, status);

  // ── Qualifying disposition date ──
  if (!validateISODate(pp.as_of_date)) {
    return {
      output_payload: refusedPayload(
        'REFUSED_BAD_AS_OF_DATE',
        'as_of_date must be a YYYY-MM-DD string; the kernel never reads a wall clock'
      ),
      compliance_flags: ['ART760_INPUT_REFUSED'],
    };
  }
  const qualifyDate = calcQualifyDate(grantDate, purchaseDate);
  const now = new Date(pp.as_of_date + 'T00:00:00Z');
  const qDate = new Date(qualifyDate);
  const alreadyQualified = now.getTime() > qDate.getTime();

  // ── DISQUALIFYING DISPOSITION (sell any time after purchase) ──
  // Ordinary income = FMV at purchase - purchase price (the discount).
  // FMV at purchase recovered by inverting the 15% discount (IRC §423(b)(6)).
  const fmvAtPurchase = purchasePrice / ESPP_DISCOUNT_RATE;
  const disqOrdIncomePerSh = Math.max(0, fmvAtPurchase - purchasePrice);
  const disqOrdIncome = disqOrdIncomePerSh * shares;
  const disqLTCGGain = Math.max(0, (currentPrice - fmvAtPurchase) * shares);
  const disqGross = currentPrice * shares;
  const disqOrdTax = disqOrdIncome * mrate;
  const disqLTCGTax = calcLTCGtax(disqLTCGGain, ordIncome + disqOrdIncome, status);
  const disqTotalTax = disqOrdTax + disqLTCGTax;
  const disqProceeds = disqGross - disqTotalTax;
  const disqEffRate = disqGross > 0 ? disqTotalTax / disqGross : 0;

  // ── QUALIFYING DISPOSITION (hold >2yr grant + >1yr purchase, IRC §423(a)(1)) ──
  // Ordinary income = lesser of (FMV at disposition - amount paid) and (FMV at grant - option
  // price) per share, floored at 0. IRC §423(c) (Cornell LII):
  //   "an amount equal to the lesser of— (1) the excess of the fair market value of the
  //    share at the time of such disposition ... over the amount paid for the share under
  //    the option, or (2) the excess of the fair market value of the share at the time the
  //    option was granted over the option price."
  const qualOrdIncomePerSh = Math.min(currentPrice - purchasePrice, offeringPrice - purchasePrice);
  const qualOrdIncome = Math.max(0, qualOrdIncomePerSh) * shares;
  const qualLTCGGain = Math.max(0, (currentPrice * shares) - (purchasePrice * shares) - qualOrdIncome);
  const qualGross = currentPrice * shares;
  const qualOrdTax = qualOrdIncome * mrate;
  const qualLTCGTax = calcLTCGtax(qualLTCGGain, ordIncome + qualOrdIncome, status);
  const qualTotalTax = qualOrdTax + qualLTCGTax;
  const qualProceeds = qualGross - qualTotalTax;
  const qualEffRate = qualGross > 0 ? qualTotalTax / qualGross : 0;

  const benefit = qualProceeds - disqProceeds;

  return {
    output_payload: {
      purchase_price: purchasePrice,
      offering_price: offeringPrice,
      current_price: currentPrice,
      shares_exercised: shares,
      grant_date: grantDate,
      purchase_date: purchaseDate,
      ordinary_income: ordIncome,
      filing_status: status,
      marginal_rate: mrate,
      fmv_at_purchase: fmvAtPurchase,
      disq_ord_income: disqOrdIncome,
      disq_ltcg_gain: disqLTCGGain,
      disq_gross: disqGross,
      disq_ord_tax: disqOrdTax,
      disq_ltcg_tax: disqLTCGTax,
      disq_total_tax: disqTotalTax,
      disq_proceeds: disqProceeds,
      disq_effective_rate: disqEffRate,
      qual_ord_income: qualOrdIncome,
      qual_ltcg_gain: qualLTCGGain,
      qual_gross: qualGross,
      qual_ord_tax: qualOrdTax,
      qual_ltcg_tax: qualLTCGTax,
      qual_total_tax: qualTotalTax,
      qual_proceeds: qualProceeds,
      qual_effective_rate: qualEffRate,
      benefit: benefit,
      qualify_date: qualifyDate,
      already_qualified: alreadyQualified,
      domain_errors: [],
      refusal_reason: null,
    },
    compliance_flags: [],
  };
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

export default compute;
