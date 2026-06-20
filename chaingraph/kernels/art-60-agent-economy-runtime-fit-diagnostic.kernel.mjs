/**
 * art-60-agent-economy-runtime-fit-diagnostic.kernel.mjs
 * Wave 14 — Agent Economy Runtime Fit Diagnostic (D0).
 * 12 questions → 6 weighted dimensions → A–F grade + routing to the right aer-* chain.
 * Grades an agent platform/operator for runtime payment settlement (the post-trade layer)
 * — distinct from Wave 6 pre-trade conformance/identity/mandate cluster.
 * Pure decision kernel — no DOM, no window, no Date.now().
 * Citations (verify against current primary sources):
 *   x402 V2 Batch Settlement spec (Linux Foundation x402 Foundation, 2026);
 *   AP2 v0.2 — Intent/Cart/Payment Mandates + PaymentReceipt + Human-Not-Present
 *     (FIDO Alliance, donated by Google Apr 2026);
 *   W3C Verifiable Credentials (mandate/receipt signing).
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-60-agent-economy-runtime-fit-diagnostic';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'run_agent_economy_fit',
  mandate_type: 'agent_guardrail_mandate',
  gpu:          false,
};

// --- Scoring tables: each answer value → 0..4 sub-score ---
const S = {
  // Settlement rail dimension
  settlement_protocol: {
    'x402-v2':      4,  // x402 V2 batch settlement (Linux Foundation, May 2026)
    'x402-v1':      2,
    'AP2-native':   3,  // AP2 PaymentMandate native rail
    'card-token':   1,
    'none':         0,
  },
  batch_settlement: {
    'escrow-voucher': 4,  // x402 V2 off-chain voucher → onchain batch redemption
    'per-request':    1,  // every HTTP 402 settles individually
    'none':           0,
  },
  // Receipt & mandate dimension
  receipt_standard: {
    'AP2-PaymentReceipt': 4,  // AP2 v0.2 PaymentReceipt + VC-signed (FIDO)
    'proprietary':        2,
    'none':               0,
  },
  mandate_binding: {
    'VC-signed':     4,  // W3C Verifiable Credential signed mandate chain
    'API-asserted':  2,
    'none':          0,
  },
  // Autonomy controls dimension
  hnp_autonomy: {
    'policy-gated':  4,  // Human-Not-Present: spend cap + category gate + mandate age check
    'unbounded':     0,  // HNP with no guardrail — highest risk
    'not-used':      2,
  },
  spend_controls: {
    'per-mandate-caps': 4,
    'global-cap':       2,
    'none':             0,
  },
  // Reconciliation dimension
  recon_model: {
    'hash-anchored': 4,  // execution_hash trail, verifiable by counterparty
    'ledger-diff':   2,
    'manual':        0,
  },
  dispute_path: {
    'automated': 4,
    'manual':    2,
    'none':      0,
  },
  // Metering dimension
  metering_basis: {
    'per-call-metered': 4,  // every agent service call metered individually
    'subscription':     2,
    'unmetered':        0,
  },
  // Risk dimension
  runtime_fraud_controls: {
    'velocity+graph': 4,  // velocity limits + agent-graph collusion detection
    'basic':          2,
    'none':           0,
  },
};

const pick   = (t, v, d = 0) => (v in t ? t[v] : d);
const letter = s => (s >= 85 ? 'A' : s >= 70 ? 'B' : s >= 55 ? 'C' : s >= 40 ? 'D' : 'F');

const WEIGHTS = {
  rail:       0.25,  // Settlement rail (x402 V2 + batch)
  receipt:    0.20,  // Receipt & mandate (AP2 PaymentReceipt + VC binding)
  autonomy:   0.20,  // Autonomy controls (HNP gate + spend caps)
  recon:      0.15,  // Reconciliation (hash-anchored + dispute path)
  metering:   0.10,  // Metering basis
  risk:       0.10,  // Runtime fraud controls
};

// Routing: dimension → primary aer-* chain
const ROUTE = {
  rail:     'aer-batch-settlement',
  receipt:  'aer-payment-receipt',
  autonomy: 'aer-autonomous-guardrail',
  recon:    'aer-batch-settlement',
  metering: 'aer-metering',
  risk:     'aer-fraud-runtime',
};

const REMEDIATION = {
  rail:     'Upgrade settlement rail to x402 V2 batch settlement (escrow-voucher pattern). Run aer-batch-settlement to reconcile voucher set → onchain batch and validate settlement-risk window.',
  receipt:  'Adopt AP2 v0.2 PaymentReceipt (FIDO Alliance). Wire VC-signed mandate chain. Run aer-payment-receipt to verify receipt against mandate chain and apply HNP guardrail.',
  autonomy: 'Add Human-Not-Present (HNP) policy gate: per-mandate spend caps, allowed-category list, mandate-age check. Run aer-autonomous-guardrail to enforce AP2 v0.2 HNP policy on executed payments.',
  recon:    'Move to hash-anchored reconciliation: each settled voucher carries an execution_hash verifiable by the counterparty. Add automated dispute path. Run aer-batch-settlement.',
  metering: 'Meter every agent service call individually (per-call basis). Run aer-metering to model unit economics and identify negative-margin scenarios.',
  risk:     'Implement velocity limits + agent-graph collusion detection for the runtime payment stream. Run aer-fraud-runtime to identify policy violations and anomalous network patterns.',
};

export function compute(pp) {
  const {
    settlement_protocol      = 'none',
    batch_settlement         = 'none',
    receipt_standard         = 'none',
    mandate_binding          = 'none',
    hnp_autonomy             = 'not-used',
    spend_controls           = 'none',
    recon_model              = 'manual',
    dispute_path             = 'none',
    metering_basis           = 'unmetered',
    runtime_fraud_controls   = 'none',
    // informational only
    agent_volume_txns_per_day = 0,
    operator_type            = 'agent-platform',
  } = pp;

  const sub = {
    rail:     [pick(S.settlement_protocol, settlement_protocol), pick(S.batch_settlement, batch_settlement)],
    receipt:  [pick(S.receipt_standard, receipt_standard), pick(S.mandate_binding, mandate_binding)],
    autonomy: [pick(S.hnp_autonomy, hnp_autonomy), pick(S.spend_controls, spend_controls)],
    recon:    [pick(S.recon_model, recon_model), pick(S.dispute_path, dispute_path)],
    metering: [pick(S.metering_basis, metering_basis)],
    risk:     [pick(S.runtime_fraud_controls, runtime_fraud_controls)],
  };

  const dim_scores = {};
  for (const k of Object.keys(sub)) {
    const avg = sub[k].reduce((a, b) => a + b, 0) / sub[k].length;
    dim_scores[k] = { score: +(avg / 4 * 100).toFixed(1), grade: letter(avg / 4 * 100) };
  }

  const overall = +Object.keys(WEIGHTS).reduce(
    (acc, k) => acc + dim_scores[k].score * WEIGHTS[k], 0
  ).toFixed(1);
  const overall_grade = letter(overall);

  // Routing: weakest dimension drives primary recommendation
  const ranked = Object.keys(dim_scores).sort((a, b) => dim_scores[a].score - dim_scores[b].score);
  const primary_recommendation = ROUTE[ranked[0]];

  const secondary_recommendations = [];
  if (batch_settlement !== 'none' && ROUTE.rail !== primary_recommendation)
    secondary_recommendations.push('aer-batch-settlement');
  if (receipt_standard !== 'none' && ROUTE.receipt !== primary_recommendation &&
      !secondary_recommendations.includes('aer-payment-receipt'))
    secondary_recommendations.push('aer-payment-receipt');
  if (hnp_autonomy !== 'not-used' && ROUTE.autonomy !== primary_recommendation &&
      !secondary_recommendations.includes('aer-autonomous-guardrail'))
    secondary_recommendations.push('aer-autonomous-guardrail');
  if (metering_basis !== 'unmetered' && ROUTE.metering !== primary_recommendation &&
      !secondary_recommendations.includes('aer-metering'))
    secondary_recommendations.push('aer-metering');
  if (operator_type === 'marketplace' && !secondary_recommendations.includes('aer-marketplace'))
    secondary_recommendations.push('aer-marketplace');
  if (!secondary_recommendations.includes(ROUTE[ranked[1]]) && ROUTE[ranked[1]] !== primary_recommendation)
    secondary_recommendations.push(ROUTE[ranked[1]]);
  if (!secondary_recommendations.includes('aer-audit-pack'))
    secondary_recommendations.push('aer-audit-pack');

  const remediation_checklist = [];
  for (const k of Object.keys(dim_scores)) {
    if (dim_scores[k].grade === 'D' || dim_scores[k].grade === 'F') {
      remediation_checklist.push({ dimension: k, grade: dim_scores[k].grade, action: REMEDIATION[k] });
    }
  }

  const compliance_flags = [];
  if (hnp_autonomy === 'unbounded') compliance_flags.push('HNP_AUTONOMY_UNBOUNDED');
  if (batch_settlement === 'none') compliance_flags.push('NO_BATCH_RECONCILIATION');
  if (metering_basis === 'unmetered') compliance_flags.push('UNMETERED_AGENT_SERVICE');
  if (overall_grade === 'D' || overall_grade === 'F') compliance_flags.push('LOW_RUNTIME_READINESS');

  const hnp_risk_flag = hnp_autonomy === 'unbounded'
    ? 'CRITICAL: HNP autonomy is unbounded — no spend cap or category gate. Apply AP2 v0.2 HNP policy immediately.'
    : null;

  const output_payload = {
    dim_scores,
    overall_score: overall,
    overall_grade,
    primary_recommendation,
    secondary_recommendations,
    remediation_checklist,
    hnp_risk_flag,
    note: 'Educational runtime readiness diagnostic for the Agent Economy Runtime layer (post-trade / settlement). Grades x402 V2 batch settlement, AP2 v0.2 PaymentReceipt + HNP autonomy, reconciliation, metering, and runtime fraud controls. This is the runtime/post-trade counterpart to Wave 6\'s pre-trade conformance cluster — not a re-skin. Not settlement, legal, or financial advice. Verify x402 V2 and AP2 v0.2 specs against current Linux Foundation x402 Foundation / FIDO Alliance primary sources (2026-06-20).',
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
    tool_id:             TOOL_ID,
    tool_version:        TOOL_VERSION,
    generated_at:        now ?? null,
    execution_hash:      hash,
    chain:               { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:   pp,
    output_payload,
    compliance_flags,
    compute_mode:        'server',
    audit_signature:     { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
