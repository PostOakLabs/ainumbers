/**
 * art-550-reg-e-remittance-disclosure-check.kernel.mjs
 * XBORDER-PAYMENTS-BUILD-SPEC.md §2.2 -- US Remittance Transfer Rule (Reg E
 * Subpart B, 12 CFR 1005.31) disclosure arithmetic recompute.
 *
 * MANDATE. Dodd-Frank §1073, implemented as Reg E Subpart B (12 CFR
 * 1005.30-1005.36), in force since 2013 -- long-standing, not a horizon item.
 *
 * SHAPE. Deterministic recompute of the disclosure arithmetic identity
 * `amount_received = (send_amount - total_fees) * exchange_rate` -- verifies
 * a provider's DISCLOSED numbers are internally consistent. This kernel never
 * fetches a live rate and never generates a fresh disclosure of its own (that
 * is art-248-compute-remittance-disclosure's job); it checks a caller-supplied
 * disclosed figure against the recomputed identity and reports the exact
 * discrepancy, if any.
 *
 * FIXED-POINT MONEY MATH. All money amounts are declared as integer CENTS,
 * never a float dollar amount, so no engine-parity rounding drift is possible
 * on the additions/subtractions. The exchange rate is declared as an integer
 * scaled by 1,000,000 (`exchange_rate_disclosed_e6`) for the same reason.
 * `amount_recipient_recomputed_cents = Math.round(net_cents *
 * exchange_rate_disclosed_e6 / 1e6)` -- one Math.round call, IEEE-754 double
 * arithmetic, deterministic across node/bun/quickjs (same pattern already
 * proven in art-248's _round2/_round6 helpers). No branch divides by a
 * caller-controlled value (only the fixed constant 1e6), so the finite gate
 * holds for every input shape, including all-rejected input.
 *
 * §25 (PII). Currency amounts and a disclosed exchange rate carry no
 * account/name/identity fields -- no natural person is named or derivable
 * from a send amount, a fee total, a rate, and a disclosed recipient amount.
 * §25 does not apply.
 *
 * §18. Ships compute_proof_ready:"deferred" -- new shard, awaiting the async
 * GPU proving queue (S18 steady-state); XBORDER-VENDOR-1 is the row that
 * re-vendors after this and its sibling shards land, raising the ratchet
 * ceiling. This row does not bump any §18 baseline itself.
 *
 * NO CLOCK. `as_of` is a caller-declared input; compute() never reads a
 * clock. Zero network, zero randomness, zero wall-clock reads inside
 * compute().
 *
 * Spec: XBORDER-PAYMENTS-BUILD-SPEC.md §2.2.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-550-reg-e-remittance-disclosure-check';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'check_reg_e_remittance_disclosure', mandate_type: 'compliance_mandate', gpu: false };

const REG_E_BASIS = '12 CFR §1005.31 (Reg E Subpart B, implementing Dodd-Frank §1073), disclosure arithmetic identity: amount_received = (send_amount - total_fees) x exchange_rate';

function isoDateOrNull(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null; }

function toCentsOrNull(v, where, rejected) {
  if (typeof v === 'number' && Number.isFinite(v) && Number.isSafeInteger(v) && v >= 0) return v;
  rejected.push({ where, reason: 'absent or not a non-negative integer number of cents', supplied: v === undefined ? null : v });
  return null;
}
function toRateE6OrNull(v, where, rejected) {
  if (typeof v === 'number' && Number.isFinite(v) && Number.isSafeInteger(v) && v > 0) return v;
  rejected.push({ where, reason: 'absent or not a positive integer exchange rate scaled by 1e6', supplied: v === undefined ? null : v });
  return null;
}
function toSignedCentsOrNull(v, where, rejected) {
  if (typeof v === 'number' && Number.isFinite(v) && Number.isSafeInteger(v)) return v;
  rejected.push({ where, reason: 'absent or not an integer number of cents', supplied: v === undefined ? null : v });
  return null;
}
function centsDisplay(cents) {
  const neg = cents < 0;
  const abs = neg ? -cents : cents;
  const whole = Math.trunc(abs / 100);
  const frac = abs - whole * 100;
  return (neg ? '-' : '') + String(whole) + '.' + String(frac).padStart(2, '0');
}
function rateDisplay(e6) {
  const whole = Math.trunc(e6 / 1000000);
  const frac = e6 - whole * 1000000;
  return String(whole) + '.' + String(frac).padStart(6, '0');
}

export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];

  const as_of = isoDateOrNull(pp.as_of);

  const send_amount_cents = toCentsOrNull(pp.send_amount_cents, 'send_amount_cents', rejected_inputs) ?? 0;
  const total_fees_disclosed_cents = toCentsOrNull(pp.total_fees_disclosed_cents, 'total_fees_disclosed_cents', rejected_inputs) ?? 0;
  const exchange_rate_disclosed_e6 = toRateE6OrNull(pp.exchange_rate_disclosed_e6, 'exchange_rate_disclosed_e6', rejected_inputs);
  const amount_recipient_disclosed_cents = toSignedCentsOrNull(pp.amount_recipient_disclosed_cents, 'amount_recipient_disclosed_cents', rejected_inputs);

  const inputs_insufficient = rejected_inputs.length > 0;

  const net_cents = inputs_insufficient ? null : (send_amount_cents - total_fees_disclosed_cents);
  const amount_recipient_recomputed_cents = (net_cents === null || exchange_rate_disclosed_e6 === null)
    ? null
    : Math.round((net_cents * exchange_rate_disclosed_e6) / 1000000);

  const discrepancy_amount_cents = (amount_recipient_recomputed_cents === null || amount_recipient_disclosed_cents === null)
    ? null
    : (amount_recipient_disclosed_cents - amount_recipient_recomputed_cents);

  const disclosure_consistent = discrepancy_amount_cents === null ? null : (discrepancy_amount_cents === 0);

  const compliance_flags = [];
  if (inputs_insufficient) compliance_flags.push('REGE_INPUTS_INSUFFICIENT');
  else compliance_flags.push(disclosure_consistent ? 'REGE_DISCLOSURE_CONSISTENT' : 'REGE_DISCLOSURE_DISCREPANCY');

  const rationale = [];
  if (inputs_insufficient) {
    rationale.push('One or more required declared inputs is missing or malformed; see rejected_inputs. No disclosure identity can be recomputed against undeclared amounts or rate.');
  } else {
    rationale.push(`Disclosed: send ${centsDisplay(send_amount_cents)}, total fees ${centsDisplay(total_fees_disclosed_cents)}, exchange rate ${rateDisplay(exchange_rate_disclosed_e6)}, recipient amount ${centsDisplay(amount_recipient_disclosed_cents)}.`);
    rationale.push(`amount_received_recomputed = (send ${centsDisplay(send_amount_cents)} - fees ${centsDisplay(total_fees_disclosed_cents)}) x rate ${rateDisplay(exchange_rate_disclosed_e6)} = ${centsDisplay(amount_recipient_recomputed_cents)}.`);
    rationale.push(disclosure_consistent
      ? 'Disclosed recipient amount matches the recomputed identity exactly. disclosure_consistent = true.'
      : `Disclosed recipient amount ${centsDisplay(amount_recipient_disclosed_cents)} does not match the recomputed ${centsDisplay(amount_recipient_recomputed_cents)}; discrepancy = ${centsDisplay(discrepancy_amount_cents)}.`);
  }
  rationale.push('This is a deterministic recompute of the disclosed arithmetic identity, never a live rate lookup and never a fresh disclosure generator (see art-248-compute-remittance-disclosure for that). It issues no verdict on whether the provider must re-disclose -- only whether the numbers already disclosed are internally consistent.');
  rationale.push(REG_E_BASIS);

  const output_payload = {
    as_of,
    send_amount_cents,
    total_fees_disclosed_cents,
    exchange_rate_disclosed_e6,
    exchange_rate_disclosed_display: exchange_rate_disclosed_e6 === null ? null : rateDisplay(exchange_rate_disclosed_e6),
    amount_recipient_disclosed_cents,
    amount_recipient_recomputed_cents,
    amount_recipient_recomputed_display: amount_recipient_recomputed_cents === null ? null : centsDisplay(amount_recipient_recomputed_cents),
    disclosure_consistent,
    discrepancy_amount_cents,
    discrepancy_amount_display: discrepancy_amount_cents === null ? null : centsDisplay(discrepancy_amount_cents),
    regulatory_basis: REG_E_BASIS,
    rejected_inputs,
    rationale,
    note: 'Deterministic recompute of the Reg E Subpart B (12 CFR 1005.31) disclosure arithmetic identity amount_received = (send_amount - total_fees) x exchange_rate against a caller-disclosed recipient amount. Zero live rate calls; verifies internal consistency of numbers already disclosed, never generates a fresh disclosure.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null, execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
