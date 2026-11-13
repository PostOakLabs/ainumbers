import { executionHash } from './_hash.mjs';

// 838-control-frequency-sample: from a control's frequency, a declared population and a
// caller-declared policy table, return the sample size and a deterministic selection.
// The kernel applies a table you declare. It ships no table: every row (expected population
// range and sample size per frequency) arrives in the call. A population outside the declared
// range for its frequency is FLAGGED, never silently corrected. Selection is systematic
// sampling over the caller-declared population_hash (integer fold, no randomness, no clock),
// the same method family as the attribute sampling plan node (art-458). Zero network, zero PII,
// pure function of pp.

const TOOL_ID = '838-control-frequency-sample';
const TOOL_VERSION = '1.0.0';
// Upper bound on a declared sample_size; larger plans refuse instead of allocating.
const MAX_SAMPLE_SIZE = 100000;

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'plan_control_frequency_sample',
  mandate_type: 'compliance_control', gpu: false,
};

// Strings only: any other type reads as absent, so a wrong-typed input refuses.
function s(v) { return typeof v === 'string' ? v.trim() : ''; }
function isInt(v) { return typeof v === 'number' && Number.isSafeInteger(v); }

// Deterministic string -> non-negative integer fold (not cryptographic): a reproducible
// start derived from the caller-declared population_hash.
function foldHash(hashStr) {
  let acc = 0;
  for (let i = 0; i < hashStr.length; i++) acc = (acc * 31 + hashStr.charCodeAt(i)) >>> 0;
  return acc;
}

function refused(pp, reasons) {
  const flags = reasons.length > 0 ? ['INPUT_REFUSED'] : [];
  return {
    output_payload: {
      outcome: 'refused',
      refusal_reasons: reasons,
      control_frequency: s(pp.control_frequency) || null,
      population_size: isInt(pp.population_size) ? pp.population_size : null,
      period_days: isInt(pp.period_days) ? pp.period_days : null,
      frequency_row: null,
      sample_size: null,
      within_expected_range: null,
      start_offset: null,
      selected_indices: [],
      warnings: flags.slice(),
    },
    compliance_flags: flags,
  };
}

export function compute(pp) {
  pp = pp || {};
  const reasons = [];
  const frequency = s(pp.control_frequency);
  const population_hash = s(pp.population_hash);

  if (frequency === '') reasons.push('CONTROL_FREQUENCY_MISSING');
  if (!isInt(pp.population_size) || pp.population_size < 1) reasons.push('POPULATION_SIZE_INVALID');
  if (!isInt(pp.period_days) || pp.period_days < 1) reasons.push('PERIOD_DAYS_INVALID');
  if (population_hash === '') reasons.push('POPULATION_HASH_MISSING');

  const table = pp.policy_table;
  let row = null;
  if (!Array.isArray(table) || table.length === 0) {
    reasons.push('POLICY_TABLE_MISSING');
  } else {
    const matches = [];
    for (const r of table) {
      const rr = r == null ? {} : r;
      const valid = s(rr.frequency) !== '' && isInt(rr.min_population) && isInt(rr.max_population)
        && isInt(rr.sample_size) && rr.min_population >= 0 && rr.max_population >= rr.min_population
        && rr.sample_size >= 1;
      if (!valid) { reasons.push('POLICY_TABLE_ROW_INVALID'); break; }
      if (s(rr.frequency) === frequency) matches.push(rr);
    }
    if (!reasons.includes('POLICY_TABLE_ROW_INVALID')) {
      if (frequency !== '' && matches.length === 0) reasons.push('FREQUENCY_ROW_MISSING');
      else if (matches.length > 1) reasons.push('FREQUENCY_ROW_DUPLICATED');
      else if (matches.length === 1) row = matches[0];
    }
  }

  if (row !== null && isInt(pp.population_size) && row.sample_size > pp.population_size) {
    reasons.push('SAMPLE_SIZE_EXCEEDS_POPULATION');
  }
  if (row !== null && row.sample_size > MAX_SAMPLE_SIZE) reasons.push('SAMPLE_SIZE_EXCEEDS_LIMIT');
  if (reasons.length > 0) return refused(pp, reasons);

  const population_size = pp.population_size;
  const sample_size = row.sample_size;
  const within = population_size >= row.min_population && population_size <= row.max_population;
  // start_offset = fold(population_hash) mod population_size, in [0, population_size).
  // idx_i = floor((start_offset + i * population_size) / sample_size). Because
  // sample_size <= population_size, consecutive steps differ by at least 1 and the last index
  // is below population_size: unique, in range, no clamping, and the tail is reachable.
  // BigInt keeps the product exact for any safe-integer population.
  const start_offset = foldHash(population_hash) % population_size;
  const P = BigInt(population_size), S = BigInt(sample_size), O = BigInt(start_offset);
  const selected_indices = [];
  for (let i = 0n; i < S; i++) selected_indices.push(Number((O + i * P) / S));

  const compliance_flags = [];
  if (!within) compliance_flags.push('POPULATION_OUTSIDE_EXPECTED_RANGE');
  const warnings = compliance_flags.slice();

  return {
    output_payload: {
      outcome: 'planned',
      refusal_reasons: [],
      control_frequency: frequency,
      population_size,
      period_days: pp.period_days,
      frequency_row: {
        frequency: s(row.frequency),
        min_population: row.min_population,
        max_population: row.max_population,
        sample_size: row.sample_size,
      },
      sample_size,
      within_expected_range: within,
      start_offset,
      selected_indices,
      warnings,
    },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
