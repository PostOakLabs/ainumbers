import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-324-tvm-npv';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_npv',
  mandate_type: 'analytics_mandate', gpu: false,
};

// Pure ECMA-262 math helpers — no Math.pow(fractional), no Math.log*, no Date/random.
function myExp(x) {
  if (!Number.isFinite(x)) return 0;
  let sum = 1, term = 1;
  for (let n = 1; n <= 80; n++) {
    term *= x / n;
    sum += term;
    if (Math.abs(term) < 1e-17 * Math.abs(sum)) break;
  }
  return sum;
}
function myLn(x) {
  if (x <= 0 || !Number.isFinite(x)) return -1e300;
  const y = (x - 1) / (x + 1);
  let sum = 0, ypow = y, y2 = y * y;
  for (let k = 0; k < 100; k++) {
    sum += ypow / (2 * k + 1);
    ypow *= y2;
    if (Math.abs(ypow) < 1e-17) break;
  }
  return 2 * sum;
}
function myPow(base, exp) {
  if (!Number.isFinite(base) || !Number.isFinite(exp)) return 0;
  if (exp === 0) return 1;
  if (base === 1) return 1;
  const iExp = Math.round(exp);
  if (Math.abs(exp - iExp) < 1e-12) {
    const n = Math.abs(iExp);
    let r = 1;
    for (let i = 0; i < n; i++) r *= base;
    return iExp < 0 ? 1 / r : r;
  }
  return myExp(exp * myLn(base));
}

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r6(v) { return Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : 0; }
function r4(v) { return Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : 0; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }

// Fliegel-Van Flandern Julian Day Number — pure integer arithmetic, no Date object.
function toJDN(y, m, d) {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}
function parseDate(s) {
  const parts = String(s).split('-');
  return { y: Number(parts[0]), m: Number(parts[1]), d: Number(parts[2]) };
}
// Year-fraction between two ISO date strings under a declared day-count convention.
function yearFrac(d1s, d2s, convention) {
  const d1 = parseDate(d1s), d2 = parseDate(d2s);
  const actualDays = toJDN(d2.y, d2.m, d2.d) - toJDN(d1.y, d1.m, d1.d);
  if (convention === 'ACT/360') return actualDays / 360;
  if (convention === 'ACT/ACT') return actualDays / 365.25; // simplified single-divisor approximation (documented limitation, ISDA full split out of scope v1)
  if (convention === '30/360') {
    let dd1 = d1.d === 31 ? 30 : d1.d;
    let dd2 = (d2.d === 31 && dd1 === 30) ? 30 : d2.d;
    const days360 = (d2.y - d1.y) * 360 + (d2.m - d1.m) * 30 + (dd2 - dd1);
    return days360 / 360;
  }
  return actualDays / 365; // default ACT/365
}

// Builds a normalized list of {amount, t} period offsets in YEARS from either
// explicit periods (t given directly, already in the caller's period unit) or
// dated cash flows (date + valuation_date + day_count_convention).
function normalizeCashFlows(pp) {
  const flows = Array.isArray(pp.cash_flows) ? pp.cash_flows : [];
  const mode = pp.mode === 'dates' ? 'dates' : 'periods';
  const convention = pp.day_count_convention || 'ACT/365';
  const valuationDate = pp.valuation_date;
  const out = [];
  for (const cf of flows) {
    const amount = safeNum(cf.amount, 0);
    let t;
    if (mode === 'dates') {
      t = yearFrac(valuationDate, cf.date, convention);
    } else {
      t = safeNum(cf.t, 0);
    }
    out.push({ amount, t: Number.isFinite(t) ? t : 0 });
  }
  return { flows: out, mode, convention };
}

export function compute(pp) {
  pp = pp || {};
  const { flows, mode, convention } = normalizeCashFlows(pp);
  const rate = safeNum(pp.discount_rate_pct, 0) / 100; // per-period rate matching flows' t unit

  let npv = 0;
  for (const { amount, t } of flows) {
    npv += amount * myPow(1 + rate, -t);
  }
  const totalUndiscounted = flows.reduce((s, f) => s + f.amount, 0);

  const compliance_flags = [];
  if (flows.length === 0) compliance_flags.push('NO_CASH_FLOWS');
  if (rate <= -1) compliance_flags.push('RATE_BELOW_NEGATIVE_100_PCT');

  const output_payload = {
    npv: r2(npv),
    discount_rate_pct: r6(rate * 100),
    num_cash_flows: flows.length,
    total_undiscounted: r2(totalUndiscounted),
    mode,
    day_count_convention: mode === 'dates' ? convention : 'n/a (periods mode — t supplied directly)',
    regulatory_basis: 'Standard discounted cash flow NPV, textbook definition (Brealey/Myers Ch.2)',
    note: 'NPV = sum(CF_t / (1+r)^t). Periods mode: t is a caller-supplied period offset in the rate\'s own unit. Dates mode: t derived via declared day_count_convention (30/360, ACT/360, ACT/365, ACT/ACT-simplified) from valuation_date. Deterministic pow via Taylor-series exp/ln, no engine transcendentals.',
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
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
