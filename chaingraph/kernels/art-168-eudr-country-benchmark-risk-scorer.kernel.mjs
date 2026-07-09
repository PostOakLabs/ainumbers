import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-168-eudr-country-benchmark-risk-scorer';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'score_eudr_country_risk',
  mandate_type: 'compliance_mandate', gpu: false,
};

// EUDR Art. 29 classifies countries (or sub-national regions) into benchmark risk tiers:
// low / standard / high — determining the required inspection rate and due-diligence intensity.
// Low-risk: 1% consignment check; simplified due diligence (Art. 13).
// Standard-risk: 3% consignment check; full due diligence (Art. 8–12).
// High-risk: 9% consignment check; enhanced due diligence (Art. 14).
// The Commission delegated act (pending full publication Jun 2026) will be the authoritative
// list; this kernel uses a structural proxy. Feeds traceability linker (art-169). Zero network.
export function compute(pp) {
  const { country_code = '' } = pp;
  const cc = typeof country_code === 'string' ? country_code.trim().toUpperCase() : '';

  // Structural proxy — replace with Commission delegated-act list when published.
  // Low-risk: EU/EEA member states + countries with comprehensive forest protection legislation.
  const LOW_RISK = new Set([
    'AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR','HU',
    'IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK', // EU-27
    'IS','LI','NO', // EEA
    'CH','GB', // Strong forest governance
  ]);

  // High-risk: countries with documented high deforestation rates in EUDR-covered commodities
  // (proxy list — authoritative list from Commission Art. 29 delegated act).
  const HIGH_RISK = new Set([
    'CD','MG','MM','LA','KH', // Central Africa / Southeast Asia high-deforestation proxy
  ]);

  let benchmark_risk;
  if (!cc || cc.length !== 2) {
    benchmark_risk = 'unknown';
  } else if (LOW_RISK.has(cc)) {
    benchmark_risk = 'low';
  } else if (HIGH_RISK.has(cc)) {
    benchmark_risk = 'high';
  } else {
    benchmark_risk = 'standard';
  }

  const INSPECTION_RATES = { low: 1, standard: 3, high: 9, unknown: 0 };
  const DUE_DILIGENCE = {
    low: 'simplified — Art. 13 EUDR (risk assessment; no mitigation measures if negligible deforestation risk)',
    standard: 'full — Arts. 8-12 EUDR (supply-chain information, risk assessment, mitigation measures)',
    high: 'enhanced — Art. 14 EUDR (full due diligence + additional consultation with competent authorities)',
    unknown: 'full (default until country classified by Commission delegated act)',
  };

  const inspection_rate_pct = Number.isFinite(INSPECTION_RATES[benchmark_risk]) ? INSPECTION_RATES[benchmark_risk] : 0;
  const due_diligence_level = DUE_DILIGENCE[benchmark_risk] ?? DUE_DILIGENCE.unknown;

  const compliance_flags = [];
  compliance_flags.push('EUDR_COUNTRY_RISK_ASSESSED');
  if (benchmark_risk === 'low') compliance_flags.push('EUDR_LOW_RISK_COUNTRY');
  else if (benchmark_risk === 'high') compliance_flags.push('EUDR_HIGH_RISK_COUNTRY');
  else compliance_flags.push('EUDR_STANDARD_RISK_COUNTRY');

  return {
    output_payload: {
      country_code: cc || null,
      benchmark_risk,
      inspection_rate_pct,
      due_diligence_level,
      commission_delegated_act_note: 'Country benchmark list subject to Commission delegated act under EUDR Art. 29 — verify against published classification before filing.',
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
