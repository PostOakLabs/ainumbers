import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-161-vida-recapitulative-statement-migration-assessor';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'assess_vida_recapitulative_migration',
  mandate_type: 'compliance_mandate', gpu: false,
};

// ViDA replaces EC Sales Lists (ESL / recapitulative statements) with DRR. Pre-2024 domestic
// reporting regimes harmonize by 2035-01-01; all others by 2030-07-01 (ViDA Art. final).
// Terminal node of vida-digital-reporting-requirements chain (art-159→160→161). Zero network.
export function compute(pp) {
  const { regime = {} } = pp;

  const HARMONIZE_NEW = '2030-07-01';
  const HARMONIZE_LEGACY = '2035-01-01';
  const has_pre2024 = regime.pre2024_domestic === true;
  const harmonize_deadline = has_pre2024 ? HARMONIZE_LEGACY : HARMONIZE_NEW;

  const ESL_FIELDS = ['seller_vat_id', 'buyer_vat_id', 'reporting_period', 'supply_type'];
  const provided = ESL_FIELDS.filter((f) => {
    const val = regime[f];
    return typeof val === 'string' && val.trim().length > 0;
  });
  const drr_gap_fields = ESL_FIELDS.filter((f) => !provided.includes(f));
  const gap_count = drr_gap_fields.length;
  const migration_ready = gap_count === 0;

  const txn_val = Number.isFinite(Number(regime.transaction_value))
    ? Number(regime.transaction_value)
    : 0;

  const compliance_flags = { VIDA_MIGRATION_ASSESSED: true };
  if (has_pre2024) compliance_flags.VIDA_LEGACY_REGIME_HARMONIZE_2035 = true;
  else compliance_flags.VIDA_NEW_REGIME_HARMONIZE_2030 = true;
  if (migration_ready) compliance_flags.VIDA_MIGRATION_READY = true;
  else compliance_flags.VIDA_MIGRATION_GAP_IDENTIFIED = true;

  return {
    output_payload: {
      harmonize_deadline,
      pre2024_domestic: has_pre2024,
      esl_fields_assessed: ESL_FIELDS.length,
      drr_gap_fields,
      gap_count,
      migration_ready,
      transaction_value: txn_val,
    },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
