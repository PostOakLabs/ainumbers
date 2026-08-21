import { executionHash } from './_hash.mjs';

// art-661-interest-accrual-recompute — CORE-VERIFY-ACCRUAL-1. Recomputes per-day interest
// accrual over a caller-declared day-count/compounding convention and diffs it against the
// core's own posted ledger entries. Independent recompute-and-receipt only — never a claim
// to audit or replace any core platform (positioning guardrails, board row).
//
// CYCLE CLASS (SO #43): FAST. compute() loops once over the caller-supplied daily_balances
// array, bounded by a statement period (typically 28-31 days, at most a few hundred for a
// multi-month reconciliation), pure arithmetic (Math.round only, no transcendentals), no
// in-guest signature/hash verification. Nowhere near the 30M-cycle FAST/SLOW line.
//
// DETERMINISM: compute() is a pure function of pp -- no wall-clock reads, no randomness, no
// network, no filesystem. No TextEncoder/atob/btoa/URL usage, so the QuickJS-ng zkVM guest
// builtin-safety constraint (chaingraph/kernels/check-guest-builtin-safety.mjs) does not
// apply here.

const TOOL_ID = 'art-661-interest-accrual-recompute';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_interest_accrual_recompute',
  mandate_type: 'compliance_control', gpu: false,
};

const DAY_COUNT_CONVENTIONS = ['30/360', 'actual/360', 'actual/365', 'actual/actual'];

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function dayCountDenominator(convention, dateStr) {
  if (convention === '30/360' || convention === 'actual/360') return 360;
  if (convention === 'actual/365') return 365;
  if (convention === 'actual/actual') return isLeapYear(Number(dateStr.slice(0, 4))) ? 366 : 365;
  throw new Error('UNSUPPORTED_DAY_COUNT_CONVENTION: ' + convention);
}

function isInt(v) {
  return typeof v === 'number' && isFinite(v) && Math.floor(v) === v;
}

function applicableRate(productTerms, effectiveBalanceCents) {
  if (productTerms.rate_type === 'fixed') return productTerms.rate_value;
  if (productTerms.rate_type === 'tiered') {
    const tiers = Array.isArray(productTerms.tiers) ? productTerms.tiers : [];
    for (const t of tiers) {
      const floor = t.tier_floor_cents;
      const ceiling = t.tier_ceiling_cents;
      if (effectiveBalanceCents >= floor && (ceiling == null || effectiveBalanceCents < ceiling)) return t.rate_value;
    }
    throw new Error('NO_MATCHING_TIER: balance ' + effectiveBalanceCents + ' cents matches no declared tier');
  }
  throw new Error('UNSUPPORTED_RATE_TYPE: ' + productTerms.rate_type);
}

