/**
 * art-95-circumvention-diligence-assessor.kernel.mjs
 * Wave 19 — Circumvention Diligence Assessor.
 * Scores a transaction/contract config vs the EU 20th-package no-Russia clause
 * and anti-circumvention due-diligence requirements.
 * Emits liability-allocation verdict (liability-shift where DD documented).
 *
 * Citations (verify before citing):
 *   EU Council Regulation (EU) 2024/1469 — 14th sanctions package, no-Russia clause.
 *   EU 20th sanctions package (23 Apr 2026) — first activation of anti-circumvention
 *     tool + mandatory no-Russia clause with documented-diligence safe harbour.
 *   EU CSDDD (Dir 2025/794, 2026/470) — amended due-diligence obligations.
 *   EDUCATIONAL: decision-support draft — consult legal counsel for binding advice.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-95-circumvention-diligence-assessor';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'assess_circumvention_diligence',
  mandate_type: 'compliance_mandate',
  gpu:          false,
};

// EU 20th sanctions package date (verify current)
const EU_20TH_DATE = '2026-04-23';

// Goods categories requiring no-Russia clause per EU 14th/20th packages (verify current)
const CONTROLLED_GOODS = [
  'dual_use', 'firearms', 'military_goods', 'advanced_technology',
  'aviation_parts', 'maritime_parts', 'luxury_goods', 'critical_industrial',
  'quantum_technology', 'semiconductor', 'battlefield_goods',
];

// Due-diligence evidence types and their weight
const DD_WEIGHTS = {
  kyc_counterparty:       20,  // KYC on immediate buyer
  beneficial_owner_check: 20,  // UBO verification
  end_use_certificate:    20,  // End-use certificate from buyer
  diversion_check:        15,  // Country-of-destination vs declared-end-user review
  no_russia_clause:       15,  // Clause in contract
  transaction_monitoring: 10,  // Ongoing transaction monitoring
};

const MAX_DD_SCORE = Object.values(DD_WEIGHTS).reduce((a, b) => a + b, 0);

function gradeDD(pct) {
  if (pct >= 90) return 'A';
  if (pct >= 75) return 'B';
  if (pct >= 55) return 'C';
  if (pct >= 35) return 'D';
  return 'F';
}

export function compute(pp) {
  const {
    transaction = {},
  } = pp;

  const {
    goods_category          = 'general',
    counterparty_jurisdiction = '',
    no_russia_clause        = 'absent',       // present | absent
    dd_evidence             = [],             // string[] of evidence types
  } = transaction;

  const goods_lower = goods_category.toLowerCase();
  const is_controlled_goods = CONTROLLED_GOODS.some(g => goods_lower.includes(g));

  // Score DD evidence
  let dd_score = 0;
  const dd_present = dd_evidence.map(e => e.toLowerCase());
  for (const [ev, wt] of Object.entries(DD_WEIGHTS)) {
    if (dd_present.some(d => d.includes(ev.replace(/_/g, ' ')) || d.includes(ev))) {
      dd_score += wt;
    }
  }
  // No-Russia clause adds to evidence score
  if (no_russia_clause === 'present' && !dd_present.includes('no_russia_clause')) {
    dd_score += DD_WEIGHTS.no_russia_clause;
  }
  const dd_pct        = MAX_DD_SCORE > 0 ? Math.round((dd_score / MAX_DD_SCORE) * 100) : 0;
  const diligence_grade = gradeDD(dd_pct);

  // Liability allocation
  const clause_present  = no_russia_clause === 'present';
  const dd_adequate     = dd_pct >= 75;  // documented-diligence safe harbour threshold
  let liability_allocation;
  if (!is_controlled_goods) {
    liability_allocation = 'not_applicable';
  } else if (clause_present && dd_adequate) {
    liability_allocation = 'liability_shifted_to_buyer';  // seller invoked safe harbour
  } else if (clause_present && !dd_adequate) {
    liability_allocation = 'partial_seller_liability';    // clause present but DD incomplete
  } else {
    liability_allocation = 'seller_liable';               // no clause, no safe harbour
  }

  // DD gaps
  const dd_gaps = [];
  if (!dd_present.includes('kyc') && !dd_present.includes('kyc_counterparty'))
    dd_gaps.push('KYC on immediate counterparty not documented');
  if (!dd_present.includes('beneficial') && !dd_present.includes('ubo'))
    dd_gaps.push('Ultimate beneficial owner verification not documented');
  if (!dd_present.includes('end_use') && !dd_present.includes('end use'))
    dd_gaps.push('End-use certificate from buyer not documented');
  if (!dd_present.includes('diversion') && !dd_present.includes('country'))
    dd_gaps.push('Diversion-check (destination vs declared end-user) not documented');
  if (no_russia_clause !== 'present' && is_controlled_goods)
    dd_gaps.push('No-Russia clause absent — EU 20th package requires it for controlled goods (' + EU_20TH_DATE + ')');

  // Country risk
  const cj_lower = (counterparty_jurisdiction || '').toLowerCase();
  const high_circumvention_jurisdictions = ['ae', 'tr', 'am', 'ge', 'kz', 'rs', 'in', 'hk'];
  const diversion_risk = high_circumvention_jurisdictions.some(j => cj_lower.includes(j));

  const compliance_flags = [];
  if (no_russia_clause !== 'present' && is_controlled_goods)
    compliance_flags.push('NO_RUSSIA_CLAUSE_MISSING');
  if (!dd_adequate)
    compliance_flags.push('DILIGENCE_INSUFFICIENT');
  if (diversion_risk)
    compliance_flags.push('DIVERSION_RISK');

  const output_payload = {
    diligence_grade,
    dd_score_pct: dd_pct,
    liability_allocation,
    no_russia_clause_status: no_russia_clause,
    controlled_goods_flag:   is_controlled_goods,
    dd_gaps,
    diversion_risk_flag:     diversion_risk,
    eu_20th_package_note:    'EU 20th sanctions package (' + EU_20TH_DATE + ') mandates no-Russia clause for controlled goods. Documented due diligence shifts liability to the buyer. Verify current scope against EU Official Journal.',
    key_dates: { eu_20th_package: EU_20TH_DATE },
    reference_version: '2026-06',
    note: 'DECISION-SUPPORT DRAFT. Not legal advice. Consult EU sanctions legal counsel. Verify controlled-goods categories against current EU Reg. 833/2014 as amended by the 20th package.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    compute_mode:       'server',
    mandate_type:       meta.mandate_type,
    tool_id:            TOOL_ID,
    tool_version:       TOOL_VERSION,
    generated_at:       now ?? null,
    execution_hash:     hash,
    chain:              { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:  pp,
    output_payload,
    compliance_flags,
    audit_signature:    { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
