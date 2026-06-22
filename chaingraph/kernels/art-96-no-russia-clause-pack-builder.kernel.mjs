/**
 * art-96-no-russia-clause-pack-builder.kernel.mjs
 * Wave 19 — No-Russia-Clause Pack Builder.
 * Generates the contractual-clause + DD-evidence checklist conformance artifact
 * for the EU 20th-package seller-liability-shift safe harbour.
 * Decision-support draft — not legal advice.
 *
 * Citations (verify before citing):
 *   EU 20th sanctions package (23 Apr 2026, Reg amending 833/2014) — Art. 12g
 *     no-Russia clause and seller liability-shift safe harbour.
 *   EU Council guidance on no-Russia clause implementation (verify current).
 *   EDUCATIONAL: clause text is a standardised draft — consult legal counsel.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-96-no-russia-clause-pack-builder';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'build_no_russia_clause_pack',
  mandate_type: 'disclosure_template',
  gpu:          false,
};

const EU_20TH_DATE = '2026-04-23';

// Standard clause templates (verify current against EU Official Journal)
const CLAUSE_TEMPLATES = {
  standard: `NO-RUSSIA CLAUSE (Standardised — EU Art. 12g, verify current text)

The Buyer and each subsequent purchaser, reseller, re-exporter or transferee hereby contractually undertake not to re-sell, re-export, transfer or otherwise make available — directly or indirectly — to any natural or legal person, entity or body in Russia or for use in Russia any of the Goods supplied under this Agreement.

The Buyer undertakes to notify the Seller immediately upon becoming aware of any actual or intended violation of the above undertaking, and to include a substantially equivalent contractual obligation in any sub-contracts for the onward supply of the Goods.

The Seller's liability for onward diversion shall be limited to the extent the Seller has exercised the documented due diligence set out in the annexed Due Diligence Checklist and has notified the competent authority in accordance with applicable EU sanctions regulations.

[GOVERNING LAW] This clause is governed by [jurisdiction] law and shall be interpreted in accordance with EU Council Regulation (EU) No 833/2014 as amended.`,

  enhanced: `NO-RUSSIA CLAUSE — ENHANCED DUE DILIGENCE (verify current text)

[RECITALS] WHEREAS the Parties acknowledge that the Goods may be subject to EU export control and sanctions regulations, including EU Council Regulation (EU) No 833/2014 as amended by the 20th sanctions package (${EU_20TH_DATE}).

[ART. 12G UNDERTAKING] The Buyer represents, warrants, and undertakes that:
  (a) It shall not directly or indirectly sell, supply, transfer, or export the Goods to or for use in Russia;
  (b) It shall insert an equivalent clause in all downstream contracts;
  (c) It shall immediately notify the Seller and the competent national authority of any breach or suspected breach of this undertaking.

[SAFE HARBOUR] Notwithstanding the above, the Seller shall not be liable for a breach by the Buyer of the undertaking in paragraph (a) if the Seller has conducted and documented the due diligence set out in Annex A (Due Diligence Checklist) and the breach was not reasonably foreseeable despite that due diligence.

[REMEDIES] The Seller reserves the right to terminate this Agreement immediately upon any breach or suspected breach of this clause.`,
};

// Evidence items per template and goods type
const STANDARD_EVIDENCE = [
  { item: 'KYC / onboarding file for immediate buyer', required: true, source: 'Internal compliance' },
  { item: 'Ultimate beneficial owner (UBO) verification', required: true, source: 'UBO register / internal' },
  { item: 'End-use certificate from buyer (signed)', required: true, source: 'Buyer declaration' },
  { item: 'Country-of-final-destination confirmation', required: true, source: 'Buyer declaration' },
  { item: 'Screening of buyer against OFAC/EU/UN/UK Sanctions Lists', required: true, source: 'Screening system' },
  { item: 'No-Russia clause executed in sales contract', required: true, source: 'Contract file' },
  { item: 'Evidence of buyer\'s downstream distribution controls', required: false, source: 'Buyer compliance statement' },
];

const ENHANCED_EVIDENCE = [
  ...STANDARD_EVIDENCE,
  { item: 'Site visit / enhanced due diligence report for high-risk counterparties', required: false, source: 'EDD report' },
  { item: 'Diversion risk assessment (transit countries / intermediaries)', required: true, source: 'Compliance analysis' },
  { item: 'Notification to competent national authority (if required)', required: false, source: 'Authority acknowledgement' },
  { item: 'Board / senior management sign-off for high-risk transactions', required: false, source: 'Approval record' },
];

function gradeCompleteness(required_met, required_total) {
  const pct = required_total > 0 ? Math.round((required_met / required_total) * 100) : 100;
  if (pct === 100) return 'A';
  if (pct >= 80)  return 'B';
  if (pct >= 60)  return 'C';
  if (pct >= 40)  return 'D';
  return 'F';
}

export function compute(pp) {
  const {
    contract = {},
  } = pp;

  const {
    goods                  = 'controlled goods',
    counterparty_jurisdiction = '',
    clause_template        = 'standard',  // standard | enhanced
    evidence_required      = [],          // caller-supplied list of evidence already held
  } = contract;

  const template_key  = clause_template === 'enhanced' ? 'enhanced' : 'standard';
  const clause_text   = CLAUSE_TEMPLATES[template_key]
    .replace(/\[jurisdiction\]/g, counterparty_jurisdiction || 'England & Wales')
    .replace(/\[goods\]/g, goods);

  const checklist = template_key === 'enhanced' ? ENHANCED_EVIDENCE : STANDARD_EVIDENCE;
  const ev_lower  = (evidence_required || []).map(e => (e || '').toLowerCase());

  // Mark each checklist item as held / missing
  const evidence_checklist = checklist.map(item => {
    const held = ev_lower.some(e => e.includes(item.item.toLowerCase().split(' ').slice(0, 3).join(' ')));
    return { ...item, status: held ? 'held' : 'missing' };
  });

  const required_items = evidence_checklist.filter(e => e.required);
  const required_met   = required_items.filter(e => e.status === 'held').length;
  const completeness_grade = gradeCompleteness(required_met, required_items.length);

  const compliance_flags = [];
  if (completeness_grade === 'F' || completeness_grade === 'D')
    compliance_flags.push('CLAUSE_INCOMPLETE');
  const missing_required = evidence_checklist.filter(e => e.required && e.status === 'missing');
  if (missing_required.length > 0)
    compliance_flags.push('EVIDENCE_GAP');

  const output_payload = {
    clause_text,
    template_used:    template_key,
    evidence_checklist,
    completeness_grade,
    required_items_met:    required_met,
    required_items_total:  required_items.length,
    missing_required_items: missing_required.map(e => e.item),
    eu_20th_note: 'EU 20th sanctions package (' + EU_20TH_DATE + ') Art. 12g mandates no-Russia clause for controlled goods. Documented due diligence enables seller liability-shift. Verify current text against EU Official Journal.',
    reference_version: '2026-06',
    note: 'DECISION-SUPPORT DRAFT. NOT LEGAL ADVICE. Clause text is a standardised template based on EU Art. 12g. Consult EU-qualified legal counsel before executing. Verify current official wording against EU Official Journal.',
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
