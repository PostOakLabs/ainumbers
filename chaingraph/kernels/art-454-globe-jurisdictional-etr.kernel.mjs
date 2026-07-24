import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-454-globe-jurisdictional-etr';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_globe_jurisdictional_etr',
  mandate_type: 'compliance_control', gpu: false,
};

// GloBE jurisdictional ETR kernel (OECD Pillar Two Model Rules Art 3-5,
// published/public-domain arithmetic). Pure aggregation only -- elections
// (de minimis, stock-based comp, aggregate deferred-tax adjustment) and
// deferred-tax-attribute characterization are HUMAN JUDGMENT and arrive
// here as caller-declared policy-parameter booleans; this kernel echoes
// which were declared, it never decides them. Entity-level GloBE income
// and adjusted covered taxes are likewise given as inputs (already
// book-to-tax adjusted upstream per Art 3.2/4.1-4.2) -- no re-derivation
// of those adjustments happens here.
//
// Art 3.1: net jurisdictional GloBE income/loss = sum of ALL constituent
// entities' net_income_or_loss. If that net is <= 0 the jurisdiction is in
// a GloBE loss position for the period -- no ETR is computed (would divide
// by a non-positive base) and the loss carries forward outside this kernel.
// Art 4: jurisdictional adjusted covered taxes = sum of entity covered_taxes
// (may include negative adjustments; summed as given, not re-characterized).
// ETR = adjusted covered taxes / GloBE income. Top-up % = max(0, minimum_rate
// - ETR); minimum_rate defaults to the Art 5.1 15% rate but is taken as a
// versioned policy-parameter input, never hardcoded, so a future OECD rate
// change is a caller input, not a kernel edit.
// NaN-safe. Zero network, zero PII.

function s(v) { return String(v == null ? '' : v).trim(); }
function n(v, d) { const x = Number(v); return Number.isFinite(x) ? x : d; }
function round2(v) { return Math.round(n(v, 0) * 100) / 100; }
function round6(v) { return Math.round(n(v, 0) * 1e6) / 1e6; }

export function compute(pp) {
  pp = pp || {};
  const jurisdiction_name = s(pp.jurisdiction_name) || 'Unnamed Jurisdiction';
  const minimum_rate = (() => {
    const r = Number(pp.minimum_rate);
    return Number.isFinite(r) && r >= 0 ? r : 0.15;
  })();

  const entitiesIn = Array.isArray(pp.entities) ? pp.entities : [];
  const entities = entitiesIn
    .map((e) => {
      e = e || {};
      return {
        entity_name: s(e.entity_name),
        net_income_or_loss: round2(n(e.net_income_or_loss, 0)),
        covered_taxes: round2(n(e.covered_taxes, 0)),
      };
    })
    .filter((e) => e.entity_name);

  const entity_count = entities.length;
  const net_globe_income_or_loss = round2(entities.reduce((sum, e) => sum + e.net_income_or_loss, 0));
  const adjusted_covered_taxes = round2(entities.reduce((sum, e) => sum + e.covered_taxes, 0));

  const has_globe_income = net_globe_income_or_loss > 0;
  const jurisdictional_globe_income = has_globe_income ? net_globe_income_or_loss : 0;

  let etr = null;
  let no_etr_computed = true;
  let top_up_tax_percentage = 0;

  if (has_globe_income) {
    etr = round6(adjusted_covered_taxes / jurisdictional_globe_income);
    no_etr_computed = false;
    top_up_tax_percentage = round6(Math.max(0, minimum_rate - etr));
  }

  const top_up_tax_amount = round2(jurisdictional_globe_income * top_up_tax_percentage);

  const declared_elections = {
    de_minimis_election: !!pp.de_minimis_election,
    stock_based_comp_election: !!pp.stock_based_comp_election,
    aggregate_deferred_tax_adjustment: !!pp.aggregate_deferred_tax_adjustment,
  };

  const compliance_flags = ['ETR_JURISDICTION_EVALUATED'];
  if (no_etr_computed) {
    compliance_flags.push('ETR_NO_ETR_COMPUTED_GLOBE_LOSS');
  } else if (etr < minimum_rate) {
    compliance_flags.push('ETR_BELOW_MINIMUM_TOPUP_OWED');
  } else {
    compliance_flags.push('ETR_AT_OR_ABOVE_MINIMUM');
  }
  if (declared_elections.de_minimis_election) compliance_flags.push('ETR_DE_MINIMIS_ELECTION_DECLARED');
  if (declared_elections.stock_based_comp_election) compliance_flags.push('ETR_SBC_ELECTION_DECLARED');
  if (declared_elections.aggregate_deferred_tax_adjustment) compliance_flags.push('ETR_AGGREGATE_DTA_ELECTION_DECLARED');
  if (entity_count === 0) compliance_flags.push('ETR_NO_ENTITIES_DECLARED');

  return {
    output_payload: {
      jurisdiction_name,
      entity_count,
      minimum_rate,
      net_globe_income_or_loss,
      jurisdictional_globe_income,
      adjusted_covered_taxes,
      etr,
      no_etr_computed,
      top_up_tax_percentage,
      top_up_tax_amount,
      declared_elections,
      entities,
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
