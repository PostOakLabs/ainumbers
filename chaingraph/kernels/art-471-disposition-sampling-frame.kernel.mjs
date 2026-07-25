import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-471-disposition-sampling-frame';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'plan_aml_disposition_sample',
  mandate_type: 'compliance_control', gpu: false,
};

// AML consent-order disposition-sampling-frame kernel (art-471). Builds a deterministic
// sampling frame over historical alert dispositions for independent-validator review, plus
// a reviewer workload allocation.
//
// The statistical core below (sample size, deterministic interval selection over a
// caller-declared population hash) is the SAME calculation as the shipped
// art-458-attribute-sampling-plan kernel -- the identical zero-EDR Poisson formula,
// expansion factor, kill-criteria full-census fallback, and hash-folding interval selection
// (systematic sampling, no randomness, fully replayable by an independent reviewer from the
// same declared inputs). It is reproduced here rather than imported because every kernel in
// this suite ships as a single self-contained file (required by the §24 VM<->worker parity
// harness, which evaluates each kernel in isolation and cannot resolve cross-kernel ESM
// imports) -- this node adds only the AML-specific layer on top: labeling the frame as a
// disposition sample, and deterministically fanning the selected indices out across a
// caller-declared reviewer roster (round-robin over the selection order, not the raw index)
// so workload is evenly and reproducibly split.
//
// Deterministic only -- no randomness, no clock, no network. Zero PII (indices/hashes only).

const VALID_CONFIDENCE = new Set([90, 95, 99]);

function s(v) { return String(v == null ? '' : v).trim(); }
function n(v, d) { const x = Number(v); return Number.isFinite(x) ? x : d; }

// Deterministic string -> non-negative integer fold (NOT cryptographic -- purely a
// reproducible selection offset derived from the caller-declared population_hash),
// identical convention to art-458-attribute-sampling-plan.
function foldHashToOffset(hashStr, interval) {
  let acc = 0;
  const str = s(hashStr);
  for (let i = 0; i < str.length; i++) acc = (acc * 31 + str.charCodeAt(i)) >>> 0;
  return interval > 0 ? acc % interval : 0;
}

// Identical statistical core to art-458-attribute-sampling-plan's compute(): zero-EDR
// Poisson attribute-sampling formula with expansion factor, kill-criteria guard.
function attributeSamplingPlan(pp) {
  pp = pp || {};
  const confidence_level = VALID_CONFIDENCE.has(n(pp.confidence_level, 95)) ? n(pp.confidence_level, 95) : 95;
  const population_size = Math.max(1, Math.trunc(n(pp.population_size, 1)));
  const tolerable_deviation_rate = Math.min(100, Math.max(0, n(pp.tolerable_deviation_rate, 5)));
  const expected_deviation_rate = Math.min(100, Math.max(0, n(pp.expected_deviation_rate, 0)));
  const population_hash = s(pp.population_hash);

  const alpha = 1 - confidence_level / 100;
  const tdr = tolerable_deviation_rate / 100;
  const edr = expected_deviation_rate / 100;
  const compliance_flags = ['SAMPLE_PLAN_CALCULATED'];

  let sample_size, method, expansion_factor = null;
  const indefensible = tdr <= edr;
  if (indefensible) {
    sample_size = population_size;
    method = 'full_census_fallback';
    compliance_flags.push('SAMPLE_PLAN_INDEFENSIBLE_FULL_CENSUS');
  } else {
    const baseN = Math.log(alpha) / Math.log(1 - tdr);
    expansion_factor = edr > 0 ? 1 / (1 - edr / tdr) : 1;
    const raw = Math.ceil(baseN * expansion_factor);
    sample_size = Math.max(1, Math.min(population_size, raw));
    method = 'poisson_attribute_sampling';
    if (edr === 0) compliance_flags.push('ZERO_EXPECTED_DEVIATION');
    if (raw > population_size) compliance_flags.push('SAMPLE_SIZE_CAPPED_TO_POPULATION');
  }

  const interval = Math.max(1, Math.floor(population_size / sample_size));
  const start_offset = population_size > 0 ? foldHashToOffset(population_hash, interval) : 0;
  const selected_indices = [];
  const seen = new Set();
  for (let i = 0; i < sample_size; i++) {
    const idx = Math.min(population_size - 1, start_offset + i * interval);
    if (!seen.has(idx)) { seen.add(idx); selected_indices.push(idx); }
  }

  return {
    output_payload: {
      confidence_level,
      population_size,
      tolerable_deviation_rate,
      expected_deviation_rate,
      population_hash: population_hash || null,
      method,
      expansion_factor,
      sample_size,
      interval,
      start_offset,
      selected_indices,
    },
    compliance_flags,
  };
}

export function compute(pp) {
  pp = pp || {};
  const reviewer_roster_in = Array.isArray(pp.reviewer_roster) ? pp.reviewer_roster.map(s).filter(Boolean) : [];
  const reviewer_roster = reviewer_roster_in.length > 0 ? reviewer_roster_in : ['reviewer_1'];

  // Same policy inputs + population_hash convention as art-458; population here is the
  // historical disposition set in scope for this lookback cycle.
  const plan = attributeSamplingPlan({
    confidence_level: pp.confidence_level,
    population_size: pp.disposition_population_size ?? pp.population_size,
    tolerable_deviation_rate: pp.tolerable_deviation_rate,
    expected_deviation_rate: pp.expected_deviation_rate,
    population_hash: pp.disposition_population_hash ?? pp.population_hash,
  });

  const selected_indices = plan.output_payload.selected_indices;
  const reviewer_workload = reviewer_roster.map((reviewer_id) => ({ reviewer_id, disposition_indices: [] }));
  selected_indices.forEach((idx, i) => {
    reviewer_workload[i % reviewer_roster.length].disposition_indices.push(idx);
  });

  const compliance_flags = ['DISPOSITION_SAMPLING_FRAME_BUILT', ...plan.compliance_flags];

  return {
    output_payload: {
      disposition_population_size: plan.output_payload.population_size,
      disposition_population_hash: plan.output_payload.population_hash,
      method: plan.output_payload.method,
      confidence_level: plan.output_payload.confidence_level,
      tolerable_deviation_rate: plan.output_payload.tolerable_deviation_rate,
      expected_deviation_rate: plan.output_payload.expected_deviation_rate,
      expansion_factor: plan.output_payload.expansion_factor,
      sample_size: plan.output_payload.sample_size,
      interval: plan.output_payload.interval,
      start_offset: plan.output_payload.start_offset,
      selected_indices,
      reviewer_roster,
      reviewer_workload,
    },
    compliance_flags,
  };
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
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
