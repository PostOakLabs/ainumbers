/**
 * art-575-tmpg-fails-charge-recompute.kernel.mjs
 * CAPMKT-WAVE-BUILD-SPEC.md §1 -- NY Fed TMPG fails-charge recompute (buyer vs
 * failing seller, UST/agency/MBS).
 *
 * Formula, per fail (TMPG trading practice, 2016 revision): charge = max(0, 3% -
 * reference_rate) / 360 x par x days_failed. The 3% cap and the 360 day-count are
 * the published practice constants; the reference rate and the failed-day count are
 * caller-declared per fail -- this kernel never fetches or invents either. A single
 * reference_rate_bps per fail represents the rate applicable over that fail's
 * declared days_failed window, matching the formula as published (a single rate, not
 * a daily schedule).
 *
 * Multi-fail batch input. Each fail with a declared claimed_charge_minor is diffed
 * against the recomputed charge within a caller-declared tolerance -- never a
 * default. A fail with no claimed amount cannot be diffed, so it contributes
 * INDETERMINATE rather than a silent pass. Overall verdict: DIVERGES if any fail
 * diverges, else INDETERMINATE if any fail lacks a claimed amount (or a required
 * input is absent), else MATCHES.
 *
 * SCOPE. No TMPG/NY Fed endorsement claim. Arithmetic only over caller-declared
 * inputs; does not source par amounts, reference rates, or fail status from any
 * feed.
 *
 * MINOR UNITS. par_amount_minor and claimed_charge_minor are integer minor units
 * (cents); recomputed charges round to the nearest minor unit (round-half-up) so
 * every comparison is exact integer arithmetic.
 *
 * Deterministic arithmetic only -- no clock, no randomness, no network, no PII.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-575-tmpg-fails-charge-recompute';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'recompute_tmpg_fails_charge',
  mandate_type: 'compliance_control', gpu: false,
};

const MAX_FAILS = 500;
const CAP_BPS = 300; // 3.00% published TMPG fails-charge cap.
const DAY_COUNT = 360;

function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }

function posInt(v) {
  if (typeof v === 'number' && Number.isSafeInteger(v) && v > 0) return v;
  return null;
}

function nonNegInt(v) {
  if (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0) return v;
  return null;
}

function bpsRate(v) {
  if (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0) return v;
  return null;
}

// Round-half-up on a non-negative rational expressed as numerator/denominator --
// avoids floating-point division residue for the comparison against claimed_charge_minor.
function roundHalfUpRatio(numerator, denominator) {
  const q = Math.floor(numerator / denominator);
  const r = numerator - q * denominator;
  return (r * 2 >= denominator) ? q + 1 : q;
}

const SCOPE_NOTE = 'Performs arithmetic only over caller-declared par amounts, reference rates, and fail-day counts. Does not source, derive, or independently verify any fail status, par amount, or reference rate, and makes no TMPG/NY Fed endorsement claim.';
const CLAUSE_NOTE = 'NY Fed Treasury Market Practices Group fails-charge trading practice (2016 revision): charge = max(0, 3% - reference rate) / 360 x par x days failed. Confirm the current practice text at newyorkfed.org before relying on a computed figure for a live claim.';

function emptyResult(reason, extra, flags) {
  return {
    output_payload: {
      decision: { execution_state: 'did_not_run', reason },
      diff_tolerance_minor: (extra && typeof extra.diff_tolerance_minor === 'number') ? extra.diff_tolerance_minor : null,
      verdict: 'INDETERMINATE',
      fail_count: 0,
      determinations: [],
      total_recomputed_charge_minor: 0,
      total_claimed_charge_minor: null,
      rejected_inputs: (extra && extra.rejected_inputs) || [],
      scope_note: SCOPE_NOTE,
      clause_note: CLAUSE_NOTE,
    },
    compliance_flags: flags,
  };
}

export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];

  const toleranceDeclared = pp.diff_tolerance_minor !== undefined && pp.diff_tolerance_minor !== null && pp.diff_tolerance_minor !== '';
  const diff_tolerance_minor = toleranceDeclared ? nonNegInt(pp.diff_tolerance_minor) : null;
  if (!toleranceDeclared) {
    rejected_inputs.push({ where: 'diff_tolerance_minor', reason: 'absent -- a diff tolerance must be declared, never defaulted', supplied: null });
    return emptyResult('diff_tolerance_not_declared', { rejected_inputs }, ['TMPG_TOLERANCE_NOT_DECLARED']);
  }
  if (diff_tolerance_minor === null) {
    rejected_inputs.push({ where: 'diff_tolerance_minor', reason: 'not a non-negative safe integer number of minor units', supplied: typeof pp.diff_tolerance_minor === 'number' ? pp.diff_tolerance_minor : String(pp.diff_tolerance_minor) });
    return emptyResult('diff_tolerance_not_declared', { rejected_inputs }, ['TMPG_TOLERANCE_NOT_DECLARED']);
  }

  const failsIn = Array.isArray(pp.fails) ? pp.fails.slice(0, MAX_FAILS) : [];
  const determinations = [];
  const seenIds = new Map();

  for (let i = 0; i < failsIn.length; i++) {
    const row = failsIn[i] || {};
    const fail_id = isNonEmptyString(row.fail_id) ? row.fail_id.trim() : null;
    if (!fail_id) { rejected_inputs.push({ where: `fails[${i}].fail_id`, reason: 'absent', supplied: null }); continue; }
    if (seenIds.has(fail_id)) { rejected_inputs.push({ where: `fails[${i}].fail_id`, reason: 'duplicate fail_id', supplied: fail_id }); continue; }

    const par_amount_minor = posInt(row.par_amount_minor);
    const days_failed = posInt(row.days_failed);
    const reference_rate_bps = bpsRate(row.reference_rate_bps);
    if (par_amount_minor === null) { rejected_inputs.push({ where: `fails[${i}].par_amount_minor`, reason: 'absent or not a positive integer number of minor units', supplied: fail_id }); continue; }
    if (days_failed === null) { rejected_inputs.push({ where: `fails[${i}].days_failed`, reason: 'absent or not a positive integer', supplied: fail_id }); continue; }
    if (reference_rate_bps === null) { rejected_inputs.push({ where: `fails[${i}].reference_rate_bps`, reason: 'absent or not a non-negative integer number of basis points', supplied: fail_id }); continue; }

    seenIds.set(fail_id, true);

    const rate_diff_bps = Math.max(0, CAP_BPS - reference_rate_bps);
    // charge = rate_diff_bps/10000 x par x days / 360 == (rate_diff_bps x par x days) / (10000 x 360)
    const numerator = rate_diff_bps * par_amount_minor * days_failed;
    const denominator = 10000 * DAY_COUNT;
    const recomputed_charge_minor = roundHalfUpRatio(numerator, denominator);

    const claimedDeclared = row.claimed_charge_minor !== undefined && row.claimed_charge_minor !== null && row.claimed_charge_minor !== '';
    const claimed_charge_minor = claimedDeclared ? nonNegInt(row.claimed_charge_minor) : null;
    if (claimedDeclared && claimed_charge_minor === null) {
      rejected_inputs.push({ where: `fails[${i}].claimed_charge_minor`, reason: 'declared but not a non-negative safe integer number of minor units', supplied: fail_id });
    }

    let fail_verdict, delta_minor;
    if (claimed_charge_minor === null) {
      fail_verdict = 'INDETERMINATE';
      delta_minor = null;
    } else {
      delta_minor = recomputed_charge_minor - claimed_charge_minor;
      fail_verdict = Math.abs(delta_minor) <= diff_tolerance_minor ? 'MATCHES' : 'DIVERGES';
    }

    determinations.push({
      fail_id, par_amount_minor, days_failed, reference_rate_bps,
      rate_diff_bps, recomputed_charge_minor,
      claimed_charge_minor, delta_minor, verdict: fail_verdict,
    });
  }

  if (failsIn.length > MAX_FAILS) rejected_inputs.push({ where: 'fails', reason: `more than ${MAX_FAILS} fails supplied`, supplied: failsIn.length });
  if (determinations.length === 0) {
    return emptyResult('required_inputs_incomplete', { diff_tolerance_minor, rejected_inputs }, ['TMPG_REQUIRED_INPUTS_INCOMPLETE']);
  }

  const total_recomputed_charge_minor = determinations.reduce((s, d) => s + d.recomputed_charge_minor, 0);
  const claimedTotals = determinations.filter((d) => d.claimed_charge_minor !== null);
  const total_claimed_charge_minor = claimedTotals.length > 0 ? claimedTotals.reduce((s, d) => s + d.claimed_charge_minor, 0) : null;

  const hasDiverge = determinations.some((d) => d.verdict === 'DIVERGES');
  const hasIndeterminate = determinations.some((d) => d.verdict === 'INDETERMINATE');
  const verdict = hasDiverge ? 'DIVERGES' : hasIndeterminate ? 'INDETERMINATE' : 'MATCHES';

  const compliance_flags = ['TMPG_FAILS_CHARGE_RECOMPUTED'];
  if (hasDiverge) compliance_flags.push('TMPG_FAILS_CHARGE_DIVERGENCE');
  if (hasIndeterminate) compliance_flags.push('TMPG_FAILS_CHARGE_CLAIM_MISSING');
  if (rejected_inputs.length > 0) compliance_flags.push('TMPG_INPUTS_REJECTED');

  return {
    output_payload: {
      decision: { execution_state: 'ran', reason: null },
      diff_tolerance_minor,
      verdict,
      fail_count: determinations.length,
      determinations,
      total_recomputed_charge_minor,
      total_claimed_charge_minor,
      rejected_inputs,
      scope_note: SCOPE_NOTE,
      clause_note: CLAUSE_NOTE,
    },
    compliance_flags,
  };
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
