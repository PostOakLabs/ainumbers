import { executionHash } from './_hash.mjs';

// 815-eth-fee-market: recompute the next block's EIP-1559 base fee per gas and its EIP-4844 blob
// base fee (with the EIP-7918 reserve-price branch from Osaka on) from declared parent-header
// values and declared fork parameters. Integer (BigInt) math only. The figures follow from the
// published formulas and the parameters used; they are not a prediction of future fees, and the
// node reads no chain.
//
// DETERMINISM: compute() is a pure function of pp. No clock, no randomness, no network, no
// TextEncoder. The one loop is the fake_exponential Taylor series. Its trip count is capped by the
// constant MAX_TERMS, and the EXCESS_RATIO_CAP input cap makes the series converge well before it.

const TOOL_ID = '815-eth-fee-market';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'recompute_eth_fee_market',
  mandate_type: 'compliance_control', gpu: false,
};

const UINT64_MAX = 18446744073709551615n;
const UINT256_MAX = (1n << 256n) - 1n;
const GAS_PER_BLOB = 131072n;            // 2**17
const BLOB_BASE_COST = 8192n;            // 2**13, reserve-price forks only
const MIN_BASE_FEE_PER_BLOB_GAS = 1n;
const GAS_LIMIT_ADJUSTMENT_FACTOR = 1024n;
const GAS_LIMIT_MINIMUM = 5000n;
const EXCESS_RATIO_CAP = 128n;           // excess blob gas at most 128 update fractions (e^128 wei/gas)
const MAX_TERMS = 1024;

// Blob schedule per fork, plus the two EIP-1559 constants (unchanged since London).
const FORKS = {
  cancun: { target_blobs: 3n, max_blobs: 6n, base_fee_update_fraction: 3338477n, reserve_price: false },
  prague: { target_blobs: 6n, max_blobs: 9n, base_fee_update_fraction: 5007716n, reserve_price: false },
  osaka: { target_blobs: 6n, max_blobs: 9n, base_fee_update_fraction: 5007716n, reserve_price: true },
  bpo1: { target_blobs: 10n, max_blobs: 15n, base_fee_update_fraction: 8346193n, reserve_price: true },
  bpo2: { target_blobs: 14n, max_blobs: 21n, base_fee_update_fraction: 11684671n, reserve_price: true },
};
const DEFAULT_FORK = 'bpo2';
const EL_DEFAULTS = { elasticity_multiplier: 2n, base_fee_max_change_denominator: 8n };
const BIG_PARAMS = ['target_blobs', 'max_blobs', 'base_fee_update_fraction', 'elasticity_multiplier', 'base_fee_max_change_denominator'];

// Accepts a safe integer or a base-10 digit string; anything else is null.
/** @param {unknown} v @returns {bigint | null} */
function toBig(v) {
  if (typeof v === 'number') return Number.isSafeInteger(v) && v >= 0 ? BigInt(v) : null;
  if (typeof v === 'string' && /^[0-9]+$/.test(v)) return BigInt(v);
  return null;
}

function refuse(code) {
  // `issues` mirrors compliance_flags in output_payload (ART806-MIRROR-ISSUES-1).
  const issues = [code];
  return { output_payload: { refused: true, refusal_code: code, issues }, compliance_flags: issues.length > 0 ? ['INPUT_REFUSED'] : [] };
}

/** @param {bigint | null} b */
const s = (b) => (b === null ? null : b.toString());

// Absent or null section = not requested. Anything else must be a plain object.
function section(v) {
  if (v === undefined || v === null) return { absent: true };
  if (typeof v !== 'object' || Array.isArray(v)) return null;
  return { absent: false, v };
}

// Read the named integer fields of an object; null if any is missing or malformed.
/** @param {any} obj @param {string[]} keys @returns {Record<string, bigint> | null} */
function ints(obj, keys) {
  /** @type {Record<string, bigint>} */
  const out = {};
  for (const k of keys) {
    const b = toBig(obj[k]);
    if (b === null) return null;
    out[k] = b;
  }
  return out;
}

// EIP-4844 fake_exponential: factor * e ** (numerator / denominator), integer Taylor series.
/** @param {bigint} factor @param {bigint} numerator @param {bigint} denominator */
function fakeExponential(factor, numerator, denominator) {
  let output = 0n;
  let acc = factor * denominator;
  for (let i = 1; i <= MAX_TERMS && acc > 0n; i++) {
    output += acc;
    acc = (acc * numerator) / (denominator * BigInt(i));
  }
  return output / denominator;
}

