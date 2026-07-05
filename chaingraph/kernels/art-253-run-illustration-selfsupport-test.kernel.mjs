import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-253-run-illustration-selfsupport-test';
const TOOL_VERSION = '1.0.0';

export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mandate_type: 'compliance_mandate', gpu: false };

// NAIC Model Regulation 582 (Life Insurance Illustrations) self-support test.
// Tests year 15 and year 20 self-support (§8C) and lapse-support (§8D).
// ASOP 24: Actuarial Standard of Practice for Illustrations; NAIC Model #582.
// ZERO PII: projected cash flows and rates only. No policyholder data.

const TABLE_VERSION = 'NAIC-MODEL-582-ILLUSTRATION-TESTS-V1.0-2025';
const TABLE_SOURCE  = 'NAIC Model Regulation 582 §8C Self-Support Test; §8D Lapse-Support Test; ASOP 24 (2014); NAIC Life Insurance Illustrations Model Regulation (2001 revision)';

export function compute(params) {
  const p = params || {};

  // Projected account/policy values -- arrays indexed by policy year 1..N
  const account_values        = _parseArr(p.account_values);
  const premium_payments      = _parseArr(p.premium_payments);
  const cost_of_insurance     = _parseArr(p.cost_of_insurance);
  const expense_charges       = _parseArr(p.expense_charges);
  const credited_interest     = _parseArr(p.credited_interest);

  // Policy mechanics
  const face_amount           = _finite(p.face_amount, 0);
  const lapse_rates           = _parseArr(p.lapse_rates); // per-year lapse probability (0..1)
  const policy_years          = Math.max(account_values.length, premium_payments.length, 20);

  // §8C Self-Support: discounted value of all benefits + expenses <= discounted value of premiums
  // Simplification: year-15 and year-20 breakeven -- account value at test year must be >= 0
  // using non-guaranteed elements (the conservative/illustrated rates already embedded in inputs)
  const yr15_idx = 14; // 0-based
  const yr20_idx = 19;

  const av_yr15 = account_values.length > yr15_idx ? _finite(account_values[yr15_idx], null) : null;
  const av_yr20 = account_values.length > yr20_idx ? _finite(account_values[yr20_idx], null) : null;

  // Self-support: account value >= 0 at test year implies policy funded itself
  const self_support_yr15_pass = av_yr15 !== null ? av_yr15 >= 0 : null;
  const self_support_yr20_pass = av_yr20 !== null ? av_yr20 >= 0 : null;

  // Overall self-support pass: both non-null tests must pass
  let self_support_pass = null;
  if (av_yr15 !== null && av_yr20 !== null) {
    self_support_pass = self_support_yr15_pass && self_support_yr20_pass;
  } else if (av_yr15 !== null) {
    self_support_pass = self_support_yr15_pass;
  }

  // §8D Lapse-Support: illustrated benefits must not rely on lapsing policies' forfeited values
  // Proxy: compute lapse-weighted accumulated account value; if it materially exceeds pure account value
  // at year 20, the illustration is lapse-supported (impermissible for non-universal-life products)
  let lapse_support_flag = false;
  let lapse_adjusted_av_yr20 = av_yr20;

  if (lapse_rates.length > 0 && av_yr20 !== null) {
    // Simple lapse-persistence factor: product of (1 - lapse_rate) through year 20
    let persistence = 1;
    for (let y = 0; y < Math.min(lapse_rates.length, yr20_idx + 1); y++) {
      persistence *= (1 - Math.max(0, Math.min(1, _finite(lapse_rates[y], 0))));
    }
    // If lapse-free av_yr20 > lapse-adjusted av_yr20 by > 10%, flag as potentially lapse-supported
    const lapse_free_scale = persistence > 0 ? av_yr20 / persistence : av_yr20;
    lapse_adjusted_av_yr20 = _round2(lapse_free_scale);
    lapse_support_flag = lapse_free_scale > av_yr20 * 1.1 && av_yr20 > 0;
  }

  // Cumulative diagnostics (sum over available years)
  const total_premiums  = _sumArr(premium_payments);
  const total_coi       = _sumArr(cost_of_insurance);
  const total_expenses  = _sumArr(expense_charges);
  const total_interest  = _sumArr(credited_interest);

  const cumulative_net = _round2(total_premiums + total_interest - total_coi - total_expenses);

  // Overall illustration status
  const illustration_valid =
    self_support_pass === true && !lapse_support_flag;

  const issues = [];
  if (self_support_yr15_pass === false) issues.push('Year-15 self-support test FAIL: projected account value < 0 at year 15');
  if (self_support_yr20_pass === false) issues.push('Year-20 self-support test FAIL: projected account value < 0 at year 20');
  if (lapse_support_flag)               issues.push('Lapse-support concern: year-20 value may rely on lapsed-policy forfeitures (§8D)');
  if (av_yr15 === null)                  issues.push('Insufficient account_values length for year-15 test (need >= 15 values)');
  if (av_yr20 === null)                  issues.push('Insufficient account_values length for year-20 test (need >= 20 values)');
  if (face_amount <= 0)                  issues.push('face_amount must be > 0 for a valid illustration');

  return {
    illustration_valid,
    self_support_pass,
    self_support_yr15_pass,
    self_support_yr20_pass,
    account_value_yr15: av_yr15,
    account_value_yr20: av_yr20,
    lapse_support_flag,
    lapse_adjusted_av_yr20,
    cumulative_net,
    total_premiums:  _round2(total_premiums),
    total_coi:       _round2(total_coi),
    total_expenses:  _round2(total_expenses),
    total_interest:  _round2(total_interest),
    face_amount,
    policy_years_provided: account_values.length,
    issues,
    table_version:   TABLE_VERSION,
    table_source:    TABLE_SOURCE,
    regulatory_basis:'NAIC Model Regulation 582 §8C (self-support test at year 15 and year 20) and §8D (lapse-support prohibition); ASOP 24 (Actuarial Standard of Practice for Illustrations). Applicable to life insurance illustration requirements in all US states adopting Model 582.',
    pii_note:        'ZERO PII: projected cash flows and policy mechanics only. No policyholder name, age, health classification, or personal data enters this kernel.',
    not_legal_advice:'Not legal or actuarial advice. Final illustration certification requires review and sign-off by a qualified actuary per ASOP 24 and applicable state regulations.',
  };
}

function _parseArr(v) {
  if (!Array.isArray(v)) return [];
  return v.map(x => _finite(x, 0));
}

function _sumArr(arr) {
  return arr.reduce((s, x) => s + x, 0);
}

function _finite(v, def) {
  const n = Number(v);
  return (isFinite(n) && !isNaN(n)) ? n : def;
}

function _round2(v) { return Math.round(v * 100) / 100; }

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const output_payload = compute(pp);
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
    compliance_flags: [],
    compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
