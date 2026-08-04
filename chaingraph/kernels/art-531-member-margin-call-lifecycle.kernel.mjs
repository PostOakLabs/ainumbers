/**
 * art-531-member-margin-call-lifecycle.kernel.mjs
 * CCP-CORE-BUILD-SPEC.md §1.4 (RFP-adjacent CCP-core clearing primitives).
 *
 * Tracks a margin call through its declared lifecycle states -- issued -> confirmed ->
 * funded, or issued -> disputed -> escalated -- against a caller-declared SLA window
 * (minutes from issued_at), and attests whether the call was met within the CCP's own
 * published timing rule. Every timestamp is a caller-declared ISO-8601 datetime; this
 * kernel never reads a clock. `as_of` is the caller's declared evaluation point for a
 * still-open call, exactly the art-516 as_of/reconciliation_date pattern.
 *
 * PROVENANCE: PFMI Principle 6 (Margin) intraday/variation-margin-call timing
 * expectations -- a standing principle, not the 2026 CPMI-IOSCO transparency
 * consultation amendments (closed 2026-06-30, no compliance date).
 *
 * §27 SCOPE LIMIT: this node emits state/attestation facts only. `suggested_gate_route`
 * is informational output describing what a §27.4 gate_policy consumer COULD do with
 * this result (end / escalate / hold) -- this kernel does not itself implement any
 * workflow or escalation engine.
 *
 * PII / §25: `member_ref` is an opaque caller-supplied reference only (matching the
 * exception_id / record-ref pattern already used by art-516) -- this kernel never
 * receives or computes a salted digest over a raw member identity. No account holder,
 * beneficiary, or individual identity of any kind enters this kernel.
 *
 * FIXED-POINT MONEY MATH (CONTRACT money convention, art-499/art-516 pattern). The call
 * amount crosses the boundary as an integer number of minor units; no floating-point
 * arithmetic anywhere in compute(). A non-integer, non-finite, or absent amount is
 * coerced to 0 and named in `rejected_inputs[]`, never silently dropped.
 *
 * FINITE GATE. An unfunded call, an absent dispute, and an absent escalation each
 * resolve to a DEFINED current_state and compliance flag set. No branch emits NaN,
 * Infinity, null-as-a-number, or an undefined status.
 *
 * REGION-PORTABLE BY CONSTRUCTION. No country, currency, or CCP name is hardcoded --
 * `currency` and `sla_minutes` are caller-declared policy inputs, matching each CCP's
 * own published margin-call timing rule.
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute().
 *
 * Spec: CCP-CORE-BUILD-SPEC.md §1.4.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-531-member-margin-call-lifecycle';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'attest_margin_call_lifecycle', mandate_type: 'attestation_mandate', gpu: false };

function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function isSafeIntAmount(v) { return typeof v === 'number' && Number.isFinite(v) && Number.isSafeInteger(v); }
function isoDtOrNull(v) {
  if (typeof v !== 'string' || v.trim().length === 0) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? v : null;
}

/** Integer coercion with an explicit rejection record. Never a silent drop, never NaN. */
function toMinorUnits(v, where, rejected) {
  if (isSafeIntAmount(v)) return v;
  if (v === undefined || v === null || v === '') { rejected.push({ where, reason: 'absent', supplied: null }); return 0; }
  rejected.push({
    where,
    reason: typeof v === 'number' ? 'not a safe integer number of minor units' : `expected an integer number of minor units, got ${typeof v}`,
    supplied: typeof v === 'number' && Number.isFinite(v) ? v : String(v),
  });
  return 0;
}
function display(minor) {
  const neg = minor < 0;
  const abs = neg ? -minor : minor;
  const whole = Math.trunc(abs / 100);
  const frac = abs - whole * 100;
  return (neg ? '-' : '') + String(whole) + '.' + String(frac).padStart(2, '0');
}
/** Whole-minute delta between two ISO datetime strings, no Date.now(), both caller-supplied. Can be negative. */
function minutesDelta(laterIso, earlierIso) {
  if (!isoDtOrNull(laterIso) || !isoDtOrNull(earlierIso)) return null;
  const later = Date.parse(laterIso);
  const earlier = Date.parse(earlierIso);
  if (!Number.isFinite(later) || !Number.isFinite(earlier)) return null;
  return Math.round((later - earlier) / 60000);
}

