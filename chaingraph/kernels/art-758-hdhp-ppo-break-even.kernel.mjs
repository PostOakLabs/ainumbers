// art-758-hdhp-ppo-break-even — port of ApexLogics #105 "HDHP vs. PPO Break-Even
// Calculator" (AL-112, tool_id 105-hdhp-vs-ppo-break-even) inline compute, landed from
// the APEXPORT-105 porting payload (bus msi, GRADES PASS-PENDING-XV 2026-10-14,
// Builder-verifies-at-land 12/12 re-executed 2026-10-19 per the Tim 2026-10-18T21:20Z
// extend-ruling).
//
// The kernel takes two plan profiles (monthly premium, deductible, out-of-pocket
// maximum, coinsurance percent), an HSA profile (employer contribution, additional
// personal contribution), a marginal tax rate, a coverage class, an expected annual
// medical spend, and an as_of date, and returns the break-even medical spend (the
// first $50 grid point in [0, 20000] at which the HDHP total is <= the PPO total),
// the two totals at the expected spend, the winner and the savings, a comparison
// table at the page's fixed key spend levels, the HSA tax shield, and a
// recommendation. Functions planOOP / hdhpTotal / ppoTotal / calcBreakEven are
// ported 1:1 from the page (see DIFFERS.md in the payload: value disagreements NONE;
// shape changes S1 wall-clock -> explicit as_of, S2 DOM fallbacks -> named refusals,
// S3 inline table list -> named TABLE_STEPS literal).
//
// Pure function: no Date, no clock, no randomness, no I/O. The Apex page calls
// `new Date().toISOString()` ONLY for the lastResult/export timestamp, never in the
// arithmetic; the port replaces it with an explicit `as_of` input (deterministic,
// zkVM-promotable — the APEXPORT-110B pattern).
//
// GROUNDING (see APEXPORT-105 payload CITES.md, fetched 2026-10-13):
// - HSA annual contribution limits are the ONLY constants in the Apex arithmetic
//   (HSA_LIMITS): self-only $4,400; family $8,750 — IRS Rev. Proc. 2025-19,
//   MATCH, no DIFFERS row.
// - The age-55+ catch-up ($1,000, 26 USC, statutory, never
//   inflation-adjusted) is stated in the page's hint text but NOT applied by the
//   compute (the engine caps contributions at the base limit only). Carried verbatim
//   as the page has it; applying it would be a substantive change (DIFFERS.md N1).
// - Break-even is grid-quantised to $50 exactly as the page's brute-force loop
//   (DIFFERS.md N3); boundary fixtures b1a/b1b pin the grid predicate.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-758-hdhp-ppo-break-even';
const TOOL_VERSION = '1.0.0';

const APEX_SOURCE = {
  al_id: 'AL-112',
  tool_id: '105-hdhp-vs-ppo-break-even',
  display_number: '#105',
  page_url: 'https://apexlogics.org/tools/105-hdhp-vs-ppo-break-even/',
  page_bytes: 40952,
  page_sha256: 'BA3010EF002501D03FFC95FCC0C75CA1038235C230554E2DF067DEC57649A460',
  fetch_date: '2026-10-13',
};

// ---------- grounded 2026 constants (only constants in the compute) ----------

// IRS Rev. Proc. 2025-19 — 2026 HSA annual contribution limitations.
// Self-only $4,400; family $8,750. Catch-up $1,000 is statutory (26 USC)
// and never inflation-adjusted; the page lists it in a hint but the compute
// applies only the base limits below (see payload DIFFERS.md SCOPE note).
const HSA_LIMITS = Object.freeze({ individual: 4400, family: 8750, catchup: 1000 });

// Break-even search grid, verbatim from the page (calcBreakEven).
const BE_MIN = 0;
const BE_MAX = 20000;
const BE_STEP = 50;

// Fixed key spend levels rendered in the comparison table (payload DIFFERS.md S3).
const TABLE_STEPS = Object.freeze([0, 1500, 3000, 5000, 10000, 15000, 20000]);

const SCOPE_NOTE =
  'Plan-cost model only: premium + in-network cost sharing to the OOP maximum, minus the HSA ' +
  'tax shield on contributions up to the coverage limit. No FSA/HRA interactions, no out-of-' +
  'network or balance-billing, no prescription-tier carve-outs, no premium tax credits, no ' +
  'state-specific HSA deduction rules, and no investment growth on HSA balances. The HSA ' +
  'catch-up contribution for age 55+ is not applied (the source page does not apply it). ' +
  'Totals are the source page\'s own dollar arithmetic, unrounded; display rounds to cents.';

