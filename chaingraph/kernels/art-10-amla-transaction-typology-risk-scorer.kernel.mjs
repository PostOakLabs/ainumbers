/**
 * art-10-amla-transaction-typology-risk-scorer.kernel.mjs
 * AMLA Transaction Typology Risk Scorer — pure scoring on input transaction array.
 * Pure decision kernel — no DOM, no window, no Date.now(), no Math.random().
 */

import { executionHash } from './_hash.mjs';

export const meta = {
  tool_id:      'art-10-amla-transaction-typology-risk-scorer',
  mcp_name:     'score_aml_typologies',
  mandate_type: 'risk_control',
  version:      '1.0.0',
};

const TOOL_ID = 'art-10-amla-transaction-typology-risk-scorer';
const TOOL_VERSION = '1.0.0';

// ── Typology definitions ─────────────────────────────────────────────────────
const TYPOLOGY_WEIGHTS = {
  STRUCTURING:     0.30,
  LAYERING:        0.25,
  FUNNEL:          0.20,
  ROUND_TRIP:      0.15,
  HIGH_VELOCITY:   0.05,
  TRAVEL_RULE:     0.05,
};

// ── Travel Rule threshold (FATF/MiCA) ────────────────────────────────────────
const TRAVEL_RULE_THRESHOLD = 1000; // EUR/USD

// ── Per-transaction typology scorer ─────────────────────────────────────────
function scoreTx(tx, params) {
  const {
    structuring_threshold = 10000,
    velocity_window_hours = 24,
    round_trip_window_hours = 72,
  } = params ?? {};

  let structuring = 0, layering = 0, funnel = 0, round_trip = 0,
      high_velocity = 0, travel_rule = 0;

  const amt = tx.amount ?? 0;

  // STRUCTURING: amount just below reporting threshold
  if (amt > structuring_threshold * 0.80 && amt < structuring_threshold) {
    structuring = 0.8 + (amt / structuring_threshold) * 0.2;
  } else if (amt > structuring_threshold * 0.60 && amt < structuring_threshold * 0.80) {
    structuring = 0.4;
  }

  // LAYERING: multiple intermediary hops
  const hops = tx.hops ?? tx.intermediaries ?? 0;
  if (hops >= 3) layering = Math.min(1.0, hops * 0.25);
  else if (hops >= 2) layering = 0.5;

  // FUNNEL: cross-border with multiple sources
  if (tx.cross_border && (tx.source_count ?? 1) >= 2) {
    funnel = Math.min(1.0, 0.4 + (tx.source_count - 2) * 0.2);
  }

  // ROUND_TRIP: funds return to origin
  if (tx.round_trip_detected) round_trip = 0.9;
  else if (tx.same_origin_dest) round_trip = 0.5;

  // HIGH_VELOCITY: many transactions in short window
  const txCount = tx.tx_count_in_window ?? 1;
  if (txCount >= 10) high_velocity = Math.min(1.0, txCount * 0.08);
  else if (txCount >= 5) high_velocity = 0.4;

  // TRAVEL RULE: over threshold without originator/beneficiary info
  if (amt >= TRAVEL_RULE_THRESHOLD && !(tx.originator_info && tx.beneficiary_info)) {
    travel_rule = 0.9;
  } else if (amt >= TRAVEL_RULE_THRESHOLD * 0.80 && !(tx.originator_info)) {
    travel_rule = 0.5;
  }

  // Weighted composite score
  const composite =
    structuring  * TYPOLOGY_WEIGHTS.STRUCTURING  +
    layering     * TYPOLOGY_WEIGHTS.LAYERING     +
    funnel       * TYPOLOGY_WEIGHTS.FUNNEL       +
    round_trip   * TYPOLOGY_WEIGHTS.ROUND_TRIP   +
    high_velocity * TYPOLOGY_WEIGHTS.HIGH_VELOCITY +
    travel_rule  * TYPOLOGY_WEIGHTS.TRAVEL_RULE;

  return {
    id:           tx.id,
    amount:       amt,
    composite_score: +composite.toFixed(4),
    typology_scores: { structuring, layering, funnel, round_trip, high_velocity, travel_rule },
    risk_level:   composite >= 0.7 ? 'HIGH' : composite >= 0.4 ? 'MEDIUM' : 'LOW',
    travel_rule_violation: travel_rule >= 0.9,
  };
}

