import { executionHash } from './_hash.mjs';

const TOOL_ID = '822-zcash-supply-check';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'audit_zcash_pool_supply',
  mandate_type: 'cryptographic_mandate', gpu: false,
};

// Zcash chain value pool supply check -- recompute the total supply arithmetic from
// CALLER-PASTED pool balance VALUES ONLY, and state plainly that it cannot read the
// chain and does not verify that the numbers are true.
//
// METHOD (the pool definitions and the negative-balance consensus rules the node
// metadata's cited_clause_digest carries, from the pinned Zcash protocol
// specification "Chain Value Pool Balances" section; input field names mirror the
// zcashd valuePools/chainSupply RPC shape -- chainValueZat integer zatoshi):
//   1. Refuse malformed input before any arithmetic: a non-numeric value in a
//      declared field, a pool name outside the four pinned pools, a missing pool,
//      a missing claimed supply, a fractional (non-whole-zatoshi) value, or a
//      value above the declared safe-arithmetic bound.
//   2. Non-negativity: each pool balance must be >= 0. The pinned consensus rules
//      make a negative pool balance an invalid chain state; the kernel reports any
//      negative pasted pool as such, per pool.
//   3. Conservation (the no-counterfeiting turnstile identity): the four pool
//      balances must sum exactly to the claimed total supply. Any difference is
//      reported exactly, in zatoshi, with its sign.
//
// WHAT THIS NODE DOES NOT DO (declared, not computed): it never contacts a node,
// explorer, or lightwalletd; it cannot check that the pasted numbers are the true
// balances of any chain at any height; it does not verify the claimed issuance
// total itself (the caller asserts it). evidence.chain_verified is false on every
// payload, including the conserved one. No lockbox or deferred pool (a client-side
// addition beyond the four pinned protocol pools) is accepted: an unknown pool name
// is refused, never silently zeroed. No market, price, or exchange-rate figures.
//
// VALUES-ONLY REFUSALS (closed, each with a reachable path + a reachability fixture,
// checked in this order, first match wins):
//   R1 NON_NUMERIC_VALUE_REFUSED        -- a string, boolean, null, or non-finite
//      value in any declared field. A value-only statement carries integers; a
//      string where a number belongs is identifier-like or free text by
//      construction and is never echoed.
//   R2 UNKNOWN_POOL_NAME_REFUSED        -- a pools key outside
//      {transparent, sprout, sapling, orchard}. A typo must not silently read as a
//      zero balance, and pools outside the pinned four (lockbox, deferred) are out
//      of scope by declaration.
//   R3 CLAIMED_SUPPLY_MISSING_REFUSED   -- claimed_supply_zat absent. Without a
//      claimed total there is no conservation identity to test.
//   R4 MISSING_POOL_REFUSED             -- any of the four pools absent. zcashd
//      reports unmonitored pools without chainValueZat; this kernel cannot assume
//      a value for them and refuses instead.
//   R5 NON_INTEGER_ZATOSHI_REFUSED      -- a fractional value. Zatoshi are whole
//      units (1 ZEC = 1e8 zatoshi); a fractional pasted value is a units error.
//   R6 VALUE_ABOVE_SAFE_ARITHMETIC_BOUND_REFUSED -- a pool value with
//      |value| > MAX_POOL_VALUE_ZAT (2^50) or a claimed supply with
//      |value| > MAX_CLAIMED_SUPPLY_ZAT (2^52). The bound keeps the four-pool sum
//      and the conservation delta inside the exactly-representable integer range
//      (below 2^53), so every reported figure is exact. It is a declared
//      arithmetic-safety bound of THIS kernel, not a protocol constant.
//
// FINDINGS (verdicts, after refusals pass):
//   negative_pool_balance -- at least one pasted pool is negative (each named).
//   supply_mismatch       -- pools sum to a value different from the claimed
//                            supply; delta_zat carries the exact signed difference.
//   conserved             -- all pools non-negative and the sum equals the claimed
//                            supply exactly. Even this verdict asserts only the
//                            arithmetic of the pasted numbers.
//
// Flag-mirror doctrine (AUTHORING-STANDARD section 2): the flag channel is
// conditional (refusals, negative pools, and mismatches raise flags the conserved
// path does not), so output_payload mirrors them -- manual_review_required is true
// exactly when any flag is raised, and issues[] is non-empty exactly when a finding
// or refusal exists. The conserved path raises no flag.
//
// Pure ECMA-262 integer arithmetic only -- no TextEncoder/atob/btoa/URL (absent in
// the zkVM guest), no Math.pow/Math.log, no Date.now/new Date(), no Math.random.
// Every input is bounds-checked before use; no NaN/Infinity can reach a payload.