// ---------- refusal plumbing ----------

/**
 * @type {(reason: string, text: string) => { output_payload: object, compliance_flags: string[] }}
 */
function refused(reason, text) {
  const domain_errors = [{ code: reason, text }];
  const flags = [];
  if (domain_errors.length > 0) flags.push('ART758_INPUT_REFUSED');
  return {
    output_payload: {
      as_of: null,
      coverage: null,
      break_even_spend: null,
      hdhp_total_at_expected: null,
      ppo_total_at_expected: null,
      winner: null,
      savings: null,
      hsa_total_applied: null,
      hsa_tax_shield: null,
      comparison_table: [],
      recommendation: null,
      refusals: [],
      refusal_reason: reason,
      domain_errors,
      scope_note: SCOPE_NOTE,
    },
    compliance_flags: flags,
  };
}

// ---------- date helper (no Date object in the arithmetic) ----------

function isIsoDate(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const y = Number(v.slice(0, 4));
  const m = Number(v.slice(5, 7));
  const d = Number(v.slice(8, 10));
  if (m < 1 || m > 12 || d < 1) return false;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  return d <= dim;
}

// ---------- validation ----------

/** @type {(v: unknown) => boolean} a finite non-negative number */
function isNonNegNumber(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

/** @type {(v: unknown) => boolean} a finite number in [0, 100] (a percent) */
function isPercent(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
}

/**
 * @type {(pp: object) => { output_payload: object, compliance_flags: string[] } | null}
 */
function validate(pp) {
  if (!isIsoDate(pp.as_of)) {
    return refused('REFUSED_BAD_AS_OF', 'as_of must be a real calendar date as a YYYY-MM-DD string; the node never reads a clock');
  }
  if (pp.coverage !== 'individual' && pp.coverage !== 'family') {
    return refused('REFUSED_BAD_COVERAGE', "coverage must be 'individual' or 'family'");
  }
  for (const k of ['hdhp_premium_monthly', 'hdhp_deductible', 'hdhp_oop_max', 'ppo_premium_monthly', 'ppo_deductible', 'ppo_oop_max', 'employer_hsa', 'additional_hsa']) {
    if (!isNonNegNumber(pp[k])) {
      return refused('REFUSED_BAD_MONEY', 'policy_parameters.' + k + ' must be a finite non-negative number of USD dollars');
    }
  }
  if (!isPercent(pp.hdhp_coinsurance_pct) || !isPercent(pp.ppo_coinsurance_pct)) {
    return refused('REFUSED_BAD_COINSURANCE', 'coinsurance percentages must be finite numbers in [0, 100]');
  }
  if (!isPercent(pp.marginal_tax_rate_pct)) {
    return refused('REFUSED_BAD_TAX_RATE', 'marginal_tax_rate_pct must be a finite number in [0, 100]');
  }
  if (!isNonNegNumber(pp.expected_annual_spend)) {
    return refused('REFUSED_BAD_SPEND', 'expected_annual_spend must be a finite non-negative number of USD dollars');
  }
  return null;
}

// ---------- the ported compute (verbatim from the Apex page) ----------

// Apex planOOP.
export function planOOP(spend, deductible, coinsurancePct, oopMax) {
  const aboveDed = Math.max(0, spend - deductible);
  const coinsAmt = Math.min(aboveDed * coinsurancePct / 100, oopMax - deductible);
  const oop = Math.min(spend, deductible) + Math.max(0, coinsAmt);
  return Math.min(oop, oopMax);
}

// Apex hdhpTotal: premium + OOP minus the HSA tax shield.
export function hdhpTotal(spend, inp) {
  const oop = planOOP(spend, inp.hdhpDed, inp.coinHdhp, inp.hdhpOop);
  const hsaTaxShield = Math.min(inp.empHSA + inp.addlHSA, HSA_LIMITS[inp.cov]) * inp.margRate / 100;
  return inp.hdhpPremAnn + oop - hsaTaxShield;
}

// Apex ppoTotal: premium + OOP.
export function ppoTotal(spend, inp) {
  const oop = planOOP(spend, inp.ppoDed, inp.coinPpo, inp.ppoOop);
  return inp.ppoPremAnn + oop;
}

// The page's calcBreakEven numeric core, re-implemented 1:1 with the DOM reads
// resolved from policy_parameters (the normalization map is built in compute()
// so every declared input is read on compute's own body).
function calcBreakEven(expSpend, inp) {
  // Brute-force break-even: first grid point where HDHP total <= PPO total
  // (note the <=: HDHP "wins" ties at the break-even).
  let beSpend = null;
  for (let s = BE_MIN; s <= BE_MAX; s += BE_STEP) {
    if (hdhpTotal(s, inp) <= ppoTotal(s, inp)) { beSpend = s; break; }
  }

  const hdhpAt = hdhpTotal(expSpend, inp);
  const ppoAt = ppoTotal(expSpend, inp);
  // The page's "winner" is the STRICT comparison.
  const hdhpWins = hdhpAt < ppoAt;
  const savings = Math.abs(hdhpAt - ppoAt);

  // Comparison table at the page's fixed steps plus the expected spend.
  const spends = TABLE_STEPS.concat([expSpend]);
  const uniqueSpends = [...new Set(spends)].sort((a, b) => a - b);
  const comparison_table = uniqueSpends.map((s) => {
    const h = hdhpTotal(s, inp);
    const q = ppoTotal(s, inp);
    return { spend: s, hdhp_total: h, ppo_total: q, hdhp_saves: q - h };
  });

  // HSA tax shield.
  const hsaTotalApplied = Math.min(inp.empHSA + inp.addlHSA, HSA_LIMITS[inp.cov]);
  const hsaTaxShield = hsaTotalApplied * inp.margRate;

  // Recommendation branch. beSpend === null means the HDHP is never cheaper on the
  // grid; expSpend < beSpend means PPO likely cheaper.
  let recommendation;
  if (beSpend === null) recommendation = 'PPO_ALL_LEVELS';
  else if (expSpend < beSpend) recommendation = 'PPO_LIKELY';
  else recommendation = 'HDHP_BETTER';

  return {
    beSpend, hdhpAt, ppoAt, hdhpWins, savings,
    hsaTotalApplied, hsaTaxShield, comparison_table, recommendation,
  };
}

// ---------- compute ----------

/**
 * compute(pp) — pure HDHP-vs-PPO break-even over the declared input domain.
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = pp || {};
  const bad = validate(pp);
  if (bad) return bad;

  // Input normalization: the page multiplies monthly premiums by 12 and divides
  // the percent fields by 100. Every field is validated first (payload S2).
  const inp = {
    cov: pp.coverage,
    hdhpPremAnn: pp.hdhp_premium_monthly * 12,
    hdhpDed: pp.hdhp_deductible,
    hdhpOop: pp.hdhp_oop_max,
    coinHdhp: pp.hdhp_coinsurance_pct,
    ppoPremAnn: pp.ppo_premium_monthly * 12,
    ppoDed: pp.ppo_deductible,
    ppoOop: pp.ppo_oop_max,
    coinPpo: pp.ppo_coinsurance_pct,
    empHSA: pp.employer_hsa,
    addlHSA: pp.additional_hsa,
    margRate: pp.marginal_tax_rate_pct / 100,
  };

  const r = calcBreakEven(pp.expected_annual_spend, inp);
  const flags = [];
  if (r.recommendation === 'PPO_ALL_LEVELS') flags.push('ART758_HDHP_NEVER_CHEAPER');
  if (r.hsaTotalApplied === 0) flags.push('ART758_NO_HSA_CONTRIBUTION');

  return {
    output_payload: {
      as_of: pp.as_of,
      coverage: pp.coverage,
      break_even_spend: r.beSpend,
      hdhp_total_at_expected: r.hdhpAt,
      ppo_total_at_expected: r.ppoAt,
      winner: r.hdhpWins ? 'HDHP' : 'PPO',
      savings: r.savings,
      hsa_total_applied: r.hsaTotalApplied,
      hsa_tax_shield: r.hsaTaxShield,
      comparison_table: r.comparison_table,
      recommendation: r.recommendation,
      refusals: [],
      refusal_reason: null,
      domain_errors: [],
      scope_note: SCOPE_NOTE,
    },
    compliance_flags: flags,
  };
}

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'estimate_hdhp_ppo_breakeven',
  mandate_type: 'compliance_control', gpu: false,
};

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
