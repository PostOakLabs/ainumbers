/**
 * art-532-client-porting-check.kernel.mjs
 * CCP-core clearing primitives (CCP-CORE-BUILD-SPEC.md §1.5, CCPCORE-PORTING-1) — checks whether a
 * client's cleared positions and collateral are portable to a backup clearing member under a
 * caller-declared porting window, given caller-declared completeness and backup-member consent.
 *
 * Provenance: PFMI Principle 14 (Segregation and Portability) and, where a firm's structure
 * intersects broker-dealer customer protection, SEC Rule 15c3-3a. Both are standing rules, not
 * the 2026 CPMI-IOSCO consultation amendments (CCP-CORE-BUILD-SPEC.md front matter).
 *
 * SINGLE-RUN AND STATELESS. Nothing here runs on a schedule, stores state, or retains data. The
 * caller declares a snapshot of positions, collateral, consent status, and the porting window;
 * this kernel evaluates that one snapshot, once.
 *
 * A PORTABILITY VERDICT IS AN EVALUATION OF THE SUPPLIED SNAPSHOT, NOT A GUARANTEE OF PORTING
 * OUTCOME. It does not itself move a position or collateral, execute a transfer, or bind the
 * backup clearing member -- consent status is a caller-declared fact about a decision made
 * elsewhere.
 *
 * FIXED-POINT MONEY MATH. Every amount crosses the boundary as an INTEGER NUMBER OF MINOR UNITS.
 * There is no floating-point arithmetic in compute(): notional and collateral sums are integer
 * operations, and 2dp display strings come from integer division plus string padding, never
 * toFixed() on a float. A non-integer, non-finite, or unsafe amount is coerced to 0 AND named in
 * rejected_inputs, never silently dropped.
 *
 * NO CLOCK. default_event_at and evaluated_at are BOTH caller-declared timestamps; compute()
 * never reads a clock. The elapsed-window arithmetic below is deterministic integer math over
 * two supplied timestamps, not a read of "now".
 *
 * FINITE GATE. An empty position set, an empty collateral set, and a missing consent declaration
 * each resolve to a DEFINED verdict. No branch can emit NaN, Infinity, or an undefined verdict.
 *
 * §25 discipline (per row instruction: "same §25 discipline if any client identifier enters the
 * preimage"): client_ref is treated as an OPAQUE caller-supplied reference token, the same
 * precedent already used for account_ref elsewhere in the reconciliation estate (e.g. art-499) --
 * it is not a real customer name, account number, or other enumerable/sensitive identifier, so no
 * bare identifier of that kind ever enters policy_parameters or output_payload and no
 * sha256-salted@1 digest is required. If a future caller needs to carry a genuine low-cardinality
 * client identifier through this node, that identifier MUST be salted per §25.1 before it reaches
 * compute() -- this kernel does not accept one today.
 *
 * §28 CLAUSE BINDING (profile `ocg-clause-binding@1`): the rule references this kernel relies on
 * are emitted as §1.2 pinned citation OBJECTS inside output_payload, so they sit inside the
 * execution_hash preimage. No bare-year citation: every object carries `in_force_from`.
 *
 * PII: opaque references only. No account numbers, names, or customer identifiers.
 * Demo fixture ships SYNTHETIC data only (CONTRACT §1.3).
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute().
 *
 * Spec: CCP-CORE-BUILD-SPEC.md §1.5 (CCPCORE-PORTING-1, art-532).
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-532-client-porting-check';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'check_client_porting', mandate_type: 'attestation_mandate', gpu: false };

const CONSENT_STATUSES = ['consented', 'declined', 'pending', 'not_requested'];

/** §28 pinned citation objects (profile `ocg-clause-binding@1`, §1.2 required members). */
const CITE_MAPPED_BY = 'AINumbers CCP-CORE-K-1';
const CITE_MAPPED_AT = '2026-08-04';
const CITATIONS = {
  segregation_and_portability: {
    scheme: 'other', id: 'PFMI Principle 14', in_force_from: '2012-04-16',
    mapped_by: CITE_MAPPED_BY, mapped_at: CITE_MAPPED_AT,
    uri: 'https://www.bis.org/cpmi/publ/d101a.pdf',
  },
  customer_protection_segregation: {
    scheme: 'cfr', id: '17 CFR 240.15c3-3a', in_force_from: '1972-11-03',
    mapped_by: CITE_MAPPED_BY, mapped_at: CITE_MAPPED_AT,
    uri: 'https://www.ecfr.gov/current/title-17/chapter-II/part-240/subject-group-ECFR6c1b03927685662/section-240.15c3-3a',
  },
};

function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function isSafeIntAmount(v) { return typeof v === 'number' && Number.isFinite(v) && Number.isSafeInteger(v); }
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
/** Full ISO 8601 UTC datetime shape check. No bare date-only, since window arithmetic needs hours. */
function isoDateTimeMs(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?Z$/.test(v)) return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : null;
}
function positiveIntOrNull(v) {
  return typeof v === 'number' && Number.isFinite(v) && Number.isSafeInteger(v) && v > 0 ? v : null;
}

