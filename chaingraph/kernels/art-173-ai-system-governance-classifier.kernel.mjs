import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-173-ai-system-governance-classifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'classify_ai_system_governance',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Classifies an AI system to its governance tier across three frameworks:
// EU AI Act (prohibited/high_risk/limited_risk/minimal_risk), NIST RMF profile
// (T3_enhanced/T2_standard/T1_basic), and ISO 42001 control set
// (enhanced/standard/light). Also resolves GPAI obligations. Zero network.
export function compute(pp) {
  const { system = {} } = pp;

  const use_case = typeof system.use_case === 'string' ? system.use_case : null;
  const deployment_context = typeof system.deployment_context === 'string' ? system.deployment_context : null;
  const is_gpai = system.is_gpai === true;
  const has_systemic_risk = system.has_systemic_risk === true;
  const is_autonomous = system.is_autonomous === true;
  const processes_biometrics = system.processes_biometrics === true;
  const affects_critical_infrastructure = system.affects_critical_infrastructure === true;
  const is_emotion_recognition = system.is_emotion_recognition === true;

  // EU AI Act tier classification
  const HIGH_RISK_CONTEXTS = ['employment', 'credit', 'education', 'medical', 'law_enforcement', 'migration', 'justice'];

  let eu_ai_act_tier;
  if (
    (processes_biometrics && deployment_context === 'public_space_law_enforcement') ||
    (is_emotion_recognition && (deployment_context === 'workplace' || deployment_context === 'education'))
  ) {
    eu_ai_act_tier = 'prohibited';
  } else if (
    affects_critical_infrastructure ||
    (typeof deployment_context === 'string' && HIGH_RISK_CONTEXTS.includes(deployment_context))
  ) {
    eu_ai_act_tier = 'high_risk';
  } else if (is_autonomous) {
    eu_ai_act_tier = 'limited_risk';
  } else {
    eu_ai_act_tier = 'minimal_risk';
  }

  // NIST RMF profile
  let nist_rmf_profile;
  if (eu_ai_act_tier === 'prohibited' || eu_ai_act_tier === 'high_risk') {
    nist_rmf_profile = 'T3_enhanced';
  } else if (eu_ai_act_tier === 'limited_risk') {
    nist_rmf_profile = 'T2_standard';
  } else {
    nist_rmf_profile = 'T1_basic';
  }

  // ISO 42001 control set
  let iso42001_control_set;
  if (eu_ai_act_tier === 'prohibited' || eu_ai_act_tier === 'high_risk') {
    iso42001_control_set = 'enhanced';
  } else if (eu_ai_act_tier === 'limited_risk') {
    iso42001_control_set = 'standard';
  } else {
    iso42001_control_set = 'light';
  }

  // GPAI obligations
  const gpai_obligations = {
    applies: is_gpai,
    systemic_risk: is_gpai && has_systemic_risk,
  };

  const compliance_flags = {
    GOVERNANCE_CLASSIFIED: true,
    EU_AI_ACT_TIER: eu_ai_act_tier,
    NIST_PROFILE: nist_rmf_profile,
    ISO42001_CONTROL_SET: iso42001_control_set,
  };

  const output_payload = {
    eu_ai_act_tier,
    nist_rmf_profile,
    iso42001_control_set,
    gpai_obligations,
    use_case,
    deployment_context,
  };

  return { output_payload, compliance_flags };
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
