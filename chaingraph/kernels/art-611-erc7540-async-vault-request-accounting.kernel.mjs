import { executionHash } from './_hash.mjs';

// art-611 -- ERC-7540 Async-Vault Request Accounting: pure integer decision kernel.
// ETHMATH-WAVE-BUILD-SPEC.md section 1, kernel B. All arithmetic is BigInt over uint256; there is
// no IEEE-754 anywhere in this kernel.
//
// ERC-7540 (Status: Final, Created 2023-10-18, licensed CC0-1.0; text retrieved from
// https://eips.ethereum.org/EIPS/eip-7540 on 2026-08-11) extends ERC-4626 with an asynchronous
// request lifecycle. The three states and the invariants this kernel recomputes against:
//
//   Pending   -- requestDeposit / requestRedeem raises pendingDepositRequest /
//                pendingRedeemRequest.
//   Claimable -- the vault moves the request across; the amount leaves the pending view and
//                appears in claimableDepositRequest / claimableRedeemRequest. All four views
//                "MUST NOT show any variations depending on the caller", and each EXCLUDES the
//                other state's amount -- pending and claimable are disjoint buckets, never
//                overlapping totals.
//   Claimed   -- deposit/mint (deposit leg) or redeem/withdraw (redeem leg) finalise it.
//                "Requests MUST NOT skip or otherwise short-circuit the Claim state."
//
// requestId == 0 is the aggregate convention: "the Vault MUST use purely the `controller` to
// discriminate the request state", so pending and claimable aggregate across every request from
// that controller. For a non-zero requestId, "If a Request with `requestId != 0` becomes partially
// claimable, all requests of the same `requestId` MUST become claimable at the same pro-rata rate"
// -- which is the invariant the claim sequence below is checked against.
//
// ⚠ THE ROUNDING DIRECTION FOR A PARTIAL CLAIM IS NOT MANDATED BY ERC-7540. Unlike ERC-4626,
// which fixes a direction per function, ERC-7540 states no rounding rule for splitting a partially
// claimed request. This kernel therefore takes `claim_rounding` as a DECLARED parameter, reports
// which direction it used on every claim, and reports what the other direction would have produced.
// It never presents a direction as standard-mandated, because none is. Defaulting to 'down' follows
// ERC-4626's favour-the-vault rationale for amounts issued to users; that is an inherited
// convention, not a requirement of ERC-7540.
//
// No chain reads: every input is caller-declared. This kernel cannot know whether the declared
// pending/claimable amounts match any deployed vault, when or whether a vault will fulfil a pending
// request (the transition timing is deliberately unspecified by the standard), whether the
// controller is authorised, or whether a claim transaction would succeed. It recomputes the
// standard's request arithmetic over declared state and names each invariant it checked.

const TOOL_ID = 'art-611-erc7540-async-vault-request-accounting';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'recompute_erc7540_request_accounting',
  mandate_type: 'payment_policy',
  gpu: false,
};

const SCOPE_NOTE = 'Recomputes ERC-7540 asynchronous-vault request accounting from caller-declared request state: applies a sequence of claims against the claimable buckets at the implied pro-rata rate, tracks the pending/claimable/claimed split, and checks the standard\'s stated invariants (pending and claimable are disjoint views; a claim never skips the Claim state; a non-zero requestId stays at one pro-rata rate). ERC-7540 mandates NO rounding direction for a partial claim, so the direction here is a declared parameter and the result of the opposite direction is reported alongside it. This kernel does NOT read any chain: it cannot know whether the declared amounts match any deployed vault, when or whether a pending request will be fulfilled (the standard leaves that timing unspecified), whether the controller is authorised, or whether a claim transaction would succeed.';

const MAX_UINT256 = (1n << 256n) - 1n;
const RATE_SCALE = 10n ** 18n;

function parseUint(v) {
  if (v === undefined || v === null) return 0n;
  if (typeof v === 'number') {
    if (!Number.isInteger(v) || v < 0) return null;
    return BigInt(v);
  }
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (t.length === 0) return null;
  try {
    if (/^0x[0-9a-fA-F]+$/.test(t)) {
      const n = BigInt(t);
      return (n >= 0n && n <= MAX_UINT256) ? n : null;
    }
    if (/^[0-9]+$/.test(t)) {
      const n = BigInt(t);
      return (n >= 0n && n <= MAX_UINT256) ? n : null;
    }
  } catch { return null; }
  return null;
}

