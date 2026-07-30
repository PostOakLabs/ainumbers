/**
 * art-499-check-safeguarding-reconciliation.kernel.mjs
 * Assurance Waves program (SAFEGUARDING-CASS15-BUILD-SPEC.md §1, CASS15-K-1) — UK CASS 15
 * safeguarding reconciliation check for payment and e-money firms.
 *
 * Compares the caller's SAFEGUARDING REQUIREMENT against the components of its SAFEGUARDING
 * RESOURCE for one declared reconciliation, and classifies the arithmetic outcome as
 * `reconciled` / `shortfall` / `excess` against a caller-declared tolerance.
 *
 * SINGLE-RUN AND STATELESS. Nothing here runs on a schedule, stores state, or retains data.
 * The FIRM performs a reconciliation no less than once each reconciliation day because
 * CASS 15.8.19R (internal) / CASS 15.8.42R (external) require it of the firm. This kernel operates
 * nothing and holds nothing; it evaluates one caller-supplied figure set, once.
 *
 * A `shortfall` verdict is an ARITHMETIC FINDING ABOUT SUPPLIED FIGURES. It is NOT a
 * determination that the firm has breached CASS 15, and neither this kernel nor its page says so.
 * The firm's own books and records and its safeguarding auditor decide that.
 *
 * VOCABULARY IS THE INCUMBENT'S, NOT OURS (adoption test 3). The two totals are named
 * `safeguarding_requirement` (CASS 15.8.29G, "the total amount a safeguarding institution is
 * required to safeguard") and `safeguarding_resource` (CASS 15.8.26R), and the resource components
 * use the four component types CASS 15.8.26R enumerates. The looser `relevant_funds_total` /
 * `safeguarded_balance_total` names are accepted as INPUT ALIASES so a caller holding those
 * labels still gets a result, but the emitted payload always speaks the Handbook's names.
 *
 * FIXED-POINT MONEY MATH. Every amount crosses the boundary as an INTEGER NUMBER OF MINOR UNITS
 * (pence). There is no floating-point arithmetic anywhere in compute(): sums, differences and
 * tolerance comparisons are integer operations, and the 2dp display strings are produced by
 * integer division plus string padding, never by toFixed() on a float. A non-integer, non-finite
 * or unsafe amount is coerced to 0 AND named in `rejected_inputs[]`, never silently dropped and
 * never propagated as NaN.
 *
 * FINITE GATE. An empty component set, an all-zero figure set, and a missing requirement each
 * resolve to a DEFINED verdict. No branch can emit NaN, Infinity, null-as-a-number, or an
 * undefined verdict.
 *
 * §28 CLAUSE BINDING (profile `ocg-clause-binding@1`): the rule references this kernel relies on
 * are emitted as §1.2 pinned citation OBJECTS inside output_payload, so they sit inside the
 * execution_hash preimage. This is a NEW mint, which is the only case where adoption is in scope
 * (see the _clausebinding.mjs header). No bare-year citation: every object carries `in_force_from`.
 *
 * NO CLOCK. `as_of_date` is a caller input; compute() never reads a clock, and the artifact
 * carries no `last_reviewed` and no `valid_until` derived from now plus a window.
 *
 * PII: opaque account references only. No account numbers, names, or customer identifiers.
 * Demo fixture ships SYNTHETIC data only (CONTRACT §1.3).
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute().
 *
 * Spec: SAFEGUARDING-CASS15-BUILD-SPEC.md §0 + §1 (CASS15-K-1, art-499).
 * Regime facts re-verified against FCA primary source on 2026-07-30 (STEP-0):
 *   handbook.fca.org.uk CASS 15.8 (in force 2026-05-07) and fca.org.uk PS25/12.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-499-check-safeguarding-reconciliation';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'check_safeguarding_reconciliation', mandate_type: 'compliance_mandate', gpu: false };

/** CASS 15.8.26R enumerates the safeguarding resource in four parts. This is that closed set. */
const COMPONENT_TYPES = [
  'relevant_funds_bank_account',
  'segregated_not_yet_placed',
  'relevant_assets',
  'insurance_or_guarantee',
];

