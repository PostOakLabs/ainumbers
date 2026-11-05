import { executionHash } from './_hash.mjs';

// 797-stablecoin-cash-equivalent-test — holder-side cash-equivalent classification test for a
// single declared stablecoin holding, under the FASB proposed Update of 2026-08-18
// (Statement of Cash Flows (Topic 230): Cash Equivalents—Disclosure Enhancement and
// Evaluation of Certain Digital Assets), profile `fasb_proposed_2026_08`.
//
// BEHAVIOUR ONLY (KERNEL-CITATION-CLASS-1): no paragraph numbers live in this source.
// Criterion codes emitted below map 1:1 to pinned-paragraph cites in the node shard's
// cited_clause_digest[] and on the node page; the page's Policy Mandate export joins them.
//
// What compute() does:
//   1. Validate the declared shape: profile enum, holding object, boolean declared terms.
//      Anything that is not the declared shape is REFUSED (never guessed).
//   2. Evaluate six criteria over the declared terms only, each PASS / FAIL /
//      NOT_DETERMINABLE:
//      c1_on_demand_contractual_redemption  — on-demand contractual cash redemption right
//      c2_direct_issuer_redemption_known    — direct redemption right with the issuer for a
//                                             known amount of cash (secondary-market
//                                             salability alone is never enough)
//      c3_no_significant_fees_restrictions  — no significant fees or significant restrictions
//      c4_segregated_short_term_reserves    — segregated reserve assets held by the issuer on
//                                             at least a one-to-one basis in short-term,
//                                             highly liquid assets (non-cash/crypto/gold
//                                             reserve compositions fail)
//      c5_short_term_original_maturity      — short-term: original maturity within the
//                                             declared three-month convention (90 days)
//      c6_laws_and_regulations              — relevant laws and regulations taken into
//                                             account; a declared legal prohibition fails
//   3. Classify collectively (the criteria are inherently interrelated — all must be PASS):
//      MEETS_PROPOSED_EXAMPLES | DOES_NOT_MEET | NOT_DETERMINABLE, always labelled with the
//      profile's status (proposed; comment deadline 2026-11-19).
//   4. Emit the disclosure checklist the pinned text proposes, and a Policy Mandate export
//      of the declared terms and the result.
//
// SCOPE LIMITS (enforced here by construction): the node evaluates DECLARED TERMS ONLY.
// It never says how an entity must account — presenting a qualifying asset as a cash
// equivalent is an accounting policy election, not something this node decides. It is not
// an accounting opinion. Issuer-side reserve adequacy and disclosure evidence is the job of
// other estate nodes (art-06, art-275, art-582); this node consumes no issuer evidence.

const TOOL_ID = '797-stablecoin-cash-equivalent-test';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_stablecoin_cash_equiv',
  mandate_type: 'compliance_control', gpu: false,
};

const PROFILE_FASB_PROPOSED = 'fasb_proposed_2026_08';

// Declared three-month convention: the pinned definition's three-months-or-less line,
// expressed as a declared policy constant (90 days).
const SHORT_TERM_MATURITY_DAYS_MAX = 90;

// Declared significance thresholds for the "no significant fees" test (declared policy
// parameters, defaults shown; NOT values taken from the pinned text, which deliberately
// leaves "significant" to policy judgment):
const DEFAULT_SIGNIFICANT_FEE_BP = 25;           // 0.25% per redemption
const DEFAULT_SIGNIFICANT_MIN_MINOR = 1000000;   // 10,000 whole units in minor terms

const PROFILES = [PROFILE_FASB_PROPOSED];

const REQUIRED_BOOLS = [
  'holder_has_direct_issuer_redemption',
  'redemption_on_demand',
  'redemption_amount_known',
  'gates_or_suspension_terms',
  'access_via_intermediary_only',
  'issuer_reserve_short_term_liquid_one_to_one',
];
const OPTIONAL_BOOLS = ['laws_prohibit_cash_equivalent_treatment'];
const OPTIONAL_NUMBERS = ['redemption_fees_bp', 'redemption_min_minor', 'redemption_settlement_days', 'original_maturity_days'];

const STATUS = { PASS: 'PASS', FAIL: 'FAIL', NOT_DETERMINABLE: 'NOT_DETERMINABLE' };
const CLASS_MEETS = 'MEETS_PROPOSED_EXAMPLES';
const CLASS_FAILS = 'DOES_NOT_MEET';
const CLASS_ND = 'NOT_DETERMINABLE';

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
function isBool(v) {
  return v === true || v === false;
}
function isNonNegNumber(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}
function crit(id, status, reason, input_refs) {
  return { criterion: id, status: status, reason_code: reason, input_refs: input_refs };
}
function boolTerm(holding, key) {
  // true = declared true, false = declared false, null = not determinable (absent/invalid)
  return isBool(holding[key]) ? holding[key] : null;
}

