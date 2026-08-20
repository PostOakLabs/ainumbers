/**
 * art-664-loan-servicing-waterfall-recompute.kernel.mjs
 * CORE-VERIFY-BUILD-SPEC.md — loan-servicing payment-application waterfall recompute.
 *
 * Distinct from art-509 (securitisation tranche payout) and RECOMP-WATERFALL-1/RECOMP-TRUSTEE-1
 * (PE distribution / trustee priority-of-payments): those allocate collections ACROSS PARTIES under
 * a priority schedule. This kernel allocates ONE BORROWER'S ONE PAYMENT across escrow/fee/interest/
 * principal buckets under the note's own declared application order — a per-loan servicing question.
 *
 * EVERYTHING EXTERNAL IS A CALLER INPUT. The bucket application order is a contract term declared by
 * the caller (e.g. late_fee, escrow_shortage, escrow, interest, principal) — this kernel never chooses
 * or infers an order, and asserts no universal statutory application order (none exists outside a
 * specific consent order, which is out of scope). Pre-payment bucket balances, the payment amount, and
 * the core-applied breakdown to diff against are likewise all caller-declared.
 *
 * FIXED-POINT MONEY MATH. Every amount crosses the boundary as a non-negative safe-integer number of
 * minor units (cents). No floating-point arithmetic anywhere in compute().
 *
 * NEVER GUESS, NEVER DEFAULT (CORE-VERIFY-BUILD-SPEC.md's top-level doctrine). A bucket named in the
 * declared order with no supplied balance is a missing required input, not a zero — the run reports
 * `verdict: "INDETERMINATE"` and names the missing field rather than allocating against an assumed 0.
 * Likewise, an absent `core_applied` (nothing to diff against) is INDETERMINATE, never treated as a
 * match by omission.
 *
 * FINITE GATE. Malformed input (wrong type, non-integer, negative, duplicate bucket ids) never throws
 * — compute() always returns a defined `output_payload` with the offending field named in
 * `missing_inputs[]` and `verdict: "INDETERMINATE"`.
 *
 * DIFF SCOPE. The diff runs over the UNION of the declared order and whatever buckets `core_applied`
 * actually names — a core that applied funds to a bucket outside the declared order is itself a
 * divergence (computed side = 0 for that bucket), not a silently-ignored extra key.
 *
 * NOT A COMPLIANCE DETERMINATION. A DIVERGES verdict is an arithmetic finding about the declared order
 * and the core's own reported breakdown, never a claim about which figure is legally correct — this
 * tool independently recomputes and receipts; it never audits the vendor or asserts a bug.
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute().
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-664-loan-servicing-waterfall-recompute';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'compute_loan_servicing_waterfall_recompute',
  mandate_type: 'compliance_control',
  gpu: false,
};

/** Non-negative safe-integer minor-units amount. */
function isSafeIntAmount(v) {
  return typeof v === 'number' && Number.isFinite(v) && Number.isSafeInteger(v) && v >= 0;
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * compute(pp) — pure decision kernel.
 * @param {object} pp policy_parameters:
 *   application_order: string[]   — ordered, unique, non-empty bucket ids (contract term).
 *   bucket_balances: { [bucket_id]: integer minor units owed, >= 0 }.
 *   payment_amount: integer minor units, >= 0.
 *   core_applied?: { [bucket_id]: integer minor units } — the core's actual applied breakdown to diff.
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = pp || {};
  const missing_inputs = [];

  // ---- application_order ----
  const rawOrder = Array.isArray(pp.application_order) ? pp.application_order : null;
  let orderValid = !!(rawOrder && rawOrder.length > 0);
  if (orderValid) {
    const seen = new Set();
    for (const b of rawOrder) {
      if (typeof b !== 'string' || b.length === 0 || seen.has(b)) { orderValid = false; break; }
      seen.add(b);
    }
  }
  if (!orderValid) missing_inputs.push('application_order');
  const order = orderValid ? rawOrder : [];

  // ---- payment_amount ----
  const paymentValid = isSafeIntAmount(pp.payment_amount);
  if (!paymentValid) missing_inputs.push('payment_amount');

  // ---- bucket_balances (only the buckets named in the declared order are required) ----
  const balances = isPlainObject(pp.bucket_balances) ? pp.bucket_balances : null;
  if (!balances) missing_inputs.push('bucket_balances');
  let balancesValid = orderValid && !!balances;
  if (orderValid && balances) {
    for (const b of order) {
      if (!isSafeIntAmount(balances[b])) {
        balancesValid = false;
        missing_inputs.push(`bucket_balances.${b}`);
      }
    }
  }

  const inputsReady = orderValid && paymentValid && balancesValid;

  // ---- allocate the payment down the declared bucket order ----
  let computed_applied_by_bucket = null;
  let unapplied_remainder = null;
  if (inputsReady) {
    let remaining = pp.payment_amount;
    const applied = {};
    for (const b of order) {
      const owed = balances[b];
      const amt = Math.min(remaining, owed);
      applied[b] = amt;
      remaining -= amt;
    }
    computed_applied_by_bucket = applied;
    unapplied_remainder = remaining;
  }

  // ---- diff against the core's actual applied breakdown ----
  const coreApplied = isPlainObject(pp.core_applied) ? pp.core_applied : null;
  const per_bucket_deltas = [];
  let verdict;

  if (!inputsReady) {
    verdict = 'INDETERMINATE';
  } else if (!coreApplied) {
    verdict = 'INDETERMINATE';
    missing_inputs.push('core_applied');
  } else {
    const bucketsUnion = new Set([...order, ...Object.keys(coreApplied)]);
    let anyBucketIndeterminate = false;
    for (const b of bucketsUnion) {
      const computedAmt = Object.prototype.hasOwnProperty.call(computed_applied_by_bucket, b)
        ? computed_applied_by_bucket[b]
        : 0;
      const coreAmt = coreApplied[b];
      if (!isSafeIntAmount(coreAmt)) {
        anyBucketIndeterminate = true;
        missing_inputs.push(`core_applied.${b}`);
        continue;
      }
      per_bucket_deltas.push({
        bucket: b,
        in_declared_order: order.includes(b),
        computed_applied: computedAmt,
        core_applied: coreAmt,
        delta: coreAmt - computedAmt,
      });
    }
    if (anyBucketIndeterminate) {
      verdict = 'INDETERMINATE';
    } else {
      verdict = per_bucket_deltas.every((d) => d.delta === 0) ? 'MATCHES' : 'DIVERGES';
    }
  }

  const output_payload = {
    application_order: orderValid ? order : null,
    payment_amount: paymentValid ? pp.payment_amount : null,
    computed_applied_by_bucket,
    unapplied_remainder,
    core_applied: coreApplied,
    per_bucket_deltas,
    verdict,
    missing_inputs,
  };

  const compliance_flags = [];
  if (verdict === 'DIVERGES') compliance_flags.push('waterfall_application_diverges_from_core');
  if (verdict === 'INDETERMINATE') compliance_flags.push('waterfall_recompute_indeterminate_missing_input');

  return { output_payload, compliance_flags };
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