const POOL_NAMES = ['transparent', 'sprout', 'sapling', 'orchard'];
const MAX_POOL_VALUE_ZAT = 1125899906842624; // 2^50, declared arithmetic-safety bound per pool
const MAX_CLAIMED_SUPPLY_ZAT = 4503599627370496; // 2^52, declared arithmetic-safety bound

function isPlainNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function firstNonNumericIn(obj, keys) {
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (obj[k] !== undefined && !isPlainNumber(obj[k])) return k;
  }
  return null;
}

// R1 over every declared field, deterministic order: the four pools in pinned
// order, then the claimed supply.
function findRefusedField(pp) {
  const poolHit = firstNonNumericIn(pp.pools || {}, POOL_NAMES);
  if (poolHit !== null) return 'pools.' + poolHit;
  if (pp.claimed_supply_zat != null && !isPlainNumber(pp.claimed_supply_zat)) {
    return 'claimed_supply_zat';
  }
  return null;
}

export function compute(pp) {
  pp = pp || {};

  const compliance_flags = [];
  const poolsIn = (pp.pools !== null && typeof pp.pools === 'object' && !Array.isArray(pp.pools)) ? pp.pools : {};
  const poolKeys = Object.keys(poolsIn);

  const refusedPayload = (flag, because, field) => {
    compliance_flags.push(flag);
    return {
      output_payload: {
        verdict: 'refused',
        refused_because: because,
        refused_field: field,
        issues: [],
        manual_review_required: true,
        evidence: {
          record_type: 'zcash_supply_check',
          tool_id: TOOL_ID,
          tool_version: TOOL_VERSION,
          refused: true,
          chain_verified: false,
          pii_carried: false,
          refusal_free: false,
        },
      },
      compliance_flags,
    };
  };

  // -- R1: non-numeric value in a declared field (checked before any key or
  //    presence logic; a string is never echoed back).
  const badField = findRefusedField(pp);
  if (badField !== null) {
    return refusedPayload('NON_NUMERIC_VALUE_REFUSED', 'non_numeric_value_in_declared_field', badField);
  }

  // -- R2: unknown pool name (typo protection; lockbox/deferred out of scope).
  for (let i = 0; i < poolKeys.length; i++) {
    if (POOL_NAMES.indexOf(poolKeys[i]) === -1) {
      return refusedPayload('UNKNOWN_POOL_NAME_REFUSED', 'pool_name_outside_pinned_four', 'pools.' + poolKeys[i]);
    }
  }

  // -- R3: claimed supply absent (null counts as absent per R4; bool/string caught by R1).
  if (pp.claimed_supply_zat == null) {
    return refusedPayload('CLAIMED_SUPPLY_MISSING_REFUSED', 'claimed_supply_zat_absent', 'claimed_supply_zat');
  }

  // -- R4: one of the four pinned pools absent.
  const missingPools = [];
  for (let i = 0; i < POOL_NAMES.length; i++) {
    if (poolsIn[POOL_NAMES[i]] === undefined) missingPools.push(POOL_NAMES[i]);
  }
  if (missingPools.length > 0) {
    compliance_flags.push('MISSING_POOL_REFUSED');
    return {
      output_payload: {
        verdict: 'refused',
        refused_because: 'pinned_pool_absent',
        refused_field: null,
        refused_fields: missingPools,
        issues: [],
        manual_review_required: true,
        evidence: {
          record_type: 'zcash_supply_check',
          tool_id: TOOL_ID,
          tool_version: TOOL_VERSION,
          refused: true,
          chain_verified: false,
          pii_carried: false,
          refusal_free: false,
        },
      },
      compliance_flags,
    };
  }

  // -- R5: fractional zatoshi (a decimal fraction is a units error; zatoshi are
  //    whole units). Claimed supply checked with the pools, reported by field.
  const fractionalFields = [];
  for (let i = 0; i < POOL_NAMES.length; i++) {
    const v = poolsIn[POOL_NAMES[i]];
    if (v !== Math.floor(v)) fractionalFields.push('pools.' + POOL_NAMES[i]);
  }
  if (pp.claimed_supply_zat !== Math.floor(pp.claimed_supply_zat)) {
    fractionalFields.push('claimed_supply_zat');
  }
  if (fractionalFields.length > 0) {
    compliance_flags.push('NON_INTEGER_ZATOSHI_REFUSED');
    return {
      output_payload: {
        verdict: 'refused',
        refused_because: 'fractional_zatoshi_value',
        refused_field: null,
        refused_fields: fractionalFields,
        issues: [],
        manual_review_required: true,
        evidence: {
          record_type: 'zcash_supply_check',
          tool_id: TOOL_ID,
          tool_version: TOOL_VERSION,
          refused: true,
          chain_verified: false,
          pii_carried: false,
          refusal_free: false,
        },
      },
      compliance_flags,
    };
  }

  // -- R6: declared safe-arithmetic bound (kernel-declared, not a protocol
  //    constant; keeps sum and delta exactly representable).
  const boundFields = [];
  for (let i = 0; i < POOL_NAMES.length; i++) {
    const v = poolsIn[POOL_NAMES[i]];
    if (v > MAX_POOL_VALUE_ZAT || v < -MAX_POOL_VALUE_ZAT) boundFields.push('pools.' + POOL_NAMES[i]);
  }
  if (pp.claimed_supply_zat > MAX_CLAIMED_SUPPLY_ZAT || pp.claimed_supply_zat < -MAX_CLAIMED_SUPPLY_ZAT) {
    boundFields.push('claimed_supply_zat');
  }
  if (boundFields.length > 0) {
    compliance_flags.push('VALUE_ABOVE_SAFE_ARITHMETIC_BOUND_REFUSED');
    return {
      output_payload: {
        verdict: 'refused',
        refused_because: 'value_above_declared_safe_arithmetic_bound',
        refused_field: null,
        refused_fields: boundFields,
        max_pool_value_zat: MAX_POOL_VALUE_ZAT,
        max_claimed_supply_zat: MAX_CLAIMED_SUPPLY_ZAT,
        issues: [],
        manual_review_required: true,
        evidence: {
          record_type: 'zcash_supply_check',
          tool_id: TOOL_ID,
          tool_version: TOOL_VERSION,
          refused: true,
          chain_verified: false,
          pii_carried: false,
          refusal_free: false,
        },
      },
      compliance_flags,
    };
  }

  // -- Refusals passed: exact integer arithmetic from here.
  const pools = {
    transparent: poolsIn.transparent,
    sprout: poolsIn.sprout,
    sapling: poolsIn.sapling,
    orchard: poolsIn.orchard,
  };
  const recomputedTotal = pools.transparent + pools.sprout + pools.sapling + pools.orchard; // |sum| <= 2^52
  const claimed = pp.claimed_supply_zat;
  const delta = recomputedTotal - claimed; // exact: both sides |<=| 2^52

  // -- Non-negativity, per pinned pool consensus rule.
  const negativePools = [];
  for (let i = 0; i < POOL_NAMES.length; i++) {
    if (pools[POOL_NAMES[i]] < 0) {
      negativePools.push(POOL_NAMES[i]);
      compliance_flags.push('NEGATIVE_POOL_' + POOL_NAMES[i].toUpperCase());
    }
  }

  // -- Conservation identity.
  const issues = [];
  let conserved = true;
  if (delta !== 0) {
    conserved = false;
    compliance_flags.push('SUPPLY_MISMATCH');
    issues.push({
      code: 'SUPPLY_MISMATCH',
      recomputed_total_zat: recomputedTotal,
      claimed_supply_zat: claimed,
      delta_zat: delta,
      detail: 'pools sum to ' + recomputedTotal + ' zatoshi; claimed supply is ' + claimed + ' zatoshi; signed difference ' + delta + ' zatoshi',
    });
  }
  for (let i = 0; i < negativePools.length; i++) {
    issues.push({
      code: 'NEGATIVE_POOL_' + negativePools[i].toUpperCase(),
      pool: negativePools[i],
      balance_zat: pools[negativePools[i]],
      detail: 'negative ' + negativePools[i] + ' pool balance is an invalid chain state per the pinned negative-balance consensus rule',
    });
  }

  let verdict;
  if (negativePools.length > 0) {
    verdict = 'negative_pool_balance';
  } else if (!conserved) {
    verdict = 'supply_mismatch';
  } else {
    verdict = 'conserved';
  }

  const manualReviewRequired = compliance_flags.length > 0;

  return {
    output_payload: {
      verdict,
      method: 'turnstile_balance_identity_check',
      pools,
      recomputed_total_zat: recomputedTotal,
      claimed_supply_zat: claimed,
      delta_zat: delta,
      negative_pools: negativePools,
      issues,
      manual_review_required: manualReviewRequired,
      evidence: {
        record_type: 'zcash_supply_check',
        tool_id: TOOL_ID,
        tool_version: TOOL_VERSION,
        refused: false,
        pools_checked: POOL_NAMES.length,
        computed_from: 'caller_pasted_values_only',
        chain_verified: false,
        pii_carried: false,
        refusal_free: true,
      },
    },
    compliance_flags,
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
