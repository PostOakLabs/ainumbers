import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-524-source-arrival-freshness-register';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'register_source_arrival_freshness',
  mandate_type: 'compliance_control', gpu: false,
};

// Source-feed arrival and freshness register (art-524). Answers "did every source we were
// expecting actually arrive, and is what arrived current" for the completeness/timeliness
// pillar of data-quality control frameworks (GAO-25-107721 SS13.07, ECB RDARR Guide SS3.5(1)).
//
// ABSENCE-INSTRUMENT RULE (art-470-lookback-completeness-reconciler.kernel.mjs:12-19 applied
// here): the expected-source inventory is a caller-declared, INDEPENDENT input -- it is never
// derived from the observed-arrivals set. A register that only counts what showed up cannot
// distinguish "every source arrived" from "a whole source never arrived and nobody noticed,"
// and that blind spot is exactly what this node exists to close. If expected_sources is absent
// or empty, this is the KILL CONDITION: the node refuses to silently report on arrivals alone
// and instead emits execution_state "did_not_run".
//
// Freshness is computed only from caller-declared numeric reference points (reference_as_of,
// each source's expected_as_of, each observed arrival's observed_as_of) -- never Date/clock --
// so a run replays byte-identically from its declared inputs.
//
// Deterministic reconciliation arithmetic only -- no randomness, no clock, no network, no PII.

function s(v) { return String(v == null ? '' : v).trim(); }
function n(v) { const x = Number(v); return Number.isFinite(x) ? x : null; }

function reconcileSource(es, observedById, referenceAsOf) {
  const source_id = s(es && es.source_id);
  const expected_as_of = n(es && es.expected_as_of);
  const freshness_threshold_hours = n(es && es.freshness_threshold_hours);
  const observed = observedById.get(source_id) || null;

  const arrived = !!observed && observed.arrived !== false;

  if (!arrived) {
    return {
      source_id, expected_as_of, freshness_threshold_hours,
      arrived: false, observed_as_of: null, late: false, stale: false,
      source_status: 'missing',
    };
  }

  const observed_as_of = n(observed.observed_as_of);
  if (observed_as_of === null) {
    return {
      source_id, expected_as_of, freshness_threshold_hours,
      arrived: true, observed_as_of: null, late: false, stale: false,
      source_status: 'unknown_freshness',
    };
  }

  const late = expected_as_of !== null && observed_as_of > expected_as_of;
  const stale = referenceAsOf !== null
    && freshness_threshold_hours !== null
    && (referenceAsOf - observed_as_of) > freshness_threshold_hours;

  let source_status;
  if (late && stale) source_status = 'late_and_stale';
  else if (late) source_status = 'late';
  else if (stale) source_status = 'stale';
  else source_status = 'current';

  return {
    source_id, expected_as_of, freshness_threshold_hours,
    arrived: true, observed_as_of, late, stale, source_status,
  };
}

export function compute(pp) {
  pp = pp || {};
  const expected_sources_in = Array.isArray(pp.expected_sources) ? pp.expected_sources : [];
  const observed_arrivals_in = Array.isArray(pp.observed_arrivals) ? pp.observed_arrivals : [];
  const reference_as_of = n(pp.reference_as_of);

  // KILL CONDITION: no independently-declared expected-source inventory -- refuse to
  // degrade into reporting on the observed set alone.
  if (expected_sources_in.length === 0) {
    return {
      output_payload: {
        execution_state: 'did_not_run',
        decision: null,
        reason: 'expected_source_inventory_not_declared',
        source_count: 0,
        sources: [],
        missing_sources: [],
        late_or_stale_sources: [],
        unknown_freshness_sources: [],
      },
      compliance_flags: ['SOURCE_ARRIVAL_FRESHNESS_KILL_CONDITION_NO_EXPECTED_INVENTORY'],
    };
  }

  const observedById = new Map();
  for (const o of observed_arrivals_in) {
    const id = s(o && o.source_id);
    if (id) observedById.set(id, o);
  }

  const sources = expected_sources_in.map((es) => reconcileSource(es, observedById, reference_as_of));

  const missing_sources = sources.filter((r) => r.source_status === 'missing').map((r) => r.source_id);
  const unknown_freshness_sources = sources.filter((r) => r.source_status === 'unknown_freshness').map((r) => r.source_id);
  const late_or_stale_sources = sources
    .filter((r) => r.source_status === 'late' || r.source_status === 'stale' || r.source_status === 'late_and_stale')
    .map((r) => r.source_id);

  const compliance_flags = ['SOURCE_ARRIVAL_FRESHNESS_EVALUATED'];

  let execution_state = 'ran';
  let decision;

  if (missing_sources.length > 0) {
    // "any expected source absent" -- the register does not wait to see if the rest are
    // fine; a missing source is a reject by itself.
    decision = 'reject';
    compliance_flags.push('EXPECTED_SOURCE_MISSING');
  } else if (unknown_freshness_sources.length > 0) {
    // Arrived, but with no declared as-of -- freshness is genuinely undecidable, not
    // assumed current. This is a control-execution state (SPEC.md SS2.2), not a SS27.4
    // accountability value, so it lives in the sibling execution_state field and decision
    // is left null rather than guessed.
    execution_state = 'ran_stale';
    decision = null;
    compliance_flags.push('SOURCE_FRESHNESS_UNDECLARED');
  } else if (late_or_stale_sources.length > 0) {
    decision = 'review_required';
    compliance_flags.push('SOURCE_ARRIVAL_LATE_OR_STALE_DETECTED');
  } else {
    decision = 'auto_pass';
    compliance_flags.push('ALL_SOURCES_CURRENT');
  }

  return {
    output_payload: {
      execution_state,
      decision,
      reason: null,
      source_count: sources.length,
      sources,
      missing_sources,
      late_or_stale_sources,
      unknown_freshness_sources,
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
