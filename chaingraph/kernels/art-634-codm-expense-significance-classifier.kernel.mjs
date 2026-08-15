import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-634-codm-expense-significance-classifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'classify_codm_expense_significance',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Closed-domain classification of one candidate segment expense under the significant expense
// principle added to ASC 280 by FASB Accounting Standards Update No. 2023-07, retrieved at claim time
// from https://storage.fasb.org/ASU%202023-07.pdf and pinned at
// sha256:9f26ab8f95365fb301746f7c75f502815be727c6e12a8d8f72e4ea7a58dc45ea.
// Spec: research/DISE-SEG-K-2.spec.md.
//
// NO ARITHMETIC EXISTS IN THIS KERNEL. No ratio, no scale, no threshold compare, no rounding, no
// Math call. rounding_steps: []. float_sensitive: no. That emptiness is what keeps the 160-state
// exhaustive-enumeration claim free of boundary-value cases.
//
// TWO THINGS THE UPDATE DOES NOT SUPPLY, AND THIS KERNEL THEREFORE DOES NOT INVENT:
//   1. A closed list of expense category NAMES. ASC 280-10-50-26A directs the entity to identify the
//      expenses in its own chief-operating-decision-maker reporting first and then disclose the
//      significant ones, so the category vocabulary is entity specific. Category name is not an input.
//   2. A quantitative significance benchmark. 50-26A requires the entity to weigh qualitative AND
//      quantitative factors and names no percentage and no base. Significance therefore arrives as a
//      caller-declared judgment (assessed_significant), never as a computed comparison here. Same
//      discipline art-615 set for its named 100 dollar figure.
//
// The one enum the clause genuinely closes is ASC 280-10-50-22's specified items, whose subparagraphs
// run (a) through (j) with (i) SUPERSEDED by ASU 2015-01, leaving 9 live members. Reading (a) through
// (j) as 10 is the naive count and is wrong.
const SPECIFIED_ITEMS_50_22 = {
  revenues_from_external_customers: 'ASC 280-10-50-22(a)',
  intersegment_revenues: 'ASC 280-10-50-22(b)',
  interest_revenue: 'ASC 280-10-50-22(c)',
  interest_expense: 'ASC 280-10-50-22(d)',
  depreciation_depletion_amortization: 'ASC 280-10-50-22(e)',
  unusual_items: 'ASC 280-10-50-22(f)',
  equity_in_net_income_of_equity_method_investees: 'ASC 280-10-50-22(g)',
  income_tax_expense_or_benefit: 'ASC 280-10-50-22(h)',
  significant_noncash_items_other_than_dda: 'ASC 280-10-50-22(j)',
};

// Per-segment duties this node has no standing to decide from one candidate expense. Named rather
// than silently dropped, the way art-615 names the predicates its closed set cannot resolve.
const SEGMENT_LEVEL_DUTIES =
  'This node classifies one candidate expense. ASC 280-10-50-26B separately requires an amount and a ' +
  'qualitative description of other segment items for each reportable segment, and ASC 280-10-50-26C ' +
  'requires that disclosure even when no significant expense categories are reported for a segment, ' +
  'together with an explanation of the nature of the expense information the chief operating decision ' +
  'maker uses to manage that segment (ASC 280-10-55-15G). Those are per-segment duties decided across ' +
  'all of a segment expenses, not from any single candidate, and are not decided here.';

// ASC 280-10-50-26B(c) covers gains, losses and other amounts rather than expense categories, so it is
// outside this node's subject. Named so its absence reads as a scope statement, not an oversight.
const BUCKET_C_OUT_OF_SCOPE =
  'ASC 280-10-50-26B(c) covers a segment gains, losses or other amounts included in the reported ' +
  'measure of profit or loss rather than expense categories, so it is outside the subject of this node ' +
  'and is never returned.';

