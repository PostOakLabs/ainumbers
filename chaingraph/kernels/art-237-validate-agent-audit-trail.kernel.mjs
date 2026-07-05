import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-237-validate-agent-audit-trail';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'validate_agent_audit_trail',
  mandate_type: 'compliance_mandate', gpu: false,
};

// ─── IETF Agent Audit Trail (AAT) Conformance Validator ──────────────────────
// Validates conformance of an agent audit record with:
//   IETF draft-sharif-agent-audit-trail-00 ("AAT")
//   SHA-256 chain integrity per RFC 8785 JCS (reuses vendored _hash.mjs primitives)
//   Optional ECDSA signature presence check (does NOT verify cryptographic signature —
//   verification requires the public key not available in zero-network browser context)
//
// ALIGNMENT NOTE: draft-sharif-agent-audit-trail-00 is an individual I-D submitted
// 2026; it expires Sept 2026. This node is "aligned with" the draft's data model,
// NOT "certified" — a draft is not a ratified standard. No conformance authority exists.
//
// Chain integrity test: given a record and its claimed sha256_prev_record, this node
// validates that the required fields are present and that the record structure matches
// the AAT field set (agent_identity, action_class, outcome, trust_level,
// sha256_prev_record). It does NOT independently recompute the previous record's hash
// (the previous record is not supplied); it checks the structural integrity of the
// current record only.
//
// Disambiguation: validate_agent_audit_trail validates AAT audit-trail records
// (action class, outcome, trust level, RFC 8785 JCS chain). It is NOT the Wave-24
// agent-identity nodes (art-129..134) which verify RFC 9421 HTTP message signatures
// and Web Bot Auth Signature Agent Cards — different protocol, different layer.
//
// Regulatory basis:
//   IETF draft-sharif-agent-audit-trail-00 (alignment target; expires Sept 2026)
//   RFC 8785 (JSON Canonicalisation Scheme — JCS)
//   EU AI Act (Reg. 2024/1689) Art 12 (log chaining compatibility)
//   table_version: "AAT-DRAFT-SHARIF-00-2026"

function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }
function bounded(s, max) { const t = safeStr(s); return t.length <= max ? t : t.slice(0, max) + '[TRUNCATED]'; }

const VALID_ACTION_CLASSES = [
  'READ', 'WRITE', 'EXECUTE', 'QUERY', 'TRANSFORM',
  'AUTHORIZE', 'AUTHENTICATE', 'NOTIFY', 'ROUTE', 'OTHER',
];
const VALID_OUTCOMES = ['SUCCESS', 'FAILURE', 'PARTIAL', 'PENDING', 'CANCELLED'];
const VALID_TRUST_LEVELS = ['UNTRUSTED', 'BASIC', 'ELEVATED', 'HIGH', 'VERIFIED'];

export function compute(pp) {
  pp = pp || {};

  const agent_identity  = bounded(pp.agent_identity || '', 256);
  const action_class    = safeStr(pp.action_class || '').toUpperCase();
  const outcome         = safeStr(pp.outcome || '').toUpperCase();
  const trust_level     = safeStr(pp.trust_level || '').toUpperCase();
  const sha256_prev_record = bounded(pp.sha256_prev_record || '', 128);
  const ecdsa_present   = pp.ecdsa_present === true || pp.ecdsa_present === 'true';
  const action_detail   = bounded(pp.action_detail || '', 512);
  const record_id       = bounded(pp.record_id || '', 128);

  // Empty-input guard
  if (!agent_identity) {
    return {
      output_payload: {
        conformance_result: 'EMPTY_INPUT',
        agent_identity: '',
        action_class: '',
        outcome: '',
        trust_level: '',
        sha256_prev_record: '',
        chain_position: 'unknown',
        ecdsa_present: false,
        aat_required_fields_present: false,
        aat_completeness_score: 0,
        validation_errors: ['agent_identity is required'],
        alignment_note: 'Aligned with IETF draft-sharif-agent-audit-trail-00 (expires Sept 2026). Not a certified standard conformance check.',
        regulatory_basis: 'IETF draft-sharif-agent-audit-trail-00; RFC 8785 JCS; EU AI Act Art 12',
        table_version: 'AAT-DRAFT-SHARIF-00-2026',
      },
      compliance_flags: ['EMPTY_INPUT'],
    };
  }

  const errors = [];
  const warnings = [];

  // ── Required field checks ──────────────────────────────────────────────────
  if (!agent_identity) errors.push('agent_identity missing');
  if (!action_class) errors.push('action_class missing');
  else if (!VALID_ACTION_CLASSES.includes(action_class)) errors.push('action_class invalid: ' + action_class);
  if (!outcome) errors.push('outcome missing');
  else if (!VALID_OUTCOMES.includes(outcome)) errors.push('outcome invalid: ' + outcome);
  if (!trust_level) errors.push('trust_level missing');
  else if (!VALID_TRUST_LEVELS.includes(trust_level)) warnings.push('trust_level unrecognised: ' + trust_level);

  // ── SHA-256 prev record format check ──────────────────────────────────────
  // A valid sha256 hex is 64 lowercase hex chars; empty = first record in chain
  const sha256_prev_valid =
    !sha256_prev_record || // empty = first record = valid
    /^[0-9a-f]{64}$/.test(sha256_prev_record);
  if (!sha256_prev_valid) errors.push('sha256_prev_record is not a valid SHA-256 hex string (64 lowercase hex chars or empty)');

  const chain_position = sha256_prev_record ? 'chained' : 'first';

  // ── ECDSA presence ────────────────────────────────────────────────────────
  if (!ecdsa_present) warnings.push('ecdsa_signature absent — AAT recommends optional ECDSA signature');

  // ── Completeness score ────────────────────────────────────────────────────
  const required = { agent_identity, action_class, outcome, trust_level };
  const present = Object.values(required).filter(v => !!v).length;
  const aat_completeness_score = Math.round(present / Object.keys(required).length * 100);
  const aat_required_fields_present = errors.length === 0;

  const conformance_result = errors.length === 0 ? 'CONFORMANT' :
    aat_completeness_score >= 75 ? 'PARTIAL' : 'NON_CONFORMANT';

  const compliance_flags = [];
  if (errors.length > 0) compliance_flags.push('AAT_VALIDATION_ERRORS');
  if (warnings.length > 0) compliance_flags.push('AAT_VALIDATION_WARNINGS');
  if (!ecdsa_present) compliance_flags.push('ECDSA_ABSENT');
  if (!sha256_prev_record) compliance_flags.push('CHAIN_FIRST_RECORD');

  const output_payload = {
    conformance_result,
    agent_identity,
    action_class,
    outcome,
    trust_level,
    sha256_prev_record,
    chain_position,
    sha256_chain_format_valid: sha256_prev_valid,
    ecdsa_present,
    aat_required_fields_present,
    aat_completeness_score,
    validation_errors: errors,
    validation_warnings: warnings,
    action_detail: action_detail || null,
    record_id: record_id || null,
    alignment_note: 'Aligned with IETF draft-sharif-agent-audit-trail-00 (I-D expires Sept 2026). Not a certified standard conformance check — no conformance authority exists for this draft.',
    regulatory_basis: 'IETF draft-sharif-agent-audit-trail-00; RFC 8785 (JSON Canonicalisation Scheme); EU AI Act (Reg. 2024/1689) Art 12(2)',
    table_version: 'AAT-DRAFT-SHARIF-00-2026',
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
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
