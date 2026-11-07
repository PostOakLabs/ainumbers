import { executionHash } from './_hash.mjs';

// 808-lst-share-rate-reconciler — recompute a rebasing liquid-staking share rate from DECLARED protocol
// state: share->ether and ether->share conversions on the internal-ether / internal-shares rate, fee
// dilution, wrap/unwrap amounts and round-trip loss. Pure BigInt; no clock, no hash inside compute(),
// no network. Runs unmodified in the QuickJS-ng guest (no TextEncoder/atob/URL).
//
// Rules R1-R10 and fixtures F1-F8 follow research/ETH-LST-SHARERATE-BUILD-SPEC-AMENDED-2026-11.md.
// Clause citations live in the node shard (standards_basis / cited_clause_digest), not in strings here.

const TOOL_ID = '808-lst-share-rate-reconciler';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'reconcile_lst_share_rate',
  mandate_type: 'compliance_control', gpu: false,
};

const SCOPE_NOTE = 'Recomputes share-rate conversions for a rebasing liquid-staking token from caller-declared state: internal ether (the rate numerator), internal shares (the rate denominator) and external shares. Conversions use internal ether and internal shares, rounded down; total shares, external ether and total pooled ether are reported as disclosure only. This kernel does NOT read any chain: it cannot know whether the declared values match any deployed token, whether a declared snapshot came from a real oracle report, or how external shares were minted. Fee rates, withdrawal finalization and mintable-external capacity are not modeled; fees enter only as a declared count of shares minted as fees. Findings are properties of the declared numbers under the stated arithmetic, not an audit of any deployment.';

const UINT128_MAX = (1n << 128n) - 1n;
const TWO_128 = 1n << 128n;
const MAX_SNAPSHOTS = 64;
const MAX_OPS = 256;

function parseUint(v) {
  if (typeof v === 'number') {
    if (!Number.isInteger(v) || v < 0 || !Number.isSafeInteger(v)) return null;
    return BigInt(v);
  }
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!/^[0-9]+$/.test(t) || t.length > 80) return null;
  return BigInt(t);
}

/** @param {bigint} a @param {bigint} b @returns {bigint} */
function ceilDiv(a, b) {
  const q = a / b;
  return q * b === a ? q : q + 1n;
}