/**
 * compute(pp) — pure decision kernel over declared terms only.
 * @param {object} pp { profile, holding, policy? }
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = pp || {};
  const flags = [];

  // -- shape validation: refuse anything not the declared shape -------------------
  if (!isPlainObject(pp)) {
    flags.push('refused_input_shape');
    return { output_payload: { refused: true, refusal_reason: 'input_not_an_object' }, compliance_flags: flags };
  }
  if (!isPlainObject(pp.holding)) {
    flags.push('refused_input_shape');
    return { output_payload: { refused: true, refusal_reason: 'holding_object_missing' }, compliance_flags: flags };
  }
  if (PROFILES.indexOf(pp.profile) === -1) {
    flags.push('refused_profile_not_pinned');
    return {
      output_payload: {
        refused: true,
        refusal_reason: 'profile_not_pinned_for_this_node',
        pinned_profiles: PROFILES.slice(),
      },
      compliance_flags: flags,
    };
  }
  const holding = pp.holding;
  // A term DECLARED with an invalid type is refused; a term simply ABSENT reaches the
  // criteria as NOT_DETERMINABLE (the row contract's missing-field branch).
  for (let i = 0; i < REQUIRED_BOOLS.length; i++) {
    if (holding[REQUIRED_BOOLS[i]] !== undefined && !isBool(holding[REQUIRED_BOOLS[i]])) flags.push('refused_invalid_required_term:' + REQUIRED_BOOLS[i]);
  }
  for (let i = 0; i < OPTIONAL_NUMBERS.length; i++) {
    const k = OPTIONAL_NUMBERS[i];
    if (holding[k] !== undefined && !isNonNegNumber(holding[k])) flags.push('refused_invalid_optional_term:' + k);
  }
  if (holding.token_label !== undefined && (typeof holding.token_label !== 'string' || holding.token_label.length === 0 || holding.token_label.length > 64)) {
    flags.push('refused_invalid_optional_term:token_label');
  }
  if (flags.length > 0) {
    // Refusal branch: shape-invalid input never reaches classification.
    return {
      output_payload: {
        refused: true,
        refusal_reason: 'declared_terms_shape_invalid',
        refused_terms: flags.map(function (f) { return f.replace('refused_invalid_required_term:', '').replace('refused_invalid_optional_term:', ''); }),
      },
      compliance_flags: flags,
    };
  }

  // -- declared policy parameters (with defaults) --------------------------------
  const policy = isPlainObject(pp.policy) ? pp.policy : {};
  const sigFeeBp = isNonNegNumber(policy.significant_fees_bp) ? policy.significant_fees_bp : DEFAULT_SIGNIFICANT_FEE_BP;
  const sigMinMinor = isNonNegNumber(policy.significant_min_minor) ? policy.significant_min_minor : DEFAULT_SIGNIFICANT_MIN_MINOR;
  const shortTermMaxDays = isNonNegNumber(policy.short_term_maturity_days_max) ? policy.short_term_maturity_days_max : SHORT_TERM_MATURITY_DAYS_MAX;

  // -- criteria -------------------------------------------------------------------
  const criteria = [];

  // c1: on-demand contractual cash redemption right
  const onDemand = boolTerm(holding, 'redemption_on_demand');
  criteria.push(onDemand === null
    ? crit('c1_on_demand_contractual_redemption', STATUS.NOT_DETERMINABLE, 'on_demand_term_not_determinable', ['redemption_on_demand'])
    : crit('c1_on_demand_contractual_redemption',
        onDemand ? STATUS.PASS : STATUS.FAIL,
        onDemand ? 'on_demand_contractual_redemption_declared' : 'redemption_not_on_demand',
        ['redemption_on_demand']));

  // c2: direct redemption right with the issuer for a known amount of cash.
  // Intermediary-only access (the Case-B shape: no account with the issuer, secondary
  // markets only) fails even when market liquidity is deep — salability alone is not enough.
  const direct = boolTerm(holding, 'holder_has_direct_issuer_redemption');
  const known = boolTerm(holding, 'redemption_amount_known');
  const viaIntermediaryOnly = boolTerm(holding, 'access_via_intermediary_only');
  let c2Status; let c2Reason;
  if (direct === false || known === false || viaIntermediaryOnly === true) {
    c2Status = STATUS.FAIL;
    c2Reason = direct === false ? 'no_direct_issuer_redemption_right'
      : known === false ? 'redemption_amount_not_known'
      : 'access_via_intermediary_only_secondary_market_shape';
  } else if (direct === null || known === null || viaIntermediaryOnly === null) {
    c2Status = STATUS.NOT_DETERMINABLE;
    c2Reason = 'direct_issuer_terms_not_determinable';
  } else {
    c2Status = STATUS.PASS;
    c2Reason = 'direct_issuer_redemption_known_amount_declared';
  }
  criteria.push(crit('c2_direct_issuer_redemption_known', c2Status, c2Reason,
    ['holder_has_direct_issuer_redemption', 'redemption_amount_known', 'access_via_intermediary_only']));

  // c3: no significant fees or significant restrictions imposed
  const gates = boolTerm(holding, 'gates_or_suspension_terms');
  let c3Status; let c3Reason; const c3Refs = ['gates_or_suspension_terms'];
  if (gates === true) {
    c3Status = STATUS.FAIL; c3Reason = 'redemption_gates_or_suspension_terms_declared';
  } else if (gates === null) {
    c3Status = STATUS.NOT_DETERMINABLE; c3Reason = 'restriction_terms_not_determinable';
  } else if (holding.redemption_fees_bp !== undefined && holding.redemption_fees_bp > sigFeeBp) {
    c3Status = STATUS.FAIL; c3Reason = 'declared_redemption_fees_exceed_significance_threshold'; c3Refs.push('redemption_fees_bp');
  } else if (holding.redemption_min_minor !== undefined && holding.redemption_min_minor > sigMinMinor) {
    c3Status = STATUS.FAIL; c3Reason = 'declared_redemption_minimum_exceeds_significance_threshold'; c3Refs.push('redemption_min_minor');
  } else {
    c3Status = STATUS.PASS; c3Reason = 'no_significant_fees_or_restrictions_declared'; c3Refs.push('redemption_fees_bp', 'redemption_min_minor');
  }
  criteria.push(crit('c3_no_significant_fees_restrictions', c3Status, c3Reason, c3Refs));

  // c4: segregated reserve assets, at least one-to-one, short-term highly liquid
  const reserves = boolTerm(holding, 'issuer_reserve_short_term_liquid_one_to_one');
  criteria.push(reserves === null
    ? crit('c4_segregated_short_term_reserves', STATUS.NOT_DETERMINABLE, 'reserve_terms_not_determinable', ['issuer_reserve_short_term_liquid_one_to_one'])
    : crit('c4_segregated_short_term_reserves',
        reserves ? STATUS.PASS : STATUS.FAIL,
        reserves ? 'segregated_one_to_one_short_term_liquid_reserves_declared' : 'reserves_not_one_to_one_short_term_liquid',
        ['issuer_reserve_short_term_liquid_one_to_one']));

  // c5: short-term — original maturity within the declared three-month convention
  let c5Status; let c5Reason;
  if (holding.original_maturity_days === undefined) {
    c5Status = STATUS.NOT_DETERMINABLE; c5Reason = 'original_maturity_not_declared';
  } else if (holding.original_maturity_days <= shortTermMaxDays) {
    c5Status = STATUS.PASS; c5Reason = 'original_maturity_within_declared_short_term_convention';
  } else {
    c5Status = STATUS.FAIL; c5Reason = 'original_maturity_exceeds_declared_short_term_convention';
  }
  criteria.push(crit('c5_short_term_original_maturity', c5Status, c5Reason, ['original_maturity_days']));

  // c6: relevant laws and regulations taken into account
  const laws = boolTerm(holding, 'laws_prohibit_cash_equivalent_treatment');
  criteria.push(laws === null
    ? crit('c6_laws_and_regulations', STATUS.NOT_DETERMINABLE, 'legal_treatment_terms_not_determinable', ['laws_prohibit_cash_equivalent_treatment'])
    : crit('c6_laws_and_regulations',
        laws ? STATUS.FAIL : STATUS.PASS,
        laws ? 'declared_law_or_regulation_prohibits_cash_equivalent_treatment' : 'no_declared_legal_prohibition_on_treatment',
        ['laws_prohibit_cash_equivalent_treatment']));

  // -- classification: collective evaluation --------------------------------------
  const failCount = criteria.filter(function (c) { return c.status === STATUS.FAIL; }).length;
  const ndCount = criteria.filter(function (c) { return c.status === STATUS.NOT_DETERMINABLE; }).length;
  const classification = failCount > 0 ? CLASS_FAILS : ndCount > 0 ? CLASS_ND : CLASS_MEETS;

  // -- disclosure checklist proposed by the pinned text ---------------------------
  const disclosure_checklist = [
    { disclosure: 'cash_equivalents_accounting_policy', applies: 'all_entities', status: 'retained_existing', scope_note: 'policy for determining which items are treated as cash equivalents' },
    { disclosure: 'significant_components_of_cash_equivalents_annual', applies: 'all_entities_presenting_cash_equivalents', status: 'proposed_new', scope_note: 'annual reporting periods: significant components (named in the text: treasury bills, commercial paper, stablecoins, money market funds) and related amounts of each component presented as cash equivalents' },
    { disclosure: 'transition_modified_prospective_examples_reconciliation', applies: 'entities_applying_the_examples', status: 'proposed', scope_note: 'reconciliation of opening cash, cash equivalents, restricted cash and restricted cash equivalents before and after adoption, in each interim period (if applicable) and the annual year of adoption' },
    { disclosure: 'transition_nature_and_reason_for_change', applies: 'entities_applying_the_examples', status: 'proposed', scope_note: 'nature of and reason for the change in accounting principle' },
    { disclosure: 'components_disclosure_transition_prospective', applies: 'all_entities_first_applying', status: 'proposed', scope_note: 'significant-components disclosure applied prospectively as of the end of the annual reporting period of first application' },
  ];

  const output_payload = {
    refused: false,
    profile: pp.profile,
    profile_status: 'proposed',
    status_note: 'exposure_draft_not_authoritative_comment_period_open_through_2026_11_19',
    holding_declared: {
      token_label: typeof holding.token_label === 'string' ? holding.token_label : null,
      holder_has_direct_issuer_redemption: holding.holder_has_direct_issuer_redemption,
      redemption_on_demand: holding.redemption_on_demand,
      redemption_amount_known: holding.redemption_amount_known,
      redemption_fees_bp: holding.redemption_fees_bp === undefined ? null : holding.redemption_fees_bp,
      redemption_min_minor: holding.redemption_min_minor === undefined ? null : holding.redemption_min_minor,
      redemption_settlement_days: holding.redemption_settlement_days === undefined ? null : holding.redemption_settlement_days,
      gates_or_suspension_terms: holding.gates_or_suspension_terms,
      access_via_intermediary_only: holding.access_via_intermediary_only,
      original_maturity_days: holding.original_maturity_days === undefined ? null : holding.original_maturity_days,
      issuer_reserve_short_term_liquid_one_to_one: holding.issuer_reserve_short_term_liquid_one_to_one,
      laws_prohibit_cash_equivalent_treatment: laws === null ? null : laws,
    },
    policy_declared: {
      significant_fees_bp: sigFeeBp,
      significant_min_minor: sigMinMinor,
      short_term_maturity_days_max: shortTermMaxDays,
      policy_note: 'significance_thresholds_are_declared_policy_parameters_not_values_from_the_pinned_text',
    },
    criteria: criteria,
    classification: classification,
    classification_label: classification === CLASS_MEETS
      ? 'meets_all_criteria_of_the_proposed_examples_under_profile_status_proposed'
      : classification === CLASS_FAILS
        ? 'does_not_meet_one_or_more_criteria_of_the_proposed_examples'
        : 'one_or_more_criteria_not_determinable_from_declared_terms',
    opinion_boundary: 'this_node_applies_an_exposure_draft_to_declared_terms_and_is_not_an_accounting_opinion_presentation_as_cash_equivalents_is_a_policy_election',
    disclosure_checklist: disclosure_checklist,
    policy_mandate_export: {
      node: TOOL_ID,
      mcp_name: meta.mcp_name,
      profile: pp.profile,
      profile_status: 'proposed',
      comment_deadline: '2026-11-19',
      declared_terms: null, // filled below (echo of holding_declared)
      criteria: criteria.map(function (c) { return { criterion: c.criterion, status: c.status, reason_code: c.reason_code }; }),
      classification: classification,
      disclosure_checklist: disclosure_checklist,
      exporter: 'ap2ExportBtn',
    },
  };
  output_payload.policy_mandate_export.declared_terms = output_payload.holding_declared;

  flags.push('classification_' + classification.toLowerCase());
  if (viaIntermediaryOnly === true && direct === true) {
    flags.push('declared_terms_contradictory_direct_right_with_intermediary_only_access');
  }

  return { output_payload: output_payload, compliance_flags: flags };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