export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];

  const client_ref = isNonEmptyString(pp.client_ref) ? pp.client_ref.trim() : 'UNLABELLED-CLIENT';
  if (!isNonEmptyString(pp.client_ref)) rejected_inputs.push({ where: 'client_ref', reason: 'absent', supplied: null });

  const backup_member_id = isNonEmptyString(pp.backup_member_id) ? pp.backup_member_id.trim() : null;
  if (!backup_member_id) rejected_inputs.push({ where: 'backup_member_id', reason: 'absent', supplied: null });

  const backup_member_consent_status = CONSENT_STATUSES.indexOf(pp.backup_member_consent_status) !== -1
    ? pp.backup_member_consent_status : null;
  if (!backup_member_consent_status) {
    rejected_inputs.push({ where: 'backup_member_consent_status', reason: 'absent or not one of consented/declined/pending/not_requested', supplied: pp.backup_member_consent_status == null ? null : pp.backup_member_consent_status });
  }

  const default_event_at_ms = isoDateTimeMs(pp.default_event_at);
  if (default_event_at_ms === null) rejected_inputs.push({ where: 'default_event_at', reason: 'absent or not a full ISO-8601 UTC datetime', supplied: pp.default_event_at ?? null });
  const evaluated_at_ms = isoDateTimeMs(pp.evaluated_at);
  if (evaluated_at_ms === null) rejected_inputs.push({ where: 'evaluated_at', reason: 'absent or not a full ISO-8601 UTC datetime', supplied: pp.evaluated_at ?? null });

  const porting_window_hours = positiveIntOrNull(pp.porting_window_hours);
  if (porting_window_hours === null) rejected_inputs.push({ where: 'porting_window_hours', reason: 'absent or not a positive integer number of hours', supplied: pp.porting_window_hours ?? null });

  let elapsed_minutes = null;
  let window_minutes = null;
  let window_missed = false;
  if (default_event_at_ms !== null && evaluated_at_ms !== null && porting_window_hours !== null) {
    elapsed_minutes = Math.round((evaluated_at_ms - default_event_at_ms) / 60000);
    window_minutes = porting_window_hours * 60;
    window_missed = elapsed_minutes > window_minutes;
  }

  const positionsIn = Array.isArray(pp.positions) ? pp.positions : [];
  const positions = positionsIn.map((p, i) => {
    p = p && typeof p === 'object' ? p : {};
    const position_id = isNonEmptyString(p.position_id) ? p.position_id.trim() : `UNLABELLED-POS-${i + 1}`;
    const product_type = isNonEmptyString(p.product_type) ? p.product_type.trim() : 'unspecified';
    const currency = isNonEmptyString(p.currency) ? p.currency.trim().toUpperCase() : 'USD';
    const notional_minor_units = toMinorUnits(p.notional_minor_units, `positions[${i}].notional_minor_units`, rejected_inputs);
    let complete;
    if (p.complete === true) complete = true;
    else if (p.complete === false) complete = false;
    else { rejected_inputs.push({ where: `positions[${i}].complete`, reason: 'absent -- must be explicitly declared true or false, never assumed', supplied: null }); complete = false; }
    return { position_id, product_type, currency, notional_minor_units, notional_display: display(notional_minor_units), complete };
  });

  const collateralIn = Array.isArray(pp.collateral) ? pp.collateral : [];
  const collateral = collateralIn.map((c, i) => {
    c = c && typeof c === 'object' ? c : {};
    const collateral_id = isNonEmptyString(c.collateral_id) ? c.collateral_id.trim() : `UNLABELLED-COLL-${i + 1}`;
    const asset_type = isNonEmptyString(c.asset_type) ? c.asset_type.trim() : 'unspecified';
    const currency = isNonEmptyString(c.currency) ? c.currency.trim().toUpperCase() : 'USD';
    const amount_minor_units = toMinorUnits(c.amount_minor_units, `collateral[${i}].amount_minor_units`, rejected_inputs);
    let complete;
    if (c.complete === true) complete = true;
    else if (c.complete === false) complete = false;
    else { rejected_inputs.push({ where: `collateral[${i}].complete`, reason: 'absent -- must be explicitly declared true or false, never assumed', supplied: null }); complete = false; }
    return { collateral_id, asset_type, currency, amount_minor_units, amount_display: display(amount_minor_units), complete };
  });

  let total_notional_minor_units = 0;
  for (const p of positions) total_notional_minor_units += p.notional_minor_units;
  let total_collateral_minor_units = 0;
  for (const c of collateral) total_collateral_minor_units += c.amount_minor_units;

  const incomplete_positions = positions.filter((p) => !p.complete);
  const incomplete_collateral = collateral.filter((c) => !c.complete);
  const positions_complete = positions.length > 0 && incomplete_positions.length === 0;
  const collateral_complete = collateral.length === 0 || incomplete_collateral.length === 0;

  const compliance_flags = [];
  let verdict;

  if (positions.length === 0) {
    verdict = 'not_portable_no_positions_declared';
    compliance_flags.push('PORTING_NO_POSITIONS_DECLARED');
  } else if (window_missed) {
    verdict = 'not_portable_window_missed';
    compliance_flags.push('PORTING_WINDOW_MISSED');
  } else if (backup_member_consent_status !== 'consented') {
    verdict = 'not_portable_no_consent';
    if (backup_member_consent_status === 'declined') compliance_flags.push('PORTING_CONSENT_DECLINED');
    else if (backup_member_consent_status === 'pending') compliance_flags.push('PORTING_CONSENT_PENDING');
    else compliance_flags.push('PORTING_CONSENT_NOT_REQUESTED');
  } else if (!positions_complete) {
    verdict = 'not_portable_positions_incomplete';
    compliance_flags.push('PORTING_POSITIONS_INCOMPLETE');
  } else if (!collateral_complete) {
    verdict = 'not_portable_collateral_incomplete';
    compliance_flags.push('PORTING_COLLATERAL_INCOMPLETE');
  } else {
    verdict = 'portable';
    compliance_flags.push('PORTING_CLIENT_PORTABLE');
  }
  if (rejected_inputs.length > 0) compliance_flags.push('PORTING_INPUTS_REJECTED');

  const rationale = [];
  rationale.push(`Client reference ${client_ref}; backup clearing member ${backup_member_id || 'MISSING'}, consent status ${backup_member_consent_status || 'MISSING'} (${CITATIONS.segregation_and_portability.id}).`);
  if (positions.length === 0) {
    rationale.push('No positions were declared, so there is nothing to evaluate for porting. This is a defined outcome under the finite gate, not an error.');
  } else {
    rationale.push(`${positions.length} position(s) declared totalling ${display(total_notional_minor_units)} notional, ${incomplete_positions.length} not yet declared complete.`);
    rationale.push(`${collateral.length} collateral component(s) declared totalling ${display(total_collateral_minor_units)}, ${incomplete_collateral.length} not yet declared complete.`);
    if (elapsed_minutes !== null && window_minutes !== null) {
      rationale.push(`Elapsed time since the default event is ${elapsed_minutes} minute(s) against a declared porting window of ${window_minutes} minute(s) (${porting_window_hours} hour(s)).`);
    }
  }
  if (verdict === 'portable') {
    rationale.push(`On these figures the client's positions and collateral are complete, the backup member has consented, and the declared porting window has not elapsed (${CITATIONS.customer_protection_segregation.id} where a broker-dealer customer-protection structure is in view). This is an evaluation of the supplied snapshot, not a guarantee that porting will in fact occur.`);
  } else {
    rationale.push('On these figures the client is not portable as declared. This is an evaluation of the supplied snapshot, not a determination that any party has breached PFMI Principle 14 or SEC Rule 15c3-3a.');
  }
  if (rejected_inputs.length > 0) {
    rationale.push(`${rejected_inputs.length} supplied value${rejected_inputs.length === 1 ? ' was' : 's were'} not usable and ${rejected_inputs.length === 1 ? 'was' : 'were'} treated as absent or zero. Each one is named in rejected_inputs.`);
  }

  const output_payload = {
    client_ref,
    backup_member_id,
    backup_member_consent_status,
    default_event_at: pp.default_event_at ?? null,
    evaluated_at: pp.evaluated_at ?? null,
    porting_window_hours,
    elapsed_minutes,
    window_minutes,
    window_missed,
    position_count: positions.length,
    positions,
    total_notional_minor_units,
    total_notional_display: display(total_notional_minor_units),
    positions_complete,
    collateral_count: collateral.length,
    collateral,
    total_collateral_minor_units,
    total_collateral_display: display(total_collateral_minor_units),
    collateral_complete,
    verdict,
    citations: CITATIONS,
    rejected_inputs,
    rationale,
    note: 'Deterministic client-porting check over a caller-declared snapshot of positions, collateral, backup-member consent status, and porting window. Single-run and stateless: this tool holds no records, runs on no schedule, and retains nothing. The verdict evaluates the supplied snapshot; it is not a guarantee of a porting outcome and it does not itself move any position or collateral.',
  };

  return { output_payload, compliance_flags };
}

/** §1.4 pointers: every one roots at output_payload, so each cited object is inside the preimage. */
export const CLAUSE_BINDING_POINTERS = Object.keys(CITATIONS).map((k) => ({
  profile: 'ocg-clause-binding@1',
  pointer: `/output_payload/citations/${k}`,
}));

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null, execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    clause_bindings: CLAUSE_BINDING_POINTERS,
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
