import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-364-compute-lcr-nsfr-leverage';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_lcr_nsfr_leverage',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Basel III Liquidity Coverage Ratio (BCBS 238), Net Stable Funding Ratio (BCBS 295), and
// Leverage Ratio (BCBS 270 / BCBS 360) point-in-time calculators, ported from the shipped
// tools/469-lcr-calculator.html, tools/470-nsfr-calculator.html, and
// tools/471-leverage-ratio-calculator.html -- byte-parity is the fixture gate. Deterministic
// point calculation from caller-supplied positions/factors, NOT a Monte Carlo stress
// distribution -- see sim-01-lcr-nsfr-liquidity-stress-test for the stochastic path
// simulator (1,000 paths, P5-P95, breach probability); this kernel is its deterministic
// point-calculation companion.
//
// Pure ECMA-262 arithmetic only -- no Date.now/new Date(), no Math.random. Ratios and
// dollar figures rounded to 2 decimals (r2) only at declared output boundaries; a
// zero-denominator ratio is reported as null (finite gate: never NaN/Infinity).
//
// KERNEL-FAILOPEN-P3-BUILDER-364-1 (fail-closed): the three top-level inputs declared
// required by the manifest inputSchema (lcr, nsfr, leverage) are REQUIRED. A missing,
// null, empty or whitespace-only one is withheld as INDETERMINATE with the missing
// field(s) named, never "ALL_THREE_RATIOS_COMPLIANT". A null ratio inside a fully
// supplied block keeps the existing zero-denominator convention. buildArtifact()
// never throws: an unhashable input returns a refusal artifact instead.

const HQLA_HAIRCUTS = { l1: 0, l2a: 0.15, l2b: 0.25 };
const REQUIRED_FIELDS = ['lcr', 'nsfr', 'leverage'];

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return (v === null || !Number.isFinite(v)) ? null : Math.round(v * 100) / 100; }
function arr(v) { return Array.isArray(v) ? v : []; }
function isPresent(v) { return v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === ''); }

function computeLcr(lcrInput) {
  const hqlaPositions = arr(lcrInput.hqla_positions).map((h) => ({
    level: HQLA_HAIRCUTS[h && h.level] !== undefined ? h.level : 'l1',
    market_value_musd: Math.max(0, safeNum(h && h.market_value_musd, 0)),
  }));

  let l1 = 0, l2a = 0, l2b = 0;
  for (const h of hqlaPositions) {
    const eligible = h.market_value_musd * (1 - HQLA_HAIRCUTS[h.level]);
    if (h.level === 'l1') l1 += eligible;
    else if (h.level === 'l2a') l2a += eligible;
    else l2b += eligible;
  }

  const rawTotal = l1 + l2a + l2b;
  let hqlaTotal = 0;
  if (rawTotal > 0) {
    const maxTotalFromL1 = l1 / 0.60;
    const l2bCap = maxTotalFromL1 * 0.15;
    const l2bUsed = Math.min(l2b, l2bCap);
    const l2aMax = maxTotalFromL1 * 0.40 - l2bUsed;
    const l2aUsed = Math.min(l2a, Math.max(0, l2aMax));
    hqlaTotal = l1 + l2aUsed + l2bUsed;
  }

  const outflows = arr(lcrInput.outflows).map((o) => ({
    label: (o && o.label) || '',
    balance_musd: Math.max(0, safeNum(o && o.balance_musd, 0)),
    rate_pct: Math.min(100, Math.max(0, safeNum(o && o.rate_pct, 0))),
  }));
  const grossOut = outflows.reduce((s, o) => s + o.balance_musd * o.rate_pct / 100, 0);

  const inflows = arr(lcrInput.inflows).map((i) => ({
    label: (i && i.label) || '',
    balance_musd: Math.max(0, safeNum(i && i.balance_musd, 0)),
    rate_pct: Math.min(100, Math.max(0, safeNum(i && i.rate_pct, 0))),
  }));
  const grossIn = inflows.reduce((s, i) => s + i.balance_musd * i.rate_pct / 100, 0);

  const inflowCap = grossOut * 0.75;
  const netInflows = Math.min(grossIn, inflowCap);
  const nco = Math.max(grossOut - netInflows, 0);
  const lcrRatio = nco > 0 ? hqlaTotal / nco : null;

  return {
    hqla_total_musd: r2(hqlaTotal),
    gross_outflows_musd: r2(grossOut),
    gross_inflows_musd: r2(grossIn),
    inflow_cap_musd: r2(inflowCap),
    net_inflows_musd: r2(netInflows),
    net_cash_outflows_musd: r2(nco),
    lcr_pct: lcrRatio === null ? null : r2(lcrRatio * 100),
    lcr_compliant: lcrRatio === null ? true : lcrRatio >= 1,
    lcr_surplus_shortfall_musd: r2(hqlaTotal - nco),
  };
}

