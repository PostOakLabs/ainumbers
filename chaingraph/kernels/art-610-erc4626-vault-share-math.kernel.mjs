import { executionHash } from './_hash.mjs';

// art-610 -- ERC-4626 Vault Share Math: pure integer decision kernel.
// ETHMATH-WAVE-BUILD-SPEC.md section 1. All arithmetic is BigInt over uint256, mirroring Solidity's
// integer semantics exactly: there is no IEEE-754 anywhere in this kernel, so there is no
// floating-point rounding to reason about -- only the DIVISION rounding direction ERC-4626
// mandates per function.
//
// THE ROUNDING TABLE, quoted verbatim from ERC-4626 (Status: Final, Created 2021-12-22,
// licensed CC0-1.0; text retrieved from https://eips.ethereum.org/EIPS/eip-4626 and the
// ethereum/ERCs source at ERCS/erc-4626.md on 2026-08-11):
//
//   convertToShares  -- "MUST round down towards 0"
//   convertToAssets  -- "MUST round down towards 0"
//   previewDeposit   -- "MUST return as close to and no more than the exact amount of Vault
//                        shares that would be minted in a `deposit` call"   => round DOWN
//   previewMint      -- "MUST return as close to and no fewer than the exact amount of assets
//                        that would be deposited in a `mint` call"          => round UP
//   previewWithdraw  -- "MUST return as close to and no fewer than the exact amount of Vault
//                        shares that would be burned in a `withdraw` call"  => round UP
//   previewRedeem    -- "MUST return as close to and no more than the exact amount of assets
//                        that would be withdrawn in a `redeem` call"        => round DOWN
//
// and the Security Considerations rationale the directions come from: the vault "should round
// _down_" when determining shares issued or assets transferred to users and "should round _up_"
// when calculating shares or assets users must supply, because "it is considered most secure to
// favor the Vault itself during calculations over its users".
//
// "no more than the exact amount" and "no fewer than the exact amount" are the EIP's own phrasing
// of a direction, not a paraphrase: no-more-than is floor, no-fewer-than is ceiling. This kernel
// applies those six directions and REPORTS which one it used for every conversion it performs, so
// a caller can check an implementation against the table rather than take the table on trust.
//
// Virtual shares/assets (`virtual_amounts`, default true) follow the OpenZeppelin ERC4626
// mitigation -- an inflation/first-depositor attack is a rounding exploit, and the offset is the
// standard defence: shares = assets * (totalSupply + 10**decimals_offset) / (totalAssets + 1).
// Setting virtual_amounts:false gives the naive formula (assets * totalSupply / totalAssets), which
// is exactly the shape the first-depositor attack drains -- supported deliberately so the attack
// can be DEMONSTRATED against this kernel, never because it is recommended.
//
// The round-trip leg deposits then immediately redeems AGAINST THE POST-DEPOSIT STATE
// (totalAssets + assets_in, totalSupply + shares_minted). Redeeming against the pre-deposit state
// would understate the loss to near zero and would not be a round trip at all.
//
// No chain reads: every input is caller-declared. This kernel cannot know whether the declared
// totalAssets/totalSupply match any deployed vault, whether the vault's own implementation applies
// these directions, whether assets are accruing yield between two snapshots, or whether an observed
// exchange-rate drift came from yield, loss, donation, or an attack. It recomputes the standard's
// arithmetic over declared numbers and says which rule produced each one.

const TOOL_ID = 'art-610-erc4626-vault-share-math';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'recompute_erc4626_vault_share_math',
  mandate_type: 'payment_policy',
  gpu: false,
};

const SCOPE_NOTE = 'Recomputes ERC-4626 share/asset conversions from caller-declared vault state, applying the per-function rounding directions ERC-4626 mandates (convertToShares/convertToAssets/previewDeposit/previewRedeem round down; previewMint/previewWithdraw round up) and reporting the direction used for each. This kernel does NOT read any chain: it cannot know whether the declared total_assets/total_supply match any deployed vault, whether that vault\'s own implementation actually applies these directions, whether a rate change between two declared snapshots came from yield, loss, donation or an attack, or whether the declared fee basis points are the fee a vault really charges. Round-trip loss and zero-share-mint findings are properties of the declared numbers under the standard\'s arithmetic, not an audit of any deployment.';

