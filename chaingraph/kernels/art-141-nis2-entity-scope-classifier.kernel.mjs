import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-141-nis2-entity-scope-classifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'classify_nis2_entity',
  mandate_type: 'compliance_mandate', gpu: false,
};

// NIS2 Directive 2022/2555 Annex I (essential) / Annex II (important) sector lookup tables.
// Automatic-essential carve-outs take priority over size thresholds (Art. 3(1) last para).
const ANNEX_I = new Set([
  'energy', 'transport', 'banking', 'financial_market_infrastructure',
  'health', 'drinking_water', 'wastewater', 'digital_infrastructure',
  'public_administration', 'space',
]);
const ANNEX_II = new Set([
  'postal_courier', 'waste_management', 'manufacturing_critical',
  'food_production', 'chemicals', 'digital_services', 'research',
]);

export function compute(pp) {
  const {
    sector_code = '',
    employee_count = 0,
    annual_turnover_eur = 0,
    is_dns_provider = false,
    is_qualified_trust_service_provider = false,
    is_public_electronic_comms_network = false,
  } = pp;

  const emp = Number(employee_count);
  const turnover = Number(annual_turnover_eur);
  const safe_emp = (Number.isFinite(emp) && emp >= 0) ? Math.floor(emp) : 0;
  const safe_turnover = (Number.isFinite(turnover) && turnover >= 0) ? turnover : 0;

  const automatic_essential = !!(is_dns_provider || is_qualified_trust_service_provider || is_public_electronic_comms_network);

  let entity_classification = 'out_of_scope';
  let classification_basis = 'no_applicable_sector_or_size';
  let annex = 'none';
  const applicable_penalties = { art21_max_eur: 0, art21_pct_turnover: 0 };

  if (automatic_essential) {
    entity_classification = 'essential';
    classification_basis = 'automatic_essential_carve_out';
    annex = 'I';
  } else if (ANNEX_I.has(sector_code)) {
    const is_large = safe_emp >= 250 || safe_turnover >= 50_000_000;
    const is_medium = (safe_emp >= 50 && safe_emp < 250) || (safe_turnover >= 10_000_000 && safe_turnover < 50_000_000);
    if (is_large) {
      entity_classification = 'essential';
      classification_basis = 'annex_i_large_enterprise';
      annex = 'I';
    } else if (is_medium) {
      entity_classification = 'important';
      classification_basis = 'annex_i_medium_enterprise';
      annex = 'I';
    }
    // micro/small Annex I = out_of_scope (no NIS2 obligations)
  } else if (ANNEX_II.has(sector_code)) {
    const qualifies = safe_emp >= 50 || safe_turnover >= 10_000_000;
    if (qualifies) {
      entity_classification = 'important';
      classification_basis = 'annex_ii_medium_or_large';
      annex = 'II';
    }
  }

  if (entity_classification === 'essential') {
    applicable_penalties.art21_max_eur = 10_000_000;
    applicable_penalties.art21_pct_turnover = 0.02;
  } else if (entity_classification === 'important') {
    applicable_penalties.art21_max_eur = 7_000_000;
    applicable_penalties.art21_pct_turnover = 0.014;
  }

  const compliance_flags = [];
  compliance_flags.push('NIS2_SCOPE_ASSESSED');
  if (entity_classification === 'essential') compliance_flags.push('NIS2_ESSENTIAL_ENTITY');
  else if (entity_classification === 'important') compliance_flags.push('NIS2_IMPORTANT_ENTITY');
  else compliance_flags.push('NIS2_OUT_OF_SCOPE');
  if (automatic_essential) compliance_flags.push('NIS2_AUTOMATIC_ESSENTIAL');

  const output_payload = {
    entity_classification, classification_basis, annex,
    automatic_essential, applicable_penalties,
    sector_code, employee_count: safe_emp, annual_turnover_eur: safe_turnover,
  };
  return { output_payload, compliance_flags };
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
