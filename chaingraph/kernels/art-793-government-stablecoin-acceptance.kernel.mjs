import { executionHash } from './_hash.mjs';

// art-793-government-stablecoin-acceptance — acceptor-side stablecoin acceptance audit.
// Assesses an aggregate daily receipt ledger against a written acceptance policy
// (eligible tokens, conversion window, unconverted holding cap, refund rule,
// custody) and reconciles tokens received, converted and credited in fiat.
// AGGREGATE ONLY: no payer identifiers exist anywhere in the input schema, and
// none are accepted. All money is integer minor units; the rounding rule is
// exactness — every identity check is an exact integer comparison and no value
// is ever rounded. Refund handling is symmetric: an in_kind refund returns
// tokens (reduces carry) and credits no fiat; a fiat refund keeps the tokens
// out of the token ledger but must appear as a fiat outflow the caller reports
// in fiat_credited_value policy accounting. This kernel only checks the token
// identity and the fiat-credit tolerance; it prices nothing.

const TOOL_ID = 'art-793-government-stablecoin-acceptance';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'assess_gov_stablecoin_accept',
  mandate_type: 'compliance_control', gpu: false,
};

// ---------- refusal plumbing ----------
/** @type {(reason: string, text: string) => { output_payload: object, compliance_flags: string[] }} */
function refused(reason, text) {
  return {
    output_payload: {
      outcome: 'refused',
      refusal_reason: reason,
      refusal_text: text,
      profile: null,
      rounding_rule: 'integer minor units; exact integer identity checks; no rounding applied',
      policy_conformance: null,
      reconciliation: null,
      exposure: null,
      totals: null,
      verdict: 'REFUSED',
    },
    compliance_flags: [reason],
  };
}

function isNonNegInt(v) { return typeof v === 'number' && Number.isInteger(v) && v >= 0; }

function isDayStr(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v); }

/**
 * compute(pp) — pure decision kernel.
 * pp.profile: string (only "generic" ships; jurisdiction profiles are caller data)
 * pp.policy: {
 *   eligible_tokens: [{token_code, issuer_regime, reserve_attestation_ref?}],
 *   conversion_window_hours, max_unconverted_value,
 *   refund_rule: "in_kind"|"fiat", custody: "self"|"custodian",
 *   fiat_tolerance_value?: int >= 0 (default 0)
 * }
 * pp.receipts: [{token_code, day?, received_value, converted_value,
 *   fiat_credited_value, refunds_value, max_hours_to_conversion,
 *   conversion_rate_variance_bp}] — one aggregate row per token per day,
 *   in day order per token.
 */
