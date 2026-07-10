import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-21-agent-traffic-acceptance-policy-builder';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'build_google_ap2_mandate',
  mandate_type: 'agent_guardrail_mandate',
  gpu: false,
};

const VERIF_LABELS = {
  none:     'None (anonymous allowed)',
  jwt:      'Basic JWT bearer token',
  ap2_vdc:  'AP2 Verifiable Digital Credential',
  tap_sig:  'Visa TAP / RFC 9421 HTTP signature',
};

const RAIL_LABELS = {
  x402: 'x402 HTTP 402',
  acp:  'ACP / AP2 mandate',
  ucp:  'UCP universal checkout',
  tap:  'Visa TAP',
};

function assessGuardrails(r) {
  const findings = [];

  // Verification level
  if (r.verification_level === 'none') {
    findings.push({ cls: 'warn', text: 'No verification required. Suitable only for free tiers. Add JWT for any paid access.' });
  } else if (r.verification_level === 'tap_sig') {
    findings.push({ cls: 'pass', text: 'Full TAP / RFC 9421 HTTP signature: strongest available identity attestation.' });
  } else if (r.verification_level === 'ap2_vdc') {
    findings.push({ cls: 'pass', text: 'AP2 Verifiable Digital Credential: agent identity cryptographically attested.' });
  } else {
    findings.push({ cls: 'pass', text: 'Basic JWT: adequate for consumer-tier agents. Upgrade to AP2 VDC for financial-grade workflows.' });
  }

  // Single tx limit
  if (r.max_single_val_usd >= 1000) {
    findings.push({ cls: 'warn', text: `Single transaction limit $${r.max_single_val_usd} is high for AI-agent traffic.` });
  } else {
    findings.push({ cls: 'pass', text: `Single transaction cap $${r.max_single_val_usd} limits blast radius.` });
  }

  // Protocol coverage
  const rails = r.rails ?? [];
  if (!rails.includes('acp') && !rails.includes('ucp')) {
    findings.push({ cls: 'warn', text: 'Neither ACP nor UCP accepted. Enable at least one for standardized agent-commerce interoperability.' });
  } else {
    findings.push({ cls: 'pass', text: `Standard agent commerce protocol(s) enabled: ${rails.filter(r => r === 'acp' || r === 'ucp').map(r => RAIL_LABELS[r]).join(', ')}.` });
  }

  // Burst blocking
  const block_rules = r.block_rules ?? [];
  if (!block_rules.includes('block_burst')) {
    findings.push({ cls: 'warn', text: 'Burst blocking not enabled. Agent runaway loops can exhaust daily quotas.' });
  } else {
    findings.push({ cls: 'pass', text: 'Burst detection active: velocity anomaly threshold will block runaway agent loops.' });
  }

  // Refund posture
  if (r.refund_posture === 'liberal') {
    findings.push({ cls: 'warn', text: 'Liberal refund posture increases chargeback risk. Ensure velocity caps are tight.' });
  } else if (r.refund_posture !== 'strict') {
    findings.push({ cls: 'pass', text: 'Standard refund / dispute window is a reasonable default for agent-commerce transactions.' });
  }

  // Anonymous high-value block
  if (block_rules.includes('block_anon_high')) {
    findings.push({ cls: 'pass', text: 'Anonymous-agent high-value block active: identity required above $50 per transaction.' });
  }

  return findings;
}

export function compute(pp) {
  const agent_types       = pp.agent_types       ?? ['openai','google'];
  const verification_level = pp.verification_level ?? 'jwt';
  const max_tx_per_min    = pp.max_tx_per_min    ?? 60;
  const max_tx_per_day    = pp.max_tx_per_day    ?? 5000;
  const max_single_val_usd = pp.max_single_val_usd ?? 250;
  const max_daily_val_usd  = pp.max_daily_val_usd  ?? 2500;
  const rails             = pp.rails             ?? ['x402','acp'];
  const refund_posture    = pp.refund_posture    ?? 'standard';
  const retry_policy      = pp.retry_policy      ?? 'retry_1x';
  const block_rules       = pp.block_rules       ?? ['block_anon_high','block_vpn','block_burst'];

  const r = { agent_types, verification_level, max_tx_per_min, max_tx_per_day, max_single_val_usd, max_daily_val_usd, rails, refund_posture, retry_policy, block_rules };

  const guardrail_findings = assessGuardrails(r);
  const warn_count = guardrail_findings.filter(g => g.cls === 'warn').length;
  const pass_count = guardrail_findings.filter(g => g.cls === 'pass').length;

  const overall_risk = warn_count === 0 ? 'low'
    : warn_count <= 1 ? 'moderate'
    : 'high';

  const compliance_flags = [];
  compliance_flags.push('AGENT_ACCEPTANCE_POLICY_BUILT');
  if (overall_risk === 'low') compliance_flags.push('POLICY_RISK_LOW');
  if (overall_risk === 'moderate') compliance_flags.push('POLICY_RISK_MODERATE');
  if (overall_risk === 'high') compliance_flags.push('POLICY_RISK_HIGH');
  if (['ap2_vdc','tap_sig'].includes(verification_level)) compliance_flags.push('STRONG_IDENTITY_REQUIRED');
  if (block_rules.includes('block_burst')) compliance_flags.push('BURST_PROTECTION_ACTIVE');
  if (block_rules.includes('block_anon_high')) compliance_flags.push('ANON_HIGH_VALUE_BLOCKED');
  if (rails.includes('acp')) compliance_flags.push('ACP_ENABLED');
  if (rails.includes('ucp')) compliance_flags.push('UCP_ENABLED');
  if (rails.includes('x402')) compliance_flags.push('X402_ENABLED');
  if (rails.includes('tap')) compliance_flags.push('TAP_ENABLED');

  const output_payload = {
    verdict: overall_risk === 'low' ? 'POLICY_SOUND' : overall_risk === 'moderate' ? 'POLICY_ADVISORY' : 'POLICY_AT_RISK',
    overall_risk,
    accepted_agent_types: agent_types,
    verification_level,
    max_single_transaction_usd: max_single_val_usd,
    max_daily_spend_usd: max_daily_val_usd,
    max_tx_per_min,
    max_tx_per_day,
    accepted_payment_rails: rails,
    refund_posture,
    retry_policy,
    block_rules,
    guardrail_findings: guardrail_findings.map(g => ({ type: g.cls, message: g.text })),
    guardrail_warnings: warn_count,
    guardrail_passes: pass_count,
  };
  return { output_payload, compliance_flags };
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
