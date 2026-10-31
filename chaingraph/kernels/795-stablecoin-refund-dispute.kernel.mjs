import { executionHash } from './_hash.mjs';

// 795-stablecoin-refund-dispute — scaffolded by scripts/new-kernel.mjs (KERNEL-SCAFFOLD-1). Fill in:
//   1. compute(pp) below — replace the NOT_IMPLEMENTED throw with real logic.
//   2. chaingraph/kernels/fixtures/795-stablecoin-refund-dispute.fixtures.json — replace the placeholder
//      vector with real golden vectors (name, policy_parameters, output_payload).
//   3. chaingraph/kernels/__proptests__/795-stablecoin-refund-dispute.proptest.mjs — replace the
//      placeholder property with real class-A/B/K properties per FV-PBT-FLOOR-BUILD-SPEC.md.
//   4. chaingraph/graph/nodes/795-stablecoin-refund-dispute.json — replace TODO-CITE / standards_basis and
//      the description once compute() is real.
// Run `node scripts/kernel-preflight.mjs 795-stablecoin-refund-dispute` repeatedly while doing all of the
// above — RIDER-KERNEL.md explains why each check exists.
//
// DETERMINISM: compute() must be a PURE function of pp — no Date.now()/Math.random(), no
// network, no filesystem. It runs unmodified inside the QuickJS-ng zkVM guest, which is a
// STRICT SUBSET of a browser/Node global environment: TextEncoder/atob/btoa/URL are ALL
// ABSENT (chaingraph/kernels/check-guest-builtin-safety.mjs enforces this per kernel, over
// every fixture vector, in milliseconds — never discover this after a multi-hour GPU
// prove). If compute() needs UTF-8 bytes, call the pure-JS encoder below instead of
// `new TextEncoder()` — validated byte-identical to TextEncoder.encode() across
// ASCII/2-3-4-byte sequences/surrogate pairs/lone surrogates (22 named + 20,000 fuzz
// cases, 0 mismatches, ART595-ART590-UTF8-FIX-1). Delete this helper if compute() never
// needs it — an unused function is dead weight, not a safety net.
function utf8ToBytes(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = i + 1 < str.length ? str.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = (code - 0xd800) * 0x400 + (next - 0xdc00) + 0x10000;
        i++;
      } else {
        code = 0xfffd; // unpaired high surrogate
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      code = 0xfffd; // lone low surrogate
    }
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return Uint8Array.from(bytes);
}
void utf8ToBytes; // keep the helper available without tripping an unused-var lint before compute() calls it

const TOOL_ID = '795-stablecoin-refund-dispute';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_stablecoin_refunds',
  mandate_type: 'compliance_control', gpu: false,
};

/**
 * compute(pp) — pure decision kernel. Fill this in; delete the NOT_IMPLEMENTED throw.
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */

// ---- rule keys (mechanism labels; standard citations live in node metadata) ----
const RULE_LOCKED = 'payment_still_locked';
const RULE_ALL_OR_NOTHING = 'refund_is_all_or_nothing';
const RULE_FEE = 'early_withdrawal_fee_bp';
const RULE_STATE = 'terminal_state_mismatch';
const RULE_AMOUNT = 'reported_amount_mismatch';

function isIdentifierLike(v) {
  if (typeof v !== 'string') return false;
  if (/^0x[0-9a-fA-F]{40}$/.test(v)) return true;   // address-shaped
  if (/^0x[0-9a-fA-F]{64}$/.test(v)) return true;   // tx-hash-shaped
  if (/^[A-Za-z0-9_-]{40,}$/.test(v)) return true;  // long identifier blob
  return false;
}

function divFloor(num, den) { return Math.floor(num / den); }

function computeOne(pay, params) {
  const amount = pay.amount_minor;
  const lockEnd = pay.paid_at + params.lock_period_seconds;
  const asOf = (typeof params.as_of_seconds === 'number') ? params.as_of_seconds : null;
  const decisions = Array.isArray(pay.arbiter_decisions) ? pay.arbiter_decisions : [];
  const breaks = [];

  let refunded = 0;
  for (const d of decisions) {
    if (typeof d.refund_minor === 'number' && d.refund_minor > 0) refunded += d.refund_minor;
  }
  // all-or-nothing: an arbiter refund under the pinned protocol returns the full payment
  if (decisions.length > 0 && !params.partial_refunds_allowed) {
    for (const d of decisions) {
      if (d.refund_minor !== amount) {
        breaks.push({ rule: RULE_ALL_OR_NOTHING, field: 'arbiter_decisions.refund_minor', reported: d.refund_minor, expected: amount });
      }
    }
    refunded = amount;
  }
  if (refunded > amount) refunded = amount;

  let terminal_state, fee_minor = 0, released_minor = 0, held_minor = 0;
  const earlyAt = (typeof pay.early_withdrawal_at === 'number') ? pay.early_withdrawal_at : null;
  const earlyVisible = earlyAt !== null && (asOf === null || earlyAt <= asOf);
  const lockedAtReport = asOf !== null && asOf < lockEnd;

  if (refunded >= amount && refunded > 0) {
    terminal_state = 'REFUNDED';
  } else if (earlyVisible) {
    terminal_state = 'EARLY_WITHDRAWN';
    fee_minor = divFloor(amount * params.early_withdrawal_fee_bp, 10000); // documented rounding: floor
    released_minor = amount - refunded - fee_minor;
  } else if (refunded > 0) {
    terminal_state = 'PARTIALLY_REFUNDED';
    if (lockedAtReport) { held_minor = amount - refunded; }
    else { released_minor = amount - refunded; }
  } else if (lockedAtReport) {
    terminal_state = 'HELD';
    held_minor = amount;
  } else {
    terminal_state = 'RELEASED';
    released_minor = amount;
  }

  // reported-vs-expected breaks
  if (pay.reported_state != null && pay.reported_state !== terminal_state) {
    breaks.push({ rule: (terminal_state === 'HELD' && pay.reported_state === 'RELEASED') ? RULE_LOCKED : RULE_STATE,
      field: 'reported_state', reported: pay.reported_state, expected: terminal_state });
  }
  if (pay.reported_refunded_minor != null && pay.reported_refunded_minor !== refunded) {
    breaks.push({ rule: RULE_AMOUNT, field: 'reported_refunded_minor', reported: pay.reported_refunded_minor, expected: refunded });
  }
  if (pay.reported_released_minor != null && pay.reported_released_minor !== released_minor) {
    breaks.push({ rule: (terminal_state === 'HELD' && pay.reported_released_minor > 0) ? RULE_LOCKED : RULE_AMOUNT,
      field: 'reported_released_minor', reported: pay.reported_released_minor, expected: released_minor });
  }

  return { payment_ref: pay.payment_ref, terminal_state, refunded_minor: refunded, released_minor, fee_minor, held_minor, breaks };
}