// ── Account profile builder ──────────────────────────────────────────────────
function buildAccountProfiles(scored) {
  const accounts = {};
  for (const tx of scored) {
    const acct = tx.account_id ?? tx.id ?? 'unknown';
    if (!accounts[acct]) accounts[acct] = { account_id: acct, tx_count: 0, total_score: 0, max_score: 0 };
    accounts[acct].tx_count++;
    accounts[acct].total_score += tx.composite_score;
    if (tx.composite_score > accounts[acct].max_score) accounts[acct].max_score = tx.composite_score;
  }
  return Object.values(accounts).map(a => ({
    ...a,
    avg_score: +(a.total_score / a.tx_count).toFixed(4),
  })).sort((a, b) => b.max_score - a.max_score).slice(0, 10);
}

// ── Built-in scenarios ────────────────────────────────────────────────────────
const SCENARIOS = {
  structuring_example: [
    { id: 'TX001', amount: 9500,  hops: 0, cross_border: false },
    { id: 'TX002', amount: 9800,  hops: 0, cross_border: false },
    { id: 'TX003', amount: 9200,  hops: 0, cross_border: false },
  ],
  layering_example: [
    { id: 'TX001', amount: 50000, hops: 4, cross_border: true },
    { id: 'TX002', amount: 25000, hops: 3, cross_border: true, source_count: 3 },
  ],
  travel_rule_example: [
    { id: 'TX001', amount: 1500, cross_border: true, originator_info: null, beneficiary_info: null },
    { id: 'TX002', amount: 2000, cross_border: true, originator_info: null, beneficiary_info: null },
  ],
};

// ── compute ───────────────────────────────────────────────────────────────────
export function compute(pp) {
  // Accept explicit transaction array, or a named scenario, or default scenario
  let transactions = pp.transactions;
  if (!transactions || !transactions.length) {
    const scenarioName = pp.scenario ?? 'structuring_example';
    transactions = SCENARIOS[scenarioName] ?? SCENARIOS.structuring_example;
  }

  const params = {
    structuring_threshold:   pp.structuring_threshold   ?? 10000,
    velocity_window_hours:   pp.velocity_window_hours   ?? 24,
    round_trip_window_hours: pp.round_trip_window_hours ?? 72,
  };

  const scored = transactions.map(tx => scoreTx(tx, params));

  const transaction_count  = scored.length;
  const high_risk_count    = scored.filter(t => t.risk_level === 'HIGH').length;
  const medium_risk_count  = scored.filter(t => t.risk_level === 'MEDIUM').length;
  const average_score      = transaction_count > 0
    ? +(scored.reduce((s, t) => s + t.composite_score, 0) / transaction_count).toFixed(4)
    : 0;
  const max_score          = scored.reduce((m, t) => Math.max(m, t.composite_score), 0);
  const travel_rule_violations = scored.filter(t => t.travel_rule_violation).length;

  // Typology hit counts
  const typology_hit_counts = { STRUCTURING: 0, LAYERING: 0, FUNNEL: 0, ROUND_TRIP: 0, HIGH_VELOCITY: 0, TRAVEL_RULE: 0 };
  scored.forEach(t => {
    if (t.typology_scores.structuring  > 0.3) typology_hit_counts.STRUCTURING++;
    if (t.typology_scores.layering     > 0.3) typology_hit_counts.LAYERING++;
    if (t.typology_scores.funnel       > 0.3) typology_hit_counts.FUNNEL++;
    if (t.typology_scores.round_trip   > 0.3) typology_hit_counts.ROUND_TRIP++;
    if (t.typology_scores.high_velocity > 0.3) typology_hit_counts.HIGH_VELOCITY++;
    if (t.typology_scores.travel_rule  > 0.3) typology_hit_counts.TRAVEL_RULE++;
  });

  const top_risk_accounts = buildAccountProfiles(scored);

  const overall_risk = average_score >= 0.60 ? 'HIGH' : average_score >= 0.30 ? 'MEDIUM' : 'LOW';

  const compliance_flags = [];
  if (overall_risk === 'HIGH')   compliance_flags.push('AML_HIGH_RISK_PORTFOLIO');
  if (overall_risk === 'MEDIUM') compliance_flags.push('AML_MEDIUM_RISK_PORTFOLIO');
  if (overall_risk === 'LOW')    compliance_flags.push('AML_LOW_RISK_PORTFOLIO');
  if (travel_rule_violations > 0) compliance_flags.push('TRAVEL_RULE_VIOLATIONS_DETECTED');
  if (typology_hit_counts.STRUCTURING > 0) compliance_flags.push('STRUCTURING_RISK_DETECTED');

  return {
    overall_risk,
    transaction_count,
    high_risk_count,
    medium_risk_count,
    average_score,
    max_score: +max_score.toFixed(4),
    travel_rule_violations,
    typology_hit_counts,
    top_risk_accounts,
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
