/**
 * art-39-tempo-zone-disclosure.kernel.mjs
 * Tempo Zone Disclosure — privacy-layer and AML attestation validator.
 * Pure decision kernel — no DOM, no window, no Date.now().
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-39-tempo-zone-disclosure';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'validate_tempo_zone_disclosure',
  mandate_type: 'attestation_mandate',
  gpu:          false,
};

export function compute(pp) {
  const opSeesAll    = !!pp.opSeesAll;
  const userSeesOwn  = !!pp.userSeesOwn;
  const outsidersZK  = !!pp.outsidersZK;
  const tip403Allow  = !!pp.tip403Allow;
  const tip403Block  = !!pp.tip403Block;
  const tip403Freeze = !!pp.tip403Freeze;
  const tip403Mainnet = !!pp.tip403Mainnet;
  const amlTravel    = !!pp.amlTravel;
  const amlSAR       = !!pp.amlSAR;
  const amlOFAC      = !!pp.amlOFAC;
  const amlAudit     = !!pp.amlAudit;
  const operatorName = pp.operatorName ?? '';
  const useCase      = pp.useCase      ?? 'other';

  const checks = {
    AML_COVERAGE_MAINTAINED:      opSeesAll && (amlOFAC || amlSAR),
    TIP403_CROSS_ZONE:            tip403Allow && tip403Block && tip403Freeze && tip403Mainnet,
    TRAVEL_RULE_COMPLIANT:        !!amlTravel,
    REGULATOR_AUDIT_CAPABLE:      !!amlAudit,
    SELECTIVE_DISCLOSURE_CONFIRMED: userSeesOwn && outsidersZK,
    COMPETITIVE_CONFIDENTIALITY:  !!outsidersZK,
    OPERATOR_SEES_ALL:            !!opSeesAll,
    TIP403_ALLOWLIST:             !!tip403Allow,
    TIP403_BLOCKLIST:             !!tip403Block,
    TIP403_FREEZE:                !!tip403Freeze,
  };

  const hasFail = !checks.AML_COVERAGE_MAINTAINED || !checks.OPERATOR_SEES_ALL;
  const hasWarn = !checks.TRAVEL_RULE_COMPLIANT;

  const verdict = hasFail ? 'INSUFFICIENT'
    : hasWarn ? 'PARTIAL_ATTESTATION'
    : 'FULL_ATTESTATION';

  const compliance_flags = [];
  const output_payload = {
    verdict,
    operator_name: operatorName,
    use_case:      useCase,
    checks,
  };
  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    ap2_version: '1.0.0',
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
