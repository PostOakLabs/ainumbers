import { executionHash } from './_hash.mjs';

// art-709-v4-hook-fee-conformance — recomputes a Uniswap v4 pool's per-swap fee from
// v4-core's own fee rules and checks the emitted fee against the declared story:
// protocol-fee validation, LP-fee override-flag decoding, LP-fee bounds, the
// calculateSwapFee recomposition against each emitted fee, the total-fee-cap check,
// integer hook-charge accrual (floor, remainder reported) with its declared splits,
// and a separately reported LP revenue that is never netted against the hook charge.
//
// Pinned to Uniswap v4-core at commit a7cf038cd568801a79a9b4cf92cd5b52c95c8585:
//   src/libraries/LPFeeLibrary.sol      (DYNAMIC_FEE_FLAG 0x800000 L15, OVERRIDE_FEE_FLAG
//                                       0x400000 L19, REMOVE_OVERRIDE_MASK 0xBFFFFF L22,
//                                       MAX_LP_FEE 1_000_000 L25, isDynamicFee L31,
//                                       isValid L38, hasOverrideFlag L62, removeOverrideFlag L69)
//   src/libraries/ProtocolFeeLibrary.sol (MAX_PROTOCOL_FEE 1000 L9, isValidProtocolFee L25,
//                                       calculateSwapFee L38-46: swapFee = protocolFee +
//                                       lpFee - protocolFee*lpFee/1_000_000)
//   src/libraries/Pool.sol              (L301-320: swapFee = protocolFee == 0 ? lpFee :
//                                       calculateSwapFee(lpFee); the MAX_SWAP_FEE boundary;
//                                       the Swap event emits fee = the composed swap fee)
//   src/libraries/SwapMath.sol          (MAX_SWAP_FEE 1e6 L12)
//   src/interfaces/IPoolManager.sol     (Swap event L82-91: "fee The swap fee in hundredths of a bip")
// Re-verified byte-identical at v4-core main HEAD on 2026-10-12 (all four files). The commit
// travels in the output as v4_core_commit. Node-level citations live in the node metadata per
// KERNEL-CITATION-CLASS-1.
//
// Zero network: the node never reads a chain; it recomputes only what the caller supplies.
//
// DETERMINISM: compute() is a PURE function of pp — no Date.now()/Math.random(), no network,
// no filesystem. BigInt is used for all fee arithmetic. No UTF-8 encoding is used, so no
// encoder is carried (GUEST-BUILTIN-GATE-1: TextEncoder/atob/btoa/URL are absent in the guest).

const TOOL_ID = 'art-709-v4-hook-fee-conformance';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_v4_hook_fee_conformance',
  mandate_type: 'compliance_control', gpu: false,
};

export const V4_CORE_COMMIT = 'a7cf038cd568801a79a9b4cf92cd5b52c95c8585';

// Pinned constants (values asserted against the pinned files listed in the header).
export const PIPS_DENOMINATOR = 1000000n;        // ProtocolFeeLibrary PIPS_DENOMINATOR
export const MAX_LP_FEE = 1000000n;              // LPFeeLibrary MAX_LP_FEE
export const MAX_SWAP_FEE = 1000000n;            // SwapMath MAX_SWAP_FEE
export const MAX_PROTOCOL_FEE = 1000n;           // ProtocolFeeLibrary MAX_PROTOCOL_FEE
export const DYNAMIC_FEE_FLAG = 0x800000n;         // LPFeeLibrary DYNAMIC_FEE_FLAG
export const OVERRIDE_FEE_FLAG = 0x400000n;        // LPFeeLibrary OVERRIDE_FEE_FLAG
export const REMOVE_OVERRIDE_MASK = 0xBFFFFFn;     // LPFeeLibrary REMOVE_OVERRIDE_MASK
const UINT24_MAX = 0xffffffn;

function deNull(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return o;
  const c = { ...o };
  for (const k of Object.keys(c)) if (c[k] === null) c[k] = undefined;
  return c;
}

function refusal(code, detail) {
  return {
    output_payload: {
      error: code.toLowerCase(),
      detail,
      domain_errors: [{ code, text: detail }],
      per_swap: [],
      totals: null,
      protocol_fee_valid: null,
      v4_core_commit: V4_CORE_COMMIT,
      assumptions: [],
    },
    compliance_flags: code ? ['INPUT_REFUSED'] : [],
  };
}

