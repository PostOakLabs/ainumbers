import { executionHash, cgCanon } from './_hash.mjs';

const TOOL_ID = 'art-193-metadata-sanitization-prover';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'prove_metadata_sanitization',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Produces a proof-of-sanitization record binding original digest -> findings
// removed/redacted/retained -> sanitized digest, with a deterministic residual-risk
// analysis. The kernel receives field NAMES and CATEGORIES only, never metadata
// VALUES (which can themselves be PII: GPS coordinates, author names). The page
// shows values locally but exports only names/categories. Zero network, zero PII.

const HEX64 = /^[0-9a-f]{64}$/;
const CATEGORIES = ['gps', 'author', 'device', 'timestamp', 'software', 'comment', 'other'];
const ACTIONS = ['removed', 'redacted', 'retained'];
const FILE_TYPES = ['jpeg', 'png', 'pdf', 'docx', 'generic'];

const finiteOrNull = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

async function sha256Hex(str) {
  const bytes = new TextEncoder().encode(String(str));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function compute(pp) {
  const original_sha256 = String(pp?.original_sha256 || '').trim().toLowerCase();
  const sanitized_sha256 = String(pp?.sanitized_sha256 || '').trim().toLowerCase();
  const file_type = FILE_TYPES.includes(pp?.file_type) ? pp.file_type : 'generic';
  const findingsIn = Array.isArray(pp?.findings) ? pp.findings : [];

  const findings = findingsIn.map((f) => ({
    field: String(f?.field || ''),
    category: CATEGORIES.includes(f?.category) ? f.category : 'other',
    action: ACTIONS.includes(f?.action) ? f.action : 'retained',
  }));

  const bytes_before = finiteOrNull(pp?.bytes_before);
  const bytes_after = finiteOrNull(pp?.bytes_after);

  const retained = findings.filter((f) => f.action === 'retained');
  const removed = findings.filter((f) => f.action === 'removed');
  const redacted = findings.filter((f) => f.action === 'redacted');

  const residual_risks = [];
  for (const f of retained) {
    residual_risks.push(`retained ${f.category} metadata field "${f.field}" was not removed`);
  }
  if (file_type === 'jpeg' && !findings.some((f) => f.category === 'comment')) {
    residual_risks.push('JPEG COM (comment) segments were not enumerated; confirm none remain');
  }
  if (file_type === 'png') {
    residual_risks.push('PNG iTXt/tEXt/zTXt textual chunks may carry residual metadata; confirm all were walked');
  }
  if (file_type === 'pdf' || file_type === 'docx') {
    residual_risks.push('XMP packets and embedded-object metadata are not fully enumerable client-side for this file type');
  }
  const digestsValid = HEX64.test(original_sha256) && HEX64.test(sanitized_sha256);
  if (digestsValid && original_sha256 === sanitized_sha256 && findings.length > 0) {
    residual_risks.push('original and sanitized digests are identical: no bytes changed despite recorded findings');
  }

  let verdict;
  if (file_type === 'pdf' || file_type === 'docx') verdict = 'not_verifiable';
  else if (retained.length > 0) verdict = 'partially_sanitized';
  else verdict = 'sanitized';

  const recordCore = {
    record_version: '1.0',
    file_type,
    original_sha256,
    sanitized_sha256,
    findings,
    counts: {
      total: findings.length,
      removed: removed.length,
      redacted: redacted.length,
      retained: retained.length,
    },
    bytes_before,
    bytes_after,
    verdict,
  };
  const record_sha256 = await sha256Hex(JSON.stringify(cgCanon(recordCore)));
  const sanitization_record = { ...recordCore, record_sha256 };

  const compliance_flags = { METADATA_SANITIZATION_ASSESSED: true };
  compliance_flags['SANITIZATION_' + verdict.toUpperCase()] = true;
  if (retained.length > 0) compliance_flags.RETAINED_METADATA_PRESENT = true;
  if (!digestsValid) compliance_flags.DIGESTS_INCOMPLETE = true;

  return {
    output_payload: { sanitization_record, residual_risks, verdict },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = await compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
