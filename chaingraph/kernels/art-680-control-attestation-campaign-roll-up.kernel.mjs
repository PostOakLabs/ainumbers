import { executionHash } from './_hash.mjs';

// art-680-control-attestation-campaign-roll-up (ATTEST-CAMPAIGN-BUILD-1, ATTEST-CAMPAIGN-BUILD-SPEC.md)
//
// Roll-up of a caller-declared control-attestation campaign: completion percentage, exception
// rate, and an escalation verdict against a DECLARED escalation threshold. It exists because
// T158-style control maps carry no campaign completion arithmetic; it links nothing and checks
// nothing live. It feeds the exam pack's evidence leg by pointer only — the pointer lives on
// the tool page, never in this kernel.
//
// VERDICT RULES (mechanical, from the declared threshold):
//   - below_threshold = completion_pct < escalation_threshold_pct (strictly).
//   - ESCALATION_FLAGGED iff below_threshold OR exceptions > 0 OR unresponded > 0.
//   - otherwise NO_ESCALATION (threshold met AND zero exceptions AND zero unresponded).
//
// ROUNDING CONVENTION (declared, per spec): completion_pct and exception_rate_pct are rounded
// half-up to 2 decimal places by roundHalfUp(x, 2) — 10^dp by repeated multiplication, never
// Math.pow (a banned non-deterministic-guest transcendental). Both rates are whole numbers
// whenever attested/exceptions divide evenly, which is what the canonical trace stringifies.
//
// NEVER GUESS, NEVER DEFAULT. An absent, non-integer, or out-of-range controls_total, attested,
// exceptions, unresponded, or escalation_threshold_pct resolves to the fail-closed payload —
// every summary field nulled, each offending input named in domain_errors — never a silently
// repaired roll-up.
//
// SCOPE FENCE: arithmetic over caller-declared synthetic declarations only. It does NOT read
// any register, GRC system, or control repository; "attested", "exception" and "unresponded"
// are the caller's declarations, never observations this kernel makes; an ESCALATION_FLAGGED
// verdict is a declared-threshold comparison, not a regulatory determination.
//
// Zero network, zero storage, zero randomness, zero wall-clock reads inside compute(). No
// TextEncoder/atob/btoa/URL/Date anywhere in this file (QuickJS-ng guest safe).

const TOOL_ID = 'art-680-control-attestation-campaign-roll-up';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_control_attestation_campaign_roll_up',
  mandate_type: 'compliance_control', gpu: false,
};

const MAX_CONTROLS = 100000;

const ERROR_PHRASES = {
  INVALID_TOTAL: 'controls_total must be an integer in [1, 100000]',
  INVALID_ATTESTED: 'attested must be an integer in [0, controls_total]',
  INVALID_EXCEPTIONS: 'exceptions must be an integer in [0, controls_total]',
  INVALID_UNRESPONDED: 'unresponded must be an integer in [0, controls_total]',
  INVALID_THRESHOLD: 'escalation_threshold_pct must be a number in [0, 100]',
};

/** Half-up rounding to dp decimal places, sign-symmetric, deterministic. 10^dp by repeated
 *  multiplication — never Math.pow (a banned non-deterministic-guest transcendental). */
function roundHalfUp(x, dp) {
  let m = 1;
  for (let i = 0; i < dp; i++) m *= 10;
  const scaled = x * m;
  const r = scaled < 0 ? -Math.floor(-scaled + 0.5) : Math.floor(scaled + 0.5);
  return r / m;
}

function isCount(v) {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

export function compute(pp) {
  pp = pp || {};
  const domain_errors = [];

  const total = pp.controls_total;
  if (!isCount(total) || total < 1 || total > MAX_CONTROLS) domain_errors.push('INVALID_TOTAL');

  const attested = pp.attested;
  if (!isCount(attested) || attested > total) domain_errors.push('INVALID_ATTESTED');

  const exceptions = pp.exceptions;
  if (!isCount(exceptions) || exceptions > total) domain_errors.push('INVALID_EXCEPTIONS');

  const unresponded = pp.unresponded;
  if (!isCount(unresponded) || unresponded > total) domain_errors.push('INVALID_UNRESPONDED');

  const threshold = pp.escalation_threshold_pct;
  if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
    domain_errors.push('INVALID_THRESHOLD');
  }

  const compliance_flags = [];

  if (domain_errors.length > 0) {
    compliance_flags.push('DOMAIN_ERROR');
    for (const code of domain_errors) compliance_flags.push(`CONATTR_${code}`);
    const reasons = domain_errors.map((c) => ERROR_PHRASES[c]).join('; ');
    return {
      output_payload: {
        completion_pct: null,
        exception_rate_pct: null,
        below_threshold: null,
        trace: `fail-closed: ${reasons}; no campaign roll-up computed -- correct the named inputs and resubmit. Arithmetic of caller-declared campaign declarations only: no register, GRC system, or control repository is read, and attested/exception/unresponded counts are your declarations, never observations this kernel makes.`,
        overall: null,
        domain_errors,
      },
      compliance_flags,
    };
  }

  const completionPct = roundHalfUp((attested / total) * 100, 2);
  const exceptionRatePct = roundHalfUp((exceptions / total) * 100, 2);
  const belowThreshold = completionPct < threshold;
  const flagged = belowThreshold || exceptions > 0 || unresponded > 0;
  const overall = flagged ? 'ESCALATION_FLAGGED' : 'NO_ESCALATION';

  const cmp = belowThreshold ? '<' : '>=';
  const trace = `${attested}/${total}=${completionPct}% ${cmp} declared ${threshold}% threshold; exceptions ${exceptions}/${total}=${exceptionRatePct}%`;

  const output_payload = {
    completion_pct: completionPct,
    exception_rate_pct: exceptionRatePct,
    below_threshold: belowThreshold,
    trace,
    overall,
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