function isUint(v, max) {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && BigInt(v) <= max;
}

// calculateSwapFee replica (pinned ProtocolFeeLibrary L38-46; protocolFeeDir is one
// direction's protocol fee in pips, lpFee in pips; all BigInt):
//   swapFee = protocolFee + lpFee - floor(protocolFee * lpFee / 1_000_000)
export function calculateSwapFee(protocolFeeDir, lpFee) {
  const p = BigInt(protocolFeeDir);
  const l = BigInt(lpFee);
  return p + l - ((p * l) / PIPS_DENOMINATOR);
}

/**
 * compute(pp) — pure decision kernel. Zero network; recomputes only caller-supplied values.
 *
 * pp: {
 *   protocol_fee: uint24 — both directions packed as v4 stores it (low 12 bits zeroForOne,
 *                  bits 12-23 oneForZero); validated with isValidProtocolFee,
 *   pool_fee: uint24 — static pips or 0x800000 (dynamic),
 *   declared_lp_fee_bounds: { min_pips, max_pips },
 *   declared_total_fee_cap_pips?: pip integer — optional total (swap fee + hook charge) cap,
 *   declared_hook_charge: { rate_pips, splits: [{ recipient_label, share_bps }] },
 *   swaps: [{ index, zero_for_one, amount_in, emitted_fee_pips,
 *             lp_fee_override?: raw uint24 incl. flag, exact_out?: boolean }],
 * }
 */
