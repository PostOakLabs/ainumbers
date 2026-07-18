import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-358-simulate-output-floor';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'simulate_output_floor',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Basel III finalization / 2026 reproposal output floor mechanic (BCBS d424 §V; US NPR Oct 2023 +
// 2026 reproposal): applied RWA = max(internal-model RWA, floor% x standardized RWA), floor% stepping
// up over an annual phase-in schedule. The MECHANIC is published; the phase-in years and floor
// percentages are jurisdiction-specific (and, pre-finalization, still proposed) -- this kernel takes
// the schedule AS AN INPUT from the caller's own rule text and never vendors or hardcodes a table.
// rule_status is echoed back from the caller so downstream copy can stay honest about proposed-vs-final.
//
// Pure ECMA-262 arithmetic only -- no Math.pow, no Date.now/new Date(), no Math.random.
// Dollar figures rounded to 2 decimal places.

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }
function clamp01(v) { return Math.min(1, Math.max(0, v)); }

export function compute(pp) {
  pp = pp || {};

  const internalModelRwa = Math.max(0, safeNum(pp.internal_model_rwa, 0));
  const standardizedRwa = Math.max(0, safeNum(pp.standardized_rwa, 0));
  const schedule = Array.isArray(pp.phase_in_schedule) ? pp.phase_in_schedule : [];
  const ruleStatus = pp.rule_status === 'final' ? 'final' : 'proposed';

  const compliance_flags = [];
  if (schedule.length === 0) compliance_flags.push('OUTPUTFLOOR_NO_SCHEDULE_SUPPLIED');
  if (internalModelRwa <= 0 || standardizedRwa <= 0) compliance_flags.push('OUTPUTFLOOR_NONPOSITIVE_RWA_INPUT');

  const capital_impact_path = schedule.map((entry) => {
    const year = Number.isFinite(Number(entry && entry.year)) ? Number(entry.year) : null;
    const floorPct = clamp01(safeNum(entry && entry.floor_pct, 0));
    const floorRwa = r2(floorPct * standardizedRwa);
    const appliedRwa = Math.max(internalModelRwa, floorRwa);
    const binding = floorRwa > internalModelRwa;
    const incrementalRwa = r2(appliedRwa - internalModelRwa);
    return {
      year,
      floor_pct: floorPct,
      floor_rwa: floorRwa,
      applied_rwa: r2(appliedRwa),
      binding,
      incremental_rwa: incrementalRwa,
    };
  });

  const bindingEntry = capital_impact_path.find((e) => e.binding) || null;
  const maxIncrementalRwa = capital_impact_path.reduce((m, e) => Math.max(m, e.incremental_rwa), 0);

  const output_payload = {
    capital_impact_path,
    binding_floor_year: bindingEntry ? bindingEntry.year : null,
    floor_ever_binds: capital_impact_path.some((e) => e.binding),
    max_incremental_rwa: r2(maxIncrementalRwa),
    internal_model_rwa: r2(internalModelRwa),
    standardized_rwa: r2(standardizedRwa),
    rule_status: ruleStatus,
    regulatory_basis: 'Basel III finalization output floor (BCBS d424 / 2026 US reproposal): applied RWA = max(internal-model RWA, floor% x standardized RWA).',
    note: 'Phase-in schedule (years and floor percentages) is supplied by the caller from their own jurisdiction’s finalized or proposed rule text -- this kernel applies the published floor mechanic and never vendors or hardcodes a phase-in table.',
  };

  return { output_payload, compliance_flags };
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
