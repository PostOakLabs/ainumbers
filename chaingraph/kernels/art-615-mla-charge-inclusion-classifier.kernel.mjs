import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-615-mla-charge-inclusion-classifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'classify_mla_charge_inclusion',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Closed-set lookup over 32 CFR 232.4, pinned at
// sha256:2c6abecbafe643180afee6177bca8e0d410b6e4ddf331ca807b316202fae613e (eCFR versioner API,
// retrieved 2026-08-14). Spec: research/MLA-MAPR-CLASSIFIER.spec.md.
//
// No arithmetic exists in this kernel. The $100 figure is a named literal output field, never a
// comparison: applying it against a dollar amount belongs to art-616, not here. That emptiness is
// what keeps the exhaustive-enumeration claim free of boundary-value cases.

// Charge types whose inclusion 232.4(d)(2) makes unconditional: the bona fide fee exclusion of
// (d)(1) does not reach them, so is_credit_card_account cannot flip the answer.
const ALWAYS_INCLUDED = {
  credit_insurance_premium: '32 CFR 232.4(c)(1)(i)',
  single_premium_credit_insurance_charge: '32 CFR 232.4(c)(1)(i)',
  debt_cancellation_fee: '32 CFR 232.4(c)(1)(i)',
  debt_suspension_fee: '32 CFR 232.4(c)(1)(i)',
  credit_related_ancillary_product_fee: '32 CFR 232.4(c)(1)(ii)',
};

// The three predicates the (c)(1)(iii)(B) carve-out turns on, none of which is an input to this
// node. Named rather than guessed.
const SHORT_TERM_FACTS =
  'whether the creditor is a Federal credit union or an insured depository institution, whether the ' +
  'loan is a short-term, small amount loan, and whether the application fee was charged no more than ' +
  'once in any rolling 12-month period';
const SHORT_TERM_PREDICATES =
  'the 32 CFR 232.4(c)(1)(iii)(B) carve-out turns on three facts this node does not collect: ' +
  SHORT_TERM_FACTS;

export function compute(pp) {
  const charge_type = pp.charge_type ?? null;
  const is_credit_card_account = pp.is_credit_card_account === true;
  const short_term_exception_claimed = pp.short_term_exception_claimed === true;

  let included_in_mapr = null;
  let citation = null;
  let basis = null;
  let conditional_limit_usd = null;
  let manual_review_required = false;
  let manual_review_reason = null;

  if (Object.prototype.hasOwnProperty.call(ALWAYS_INCLUDED, charge_type)) {
    included_in_mapr = true;
    citation = ALWAYS_INCLUDED[charge_type];
    basis =
      'Included in the MAPR by ' + citation + ', and 32 CFR 232.4(d)(2) names this charge as ' +
      'ineligible for the bona fide fee exclusion, so a credit card account does not change the answer.';
  } else if (charge_type === 'finance_charge') {
    included_in_mapr = true;
    citation = '32 CFR 232.4(c)(1)(iii)(A)';
    basis =
      'Finance charges associated with the consumer credit are included by 32 CFR 232.4(c)(1)(iii)(A), ' +
      'and the 232.4(d)(1) exclusion reaches only a bona fide fee other than a periodic rate, which a ' +
      'finance charge is not.';
  } else if (charge_type === 'application_fee') {
    citation = '32 CFR 232.4(c)(1)(iii)(B)';
    if (short_term_exception_claimed) {
      included_in_mapr = 'conditional';
      manual_review_required = true;
      manual_review_reason = SHORT_TERM_PREDICATES;
      basis =
        'Application fees are included by 32 CFR 232.4(c)(1)(iii)(B), but the caller claims the ' +
        'short-term small amount loan carve-out, which this closed-set lookup cannot resolve without ' +
        SHORT_TERM_FACTS + '.';
    } else {
      included_in_mapr = true;
      basis =
        'Application fees charged to a covered borrower who applies for consumer credit are included ' +
        'by 32 CFR 232.4(c)(1)(iii)(B); the short-term small amount loan carve-out is not claimed here.';
    }
  } else if (charge_type === 'participation_fee') {
    if (is_credit_card_account) {
      included_in_mapr = 'conditional';
      citation = '32 CFR 232.4(c)(1)(iii)(C); 232.4(c)(2)(ii)(B); 232.4(d)(1)';
      conditional_limit_usd = 100;
      basis =
        'A participation fee is included by 32 CFR 232.4(c)(1)(iii)(C) subject to 232.4(c)(2)(ii)(B); ' +
        'on a credit card account a bona fide participation fee may be excluded under 232.4(d)(1), and ' +
        'the $100 per annum figure named here comes from the no balance billing cycle rule of ' +
        '232.4(c)(2)(ii)(B), which by its own terms does not apply to a bona fide participation fee ' +
        'imposed under paragraph (d).';
    } else {
      included_in_mapr = true;
      citation = '32 CFR 232.4(c)(1)(iii)(C)';
      basis =
        'A participation fee is included by 32 CFR 232.4(c)(1)(iii)(C), and the bona fide fee exclusion ' +
        'of 232.4(d)(1) reaches credit card accounts only, so it cannot apply here.';
    }
  } else if (charge_type === 'other_credit_card_fee') {
    if (is_credit_card_account) {
      included_in_mapr = 'conditional';
      citation = '32 CFR 232.4(d)(1); 232.4(d)(3)';
      basis =
        'On a credit card account this fee is excludable under 32 CFR 232.4(d)(1) only to the extent it ' +
        'is a bona fide fee other than a periodic rate and is reasonable for that type of fee under the ' +
        '232.4(d)(3) like-kind and safe harbor standards, which rest on comparative market facts this ' +
        'node does not collect.';
    } else {
      included_in_mapr = false;
      citation = '32 CFR 232.4(c)(1)';
      basis =
        'This charge is not among those 32 CFR 232.4(c)(1) requires to be included, and the bona fide ' +
        'fee exclusion of 232.4(d) does not arise because it reaches credit card accounts only.';
    }
  }

  const compliance_flags = ['MLA_CHARGE_CLASSIFIED'];
  if (included_in_mapr === true) compliance_flags.push('MLA_CHARGE_INCLUDED');
  else if (included_in_mapr === false) compliance_flags.push('MLA_CHARGE_EXCLUDED');
  else if (included_in_mapr === 'conditional') compliance_flags.push('MLA_CHARGE_CONDITIONAL');
  if (Object.prototype.hasOwnProperty.call(ALWAYS_INCLUDED, charge_type)) {
    compliance_flags.push('MLA_BONA_FIDE_EXCLUSION_INAPPLICABLE');
  }
  if (manual_review_required) compliance_flags.push('MLA_MANUAL_REVIEW_REQUIRED');

  return {
    output_payload: {
      charge_type,
      is_credit_card_account,
      short_term_exception_claimed,
      included_in_mapr,
      citation,
      basis,
      conditional_limit_usd,
      manual_review_required,
      manual_review_reason,
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
