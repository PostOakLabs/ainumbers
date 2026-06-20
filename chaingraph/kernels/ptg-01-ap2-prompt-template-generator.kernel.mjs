import { executionHash } from './_hash.mjs';

const TOOL_ID = 'ptg-01-ap2-prompt-template-generator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'compose_ap2_prompt',
  mandate_type: 'prompt_template',
  gpu: false,
};

export function compute(pp) {
  const artifactRaw = pp.artifact_json;
  let mandateType = 'unknown';
  let toolId = 'unknown';
  let exHash = 'unknown';
  let chainDepth = 0;
  let outputPayload = {};

  if (artifactRaw) {
    try {
      const artifact = typeof artifactRaw === 'string' ? JSON.parse(artifactRaw) : artifactRaw;
      mandateType = artifact.mandate_type || 'unknown';
      toolId = artifact.tool_id || 'unknown';
      exHash = artifact.execution_hash || 'unknown';
      chainDepth = (artifact.chain && artifact.chain.chain_depth) || 0;
      outputPayload = artifact.output_payload || {};
    } catch (_) {
      // leave defaults
    }
  }

  const task = pp.task || 'plain_english_summary';
  const audience = pp.audience || 'board';
  const tone = pp.tone || 'formal';
  const includeCitations = pp.include_citations !== false && pp.include_citations !== 'false';

  const audienceFormatMap = {
    board: 'Executive-level, no jargon',
    risk_committee: 'Technical + regulatory references',
    regulator: 'Formal regulatory tone',
    quant: 'Quantitative detail',
    ops: 'Operational summary',
  };

  const toneModifiers = {
    formal: 'Formal professional language',
    technical: 'Technical terminology with precision',
    plain: 'Plain language accessible to non-experts',
  };

  const audienceLabel = audienceFormatMap[audience] || audienceFormatMap.board;
  const toneModifier = toneModifiers[tone] || toneModifiers.formal;
  const citationBlock = includeCitations
    ? `Include regulatory citations relevant to mandate type ${mandateType}.`
    : '';

  const generatedPrompt =
    `You are a financial compliance analyst. Prepare a ${task} for the ${audience} audience.\n\n` +
    `Tone: ${toneModifier}\n` +
    `Mandate type: ${mandateType}\n` +
    `Tool: ${toolId}\n` +
    `Execution hash: ${exHash}\n` +
    `Chain depth: ${chainDepth}\n\n` +
    `Key findings from the tool output:\n${JSON.stringify(outputPayload, null, 2)}\n\n` +
    (citationBlock ? `${citationBlock}\n\n` : '') +
    `Structure the ${task} with: Executive Summary, Key Findings, Risk Assessment, Recommended Actions.`;

  const claudeDeeplink = 'https://claude.ai/new?q=' + encodeURIComponent(generatedPrompt);

  const output_payload = {
    generated_prompt: generatedPrompt,
    claude_deeplink: claudeDeeplink,
    generated_prompt_length: generatedPrompt.length,
    mandate_type_matched: mandateType,
    source_tool_id: toolId,
    source_execution_hash: exHash,
    task,
    audience,
    tone,
    include_citations: includeCitations,
  };

  return { output_payload, compliance_flags: [] };
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
