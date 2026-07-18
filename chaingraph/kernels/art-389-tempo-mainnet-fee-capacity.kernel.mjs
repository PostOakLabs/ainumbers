// art-389 — TIP-1010 Mainnet Fee & Payment-Lane Capacity Calculator.
// Pure decision kernel -- no DOM, no window, no Date.now(), no network.
//
// Successor to art-107 (model_tempo_gas_economics), which predates the
// published TIP-1010 mainnet constants. This kernel reads every gas/fee
// parameter from policy_parameters.protocol_parameters (declared, TIP-1010-
// cited) rather than hard-coding today's numbers -- TIP-1010 states the base
// fee is adjustable through future governance via hardfork, so a hard-coded
// constant would silently go stale after the next fork. protocol_version is
// carried on every artifact so a caller can tell which pin produced a result.
//
// Formula (TIP-1010, docs.tempo.xyz): fee_microusd = ceil(base_fee_attodollars_per_gas
// x gas_used / 1e12). BigInt fixed-point throughout -- attodollar-scale values
// lose precision as a float.
//
// Does NOT read /docs/api/rpc (explicitly outside Tempo's stable API contract,
// per TIP process) -- every parameter here is a declared fixture pinned to the
// published TIP-1010 spec text, never fetched at runtime.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-389-tempo-mainnet-fee-capacity';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'compute_tempo_mainnet_fee_capacity',
  mandate_type: 'treasury_mandate',
  gpu: false,
};

const PROTOCOL_VERSION = 'TIP-1010';

// Declared mainnet constants (TIP-1010, docs.tempo.xyz) -- pinned fixture data,
// never hard-compared against; every read goes through resolveParam() so a
// caller-supplied protocol_parameters object overrides with zero code change.
const DEFAULT_PROTOCOL_PARAMETERS = {
  base_fee_attodollars_per_gas: { value: '20000000000', source: 'TIP-1010: mainnet base fee = 2e10 attodollars/gas.' },
  block_gas_limit: { value: '500000000', source: 'TIP-1010: mainnet block gas limit = 500,000,000.' },
  general_lane_gas_limit: { value: '30000000', source: 'TIP-1010: ~94% of block gas reserved for the payment lane; general lane = 30,000,000 gas.' },
  tip20_transfer_gas: { value: '50000', source: 'TIP-1010 / Fee spec: a TIP-20 transfer costs approximately 50,000 gas (~$0.001 at the published base fee).' },
};

const MICROUSD_PER_ATTODOLLAR_SCALE = 1000000000000n; // 1e12, per the published fee formula

function resolveParam(params, key) {
  const p = params && params[key];
  const v = p && typeof p.value === 'string' && /^\d+$/.test(p.value) ? p.value : null;
  return BigInt(v ?? DEFAULT_PROTOCOL_PARAMETERS[key].value);
}

function parseBig(v, fallback) {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0) return BigInt(v);
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return BigInt(v.trim());
  return fallback;
}

// ceil(a * b / c) in exact integer arithmetic
function mulDivCeil(a, b, c) {
  const num = a * b;
  return (num + c - 1n) / c;
}

export function compute(pp) {
  pp = pp || {};
  const protocol_parameters = pp.protocol_parameters || {};
  const base_fee = resolveParam(protocol_parameters, 'base_fee_attodollars_per_gas');
  const block_gas_limit = resolveParam(protocol_parameters, 'block_gas_limit');
  const general_lane_gas_limit = resolveParam(protocol_parameters, 'general_lane_gas_limit');
  const payment_lane_gas_limit = block_gas_limit > general_lane_gas_limit ? block_gas_limit - general_lane_gas_limit : 0n;

  const block_time_seconds = (() => {
    const n = Number(pp.block_time_seconds);
    return Number.isFinite(n) && n > 0 ? n : null;
  })();

  const payment_mix_raw = Array.isArray(pp.payment_mix) ? pp.payment_mix : [];
  const compliance_flags = [];

  if (payment_mix_raw.length === 0) compliance_flags.push('EMPTY_PAYMENT_MIX');
  if (block_time_seconds === null) compliance_flags.push('MISSING_BLOCK_TIME');

  const line_items = payment_mix_raw.map((raw, idx) => {
    const row = raw || {};
    const label = typeof row.label === 'string' && row.label ? row.label : `TX-${idx + 1}`;
    const gas_used = parseBig(row.gas_used, resolveParam(protocol_parameters, 'tip20_transfer_gas'));
    const count = parseBig(row.count, 1n);
    const fee_microusd_per_tx = mulDivCeil(base_fee, gas_used, MICROUSD_PER_ATTODOLLAR_SCALE);
    const total_fee_microusd = fee_microusd_per_tx * count;
    const max_tx_per_block = gas_used > 0n ? payment_lane_gas_limit / gas_used : 0n;
    const tps_headroom = (block_time_seconds !== null && gas_used > 0n)
      ? Number(max_tx_per_block) / block_time_seconds
      : null;

    return {
      label,
      gas_used: gas_used.toString(),
      count: count.toString(),
      fee_microusd_per_tx: fee_microusd_per_tx.toString(),
      total_fee_microusd: total_fee_microusd.toString(),
      max_tx_per_block_payment_lane: max_tx_per_block.toString(),
      tps_headroom,
    };
  });

  const total_fee_microusd = line_items.reduce((acc, r) => acc + BigInt(r.total_fee_microusd), 0n);
  const total_gas_used = payment_mix_raw.reduce((acc, raw, idx) => {
    const row = raw || {};
    const gas_used = parseBig(row.gas_used, resolveParam(protocol_parameters, 'tip20_transfer_gas'));
    const count = parseBig(row.count, 1n);
    return acc + gas_used * count;
  }, 0n);

  const output_payload = {
    protocol_version: PROTOCOL_VERSION,
    protocol_parameters_used: {
      base_fee_attodollars_per_gas: base_fee.toString(),
      block_gas_limit: block_gas_limit.toString(),
      payment_lane_gas_limit: payment_lane_gas_limit.toString(),
      general_lane_gas_limit: general_lane_gas_limit.toString(),
    },
    block_time_seconds,
    line_items,
    summary: {
      total_gas_used: total_gas_used.toString(),
      total_fee_microusd: total_fee_microusd.toString(),
      line_item_count: line_items.length,
    },
    note: 'Base fee and lane limits are DECLARED per TIP-1010 and are governance-adjustable via hardfork -- re-pin protocol_parameters when TIP-1010 is superseded, never hard-code a new constant into this kernel. Not fetched from /docs/api/rpc (outside Tempo\'s stable API contract).',
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
