import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-452-build-ai-training-data-lineage-record';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'build_ai_training_data_lineage_record',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Composes a hash-chained ML training-data lineage record: dataset identity,
// upstream source dataset references, collection/governance method, and an
// OPTIONAL reference to an existing OCG receipt for the training-run compute
// (tool identity + execution hash + kernel digest, never re-embedded --
// same referenced-not-re-embedded pattern as art-380's workpaper record).
// Chain integrity via sha256_prev_lineage_hash, same linked-list convention
// as art-236's decision-log chain.
//
// Regulatory hook: EU AI Act (Reg. 2024/1689) Art 10 (data and data
// governance) + Annex IV 2(d) (technical documentation: data provenance,
// collection, labelling, cleaning); SR 11-7 model risk management data
// lineage / model inventory practice (US domestic analog, no EU-only claim).
// This kernel documents dataset lineage; it does NOT validate dataset
// quality, bias, or representativeness -- those remain firm judgment calls
// outside a deterministic kernel's boundary.
//
// Zero PII by construction: dataset_id / source_dataset_ids are STRUCTURAL
// identifiers (catalog keys, not raw data). This kernel never ingests or
// echoes dataset contents.
//
// Disambiguation: build_ai_training_data_lineage_record chains DATASET
// provenance (what data, from where, how governed) for model training. It
// is NOT build_ai_decision_log_record (art-236, which chains per-INFERENCE
// decision records) and NOT build_ai_workpaper_record (art-380, which
// composes an AUDIT workpaper over an existing receipt). All three may
// reference the same underlying receipt hash without re-embedding it.

const HEX64 = /^[0-9a-f]{64}$/;
const SHA256_PREFIXED = /^sha256:[0-9a-f]{64}$/;
const VALID_COLLECTION_METHODS = [
  'internal_transaction_records', 'third_party_licensed', 'public_dataset',
  'synthetic_generated', 'human_labeled', 'model_generated',
];

function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }

function bounded(s, max) {
  const t = safeStr(s);
  return t.length <= max ? t : t.slice(0, max) + '[TRUNCATED]';
}

// Bounded array of bounded strings -- keeps hash input finite (max 32 entries)
function boundedList(v, maxItems, maxLen) {
  if (!Array.isArray(v)) return [];
  return v.slice(0, maxItems).map((s) => bounded(s, maxLen)).filter((s) => s.length > 0);
}

