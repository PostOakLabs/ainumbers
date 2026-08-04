import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-551-mt101-coexistence-readiness-diff';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_mt101_coexistence_readiness',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Swift CBPR+ MT101 coexistence-end readiness diff. Coexistence between MT101
// (FIN) and pain.001v9 (ISO 20022 MX) for FI-to-FI bulk/multiple payment
// initiation ends 2026-11-14 -- after that date only pain.001v9 is accepted.
// Caller declares the message format currently in production and a structural
// self-declared readiness checklist; the kernel deterministically recomputes
// `ready` and `days_to_deadline` from a fixed deadline constant and a
// caller-supplied `as_of_date` -- never wall-clock Date.now() inside compute().
//
// Distinct from art-548 (548-fedwire-remediation-diff-receipt): that node
// diffs structured-address remediation on Fedwire/CHIPS (deadline
// 2026-11-16, address-field structuring). This node checks MT101 message-type
// retirement readiness (deadline 2026-11-14). Different sub-mandate, one day
// apart -- keep both labeled distinctly wherever either is cited.
// XBORDER-PAYMENTS-BUILD-SPEC.md §4.

const MT101_COEXISTENCE_DEADLINE = '2026-11-14';
const TABLE_VERSION = 'SWIFT-CBPR-MT101-COEXISTENCE-2026-V1';
const TABLE_SOURCE = 'Swift CBPR+ MT101 to pain.001 migration guidance -- FI-to-FI bulk/multiple payment initiation coexistence window closes 2026-11-14, after which only ISO 20022 pain.001v9 is accepted for this message type (swift.com/standards/iso-20022/iso-20022-programme).';

function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }
function safeBool(v) { return v === true; }

function parseIsoDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + 'T00:00:00Z');
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(fromIso, toIso) {
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);
  if (!from || !to) return null;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

export function compute(pp) {
  pp = pp || {};

  const declaredFormatRaw = safeStr(pp.current_message_format).toUpperCase();
  const current_message_format = declaredFormatRaw === 'PAIN.001V9' ? 'PAIN.001V9'
    : declaredFormatRaw === 'MT101' ? 'MT101'
    : null;

  const as_of_date = parseIsoDate(pp.as_of_date) ? pp.as_of_date : null;

  const checklist = (pp.readiness_checklist && typeof pp.readiness_checklist === 'object') ? pp.readiness_checklist : {};
  const emits_pain001v9_bulk = safeBool(checklist.emits_pain001v9_bulk);
  const fallback_path_staged = safeBool(checklist.fallback_path_staged);
  const correspondent_confirmed_receipt = safeBool(checklist.correspondent_confirmed_receipt);

  const structural_issues = [];
  if (!current_message_format) structural_issues.push('CURRENT_MESSAGE_FORMAT_UNDECLARED');
  if (!as_of_date) structural_issues.push('AS_OF_DATE_UNDECLARED');

  const days_to_deadline = as_of_date ? daysBetween(as_of_date, MT101_COEXISTENCE_DEADLINE) : null;
  const past_deadline = days_to_deadline !== null ? days_to_deadline < 0 : null;

  // Ready = already emitting pain.001v9 for bulk FI-to-FI, OR (still on MT101 but a
  // fallback path is staged AND the correspondent has confirmed it can receive
  // pain.001v9) AND the deadline has not already passed.
  let ready = null;
  const readiness_gaps = [];
  if (current_message_format && as_of_date) {
    if (current_message_format === 'PAIN.001V9') {
      ready = !!emits_pain001v9_bulk;
      if (!emits_pain001v9_bulk) readiness_gaps.push('DECLARED_PAIN001V9_BUT_BULK_EMISSION_NOT_CONFIRMED');
    } else {
      // still MT101
      ready = fallback_path_staged && correspondent_confirmed_receipt;
      if (!fallback_path_staged) readiness_gaps.push('NO_FALLBACK_PATH_STAGED');
      if (!correspondent_confirmed_receipt) readiness_gaps.push('CORRESPONDENT_RECEIPT_NOT_CONFIRMED');
    }
    if (past_deadline === true && current_message_format === 'MT101') {
      ready = false;
      readiness_gaps.push('COEXISTENCE_WINDOW_ALREADY_CLOSED_STILL_ON_MT101');
    }
  }

  const compliance_flags = [];
  if (structural_issues.length) compliance_flags.push('MT101_READINESS_STRUCTURAL_INCOMPLETE');
  else if (ready) compliance_flags.push('MT101_COEXISTENCE_READY');
  else compliance_flags.push('MT101_COEXISTENCE_NOT_READY');
  if (past_deadline === true) compliance_flags.push('MT101_COEXISTENCE_DEADLINE_PASSED');

  const output_payload = {
    mt101_coexistence_deadline: MT101_COEXISTENCE_DEADLINE,
    current_message_format,
    as_of_date,
    days_to_deadline,
    past_deadline,
    ready,
    readiness_gaps,
    structural_issues,
    checklist: {
      emits_pain001v9_bulk,
      fallback_path_staged,
      correspondent_confirmed_receipt,
    },
    disambiguation: 'check_mt101_coexistence_readiness evaluates Swift CBPR+ MT101 message-type retirement readiness (deadline 2026-11-14) from a caller-declared current message format and a structural self-declared checklist. It is distinct from fedwire_remediation_diff_receipt (art-548), which diffs Fedwire/CHIPS structured-address remediation (deadline 2026-11-16) -- a different sub-mandate, one day apart.',
    pii_note: 'All fields are structural/operational declarations about a payment-system configuration. No party PII enters this kernel.',
    table_version: TABLE_VERSION,
    table_source: TABLE_SOURCE,
    regulatory_basis: 'Swift CBPR+ / ISO 20022 programme: FIN MT101 to pain.001v9 migration, FI-to-FI bulk/multiple payment initiation coexistence window closes 2026-11-14.',
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
