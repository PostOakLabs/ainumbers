import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-184-irrbb-sot-eve-evaluator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'evaluate_irrbb_sot_eve',
  mandate_type: 'compliance_mandate', gpu: false,
};

// EBA Supervisory Outlier Test (SOT) on Economic Value of Equity: the worst-case
// DeltaEVE decline across the 6 standardised shock scenarios is compared to the
// hard EU-wide threshold of 15% of Tier 1 capital (EBA RTS on the SOT / EBA
// Guidelines on IRRBB & CSRBB, EBA/GL/2022/14) -- breach requires immediate
// supervisory dialogue. Second node of irrbb-supervisory-outlier-test chain.
// Section 16 proof candidate. NaN-safe. Zero network, zero PII.
const SOT_EVE_THRESHOLD_PCT = 15;

export function compute(pp) {
  const { eve_shock = {}, capital = {} } = pp;
  const g = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;

  const worst_delta_eve = g(eve_shock.worst_delta_eve);
  const tier1_capital = g(capital.tier1_capital);
  const decline_abs = Math.abs(Math.min(0, worst_delta_eve));

  const delta_eve_pct_of_tier1 = tier1_capital > 0
    ? Math.round((decline_abs / tier1_capital) * 10000) / 100 : 0;

  const eve_outlier = tier1_capital > 0 && delta_eve_pct_of_tier1 > SOT_EVE_THRESHOLD_PCT;

  const compliance_flags = { IRRBB_SOT_EVE_EVALUATED: true };
  if (eve_outlier) compliance_flags.IRRBB_SOT_EVE_OUTLIER_BREACH = true;
  else if (tier1_capital > 0) compliance_flags.IRRBB_SOT_EVE_WITHIN_THRESHOLD = true;

  return {
    output_payload: {
      worst_delta_eve,
      tier1_capital,
      delta_eve_pct_of_tier1,
      sot_eve_threshold_pct: SOT_EVE_THRESHOLD_PCT,
      eve_outlier,
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
