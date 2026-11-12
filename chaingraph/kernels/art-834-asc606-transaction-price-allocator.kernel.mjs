import { executionHash } from './_hash.mjs';

// art-834-asc606-transaction-price-allocator — allocates a declared transaction price across declared
// performance obligations by relative standalone selling price (SSP), under a declared discount
// handling, rounding rule and residual approach. Integer minor units only (BigInt inside, safe-integer
// Numbers out). It allocates by the method you declare; it does not decide SSPs, does not identify
// performance obligations, and is not an accounting conclusion. Values only, ids only, no free text.
//
// DETERMINISM: compute() is a pure function of pp (no clock, no randomness, no I/O, no TextEncoder).

const TOOL_ID = 'art-834-asc606-transaction-price-allocator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'allocate_asc606_transaction_price',
  mandate_type: 'compliance_control', gpu: false,
};

const MAX_MINOR = 1000000000000000n; // 1e15: keeps every output a safe integer
const MAX_OBLIGATIONS = 64;
const ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const DISCOUNT_HANDLING = ['proportional', 'assign', 'none'];
const ROUNDING_RULES = ['largest_remainder', 'half_up_remainder_to_largest'];
const RESIDUAL_APPROACHES = ['off', 'on'];

// Integer parse: a safe-integer Number or a decimal-digit string. null when anything else.
function toInt(v) {
  if (typeof v === 'number') return Number.isSafeInteger(v) ? BigInt(v) : null;
  if (typeof v === 'string' && /^-?[0-9]{1,20}$/.test(v)) return BigInt(v);
  return null;
}

