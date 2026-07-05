import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-249-compare-corridor-cost';
const TOOL_VERSION = '1.0.0';

export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mandate_type: 'analytics_mandate', gpu: false };

// World Bank Remittance Prices Worldwide (RPW) corridor cost methodology.
// Total cost % = fee_pct + FX_margin_pct vs interbank reference rate.
// Benchmarks: $200 and $500 send amount (RPW standard).
// SDG 10.c target: <=3% by 2030.
// SmaRT corridor average = simple mean of RPW sample corridors.
//
// RPW data snapshot pinned below; quarterly manual refresh. No live API.
// Source: World Bank Remittance Prices Worldwide Database, Q1 2026 snapshot.
// https://remittanceprices.worldbank.org/

const TABLE_VERSION = 'RPW-Q1-2026-SNAPSHOT';
const TABLE_SOURCE  = 'World Bank Remittance Prices Worldwide (RPW) Database, Q1 2026 quarterly snapshot (remittanceprices.worldbank.org). SDG 10.c target: <=3% total cost by 2030 (UN Sustainable Development Goal 10, Target 10.c). SmaRT = Simple Mean of Remittance Transfers average across sampled corridors.';

// RPW Q1 2026 sample corridor reference data (top corridors by volume).
// Format: [from_country, to_country, avg_total_cost_pct_200usd, avg_total_cost_pct_500usd, service_count]
// Source: RPW Q1 2026 quarterly data (worldbank.org/remittanceprices).
const RPW_CORRIDORS = [
  ['US', 'MX', 3.88, 2.99, 22],
  ['US', 'PH', 3.21, 2.68, 24],
  ['US', 'IN', 2.95, 2.44, 28],
  ['US', 'GT', 4.52, 3.76, 18],
  ['US', 'SV', 4.31, 3.55, 16],
  ['US', 'DO', 4.04, 3.28, 20],
  ['US', 'CO', 5.15, 4.22, 14],
  ['US', 'NG', 5.42, 4.68, 12],
  ['GB', 'IN', 2.61, 2.15, 30],
  ['GB', 'NG', 4.85, 4.02, 14],
  ['AE', 'IN', 3.12, 2.58, 26],
  ['AE', 'PK', 3.76, 3.04, 22],
  ['SA', 'IN', 3.22, 2.71, 24],
  ['SA', 'EG', 4.55, 3.82, 16],
  ['DE', 'TR', 4.18, 3.44, 18],
  ['AU', 'PH', 3.84, 3.12, 20],
  ['CA', 'IN', 2.88, 2.39, 26],
  ['CA', 'PH', 3.45, 2.88, 22],
];

// SmaRT global average across RPW Q1 2026 sampled corridors
const SMART_GLOBAL_AVG_PCT = 6.36; // Q1 2026 RPW global average (all corridors)
const SDG_TARGET_PCT = 3.0;