function isObj(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function labelOf(v) {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

function refused(reasons) {
  return {
    output_payload: {
      snapshots: [],
      fee_accrual_between_snapshots: [],
      wraps: [],
      unwraps: [],
      note: SCOPE_NOTE,
      reasons,
      issues: reasons,
    },
    compliance_flags: reasons.length > 0 ? ['INPUT_REFUSED'] : [],
  };
}

export function compute(pp) {
  pp = isObj(pp) ? pp : {};
  const reasons = [];

  const holder = parseUint(pp.holder_shares);
  if (holder === null) reasons.push('holder_shares is required and must be a non-negative integer');
  else if (!(holder < UINT128_MAX)) reasons.push('holder_shares must be below 2^128 - 1');

  const rawSnaps = pp.snapshots;
  const snaps = [];
  if (!Array.isArray(rawSnaps) || rawSnaps.length === 0) {
    reasons.push('snapshots is required and must be a non-empty array');
  } else if (rawSnaps.length > MAX_SNAPSHOTS) {
    reasons.push('snapshots may hold at most ' + MAX_SNAPSHOTS + ' entries');
  } else {
    const seen = {};
    for (let i = 0; i < rawSnaps.length; i++) {
      const s = rawSnaps[i];
      if (!isObj(s)) { reasons.push('snapshots[' + i + '] must be an object'); continue; }
      const id = labelOf(s.snapshot_id);
      if (id === null) { reasons.push('snapshots[' + i + '].snapshot_id is required'); continue; }
      if (Object.prototype.hasOwnProperty.call(seen, id)) { reasons.push('snapshots[' + i + '].snapshot_id is a duplicate'); continue; }
      seen[id] = true;
      const N = parseUint(s.internal_ether);
      const D = parseUint(s.internal_shares);
      const X = s.external_shares === undefined || s.external_shares === null ? 0n : parseUint(s.external_shares);
      let bad = false;
      if (N === null || N === 0n || !(N < TWO_128)) { reasons.push('snapshots[' + i + '].internal_ether must be an integer above 0 and below 2^128'); bad = true; }
      if (D === null || D === 0n) { reasons.push('snapshots[' + i + '].internal_shares must be an integer above 0'); bad = true; }
      if (X === null) { reasons.push('snapshots[' + i + '].external_shares must be a non-negative integer'); bad = true; }
      if (!bad && !(D + X < TWO_128)) { reasons.push('snapshots[' + i + '] internal_shares plus external_shares must be below 2^128'); bad = true; }
      let F = null;
      if (s.shares_minted_as_fees !== undefined && s.shares_minted_as_fees !== null) {
        F = parseUint(s.shares_minted_as_fees);
        if (F === null) { reasons.push('snapshots[' + i + '].shares_minted_as_fees must be a non-negative integer'); bad = true; }
        else if (!bad && !(F < D)) { reasons.push('snapshots[' + i + '].shares_minted_as_fees must be below internal_shares'); bad = true; }
      }
      let dTotS = null;
      if (s.declared_total_shares !== undefined && s.declared_total_shares !== null) {
        dTotS = parseUint(s.declared_total_shares);
        if (dTotS === null) { reasons.push('snapshots[' + i + '].declared_total_shares must be a non-negative integer'); bad = true; }
      }
      let dTotE = null;
      if (s.declared_total_pooled_ether !== undefined && s.declared_total_pooled_ether !== null) {
        dTotE = parseUint(s.declared_total_pooled_ether);
        if (dTotE === null) { reasons.push('snapshots[' + i + '].declared_total_pooled_ether must be a non-negative integer'); bad = true; }
      }
      const ts = s.report_timestamp === undefined || s.report_timestamp === null ? null : labelOf(String(s.report_timestamp));
      if (!bad) snaps.push({ id, N, D, X, F, dTotS, dTotE, ts });
    }
  }

  const rawWraps = pp.wrap_ops === undefined || pp.wrap_ops === null ? [] : pp.wrap_ops;
  const rawUnwraps = pp.unwrap_ops === undefined || pp.unwrap_ops === null ? [] : pp.unwrap_ops;
  if (!Array.isArray(rawWraps)) reasons.push('wrap_ops, if supplied, must be an array');
  if (!Array.isArray(rawUnwraps)) reasons.push('unwrap_ops, if supplied, must be an array');
  const byId = {};
  for (let i = 0; i < snaps.length; i++) byId[snaps[i].id] = snaps[i];

  const wraps = [];
  const unwraps = [];
  if (Array.isArray(rawWraps) && Array.isArray(rawUnwraps)) {
    if (rawWraps.length + rawUnwraps.length > MAX_OPS) {
      reasons.push('wrap_ops plus unwrap_ops may hold at most ' + MAX_OPS + ' entries');
    } else {
      for (let i = 0; i < rawWraps.length; i++) {
        const o = rawWraps[i];
        const sid = isObj(o) ? labelOf(o.snapshot_id) : null;
        const amt = isObj(o) ? parseUint(o.amount) : null;
        if (sid === null || !Object.prototype.hasOwnProperty.call(byId, sid)) { reasons.push('wrap_ops[' + i + '].snapshot_id must name a declared snapshot'); continue; }
        if (amt === null) { reasons.push('wrap_ops[' + i + '].amount must be a non-negative integer'); continue; }
        if (amt === 0n) { reasons.push('wrap_ops[' + i + '].amount is zero; a wrap of zero is refused'); continue; }
        if (!(amt < UINT128_MAX)) { reasons.push('wrap_ops[' + i + '].amount must be below 2^128 - 1'); continue; }
        wraps.push({ sid, amt });
      }
      for (let i = 0; i < rawUnwraps.length; i++) {
        const o = rawUnwraps[i];
        const sid = isObj(o) ? labelOf(o.snapshot_id) : null;
        const amt = isObj(o) ? parseUint(o.amount) : null;
        if (sid === null || !Object.prototype.hasOwnProperty.call(byId, sid)) { reasons.push('unwrap_ops[' + i + '].snapshot_id must name a declared snapshot'); continue; }
        if (amt === null) { reasons.push('unwrap_ops[' + i + '].amount must be a non-negative integer'); continue; }
        if (amt === 0n) { reasons.push('unwrap_ops[' + i + '].amount is zero; an unwrap of zero is refused'); continue; }
        if (!(amt < UINT128_MAX)) { reasons.push('unwrap_ops[' + i + '].amount must be below 2^128 - 1'); continue; }
        unwraps.push({ sid, amt });
      }
    }
  }

  const chain_label = labelOf(pp.network_label);

  if (reasons.length > 0) return refused(reasons);

  // Rate: ether = floor(shares * N / D); shares = floor(ether * D / N). N and D are the INTERNAL
  // figures; totals below are disclosure only and never enter a conversion.
  const out = [];
  const balances = [];
  for (let i = 0; i < snaps.length; i++) {
    const s = snaps[i];
    const balance = (holder * s.N) / s.D;
    balances.push(balance);
    const externalEther = (s.X * s.N) / s.D;
    const totalShares = s.D + s.X;
    const totalPooled = s.N + externalEther;
    const entry = {
      snapshot_id: s.id,
      report_timestamp: s.ts,
      internal_ether: s.N.toString(),
      internal_shares: s.D.toString(),
      external_shares: s.X.toString(),
      holder_shares: holder.toString(),
      balance: balance.toString(),
      balance_remainder: ((holder * s.N) % s.D).toString(),
      rounding_direction: 'down',
      cost_to_deposit_round_up: ceilDiv(holder * s.N, s.D).toString(),
      disclosed_totals: {
        total_shares: totalShares.toString(),
        external_ether: externalEther.toString(),
        total_pooled_ether: totalPooled.toString(),
        label: 'disclosure only; conversions use internal_ether and internal_shares',
      },
      cross_check: {
        residual_shares: s.dTotS === null ? null : (s.dTotS - totalShares).toString(),
        residual_ether: s.dTotE === null ? null : (s.dTotE - totalPooled).toString(),
      },
      fee: null,
    };
    if (s.F !== null) {
      const noFee = (holder * s.N) / (s.D - s.F);
      entry.fee = {
        shares_minted_as_fees: s.F.toString(),
        nofee_balance: noFee.toString(),
        net_balance: balance.toString(),
        fee_dilution: (noFee - balance).toString(),
      };
    }
    out.push(entry);
  }

  const accrual = [];
  for (let i = 1; i < snaps.length; i++) {
    const delta = balances[i] - balances[i - 1];
    accrual.push({
      from_snapshot_id: snaps[i - 1].id,
      to_snapshot_id: snaps[i].id,
      balance_delta: delta.toString(),
      rebase_direction: delta > 0n ? 'positive' : (delta < 0n ? 'negative' : 'none'),
      fee_dilution_at_to: out[i].fee === null ? null : out[i].fee.fee_dilution,
    });
  }

  const wrapOut = [];
  for (let i = 0; i < wraps.length; i++) {
    const s = byId[wraps[i].sid];
    const a = wraps[i].amt;
    const w = (a * s.D) / s.N;
    const back = (w * s.N) / s.D;
    const loss = a - back;
    const bound = ceilDiv(s.N, s.D);
    wrapOut.push({
      snapshot_id: s.id,
      ether_in: a.toString(),
      shares_out: w.toString(),
      rounding_direction: 'down',
      remainder: ((a * s.D) % s.N).toString(),
      round_trip_ether_back: back.toString(),
      round_trip_loss: loss.toString(),
      round_trip_loss_bound: bound.toString(),
      loss_within_bound: loss >= 0n && loss <= bound,
      floors_to_zero: w === 0n,
    });
  }

  const unwrapOut = [];
  for (let i = 0; i < unwraps.length; i++) {
    const s = byId[unwraps[i].sid];
    const a = unwraps[i].amt;
    const e = (a * s.N) / s.D;
    unwrapOut.push({
      snapshot_id: s.id,
      shares_in: a.toString(),
      ether_out: e.toString(),
      rounding_direction: 'down',
      remainder: ((a * s.N) % s.D).toString(),
      floors_to_zero: e === 0n,
    });
  }

  return {
    output_payload: {
      network_label: chain_label,
      snapshots: out,
      fee_accrual_between_snapshots: accrual,
      wraps: wrapOut,
      unwraps: unwrapOut,
      note: SCOPE_NOTE,
      reasons: [],
      issues: [],
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
