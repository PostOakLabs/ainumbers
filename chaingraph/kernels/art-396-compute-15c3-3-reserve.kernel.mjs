import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-396-compute-15c3-3-reserve';
const TOOL_VERSION = '1.0.0';
const RULES_VERSION = '15c3-3-exhibit-a-2026.1';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_15c3_3_reserve',
  mandate_type: 'compliance_mandate', gpu: false,
};

// SEC Rule 15c3-3 Exhibit A customer reserve formula: total credit items minus total
// allowable debit items yields the reserve requirement a broker-dealer must hold on
// deposit for the exclusive benefit of customers. This is a simplified, honestly-scoped
// implementation over a representative subset of Exhibit A line items with their
// prescribed treatments (aging exclusions on failed-to-deliver debits, the 1% collateral
// margin haircut on margin-account debits) -- it does NOT enumerate every Exhibit A line
// item in the full SEC rule text, and the receipt attests OUR COMPUTATION over the INPUTS
// THE CALLER SUPPLIED. It does not audit those inputs, verify their source records, or
// constitute a determination of regulatory compliance.
//
// Pure ECMA-262 arithmetic only -- no Date.now/argless new Date(), no Math.random.
// Money figures rounded to 2 decimals (r2) only at declared output boundaries. A
// zero-input computation resolves every derived figure to a finite number (never
// NaN/Infinity) -- there is no division in this formula, so the finite gate is
// enforced purely by bounding every input with safeNum/Math.max(0, ...).

const DEBIT_AGING_EXCLUSION_DAYS = 30; // Exhibit A: FTD debits aged past this are excluded from the debit total.
const MARGIN_DEBIT_HAIRCUT_PCT = 1; // Exhibit A Note E: 1% collateral-value haircut on margin-account debits.

const CREDIT_CATEGORIES = new Set([
  'free_credit_balances',
  'margin_credit_balances',
  'customer_free_credit_balances_commodities',
  'payable_from_securities_loaned_using_customer_securities',
  'failed_to_receive_over_30_days',
  'other_credit_balance',
]);

const DEBIT_CATEGORIES = new Set([
  'margin_account_debit',
  'securities_failed_to_deliver',
  'margin_required_registered_options',
  'other_allowable_debit',
]);

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return (v === null || !Number.isFinite(v)) ? null : Math.round(v * 100) / 100; }
function arr(v) { return Array.isArray(v) ? v : []; }
function intOrNull(v) { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : null; }

function computeCreditItems(items) {
  const lines = arr(items).map((c) => {
    const category = CREDIT_CATEGORIES.has(c && c.category) ? c.category : 'other_credit_balance';
    const amount_musd = Math.max(0, safeNum(c && c.amount_musd, 0));
    return { label: (c && c.label) || category, category, amount_musd: r2(amount_musd), included_musd: r2(amount_musd) };
  });
  const total = lines.reduce((s, l) => s + l.included_musd, 0);
  return { lines, total_credits_musd: r2(total) };
}

function computeDebitItems(items) {
  const lines = arr(items).map((d) => {
    const category = DEBIT_CATEGORIES.has(d && d.category) ? d.category : 'other_allowable_debit';
    const amount_musd = Math.max(0, safeNum(d && d.amount_musd, 0));
    const aging_days = intOrNull(d && d.aging_days);
    let included_musd = amount_musd;
    let exclusion_reason = null;

    if (category === 'securities_failed_to_deliver' && aging_days !== null && aging_days > DEBIT_AGING_EXCLUSION_DAYS) {
      included_musd = 0;
      exclusion_reason = 'AGED_FTD_EXCLUDED_OVER_30_DAYS';
    } else if (category === 'margin_account_debit') {
      included_musd = amount_musd * (1 - MARGIN_DEBIT_HAIRCUT_PCT / 100);
    }

    return {
      label: (d && d.label) || category, category, amount_musd: r2(amount_musd),
      aging_days, included_musd: r2(included_musd), exclusion_reason,
    };
  });
  const total = lines.reduce((s, l) => s + l.included_musd, 0);
  return { lines, total_debits_musd: r2(total) };
}

export function compute(pp) {
  pp = pp || {};
  const isPab = !!pp.pab_variant;
  const credits = computeCreditItems(pp.credit_items);
  const debits = computeDebitItems(pp.debit_items);
  const depositBalance = Math.max(0, safeNum(pp.reserve_account_balance_musd, 0));

  const netDiff = credits.total_credits_musd - debits.total_debits_musd;
  const reserveRequirement = Math.max(0, netDiff);
  const depositSufficient = depositBalance >= reserveRequirement;
  const surplusShortfall = depositBalance - reserveRequirement;

  const compliance_flags = [];
  if (reserveRequirement === 0) compliance_flags.push('NO_DEPOSIT_REQUIRED_DEBITS_EXCEED_CREDITS');
  compliance_flags.push(depositSufficient ? 'RESERVE_DEPOSIT_SUFFICIENT' : 'RESERVE_DEPOSIT_DEFICIENT');
  if (isPab) compliance_flags.push('PAB_PROPRIETARY_ACCOUNT_OF_BD_VARIANT');
  if (debits.lines.some((l) => l.exclusion_reason === 'AGED_FTD_EXCLUDED_OVER_30_DAYS')) {
    compliance_flags.push('AGED_FTD_DEBITS_EXCLUDED');
  }

  const output_payload = {
    credit_items: credits.lines,
    debit_items: debits.lines,
    total_credits_musd: credits.total_credits_musd,
    total_debits_musd: debits.total_debits_musd,
    reserve_requirement_musd: r2(reserveRequirement),
    reserve_account_balance_musd: r2(depositBalance),
    surplus_shortfall_musd: r2(surplusShortfall),
    deposit_sufficient: depositSufficient,
    pab_variant: isPab,
    rules_version: RULES_VERSION,
    regulatory_basis: 'SEC Rule 15c3-3 Exhibit A customer reserve formula (17 CFR 240.15c3-3).',
    note: 'Simplified computation over a representative subset of Exhibit A credit/debit line items with their prescribed aging and haircut treatments, from caller-supplied line items for one computation date (weekly computation framing). Does not audit the source of the supplied figures and is not a determination of regulatory compliance.',
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
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
