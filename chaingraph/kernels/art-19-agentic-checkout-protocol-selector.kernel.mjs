import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-19-agentic-checkout-protocol-selector';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'compare_agentic_payment_protocols',
  mandate_type: 'routing_policy',
  gpu: false,
};

const PROTOCOLS = {
  UCP: {
    name: 'UCP (Universal Checkout Protocol)',
    short: 'UCP',
    bestFor: 'Platform merchants, broad agent interop, standardized checkout across agent surfaces',
    notFor: 'Micropayments < $1, custom API-only merchants needing sub-cent settlement',
    aovRange: ['low','mid','high','enterprise'],
    score(p) {
      let s = 0;
      if (p.platform !== 'saas') s += 20;
      if (['consumer','mixed','agent'].includes(p.buyer_type)) s += 15;
      s += 20; // any aov
      if (['moderate','high'].includes(p.agent_appetite)) s += 25;
      if (p.platform === 'shopify') s += 15;
      if (p.geo === 'global') s += 5;
      if (p.tech_cap !== 'nocode') s += 10;
      return Math.min(s, 100);
    },
  },
  ACP: {
    name: 'ACP (Agent Commerce Protocol / AP2)',
    short: 'ACP/AP2',
    bestFor: 'AI-native merchants, ChatGPT / Gemini checkout integration, structured mandate flows',
    notFor: 'Merchants with no AI agent traffic or no API integration capability',
    aovRange: ['low','mid','high','enterprise'],
    score(p) {
      let s = 0;
      if (['agent','mixed'].includes(p.buyer_type)) s += 30;
      if (p.agent_appetite === 'high') s += 30;
      else if (p.agent_appetite === 'moderate') s += 18;
      if (p.tech_cap === 'api') s += 20;
      if (['mid','high','enterprise'].includes(p.aov)) s += 10;
      if (p.platform !== 'nocode') s += 10;
      return Math.min(s, 100);
    },
  },
  x402: {
    name: 'x402 (HTTP 402 Micropayment Protocol)',
    short: 'x402',
    bestFor: 'API/content micropayments, per-call AI agent billing, developer tools, sub-$10 transactions',
    notFor: 'Consumer checkout flows, merchants needing fiat settlement, high-AOV merchandise',
    aovRange: ['micro','low'],
    score(p) {
      let s = 0;
      if (['micro','low'].includes(p.aov)) s += 35;
      if (p.buyer_type === 'agent') s += 25;
      if (p.tech_cap === 'api') s += 20;
      if (p.stack_crypto) s += 15;
      if (p.platform === 'saas') s += 10;
      if (p.agent_appetite !== 'none') s += 10;
      return Math.min(s, 100);
    },
  },
  TAP: {
    name: 'Visa TAP / VIC (Trusted Agent Protocol)',
    short: 'Visa TAP/VIC',
    bestFor: 'Card-first merchants, backward compat with existing Visa acquiring, high-value B2C/B2B',
    notFor: 'Crypto-native merchants, micropayments, merchants without Visa acquiring',
    aovRange: ['mid','high','enterprise'],
    score(p) {
      let s = 0;
      if (p.stack_card) s += 30;
      if (['mid','high','enterprise'].includes(p.aov)) s += 25;
      if (['consumer','mixed'].includes(p.buyer_type)) s += 15;
      if (p.platform !== 'saas') s += 10;
      if (['moderate','high'].includes(p.agent_appetite)) s += 15;
      if (p.geo === 'us' || p.geo === 'global') s += 5;
      return Math.min(s, 100);
    },
  },
};

function scoreLabel(s) {
  if (s >= 70) return 'recommended';
  if (s >= 45) return 'viable';
  if (s >= 25) return 'marginal';
  return 'not_recommended';
}

export function compute(pp) {
  const profile = {
    platform:       pp.platform       ?? 'custom',
    buyer_type:     pp.buyer_type     ?? 'mixed',
    aov:            pp.aov            ?? 'mid',
    agent_appetite: pp.agent_appetite ?? 'moderate',
    geo:            pp.geo            ?? 'global',
    tech_cap:       pp.tech_cap       ?? 'api',
    stack_card:     pp.stack_card     ?? false,
    stack_crypto:   pp.stack_crypto   ?? false,
  };

  const scores = {};
  for (const [k, proto] of Object.entries(PROTOCOLS)) {
    scores[k] = proto.score(profile);
  }

  const sorted = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);
  const primary = sorted[0];

  const protocol_scores = sorted.map(k => ({
    protocol: k,
    name: PROTOCOLS[k].name,
    score: scores[k],
    label: scoreLabel(scores[k]),
    bestFor: PROTOCOLS[k].bestFor,
    notFor: PROTOCOLS[k].notFor,
  }));

  const viable = sorted.filter(k => scores[k] >= 45);
  const recommended = sorted.filter(k => scores[k] >= 70);

  const compliance_flags = {
    PROTOCOL_SELECTION_COMPLETE: true,
    PRIMARY_PROTOCOL: primary,
    HAS_RECOMMENDED_PROTOCOL: recommended.length > 0,
    UCP_VIABLE: scores.UCP >= 45,
    ACP_VIABLE: scores.ACP >= 45,
    X402_VIABLE: scores.x402 >= 45,
    TAP_VIABLE: scores.TAP >= 45,
    MULTI_PROTOCOL_RECOMMENDED: recommended.length > 1,
  };

  const output_payload = {
    primary_recommendation: primary,
    primary_name: PROTOCOLS[primary].name,
    primary_score: scores[primary],
    protocol_scores,
    viable_protocols: viable,
    recommended_protocols: recommended,
    profile,
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