/**
 * §28 pinned citation objects (profile `ocg-clause-binding@1`, §1.2 required members).
 * `in_force_from` is the commencement date of the strengthened regime confirmed in PS25/12.
 * A bare year would not satisfy `in_force_from`; these are full ISO dates by construction.
 */
const CITE_MAPPED_BY = 'AINumbers CASS15-K-1';
const CITE_MAPPED_AT = '2026-07-30';
const IN_FORCE_FROM = '2026-05-07';
const HANDBOOK_URI = 'https://handbook.fca.org.uk/handbook/cass15/cass15s8';
function cite(id) {
  return { scheme: 'fca-handbook', id, in_force_from: IN_FORCE_FROM, mapped_by: CITE_MAPPED_BY, mapped_at: CITE_MAPPED_AT, uri: HANDBOOK_URI };
}
const CITATIONS = {
  internal_reconciliation: cite('CASS 15.8.10R'),
  internal_frequency: cite('CASS 15.8.19R'),
  external_reconciliation: cite('CASS 15.8.47R'),
  external_frequency: cite('CASS 15.8.42R'),
  safeguarding_resource: cite('CASS 15.8.26R'),
  safeguarding_requirement: cite('CASS 15.8.29G'),
  discrepancy_treatment: cite('CASS 15.8.50R'),
};

/** The rule and field-set version pinned in the artifact AND rendered on screen (adoption test 4). */
const RULESET = {
  ruleset_id: 'FCA-CASS15-PS25-12',
  ruleset_label: 'FCA CASS 15 safeguarding rules, as made by PS25/12',
  in_force_from: IN_FORCE_FROM,
  field_set_version: '1.0.0',
  sourced_from: 'handbook.fca.org.uk',
  sourced_on: CITE_MAPPED_AT,
};

/** Minor-unit exponent. Fixed at 2: this tool is for 2dp currencies such as GBP, EUR and USD. */
const MINOR_UNIT_EXPONENT = 2;
const MINOR_SCALE = 100;

function isSafeIntAmount(v) {
  return typeof v === 'number' && Number.isFinite(v) && Number.isSafeInteger(v);
}
/** Integer coercion with an explicit rejection record. Never a silent drop, never NaN. */
function toMinorUnits(v, where, rejected) {
  if (isSafeIntAmount(v)) return v;
  if (v === undefined || v === null || v === '') { rejected.push({ where, reason: 'absent', supplied: null }); return 0; }
  rejected.push({
    where,
    reason: typeof v === 'number' ? 'not a safe integer number of minor units' : `expected an integer number of minor units, got ${typeof v}`,
    supplied: typeof v === 'number' && Number.isFinite(v) ? v : String(v),
  });
  return 0;
}
/** 2dp display string from an integer minor-unit amount. Integer division only, no floats. */
function display(minor) {
  const neg = minor < 0;
  const abs = neg ? -minor : minor;
  const whole = Math.trunc(abs / MINOR_SCALE);
  const frac = abs - whole * MINOR_SCALE;
  return (neg ? '-' : '') + String(whole) + '.' + String(frac).padStart(MINOR_UNIT_EXPONENT, '0');
}
function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
/** ISO yyyy-mm-dd shape check only. No Date parsing, so no clock and no timezone drift. */
function isoDateOrNull(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null; }

