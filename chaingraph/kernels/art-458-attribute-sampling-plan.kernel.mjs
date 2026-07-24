import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-458-attribute-sampling-plan';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'plan_attribute_sample',
  mandate_type: 'compliance_control', gpu: false,
};

// Attribute-sampling-plan kernel (SOX 404 / ICFR control testing, art-458). Computes a sample
// size from the standard zero-expected-deviation Poisson formula (AICPA attribute-sampling
// tables use this same asymptotic form): n = ceil(ln(alpha) / ln(1 - TDR)), alpha = 1 - confidence.
// A non-zero expected-deviation-rate (EDR) inflates the base size by the classic expansion
// factor 1/(1 - EDR/TDR). Confidence/TDR/EDR are policy inputs (auditor judgment), never derived.
// Item SELECTION is deterministic interval sampling over the caller-declared population_hash
// (a fixed string identifying the sorted, already-extracted population) -- the hash is folded to
// a start offset with plain integer arithmetic, never Math.random or Date. This is why the design
// note says "NO randomness": true random sampling can't be replayed by a verifier; interval
// sampling over a caller-committed population hash can be, and is still a defensible attribute-
// sampling method (systematic sampling) once TDR/EDR/confidence are transparent policy inputs.
// KILL-CRITERIA GUARD: if TDR <= EDR the statistical plan is indefensible (the formula diverges /
// gives a nonsensical or negative-margin sample) -- the kernel does NOT ship a bad plan silently;
// it reframes to a full-population census and flags SAMPLE_PLAN_INDEFENSIBLE_FULL_CENSUS, per the
// build spec's kill-criteria (reframe as sample-VERIFIER territory, never pseudo-random filler).
// NaN-safe. Zero network, zero PII.

const VALID_CONFIDENCE = new Set([90, 95, 99]);

function n(v, d) { const x = Number(v); return Number.isFinite(x) ? x : d; }
function s(v) { return String(v == null ? '' : v).trim(); }

// Deterministic string -> non-negative integer fold (NOT cryptographic -- purely a reproducible
// selection offset derived from the caller-declared population_hash, per-char sum mod interval).
function foldHashToOffset(hashStr, interval) {
  let acc = 0;
  const str = s(hashStr);
  for (let i = 0; i < str.length; i++) acc = (acc * 31 + str.charCodeAt(i)) >>> 0;
  return interval > 0 ? acc % interval : 0;
}

export function compute(pp) {
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