/**
 * compute(pp) — pure decision kernel.
 *
 * Recomputes per-day interest accrual over a caller-declared day-count convention and
 * compounding basis, then diffs the recomputed cumulative accrual against the core's own
 * posted accrual/interest-paid ledger entries checkpoint by checkpoint, reporting the first
 * date and cent amount at which they diverge.
 *
 * pp.daily_balances: one {date, principal_balance_cents} row per day in the statement
 * period (from the core's ledger running_balance). pp.core_reported_accruals: the core's own
 * posted {date, amount_cents} interest-accrual/interest-paid ledger rows within the period.
 * pp.product_terms: {day_count_convention, compounding, rate_type, rate_value?, tiers?} --
 * caller-declared, never inferred.
 *
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = pp || {};
  const errors = [];

  const dailyBalances = Array.isArray(pp.daily_balances) ? pp.daily_balances : null;
  if (!dailyBalances || dailyBalances.length === 0) errors.push('daily_balances must be a non-empty array');

  const coreReported = Array.isArray(pp.core_reported_accruals) ? pp.core_reported_accruals : null;
  if (!coreReported) errors.push('core_reported_accruals must be an array (empty is legal, yields INDETERMINATE)');

  const pt = pp.product_terms;
  if (!pt || typeof pt !== 'object') {
    errors.push('product_terms is required');
  } else {
    if (!DAY_COUNT_CONVENTIONS.includes(pt.day_count_convention)) {
      errors.push('product_terms.day_count_convention must be one of ' + DAY_COUNT_CONVENTIONS.join(', '));
    }
    if (pt.compounding !== 'daily' && pt.compounding !== 'monthly' && pt.compounding !== 'none') {
      errors.push('product_terms.compounding must be one of daily, monthly, none');
    }
    if (pt.rate_type === 'fixed') {
      if (typeof pt.rate_value !== 'number' || !isFinite(pt.rate_value) || pt.rate_value < 0) {
        errors.push('product_terms.rate_value must be a non-negative number for rate_type "fixed"');
      }
    } else if (pt.rate_type === 'tiered') {
      if (!Array.isArray(pt.tiers) || pt.tiers.length === 0) {
        errors.push('product_terms.tiers must be a non-empty array for rate_type "tiered"');
      }
    } else {
      errors.push('product_terms.rate_type must be "fixed" or "tiered"');
    }
  }

  if (dailyBalances) {
    for (const row of dailyBalances) {
      if (typeof row.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
        errors.push('daily_balances entry has a non-ISO date: ' + JSON.stringify(row.date));
      }
      if (!isInt(row.principal_balance_cents) || row.principal_balance_cents < 0) {
        errors.push('daily_balances entry has a non-negative-integer principal_balance_cents: ' + JSON.stringify(row.date));
      }
    }
  }
  if (coreReported) {
    for (const row of coreReported) {
      if (typeof row.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
        errors.push('core_reported_accruals entry has a non-ISO date: ' + JSON.stringify(row.date));
      }
      if (!isInt(row.amount_cents)) {
        errors.push('core_reported_accruals entry has a non-integer amount_cents: ' + JSON.stringify(row.date));
      }
    }
  }

  if (errors.length > 0) {
    return {
      output_payload: {
        valid_input: false,
        domain_errors: errors,
        schedule: [],
        total_recomputed_accrual_cents: null,
        core_reported_total_cents: null,
        verdict: 'INDETERMINATE',
        first_divergence: null,
      },
      compliance_flags: ['ACCRUAL_INPUT_OUT_OF_DECLARED_DOMAIN'],
    };
  }

  const sortedDays = dailyBalances.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const sortedCore = coreReported.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const schedule = [];
  let cumulativeRecomputedCents = 0;
  let compoundBucketCents = 0;
  for (const day of sortedDays) {
    const denominator = dayCountDenominator(pt.day_count_convention, day.date);
    const effectiveBalanceCents = day.principal_balance_cents + (pt.compounding === 'daily' ? compoundBucketCents : 0);
    const rate = applicableRate(pt, effectiveBalanceCents);
    const dailyAccrualCents = Math.round((effectiveBalanceCents * rate) / denominator);
    cumulativeRecomputedCents += dailyAccrualCents;
    schedule.push({
      date: day.date,
      day_count_denominator: denominator,
      applicable_rate: rate,
      principal_balance_cents: day.principal_balance_cents,
      daily_accrual_cents: dailyAccrualCents,
      cumulative_recomputed_cents: cumulativeRecomputedCents,
      cumulative_core_reported_cents: null,
    });
    if (pt.compounding === 'daily') compoundBucketCents += dailyAccrualCents;
  }

  const totalRecomputedCents = cumulativeRecomputedCents;
  const coreTotalCents = sortedCore.reduce((sum, row) => sum + row.amount_cents, 0);

  // Checkpoints are the CORE's own posting dates, not every day in the schedule; a core
  // that posts accrual monthly (or once at period end) is not "diverging" on every
  // intervening day just because it hasn't posted yet.
  let verdict = 'INDETERMINATE';
  let firstDivergence = null;
  if (sortedCore.length > 0) {
    verdict = 'MATCHES';
    let coreCumulative = 0;
    let scheduleIdx = 0;
    let recomputedCumulativeThroughCheckpoint = 0;
    for (const posting of sortedCore) {
      coreCumulative += posting.amount_cents;
      while (scheduleIdx < schedule.length && schedule[scheduleIdx].date <= posting.date) {
        recomputedCumulativeThroughCheckpoint = schedule[scheduleIdx].cumulative_recomputed_cents;
        scheduleIdx++;
      }
      const diffCents = recomputedCumulativeThroughCheckpoint - coreCumulative;
      if (diffCents !== 0 && firstDivergence === null) {
        firstDivergence = { date: posting.date, diff_cents: diffCents };
        verdict = 'DIVERGES';
      }
    }
    // stamp each posting checkpoint's cumulative core-reported total onto its schedule row
    // (only rows that coincide with a core posting date carry this field; interior days
    // between postings are recompute-only, by design).
    for (let i = 0, running = 0, ci = 0; i < schedule.length; i++) {
      if (ci < sortedCore.length && sortedCore[ci].date === schedule[i].date) {
        running += sortedCore[ci].amount_cents;
        schedule[i].cumulative_core_reported_cents = running;
        ci++;
      }
    }
  }

  const compliance_flags = [
    verdict === 'MATCHES' ? 'ACCRUAL_RECOMPUTE_MATCHES' : verdict === 'DIVERGES' ? 'ACCRUAL_RECOMPUTE_DIVERGES' : 'ACCRUAL_RECOMPUTE_INDETERMINATE_NO_CORE_POSTINGS',
  ];

  const output_payload = {
    valid_input: true,
    domain_errors: [],
    schedule,
    total_recomputed_accrual_cents: totalRecomputedCents,
    core_reported_total_cents: coreTotalCents,
    verdict,
    first_divergence: firstDivergence,
    day_count_convention: pt.day_count_convention,
    compounding: pt.compounding,
    rate_type: pt.rate_type,
    note: 'Verify-only recomputation of per-day interest accrual over the caller-declared day-count convention and compounding basis, diffed against the core\'s own posted accrual/interest-paid ledger entries. This is an independent recompute-and-receipt, not a claim to find defects in the core, and not an endorsement or substitution of any core platform.',
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