const MAX_UINT256 = (1n << 256n) - 1n;
const BPS_DENOM = 10000n;
const RATE_SCALE = 10n ** 18n;

// The rounding directions above, as data, so the output can carry them and a floor artifact can
// assert each one by name rather than by re-reading the source.
const EIP_ROUNDING = {
  convertToShares: { direction: 'down', eip_rule: 'MUST round down towards 0' },
  convertToAssets: { direction: 'down', eip_rule: 'MUST round down towards 0' },
  previewDeposit: { direction: 'down', eip_rule: 'MUST return as close to and no more than the exact amount of Vault shares that would be minted in a deposit call' },
  previewMint: { direction: 'up', eip_rule: 'MUST return as close to and no fewer than the exact amount of assets that would be deposited in a mint call' },
  previewWithdraw: { direction: 'up', eip_rule: 'MUST return as close to and no fewer than the exact amount of Vault shares that would be burned in a withdraw call' },
  previewRedeem: { direction: 'down', eip_rule: 'MUST return as close to and no more than the exact amount of assets that would be withdrawn in a redeem call' },
};

// Which side of the conversion each op runs, independent of its rounding direction.
const OP_SIDE = {
  convertToShares: 'toShares',
  previewDeposit: 'toShares',
  previewWithdraw: 'toShares',
  convertToAssets: 'toAssets',
  previewMint: 'toAssets',
  previewRedeem: 'toAssets',
};

