// art-562 — Compile Model Risk Lineage Pack: pure citation-bundle kernel.
//
// First entry of the model-risk lineage pack layer (MRM-LINEAGE-BUILD-SPEC.md
// §1). Compiles a model's current model-passport-lifecycle (art-450, art-451,
// art-453) and model-validation-cycle (art-488, art-489) artifacts -- cited by
// execution_hash, NEVER recomputed -- into a single BCBS 239 §II / RDARR-shaped
// bundle, so a reviewer sees one document that traces every SR 26-2 assertion
// back to the artifact that made it.
//
// HARD FENCE (receipt MUST record this, copy MUST lead with it): this pack
// cites the referenced receipts; it does not re-run the model, re-derive the
// outcome analysis, or itself opine on validation sufficiency. Each of the
// five stage references is OPTIONAL individually -- a caller may not have
// every stage yet -- and the pack reports which stages are cited and which
// are absent, never fabricating a missing one. Zero-stages-cited is a
// legitimate empty state, not an error.
//
// SR 26-2 (superseding SR 11-7, effective 2026-04-17) scope: this pack covers
// conventional quantitative models in scope under SR 26-2 only; it makes no
// claim about gen-AI or agentic-AI systems (handled by the separate AI Act /
// agent-governance surfaces this estate already ships).
//
// Corrections use the SPEC.md §1 top-level `supersedes` field (no bespoke
// status registry) -- same convention as art-557/art-558.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-562-compile-model-risk-lineage-pack';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'compile_model_risk_lineage_pack',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

// Stage order fixed for stable output shape. `canonical_tool_id` is the
// well-known upstream node this stage normally cites (informative default
// only -- a caller-supplied ref.tool_id, if present, is recorded verbatim
// since a firm may run its own build of the upstream node).
const STAGES = [
  { key: 'inventory_ref', stage: 'inventory', label: 'Model Inventory Entry', canonical_tool_id: 'art-450-model-inventory-entry' },
  { key: 'outcome_ref', stage: 'outcome_analysis', label: 'Model Outcome Analysis', canonical_tool_id: 'art-451-model-outcome-analysis' },
  { key: 'validation_status_ref', stage: 'validation_status', label: 'Model Validation Status', canonical_tool_id: 'art-453-model-validation-status' },
  { key: 'replication_ref', stage: 'replication', label: 'Model Replication Diff', canonical_tool_id: 'art-488-model-replication-diff' },
  { key: 'test_battery_ref', stage: 'test_battery', label: 'Model Test Battery', canonical_tool_id: 'art-489-model-test-battery' },
];

const NOT_PROVEN = [
  { item: 'Model-run recomputation', detail: 'This pack cites the execution_hash of each stage artifact; it never re-runs the model, never re-derives the outcome analysis or replication diff, and never re-scores the test battery.' },
  { item: 'Validation sufficiency', detail: 'This pack takes no position on whether the underlying model is fit for use. Any validation opinion belongs to the cited art-453/art-489 artifacts themselves, never to this bundle.' },
  { item: 'Referenced-artifact authenticity', detail: 'Each stage reference is a caller-supplied {tool_id, execution_hash} pair, asserted and digested into this receipt. This node performs no lookup against a live artifact store and does not itself verify that a cited hash corresponds to a real, still-valid upstream artifact.' },
  { item: 'BCBS 239 / RDARR compliance', detail: 'This pack is a citation bundle over receipts that already exist. It has no bearing on whether the underlying model is fit for use and does not itself satisfy BCBS 239 or RDARR -- those are firm-level governance obligations this document evidences pieces of, never fulfills.' },
];

function s(v) { return String(v == null ? '' : v).trim(); }

// Normalizes one stage reference: must be an object carrying a non-empty
// execution_hash to count as "supplied". tool_id is optional and, when
// absent, is not defaulted here -- the canonical_tool_id is recorded
// separately in cited_receipts so a caller-supplied override is never
// silently overwritten.
function normalizeRef(ref) {
  if (!ref || typeof ref !== 'object') return null;
  const execution_hash = s(ref.execution_hash);
  if (!execution_hash) return null;
  const tool_id = s(ref.tool_id) || null;
  return { execution_hash, tool_id };
}

/**
 * compute(pp) — pure model-risk lineage-pack citation kernel.
 * pp: {
 *   model_id: string,
 *   as_of_date: string,
 *   inventory_ref?: { execution_hash, tool_id? },
 *   outcome_ref?: { execution_hash, tool_id? },
 *   validation_status_ref?: { execution_hash, tool_id? },
 *   replication_ref?: { execution_hash, tool_id? },
 *   test_battery_ref?: { execution_hash, tool_id? },
 * }
 */
export function compute(pp) {
  pp = pp || {};
  const model_id = s(pp.model_id) || null;
  const as_of_date = s(pp.as_of_date) || null;

  let structural_error = null;
  if (!model_id) structural_error = 'model_id is required.';
  else if (!as_of_date) structural_error = 'as_of_date is required.';

  const cited_receipts = [];
  const stages_present = [];
  const stages_absent = [];

  for (const def of STAGES) {
    const ref = normalizeRef(pp[def.key]);
    if (ref) {
      stages_present.push(def.stage);
      cited_receipts.push({
        stage: def.stage,
        label: def.label,
        tool_id: ref.tool_id || def.canonical_tool_id,
        execution_hash: ref.execution_hash,
      });
    } else {
      stages_absent.push(def.stage);
    }
  }

  const stage_count_total = STAGES.length;
  const stage_count_present = stages_present.length;

  const compliance_flags = [];
  if (structural_error) {
    compliance_flags.push('MRM_PACK_STRUCTURAL_ERROR');
  } else {
    compliance_flags.push('MRM_PACK_COMPILED');
    if (stage_count_present === 0) compliance_flags.push('MRM_PACK_ZERO_STAGES_CITED');
    else if (stage_count_present === stage_count_total) compliance_flags.push('MRM_PACK_ALL_STAGES_CITED');
    else compliance_flags.push('MRM_PACK_PARTIAL_STAGES_CITED');
  }

  const output_payload = {
    model_id,
    as_of_date,
    structural_error,
    cited_receipts,
    stages_present,
    stages_absent,
    stage_count_present,
    stage_count_total,
    not_proven: NOT_PROVEN,
    fence: 'This pack cites the referenced model-passport-lifecycle and model-validation-cycle receipts by execution_hash; it does not re-run the model, re-derive the outcome analysis, or itself opine on validation sufficiency. Zero-stages-cited is a legitimate empty state, never an error. Never a coverage percentage, never a stripped citation.',
    regulatory_framework: 'SR 26-2 (Revised Guidance on Model Risk Management, effective 2026-04-17, superseding SR 11-7) scopes this pack to conventional quantitative models only; BCBS 239 §II and RDARR Guide §3.4 references are informative context only, and this pack makes no compliance claim under any of the three.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0, supersedes } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  const artifact = {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type:       meta.mandate_type,
    tool_id:             TOOL_ID,
    tool_version:        TOOL_VERSION,
    generated_at:        now ?? null,
    execution_hash:      hash,
    chain:               { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:   pp,
    output_payload,
    compliance_flags,
    compute_mode:        'server',
    compute_proof_ready: 'deferred',
    audit_signature:     { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
  if (Array.isArray(supersedes) && supersedes.length > 0) {
    artifact.supersedes = supersedes;
  }
  return artifact;
}
