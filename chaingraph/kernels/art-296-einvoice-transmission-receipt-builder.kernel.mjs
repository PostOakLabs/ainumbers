import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-296-einvoice-transmission-receipt-builder';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'build_einvoice_transmission_receipt',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Honesty guard (binding, §E2 doctrine): this receipt asserts "this document
// conforms to version-pinned format rules and its VAT arithmetic is internally
// consistent" -- NEVER that the invoice is legally valid, accepted by a tax
// authority, or VAT-correct for the underlying supply.
export function compute(pp) {
  const document = (pp && typeof pp.document === 'object' && pp.document) || {};
  const format_validation = (pp && typeof pp.format_validation === 'object' && pp.format_validation) || null;
  const vat_verification = (pp && typeof pp.vat_verification === 'object' && pp.vat_verification) || null;
  const routed_mandate = (pp && typeof pp.routed_mandate === 'object' && pp.routed_mandate) || null;

  const document_sha256 = typeof document.document_sha256 === 'string' ? document.document_sha256 : null;
  const embedded_xml_sha256 = typeof document.embedded_xml_sha256 === 'string' ? document.embedded_xml_sha256 : null;
  const format = typeof document.format === 'string' ? document.format : null;

  const parsed_ok = !!document_sha256 && !!format;
  const format_gate_passed = !!(format_validation && format_validation.structural_completeness === true);
  const vat_gate_passed = !!(vat_verification && vat_verification.consistent === true);
  const validated = parsed_ok && format_gate_passed && vat_gate_passed;

  const claim_strength = validated ? 'format_and_arithmetic_verified' : 'unverified';

  const steps = [
    { tool_id: 'art-293-einvoice-format-validator', mcp_name: 'validate_einvoice_format', gate_passed: format_gate_passed },
    { tool_id: 'art-294-einvoice-vat-calc-verifier', mcp_name: 'verify_einvoice_vat_calc', gate_passed: vat_gate_passed },
    { tool_id: 'art-295-einvoice-jurisdiction-mandate-router', mcp_name: 'route_einvoice_jurisdiction_mandate', gate_passed: true },
  ];

  const compliance_flags = ['EINVOICE_RECEIPT_ASSESSED', validated ? 'EINVOICE_RECEIPT_VALIDATED' : 'EINVOICE_RECEIPT_UNVERIFIED'];

  return {
    output_payload: {
      document_sha256, embedded_xml_sha256, format,
      validated, claim_strength, format_gate_passed, vat_gate_passed,
      routed_mandate: routed_mandate || null, steps,
      not_legal_advice: 'Proves the transmitted document was format-validated and VAT-arithmetic-checked. Does not certify tax compliance, legal validity, or clearance-platform acceptance.',
    },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.4/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
