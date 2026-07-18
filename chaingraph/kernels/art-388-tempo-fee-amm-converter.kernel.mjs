// art-388 — Tempo Fee-AMM Conversion Calculator.
// Pure decision kernel — no DOM, no window, no Date.now(), no network.
//
// Tempo has no native gas token: fees are paid in any TIP-20 stablecoin and
// converted to the validator's token via the enshrined protocol Fee AMM at a
// fixed rate (docs.tempo.xyz/protocol/fees/spec-fee): validatorTokenOut =
// userTokenIn x 0.9970 (30 bps to LPs). This kernel converts a supplied
// fee-token amount and checks the conversion against declared pool reserves
// for liquidity sufficiency -- output-or-failure, never a silent overdraw.
//
// Fixed-point BigInt math throughout: amounts are arbitrary-precision integer
// strings in the caller's own base unit (e.g. attodollars). A float would lose
// precision at attodollar scale, so every amount crosses the wire as a string
// and is parsed to BigInt before arithmetic.
//
// The 30% max-pool-utilization guard is a DECLARED policy parameter (not a
// Tempo protocol constant) -- a conservative depth guard so this calculator
// never asserts a fill the venue's real pool could not honor. Callers may
// override it via policy_parameters.max_pool_utilization_bps.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-388-tempo-fee-amm-converter';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'convert_tempo_fee_amm',
  mandate_type: 'treasury_mandate',
  gpu: false,
};

const LP_FEE_BPS = 30n;        // 0.30% to LPs (docs.tempo.xyz/protocol/fees/spec-fee)
const BPS_DENOM = 10000n;
const DEFAULT_MAX_UTILIZATION_BPS = 3000n; // declared depth guard, not a protocol constant

function parseBig(v, fallback = 0n) {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number' && Number.isInteger(v)) return BigInt(v);
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return BigInt(v.trim());
  return fallback;
}

export function compute(pp) {
  pp = pp || {};
  const fee_token = typeof pp.fee_token === 'string' ? pp.fee_token : '';
  const validator_token = typeof pp.validator_token === 'string' ? pp.validator_token : '';
  const user_token_in = parseBig(pp.user_token_in, null);
  const reserves = pp.pool_reserves || {};
  const fee_token_reserve = parseBig(reserves.fee_token_reserve, null);
  const validator_token_reserve = parseBig(reserves.validator_token_reserve, null);
  const max_pool_utilization_bps = (() => {
    const v = pp.max_pool_utilization_bps;
    return (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 10000) ? BigInt(v) : DEFAULT_MAX_UTILIZATION_BPS;
  })();

  const compliance_flags = [];
  const input_well_formed = user_token_in !== null && user_token_in >= 0n
    && fee_token_reserve !== null && fee_token_reserve >= 0n
    && validator_token_reserve !== null && validator_token_reserve >= 0n;

  if (!input_well_formed) {
    compliance_flags.push('MALFORMED_INPUT');
    return {
      output_payload: {
        fee_token, validator_token,
        conversion_ok: false,
        validator_token_out: null,
        lp_fee_amount: null,
        pool_utilization_bps: null,
        reason: 'MALFORMED_INPUT',
      },
      compliance_flags,
    };
  }

  const validator_token_out = (user_token_in * (BPS_DENOM - LP_FEE_BPS)) / BPS_DENOM;
  const lp_fee_amount = user_token_in - validator_token_out;

  const pool_utilization_bps = validator_token_reserve > 0n
    ? Number((validator_token_out * BPS_DENOM) / validator_token_reserve)
    : null;

  const exceeds_max_utilization = validator_token_reserve === 0n
    ? true
    : (validator_token_out * BPS_DENOM) > (validator_token_reserve * max_pool_utilization_bps);

  if (exceeds_max_utilization) compliance_flags.push('INSUFFICIENT_LIQUIDITY');

  const conversion_ok = !exceeds_max_utilization;

  return {
    output_payload: {
      fee_token,
      validator_token,
      conversion_ok,
      validator_token_out: conversion_ok ? validator_token_out.toString() : null,
      lp_fee_amount: lp_fee_amount.toString(),
      pool_utilization_bps,
      max_pool_utilization_bps: Number(max_pool_utilization_bps),
      reason: conversion_ok ? null : 'INSUFFICIENT_LIQUIDITY',
      note: 'Fee-AMM rate (0.9970 / 30bps LP fee) per docs.tempo.xyz/protocol/fees/spec-fee. Pool-utilization guard is a declared calculator parameter, not a Tempo protocol constant.',
    },
    compliance_flags,
  };
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