export function compute(params) {
  const p = params || {};

  const from_country  = typeof p.from_country  === 'string' ? p.from_country.toUpperCase()  : 'US';
  const to_country    = typeof p.to_country    === 'string' ? p.to_country.toUpperCase()    : 'MX';
  const send_amount   = _finite(p.send_amount,  200);   // USD
  const provider_fee  = _finite(p.provider_fee, 0);    // USD flat fee
  const fx_rate_used  = _finite(p.fx_rate_used, 0);    // rate provider applies
  const fx_rate_mid   = _finite(p.fx_rate_mid,  0);    // mid-market reference rate
  const service_name  = typeof p.service_name === 'string' ? p.service_name : '';

  // Fee cost as % of send amount
  const fee_pct = send_amount > 0 ? _round4((provider_fee / send_amount) * 100) : 0;

  // FX margin (spread from mid-market) as % of send amount
  // FX margin = (mid - used) / mid * 100  [if used < mid, provider takes a cut]
  // Convention: positive margin = provider markup above mid.
  let fx_margin_pct = 0;
  if (fx_rate_mid > 0 && fx_rate_used > 0) {
    fx_margin_pct = _round4(((fx_rate_mid - fx_rate_used) / fx_rate_mid) * 100);
    if (fx_margin_pct < 0) fx_margin_pct = 0; // provider gave better rate than mid (rare, treat as 0 cost)
  }

  // Total cost % (RPW methodology: fee % + FX margin %)
  const total_cost_pct = _round4(fee_pct + fx_margin_pct);

  // Benchmark lookups from RPW table
  const corridor_key = from_country + '-' + to_country;
  const rpw_row = RPW_CORRIDORS.find(function(r) { return r[0] === from_country && r[1] === to_country; });

  let rpw_corridor_avg_200 = null;
  let rpw_corridor_avg_500 = null;
  let rpw_service_count    = null;

  if (rpw_row) {
    rpw_corridor_avg_200 = rpw_row[2];
    rpw_corridor_avg_500 = rpw_row[3];
    rpw_service_count    = rpw_row[4];
  }

  // Benchmark: $200 and $500 send amounts
  const benchmark_200 = (rpw_corridor_avg_200 !== null) ? rpw_corridor_avg_200 : SMART_GLOBAL_AVG_PCT;
  const benchmark_500 = (rpw_corridor_avg_500 !== null) ? rpw_corridor_avg_500 : SMART_GLOBAL_AVG_PCT;

  // Use appropriate benchmark
  const rpw_benchmark_pct = send_amount <= 350 ? benchmark_200 : benchmark_500;
  const vs_rpw_benchmark  = _round4(total_cost_pct - rpw_benchmark_pct);
  const vs_sdg_target     = _round4(total_cost_pct - SDG_TARGET_PCT);
  const meets_sdg_target  = total_cost_pct <= SDG_TARGET_PCT;
  const vs_smart_avg      = _round4(total_cost_pct - SMART_GLOBAL_AVG_PCT);

  // Cost at $200 and $500 benchmark amounts (absolute USD savings)
  const cost_at_200_usd   = send_amount > 0 ? _round2((total_cost_pct / 100) * 200) : null;
  const cost_at_500_usd   = send_amount > 0 ? _round2((total_cost_pct / 100) * 500) : null;

  return {
    corridor: corridor_key,
    from_country,
    to_country,
    service_name,
    send_amount,
    fee_pct,
    fx_margin_pct,
    total_cost_pct,
    rpw_benchmark_pct,
    rpw_corridor_avg_200,
    rpw_corridor_avg_500,
    rpw_service_count,
    smart_global_avg_pct: SMART_GLOBAL_AVG_PCT,
    vs_rpw_benchmark,
    vs_smart_avg,
    vs_sdg_target,
    meets_sdg_target,
    sdg_target_pct: SDG_TARGET_PCT,
    cost_at_200_usd,
    cost_at_500_usd,
    // Disambiguation note in output_payload for agent findability
    disambiguation: 'compare_corridor_cost uses World Bank RPW cross-corridor cost benchmarking (fee % + FX margin %). For Arc Protocol CPN-specific economics use model_arc_cpn_economics. For Tempo Network protocol economics use model_tempo_payment_economics. For x402 protocol settlement use model_x402_settlement. For stablecoin corridor all-in economics (on-ramp+chain+off-ramp+float) use model_stablecoin_corridor_economics.',
    table_version:    TABLE_VERSION,
    table_source:     TABLE_SOURCE,
    regulatory_basis: 'World Bank RPW methodology (fee_pct + fx_margin_pct vs mid-market reference); SDG 10.c <=3% target (UN 2030 Agenda); SmaRT corridor average (RPW Q1 2026 global mean 6.36%)',
    pii_note: 'ZERO PII: amounts, rates, corridor codes only. No sender or recipient data enters this kernel.'
  };
}

function _finite(v, def) {
  const n = Number(v);
  return (isFinite(n) && !isNaN(n)) ? n : def;
}

function _round4(v) { return Math.round(v * 10000) / 10000; }
function _round2(v) { return Math.round(v * 100) / 100; }

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const output_payload = compute(pp);
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
    compliance_flags: [],
    compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