export function compute(pp) {
  pp = pp || {};
  const forkName = pp.fork === undefined || pp.fork === null ? DEFAULT_FORK : pp.fork;
  if (typeof forkName !== 'string' || !Object.prototype.hasOwnProperty.call(FORKS, forkName)) return refuse('UNKNOWN_FORK');

  // Parameters: the named fork's values, then any declared override, field by field.
  /** @type {{ target_blobs: bigint, max_blobs: bigint, base_fee_update_fraction: bigint, reserve_price: boolean, elasticity_multiplier: bigint, base_fee_max_change_denominator: bigint }} */
  const params = { ...FORKS[forkName], ...EL_DEFAULTS };
  /** @type {Record<string, any>} */
  const setParam = params;
  const over = section(pp.fork_parameters);
  if (!over) return refuse('FORK_PARAMETERS_INVALID');
  const overridden = [];
  if (!over.absent) {
    for (const k of Object.keys(over.v)) {
      const v = over.v[k];
      if (k === 'reserve_price') {
        if (typeof v !== 'boolean') return refuse('FORK_PARAMETERS_INVALID');
        params.reserve_price = v;
      } else if (BIG_PARAMS.includes(k)) {
        const b = toBig(v);
        if (b === null || b > UINT64_MAX) return refuse('FORK_PARAMETERS_INVALID');
        setParam[k] = b;
      } else {
        return refuse('FORK_PARAMETERS_INVALID');
      }
      overridden.push(k);
    }
  }
  if (params.target_blobs === 0n || params.max_blobs <= params.target_blobs || params.base_fee_update_fraction === 0n
    || params.elasticity_multiplier === 0n || params.base_fee_max_change_denominator === 0n) return refuse('FORK_PARAMETERS_INVALID');

  const bf = section(pp.base_fee);
  const bl = section(pp.blob_fee);
  if (!bf || !bl) return refuse('NON_NEGATIVE_INTEGER_INPUTS');
  if (bf.absent && bl.absent) return refuse('NO_SECTION_REQUESTED');
  const bfI = bf.absent ? null : ints(bf.v, ['parent_gas_limit', 'parent_gas_used', 'parent_base_fee_per_gas']);
  const blI = bl.absent ? null : ints(bl.v, ['parent_excess_blob_gas', 'parent_blob_gas_used']);
  if ((!bf.absent && !bfI) || (!bl.absent && !blI)) return refuse('NON_NEGATIVE_INTEGER_INPUTS');

  // Optional fields: the child block's gas limit, and the parent base fee for the reserve-price test.
  let blockGasLimit = null;
  if (bfI && bf.v.block_gas_limit !== undefined && bf.v.block_gas_limit !== null) {
    blockGasLimit = toBig(bf.v.block_gas_limit);
    if (blockGasLimit === null) return refuse('NON_NEGATIVE_INTEGER_INPUTS');
  }
  let blobParentBaseFee = null;
  if (blI && bl.v.parent_base_fee_per_gas !== undefined && bl.v.parent_base_fee_per_gas !== null) {
    blobParentBaseFee = toBig(bl.v.parent_base_fee_per_gas);
    if (blobParentBaseFee === null) return refuse('NON_NEGATIVE_INTEGER_INPUTS');
  }

  const gas = [];
  if (bfI) gas.push(bfI.parent_gas_limit, bfI.parent_gas_used, blockGasLimit ?? 0n);
  if (blI) gas.push(blI.parent_excess_blob_gas, blI.parent_blob_gas_used);
  if (gas.some((x) => x > UINT64_MAX)) return refuse('UINT64_RANGE');
  if ((bfI && bfI.parent_base_fee_per_gas > UINT256_MAX) || (blobParentBaseFee !== null && blobParentBaseFee > UINT256_MAX)) return refuse('UINT256_RANGE');

  // EIP-1559 base fee per gas.
  let target = null;
  let baseFee = null;
  let change = null;
  let direction = null;
  let gasLimitValid = null;
  if (bfI) {
    const { parent_gas_limit: limit, parent_gas_used: used, parent_base_fee_per_gas: parentFee } = bfI;
    if (used > limit) return refuse('GAS_USED_EXCEEDS_LIMIT');
    target = limit / params.elasticity_multiplier;
    if (target === 0n) return refuse('GAS_TARGET_ZERO');
    if (blockGasLimit !== null) {
      const delta = limit / GAS_LIMIT_ADJUSTMENT_FACTOR;
      gasLimitValid = blockGasLimit < limit + delta && blockGasLimit > limit - delta && blockGasLimit >= GAS_LIMIT_MINIMUM;
    }
    if (used === target) {
      baseFee = parentFee;
    } else if (used > target) {
      const d = (parentFee * (used - target)) / target / params.base_fee_max_change_denominator;
      baseFee = parentFee + (d > 1n ? d : 1n);
    } else {
      baseFee = parentFee - (parentFee * (target - used)) / target / params.base_fee_max_change_denominator;
    }
    change = baseFee - parentFee;
    direction = change > 0n ? 'up' : change < 0n ? 'down' : 'unchanged';
  }

  // EIP-4844 excess blob gas and blob base fee, with the EIP-7918 branch on reserve-price forks.
  let targetBlobGas = null;
  let maxBlobGas = null;
  let parentBlobFee = null;
  let excess = null;
  let blobFee = null;
  let reserveActive = null;
  if (blI) {
    const { parent_excess_blob_gas: parentExcess, parent_blob_gas_used: used } = blI;
    targetBlobGas = GAS_PER_BLOB * params.target_blobs;
    maxBlobGas = GAS_PER_BLOB * params.max_blobs;
    if (used % GAS_PER_BLOB !== 0n || used > maxBlobGas) return refuse('BLOB_GAS_USED_INVALID');
    if (params.reserve_price && blobParentBaseFee === null) return refuse('RESERVE_PRICE_NEEDS_PARENT_BASE_FEE');
    const fraction = params.base_fee_update_fraction;
    if (parentExcess + used > EXCESS_RATIO_CAP * fraction) return refuse('EXCESS_BLOB_GAS_OUT_OF_RANGE');
    // The child block's schedule prices the parent's excess too (EIP-7918 specification text).
    parentBlobFee = fakeExponential(MIN_BASE_FEE_PER_BLOB_GAS, parentExcess, fraction);
    if (parentExcess + used < targetBlobGas) {
      excess = 0n;
      if (params.reserve_price) reserveActive = BLOB_BASE_COST * blobParentBaseFee > GAS_PER_BLOB * parentBlobFee;
    } else if (params.reserve_price && BLOB_BASE_COST * blobParentBaseFee > GAS_PER_BLOB * parentBlobFee) {
      reserveActive = true;
      excess = parentExcess + (used * (params.max_blobs - params.target_blobs)) / params.max_blobs;
    } else {
      if (params.reserve_price) reserveActive = false;
      excess = parentExcess + used - targetBlobGas;
    }
    blobFee = fakeExponential(MIN_BASE_FEE_PER_BLOB_GAS, excess, fraction);
  }

  // The spec rejects a child block whose declared gas limit is out of bounds; the fee still follows.
  const issues = gasLimitValid === false ? ['BLOCK_GAS_LIMIT_INVALID'] : [];
  return {
    output_payload: {
      refused: false,
      fork: forkName,
      parameters_source: overridden.length === 0 ? 'fork_default' : 'declared_override',
      overridden_parameters: overridden.sort(),
      parameters_used: {
        target_blobs: s(params.target_blobs),
        max_blobs: s(params.max_blobs),
        base_fee_update_fraction: s(params.base_fee_update_fraction),
        reserve_price: params.reserve_price,
        elasticity_multiplier: s(params.elasticity_multiplier),
        base_fee_max_change_denominator: s(params.base_fee_max_change_denominator),
      },
      parent_gas_target: s(target),
      base_fee_per_gas: s(baseFee),
      base_fee_change_wei: s(change),
      base_fee_direction: direction,
      block_gas_limit_valid: gasLimitValid,
      target_blob_gas_per_block: s(targetBlobGas),
      max_blob_gas_per_block: s(maxBlobGas),
      parent_base_fee_per_blob_gas: s(parentBlobFee),
      reserve_price_branch_taken: reserveActive,
      excess_blob_gas: s(excess),
      base_fee_per_blob_gas: s(blobFee),
      base_fee_per_blob_wei: s(blobFee === null ? null : blobFee * GAS_PER_BLOB),
      issues,
    },
    compliance_flags: [...issues],
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