// Deterministic order: larger SSP first, then id ascending. Independent of input order.
function bySspDescThenId(a, b) {
  if (a.ssp !== b.ssp) return a.ssp > b.ssp ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function refuse(price, flags, pp) {
  const compliance_flags = flags.concat(['INDETERMINATE']);
  const output_payload = {
    transaction_price_minor: price,
    allocations: [],
    total_ssp_minor: null,
    total_allocated_minor: null,
    total_discount_minor: null,
    rounding_rule: ROUNDING_RULES.includes(pp.rounding_rule) ? pp.rounding_rule : null,
    discount_handling: DISCOUNT_HANDLING.includes(pp.discount_handling) ? pp.discount_handling : null,
    residual_approach: RESIDUAL_APPROACHES.includes(pp.residual_approach) ? pp.residual_approach : null,
    indeterminate: true,
    warnings: compliance_flags.slice(),
  };
  return { output_payload, compliance_flags };
}

/**
 * compute(pp) — pure allocation kernel.
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = pp || {};
  const flags = [];
  const priceBig = toInt(pp.transaction_price_minor);
  const priceOut = priceBig === null ? null : Number(priceBig);

  // ---- declared rules (required; never defaulted) ----
  if (priceBig === null || priceBig < 0n || priceBig > MAX_MINOR) flags.push('TRANSACTION_PRICE_INVALID_OR_MISSING');
  if (!ROUNDING_RULES.includes(pp.rounding_rule)) flags.push('ROUNDING_RULE_INVALID_OR_MISSING');
  if (!DISCOUNT_HANDLING.includes(pp.discount_handling)) flags.push('DISCOUNT_HANDLING_INVALID_OR_MISSING');
  if (!RESIDUAL_APPROACHES.includes(pp.residual_approach)) flags.push('RESIDUAL_APPROACH_INVALID_OR_MISSING');

  const rawObs = pp.obligations;
  if (!Array.isArray(rawObs) || rawObs.length === 0) flags.push('OBLIGATIONS_MISSING');
  else if (rawObs.length > MAX_OBLIGATIONS) flags.push('MAX_OBLIGATIONS_EXCEEDED');
  if (flags.length) return refuse(priceOut, flags, pp);

  const residualOn = pp.residual_approach === 'on';
  const residualId = pp.residual_obligation_id == null ? null : String(pp.residual_obligation_id);

  // ---- obligations ----
  const obs = [];
  const seen = new Set();
  let sspMissing = false;
  let badOb = false;
  let dupId = false;
  for (let i = 0; i < rawObs.length; i++) {
    const o = rawObs[i];
    if (o == null || typeof o !== 'object' || typeof o.id !== 'string' || !ID_RE.test(o.id)) { badOb = true; continue; }
    if (seen.has(o.id)) { dupId = true; continue; }
    seen.add(o.id);
    const isResidualTarget = residualOn && o.id === residualId;
    let ssp = null;
    if (o.ssp_minor == null) {
      if (!isResidualTarget) sspMissing = true;
    } else {
      ssp = toInt(o.ssp_minor);
      if (ssp === null || ssp <= 0n || ssp > MAX_MINOR) badOb = true;
    }
    let cap = null;
    if (o.cap_minor != null) {
      cap = toInt(o.cap_minor);
      if (cap === null || cap < 0n || cap > MAX_MINOR) badOb = true;
    }
    obs.push({ id: o.id, ssp, cap, candidate: o.residual_candidate === true, residualTarget: isResidualTarget });
  }
  if (badOb) flags.push('OBLIGATION_FIELD_INVALID');
  if (dupId) flags.push('DUPLICATE_OBLIGATION_ID');
  if (sspMissing) flags.push('SSP_MISSING');

  if (residualOn) {
    const target = obs.find((o) => o.id === residualId);
    if (!target || !target.candidate) flags.push('RESIDUAL_TARGET_INVALID');
  }

  const assignIds = Array.isArray(pp.discount_assigned_ids) ? pp.discount_assigned_ids : null;
  if (pp.discount_handling === 'assign' && !residualOn) {
    if (assignIds === null || assignIds.length === 0) flags.push('DISCOUNT_ASSIGNMENT_MISSING');
    else if (assignIds.some((id) => typeof id !== 'string' || !seen.has(id))) flags.push('DISCOUNT_ASSIGNMENT_ID_UNKNOWN');
  }
  if (flags.length) return refuse(priceOut, flags, pp);

  const price = priceBig;
  const n = obs.length;
  const alloc = new Array(n).fill(0n);
  const discount = new Array(n).fill(0n);
  let totalSsp = 0n;
  for (const o of obs) if (o.ssp !== null) totalSsp += o.ssp;

  if (residualOn) {
    // Residual approach: every other obligation takes its SSP; the declared obligation takes what remains.
    let others = 0n;
    for (let i = 0; i < n; i++) {
      if (obs[i].residualTarget) continue;
      alloc[i] = obs[i].ssp;
      others += obs[i].ssp;
    }
    for (let i = 0; i < n; i++) if (obs[i].residualTarget) alloc[i] = price - others;
    const resAmt = price - others;
    if (resAmt <= 0n) flags.push('RESIDUAL_NEGATIVE_OR_ZERO');
  } else {
    // Exact targets t_i = num_i / den, with sum(num_i) = price * den.
    const listed = pp.discount_handling === 'assign' && price < totalSsp ? new Set(assignIds) : null;
    let num;
    let den;
    if (listed) {
      let L = 0n;
      for (const o of obs) if (listed.has(o.id)) L += o.ssp;
      const D = totalSsp - price;
      if (D > L) {
        flags.push('DISCOUNT_EXCEEDS_ASSIGNED_SSP');
        return refuse(priceOut, flags, pp);
      }
      den = L;
      num = obs.map((o) => (listed.has(o.id) ? o.ssp * (L - D) : o.ssp * L));
    } else {
      if (price < totalSsp && pp.discount_handling === 'none') {
        flags.push('PRICE_BELOW_SSP_NO_DISCOUNT_RULE');
        return refuse(priceOut, flags, pp);
      }
      den = totalSsp;
      num = obs.map((o) => price * o.ssp);
    }
    if (price > totalSsp) flags.push('PRICE_EXCEEDS_TOTAL_SSP');

    const floor = num.map((v) => v / den);
    const rem = num.map((v) => v % den);
    let sumFloor = 0n;
    for (const f of floor) sumFloor += f;
    const R = price - sumFloor; // 0 <= R < n

    if (pp.rounding_rule === 'largest_remainder') {
      const order = obs.map((o, i) => ({ i, id: o.id, ssp: o.ssp, rem: rem[i] }));
      order.sort((a, b) => {
        if (a.rem !== b.rem) return a.rem > b.rem ? -1 : 1;
        return bySspDescThenId(a, b);
      });
      for (let i = 0; i < n; i++) alloc[i] = floor[i];
      for (let k = 0n; k < R; k++) alloc[order[Number(k)].i] += 1n;
    } else {
      let sumR = 0n;
      for (let i = 0; i < n; i++) {
        alloc[i] = floor[i] + (2n * rem[i] >= den ? 1n : 0n);
        sumR += alloc[i];
      }
      const diff = price - sumR;
      if (diff !== 0n) {
        const order = obs.map((o, i) => ({ i, id: o.id, ssp: o.ssp }));
        order.sort(bySspDescThenId);
        alloc[order[0].i] += diff;
      }
    }
    if (price < totalSsp) {
      for (let i = 0; i < n; i++) discount[i] = obs[i].ssp - alloc[i];
    }
  }

  // ---- outputs ----
  const allocations = [];
  let totalAlloc = 0n;
  let totalDiscount = 0n;
  let capExceeded = false;
  for (let i = 0; i < n; i++) {
    const o = obs[i];
    const exceeds = o.cap !== null && alloc[i] > o.cap;
    if (exceeds) capExceeded = true;
    totalAlloc += alloc[i];
    totalDiscount += discount[i];
    allocations.push({
      id: o.id,
      allocated_minor: Number(alloc[i]),
      ssp_minor: o.ssp === null ? null : Number(o.ssp),
      ssp_share_bps: o.ssp === null ? null : Number((o.ssp * 10000n) / totalSsp),
      discount_allocated_minor: Number(discount[i]),
      cap_minor: o.cap === null ? null : Number(o.cap),
      cap_exceeded: exceeds,
    });
  }
  if (capExceeded) flags.push('ALLOCATION_EXCEEDS_CAP');
  if (alloc.some((a) => a < 0n)) flags.push('ALLOCATION_NEGATIVE');

  const compliance_flags = flags.slice();
  const output_payload = {
    transaction_price_minor: Number(price),
    allocations,
    total_ssp_minor: Number(totalSsp),
    total_allocated_minor: Number(totalAlloc),
    total_discount_minor: Number(totalDiscount),
    rounding_rule: pp.rounding_rule,
    discount_handling: pp.discount_handling,
    residual_approach: pp.residual_approach,
    indeterminate: false,
    warnings: compliance_flags.slice(),
  };
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