function str(v, fallback) {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : fallback;
}

function mulDiv(a, b, denom, direction) {
  const prod = a * b;
  const q = prod / denom;
  if (direction === 'up' && q * denom !== prod) return q + 1n;
  return q;
}

// Parse one leg ({pending, claimable_in, claimable_out}) with leg-specific field names.
function parseLeg(raw, names, reasons, label) {
  if (raw === undefined || raw === null) {
    return { present: false, pending: 0n, claimable_in: 0n, claimable_out: 0n };
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    reasons.push(`${label} must be an object with ${names.pending}, ${names.in} and ${names.out}`);
    return null;
  }
  const pending = parseUint(raw[names.pending]);
  const cin = parseUint(raw[names.in]);
  const cout = parseUint(raw[names.out]);
  if (pending === null) reasons.push(`${label}.${names.pending} must be a non-negative uint256`);
  if (cin === null) reasons.push(`${label}.${names.in} must be a non-negative uint256`);
  if (cout === null) reasons.push(`${label}.${names.out} must be a non-negative uint256`);
  if (pending === null || cin === null || cout === null) return null;
  // A claimable bucket is a PAIR: the requested side and the side it converts into at the rate the
  // vault fixed when it made the request claimable. One side non-zero and the other zero means the
  // pair cannot express a rate, so no partial claim against it can be computed.
  if ((cin === 0n) !== (cout === 0n)) {
    reasons.push(`${label}: ${names.in} and ${names.out} must be both zero or both non-zero -- a claimable bucket with only one side declared has no pro-rata rate`);
    return null;
  }
  return { present: true, pending, claimable_in: cin, claimable_out: cout };
}

