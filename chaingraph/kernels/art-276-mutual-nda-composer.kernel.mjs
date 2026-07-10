import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-276-mutual-nda-composer';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'assemble_mutual_nda',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Assembles a Common Paper Mutual NDA (v1.0, CC BY 4.0) from Cover Page Key Terms.
// The Standard Terms body below is the VENDORED, IMMUTABLE fixed body (§3.3) —
// never modified, never spliced. Only the Cover Page varies with user input.
// Party identity, signatures, and notice addresses are EXCLUDED (zero-PII) and
// stay as literal placeholder tokens for the user's own off-platform e-sign flow.
// Not legal advice. Assembly + variable extraction only, never bespoke drafting.

const TEMPLATE_ID = 'common-paper-mnda-v1.0';
const SOURCE_URL = 'https://commonpaper.com/standards/mutual-nda/1.0';
const LICENSE = 'CC-BY-4.0';
const ATTRIBUTION = 'Common Paper Mutual Non-Disclosure Agreement, Version 1.0, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)';
// Precomputed SHA-256 of chaingraph/templates/common-paper-mnda/body.md as vendored.
// Recomputed + checked at build time by scripts/check-template-integrity.mjs; a
// mismatch there means the body drifted from the recorded provenance and MUST fail.
const BODY_SHA256 = '51accb97035821280371ff3088871e3866927ef0ce60e64ed5244883f11b6cfe';

// Vendored verbatim — Common Paper Mutual NDA Standard Terms v1.0 (CC BY 4.0).
// NEVER edit this text. Any customization lives in the Cover Page above it.
const BODY_MD = `# Standard Terms

1. **Introduction**. This Mutual Non-Disclosure Agreement (which incorporates these Standard Terms and the Cover Page (defined below)) (“**MNDA**”) allows each party (“**Disclosing Party**”) to disclose or make available information in connection with the <span class="coverpage_link">Purpose</span> which (1) the Disclosing Party identifies to the receiving party (“**Receiving Party**”) as “confidential”, “proprietary”, or the like or (2) should be reasonably understood as confidential or proprietary due to its nature and the circumstances of its disclosure (“**Confidential Information**”). Each party’s Confidential Information also includes the existence and status of the parties’ discussions and information on the Cover Page. Confidential Information includes technical or business information, product designs or roadmaps, requirements, pricing, security and compliance documentation, technology, inventions and know-how. To use this MNDA, the parties must complete and sign a cover page incorporating these Standard Terms (“**Cover Page**”). Each party is identified on the Cover Page and capitalized terms have the meanings given herein or on the Cover Page.

2. **Use and Protection of Confidential Information**. The Receiving Party shall: (a) use Confidential Information solely for the <span class="coverpage_link">Purpose</span>; (b) not disclose Confidential Information to third parties without the Disclosing Party’s prior written approval, except that the Receiving Party may disclose Confidential Information to its employees, agents, advisors, contractors and other representatives having a reasonable need to know for the <span class="coverpage_link">Purpose</span>, provided these representatives are bound by confidentiality obligations no less protective of the Disclosing Party than the applicable terms in this MNDA and the Receiving Party remains responsible for their compliance with this MNDA; and (c) protect Confidential Information using at least the same protections the Receiving Party uses for its own similar information but no less than a reasonable standard of care.

3. **Exceptions**. The Receiving Party’s obligations in this MNDA do not apply to information that it can demonstrate: (a) is or becomes publicly available through no fault of the Receiving Party; (b) it rightfully knew or possessed prior to receipt from the Disclosing Party without confidentiality restrictions; (c) it rightfully obtained from a third party without confidentiality restrictions; or (d) it independently developed without using or referencing the Confidential Information.

4. **Disclosures Required by Law**. The Receiving Party may disclose Confidential Information to the extent required by law, regulation or regulatory authority, subpoena or court order, provided (to the extent legally permitted) it provides the Disclosing Party reasonable advance notice of the required disclosure and reasonably cooperates, at the Disclosing Party’s expense, with the Disclosing Party’s efforts to obtain confidential treatment for the Confidential Information.

5. **Term and Termination**. This MNDA commences on the <span class="coverpage_link">Effective Date</span> and expires at the end of the <span class="coverpage_link">MNDA Term</span>. Either party may terminate this MNDA for any or no reason upon written notice to the other party. The Receiving Party’s obligations relating to Confidential Information will survive for the <span class="coverpage_link">Term of Confidentiality</span>, despite any expiration or termination of this MNDA.

6. **Return or Destruction of Confidential Information**. Upon expiration or termination of this MNDA or upon the Disclosing Party’s earlier request, the Receiving Party will: (a) cease using Confidential Information; (b) promptly after the Disclosing Party’s written request, destroy all Confidential Information in the Receiving Party’s possession or control or return it to the Disclosing Party; and (c) if requested by the Disclosing Party, confirm its compliance with these obligations in writing. As an exception to subsection (b), the Receiving Party may retain Confidential Information in accordance with its standard backup or record retention policies or as required by law, but the terms of this MNDA will continue to apply to the retained Confidential Information.

7. **Proprietary Rights**. The Disclosing Party retains all of its intellectual property and other rights in its Confidential Information and its disclosure to the Receiving Party grants no license under such rights.

8. **Disclaimer**. ALL CONFIDENTIAL INFORMATION IS PROVIDED “AS IS”, WITH ALL FAULTS, AND WITHOUT WARRANTIES, INCLUDING THE IMPLIED WARRANTIES OF TITLE, MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.

9. **Governing Law and Jurisdiction**. This MNDA and all matters relating hereto are governed by, and construed in accordance with, the laws of the State of <span class="coverpage_link">Governing Law</span>, without regard to the conflict of laws provisions of such <span class="coverpage_link">Governing Law</span>. Any legal suit, action, or proceeding relating to this MNDA must be instituted in the federal or state courts located in <span class="coverpage_link">Jurisdiction</span>. Each party irrevocably submits to the exclusive jurisdiction of such <span class="coverpage_link">Jurisdiction</span> in any such suit, action, or proceeding.

10. **Equitable Relief**. A breach of this MNDA may cause irreparable harm for which monetary damages are an insufficient remedy. Upon a breach of this MNDA, the Disclosing Party is entitled to seek appropriate equitable relief, including an injunction, in addition to its other remedies.

11. **General**. Neither party has an obligation under this MNDA to disclose Confidential Information to the other or proceed with any proposed transaction. Neither party may assign this MNDA without the prior written consent of the other party, except that either party may assign this MNDA in connection with a merger, reorganization, acquisition or other transfer of all or substantially all its assets or voting securities. Any assignment in violation of this Section is null and void. This MNDA will bind and inure to the benefit of each party’s permitted successors and assigns. Waivers must be signed by the waiving party’s authorized representative and cannot be implied from conduct. If any provision of this MNDA is held unenforceable, it will be limited to the minimum extent necessary so the rest of this MNDA remains in effect. This MNDA (including the Cover Page) constitutes the entire agreement of the parties with respect to its subject matter, and supersedes all prior and contemporaneous understandings, agreements, representations, and warranties, whether written or oral, regarding such subject matter. This MNDA may only be amended, modified, waived, or supplemented by an agreement in writing signed by both parties. Notices, requests and approvals under this MNDA must be sent in writing to the email or postal addresses on the Cover Page and are deemed delivered on receipt. This MNDA may be executed in counterparts, including electronic copies, each of which is deemed an original and which together form the same agreement.

Common Paper Mutual Non-Disclosure Agreement [Version 1.0](https://commonpaper.com/standards/mutual-nda/1.0/) free to use under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).`;

