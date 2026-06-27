import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-175-gpai-code-of-practice-conformance';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_gpai_code_conformance',
  mandate_type: 'compliance_mandate', gpu: false,
};

// GPAI provider obligation checker — EU AI Act Art. 53 (base obligations) +
// Art. 55 (systemic-risk additional obligations) + Code of Practice alignment.
// Returns base_score, systemic_score, overall_score (0–100), gap lists, and
// compliance_flags. Short-circuits with not_applicable when provider is not
// a GPAI provider. Zero network.
export function compute(pp) {
  const { provider = {} } = pp;

  const is_gpai_provider = provider.is_gpai_provider === true;

  // Short-circuit: obligations only apply to GPAI providers
  if (!is_gpai_provider) {
    return {
      output_payload: {
        not_applicable: true,
        reason: 'not_a_gpai_provider',
      },
      compliance_flags: {
        GPAI_ASSESSED: true,
        GPAI_NOT_APPLICABLE: true,
      },
    };
  }

  const is_systemic_risk = provider.is_systemic_risk === true;
  const code_of_practice_signed = provider.code_of_practice_signed === true;

  // Art. 53 base obligations
  const BASE_CHECKS = [
    'technical_documentation',
    'training_data_summary',
    'copyright_policy',
    'model_card_published',
  ];

  // Art. 55 systemic-risk additional obligations
  const SYSTEMIC_CHECKS = [
    'systemic_risk_eval_conducted',
    'adversarial_testing_done',
    'incident_reporting_active',
    'cybersecurity_measures',
  ];

  const base_results = BASE_CHECKS.map((k) => provider[k] === true);
  const base_passed = base_results.filter(Boolean).length;
  const base_gaps = BASE_CHECKS.filter((_, i) => !base_results[i]);
  const base_conformant = base_passed === BASE_CHECKS.length;
  const base_score = Number.isFinite(base_passed / BASE_CHECKS.length)
    ? Math.round((base_passed / BASE_CHECKS.length) * 100)
    : 0;

  let systemic_risk_conformant = null;
  let systemic_score = null;
  let systemic_gaps = [];

  if (is_systemic_risk) {
    const systemic_results = SYSTEMIC_CHECKS.map((k) => provider[k] === true);
    const systemic_passed = systemic_results.filter(Boolean).length;
    systemic_gaps = SYSTEMIC_CHECKS.filter((_, i) => !systemic_results[i]);
    systemic_risk_conformant = systemic_passed === SYSTEMIC_CHECKS.length;
    systemic_score = Number.isFinite(systemic_passed / SYSTEMIC_CHECKS.length)
      ? Math.round((systemic_passed / SYSTEMIC_CHECKS.length) * 100)
      : 0;
  }

  const overall_score = is_systemic_risk
    ? (Number.isFinite((base_score + systemic_score) / 2)
        ? Math.round((base_score + systemic_score) / 2)
        : 0)
    : base_score;

  const compliance_flags = {
    GPAI_ASSESSED: true,
    GPAI_BASE_SCORE: base_score,
  };

  if (base_conformant) {
    compliance_flags.GPAI_BASE_OBLIGATIONS_MET = true;
  } else {
    compliance_flags.GPAI_BASE_OBLIGATIONS_GAP = true;
  }

  if (is_systemic_risk && systemic_risk_conformant) {
    compliance_flags.GPAI_SYSTEMIC_RISK_OBLIGATIONS_MET = true;
  }
  if (is_systemic_risk && !systemic_risk_conformant) {
    compliance_flags.GPAI_SYSTEMIC_RISK_OBLIGATIONS_GAP = true;
  }

  if (code_of_practice_signed) {
    compliance_flags.GPAI_CODE_SIGNED = true;
  }

  return {
    output_payload: {
      is_gpai_provider,
      is_systemic_risk,
      base_conformant,
      base_score,
      systemic_risk_conformant,
      systemic_score,
      overall_score,
      code_of_practice_signed,
      base_gaps,
      systemic_gaps,
    },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
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
