import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-236-build-ai-decision-log-record';
const TOOL_VERSION = '1.0.1';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'build_ai_decision_log_record',
  mandate_type: 'compliance_mandate', gpu: false,
};

// ─── EU AI Act Art 12 Decision Log Record Builder ────────────────────────────
// Constructs a hash-chained JSON record satisfying EU AI Act Art 12(2) logging
// obligations for high-risk AI systems (Annex III 5(b) creditworthiness /
// 5(c) life-health insurance pricing). Aug 2026 enforcement (2 Aug 2026 original;
// 2 Dec 2027 under Digital Omnibus provisional agreement — verify current status).
//
// Chain integrity: each record includes a sha256_prev_record hash so logs form
// a tamper-evident linked list. RFC 8785 JCS + SHA-256 (via _hash.mjs).
// Anchoring: COMPOSE with anchor.ainumbers.co/mcp tools — use anchor_hash for
// single records, anchor_batch for high-volume agent log streams. This node
// DOES NOT rebuild anchoring; it emits anchor-composable output.
//
// Natural-person-ID is a STRUCTURAL field (record schema slot for a synthetic
// subject reference or case ID). This field MUST NOT contain a real identity,
// NPI, SSN, name, or any real personal identifier. Zero PII by construction.
// Use synthetic / pseudonymised IDs or opaque case references only.
//
// Disambiguation: build_ai_decision_log_record builds an EU AI Act Art 12
// decision-audit record with hash chaining + retention metadata. It is NOT
// build_session_receipt (which logs MCP agent session I/O in the agent-economy
// context, no Art 12 / Annex III framing). Different purpose, different schema.
//
// Regulatory basis:
//   EU AI Act (Reg. 2024/1689) Art 12(2), Art 26(6), Annex III 5(b)/(5)(c)
//   RFC 8785 (JSON Canonicalisation Scheme) — JCS is the hash-chaining primitive
//   Retention: Art 12(2) >= 6 months from operation; national supervisors may extend
//   table_version: "EU-AIA-ART12-2024-1689-R1"

function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }
function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : (def !== undefined ? def : 0); }
function safeBool(v) { return v === true || v === 'true' || v === 1; }

// Bounded string truncate — keeps hash inputs finite
function bounded(s, max) {
  const t = safeStr(s);
  return t.length <= max ? t : t.slice(0, max) + '[TRUNCATED]';
}

// Inline RFC 8785 JCS for primitive scalar objects (avoids TextEncoder)
// Only called on the bounded prev_hash_input object — always a flat string-key object.
function jcsSort(obj) {
  if (obj === null) return 'null';
  if (typeof obj === 'boolean') return String(obj);
  if (typeof obj === 'number') {
    if (!Number.isFinite(obj)) throw new Error('Non-finite number in JCS input');
    return String(obj);
  }
  if (typeof obj === 'string') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(jcsSort).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + jcsSort(obj[k])).join(',') + '}';
}