function parseUint(v) {
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

// Solidity Math.mulDiv with an explicit rounding direction. Both operands are non-negative, so
// floor is plain integer division and ceiling adds one when the division is inexact.
function mulDiv(a, b, denom, direction) {
  const prod = a * b;
  const q = prod / denom;
  if (direction === 'up' && q * denom !== prod) return q + 1n;
  return q;
}

function str(v, fallback) {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : fallback;
}

export function compute(pp) {
  pp = (pp !== null && typeof pp === 'object') ? pp : {};
  const reasons = [];

  const total_assets = parseUint(pp.total_assets);
  if (total_assets === null) reasons.push('total_assets is required and must be a non-negative uint256, as a decimal or 0x-hex string');

  const total_supply = parseUint(pp.total_supply);
  if (total_supply === null) reasons.push('total_supply is required and must be a non-negative uint256, as a decimal or 0x-hex string');

  const virtual_amounts = pp.virtual_amounts === false ? false : true;

  let decimals_offset = 0n;
  if (pp.decimals_offset !== undefined && pp.decimals_offset !== null) {
    const d = parseUint(pp.decimals_offset);
    if (d === null || d > 36n) reasons.push('decimals_offset, if supplied, must be an integer 0..36');
    else decimals_offset = d;
  }

  const rawOps = pp.operations === undefined || pp.operations === null ? [] : pp.operations;
  if (!Array.isArray(rawOps)) reasons.push('operations, if supplied, must be an array of {op, amount} entries');

  const parsedOps = [];
  if (Array.isArray(rawOps)) {
    for (let i = 0; i < rawOps.length; i++) {
      const entry = rawOps[i];
      const opName = (entry !== null && typeof entry === 'object' && !Array.isArray(entry)) ? str(entry.op, null) : null;
      if (opName === null || !Object.prototype.hasOwnProperty.call(EIP_ROUNDING, opName)) {
        reasons.push(`operations[${i}].op must be one of convertToShares, convertToAssets, previewDeposit, previewMint, previewWithdraw, previewRedeem`);
        continue;
      }
      const amount = parseUint(entry.amount);
      if (amount === null) {
        reasons.push(`operations[${i}].amount must be a non-negative uint256, as a decimal or 0x-hex string`);
        continue;
      }
      parsedOps.push({ op: opName, amount });
    }
  }

  let fee_bps = null;
  let fee_basis = 'raw';
  if (pp.fee_bps !== undefined && pp.fee_bps !== null) {
    const f = parseUint(pp.fee_bps);
    if (f === null || f > BPS_DENOM) reasons.push('fee_bps, if supplied, must be an integer 0..10000');
    else fee_bps = f;
    const b = str(pp.fee_basis, 'raw');
    if (b !== 'raw' && b !== 'total') reasons.push('fee_basis, if supplied, must be "raw" (fee charged on top of the amount) or "total" (fee carved out of the amount)');
    else fee_basis = b;
  }

  let round_trip_assets = null;
  if (pp.round_trip_assets !== undefined && pp.round_trip_assets !== null) {
    round_trip_assets = parseUint(pp.round_trip_assets);
    if (round_trip_assets === null) reasons.push('round_trip_assets, if supplied, must be a non-negative uint256, as a decimal or 0x-hex string');
  }

  // chain_id / network_label are FREE-TEXT LABELS carried through to the receipt for the reader's
  // own record-keeping (art-492 pattern). They are never a selector: no branch in this kernel reads
  // either value, and no arithmetic below depends on them. A vault on any chain computes the same
  // way, because every input is declared.
  const chain_id = str(pp.chain_id, null);
  const network_label = str(pp.network_label, null);

  let snapshot_b = null;
  if (pp.snapshot_b !== undefined && pp.snapshot_b !== null) {
    const s = pp.snapshot_b;
    if (s === null || typeof s !== 'object' || Array.isArray(s)) {
      reasons.push('snapshot_b, if supplied, must be an object with total_assets and total_supply');
    } else {
      const sa = parseUint(s.total_assets);
      const ss = parseUint(s.total_supply);
      if (sa === null || ss === null) reasons.push('snapshot_b.total_assets and snapshot_b.total_supply must each be a non-negative uint256');
      else snapshot_b = { total_assets: sa, total_supply: ss };
    }
  }

  if (reasons.length > 0) {
    return {
      output_payload: {
        declared_context: { chain_id: null, network_label: null },
        vault_state: null,
        conversions: [],
        fee: null,
        round_trip: null,
        rate_drift: null,
        rounding_table: [],
        note: SCOPE_NOTE,
        reasons,
      },
      compliance_flags: ['ERC4626_INDETERMINATE', 'ERC4626_MALFORMED_INPUT'],
    };
  }

  // ── the two conversion primitives, parameterised by rounding direction ──────────────────
  // OpenZeppelin ERC4626: shares = assets.mulDiv(totalSupply + 10**offset, totalAssets + 1, r)
  //                       assets = shares.mulDiv(totalAssets + 1, totalSupply + 10**offset, r)
  // virtual_amounts:false drops both virtual terms, which is the naive formula the
  // first-depositor attack drains.
  const offsetUnit = virtual_amounts ? 10n ** decimals_offset : 0n;
  const virtualAsset = virtual_amounts ? 1n : 0n;

  function toShares(assets, direction, ta, ts) {
    const denom = ta + virtualAsset;
    if (denom === 0n) return null; // empty vault with no virtual assets: conversion undefined
    return mulDiv(assets, ts + offsetUnit, denom, direction);
  }
  function toAssets(shares, direction, ta, ts) {
    const denom = ts + offsetUnit;
    if (denom === 0n) return null;
    return mulDiv(shares, ta + virtualAsset, denom, direction);
  }

  let undefinedConversion = false;
  const conversions = [];
  for (const { op, amount } of parsedOps) {
    const { direction, eip_rule } = EIP_ROUNDING[op];
    const side = OP_SIDE[op];
    const out = side === 'toShares'
      ? toShares(amount, direction, total_assets, total_supply)
      : toAssets(amount, direction, total_assets, total_supply);
    // The opposite direction on the same inputs -- the caller can see the exact size of the
    // rounding decision, which is what makes a wrong direction visible rather than invisible.
    const other = direction === 'down' ? 'up' : 'down';
    const outOther = side === 'toShares'
      ? toShares(amount, other, total_assets, total_supply)
      : toAssets(amount, other, total_assets, total_supply);
    if (out === null) undefinedConversion = true;
    conversions.push({
      op,
      side: side === 'toShares' ? 'assets_to_shares' : 'shares_to_assets',
      input: amount.toString(),
      output: out === null ? null : out.toString(),
      rounding_direction: direction,
      eip_rule,
      output_if_rounded_other_way: outOther === null ? null : outOther.toString(),
      rounding_changes_result: out !== null && outOther !== null && out !== outOther,
    });
  }

  // ── declared fee application ────────────────────────────────────────────────────────────
  // OpenZeppelin ERC4626Fees: _feeOnRaw = assets.mulDiv(bps, 1e4, Ceil); _feeOnTotal =
  // assets.mulDiv(bps, bps + 1e4, Ceil). Both round UP, the same favour-the-vault direction the
  // Security Considerations text gives for amounts a user must supply. ERC-4626 itself does not
  // mandate a fee formula at all -- this is a declared computation over declared bps, reported as
  // such, never a claim about what any vault charges.
  let fee = null;
  if (fee_bps !== null) {
    const base = round_trip_assets !== null ? round_trip_assets : (parsedOps.length > 0 ? parsedOps[0].amount : 0n);
    const feeAmount = fee_basis === 'raw'
      ? mulDiv(base, fee_bps, BPS_DENOM, 'up')
      : mulDiv(base, fee_bps, fee_bps + BPS_DENOM, 'up');
    fee = {
      fee_bps: fee_bps.toString(),
      fee_basis,
      basis_amount: base.toString(),
      fee_amount: feeAmount.toString(),
      net_amount: (base >= feeAmount ? base - feeAmount : 0n).toString(),
      rounding_direction: 'up',
      note: 'ERC-4626 mandates no fee formula. This applies the OpenZeppelin ERC4626Fees shapes (_feeOnRaw / _feeOnTotal), both rounding up, over the declared fee_bps.',
    };
  }

  // ── round trip: deposit, then redeem against the POST-DEPOSIT state ─────────────────────
  let round_trip = null;
  let zeroShareMint = false;
  if (round_trip_assets !== null) {
    const sharesMinted = toShares(round_trip_assets, EIP_ROUNDING.previewDeposit.direction, total_assets, total_supply);
    // The redeem leg divides by the POST-DEPOSIT supply, which can be zero even when the deposit
    // leg's own denominator was not: with virtual_amounts off and total_supply 0, a deposit into a
    // non-empty vault mints 0 shares, leaving the post-deposit supply still 0.
    const redeemDenom = total_supply + (sharesMinted === null ? 0n : sharesMinted) + offsetUnit;
    if (sharesMinted === null || redeemDenom === 0n) {
      round_trip = {
        assets_in: round_trip_assets.toString(),
        shares_minted: null,
        assets_out: null,
        loss_assets: null,
        loss_bps: null,
        post_deposit_state: null,
        note: 'Round trip undefined: with virtual_amounts off, either the deposit ratio or the post-deposit redeem ratio has a zero denominator, so no share price exists to round trip through.',
      };
      undefinedConversion = true;
    } else {
      const taAfter = total_assets + round_trip_assets;
      const tsAfter = total_supply + sharesMinted;
      const assetsOut = mulDiv(sharesMinted, taAfter + virtualAsset, tsAfter + offsetUnit, EIP_ROUNDING.previewRedeem.direction);
      const loss = round_trip_assets >= assetsOut ? round_trip_assets - assetsOut : 0n;
      const lossBps = round_trip_assets === 0n ? 0n : mulDiv(loss, BPS_DENOM, round_trip_assets, 'up');
      zeroShareMint = round_trip_assets > 0n && sharesMinted === 0n;
      round_trip = {
        assets_in: round_trip_assets.toString(),
        shares_minted: sharesMinted.toString(),
        assets_out: assetsOut.toString(),
        loss_assets: loss.toString(),
        loss_bps: lossBps.toString(),
        post_deposit_state: { total_assets: taAfter.toString(), total_supply: tsAfter.toString() },
        zero_share_mint: zeroShareMint,
        note: 'Deposit uses previewDeposit (round down), redeem uses previewRedeem (round down) against the post-deposit state. loss_bps rounds up, so a non-zero loss never reports as 0 bps. A zero_share_mint means the deposit bought no shares at all -- the first-depositor/inflation-attack outcome.',
      };
    }
  }

  // ── exchange-rate drift between two declared snapshots ─────────────────────────────────
  // rate = assets per 1e18 shares, floored. Reported as a scaled integer; there is no float here.
  let rate_drift = null;
  if (snapshot_b !== null) {
    const denomA = total_supply + offsetUnit;
    const denomB = snapshot_b.total_supply + offsetUnit;
    if (denomA === 0n || denomB === 0n) {
      rate_drift = { rate_a_scaled: null, rate_b_scaled: null, drift_bps: null, rate_scale: RATE_SCALE.toString(), note: 'Rate undefined: a snapshot has zero shares and virtual_amounts is false.' };
      undefinedConversion = true;
    } else {
      const rateA = mulDiv(total_assets + virtualAsset, RATE_SCALE, denomA, 'down');
      const rateB = mulDiv(snapshot_b.total_assets + virtualAsset, RATE_SCALE, denomB, 'down');
      let driftBps = null;
      if (rateA !== 0n) {
        const diff = rateB >= rateA ? rateB - rateA : rateA - rateB;
        const mag = mulDiv(diff, BPS_DENOM, rateA, 'down');
        driftBps = (rateB >= rateA ? mag : -mag).toString();
      }
      rate_drift = {
        rate_a_scaled: rateA.toString(),
        rate_b_scaled: rateB.toString(),
        rate_scale: RATE_SCALE.toString(),
        direction: rateB > rateA ? 'up' : (rateB < rateA ? 'down' : 'flat'),
        drift_bps: driftBps,
        note: 'Rate is assets per 1e18 shares, floored. drift_bps is signed and floored toward zero in magnitude. This kernel cannot know whether a drift came from yield, loss, a donation, or an attack.',
      };
    }
  }

  const rounding_table = Object.keys(EIP_ROUNDING).sort().map((op) => ({
    op,
    direction: EIP_ROUNDING[op].direction,
    eip_rule: EIP_ROUNDING[op].eip_rule,
  }));

  const anyRoundingMattered = conversions.some((c) => c.rounding_changes_result);

  const output_payload = {
    declared_context: { chain_id, network_label },
    vault_state: {
      total_assets: total_assets.toString(),
      total_supply: total_supply.toString(),
      virtual_amounts_used: virtual_amounts,
      decimals_offset_used: decimals_offset.toString(),
      virtual_shares: offsetUnit.toString(),
      virtual_assets: virtualAsset.toString(),
    },
    conversions,
    fee,
    round_trip,
    rate_drift,
    rounding_table,
    note: SCOPE_NOTE,
    reasons: [],
  };

  const compliance_flags = [
    virtual_amounts ? 'ERC4626_VIRTUAL_AMOUNTS' : 'ERC4626_NO_VIRTUAL_AMOUNTS',
    anyRoundingMattered ? 'ERC4626_ROUNDING_MATERIAL' : 'ERC4626_ROUNDING_IMMATERIAL',
  ];
  if (undefinedConversion) compliance_flags.push('ERC4626_CONVERSION_UNDEFINED');
  if (round_trip !== null && round_trip.loss_assets !== null) {
    compliance_flags.push(round_trip.loss_assets === '0' ? 'ERC4626_ROUNDTRIP_LOSSLESS' : 'ERC4626_ROUNDTRIP_LOSS');
  }
  if (zeroShareMint) compliance_flags.push('ERC4626_ZERO_SHARE_MINT');
  if (fee !== null) compliance_flags.push('ERC4626_FEE_APPLIED');
  if (rate_drift !== null && rate_drift.drift_bps !== null && rate_drift.drift_bps !== '0') {
    compliance_flags.push(rate_drift.direction === 'down' ? 'ERC4626_RATE_DECREASED' : 'ERC4626_RATE_INCREASED');
  }

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