export function compute(pp) {
  pp = deNull(pp || {});

  // ---- protocol_fee (uint24, validated per isValidProtocolFee) ----
  if (!isUint(pp.protocol_fee, UINT24_MAX)) {
    return refusal('PROTOCOL_FEE_INVALID',
      'protocol_fee must be a uint24 integer (0..16777215) packed as v4 stores it (low 12 bits zeroForOne, bits 12-23 oneForZero); got '
      + JSON.stringify(pp.protocol_fee ?? null) + '.');
  }
  const protocolFee = BigInt(pp.protocol_fee);
  const protoZeroForOne = protocolFee & 0xfffn;
  const protoOneForZero = (protocolFee >> 12n) & 0xfffn;
  // isValidProtocolFee replica: each direction <= MAX_PROTOCOL_FEE (pinned L25-33).
  const protocolFeeValid = protoZeroForOne <= MAX_PROTOCOL_FEE && protoOneForZero <= MAX_PROTOCOL_FEE;

  // ---- pool_fee ----
  if (!isUint(pp.pool_fee, UINT24_MAX)) {
    return refusal('POOL_FEE_INVALID',
      'pool_fee must be a uint24 integer (0..16777215): static pips or 0x800000 (dynamic); got '
      + JSON.stringify(pp.pool_fee ?? null) + '.');
  }
  const poolFee = BigInt(pp.pool_fee);
  const poolFeeIsDynamic = poolFee === DYNAMIC_FEE_FLAG; // LPFeeLibrary isDynamicFee

  // ---- declared_lp_fee_bounds ----
  const bounds = pp.declared_lp_fee_bounds;
  if (!bounds || typeof bounds !== 'object' || Array.isArray(bounds)
    || !isUint(bounds.min_pips, MAX_LP_FEE) || !isUint(bounds.max_pips, MAX_LP_FEE)
    || BigInt(bounds.min_pips) > BigInt(bounds.max_pips)) {
    return refusal('LP_FEE_BOUNDS_INVALID',
      'declared_lp_fee_bounds must be { min_pips, max_pips } with 0 <= min <= max <= 1000000; got '
      + JSON.stringify(bounds ?? null) + '.');
  }
  const minPips = BigInt(bounds.min_pips);
  const maxPips = BigInt(bounds.max_pips);

  // ---- declared_hook_charge ----
  const charge = pp.declared_hook_charge;
  if (!charge || typeof charge !== 'object' || Array.isArray(charge)
    || !isUint(charge.rate_pips, MAX_LP_FEE)) {
    return refusal('HOOK_CHARGE_INVALID',
      'declared_hook_charge must be { rate_pips, splits: [...] } with rate_pips a pip integer 0..1000000; got '
      + JSON.stringify(charge ?? null) + '.');
  }
  if (!Array.isArray(charge.splits)) {
    return refusal('HOOK_CHARGE_SPLITS_INVALID',
      'declared_hook_charge.splits must be an array of { recipient_label, share_bps }; got '
      + JSON.stringify(charge.splits ?? null) + '.');
  }
  for (const s of charge.splits) {
    if (!s || typeof s !== 'object' || Array.isArray(s)
      || typeof s.recipient_label !== 'string' || s.recipient_label.length === 0
      || !isUint(s.share_bps, 10000n)) {
      return refusal('HOOK_CHARGE_SPLITS_INVALID',
        'each split must be { recipient_label: string, share_bps: integer 0..10000 }; got '
        + JSON.stringify(s ?? null) + '.');
    }
  }
  const ratePips = BigInt(charge.rate_pips);

  // ---- declared_total_fee_cap_pips (optional) ----
  let totalCap = null;
  if (pp.declared_total_fee_cap_pips !== undefined) {
    if (!isUint(pp.declared_total_fee_cap_pips, MAX_LP_FEE)) {
      return refusal('TOTAL_FEE_CAP_INVALID',
        'declared_total_fee_cap_pips, when present, must be a pip integer 0..1000000; got '
        + JSON.stringify(pp.declared_total_fee_cap_pips) + '.');
    }
    totalCap = BigInt(pp.declared_total_fee_cap_pips);
  }

  // ---- swaps ----
  if (!Array.isArray(pp.swaps) || pp.swaps.length === 0) {
    return refusal('SWAPS_INVALID',
      'swaps must be a non-empty array of { index, zero_for_one, amount_in, emitted_fee_pips, lp_fee_override?, exact_out? }; got '
      + JSON.stringify(pp.swaps ?? null) + '.');
  }
  for (const s of pp.swaps) {
    if (!s || typeof s !== 'object' || Array.isArray(s)
      || !Number.isInteger(s.index)
      || typeof s.zero_for_one !== 'boolean'
      || !isUint(s.amount_in, 9007199254740991n)
      || !isUint(s.emitted_fee_pips, UINT24_MAX)) {
      return refusal('SWAP_ENTRY_INVALID',
        'each swap must carry an integer index, a boolean zero_for_one, a non-negative integer amount_in, and an integer emitted_fee_pips 0..16777215; got '
        + JSON.stringify(s ?? null) + '.');
    }
    if (s.lp_fee_override !== undefined && !isUint(s.lp_fee_override, UINT24_MAX)) {
      return refusal('LP_FEE_OVERRIDE_INVALID',
        'lp_fee_override, when present, must be a raw uint24 integer 0..16777215 (including the override flag bit); got '
        + JSON.stringify(s.lp_fee_override) + '.');
    }
  }
  const seenIdx = new Set();
  for (const s of pp.swaps) {
    if (seenIdx.has(s.index)) {
      return refusal('SWAP_INDEX_DUPLICATE', 'swap index ' + s.index + ' appears more than once.');
    }
    seenIdx.add(s.index);
  }

  // ---- splits bookkeeping (declared shares; the sum is reported, never coerced) ----
  const splitsSumBps = charge.splits.reduce((a, s) => a + s.share_bps, 0);
  const splitsOk = splitsSumBps === 10000;

  // ---- per-swap recomputation ----
  const perSwap = [];
  let totLpRevenue = 0n;
  let totProtocolRevenue = 0n;
  let totHookCharge = 0n;
  let totHookRemainder = 0n;
  const perRecipient = {};
  for (const s of charge.splits) perRecipient[s.recipient_label] = { amount: 0n, remainder: 0n };
  let capOk = true;

  for (const s of pp.swaps) {
    const amountIn = BigInt(s.amount_in);
    const row = {
      index: s.index,
      zero_for_one: s.zero_for_one,
      amount_in: s.amount_in,
      lp_fee_pips: null,
      lp_fee_source: null,
      lp_fee_within_declared_bounds: null,
      protocol_fee_direction_pips: Number(s.zero_for_one ? protoZeroForOne : protoOneForZero),
      swap_fee_pips: null,
      emitted_fee_pips: s.emitted_fee_pips,
      status: null,
      hook_charge_amount: 0,
      hook_charge_remainder: 0,
      hook_charge_per_recipient: {},
      lp_revenue_amount: 0,
      protocol_revenue_amount: 0,
      cap_check: null,
      indeterminate_reason: null,
    };

    const exactOut = s.exact_out === true;

    // LP fee resolution: a hook-returned override is read only on a dynamic pool; there,
    // an override with its flag set replaces the stored fee for this swap (the flag itself
    // is stripped per the pinned mask). On a static pool any override is ignored and the
    // pool's static fee applies. A dynamic pool fee with no override leaves the LP fee
    // unknowable here.
    const overrideRaw = s.lp_fee_override === undefined ? null : BigInt(s.lp_fee_override);
    const hasOverride = poolFeeIsDynamic && overrideRaw !== null && (overrideRaw & OVERRIDE_FEE_FLAG) !== 0n;

    let lpFee = null;
    if (hasOverride) {
      lpFee = overrideRaw & REMOVE_OVERRIDE_MASK;
      row.lp_fee_source = 'override';
    } else if (!poolFeeIsDynamic) {
      lpFee = poolFee;
      row.lp_fee_source = 'pool_static';
    } else {
      row.indeterminate_reason = 'DYNAMIC_POOL_FEE_WITHOUT_OVERRIDE: the LP fee is set per-swap on chain and was not supplied';
    }

    if (lpFee !== null) {
      row.lp_fee_pips = Number(lpFee);
      row.lp_fee_within_declared_bounds = lpFee >= minPips && lpFee <= maxPips && lpFee <= MAX_LP_FEE;

      // calculateSwapFee recomposition for this swap's direction (pinned Pool.sol L307:
      // the direction's protocol fee; 0 means the whole fee is the LP fee).
      const protoDir = s.zero_for_one ? protoZeroForOne : protoOneForZero;
      const swapFee = calculateSwapFee(protoDir, lpFee);
      row.swap_fee_pips = Number(swapFee);

      // A composed fee at or above MAX_SWAP_FEE reverts only an exact-out swap; the node
      // reports that swap INDETERMINATE rather than modelling the revert. An exact-in swap
      // at that fee is not reverted and is checked like any other. An LP fee above
      // MAX_LP_FEE is invalid before the fee is composed, so it surfaces as OUT_OF_BOUNDS.
      if (exactOut && lpFee <= MAX_LP_FEE && swapFee >= MAX_SWAP_FEE && row.indeterminate_reason === null) {
        row.indeterminate_reason = 'EXACT_OUT_SWAP: v4 reverts an exact-out swap that would pay a 100% fee; this node does not model reverts';
      }

      // Integer accruals (floor), remainder reported — never rounded away silently.
      const hookCharge = (amountIn * ratePips) / PIPS_DENOMINATOR;
      const hookRem = (amountIn * ratePips) % PIPS_DENOMINATOR;
      const lpRevenue = (amountIn * lpFee) / PIPS_DENOMINATOR;
      const protoRevenue = (amountIn * protoDir) / PIPS_DENOMINATOR;
      row.hook_charge_amount = Number(hookCharge);
      row.hook_charge_remainder = Number(hookRem);
      row.lp_revenue_amount = Number(lpRevenue);
      row.protocol_revenue_amount = Number(protoRevenue);

      let allocated = 0n;
      for (const sp of charge.splits) {
        const amt = (hookCharge * BigInt(sp.share_bps)) / 10000n;
        const rem = (hookCharge * BigInt(sp.share_bps)) % 10000n;
        row.hook_charge_per_recipient[sp.recipient_label] = { amount: Number(amt), remainder: Number(rem) };
        perRecipient[sp.recipient_label].amount += amt;
        perRecipient[sp.recipient_label].remainder += rem;
        allocated += amt;
      }
      // The swap-level remainder is the UNALLOCATED residue: hook charge minus the sum of
      // the independently floored recipient shares (each share floors on its own, so with
      // several recipients the residues can exceed one unit — they are never assumed away).

      const unallocated = hookCharge - allocated;
      row.hook_charge_remainder = Number(unallocated);

      totLpRevenue += lpRevenue;
      totProtocolRevenue += protoRevenue;
      totHookCharge += hookCharge;
      totHookRemainder += unallocated;

      // Total-cap check (swap fee + hook charge rate against the declared cap, in pips).
      if (totalCap !== null) {
        const combined = swapFee + ratePips;
        row.cap_check = { combined_pips: Number(combined), cap_pips: Number(totalCap), ok: combined <= totalCap };
        if (combined > totalCap) capOk = false;
      }
    }

    // Status precedence: INDETERMINATE, then OUT_OF_BOUNDS, then FEE_MISMATCH, then CONFORMS.
    if (row.indeterminate_reason !== null) {
      row.status = 'INDETERMINATE';
    } else if (row.lp_fee_within_declared_bounds === false) {
      row.status = 'OUT_OF_BOUNDS';
    } else if (row.swap_fee_pips !== row.emitted_fee_pips) {
      row.status = 'FEE_MISMATCH';
    } else {
      row.status = 'CONFORMS';
    }
    perSwap.push(row);
  }

  const mismatchCount = perSwap.filter((r) => r.status === 'FEE_MISMATCH').length;
  const outOfBoundsCount = perSwap.filter((r) => r.status === 'OUT_OF_BOUNDS').length;
  const indeterminateCount = perSwap.filter((r) => r.status === 'INDETERMINATE').length;

  return {
    output_payload: {
      protocol_fee: pp.protocol_fee,
      protocol_fee_zero_for_one_pips: Number(protoZeroForOne),
      protocol_fee_one_for_zero_pips: Number(protoOneForZero),
      protocol_fee_valid: protocolFeeValid,
      pool_fee: pp.pool_fee,
      pool_fee_is_dynamic: poolFeeIsDynamic,
      declared_lp_fee_bounds: { min_pips: bounds.min_pips, max_pips: bounds.max_pips },
      declared_total_fee_cap_pips: totalCap === null ? null : Number(totalCap),
      declared_hook_charge: { rate_pips: charge.rate_pips, splits: charge.splits },
      splits_sum_bps: splitsSumBps,
      splits_ok: splitsOk,
      total_cap_ok: totalCap === null ? null : capOk,
      per_swap: perSwap,
      counts: {
        swaps: perSwap.length,
        conforms: perSwap.length - mismatchCount - outOfBoundsCount - indeterminateCount,
        out_of_bounds: outOfBoundsCount,
        fee_mismatch: mismatchCount,
        indeterminate: indeterminateCount,
      },
      fee_story_explained: protocolFeeValid && mismatchCount === 0 && indeterminateCount === 0 && splitsOk
        && (totalCap === null || capOk),
      totals: {
        lp_revenue: Number(totLpRevenue),
        protocol_revenue: Number(totProtocolRevenue),
        hook_charge: Number(totHookCharge),
        hook_charge_remainder: Number(totHookRemainder),
        per_recipient: Object.fromEntries(
          Object.entries(perRecipient).map(([k, v]) => [k, { amount: Number(v.amount), remainder: Number(v.remainder) }]),
        ),
      },
      v4_core_commit: V4_CORE_COMMIT,
      assumptions: [
        'Fee rules pinned to Uniswap v4-core at commit ' + V4_CORE_COMMIT
          + ': LPFeeLibrary.sol (flags, MAX_LP_FEE), ProtocolFeeLibrary.sol (isValidProtocolFee, calculateSwapFee), Pool.sol L301-320 (fee composition and the emitted Swap fee), SwapMath.sol MAX_SWAP_FEE.',
        'calculateSwapFee replica: swapFee = protocolFee + lpFee - floor(protocolFee * lpFee / 1000000), in pips, per direction; a zero protocol fee means the whole fee is the LP fee.',
        'All monetary accruals are integer floor divisions in BigInt; every division remainder is reported and never silently dropped.',
        'LP revenue (amount_in * lpFee / 1e6) is reported separately and is never netted against the hook charge: LP revenue stays LP revenue.',
        'An exact-out swap whose composed fee is at or above MAX_SWAP_FEE is reported INDETERMINATE: v4 reverts that swap and this node does not model reverts. An exact-in swap at that fee is not reverted and is checked like any other swap.',
        'A per-swap LP-fee override is read only on a dynamic pool (pool_fee exactly 0x800000); on a static pool it is ignored and the pool fee applies. An LP fee above MAX_LP_FEE (1000000) is reported OUT_OF_BOUNDS.',
        'A dynamic pool fee (0x800000) without a per-swap override leaves the LP fee unknowable to an off-chain observer and is reported INDETERMINATE.',
        'Zero network: the node never reads a chain and recomputes only the caller-supplied declared values and emitted fees.',
      ],
    },
    compliance_flags: [],
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