export function compute(pp) {
  const included_in_segment_profit_measure = pp.included_in_segment_profit_measure === true;
  const regularly_provided_to_codm = pp.regularly_provided_to_codm === true;
  const easily_computable_from_codm_information = pp.easily_computable_from_codm_information === true;
  const assessed_significant = pp.assessed_significant === true;

  const raw_item = pp.specified_item_50_22 ?? 'none';
  const is_declared_item =
    raw_item === 'none' || Object.prototype.hasOwnProperty.call(SPECIFIED_ITEMS_50_22, raw_item);
  const input_outside_declared_domain = !is_declared_item;
  const is_50_22_item = is_declared_item && raw_item !== 'none';

  // ASC 280-10-50-26A: the expense must sit inside the reported measure of segment profit or loss AND
  // reach the chief operating decision maker by either route. The second limb is the Update's own
  // instruction to evaluate an expense that is easily computable from information regularly provided,
  // with the mechanism and two worked examples at ASC 280-10-55-15A and 55-15B. Dropping it would
  // wrongly exclude the Update's own cost-of-sales-from-gross-margin case.
  const reaches_codm = regularly_provided_to_codm || easily_computable_from_codm_information;
  const evaluated_under_50_26A = included_in_segment_profit_measure && reaches_codm;
  const must_disclose_separately_50_26A = evaluated_under_50_26A && assessed_significant;

  // An expense outside the reported measure is not reached by 50-26A or 50-26B at all. This is the
  // ONLY genuine exclusion: an expense INSIDE the measure always lands somewhere, because 50-26B
  // defines other segment items as a reconciling residual.
  const outside_significant_expense_principle = !included_in_segment_profit_measure;

  // 50-26B says other segment items MAY INCLUDE (a) through (d). The buckets overlap by design and are
  // not a partition, so this is an array rather than a single-valued enum.
  const other_segment_items_buckets = [];
  if (included_in_segment_profit_measure && !must_disclose_separately_50_26A) {
    if (!regularly_provided_to_codm) other_segment_items_buckets.push('ASC 280-10-50-26B(a)');
    other_segment_items_buckets.push('ASC 280-10-50-26B(b)');
    if (is_50_22_item) other_segment_items_buckets.push('ASC 280-10-50-26B(d)');
  }
  const folds_into_other_segment_items_50_26B = other_segment_items_buckets.length > 0;

  // 50-22 reaches further than 50-26A: it applies when the specified amount is included in the measure
  // of segment profit or loss OR is otherwise regularly provided to the chief operating decision maker
  // EVEN IF not included in that measure. So a specified item can be outside the significant expense
  // principle and still separately disclosable.
  const separate_disclosure_required_50_22 =
    is_50_22_item && (included_in_segment_profit_measure || regularly_provided_to_codm);

  const citations = ['ASC 280-10-50-26A'];
  if (!regularly_provided_to_codm && easily_computable_from_codm_information) {
    citations.push('ASC 280-10-55-15A', 'ASC 280-10-55-15B');
  }
  for (const b of other_segment_items_buckets) citations.push(b);
  if (is_50_22_item) citations.push(SPECIFIED_ITEMS_50_22[raw_item]);
  if (raw_item === 'interest_expense') citations.push('ASC 280-10-50-24');

  let basis;
  if (must_disclose_separately_50_26A) {
    basis =
      'Disclosed separately for this reportable segment under ASC 280-10-50-26A: the expense is ' +
      'included in the reported measure of segment profit or loss, it ' +
      (regularly_provided_to_codm
        ? 'is regularly provided to the chief operating decision maker'
        : 'is easily computable from information regularly provided to the chief operating decision ' +
          'maker under ASC 280-10-55-15A and 55-15B') +
      ', and the entity has assessed the category as significant. This node did not compute that ' +
      'significance assessment and the Update states no benchmark for it.';
  } else if (folds_into_other_segment_items_50_26B) {
    basis =
      'Included in other segment items under ASC 280-10-50-26B rather than disclosed separately. The ' +
      'expense sits inside the reported measure of segment profit or loss but ' +
      (!reaches_codm
        ? 'is neither regularly provided to the chief operating decision maker nor easily computable ' +
          'from information that is, so ASC 280-10-50-26A never evaluates it'
        : 'the entity has not assessed the category as significant') +
      '. Other segment items is a reconciling residual, so nothing inside the reported measure is ' +
      'excluded from disclosure entirely.';
  } else {
    basis =
      'Outside the significant expense principle: the expense is not included in the reported measure ' +
      'of segment profit or loss, so neither ASC 280-10-50-26A nor ASC 280-10-50-26B reaches it. ' +
      (separate_disclosure_required_50_22
        ? 'It remains separately disclosable under ASC 280-10-50-22, which applies when a specified ' +
          'amount is included in the measure of segment profit or loss or is otherwise regularly ' +
          'provided to the chief operating decision maker even if not included in that measure.'
        : 'No ASC 280-10-50-22 specified-item duty arises on these inputs either.');
  }

  const compliance_flags = ['SEG_EXPENSE_CLASSIFIED'];
  if (must_disclose_separately_50_26A) compliance_flags.push('SEG_EXPENSE_DISCLOSE_SEPARATELY');
  else if (folds_into_other_segment_items_50_26B) compliance_flags.push('SEG_EXPENSE_OTHER_SEGMENT_ITEMS');
  else compliance_flags.push('SEG_EXPENSE_OUTSIDE_SIGNIFICANT_EXPENSE_PRINCIPLE');
  if (evaluated_under_50_26A && !regularly_provided_to_codm) {
    compliance_flags.push('SEG_EXPENSE_EASILY_COMPUTABLE_ROUTE');
  }
  if (separate_disclosure_required_50_22) compliance_flags.push('SEG_EXPENSE_50_22_SEPARATE_DISCLOSURE_REQUIRED');
  if (raw_item === 'interest_expense') compliance_flags.push('SEG_EXPENSE_INTEREST_EXPENSE_50_24_INTERACTION');
  if (input_outside_declared_domain) compliance_flags.push('SEG_EXPENSE_INPUT_OUTSIDE_DECLARED_DOMAIN');

  return {
    output_payload: {
      included_in_segment_profit_measure,
      regularly_provided_to_codm,
      easily_computable_from_codm_information,
      assessed_significant,
      specified_item_50_22: raw_item,
      input_outside_declared_domain,
      evaluated_under_50_26A,
      must_disclose_separately_50_26A,
      folds_into_other_segment_items_50_26B,
      other_segment_items_buckets,
      outside_significant_expense_principle,
      separate_disclosure_required_50_22,
      citation: citations.join('; '),
      basis,
      segment_level_duties_not_decided_here: SEGMENT_LEVEL_DUTIES,
      bucket_c_scope_note: BUCKET_C_OUT_OF_SCOPE,
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