export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];

  const call_id = isNonEmptyString(pp.call_id) ? pp.call_id.trim() : (rejected_inputs.push({ where: 'call_id', reason: 'absent', supplied: null }), 'UNLABELLED-CALL');
  const member_ref = isNonEmptyString(pp.member_ref) ? pp.member_ref.trim() : null;
  const currency = isNonEmptyString(pp.currency) ? pp.currency.trim().toUpperCase() : 'USD';
  const amount_minor_units = toMinorUnits(pp.amount_minor_units, 'amount_minor_units', rejected_inputs);

  const sla_minutes = (typeof pp.sla_minutes === 'number' && Number.isFinite(pp.sla_minutes) && pp.sla_minutes >= 0)
    ? Math.trunc(pp.sla_minutes) : null;
  if (sla_minutes === null) rejected_inputs.push({ where: 'sla_minutes', reason: 'absent or not a non-negative number', supplied: pp.sla_minutes === undefined ? null : pp.sla_minutes });

  const issued_at = isoDtOrNull(pp.issued_at);
  if (pp.issued_at !== undefined && issued_at === null) rejected_inputs.push({ where: 'issued_at', reason: 'not a parseable ISO-8601 datetime', supplied: String(pp.issued_at) });
  else if (pp.issued_at === undefined) rejected_inputs.push({ where: 'issued_at', reason: 'absent', supplied: null });

  const as_of = isoDtOrNull(pp.as_of) || issued_at;
  if (pp.as_of !== undefined && isoDtOrNull(pp.as_of) === null) rejected_inputs.push({ where: 'as_of', reason: 'not a parseable ISO-8601 datetime', supplied: String(pp.as_of) });

  function optDt(field) {
    if (pp[field] === undefined || pp[field] === null) return null;
    const d = isoDtOrNull(pp[field]);
    if (d === null) rejected_inputs.push({ where: field, reason: 'not a parseable ISO-8601 datetime', supplied: String(pp[field]) });
    return d;
  }
  const confirmed_at = optDt('confirmed_at');
  const funded_at = optDt('funded_at');
  const disputed_at = optDt('disputed_at');
  const escalated_at = optDt('escalated_at');

  const dispute_reason = isNonEmptyString(pp.dispute_reason) ? pp.dispute_reason.trim() : null;
  if (disputed_at && !dispute_reason) rejected_inputs.push({ where: 'dispute_reason', reason: 'absent while disputed_at is present', supplied: null });

  // --- Chronological sequence validity: every declared pair, later must not precede earlier. ---
  const sequence_errors = [];
  function checkOrder(laterField, laterIso, earlierField, earlierIso) {
    if (!laterIso || !earlierIso) return;
    const delta = minutesDelta(laterIso, earlierIso);
    if (delta !== null && delta < 0) sequence_errors.push(`${laterField} precedes ${earlierField} by ${-delta} minute(s)`);
  }
  checkOrder('confirmed_at', confirmed_at, 'issued_at', issued_at);
  checkOrder('funded_at', funded_at, 'issued_at', issued_at);
  checkOrder('funded_at', funded_at, 'confirmed_at', confirmed_at);
  checkOrder('disputed_at', disputed_at, 'issued_at', issued_at);
  checkOrder('escalated_at', escalated_at, 'disputed_at', disputed_at);
  checkOrder('as_of', as_of, 'issued_at', issued_at);
  const sequence_valid = sequence_errors.length === 0;

  // --- Current state: funded > escalated > disputed > confirmed > issued. ---
  let current_state = 'issued';
  if (funded_at) current_state = 'funded';
  else if (escalated_at) current_state = 'escalated';
  else if (disputed_at) current_state = 'disputed';
  else if (confirmed_at) current_state = 'confirmed';

  const elapsed_to_funded_minutes = (funded_at && issued_at) ? minutesDelta(funded_at, issued_at) : null;
  const elapsed_to_asof_minutes = (as_of && issued_at) ? minutesDelta(as_of, issued_at) : null;

  const met_within_sla = (current_state === 'funded' && elapsed_to_funded_minutes !== null && sla_minutes !== null)
    ? elapsed_to_funded_minutes <= sla_minutes : null;

  const still_open = current_state === 'issued' || current_state === 'confirmed' || current_state === 'disputed';
  const overdue = still_open && elapsed_to_asof_minutes !== null && sla_minutes !== null && elapsed_to_asof_minutes > sla_minutes;

  const attested = current_state === 'funded' && met_within_sla === true && sequence_valid;

  const compliance_flags = [];
  if (!sequence_valid) compliance_flags.push('MARGINCALL_SEQUENCE_INVALID');
  if (current_state === 'funded') {
    compliance_flags.push(met_within_sla ? 'MARGINCALL_FUNDED_WITHIN_SLA' : 'MARGINCALL_FUNDED_LATE');
  } else if (current_state === 'escalated') {
    compliance_flags.push('MARGINCALL_ESCALATED');
  } else if (current_state === 'disputed') {
    compliance_flags.push('MARGINCALL_DISPUTED');
    if (overdue) compliance_flags.push('MARGINCALL_OVERDUE');
  } else {
    compliance_flags.push(overdue ? 'MARGINCALL_OVERDUE' : 'MARGINCALL_PENDING');
  }
  if (rejected_inputs.length > 0) compliance_flags.push('MARGINCALL_INPUTS_REJECTED');
  if (attested) compliance_flags.push('MARGINCALL_ATTESTED');

  // Informational only -- §27.0 scope limit: this node names a route, it does not route.
  const suggested_gate_route = attested ? 'end' : (current_state === 'disputed' || current_state === 'escalated' || overdue ? 'escalate' : 'hold');

  const rationale = [];
  rationale.push(`Call ${call_id} issued ${issued_at || 'UNDECLARED'}, currently ${current_state}, declared SLA ${sla_minutes === null ? 'UNDECLARED' : sla_minutes + ' minute(s)'}.`);
  if (current_state === 'funded') {
    rationale.push(met_within_sla
      ? `Funded ${elapsed_to_funded_minutes} minute(s) after issuance, within the ${sla_minutes}-minute SLA.`
      : `Funded ${elapsed_to_funded_minutes === null ? 'at an unmeasurable time' : elapsed_to_funded_minutes + ' minute(s) after issuance'}, exceeding the ${sla_minutes === null ? 'UNDECLARED' : sla_minutes}-minute SLA.`);
  } else {
    rationale.push(overdue
      ? `Not yet funded; ${elapsed_to_asof_minutes} minute(s) elapsed as of the declared evaluation point, exceeding the ${sla_minutes}-minute SLA.`
      : `Not yet funded; call remains within the declared SLA window as of the declared evaluation point.`);
  }
  if (disputed_at) rationale.push(`Disputed ${disputed_at}${dispute_reason ? ` (${dispute_reason})` : ''}${escalated_at ? `, escalated ${escalated_at}` : ', not yet escalated'}.`);
  if (!sequence_valid) rationale.push(`Declared timestamps are not chronologically consistent: ${sequence_errors.join('; ')}.`);
  rationale.push('This is a state/attestation fact over the timestamps supplied for this call. It does not itself implement any escalation workflow and the suggested gate route is informational only.');

  const output_payload = {
    call_id, member_ref, currency,
    amount_minor_units, amount_display: display(amount_minor_units),
    sla_minutes, issued_at, as_of, confirmed_at, funded_at, disputed_at, escalated_at, dispute_reason,
    current_state,
    elapsed_to_funded_minutes, elapsed_to_asof_minutes,
    met_within_sla, overdue, sequence_valid, sequence_errors,
    attested, suggested_gate_route,
    rejected_inputs, rationale,
    note: 'Deterministic margin-call lifecycle attestation over caller-declared state timestamps and a caller-declared SLA window. It attests whether the call was funded within the CCP\'s own published timing rule -- issued -> confirmed -> funded, or issued -> disputed -> escalated -- rather than implementing any margin-call workflow itself.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null, execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
