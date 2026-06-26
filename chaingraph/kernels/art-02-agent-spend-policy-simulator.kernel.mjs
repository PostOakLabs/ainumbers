/**
 * art-02-agent-spend-policy-simulator.kernel.mjs
 * Agent Spend Policy Simulator — Mulberry32 PRNG, transaction generation + policy validation.
 * Pure decision kernel — no DOM, no window, no Date.now(), no Math.random().
 */

import { executionHash } from './_hash.mjs';

export const meta = {
  tool_id:      'art-02-agent-spend-policy-simulator',
  mcp_name:     'simulate_spend_policy',
  mandate_type: 'payment_policy',
  version:      '1.0.0',
};

const TOOL_ID = 'art-02-agent-spend-policy-simulator';
const TOOL_VERSION = '1.0.0';

// ── Mulberry32 PRNG (matches source HTML makePRNG) ───────────────────────────
function makePRNG(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6D2B79F5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Static pools ──────────────────────────────────────────────────────────────
const MERCHANT_POOL = [
  'Amazon Web Services','Google Cloud','Stripe','Twilio','Notion',
  'Slack','GitHub','Figma','Zoom','Salesforce',
  'Microsoft Azure','OpenAI','Anthropic','Vercel','PlanetScale',
  'Linear','Retool','Airtable','Loom','DocuSign',
];
const CATEGORY_POOL = [
  'Cloud Infrastructure','SaaS Subscription','AI / ML Services',
  'Communication','Developer Tools','Design','Analytics',
  'Security','Payments Infrastructure','HR / Ops',
];
const METHOD_POOL = ['x402','card','ACH','wire','stablecoin'];

// ── Transaction generator ─────────────────────────────────────────────────────
function generateTx(idx, rng, policy, hnpRatio, chaos, dripFreq, total) {
  const merchant = MERCHANT_POOL[Math.floor(rng() * MERCHANT_POOL.length)];
  const category = CATEGORY_POOL[Math.floor(rng() * CATEGORY_POOL.length)];
  const method   = METHOD_POOL[Math.floor(rng() * METHOD_POOL.length)];

  // Base amount: random fraction of per-tx limit with chaos noise
  const base   = (policy.per_tx_limit ?? 500) * (0.3 + rng() * 0.9);
  const noise  = chaos > 0 ? (rng() - 0.5) * chaos * base : 0;
  let amount   = Math.max(1, base + noise);

  // High-nominal-payment injection
  if (rng() < hnpRatio) amount *= 3 + rng() * 7;

  // Drip: micro-transaction burst
  if (rng() < dripFreq) amount = Math.max(0.5, amount * 0.05);

  // Simulated day (0-indexed, across a 30-day window)
  const day = Math.floor(idx / Math.max(1, total / 30));
  // Simulated hour (0-23)
  const hour = Math.floor(rng() * 24);

  return { idx, merchant, category, method, amount: +amount.toFixed(2), day, hour };
}

// ── Policy validator ──────────────────────────────────────────────────────────
function validateTx(tx, policy, dailyCumulative, monthlyCumulative) {
  const flags = [];

  if (policy.per_tx_limit  && tx.amount > policy.per_tx_limit)  flags.push('EXCEEDS_PER_TX_LIMIT');
  if (policy.daily_limit   && dailyCumulative   + tx.amount > policy.daily_limit)   flags.push('EXCEEDS_DAILY_LIMIT');
  if (policy.monthly_limit && monthlyCumulative + tx.amount > policy.monthly_limit) flags.push('EXCEEDS_MONTHLY_LIMIT');
  if (policy.blocked_categories?.includes(tx.category)) flags.push('BLOCKED_CATEGORY');
  if (policy.blocked_merchants?.includes(tx.merchant))  flags.push('BLOCKED_MERCHANT');
  if (policy.allowed_methods && !policy.allowed_methods.includes(tx.method)) flags.push('METHOD_NOT_ALLOWED');
  if (policy.hour_restriction) {
    const { start, end } = policy.hour_restriction;
    if (tx.hour < start || tx.hour >= end) flags.push('OUTSIDE_PERMITTED_HOURS');
  }

  return { passed: flags.length === 0, flags };
}

// ── Bypass path detector ─────────────────────────────────────────────────────
function detectBypassPaths(txns) {
  const bypasses = [];
  // Structuring: many small txns just under the per-tx limit
  const underLimit = txns.filter(t => t.amount < 10 && t.amount > 0);
  if (underLimit.length > txns.length * 0.20) bypasses.push('DRIP_STRUCTURING');
  // Merchant concentration
  const merchantCounts = {};
  txns.forEach(t => { merchantCounts[t.merchant] = (merchantCounts[t.merchant] ?? 0) + 1; });
  const topMerchant = Object.values(merchantCounts).reduce((a, b) => Math.max(a, b), 0);
  if (topMerchant > txns.length * 0.50) bypasses.push('SINGLE_MERCHANT_CONCENTRATION');
  return bypasses;
}

// ── Risk verdict ──────────────────────────────────────────────────────────────
function policyRiskVerdict(failRate, bypassPaths) {
  if (failRate > 0.40 || bypassPaths.length >= 2) return 'HIGH';
  if (failRate > 0.15 || bypassPaths.length >= 1) return 'MEDIUM';
  return 'LOW';
}

// ── compute ───────────────────────────────────────────────────────────────────
export function compute(pp) {
  const seed      = pp.seed       ?? 42;
  const n_txns    = Math.min(Math.max(pp.n_txns ?? 200, 10), 2000);
  const hnpRatio  = pp.hnp_ratio  ?? 0.05;
  const chaos     = pp.chaos      ?? 0.20;
  const dripFreq  = pp.drip_freq  ?? 0.10;

  const policy = {
    per_tx_limit:        pp.per_tx_limit        ?? 500,
    daily_limit:         pp.daily_limit          ?? 2000,
    monthly_limit:       pp.monthly_limit        ?? 20000,
    blocked_categories:  pp.blocked_categories   ?? [],
    blocked_merchants:   pp.blocked_merchants    ?? [],
    allowed_methods:     pp.allowed_methods      ?? null,
    hour_restriction:    pp.hour_restriction     ?? null,
  };

  const rng = makePRNG(seed);
  const txns = [];
  for (let i = 0; i < n_txns; i++) {
    txns.push(generateTx(i, rng, policy, hnpRatio, chaos, dripFreq, n_txns));
  }

  // Validate transactions with running accumulators
  const dailyCumulative   = {};
  const monthlyCumulative = { total: 0 };
  let passCount = 0, failCount = 0;
  const failReasons = {};

  const validatedTxns = txns.map(tx => {
    const dayKey = tx.day;
    if (!dailyCumulative[dayKey]) dailyCumulative[dayKey] = 0;
    const result = validateTx(tx, policy, dailyCumulative[dayKey], monthlyCumulative.total);
    if (result.passed) {
      dailyCumulative[dayKey]  += tx.amount;
      monthlyCumulative.total  += tx.amount;
      passCount++;
    } else {
      failCount++;
      result.flags.forEach(f => { failReasons[f] = (failReasons[f] ?? 0) + 1; });
    }
    return { ...tx, passed: result.passed, flags: result.flags };
  });

  const totalSpend  = validatedTxns.filter(t => t.passed).reduce((s, t) => s + t.amount, 0);
  const failRate    = failCount / n_txns;
  const bypassPaths = detectBypassPaths(txns);
  const verdict     = policyRiskVerdict(failRate, bypassPaths);

  const compliance_flags = [];
  if (verdict === 'HIGH')   compliance_flags.push('POLICY_RISK_HIGH');
  if (verdict === 'MEDIUM') compliance_flags.push('POLICY_RISK_MEDIUM');
  if (verdict === 'LOW')    compliance_flags.push('POLICY_RISK_LOW');
  if (bypassPaths.includes('DRIP_STRUCTURING'))           compliance_flags.push('BYPASS_DRIP_STRUCTURING_DETECTED');
  if (bypassPaths.includes('SINGLE_MERCHANT_CONCENTRATION')) compliance_flags.push('BYPASS_MERCHANT_CONCENTRATION_DETECTED');

  return {
    verdict,
    total_transactions:  n_txns,
    pass_count:          passCount,
    fail_count:          failCount,
    fail_rate_pct:       +(failRate * 100).toFixed(2),
    total_approved_spend: +totalSpend.toFixed(2),
    top_fail_reasons:    failReasons,
    bypass_paths_detected: bypassPaths,
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const result = compute(pp);
  const { compliance_flags = {} } = result;
  const output_payload = result;
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