export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];

  const as_of_date = isoDateOrNull(pp.as_of_date);
  const currency = isNonEmptyString(pp.currency) ? pp.currency.trim().toUpperCase() : 'GBP';
  const reconciliation_type = pp.reconciliation_type === 'external' ? 'external' : 'internal';

  // Incumbent name first; the looser names are accepted as aliases (adoption test 1).
  const requirementRaw = pp.safeguarding_requirement_minor_units !== undefined
    ? pp.safeguarding_requirement_minor_units
    : pp.relevant_funds_total_minor_units !== undefined
      ? pp.relevant_funds_total_minor_units
      : pp.relevant_funds_total;
  const safeguarding_requirement_minor_units = toMinorUnits(requirementRaw, 'safeguarding_requirement_minor_units', rejected_inputs);

  const toleranceRaw = pp.tolerance_minor_units;
  const toleranceSigned = toMinorUnits(toleranceRaw === undefined || toleranceRaw === null ? 0 : toleranceRaw, 'tolerance_minor_units', rejected_inputs);
  const tolerance_minor_units = toleranceSigned < 0 ? -toleranceSigned : toleranceSigned;

  const suppliedComponents = Array.isArray(pp.safeguarding_resource_components)
    ? pp.safeguarding_resource_components
    : Array.isArray(pp.component_breakdown) ? pp.component_breakdown : [];

  const components = suppliedComponents.map((c, i) => {
    c = c && typeof c === 'object' ? c : {};
    const account_ref = isNonEmptyString(c.account_ref) ? c.account_ref.trim() : `UNLABELLED-${i + 1}`;
    const suppliedType = isNonEmptyString(c.component_type) ? c.component_type.trim()
      : isNonEmptyString(c.method) ? c.method.trim() : '';
    const recognised = COMPONENT_TYPES.indexOf(suppliedType) !== -1;
    if (suppliedType === '') {
      rejected_inputs.push({ where: `safeguarding_resource_components[${i}].component_type`, reason: 'absent', supplied: null });
    } else if (!recognised) {
      rejected_inputs.push({ where: `safeguarding_resource_components[${i}].component_type`, reason: 'not one of the four CASS 15.8.26R safeguarding resource component types', supplied: suppliedType });
    }
    const amount_minor_units = toMinorUnits(
      c.amount_minor_units !== undefined ? c.amount_minor_units : c.amount,
      `safeguarding_resource_components[${i}].amount_minor_units`,
      rejected_inputs,
    );
    return {
      account_ref,
      component_type: recognised ? suppliedType : 'unclassified',
      counted_toward_resource: recognised,
      amount_minor_units: recognised ? amount_minor_units : 0,
      amount_display: display(recognised ? amount_minor_units : 0),
      excluded_amount_minor_units: recognised ? 0 : amount_minor_units,
    };
  });

  // Integer summation. Every addend is already a safe integer, so the sum cannot become NaN.
  let safeguarding_resource_minor_units = 0;
  for (const c of components) safeguarding_resource_minor_units += c.amount_minor_units;

  const subtotals_by_component_type = COMPONENT_TYPES.map((t) => {
    let sum = 0;
    for (const c of components) if (c.component_type === t) sum += c.amount_minor_units;
    return { component_type: t, amount_minor_units: sum, amount_display: display(sum) };
  });

  const difference_minor_units = safeguarding_resource_minor_units - safeguarding_requirement_minor_units;
  const abs_difference = difference_minor_units < 0 ? -difference_minor_units : difference_minor_units;
  const within_tolerance = abs_difference <= tolerance_minor_units;

  let verdict;
  if (within_tolerance) verdict = 'reconciled';
  else if (difference_minor_units < 0) verdict = 'shortfall';
  else verdict = 'excess';

  const difference_direction = difference_minor_units === 0
    ? 'level'
    : difference_minor_units < 0 ? 'resource_below_requirement' : 'resource_above_requirement';

  const freqCite = reconciliation_type === 'external' ? CITATIONS.external_frequency : CITATIONS.internal_frequency;
  const typeCite = reconciliation_type === 'external' ? CITATIONS.external_reconciliation : CITATIONS.internal_reconciliation;

  const rationale = [];
  rationale.push(`Safeguarding requirement supplied as ${display(safeguarding_requirement_minor_units)} ${currency} (${CITATIONS.safeguarding_requirement.id}).`);
  rationale.push(`Safeguarding resource summed to ${display(safeguarding_resource_minor_units)} ${currency} across ${components.length} supplied component${components.length === 1 ? '' : 's'} (${CITATIONS.safeguarding_resource.id}).`);
  rationale.push(`Difference (resource minus requirement) is ${display(difference_minor_units)} ${currency}; declared tolerance is ${display(tolerance_minor_units)} ${currency}.`);
  rationale.push(`Evaluated as a ${reconciliation_type} safeguarding reconciliation (${typeCite.id}), which the firm performs no less than once each reconciliation day (${freqCite.id}).`);
  if (components.length === 0) {
    rationale.push('No resource components were supplied, so the resource total is zero by construction. The verdict below is an arithmetic result on that empty set, not a finding that the firm holds nothing.');
  }
  if (rejected_inputs.length > 0) {
    rationale.push(`${rejected_inputs.length} supplied value${rejected_inputs.length === 1 ? ' was' : 's were'} not usable as an integer minor-unit amount or a recognised component type, and ${rejected_inputs.length === 1 ? 'was' : 'were'} treated as zero. Each one is named in rejected_inputs.`);
  }
  if (verdict === 'shortfall') {
    rationale.push(`On these figures the resource is below the requirement by more than the declared tolerance. ${CITATIONS.discrepancy_treatment.id} requires a firm to pay a shortfall into a relevant funds bank account, or invest it in relevant assets, by the end of the day on which the reconciliation is performed. This is an arithmetic finding about the figures supplied here. It is not a determination that the firm has breached CASS 15, which is for the firm's own records and its safeguarding auditor.`);
  } else if (verdict === 'excess') {
    rationale.push(`On these figures the resource exceeds the requirement by more than the declared tolerance. ${CITATIONS.discrepancy_treatment.id} requires a firm to withdraw an excess from the accounts holding relevant funds or relevant assets. This is an arithmetic finding about the figures supplied here, not a determination about the firm's compliance.`);
  } else {
    rationale.push('On these figures the resource and the requirement agree within the declared tolerance. This is an arithmetic finding about the figures supplied here, not an opinion on the completeness or accuracy of the underlying records.');
  }

  const compliance_flags = [];
  if (verdict === 'reconciled') compliance_flags.push('SAFEGUARDING_RECONCILED');
  if (verdict === 'shortfall') { compliance_flags.push('SAFEGUARDING_SHORTFALL'); compliance_flags.push('ESCALATION_RAISED'); }
  if (verdict === 'excess') compliance_flags.push('SAFEGUARDING_EXCESS');
  if (as_of_date === null) compliance_flags.push('SAFEGUARDING_AS_OF_DATE_MISSING_OR_UNPARSEABLE');
  if (rejected_inputs.length > 0) compliance_flags.push('SAFEGUARDING_INPUTS_REJECTED');
  if (components.length === 0) compliance_flags.push('SAFEGUARDING_NO_RESOURCE_COMPONENTS_SUPPLIED');

  const output_payload = {
    ruleset: RULESET,
    as_of_date,
    currency,
    minor_unit_exponent: MINOR_UNIT_EXPONENT,
    reconciliation_type,
    verdict,
    difference_direction,
    safeguarding_requirement_minor_units,
    safeguarding_requirement_display: display(safeguarding_requirement_minor_units),
    safeguarding_resource_minor_units,
    safeguarding_resource_display: display(safeguarding_resource_minor_units),
    difference_minor_units,
    difference_display: display(difference_minor_units),
    tolerance_minor_units,
    tolerance_display: display(tolerance_minor_units),
    within_tolerance,
    component_count: components.length,
    components,
    subtotals_by_component_type,
    rejected_inputs,
    citations: CITATIONS,
    rationale,
    note: 'Deterministic UK CASS 15 safeguarding reconciliation check over a caller-supplied figure set for one declared as-of date. Single-run and stateless: this tool holds no records, runs on no schedule, and retains nothing. The verdict is an arithmetic comparison of the supplied safeguarding resource against the supplied safeguarding requirement. It is not a determination that the firm has or has not complied with CASS 15, it is not a regulatory filing, and it is not legal advice.',
  };

  return { output_payload, compliance_flags };
}

/** §1.4 pointers: every one roots at output_payload, so each cited object is inside the preimage. */
export const CLAUSE_BINDING_POINTERS = Object.keys(CITATIONS).map((k) => ({
  profile: 'ocg-clause-binding@1',
  pointer: `/output_payload/citations/${k}`,
}));

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null, execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    clause_bindings: CLAUSE_BINDING_POINTERS,
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