export function compute(pp) {
  pp = pp || {};

  // ── Inputs ────────────────────────────────────────────────────────────────
  const model_id       = bounded(pp.model_id || 'unknown-model', 128);
  const model_version  = bounded(pp.model_version || '0.0.0', 64);
  const input_digest   = bounded(pp.input_digest || '', 128);   // hex SHA-256 of the model input (caller supplies)
  const output_digest  = bounded(pp.output_digest || '', 128);  // hex SHA-256 of the model output
  const decision_label = bounded(pp.decision_label || '', 128); // e.g. "CREDIT_APPROVED", "PREMIUM_TIER_2"
  const confidence     = safeNum(pp.confidence, 0);             // 0.0–1.0 float
  const confidence_c   = Math.max(0, Math.min(1, confidence));
  const override_flag  = safeBool(pp.override_flag);
  const override_by    = override_flag ? bounded(pp.override_by || 'human-reviewer', 128) : null;
  const subject_ref    = bounded(pp.subject_ref || '', 128);    // STRUCTURAL: synthetic / opaque case ID only
  const system_context = bounded(pp.system_context || '', 256);
  const sha256_prev_record = bounded(pp.sha256_prev_record || '', 128); // '' for first record in chain
  const retention_months   = Math.max(6, Math.round(safeNum(pp.retention_months, 6)));
  const operator_id    = bounded(pp.operator_id || '', 128);

  // Empty-input guard: returns finite sentinel record
  if (!model_id || model_id === 'unknown-model') {
    return {
      output_payload: {
        record_status: 'EMPTY_INPUT',
        model_id: 'unknown-model',
        model_version: '0.0.0',
        input_digest: '',
        output_digest: '',
        decision_label: '',
        confidence: 0,
        override_flag: false,
        override_by: null,
        subject_ref: '',
        system_context: '',
        sha256_prev_record: '',
        chain_position: sha256_prev_record ? 'chained' : 'first',
        retention_months: 6,
        operator_id: '',
        art12_fields_present: false,
        art12_completeness_score: 0,
        anchor_surface: 'anchor.ainumbers.co/mcp',
        anchor_tools: { single: 'anchor_hash', batch: 'anchor_batch' },
        pii_note: 'subject_ref is a STRUCTURAL field for synthetic/opaque case IDs only. No real personal identifiers.',
        regulatory_basis: 'EU AI Act (Reg. 2024/1689) Art 12(2), Annex III 5(b)/(5)(c)',
        table_version: 'EU-AIA-ART12-2024-1689-R1',
        enforcement_dates: {
          original: '2026-08-02',
          digital_omnibus_proposed: '2027-12-02',
          note: 'Digital Omnibus amendments (European Parliament final approval, 16 June 2026) confirm Annex III high-risk obligations move to 2 December 2027.'
        },
      },
      compliance_flags: ['EMPTY_INPUT'],
    };
  }

  // ── Art 12(2) completeness check ──────────────────────────────────────────
  // Required fields: model identifier, timestamp (caller provides via generated_at),
  // input summary (digest), output, override flag, subject ref, retention
  const art12_required = { model_id, input_digest, output_digest, decision_label };
  const missing_fields = Object.entries(art12_required)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  const art12_fields_present = missing_fields.length === 0;
  const art12_completeness_score = Math.round(
    (Object.keys(art12_required).length - missing_fields.length) / Object.keys(art12_required).length * 100
  );

  // ── Chain position ─────────────────────────────────────────────────────────
  const chain_position = sha256_prev_record ? 'chained' : 'first';

  const compliance_flags = [];
  if (!art12_fields_present) compliance_flags.push('ART12_FIELDS_INCOMPLETE');
  if (confidence_c < 0.5) compliance_flags.push('LOW_CONFIDENCE');
  if (override_flag) compliance_flags.push('HUMAN_OVERRIDE_RECORDED');
  if (missing_fields.includes('input_digest')) compliance_flags.push('MISSING_INPUT_DIGEST');
  if (missing_fields.includes('output_digest')) compliance_flags.push('MISSING_OUTPUT_DIGEST');

  const output_payload = {
    record_status: art12_fields_present ? 'COMPLETE' : 'INCOMPLETE',
    model_id,
    model_version,
    input_digest,
    output_digest,
    decision_label,
    confidence: Math.round(confidence_c * 1000) / 1000,
    override_flag,
    override_by,
    subject_ref,
    system_context,
    sha256_prev_record,
    chain_position,
    missing_art12_fields: missing_fields,
    art12_fields_present,
    art12_completeness_score,
    retention_months,
    operator_id,
    anchor_surface: 'anchor.ainumbers.co/mcp',
    anchor_tools: {
      single: 'anchor_hash',
      batch: 'anchor_batch',
      note: 'Use anchor_hash for individual records; anchor_batch for high-volume agent log streams (Merkle tree over N leaf hashes).'
    },
    pii_note: 'subject_ref is a STRUCTURAL field for synthetic/opaque case IDs only. MUST NOT contain real personal identifiers (names, SSN, NPI, or similar). Zero PII by construction.',
    regulatory_basis: 'EU AI Act (Reg. 2024/1689) Art 12(2), Art 26(6), Annex III 5(b) creditworthiness / 5(c) life-health insurance pricing',
    table_version: 'EU-AIA-ART12-2024-1689-R1',
    enforcement_dates: {
      original: '2026-08-02',
      digital_omnibus_proposed: '2027-12-02',
      note: 'Digital Omnibus amendments (European Parliament final approval, 16 June 2026) confirm Annex III high-risk obligations move to 2 December 2027.',
    },
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