function computeNsfr(nsfrInput) {
  const asfItems = arr(nsfrInput.asf_items).map((a) => ({
    label: (a && a.label) || '',
    amount_musd: Math.max(0, safeNum(a && a.amount_musd, 0)),
    factor_pct: Math.min(100, Math.max(0, safeNum(a && a.factor_pct, 0))),
  }));
  const totalAsf = asfItems.reduce((s, a) => s + a.amount_musd * a.factor_pct / 100, 0);

  const rsfItems = arr(nsfrInput.rsf_items).map((r) => ({
    label: (r && r.label) || '',
    amount_musd: Math.max(0, safeNum(r && r.amount_musd, 0)),
    factor_pct: Math.min(100, Math.max(0, safeNum(r && r.factor_pct, 0))),
  }));
  const totalRsf = rsfItems.reduce((s, r) => s + r.amount_musd * r.factor_pct / 100, 0);

  const nsfrRatio = totalRsf > 0 ? totalAsf / totalRsf : null;

  return {
    total_asf_musd: r2(totalAsf),
    total_rsf_musd: r2(totalRsf),
    nsfr_pct: nsfrRatio === null ? null : r2(nsfrRatio * 100),
    nsfr_compliant: nsfrRatio === null ? true : nsfrRatio >= 1,
  };
}

function computeLeverage(levInput) {
  const cet1 = Math.max(0, safeNum(levInput.cet1_musd, 0));
  const at1 = Math.max(0, safeNum(levInput.at1_musd, 0));
  const tier1 = cet1 + at1;
  const gsibBucket = Math.max(0, safeNum(levInput.gsib_bucket, 0));
  const lrBufferPct = gsibBucket > 0 ? gsibBucket * 0.5 : 0;
  const minLrPct = 3.0 + lrBufferPct;

  const obs = Math.max(0, safeNum(levInput.onbs_exposure_musd, 0));
  const deriv = Math.max(0, safeNum(levInput.derivative_exposure_musd, 0));
  const sft = Math.max(0, safeNum(levInput.sft_exposure_musd, 0));
  const offbs = Math.max(0, safeNum(levInput.offbs_exposure_musd, 0));
  const other = Math.max(0, safeNum(levInput.other_exposure_musd, 0));
  const totalExp = obs + deriv + sft + offbs + other;

  const lr = totalExp > 0 ? (tier1 / totalExp) * 100 : null;

  return {
    tier1_capital_musd: r2(tier1),
    total_exposure_musd: r2(totalExp),
    leverage_ratio_pct: r2(lr),
    min_leverage_ratio_pct: r2(minLrPct),
    leverage_ratio_compliant: lr === null ? true : lr >= minLrPct,
    gsib_leverage_buffer_pct: r2(lrBufferPct),
  };
}