// explicit null is given exactly the absent form's answer everywhere below
// (MR-R4-NULL-REGRESSION-GATE-1): null profile, null fiat_tolerance_value and
// null receipt day take the absent/default path, not a refusal third state.
export function compute(pp) {
  pp = pp || {};
  const policy = pp.policy;
  const receipts = pp.receipts;

  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
    return refused('REFUSED_POLICY_MISSING', 'policy object is required');
  }
  if (pp.profile !== undefined && pp.profile !== null && typeof pp.profile !== 'string') {
    return refused('REFUSED_PROFILE_INVALID', 'profile must be a string');
  }
  if (!Array.isArray(policy.eligible_tokens) || policy.eligible_tokens.length === 0) {
    return refused('REFUSED_ELIGIBLE_TOKENS', 'policy.eligible_tokens must be a non-empty array');
  }
  for (const t of policy.eligible_tokens) {
    if (!t || typeof t !== 'object' || typeof t.token_code !== 'string' || t.token_code.length === 0
      || typeof t.issuer_regime !== 'string' || t.issuer_regime.length === 0) {
      return refused('REFUSED_ELIGIBLE_TOKENS', 'every eligible token needs a token_code and issuer_regime string');
    }
  }
  if (!isNonNegInt(policy.conversion_window_hours)) {
    return refused('REFUSED_WINDOW_INVALID', 'policy.conversion_window_hours must be a non-negative integer');
  }
  if (!isNonNegInt(policy.max_unconverted_value)) {
    return refused('REFUSED_CAP_INVALID', 'policy.max_unconverted_value must be a non-negative integer');
  }
  if (policy.refund_rule !== 'in_kind' && policy.refund_rule !== 'fiat') {
    return refused('REFUSED_REFUND_RULE', 'policy.refund_rule must be "in_kind" or "fiat"');
  }
  if (policy.custody !== 'self' && policy.custody !== 'custodian') {
    return refused('REFUSED_CUSTODY', 'policy.custody must be "self" or "custodian"');
  }
  const fiatTol = (policy.fiat_tolerance_value === undefined || policy.fiat_tolerance_value === null) ? 0 : policy.fiat_tolerance_value;
  if (!isNonNegInt(fiatTol)) {
    return refused('REFUSED_TOLERANCE_INVALID', 'policy.fiat_tolerance_value must be a non-negative integer');
  }
  if (!Array.isArray(receipts)) {
    return refused('REFUSED_RECEIPTS_MISSING', 'receipts array is required (possibly empty)');
  }
  for (const r of receipts) {
    if (!r || typeof r !== 'object') return refused('REFUSED_RECEIPT_MALFORMED', 'every receipt must be an object');
    if (typeof r.token_code !== 'string' || r.token_code.length === 0) {
      return refused('REFUSED_TOKEN_CODE_MISSING', 'every receipt needs a token_code');
    }
    for (const f of ['received_value', 'converted_value', 'fiat_credited_value', 'refunds_value', 'max_hours_to_conversion', 'conversion_rate_variance_bp']) {
      if (!isNonNegInt(r[f])) return refused('REFUSED_NON_INTEGER_MONEY', 'receipt field ' + f + ' must be a non-negative integer (minor units / hours / bp)');
    }
    if (r.day !== undefined && r.day !== null && !isDayStr(r.day)) {
      return refused('REFUSED_DAY_MALFORMED', 'receipt day, when present, must be a YYYY-MM-DD string');
    }
  }
  // day order per token (array order is the reconciliation order)
  const lastDay = Object.create(null);
  for (const r of receipts) {
    if (r.day !== undefined && r.day !== null) {
      if (lastDay[r.token_code] !== undefined && r.day < lastDay[r.token_code]) {
        return refused('REFUSED_DAY_ORDER', 'receipts must be in non-decreasing day order per token_code');
      }
      lastDay[r.token_code] = r.day;
    }
  }

  // ---------- assessment ----------
  const eligible = new Set(policy.eligible_tokens.map((t) => t.token_code));
  const ineligibleTotals = new Map(); // token_code -> received total
  const outsideWindow = [];
  const capBreaches = [];
  const breaks = [];
  const carry = Object.create(null);
  const worstVariance = { bp: -1, token_code: null };
  const totals = { received_value: 0, converted_value: 0, fiat_credited_value: 0, refunds_value: 0, closing_unconverted_value: 0 };
  let peak = 0;

  for (const r of receipts) {
    totals.received_value += r.received_value;
    totals.converted_value += r.converted_value;
    totals.fiat_credited_value += r.fiat_credited_value;
    totals.refunds_value += r.refunds_value;

    if (!eligible.has(r.token_code)) {
      ineligibleTotals.set(r.token_code, (ineligibleTotals.get(r.token_code) || 0) + r.received_value);
    }
    if (r.max_hours_to_conversion > policy.conversion_window_hours) {
      outsideWindow.push({
        token_code: r.token_code, day: r.day || null,
        received_value: r.received_value,
        max_hours_to_conversion: r.max_hours_to_conversion,
        conversion_window_hours: policy.conversion_window_hours,
      });
    }
    if (r.conversion_rate_variance_bp > worstVariance.bp) {
      worstVariance.bp = r.conversion_rate_variance_bp;
      worstVariance.token_code = r.token_code;
    }

    // token carry reconciliation, in array order per token
    const opening = carry[r.token_code] || 0;
    let closing = opening + r.received_value - r.converted_value - r.refunds_value;
    if (closing < 0) {
      breaks.push({
        kind: 'RECEIPT_IDENTITY_BREAK', token_code: r.token_code, day: r.day || null,
        delta_value: closing,
        detail: 'converted plus refunds exceed tokens received plus carry for this line',
      });
      closing = 0; // clamp so subsequent lines stay assessable; the break is recorded
    }
    carry[r.token_code] = closing;
    if (closing > peak) peak = closing;
    if (closing > policy.max_unconverted_value) {
      capBreaches.push({
        token_code: r.token_code, day: r.day || null,
        closing_unconverted_value: closing,
        max_unconverted_value: policy.max_unconverted_value,
      });
    }

    const fiatDelta = r.converted_value - r.fiat_credited_value;
    if (fiatDelta > fiatTol) {
      breaks.push({ kind: 'FIAT_CREDIT_SHORT', token_code: r.token_code, day: r.day || null, delta_value: fiatDelta, detail: 'fiat credited is short of converted value beyond tolerance' });
    } else if (-fiatDelta > fiatTol) {
      breaks.push({ kind: 'FIAT_CREDIT_OVER', token_code: r.token_code, day: r.day || null, delta_value: -fiatDelta, detail: 'fiat credited exceeds converted value beyond tolerance' });
    }
  }
  totals.closing_unconverted_value = Object.values(carry).reduce((a, b) => a + b, 0);

  const policy_conformance = {
    ineligible_tokens_received: Array.from(ineligibleTotals.entries()).map(([token_code, total_received_value]) => ({ token_code, total_received_value })),
    conversions_outside_window: outsideWindow,
    cap_breach_days: capBreaches,
  };
  const reconciliation = {
    identity: 'per line: received_value = converted_value + refunds_value + carry change; converted_value = fiat_credited_value within fiat_tolerance_value',
    fiat_tolerance_value: fiatTol,
    breaks,
  };
  const exposure = {
    peak_unconverted_value: peak,
    worst_conversion_variance_bp: worstVariance.bp < 0 ? 0 : worstVariance.bp,
    worst_variance_token_code: worstVariance.bp < 0 ? null : worstVariance.token_code,
  };

  const policyViolations = policy_conformance.ineligible_tokens_received.length > 0
    || policy_conformance.conversions_outside_window.length > 0
    || policy_conformance.cap_breach_days.length > 0;
  const verdict = policyViolations ? 'NONCONFORMING'
    : (breaks.length > 0 ? 'CONFORMS_WITH_BREAKS' : 'CONFORMS');

  return {
    output_payload: {
      outcome: 'assessed',
      profile: typeof pp.profile === 'string' ? pp.profile : 'generic',
      rounding_rule: 'integer minor units; exact integer identity checks; no rounding applied',
      policy_echo: {
        eligible_tokens: policy.eligible_tokens,
        conversion_window_hours: policy.conversion_window_hours,
        max_unconverted_value: policy.max_unconverted_value,
        refund_rule: policy.refund_rule,
        custody: policy.custody,
        fiat_tolerance_value: fiatTol,
      },
      policy_conformance,
      reconciliation,
      exposure,
      totals,
      verdict,
    },
    compliance_flags: verdict === 'CONFORMS' ? [] : [verdict],
  };
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