export function compute(pp) {
  pp = pp || {};
  const profile = pp.profile;
  const params = pp.params || {};
  const payments = Array.isArray(pp.payments) ? pp.payments : null;

  if (profile !== 'refund_protocol_a7ae494' && profile !== 'generic') {
    return { output_payload: { refused: true, reason: 'unknown_profile', expected_profile: 'refund_protocol_a7ae494 | generic' }, compliance_flags: ['input_refused'] };
  }
  if (typeof params.lock_period_seconds !== 'number' || params.lock_period_seconds < 0 ||
      typeof params.early_withdrawal_fee_bp !== 'number' || params.early_withdrawal_fee_bp < 0 || params.early_withdrawal_fee_bp > 10000 ||
      typeof params.partial_refunds_allowed !== 'boolean') {
    return { output_payload: { refused: true, reason: 'invalid_params' }, compliance_flags: ['input_refused'] };
  }
  if (!payments || payments.length === 0) {
    return { output_payload: { refused: true, reason: 'no_payments' }, compliance_flags: ['input_refused'] };
  }

  for (const p of payments) {
    if (!p || typeof p.amount_minor !== 'number' || p.amount_minor <= 0 || !Number.isInteger(p.amount_minor) ||
        typeof p.paid_at !== 'number' || p.paid_at < 0) {
      return { output_payload: { refused: true, reason: 'invalid_payment_record' }, compliance_flags: ['input_refused'] };
    }
  }

  const identRefs = [];
  for (const p of payments) {
    if (isIdentifierLike(p.payment_ref)) identRefs.push(1);
  }
  if (identRefs.length > 0) {
    return { output_payload: { refused: true, reason: 'identifier_like_payment_ref', refused_count: identRefs.length }, compliance_flags: ['input_refused'] };
  }

  const expected = [];
  const breaks = [];
  const perPayment = [];
  let totPaid = 0, totRef = 0, totRel = 0, totFee = 0, totHeld = 0;
  let reportedConservative = true;

  for (const p of payments) {
    const r = computeOne(p, params);
    expected.push({ payment_ref: p.payment_ref, terminal_state: r.terminal_state, refunded_minor: r.refunded_minor, released_minor: r.released_minor, fee_minor: r.fee_minor, held_minor: r.held_minor });
    for (const b of r.breaks) breaks.push(Object.assign({ payment_ref: p.payment_ref }, b));

    const sum = r.refunded_minor + r.released_minor + r.fee_minor + r.held_minor;
    perPayment.push({ payment_ref: p.payment_ref, paid_minor: p.amount_minor, refunded_minor: r.refunded_minor, released_minor: r.released_minor, fee_minor: r.fee_minor, held_minor: r.held_minor, balanced: sum === p.amount_minor });
    totPaid += p.amount_minor; totRef += r.refunded_minor; totRel += r.released_minor; totFee += r.fee_minor; totHeld += r.held_minor;

    const repRef = (p.reported_refunded_minor != null) ? p.reported_refunded_minor : r.refunded_minor;
    const repRel = (p.reported_released_minor != null) ? p.reported_released_minor : r.released_minor;
    if (repRef + repRel > p.amount_minor) reportedConservative = false;
  }

  const balanced = (totRef + totRel + totFee + totHeld) === totPaid;
  const conservation = {
    per_payment: perPayment,
    total: { paid_minor: totPaid, refunded_minor: totRef, released_minor: totRel, fee_minor: totFee, held_minor: totHeld, balanced },
    balanced,
  };

  let verdict;
  if (breaks.length === 0) verdict = 'CONSISTENT';
  else if (reportedConservative) verdict = 'CONSISTENT_WITH_BREAKS';
  else verdict = 'INCONSISTENT';

  return {
    output_payload: {
      refused: false,
      profile,
      rules_basis: profile === 'generic' ? 'caller_declared' : 'refund_protocol_pinned_a7ae494',
      fee_rounding: 'floor(amount_minor * early_withdrawal_fee_bp / 10000)',
      arbiter_role: params.arbiter_role != null ? String(params.arbiter_role) : null,
      expected, breaks, conservation, verdict,
    },
    compliance_flags: breaks.length > 0 ? ['reported_state_breaks'] : [],
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
