import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-268-compute-cdd-ownership-25pct';
const TOOL_VERSION = '1.0.0';

export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mandate_type: 'compliance_mandate', gpu: false };

// FinCEN CDD Rule 31 CFR 1010.230: 25% beneficial-ownership threshold for legal-entity customers.
// This kernel performs indirect-ownership multiplication through ownership tiers.
// FRAME: FinCEN CDD Rule (bank KYB customer due diligence), NOT CTA/BOI.
// The domestic CTA/BOI reporting was removed by the Mar-2025 FinCEN IFR (CTA now applies
// to foreign-reporting-companies only). This is the BANK KYB CDD rule for legal-entity customers.
// DISAMBIGUATE: compute_cdd_ownership_25pct (FinCEN CDD 25% bank KYB) vs
//   aggregate_ownership_50pct (OFAC/BIS Affiliates Rule 50% sanctions aggregation) --
//   different threshold, different regime, different purpose.
// ZERO PII: synthetic entity graphs and ownership percentages only.

function computeIndirectOwnership(entityId, naturalPersons, ownershipMap, memo, path) {
  if (memo[entityId] !== undefined) return memo[entityId];
  if (path.has(entityId)) {
    // Circular reference: return 0 to break cycle
    return 0;
  }
  path.add(entityId);

  const parents = ownershipMap[entityId] || [];
  if (parents.length === 0) {
    // Root entity: if it's a natural person, ownership stake = the proportion held
    memo[entityId] = {};
    path.delete(entityId);
    return {};
  }

  const result = {};
  for (const { parent_id, ownership_pct } of parents) {
    const fraction = ownership_pct / 100;
    if (naturalPersons.includes(parent_id)) {
      result[parent_id] = (result[parent_id] || 0) + fraction;
    } else {
      const upstream = computeIndirectOwnership(parent_id, naturalPersons, ownershipMap, memo, path);
      for (const [np, npFrac] of Object.entries(upstream)) {
        result[np] = (result[np] || 0) + npFrac * fraction;
      }
    }
  }
  memo[entityId] = result;
  path.delete(entityId);
  return result;
}

export function compute(policy_parameters) {
  const {
    ownership_tiers = [],
    natural_persons = [],
    target_entity_id = null,
  } = policy_parameters;

  const THRESHOLD = 25; // FinCEN CDD Rule 31 CFR 1010.230

  // Build ownership map: entityId -> [{parent_id, ownership_pct}]
  // ownership_tiers: [{entity_id, parent_id, ownership_pct}]
  // entity_id is the OWNED entity, parent_id is the OWNER
  const ownershipMap = {};
  for (const tier of ownership_tiers) {
    if (!ownershipMap[tier.entity_id]) ownershipMap[tier.entity_id] = [];
    ownershipMap[tier.entity_id].push({ parent_id: tier.parent_id, ownership_pct: tier.ownership_pct });
  }

  // Determine which entities to evaluate
  const allEntityIds = [...new Set(ownership_tiers.map(t => t.entity_id))];
  const entitiesToEval = target_entity_id ? [target_entity_id] : allEntityIds;

  const beneficial_owners = [];
  const below_threshold = [];

  for (const entityId of entitiesToEval) {
    const memo = {};
    const result = computeIndirectOwnership(entityId, natural_persons, ownershipMap, memo, new Set());

    for (const [np, frac] of Object.entries(result)) {
      const pct = Math.round(frac * 10000) / 100;
      if (pct >= THRESHOLD) {
        beneficial_owners.push({
          entity_id: entityId,
          natural_person_id: np,
          indirect_ownership_pct: pct,
          direct: (ownershipMap[entityId] || []).some(t => t.parent_id === np),
        });
      } else if (pct > 0) {
        below_threshold.push({
          entity_id: entityId,
          natural_person_id: np,
          indirect_ownership_pct: pct,
        });
      }
    }
  }

  const is_beneficial_owner = beneficial_owners.length > 0;

  return {
    is_beneficial_owner,
    threshold_pct: THRESHOLD,
    beneficial_owner_count: beneficial_owners.length,
    beneficial_owners,
    below_threshold_count: below_threshold.length,
    below_threshold,
    entities_evaluated: entitiesToEval.length,
    methodology: 'FinCEN CDD Rule 31 CFR 1010.230: indirect ownership multiplication through tiers; sum of fractional stakes >= 25% = beneficial owner determination for legal-entity KYB customer due diligence',
    regime_note: 'FinCEN CDD Rule bank KYB (31 CFR 1010.230) -- NOT CTA/BOI. Domestic CTA beneficial-ownership reporting removed by FinCEN IFR Mar-2025 (final rule); CTA now applies to foreign-reporting-companies only. This kernel is the 25% bank KYB threshold for legal-entity customer CDD -- distinct from aggregate_ownership_50pct (OFAC/BIS Affiliates Rule 50% sanctions ownership aggregation, different threshold and regime).',
    table_version: 'FINCEN-CDD-RULE-31CFR1010.230-2024',
    table_source: 'FinCEN CDD Rule 31 CFR 1010.230 (May 2018, effective Jul 2018): 25% beneficial-ownership threshold for legal-entity customers. FinCEN IFR Mar-2025 narrowing CTA to foreign-reporting-companies. FFIEC BSA/AML Examination Procedures 2024. ZERO PII: synthetic entity graphs only.',
    regulatory_basis: 'FinCEN CDD Rule 31 CFR 1010.230: covered financial institutions must identify beneficial owners of legal entity customers (25% threshold for equity owners). Ownership multiplication through tiers: indirect ownership stake = product of fractional ownership pcts along ownership chain. ZERO PII.',
    pii_note: 'ZERO PII: synthetic entity identifiers and ownership percentages only. No actual beneficial-owner name, SSN, EIN, address, or personal data enters this kernel. Use FINCEN system or your KYB provider for live beneficial-owner verification.',
    not_legal_advice: 'Not legal or compliance advice. FinCEN CDD Rule determinations must be made by qualified BSA officers in conjunction with your institution\'s CDD program policies and procedures.',
  };
}

export async function buildArtifact(policy_parameters, opts = {}) {
  const output_payload = compute(policy_parameters);
  const execution_hash = await executionHash(policy_parameters, output_payload);
  return {
    chaingraph_version: '0.4.0',
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    policy_parameters,
    output_payload,
    execution_hash,
  };
}