export function compute(pp) {
  pp = pp || {};
  const checks = [];

  const dataset_id = bounded(pp.dataset_id, 128);
  const dataset_version = bounded(pp.dataset_version, 64);
  const source_dataset_ids = boundedList(pp.source_dataset_ids, 32, 128);
  const collection_method = safeStr(pp.collection_method);
  const governance_notes = bounded(pp.governance_notes, 512);
  const referenced_receipt_tool_id = bounded(pp.referenced_receipt_tool_id, 128);
  const referenced_receipt_tool_version = bounded(pp.referenced_receipt_tool_version, 64);
  const referenced_receipt_execution_hash = safeStr(pp.referenced_receipt_execution_hash).toLowerCase();
  const referenced_receipt_kernel_digest = safeStr(pp.referenced_receipt_kernel_digest).toLowerCase();
  const sha256_prev_lineage_hash = safeStr(pp.sha256_prev_lineage_hash).toLowerCase();
  const retention_months = Math.max(6, Math.round(Number(pp.retention_months) || 6));
  const operator_id = bounded(pp.operator_id, 128);

  const datasetIdPresent = dataset_id.length > 0;
  checks.push({ check: 'dataset_id_present', pass: datasetIdPresent,
    detail: datasetIdPresent ? dataset_id : 'dataset_id is required' });

  const datasetVersionPresent = dataset_version.length > 0;
  checks.push({ check: 'dataset_version_present', pass: datasetVersionPresent,
    detail: datasetVersionPresent ? dataset_version : 'dataset_version is required' });

  const collectionMethodValid = VALID_COLLECTION_METHODS.includes(collection_method);
  checks.push({ check: 'collection_method_valid', pass: collectionMethodValid,
    detail: collectionMethodValid ? collection_method : 'collection_method must be one of: ' + VALID_COLLECTION_METHODS.join(', ') });

  // Referenced-receipt fields are jointly optional: either all present and
  // valid, or all absent (never partial).
  const receiptFieldsGiven = [referenced_receipt_tool_id, referenced_receipt_execution_hash, referenced_receipt_kernel_digest].filter((v) => v.length > 0).length;
  const receiptFieldsNone = receiptFieldsGiven === 0;
  const receiptFieldsAll = receiptFieldsGiven === 3 && referenced_receipt_tool_version.length > 0;
  const execHashValid = referenced_receipt_execution_hash === '' || HEX64.test(referenced_receipt_execution_hash);
  const kernelDigestValid = referenced_receipt_kernel_digest === '' || SHA256_PREFIXED.test(referenced_receipt_kernel_digest);
  const receiptRefValid = receiptFieldsNone || (receiptFieldsAll && execHashValid && kernelDigestValid);
  checks.push({ check: 'referenced_receipt_valid_if_present', pass: receiptRefValid,
    detail: receiptRefValid ? (receiptFieldsAll ? 'ok' : 'not referenced') : 'referenced_receipt_tool_id, _tool_version, a valid 64-char hex execution_hash, and a valid sha256:-prefixed kernel_digest must ALL be present together or ALL be absent' });

  const prevHashOk = sha256_prev_lineage_hash === '' || HEX64.test(sha256_prev_lineage_hash);
  checks.push({ check: 'prev_lineage_hash_valid_if_present', pass: prevHashOk,
    detail: prevHashOk ? 'ok' : 'sha256_prev_lineage_hash, if provided, must be a 64-char lowercase hex SHA-256' });

  const allValid = checks.every((c) => c.pass);
  const chain_position = sha256_prev_lineage_hash ? 'chained' : 'first';

  const output_payload = {
    record_status: allValid ? 'COMPLETE' : 'INCOMPLETE',
    dataset_id: allValid ? dataset_id : null,
    dataset_version: allValid ? dataset_version : null,
    source_dataset_ids: allValid ? source_dataset_ids : null,
    collection_method: allValid ? collection_method : null,
    governance_notes: allValid ? (governance_notes || null) : null,
    referenced_receipt: allValid && receiptFieldsAll ? {
      tool_id: referenced_receipt_tool_id,
      tool_version: referenced_receipt_tool_version,
      execution_hash: referenced_receipt_execution_hash,
      kernel_digest: referenced_receipt_kernel_digest,
    } : null,
    sha256_prev_lineage_hash: allValid && sha256_prev_lineage_hash ? sha256_prev_lineage_hash : null,
    chain_position: allValid ? chain_position : null,
    retention_months: allValid ? retention_months : null,
    operator_id: allValid ? (operator_id || null) : null,
    checks,
    zero_pii_notice: 'dataset_id and source_dataset_ids are STRUCTURAL catalog identifiers only. This kernel never ingests, stores, or echoes dataset contents -- zero PII by construction.',
    scope_note: 'Documents dataset lineage and governance metadata for a training run. Does NOT validate dataset quality, bias, or representativeness -- those remain a firm judgment call outside this kernel\'s deterministic boundary.',
    regulatory_basis: 'EU AI Act (Reg. 2024/1689) Art 10 (data and data governance), Annex IV 2(d) (technical documentation: data provenance, collection, labelling, cleaning); SR 11-7 model risk management data-lineage practice (US domestic analog)',
    table_version: 'EU-AIA-ART10-2024-1689-R1',
  };

  const compliance_flags = ['ML_LINEAGE_RECORD_BOUND', 'ZERO_PII'];
  if (!allValid) compliance_flags.push('LINEAGE_INPUTS_INVALID');
  if (sha256_prev_lineage_hash) compliance_flags.push('LINEAGE_CHAIN_REFERENCED');
  if (receiptFieldsAll) compliance_flags.push('TRAINING_RECEIPT_REFERENCED');

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
