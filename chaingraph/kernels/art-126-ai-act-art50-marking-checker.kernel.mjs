import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-126-ai-act-art50-marking-checker';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'check_ai_act_art50_marking',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

export async function compute(pp) {
  const { actions = [], machine_readable_marking_present, is_deepfake, deepfake_disclosure_present } = pp;
  // IPTC digitalSourceType values that denote AI generation/manipulation.
  const AI_SOURCE_TYPES = [
    'trainedAlgorithmicMedia',
    'compositeWithTrainedAlgorithmicMedia',
    'algorithmicMedia',
    'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia',
    'http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia',
    'http://cv.iptc.org/newscodes/digitalsourcetype/algorithmicMedia',
  ];
  const created = actions.find(a => a && (a.action === 'c2pa.created'));
  const source_type = created ? created.digitalSourceType : undefined;
  const source_type_recognized = typeof source_type === 'string' && AI_SOURCE_TYPES.includes(source_type);
  const ai_marking_present = source_type_recognized && machine_readable_marking_present === true;

  const gaps = [];
  if (!source_type_recognized) gaps.push('NO_RECOGNIZED_AI_SOURCE_TYPE');
  if (machine_readable_marking_present !== true) gaps.push('MARKING_NOT_MACHINE_READABLE');
  // Art. 50(4): deepfakes additionally require artificiality disclosure.
  const deepfake_disclosure_ok = is_deepfake === true ? (deepfake_disclosure_present === true) : true;
  if (is_deepfake === true && deepfake_disclosure_present !== true) gaps.push('DEEPFAKE_DISCLOSURE_MISSING');

  const art50_conformant = ai_marking_present && deepfake_disclosure_ok;
  const compliance_flags = { AI_ACT_ART50_ASSESSED: true };
  compliance_flags[art50_conformant ? 'ART50_MARKING_CONFORMANT' : 'ART50_MARKING_NONCONFORMANT'] = true;
  if (is_deepfake === true) compliance_flags.DEEPFAKE_SCOPE = true;
  return {
    output_payload: {
      art50_conformant,
      ai_marking_present,
      source_type_recognized,
      deepfake_disclosure_ok,
      source_type: source_type ?? null,
      gaps,
    },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = await compute(pp);
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
