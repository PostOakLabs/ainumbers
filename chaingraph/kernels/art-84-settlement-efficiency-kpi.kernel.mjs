/**
 * art-84-settlement-efficiency-kpi.kernel.mjs
 * Wave 17 — Settlement Efficiency KPI Aggregator.
 * Aggregates batch-level settlement data into CSDR/T+1-relevant KPIs:
 * settlement rate, fail rate, CSDR penalty cost total, on-time allocation rate,
 * SSI golden-source coverage, buy-in triggered count, and fail-duration distribution.
 * Pure decision kernel — no DOM, no window, no Date.now().
 *
 * Citations (verify before citing on any page):
 *   CSDR Reg. (EU) 909/2014 Art 7 — settlement discipline KPI context.
 *   ESMA CSDR Annual Settlement Efficiency Statistics — benchmark rates.
 *   EU T+1 Industry Roadmap — ESMA T+1 high-level roadmap (30 Jun 2025).
 *   EDUCATIONAL: outputs are decision-support drafts.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-84-settlement-efficiency-kpi';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'compute_settlement_efficiency_kpi',
  mandate_type: 'model_governance',
  gpu:          false,
};

// EU-average settlement rate benchmark (ESMA CSDR annual stats — verify current edition)
const ESMA_EU_BENCHMARK_SETTLEMENT_RATE = 97.5;  // ~97.5% ESMA 2023/24 annual report

const letter = r =>
  r >= 99   ? 'A' :
  r >= 97.5 ? 'B' :
  r >= 95   ? 'C' :
  r >= 90   ? 'D' : 'F';

export function compute(pp) {
  const {
    instructions         = [],  // [{ settled:bool, fail_days, penalty_amount, on_time_allocation:bool, ssi_golden:bool, buyin_triggered:bool }]
    period_label         = 'batch',
  } = pp;

  const total = instructions.length;
  if (total === 0) {
    const output_payload = {
      period_label,
      total_instructions: 0,
      settlement_rate:    100,
      fail_rate:          0,
      settlement_grade:   'A',
      on_time_allocation_rate: 100,
      ssi_golden_coverage_pct: 100,
      total_penalty_cost:      0,
      buyin_triggered_count:   0,
      fail_duration_distribution: { '1_day': 0, '2_to_5_days': 0, '6_to_10_days': 0, 'over_10_days': 0 },
      benchmark: { esma_settlement_rate_pct: ESMA_EU_BENCHMARK_SETTLEMENT_RATE, source: 'ESMA CSDR Annual Stats (verify current edition)' },
      note: 'No instructions provided — KPIs default to 100% (zero trades).',
    };
    return { output_payload, compliance_flags: [] };
  }

  let settled_count     = 0;
  let total_penalty     = 0;
  let on_time_alloc     = 0;
  let golden_ssi        = 0;
  let buyin_triggered   = 0;
  const dur_dist        = { '1_day': 0, '2_to_5_days': 0, '6_to_10_days': 0, 'over_10_days': 0 };

  for (const inst of instructions) {
    if (inst.settled) settled_count++;
    total_penalty   += +(inst.penalty_amount ?? 0);
    if (inst.on_time_allocation) on_time_alloc++;
    if (inst.ssi_golden)         golden_ssi++;
    if (inst.buyin_triggered)    buyin_triggered++;
    const fd = +(inst.fail_days ?? 0);
    if (fd === 1)       dur_dist['1_day']++;
    else if (fd <= 5)   dur_dist['2_to_5_days']++;
    else if (fd <= 10)  dur_dist['6_to_10_days']++;
    else if (fd > 10)   dur_dist['over_10_days']++;
  }

  const settlement_rate             = +(settled_count / total * 100).toFixed(2);
  const fail_rate                   = +(100 - settlement_rate).toFixed(2);
  const on_time_allocation_rate     = +(on_time_alloc / total * 100).toFixed(1);
  const ssi_golden_coverage_pct     = +(golden_ssi    / total * 100).toFixed(1);
  const settlement_grade            = letter(settlement_rate);
  const vs_benchmark                = +(settlement_rate - ESMA_EU_BENCHMARK_SETTLEMENT_RATE).toFixed(2);

  const compliance_flags = [];
  if (settlement_rate < 95)                                  compliance_flags.push('SETTLEMENT_RATE_CRITICAL');
  else if (settlement_rate < ESMA_EU_BENCHMARK_SETTLEMENT_RATE) compliance_flags.push('SETTLEMENT_RATE_BELOW_BENCHMARK');
  if (on_time_allocation_rate < 90)                          compliance_flags.push('ON_TIME_ALLOCATION_LOW');
  if (ssi_golden_coverage_pct < 80)                          compliance_flags.push('SSI_GOLDEN_COVERAGE_LOW');
  if (buyin_triggered > 0)                                   compliance_flags.push('BUYIN_TRIGGERED');

  const output_payload = {
    period_label,
    total_instructions:       total,
    settlement_rate,
    fail_rate,
    settlement_grade,
    vs_benchmark_bps:         +(vs_benchmark * 100).toFixed(1),
    on_time_allocation_rate,
    ssi_golden_coverage_pct,
    total_penalty_cost:       +total_penalty.toFixed(2),
    buyin_triggered_count:    buyin_triggered,
    fail_duration_distribution: dur_dist,
    benchmark: {
      esma_settlement_rate_pct: ESMA_EU_BENCHMARK_SETTLEMENT_RATE,
      source: 'ESMA CSDR Annual Settlement Efficiency Statistics (verify current edition year)',
      t1_target: '≥99.5% settlement rate (T+1 industry ambition — ESMA T+1 roadmap Jun 2025)',
    },
    note: 'DECISION-SUPPORT DRAFT — KPIs are computed from the provided instruction batch. Verify ESMA benchmark settlement rate against the current edition of ESMA CSDR annual settlement efficiency statistics. T+1 target rate is an industry ambition (ESMA T+1 roadmap); no regulatory threshold set as of Jun 2026.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    compute_mode:       'server',
    mandate_type:       meta.mandate_type,
    tool_id:            TOOL_ID,
    tool_version:       TOOL_VERSION,
    generated_at:       now ?? null,
    execution_hash:     hash,
    chain:              { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:  pp,
    output_payload,
    compliance_flags,
    audit_signature:    { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
