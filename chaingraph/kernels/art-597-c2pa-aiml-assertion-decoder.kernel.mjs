import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-597-c2pa-aiml-assertion-decoder';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'decode_c2pa_aiml_assertions',
  mandate_type: 'compliance_control',
  gpu:          false,
};

// AI/ML assertion decoder for a C2PA manifest's action + training/mining
// assertions. Generalizes art-361's single-action digitalSourceType read
// (IDV-scoped, first action only) into a general-purpose decoder that
// reports the FULL c2pa.actions/c2pa.actions.v2 array (a manifest can carry
// created -> edited -> published history; collapsing to the first action
// loses it) plus c2pa.ai_training / c2pa.ai_generative_training opt-out
// assertions where present. SPEC-C2PA-TEXT-TSA-1-2026-08-09.md section 3.
//
// HARD RAIL: decode and report what a manifest ASSERTS. Never adjudicate
// whether the assertion is true. Absence of an AI/ML assertion means
// nothing -- never infer "AI-generated" from a missing assertion, and never
// infer "confirmed human-authored" from one either. training_mining_opt_out
// is 'not_asserted' unless the manifest carries an explicit boolean; a
// malformed/missing boolean on a present assertion is ALSO 'not_asserted',
// never guessed as true or false.
//
// Reuses art-123's assertion-array input shape (assertions[] with {label,
// ...}) as its input contract -- a sibling stage, not a modification of
// art-123/art-361. Zero network, zero PII: inputs are the decoded
// manifest's structural fields only, never asset bytes.

// IPTC digitalsourcetype NewsCodes vocabulary (http://cv.iptc.org/newscodes/digitalsourcetype/).
// Raw code is ALWAYS surfaced regardless of recognition; this set only
// decides whether it also lands in unrecognized_source_types.
const KNOWN_SOURCE_TYPES = new Set([
  'digitalCapture',
  'negativeFilm',
  'positiveFilm',
  'print',
  'humanEdits',
  'minorHumanEdits',
  'compositeCapture',
  'compositeSynthetic',
  'algorithmicMedia',
  'dataDrivenMedia',
  'digitalArt',
  'virtualRecording',
  'softwareImage',
  'trainedAlgorithmicMedia',
  'compositeWithTrainedAlgorithmicMedia',
].map(code => `http://cv.iptc.org/newscodes/digitalsourcetype/${code}`));

const AI_TRAINING_LABELS = new Set(['c2pa.ai_training', 'c2pa.ai_generative_training']);
const ACTIONS_LABELS = new Set(['c2pa.actions', 'c2pa.actions.v2']);

function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }

export function compute(pp) {
  pp = pp || {};
  const assertions = Array.isArray(pp.assertions) ? pp.assertions : [];

  // --- ALL actions, from EVERY c2pa.actions/c2pa.actions.v2 assertion (not just the first). ---
  const actions = [];
  const digital_source_types_seen = [];
  for (const assertion of assertions) {
    if (!assertion || !ACTIONS_LABELS.has(assertion.label)) continue;
    const actionList = Array.isArray(assertion.actions) ? assertion.actions : [];
    for (const entry of actionList) {
      if (!entry) continue;
      const digital_source_type = safeStr(entry.digitalSourceType) || null;
      if (digital_source_type && !digital_source_types_seen.includes(digital_source_type)) {
        digital_source_types_seen.push(digital_source_type);
      }
      actions.push({
        action: safeStr(entry.action) || null,
        digital_source_type,
        when: safeStr(entry.when) || null,
        software_agent: safeStr(entry.softwareAgent) || null,
      });
    }
  }

  const unrecognized_source_types = digital_source_types_seen.filter(t => !KNOWN_SOURCE_TYPES.has(t));

  // --- training/mining opt-out: report only an EXPLICIT boolean; never infer. ---
  const training_assertion = assertions.find(a => a && AI_TRAINING_LABELS.has(a.label));
  let training_mining_opt_out = 'not_asserted';
  if (training_assertion && typeof training_assertion.training_mining_opt_out === 'boolean') {
    training_mining_opt_out = training_assertion.training_mining_opt_out;
  }

  const digital_source_type_summary = digital_source_types_seen.length
    ? digital_source_types_seen
    : [];

  const compliance_flags = ['C2PA_AIML_ASSERTIONS_DECODED'];
  compliance_flags.push(actions.length ? 'ACTIONS_ASSERTION_PRESENT' : 'NO_ACTIONS_ASSERTION');
  if (training_mining_opt_out === true) compliance_flags.push('AI_TRAINING_MINING_OPT_OUT_ASSERTED');
  else if (training_mining_opt_out === false) compliance_flags.push('AI_TRAINING_MINING_OPT_OUT_NOT_ASSERTED');
  else compliance_flags.push('AI_TRAINING_MINING_OPT_OUT_STATUS_NOT_ASSERTED');
  if (unrecognized_source_types.length) compliance_flags.push('UNRECOGNIZED_DIGITAL_SOURCE_TYPE_PRESENT');

  const output_payload = {
    actions,
    digital_source_type_summary,
    training_mining_opt_out,
    unrecognized_source_types,
    note: 'Reports assertions as declared by the manifest generator only -- never adjudicated. Absence of an AI/ML assertion means nothing: it is never evidence of human authorship, and its presence is never proof of AI generation. Assertions only, not a trust-chain or signature claim.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':          'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version:  '0.4.0',
    mandate_type:        meta.mandate_type,
    tool_id:              TOOL_ID,
    tool_version:         TOOL_VERSION,
    generated_at:         now ?? null,
    execution_hash:       hash,
    chain:                { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:    pp,
    output_payload,
    compliance_flags,
    compute_mode:         'server',
    compute_proof_ready:  'deferred',
    audit_signature:      { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
