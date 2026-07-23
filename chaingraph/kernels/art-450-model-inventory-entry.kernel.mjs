import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-450-model-inventory-entry';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'build_model_inventory_entry',
  mandate_type: 'compliance_control', gpu: false,
};

// Model-inventory-entry kernel: builds a single SR 26-2 model-inventory
// record from caller-declared attributes. Checks the required-field set
// (model name, owner, business purpose, development date), derives a
// proportionality tier (limited/moderate/high) from caller-declared
// materiality and complexity scores (0-4 each, summed 0-8), and returns
// a completeness score plus the missing-field list. No current-date math
// here by design (Date is banned in compute() for determinism) -- the
// validation-cadence check that needs "days since" lives in art-452 and
// takes an explicit as_of_date input instead of reading the clock.
// NaN-safe. Zero network, zero PII.

const REQUIRED_FIELDS = ['model_name', 'model_owner', 'business_purpose', 'development_date'];

function s(v) { return String(v == null ? '' : v).trim(); }
function n(v, d) { const x = Number(v); return Number.isFinite(x) ? x : d; }
function clamp04(v) { return Math.max(0, Math.min(4, Math.round(n(v, 0)))); }

function tierFor(sum) {
  if (sum >= 6) return 'high';
  if (sum >= 3) return 'moderate';
  return 'limited';
}

export function compute(pp) {
  pp = pp || {};
  const model_name = s(pp.model_name);
  const model_owner = s(pp.model_owner);
  const business_purpose = s(pp.business_purpose);
  const development_date = s(pp.development_date);
  const deployment_date = s(pp.deployment_date);
  const last_validation_date = s(pp.last_validation_date);
  const materiality_score = clamp04(pp.materiality_score);
  const complexity_score = clamp04(pp.complexity_score);
  const usage_scope = s(pp.usage_scope) || 'single_bu';
  const third_party_vendor = !!pp.third_party_vendor;
  const ai_ml_model = !!pp.ai_ml_model;
  const compliance_flags = [];

  const record = { model_name, model_owner, business_purpose, development_date, deployment_date, last_validation_date };
  const missing_required_fields = REQUIRED_FIELDS.filter((f) => !record[f]);
  const completeness_score = Math.round(((REQUIRED_FIELDS.length - missing_required_fields.length) / REQUIRED_FIELDS.length) * 100);

  const tier_sum = materiality_score + complexity_score;
  const tier = tierFor(tier_sum);

  compliance_flags.push('INV_ENTRY_BUILT');
  if (missing_required_fields.length > 0) compliance_flags.push('INV_MISSING_REQUIRED_FIELDS');
  if (!last_validation_date) compliance_flags.push('INV_NO_VALIDATION_DATE_ON_FILE');
  if (ai_ml_model) compliance_flags.push('INV_AI_ML_FLAGGED');
  if (tier === 'high') compliance_flags.push('INV_HIGH_TIER');

  return {
    output_payload: {
      model_name,
      tier,
      tier_sum,
      materiality_score,
      complexity_score,
      usage_scope,
      third_party_vendor,
      ai_ml_model,
      completeness_score,
      missing_required_fields,
      inventory_record: record,
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
