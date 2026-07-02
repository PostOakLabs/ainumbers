import { executionHash, cgCanon } from './_hash.mjs';

const TOOL_ID = 'art-191-conversion-receipt-builder';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'build_conversion_receipt',
  mandate_type: 'cryptographic_mandate', gpu: false,
};

// Binds one file-conversion event into a canonical receipt: input digest ->
// converter identity -> parameters -> output digest. binding_sha256 is SHA-256
// over the JCS-canonical form of the receipt with binding_sha256 removed. This
// binds a TRANSFORMATION EDGE between two digests, which is distinct from
// anchor_document_integrity (art-121, existence + timestamp of ONE document) and
// from verify_merkle_batch (cry-04, Merkle proofs). Any external converter,
// including the heavy WASM Conversion Lab tools, can feed it digests. It is also
// the documented hand-off point for BrowserChain anchoring. Zero network, zero PII.

const HEX64 = /^[0-9a-f]{64}$/;
const PII_KEYS = ['name', 'email', 'address', 'phone', 'ssn', 'dob'];

// Names only, never paths: strip everything up to the last / or \.
function basename(v) {
  const s = String(v || '');
  const cut = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
  return cut >= 0 ? s.slice(cut + 1) : s;
}

async function sha256Hex(str) {
  const bytes = new TextEncoder().encode(String(str));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function compute(pp) {
  const input_sha256 = String(pp?.input_sha256 || '').trim().toLowerCase();
  const output_sha256 = String(pp?.output_sha256 || '').trim().toLowerCase();
  const source_format = typeof pp?.source_format === 'string' ? pp.source_format : '';
  const target_format = typeof pp?.target_format === 'string' ? pp.target_format : '';
  const converterIn = (pp && typeof pp.converter === 'object' && pp.converter) ? pp.converter : {};
  const parameters = (pp && typeof pp.parameters === 'object' && pp.parameters && !Array.isArray(pp.parameters))
    ? pp.parameters : {};

  const converter = { name: String(converterIn.name || ''), version: String(converterIn.version || '') };
  if (typeof converterIn.engine_sha256 === 'string' && HEX64.test(converterIn.engine_sha256.toLowerCase())) {
    converter.engine_sha256 = converterIn.engine_sha256.toLowerCase();
  }
  if (typeof converterIn.url === 'string' && converterIn.url) converter.url = converterIn.url;

  const checks = [];
  const push = (check, pass, detail) => checks.push({ check, pass, detail });

  push('input_sha256_is_64_hex', HEX64.test(input_sha256),
    HEX64.test(input_sha256) ? 'valid' : 'input_sha256 is not a 64-character lowercase hex digest');
  push('output_sha256_is_64_hex', HEX64.test(output_sha256),
    HEX64.test(output_sha256) ? 'valid' : 'output_sha256 is not a 64-character lowercase hex digest');

  const identityComplete = converter.name !== '' && converter.version !== '';
  push('converter_identity_complete', identityComplete,
    identityComplete ? 'name and version present' : 'converter name and/or version missing');

  const selfConversion = HEX64.test(input_sha256) && input_sha256 === output_sha256;
  push('not_self_conversion', !selfConversion,
    selfConversion ? 'input and output digests are identical (self-conversion)' : 'input and output digests differ');

  // PII-carrier keys at the top level of parameters -> warning, never silent.
  const piiHits = Object.keys(parameters).filter((k) => PII_KEYS.includes(k.toLowerCase()));
  push('parameters_free_of_pii_keys', piiHits.length === 0,
    piiHits.length ? `parameter key(s) look like PII carriers: ${piiHits.join(', ')}` : 'no PII-carrier keys detected');

  const input = { sha256: input_sha256, format: source_format };
  if (pp?.input_filename) input.filename = basename(pp.input_filename);
  const output = { sha256: output_sha256, format: target_format };
  if (pp?.output_filename) output.filename = basename(pp.output_filename);

  const receiptCore = {
    receipt_version: '1.0',
    input, output, converter, parameters,
  };
  // binding_sha256 = SHA-256 over the JCS-canonical form of the receipt minus itself.
  const binding_sha256 = await sha256Hex(JSON.stringify(cgCanon(receiptCore)));
  const receipt = { ...receiptCore, binding_sha256 };

  const all_checks_pass = checks.every((c) => c.pass);
  const compliance_flags = { CONVERSION_RECEIPT_BUILT: true };
  compliance_flags[all_checks_pass ? 'RECEIPT_CHECKS_PASS' : 'RECEIPT_CHECKS_HAVE_WARNINGS'] = true;
  if (selfConversion) compliance_flags.SELF_CONVERSION_FLAGGED = true;
  if (piiHits.length) compliance_flags.PII_CARRIER_KEYS_FLAGGED = true;

  return {
    output_payload: { receipt, checks, all_checks_pass },
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
