/**
 * art-52-digital-trade-fit-diagnostic.kernel.mjs
 * Wave 12 — Digital Trade Corridor (MLETR) readiness diagnostic.
 * 12 questions → 6 weighted dimensions → A–F grade + routing to the right dtc-* chain.
 * Pure decision kernel — no DOM, no window, no Date.now().
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-52-digital-trade-fit-diagnostic';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'run_digital_trade_fit',
  mandate_type: 'agent_guardrail_mandate',
  gpu:          false,
};

// Each answer → a 0..4 readiness sub-score (4 = most ready / least work).
const S = {
  origin_jurisdiction: { 'mletr-adopted': 4, 'aligned': 2, 'not-adopted': 0 },
  dest_jurisdiction:   { 'mletr-adopted': 4, 'aligned': 2, 'not-adopted': 0 },
  ebl_usage:           { none: 0, pilot: 2, routine: 4 },
  doc_set_scope:       { 'bl-only': 1, 'bl+invoice': 2, 'full-set': 4 },
  ebl_platform:        { none: 0, single: 2, 'interoperable': 4 },
  api_readiness:       { none: 0, partial: 2, 'full': 4 },
  rule_basis:          { 'paper-UCP600': 0, 'eUCP': 4, 'URDTT-open-account': 4, 'mixed': 2 },
  finance_mode:        { LC: 4, 'documentary-collection': 3, 'open-account-SCF': 2, none: 0 },
  tbml_controls:       { strong: 4, adequate: 2, thin: 0 },
  party_screening:     { 'LEI+sanctions+UBO': 4, partial: 2, manual: 0 },
};

const pick = (table, val, dflt = 0) => (val in table ? table[val] : dflt);
const letter = (s) => (s >= 85 ? 'A' : s >= 70 ? 'B' : s >= 55 ? 'C' : s >= 40 ? 'D' : 'F');

const WEIGHTS = {
  legality:     0.25,
  digitisation: 0.20,
  platform:     0.15,
  rules:        0.15,
  financing:    0.15,
  aml:          0.10,
};

const ROUTE = {
  legality:     'dtc-ebl-enforceability',
  digitisation: 'dtc-doc-integrity',
  platform:     'dtc-ebl-enforceability',
  rules:        'dtc-digital-lc',
  financing:    'dtc-trade-finance',
  aml:          'dtc-counterparty-aml',
};

const REMEDIATION = {
  legality:     'Verify corridor MLETR adoption status (UNCITRAL table). Consider an MLETR-adopted governing-law choice — run dtc-ebl-enforceability.',
  digitisation: 'Upgrade from paper/single B/L to a DCSA-aligned interoperable eBL platform covering the full document set — run dtc-doc-integrity.',
  platform:     'Integrate a DCSA API/KTDDE-compliant eBL platform with interoperable routing — run dtc-ebl-enforceability.',
  rules:        'Switch from paper UCP 600 to eUCP v2.1 or URDTT v1.0; confirm electronic-record requirements with your bank — run dtc-digital-lc.',
  financing:    'Align financing mode with LC/eUCP or SCF rails that accept eBL as collateral — run dtc-trade-finance.',
  aml:          'Strengthen TBML controls and party screening (LEI + OFAC + UBO) — run dtc-counterparty-aml.',
};

export function compute(pp) {
  const {
    origin_jurisdiction = 'aligned',
    dest_jurisdiction   = 'aligned',
    ebl_usage           = 'pilot',
    doc_set_scope       = 'bl-only',
    ebl_platform        = 'none',
    api_readiness       = 'none',
    rule_basis          = 'paper-UCP600',
    finance_mode        = 'none',
    tbml_controls       = 'thin',
    party_screening     = 'manual',
    // informational only — no scoring contribution:
    counterparty_type   = 'corporate',
    annual_trade_docs   = 100,
  } = pp;

  const sub = {
    legality:     [pick(S.origin_jurisdiction, origin_jurisdiction), pick(S.dest_jurisdiction, dest_jurisdiction)],
    digitisation: [pick(S.ebl_usage, ebl_usage), pick(S.doc_set_scope, doc_set_scope)],
    platform:     [pick(S.ebl_platform, ebl_platform), pick(S.api_readiness, api_readiness)],
    rules:        [pick(S.rule_basis, rule_basis)],
    financing:    [pick(S.finance_mode, finance_mode)],
    aml:          [pick(S.tbml_controls, tbml_controls), pick(S.party_screening, party_screening)],
  };

  const dim_scores = {};
  for (const k of Object.keys(sub)) {
    const avg = sub[k].reduce((a, b) => a + b, 0) / sub[k].length; // 0..4
    dim_scores[k] = { score: +(avg / 4 * 100).toFixed(1), grade: letter(avg / 4 * 100) };
  }

  const overall = +Object.keys(WEIGHTS).reduce((acc, k) => acc + dim_scores[k].score * WEIGHTS[k], 0).toFixed(1);
  const overall_grade = letter(overall);

  // Routing: weakest dimension drives primary recommendation.
  const ranked = Object.keys(dim_scores).sort((a, b) => dim_scores[a].score - dim_scores[b].score);
  const primary_recommendation = ROUTE[ranked[0]];
  const secondary_recommendations = [];
  if (tbml_controls === 'thin') secondary_recommendations.push('dtc-tbml-surveillance');
  if (finance_mode !== 'none' && ROUTE.financing !== primary_recommendation && !secondary_recommendations.includes('dtc-trade-finance')) {
    secondary_recommendations.push('dtc-trade-finance');
  }
  if (!secondary_recommendations.includes(ROUTE[ranked[1]]) && ROUTE[ranked[1]] !== primary_recommendation) {
    secondary_recommendations.push(ROUTE[ranked[1]]);
  }
  if (!secondary_recommendations.includes('dtc-audit-pack')) {
    secondary_recommendations.push('dtc-audit-pack');
  }

  const remediation_checklist = [];
  for (const k of Object.keys(dim_scores)) {
    if (dim_scores[k].grade === 'D' || dim_scores[k].grade === 'F') {
      remediation_checklist.push({ dimension: k, grade: dim_scores[k].grade, action: REMEDIATION[k] });
    }
  }

  const compliance_flags = [];
  if (origin_jurisdiction === 'not-adopted' && dest_jurisdiction === 'not-adopted') {
    compliance_flags.push('CORRIDOR_NOT_MLETR_ENFORCEABLE');
  }
  if (rule_basis === 'paper-UCP600') compliance_flags.push('PAPER_RULE_BASIS_UCP600');
  if (tbml_controls === 'thin') compliance_flags.push('TBML_CONTROLS_THIN');
  if (overall_grade === 'D' || overall_grade === 'F') compliance_flags.push('LOW_READINESS');

  const corridor_enforceability_flag =
    (origin_jurisdiction === 'not-adopted' && dest_jurisdiction === 'not-adopted')
      ? 'CORRIDOR_NOT_MLETR_ENFORCEABLE'
      : null;

  const output_payload = {
    dim_scores,
    overall_score: overall,
    overall_grade,
    primary_recommendation,
    secondary_recommendations,
    remediation_checklist,
    corridor_enforceability_flag,
    note: 'Educational readiness diagnostic for Digital Trade / MLETR. Routes to the relevant dtc-* chain; not legal or trade-finance advice.',
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
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
