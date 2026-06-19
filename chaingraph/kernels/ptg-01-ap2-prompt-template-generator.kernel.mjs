export const meta = {
  tool_id: 'ptg-01-ap2-prompt-template-generator',
  mcp_name: 'compose_ap2_prompt',
  mandate_type: 'prompt_template',
};

export function compute(pp) {
  const artifactRaw = pp.artifact_json;
  let mandateType = 'unknown';
  let toolId = 'unknown';
  let executionHash = 'unknown';
  let chainDepth = 0;
  let outputPayload = {};

  if (artifactRaw) {
    try {
      const artifact = typeof artifactRaw === 'string' ? JSON.parse(artifactRaw) : artifactRaw;
      mandateType = artifact.mandate_type || 'unknown';
      toolId = artifact.tool_id || 'unknown';
      executionHash = artifact.execution_hash || 'unknown';
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
    `Execution hash: ${executionHash}\n` +
    `Chain depth: ${chainDepth}\n\n` +
    `Key findings from the tool output:\n${JSON.stringify(outputPayload, null, 2)}\n\n` +
    (citationBlock ? `${citationBlock}\n\n` : '') +
    `Structure the ${task} with: Executive Summary, Key Findings, Risk Assessment, Recommended Actions.`;

  const claudeDeeplink = 'https://claude.ai/new?q=' + encodeURIComponent(generatedPrompt);

  return {
    generated_prompt: generatedPrompt,
    claude_deeplink: claudeDeeplink,
    generated_prompt_length: generatedPrompt.length,
    mandate_type_matched: mandateType,
    source_tool_id: toolId,
    source_execution_hash: executionHash,
    task,
    audience,
    tone,
    include_citations: includeCitations,
    compliance_flags: [],
  };
}

export function buildArtifact(pp, opts = {}) {
  const result = compute(pp);
  return {
    tool_id: meta.tool_id,
    mcp_name: meta.mcp_name,
    mandate_type: meta.mandate_type,
    output_payload: result,
    compliance_flags: result.compliance_flags,
  };
}