export function compute(pp) {
  pp = pp || {};

  // Fail-closed: a required block that is absent, null, empty or whitespace-only
  // withholds the determination. No positive compliance verdict is emitted.
  const missing_required_fields = REQUIRED_FIELDS.filter((f) => !isPresent(pp[f]));
  if (missing_required_fields.length > 0) {
    return {
      output_payload: {
        decision: { gate_policy: 'review_required', execution_state: 'did_not_run', reason: 'required_inputs_incomplete' },
        verdict: 'INDETERMINATE',
        lcr: null,
        nsfr: null,
        leverage: null,
        missing_required_fields,
        regulatory_basis: 'Basel III Liquidity Coverage Ratio (BCBS 238); Net Stable Funding Ratio (BCBS 295); Leverage Ratio (BCBS 270, finalized BCBS 360).',
        note: 'Deterministic point calculation from caller-supplied positions and regulatory factors for a single reporting date. For a stochastic multi-scenario liquidity stress distribution, use sim-01-lcr-nsfr-liquidity-stress-test.',
      },
      compliance_flags: ['INPUT_MISSING_INDETERMINATE'],
    };
  }

  const lcr = computeLcr(pp.lcr || {});
  const nsfr = computeNsfr(pp.nsfr || {});
  const leverage = computeLeverage(pp.leverage || {});

  const compliance_flags = [];
  if (lcr.lcr_compliant === false) compliance_flags.push('LCR_BELOW_100PCT_DEFICIENT');
  if (nsfr.nsfr_compliant === false) compliance_flags.push('NSFR_BELOW_100PCT_DEFICIENT');
  if (leverage.leverage_ratio_compliant === false) compliance_flags.push('LEVERAGE_RATIO_BELOW_MINIMUM_DEFICIENT');
  if (compliance_flags.length === 0) compliance_flags.push('ALL_THREE_RATIOS_COMPLIANT');

  const output_payload = {
    lcr,
    nsfr,
    leverage,
    regulatory_basis: 'Basel III Liquidity Coverage Ratio (BCBS 238); Net Stable Funding Ratio (BCBS 295); Leverage Ratio (BCBS 270, finalized BCBS 360).',
    note: 'Deterministic point calculation from caller-supplied positions and regulatory factors for a single reporting date. For a stochastic multi-scenario liquidity stress distribution, use sim-01-lcr-nsfr-liquidity-stress-test.',
  };

  return { output_payload, compliance_flags };
}

// Mirrors _hash.mjs limits so buildArtifact never throws: non-finite number,
// unsafe integer, nesting past MAX_DEPTH, more values than MAX_ELEMENTS.
// Reports path and kind only, never the offending value.
const HASH_MAX_DEPTH = 512;
const HASH_MAX_ELEMENTS = 1000000;
function findHashRefusal(v, path, depth, budget) {
  if (depth > HASH_MAX_DEPTH) return { reason: 'REFUSED_INPUT_HASH_LIMIT', detail: path + ': too_deep' };
  if (++budget.n > HASH_MAX_ELEMENTS) return { reason: 'REFUSED_INPUT_HASH_LIMIT', detail: path + ': too_many_values' };
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': non_finite' };
    if (Number.isInteger(v) && !Number.isSafeInteger(v)) return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': unsafe_integer' };
    return null;
  }
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      const r = findHashRefusal(v[i], path + '[' + i + ']', depth + 1, budget);
      if (r !== null) return r;
    }
    return null;
  }
  if (v !== null && typeof v === 'object') {
    const ks = Object.keys(v).sort();
    for (let i = 0; i < ks.length; i++) {
      const r = findHashRefusal(v[ks[i]], path + '.' + ks[i], depth + 1, budget);
      if (r !== null) return r;
    }
  }
  return null;
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const unhashable = findHashRefusal(pp, 'pp', 1, { n: 0 });
  if (unhashable !== null) {
    return {
      '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
      chaingraph_version: '0.4.0',
      mandate_type: meta.mandate_type,
      tool_id: TOOL_ID,
      tool_version: TOOL_VERSION,
      generated_at: now ?? null,
      execution_hash: null,
      hash_refusal: { reason: unhashable.reason, detail: unhashable.detail },
      chain: { parent_hashes, parent_tool_ids, chain_depth },
      policy_parameters: null,
      output_payload: { decision: { gate_policy: 'review_required', execution_state: 'did_not_run', reason: 'input_refused' }, verdict: 'INDETERMINATE', lcr: null, nsfr: null, leverage: null, missing_required_fields: [], refusal: unhashable.reason },
      compliance_flags: ['INPUT_REFUSED'],
      compute_mode: 'server',
      audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
    };
  }
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