function _str(v) { return typeof v === 'string' ? v : ''; }

export function compute(pp) {
  pp = pp || {};
  const checks = [];

  const purpose = _str(pp.purpose).trim();
  const effective_date = _str(pp.effective_date).trim();
  const mnda_term_mode = _str(pp.mnda_term_mode).trim();
  const confidentiality_term_mode = _str(pp.confidentiality_term_mode).trim();
  const governing_law = _str(pp.governing_law).trim();
  const jurisdiction = _str(pp.jurisdiction).trim();
  const modifications = _str(pp.modifications).trim() || 'None.';
  const mnda_term_years = typeof pp.mnda_term_years === 'number' ? pp.mnda_term_years : null;
  const confidentiality_term_years = typeof pp.confidentiality_term_years === 'number' ? pp.confidentiality_term_years : null;

  const required = { purpose, effective_date, mnda_term_mode, confidentiality_term_mode, governing_law, jurisdiction };
  const missing = Object.keys(required).filter(k => !required[k]);
  checks.push({ check: 'required_fields_present', pass: missing.length === 0,
    detail: missing.length === 0 ? 'All required Key Terms present' : 'Missing required Key Terms: ' + missing.join(', ') });

  const termModeValid = mnda_term_mode === 'expires_after_period' || mnda_term_mode === 'continues_until_terminated';
  checks.push({ check: 'mnda_term_mode_valid', pass: termModeValid, detail: termModeValid ? mnda_term_mode : 'invalid mnda_term_mode: ' + mnda_term_mode });

  const confModeValid = confidentiality_term_mode === 'fixed_period' || confidentiality_term_mode === 'perpetuity';
  checks.push({ check: 'confidentiality_term_mode_valid', pass: confModeValid, detail: confModeValid ? confidentiality_term_mode : 'invalid confidentiality_term_mode: ' + confidentiality_term_mode });

  const termYearsOk = mnda_term_mode !== 'expires_after_period' || (typeof mnda_term_years === 'number' && mnda_term_years > 0);
  checks.push({ check: 'mnda_term_years_present_if_needed', pass: termYearsOk,
    detail: termYearsOk ? 'ok' : 'mnda_term_years required and > 0 when mnda_term_mode is expires_after_period' });

  const confYearsOk = confidentiality_term_mode !== 'fixed_period' || (typeof confidentiality_term_years === 'number' && confidentiality_term_years > 0);
  checks.push({ check: 'confidentiality_term_years_present_if_needed', pass: confYearsOk,
    detail: confYearsOk ? 'ok' : 'confidentiality_term_years required and > 0 when confidentiality_term_mode is fixed_period' });

  const allValid = checks.every(c => c.pass);

  const mndaTermLine = mnda_term_mode === 'expires_after_period'
    ? 'Expires ' + (mnda_term_years ?? '[N]') + ' year(s) from Effective Date.'
    : 'Continues until terminated in accordance with the terms of the MNDA.';
  const confTermLine = confidentiality_term_mode === 'fixed_period'
    ? (confidentiality_term_years ?? '[N]') + ' year(s) from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws.'
    : 'In perpetuity.';

  const variable_map = {
    purpose, effective_date, mnda_term_mode, mnda_term_years,
    confidentiality_term_mode, confidentiality_term_years,
    governing_law, jurisdiction, modifications,
  };

  const cover_page_markdown = allValid ? [
    '# Mutual Non-Disclosure Agreement',
    '',
    'This Mutual Non-Disclosure Agreement (the "MNDA") consists of: (1) this Cover Page and (2) the Common Paper Mutual NDA Standard Terms Version 1.0 identical to those posted at ' + SOURCE_URL + '. Any modifications of the Standard Terms should be made on this Cover Page, which will control over conflicts with the Standard Terms.',
    '',
    '### Purpose',
    purpose || '[not provided]',
    '',
    '### Effective Date',
    effective_date || '[not provided]',
    '',
    '### MNDA Term',
    mndaTermLine,
    '',
    '### Term of Confidentiality',
    confTermLine,
    '',
    '### Governing Law & Jurisdiction',
    'Governing Law: ' + (governing_law || '[not provided]'),
    'Jurisdiction: ' + (jurisdiction || '[not provided]'),
    '',
    '### MNDA Modifications',
    modifications,
    '',
    'By signing this Cover Page, each party agrees to enter into this MNDA as of the Effective Date.',
    '',
    '| | PARTY 1 | PARTY 2 |',
    '|---|---|---|',
    '| Signature | {{party_a_signature}} | {{party_b_signature}} |',
    '| Print Name | {{party_a_print_name}} | {{party_b_print_name}} |',
    '| Title | {{party_a_title}} | {{party_b_title}} |',
    '| Company | {{party_a_legal_name}} | {{party_b_legal_name}} |',
    '| Notice Address | {{party_a_notice_address}} | {{party_b_notice_address}} |',
    '| Date | {{party_a_signed_date}} | {{party_b_signed_date}} |',
    '',
    'Common Paper Mutual Non-Disclosure Agreement (Version 1.0) free to use under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).',
  ].join('\n') : null;

  const assembled_markdown = cover_page_markdown ? cover_page_markdown + '\n\n---\n\n' + BODY_MD : null;

  const contract_api = {
    template_id: TEMPLATE_ID,
    body_sha256: BODY_SHA256,
    variable_map,
    selected_clause_ids: [],
    attribution: ATTRIBUTION,
  };

  const output_payload = {
    template_id: TEMPLATE_ID,
    source_url: SOURCE_URL,
    license: LICENSE,
    attribution: ATTRIBUTION,
    body_sha256: BODY_SHA256,
    checks,
    cover_page_markdown,
    assembled_markdown,
    contract_api,
    zero_pii_notice: 'Party identity, signatures, and notice addresses are never filled by this tool and remain literal {{placeholder}} tokens for your own off-platform e-sign flow.',
    disclaimer: 'Not legal advice. This tool assembles a fixed, vendored Standard Terms body with your Cover Page Key Terms; it does not draft, modify, or advise on the agreement. Consult a licensed attorney for your jurisdiction.',
  };

  const compliance_flags = ['AGREEMENT_TEMPLATE_ASSEMBLED', 'FIXED_BODY_VERBATIM', 'ZERO_PII_COVER_PAGE_ONLY', 'NOT_LEGAL_ADVICE'];
  if (!allValid) compliance_flags.push('KEY_TERMS_INCOMPLETE');

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
