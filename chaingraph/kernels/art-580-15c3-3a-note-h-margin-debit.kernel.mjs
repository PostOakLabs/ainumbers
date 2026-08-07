/**
 * art-580-15c3-3a-note-h-margin-debit.kernel.mjs
 *
 * CAPMKT wave (CAPMKT-WAVE-BUILD-SPEC.md §6, CAPMKT-NOTEH-1) -- recomputes,
 * from caller-declared facts about ONE broker-dealer's Treasury-securities
 * clearing relationship with a registered clearing agency, whether a margin
 * debit qualifies for inclusion in the Exchange Act Rule 15c3-3 customer
 * (or PAB) reserve formula under Note H to Exhibit A (Rule 15c3-3a), and if
 * so computes the debit amount.
 *
 * SIBLING, NOT A REPLACEMENT. art-396 recomputes the general 15c3-3 reserve
 * formula (Items 1-14/credits and debits). This kernel is narrower: it
 * covers only the Note H margin-debit sliver -- the conditions a clearing
 * agency and a broker-dealer must satisfy before that ONE debit line may be
 * included, and the amount of that debit. It does not recompute the rest of
 * the reserve formula and does not read or write art-396's kernel. Cross-
 * link only; never edit art-396.
 *
 * WHAT NOTE H CONDITIONS THIS KERNEL CHECKS (re-verify at build against
 * primary text -- 17 CFR 240.15c3-3a, Note H; SEC adopting/orders re
 * Treasury clearing, Federal Register 2025-2026):
 *
 *   - Note H(b)(3): the clearing agency's rules implementing Note H have
 *     Commission approval and the Commission has published notice that the
 *     conditions of Note H are satisfied with respect to that clearing
 *     agency (declared here as clearing_agency_conditions.commission_notice_published,
 *     with the dated notice the caller is asserting against).
 *   - Note H(b)(2)(i): the clearing agency calculates a SEPARATE margin
 *     requirement for each customer of the broker-dealer, and the margin is
 *     delivered to the clearing agency on a GROSS (not netted-across-
 *     customers) basis (per_customer_gross_margin_calc).
 *   - Note H(b)(2)(ii): cash on deposit as margin is invested only in
 *     short-term U.S. Treasury securities (cash_investment_short_term_treasuries_only).
 *   - Note H(b)(2)(iii)-(iv): margin is held in a segregated "Special
 *     Clearing Account for the Exclusive Benefit of Customers" at a Federal
 *     Reserve Bank or an FDIC-insured bank (special_clearing_account_designated).
 *   - Note H(b)(2)(v): the clearing agency's rules provide a system for
 *     returning excess margin no longer required (excess_margin_return_system).
 *   - Note H(b)(1): the source of the margin itself is restricted to (a)
 *     cash the customer delivered for that customer's own Treasury
 *     positions, (b) that customer's own securities held in custody that
 *     are "qualified customer securities" under the clearing agency's Note
 *     H rules, or (c) narrowly, the broker-dealer's OWN qualifying Treasury
 *     securities -- but only where the customer did not have sufficient
 *     margin, the clearing agency called for and received the margin, and
 *     the broker-dealer recouped the advance from the customer by the next
 *     business day. This kernel models that narrow third path as
 *     margin_source = 'bd_treasuries_narrow' and requires BOTH
 *     customer_insufficient_assets_declared and
 *     margin_called_and_received_next_business_day to be true; if either is
 *     false or unstated while that path is selected, the debit is not
 *     includable via this source.
 *
 * FINITE GATE / VERDICT. INCLUDABLE only when every declared condition
 * resolves true. NOT_INCLUDABLE when at least one condition is explicitly
 * declared false (or the narrow bd_treasuries_narrow sub-conditions fail).
 * INDETERMINATE when a condition needed to decide is simply unstated
 * (null/undefined) -- never guessed toward either INCLUDABLE or
 * NOT_INCLUDABLE. Absent margin_required_minor_units or
 * margin_on_deposit_minor_units also forces INDETERMINATE, since no debit
 * amount can be computed without them.
 *
 * DEBIT COMPUTATION. Note H permits a debit only for margin that is both
 * REQUIRED (by the clearing agency's per-customer calculation) and ACTUALLY
 * ON DEPOSIT in a permitted form -- never a debit larger than either figure.
 * debit_minor_units = MIN(margin_required_minor_units, margin_on_deposit_minor_units)
 * when INCLUDABLE, else 0.
 *
 * SCOPE. This kernel recomputes only the Note H margin-debit sliver. It
 * does NOT recompute Items 1-14 of the Rule 15c3-3a reserve formula (see
 * art-396 for that), does not verify a clearing agency's rulebook against
 * what the caller declares, and is not legal or regulatory advice. The
 * SEC's Treasury-clearing compliance dates (cash trades by 2026-12-31, repo
 * by 2027-06-30) are cited as dated facts, not modelled as a countdown.
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute().
 *
 * Spec: CAPMKT-WAVE-BUILD-SPEC.md §6, §Common.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-580-15c3-3a-note-h-margin-debit';
const TOOL_VERSION = '1.0.0';
export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'compute_note_h_margin_debit',
  mandate_type: 'analytics_mandate',
  gpu: false,
};

const MARGIN_SOURCES = ['customer_cash', 'customer_securities_custody', 'bd_treasuries_narrow'];

const CITATIONS = {
  note_h_b1: {
    source: 'Exchange Act Rule 15c3-3a, Note H(b)(1)',
    detail: 'Permitted sources of the margin on deposit are: cash the customer delivered for that customer\'s own U.S. Treasury securities positions; that customer\'s own securities held in custody that qualify as "qualified customer securities" under the clearing agency\'s Note H rules; or, narrowly, the broker-dealer\'s own qualifying Treasury securities where the customer lacked sufficient margin, the clearing agency called for and received the margin, and the broker-dealer recouped the advance from the customer by the next business day. Re-verify against primary text before relying on it (research finding, not a fact).',
  },
  note_h_b2i: {
    source: 'Exchange Act Rule 15c3-3a, Note H(b)(2)(i)',
    detail: 'The clearing agency\'s rules must require a SEPARATE margin requirement calculated for each customer of the broker-dealer, with the broker-dealer delivering that customer\'s margin to the clearing agency on a gross basis.',
  },
  note_h_b2ii: {
    source: 'Exchange Act Rule 15c3-3a, Note H(b)(2)(ii)',
    detail: 'Cash on deposit as margin may be invested by the clearing agency only in short-term U.S. Treasury securities.',
  },
  note_h_b2iii_iv: {
    source: 'Exchange Act Rule 15c3-3a, Note H(b)(2)(iii)-(iv)',
    detail: 'Margin must be held in a segregated Special Clearing Account for the exclusive benefit of customers, maintained at a Federal Reserve Bank or an FDIC-insured bank.',
  },
  note_h_b2v: {
    source: 'Exchange Act Rule 15c3-3a, Note H(b)(2)(v)',
    detail: 'The clearing agency\'s rules must provide a system for promptly returning excess margin that is no longer required.',
  },
  note_h_b3: {
    source: 'Exchange Act Rule 15c3-3a, Note H(b)(3)',
    detail: 'The clearing agency\'s Note H rules must have Commission approval, and the Commission must have published notice that the conditions of Note H are satisfied with respect to that clearing agency, before a broker-dealer may include the Note H debit for that clearing agency.',
  },
  treasury_clearing_compliance_dates: {
    source: 'SEC Treasury-clearing adopting release and compliance-date extension (Federal Register, 2025 final rule and 2025-03-04 extension notice)',
    detail: 'Central clearing of eligible U.S. Treasury cash trades is required by 2026-12-31 and of eligible repo transactions by 2027-06-30. Stated here as a dated fact, not a live countdown.',
  },
};

const NOT_PROVEN = [
  { item: 'Not legal or regulatory advice', detail: 'This kernel recomputes the Note H margin-debit condition checks and debit arithmetic from caller-declared facts. It is not a substitute for counsel, FINRA/SEC guidance, or the broker-dealer\'s own compliance and financial-operations review.' },
  { item: 'Commission notice currency', detail: 'Whether the Commission has in fact published (and not since withdrawn) a Note H(b)(3) notice for the named clearing agency is a caller-declared fact, not independently verified against the Federal Register at run time -- this is an offline, zero-network tool.' },
  { item: 'Full reserve formula not recomputed', detail: 'This kernel computes only the Note H margin-debit sliver. It does not recompute Items 1-14 of the Rule 15c3-3a customer/PAB reserve formula -- see the sibling art-396 15c3-3 reserve tool for that, a separate and independent tool.' },
  { item: 'Clearing agency rulebook not verified', detail: 'The per-customer gross calculation, cash-investment restriction, Special Clearing Account designation, and excess-margin-return-system conditions are caller-declared facts about the named clearing agency\'s rules, not independently checked against that clearing agency\'s actual rulebook filings.' },
  { item: 'Input accuracy', detail: 'Margin-required and margin-on-deposit figures are caller-supplied and asserted, not independently verified against the clearing agency\'s own margin call or the broker-dealer\'s books and records.' },
];

const MINOR_UNIT_EXPONENT = 2;
const MINOR_SCALE = 100;

function isSafeIntAmount(v) { return typeof v === 'number' && Number.isFinite(v) && Number.isSafeInteger(v); }
function toMinorUnits(v, where, rejected) {
  if (isSafeIntAmount(v)) return v;
  if (v === undefined || v === null || v === '') { rejected.push({ where, reason: 'absent', supplied: null }); return null; }
  rejected.push({
    where,
    reason: typeof v === 'number' ? 'not a safe integer number of minor units' : `expected an integer number of minor units, got ${typeof v}`,
    supplied: typeof v === 'number' && Number.isFinite(v) ? v : String(v),
  });
  return null;
}
function display(minor) {
  if (minor === null || minor === undefined) return null;
  const neg = minor < 0;
  const abs = neg ? -minor : minor;
  const whole = Math.trunc(abs / MINOR_SCALE);
  const frac = abs - whole * MINOR_SCALE;
  return (neg ? '-' : '') + String(whole) + '.' + String(frac).padStart(MINOR_UNIT_EXPONENT, '0');
}
function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function str(v, fallback) { return isNonEmptyString(v) ? v.trim() : fallback; }
function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
function tri(v) { return v === true ? true : v === false ? false : null; } // tri-state: true/false/unstated(null)

function conditionRow(key, label, citation_key, value) {
  return { key, label, citation_key, satisfied: value };
}

export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];

  const broker_dealer_ref = str(pp.broker_dealer_ref, 'UNSTATED');
  const computation_date_label = str(pp.computation_date_label, 'UNSTATED');
  const currency = isNonEmptyString(pp.currency) ? pp.currency.trim().toUpperCase() : 'USD';
  const clearing_agency_name = str(pp.clearing_agency_name, 'UNSTATED');

  const cac = obj(pp.clearing_agency_conditions);
  const commission_notice_published = tri(cac.commission_notice_published);
  const commission_notice_dated = str(cac.commission_notice_dated, null);
  const per_customer_gross_margin_calc = tri(cac.per_customer_gross_margin_calc);
  const cash_investment_short_term_treasuries_only = tri(cac.cash_investment_short_term_treasuries_only);
  const special_clearing_account_designated = tri(cac.special_clearing_account_designated);
  const excess_margin_return_system = tri(cac.excess_margin_return_system);

  const marginSourceSupplied = str(pp.margin_source, '');
  const margin_source = MARGIN_SOURCES.indexOf(marginSourceSupplied) !== -1 ? marginSourceSupplied : null;
  if (margin_source === null) {
    rejected_inputs.push({
      where: 'margin_source',
      reason: marginSourceSupplied === '' ? 'absent' : 'not one of customer_cash, customer_securities_custody, bd_treasuries_narrow',
      supplied: marginSourceSupplied === '' ? null : marginSourceSupplied,
    });
  }
  const customer_insufficient_assets_declared = margin_source === 'bd_treasuries_narrow' ? tri(pp.customer_insufficient_assets_declared) : null;
  const margin_called_and_received_next_business_day = margin_source === 'bd_treasuries_narrow' ? tri(pp.margin_called_and_received_next_business_day) : null;

  const margin_required_minor_units = toMinorUnits(pp.margin_required_minor_units, 'margin_required_minor_units', rejected_inputs);
  const margin_on_deposit_minor_units = toMinorUnits(pp.margin_on_deposit_minor_units, 'margin_on_deposit_minor_units', rejected_inputs);

  // ── Condition checks. ───────────────────────────────────────────────────
  const conditions = [
    conditionRow('commission_notice_published', 'Commission has approved the clearing agency\'s Note H rules and published notice that Note H is satisfied for it', 'note_h_b3', commission_notice_published),
    conditionRow('per_customer_gross_margin_calc', 'Clearing agency calculates a separate, gross, per-customer margin requirement', 'note_h_b2i', per_customer_gross_margin_calc),
    conditionRow('cash_investment_short_term_treasuries_only', 'Cash margin is invested only in short-term U.S. Treasury securities', 'note_h_b2ii', cash_investment_short_term_treasuries_only),
    conditionRow('special_clearing_account_designated', 'Margin held in a segregated Special Clearing Account at a Federal Reserve Bank or FDIC-insured bank', 'note_h_b2iii_iv', special_clearing_account_designated),
    conditionRow('excess_margin_return_system', 'Clearing agency has a system for returning excess margin no longer required', 'note_h_b2v', excess_margin_return_system),
  ];
  if (margin_source === 'bd_treasuries_narrow') {
    conditions.push(conditionRow('customer_insufficient_assets_declared', 'Customer did not have sufficient margin of its own (narrow bd_treasuries_narrow path)', 'note_h_b1', customer_insufficient_assets_declared));
    conditions.push(conditionRow('margin_called_and_received_next_business_day', 'Broker-dealer recouped the advanced margin from the customer by the next business day (narrow bd_treasuries_narrow path)', 'note_h_b1', margin_called_and_received_next_business_day));
  }

  const anyUnstated = conditions.some((c) => c.satisfied === null) || margin_source === null;
  const anyFalse = conditions.some((c) => c.satisfied === false);
  const amountsMissing = margin_required_minor_units === null || margin_on_deposit_minor_units === null;

  // ── Verdict. INDETERMINATE takes priority whenever a required fact is
  //    unstated -- never guessed toward INCLUDABLE or NOT_INCLUDABLE. ──────
  let verdict;
  let indeterminate_reason;
  if (amountsMissing) {
    verdict = 'INDETERMINATE';
    indeterminate_reason = 'margin_required_minor_units and/or margin_on_deposit_minor_units were not supplied, so no debit could be computed.';
  } else if (anyUnstated) {
    verdict = 'INDETERMINATE';
    indeterminate_reason = 'At least one Note H condition (or the margin_source itself) was not declared true or false, so includability cannot be decided.';
  } else if (anyFalse) {
    verdict = 'NOT_INCLUDABLE';
    indeterminate_reason = null;
  } else {
    verdict = 'INCLUDABLE';
    indeterminate_reason = null;
  }

  const debit_minor_units = verdict === 'INCLUDABLE'
    ? Math.min(margin_required_minor_units, margin_on_deposit_minor_units)
    : 0;

  // ── Rationale. ───────────────────────────────────────────────────────────
  const rationale = [];
  rationale.push(`Note H margin-debit includability recomputed for broker-dealer reference ${broker_dealer_ref} as of ${computation_date_label}, clearing agency ${clearing_agency_name}.`);
  const failed = conditions.filter((c) => c.satisfied === false).map((c) => c.key);
  const unstated = conditions.filter((c) => c.satisfied === null).map((c) => c.key);
  if (margin_source === null) unstated.push('margin_source');
  if (failed.length > 0) {
    rationale.push(`${failed.length} Note H condition${failed.length === 1 ? ' is' : 's are'} declared FALSE: ${failed.join(', ')}.`);
  }
  if (unstated.length > 0) {
    rationale.push(`${unstated.length} condition${unstated.length === 1 ? ' was' : 's were'} not declared true or false: ${unstated.join(', ')}.`);
  }
  if (failed.length === 0 && unstated.length === 0 && !amountsMissing) {
    rationale.push('Every declared Note H condition resolved TRUE and a margin_source was declared.');
  }
  rationale.push(verdict === 'INDETERMINATE'
    ? `Verdict is INDETERMINATE: ${indeterminate_reason}`
    : verdict === 'INCLUDABLE'
      ? `Verdict is INCLUDABLE. The debit is MIN(margin required, margin on deposit) = ${display(debit_minor_units)} ${currency}.`
      : 'Verdict is NOT_INCLUDABLE: at least one Note H condition failed, so no Note H debit may be included in the reserve formula for this margin.');
  if (rejected_inputs.length > 0) {
    rationale.push(`${rejected_inputs.length} supplied value${rejected_inputs.length === 1 ? ' was' : 's were'} not usable and ${rejected_inputs.length === 1 ? 'was' : 'were'} treated as absent. Each one is named in rejected_inputs rather than silently dropped.`);
  }
  rationale.push('This is not legal or regulatory advice, and this kernel recomputes only the Note H margin-debit sliver of the Rule 15c3-3a reserve formula, never the full formula (see the sibling art-396 15c3-3 reserve tool for that).');

  // ── Flags. ───────────────────────────────────────────────────────────────
  const compliance_flags = ['NOTEH_MARGIN_RECOMPUTED'];
  compliance_flags.push(verdict === 'INDETERMINATE' ? 'NOTEH_INDETERMINATE' : verdict === 'INCLUDABLE' ? 'NOTEH_INCLUDABLE' : 'NOTEH_NOT_INCLUDABLE');
  if (unstated.length > 0) compliance_flags.push('NOTEH_CONDITION_UNSTATED');
  if (failed.length > 0) compliance_flags.push('NOTEH_CONDITION_FAILED');
  if (margin_source === 'bd_treasuries_narrow') compliance_flags.push('NOTEH_BD_TREASURIES_NARROW_PATH');
  if (verdict === 'NOT_INCLUDABLE') compliance_flags.push('ESCALATION_RAISED');
  if (rejected_inputs.length > 0) compliance_flags.push('NOTEH_INPUTS_REJECTED');

  const output_payload = {
    broker_dealer_ref,
    computation_date_label,
    currency,
    minor_unit_exponent: MINOR_UNIT_EXPONENT,
    clearing_agency_name,
    commission_notice_dated,
    margin_source,
    margin_required_minor_units,
    margin_required_display: display(margin_required_minor_units),
    margin_on_deposit_minor_units,
    margin_on_deposit_display: display(margin_on_deposit_minor_units),
    conditions,
    debit_minor_units,
    debit_display: display(debit_minor_units),
    verdict,
    indeterminate_reason,
    rejected_inputs,
    citations: CITATIONS,
    rationale,
    not_proven: NOT_PROVEN,
    fence: 'This is not legal or regulatory advice. This kernel recomputes only whether a margin debit qualifies for inclusion under Note H to Exchange Act Rule 15c3-3a and, if so, its amount -- it does not recompute Items 1-14 of the Rule 15c3-3a reserve formula (see the sibling art-396 15c3-3 reserve tool for that, an independent tool never edited by this one). Whether a clearing agency\'s rules and Commission notice actually satisfy Note H, and whether the declared facts are accurate, are for the broker-dealer\'s own compliance and financial-operations review.',
    note: 'Deterministic Note H margin-debit includability and amount recomputation for one stated computation date. Single-run and stateless: it holds no records, runs on no schedule, and retains nothing.',
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