export function compute(pp) {
  pp = (pp !== null && typeof pp === 'object') ? pp : {};
  const reasons = [];

  const request_id = str(pp.request_id, '0');
  if (!/^(0|[1-9][0-9]*|0x[0-9a-fA-F]+)$/.test(request_id)) {
    reasons.push('request_id, if supplied, must be a non-negative integer as a decimal or 0x-hex string ("0" means the aggregate-by-controller convention)');
  }
  const aggregate_by_controller = request_id === '0' || request_id === '0x0';

  const claim_rounding = pp.claim_rounding === undefined || pp.claim_rounding === null ? 'down' : pp.claim_rounding;
  if (claim_rounding !== 'down' && claim_rounding !== 'up') {
    reasons.push('claim_rounding, if supplied, must be "down" or "up" -- ERC-7540 mandates no direction for a partial claim, so one must be declared');
  }

  // deposit leg: requested in ASSETS, claimed out as SHARES.
  const depositLeg = parseLeg(pp.deposit, { pending: 'pending_assets', in: 'claimable_assets', out: 'claimable_shares' }, reasons, 'deposit');
  // redeem leg: requested in SHARES, claimed out as ASSETS.
  const redeemLeg = parseLeg(pp.redeem, { pending: 'pending_shares', in: 'claimable_shares', out: 'claimable_assets' }, reasons, 'redeem');

  const rawClaims = pp.claims === undefined || pp.claims === null ? [] : pp.claims;
  if (!Array.isArray(rawClaims)) reasons.push('claims, if supplied, must be an array of {leg, unit, amount} entries');

  const parsedClaims = [];
  if (Array.isArray(rawClaims)) {
    for (let i = 0; i < rawClaims.length; i++) {
      const c = rawClaims[i];
      if (c === null || typeof c !== 'object' || Array.isArray(c)) {
        reasons.push(`claims[${i}] must be an object {leg, unit, amount}`);
        continue;
      }
      const leg = str(c.leg, null);
      if (leg !== 'deposit' && leg !== 'redeem') {
        reasons.push(`claims[${i}].leg must be "deposit" or "redeem"`);
        continue;
      }
      // 'requested' claims in the unit the request was made in (assets for deposit, shares for
      // redeem); 'received' claims by naming the output unit instead. Both are legal claim shapes
      // in ERC-7540 -- deposit(assets,..) / mint(shares,..) and withdraw(assets,..) /
      // redeem(shares,..) are the four overloads.
      const unit = str(c.unit, 'requested');
      if (unit !== 'requested' && unit !== 'received') {
        reasons.push(`claims[${i}].unit, if supplied, must be "requested" (deposit: assets, redeem: shares) or "received" (deposit: shares, redeem: assets)`);
        continue;
      }
      const amount = parseUint(c.amount);
      if (amount === null) {
        reasons.push(`claims[${i}].amount must be a non-negative uint256`);
        continue;
      }
      parsedClaims.push({ leg, unit, amount });
    }
  }

  // chain_id / network_label are FREE-TEXT LABELS carried through to the receipt for the reader's
  // own record-keeping (art-492 pattern). Never a selector: no branch reads either value.
  const chain_id = str(pp.chain_id, null);
  const network_label = str(pp.network_label, null);

  if (reasons.length > 0 || depositLeg === null || redeemLeg === null) {
    return {
      output_payload: {
        declared_context: { chain_id: null, network_label: null },
        request_id: null,
        aggregate_by_controller: null,
        claim_rounding_used: null,
        opening: null,
        claims: [],
        closing: null,
        invariants: [],
        note: SCOPE_NOTE,
        reasons: reasons.length > 0 ? reasons : ['one or more request legs were malformed'],
      },
      compliance_flags: ['ERC7540_INDETERMINATE', 'ERC7540_MALFORMED_INPUT'],
    };
  }

  const legs = {
    deposit: { ...depositLeg, claimed_in: 0n, claimed_out: 0n },
    redeem: { ...redeemLeg, claimed_in: 0n, claimed_out: 0n },
  };
  // The pro-rata rate each leg's claimable bucket was made claimable at, fixed at open and never
  // recomputed from the shrinking remainder: a non-zero requestId MUST stay at one rate, so
  // re-deriving it mid-sequence would silently launder a drift this kernel is meant to expose.
  const openRate = {
    deposit: { in: legs.deposit.claimable_in, out: legs.deposit.claimable_out },
    redeem: { in: legs.redeem.claimable_in, out: legs.redeem.claimable_out },
  };

  const opening = {
    deposit: {
      pending_assets: legs.deposit.pending.toString(),
      claimable_assets: legs.deposit.claimable_in.toString(),
      claimable_shares: legs.deposit.claimable_out.toString(),
      max_deposit_implied: legs.deposit.claimable_in.toString(),
      max_mint_implied: legs.deposit.claimable_out.toString(),
    },
    redeem: {
      pending_shares: legs.redeem.pending.toString(),
      claimable_shares: legs.redeem.claimable_in.toString(),
      claimable_assets: legs.redeem.claimable_out.toString(),
      max_redeem_implied: legs.redeem.claimable_in.toString(),
      max_withdraw_implied: legs.redeem.claimable_out.toString(),
    },
  };

  let overclaim = false;
  let claimWithoutClaimable = false;
  let prorataDrift = false;

  const claims = [];
  for (let i = 0; i < parsedClaims.length; i++) {
    const { leg, unit, amount } = parsedClaims[i];
    const L = legs[leg];
    const R = openRate[leg];
    const other = claim_rounding === 'down' ? 'up' : 'down';

    if (R.in === 0n || R.out === 0n) {
      claimWithoutClaimable = true;
      claims.push({
        index: i, leg, unit, amount: amount.toString(),
        consumed_requested: null, received: null,
        rounding_direction: claim_rounding, received_if_rounded_other_way: null,
        rejected: true,
        rejection_reason: 'Nothing is in the Claimable state for this leg. ERC-7540: "Requests MUST NOT skip or otherwise short-circuit the Claim state" -- a pending amount cannot be claimed until the vault has made it claimable.',
      });
      continue;
    }

    // Resolve the claim into (consumed on the requested side, received on the output side) at the
    // bucket's opening rate.
    let consumed, received, receivedOther;
    if (unit === 'requested') {
      consumed = amount;
      received = mulDiv(amount, R.out, R.in, claim_rounding);
      receivedOther = mulDiv(amount, R.out, R.in, other);
    } else {
      received = amount;
      consumed = mulDiv(amount, R.in, R.out, claim_rounding);
      receivedOther = amount;
    }

    const remainingIn = L.claimable_in;
    const remainingOut = L.claimable_out;
    if (consumed > remainingIn || received > remainingOut) {
      overclaim = true;
      claims.push({
        index: i, leg, unit, amount: amount.toString(),
        consumed_requested: consumed.toString(), received: received.toString(),
        rounding_direction: claim_rounding, received_if_rounded_other_way: receivedOther.toString(),
        rejected: true,
        rejection_reason: `Claim exceeds what remains claimable on the ${leg} leg (would consume ${consumed} of ${remainingIn} and pay out ${received} of ${remainingOut}).`,
      });
      continue;
    }

    L.claimable_in = remainingIn - consumed;
    L.claimable_out = remainingOut - received;
    L.claimed_in += consumed;
    L.claimed_out += received;

    // The rate this individual claim actually settled at, scaled, so a drift from the bucket's
    // opening rate is visible as a number rather than inferred.
    const claimRateScaled = consumed === 0n ? null : mulDiv(received, RATE_SCALE, consumed, 'down');
    const openRateScaled = mulDiv(R.out, RATE_SCALE, R.in, 'down');
    // Rounding a partial claim always moves the settled rate by less than one unit of the
    // requested side; anything larger is a genuine rate change, not rounding. Guard against a
    // false positive on tiny claims, where a sub-unit rounding is a large scaled ratio.
    let drifted = false;
    if (claimRateScaled !== null && consumed > 0n) {
      const tolerance = mulDiv(RATE_SCALE, 1n, consumed, 'up');
      const diff = claimRateScaled >= openRateScaled ? claimRateScaled - openRateScaled : openRateScaled - claimRateScaled;
      drifted = diff > tolerance;
    }
    if (drifted && !aggregate_by_controller) prorataDrift = true;

    claims.push({
      index: i, leg, unit, amount: amount.toString(),
      consumed_requested: consumed.toString(),
      received: received.toString(),
      rounding_direction: claim_rounding,
      received_if_rounded_other_way: receivedOther.toString(),
      rounding_changes_result: unit === 'requested' && received !== receivedOther,
      settled_rate_scaled: claimRateScaled === null ? null : claimRateScaled.toString(),
      opening_rate_scaled: openRateScaled.toString(),
      rate_scale: RATE_SCALE.toString(),
      rejected: false,
      rejection_reason: null,
    });
  }

  const closing = {
    deposit: {
      pending_assets: legs.deposit.pending.toString(),
      claimable_assets: legs.deposit.claimable_in.toString(),
      claimable_shares: legs.deposit.claimable_out.toString(),
      claimed_assets: legs.deposit.claimed_in.toString(),
      claimed_shares: legs.deposit.claimed_out.toString(),
    },
    redeem: {
      pending_shares: legs.redeem.pending.toString(),
      claimable_shares: legs.redeem.claimable_in.toString(),
      claimable_assets: legs.redeem.claimable_out.toString(),
      claimed_shares: legs.redeem.claimed_in.toString(),
      claimed_assets: legs.redeem.claimed_out.toString(),
    },
  };

  // Rounding dust: the residue a sequence of rounded partial claims leaves behind. Reported because
  // a bucket that can never be fully drained is a real operational condition, not an error here.
  const dust = {
    deposit_shares_stranded: (legs.deposit.claimable_in === 0n ? legs.deposit.claimable_out : 0n).toString(),
    deposit_assets_stranded: (legs.deposit.claimable_out === 0n ? legs.deposit.claimable_in : 0n).toString(),
    redeem_assets_stranded: (legs.redeem.claimable_in === 0n ? legs.redeem.claimable_out : 0n).toString(),
    redeem_shares_stranded: (legs.redeem.claimable_out === 0n ? legs.redeem.claimable_in : 0n).toString(),
    note: 'A stranded amount is one side of a claimable bucket left non-zero after the other side reached zero, so no further claim against it can be computed at the bucket\'s rate.',
  };
  const anyDust = Object.keys(dust).some((k) => k !== 'note' && dust[k] !== '0');

  // Every invariant checked, named, with its verdict -- so a reader sees what was NOT checked too.
  const invariants = [
    {
      name: 'pending_and_claimable_disjoint',
      source: 'ERC-7540: pendingDepositRequest/claimableDepositRequest (and the redeem pair) each exclude the other state\'s amount.',
      holds: true,
      detail: 'Structural: this kernel models pending and claimable as separate buckets and never moves an amount between them, so the two views can never double-count. A claim only ever draws from the claimable bucket.',
    },
    {
      name: 'claim_never_skips_claimable_state',
      source: 'ERC-7540: "Requests MUST NOT skip or otherwise short-circuit the Claim state."',
      holds: !claimWithoutClaimable,
      detail: claimWithoutClaimable ? 'At least one claim was attempted against a leg with nothing in the Claimable state; it was rejected rather than drawn from pending.' : 'Every claim drew only from an amount already in the Claimable state.',
    },
    {
      name: 'claim_within_claimable_bounds',
      source: 'ERC-7540 max* views track the claimable amount (the standard notes maxDeposit moves in sync with claimableDepositRequest).',
      holds: !overclaim,
      detail: overclaim ? 'At least one claim exceeded the remaining claimable amount on its leg and was rejected.' : 'No claim exceeded its leg\'s remaining claimable amount.',
    },
    {
      name: 'single_prorata_rate_for_nonzero_request_id',
      source: 'ERC-7540: "If a Request with requestId != 0 becomes partially claimable, all requests of the same requestId MUST become claimable at the same pro-rata rate."',
      holds: !prorataDrift,
      applicable: !aggregate_by_controller,
      detail: aggregate_by_controller
        ? 'Not applicable: request_id is 0, the aggregate-by-controller convention, where amounts from separate requests are fungible and no single per-request rate is asserted.'
        : (prorataDrift ? 'A claim settled at a rate differing from its bucket\'s opening rate by more than one unit of the requested side, which rounding alone cannot explain.' : 'Every claim settled at its bucket\'s opening pro-rata rate, within one unit of the requested side.'),
    },
    {
      name: 'partial_claim_rounding_direction_is_declared_not_mandated',
      source: 'ERC-7540 states no rounding direction for a partial claim. ERC-4626 fixes a direction per function; ERC-7540 does not extend that to claims.',
      holds: true,
      detail: `Direction "${claim_rounding}" was supplied by the caller, not derived from the standard. Each claim reports what the opposite direction would have produced.`,
    },
  ];

  const output_payload = {
    declared_context: { chain_id, network_label },
    request_id,
    aggregate_by_controller,
    claim_rounding_used: claim_rounding,
    opening,
    claims,
    closing,
    dust,
    invariants,
    note: SCOPE_NOTE,
    reasons: [],
  };

  const compliance_flags = [
    aggregate_by_controller ? 'ERC7540_REQUEST_ID_AGGREGATE' : 'ERC7540_REQUEST_ID_DISCRETE',
    `ERC7540_CLAIM_ROUNDING_${claim_rounding.toUpperCase()}_DECLARED`,
  ];
  if (overclaim) compliance_flags.push('ERC7540_OVERCLAIM_REJECTED');
  if (claimWithoutClaimable) compliance_flags.push('ERC7540_CLAIM_WITHOUT_CLAIMABLE');
  if (prorataDrift) compliance_flags.push('ERC7540_PRORATA_RATE_DRIFT');
  if (anyDust) compliance_flags.push('ERC7540_ROUNDING_DUST_STRANDED');
  if (!overclaim && !claimWithoutClaimable && !prorataDrift) compliance_flags.push('ERC7540_INVARIANTS_HELD');

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type:       meta.mandate_type,
    tool_id:             TOOL_ID,
    tool_version:        TOOL_VERSION,
    generated_at:        now ?? null,
    execution_hash:      hash,
    chain:               { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:   pp,
    output_payload,
    compliance_flags,
    compute_mode:        'server',
    compute_proof_ready: 'deferred',
    audit_signature:     { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
