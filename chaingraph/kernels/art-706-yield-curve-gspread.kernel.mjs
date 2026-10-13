import { executionHash } from './_hash.mjs';

// art-706-yield-curve-gspread — par yield curve from caller-supplied benchmark points, and the
// G-spread of a bond against it. The benchmark curve is built ONLY from the points the caller
// supplies (no live Treasury feed, no bootstrapping of zero rates, no day-count logic): the curve
// is the named, versioned interpolation of those points, and the G-spread is the bond's yield minus
// the interpolated benchmark yield at the bond's maturity, times 100 (basis points).
//
// Interpolation formulas (quoted per the row spec, ART706-YIELD-CURVE-GSPREAD-1 step 5):
//   linear (method_version "linear@1"): inside the section [x0,x1] with secant s = (y1-y0)/(x1-x0),
//     y(x) = y0 + s * (x - x0).
//   monotone cubic Hermite (method_version "monotone_cubic_hermite@1"): Fritsch–Carlson 1980
//     (F. N. Fritsch and R. E. Carlson, "Monotone Piecewise Cubic Interpolation", SIAM Journal on
//     Numerical Analysis 17(2), 1980, pp. 238–246). Tangent d_k per section, then
//     y(x) = h00*y0 + h10*h*d0 + h01*y1 + h11*h*d1 with t = (x-x0)/h, h = x1-x0 and
//     h00 = 2t^3-3t^2+1, h10 = t^3-2t^2+t, h01 = -2t^3+3t^2, h11 = t^3-t^2.
//     Tangents: interior knots where adjacent secants differ in sign get d_k = 0, otherwise the
//     F-C weighted harmonic mean d_k = (w1+w2)/(w1/s_{k-1} + w2/s_k) with w1 = 2h_k + h_{k-1} and
//     w2 = h_k + 2h_{k-1}; the two endpoints take the one-sided three-point estimate, zeroed when
//     it disagrees with the adjacent secant's sign and clamped to |d| <= 3|s| (F-C's monotonicity
//     region). This preserves monotonicity of the data exactly.
// KERNEL-CITATION-CLASS-1 note: the citation above is the formula provenance the row mandates in
// the kernel header; the node-level citations live in the node metadata, not here.
//
// DETERMINISM: compute() is a PURE function of pp — no Date.now()/Math.random(), no network, no
// filesystem. It runs unmodified inside the QuickJS-ng zkVM guest, where TextEncoder/atob/btoa/URL
// are ABSENT (GUEST-BUILTIN-GATE-1). This kernel needs no UTF-8 encoding, so no encoder is carried.

const TOOL_ID = 'art-706-yield-curve-gspread';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'build_yield_curve_gspread',
  mandate_type: 'analytics_mandate', gpu: false,
};

const INTERPOLATION_ENUMS = ['linear', 'monotone_cubic_hermite'];
const METHOD_VERSIONS = { linear: 'linear@1', monotone_cubic_hermite: 'monotone_cubic_hermite@1' };

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r6(v) { return Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : 0; }

// R4 (MR-R4-NULL-REGRESSION-GATE-1): an explicit null must get exactly the absent
// form's answer. Strip nulls to undefined at entry so every downstream path —
// defaults, refusals, Number() coercion — sees the two forms identically.
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
      curve: null,
      benchmark_yield_at_maturity_pct: null,
      g_spread_bp: null,
      assumptions: [],
    },
    compliance_flags: code ? ['INPUT_REFUSED'] : [],
  };
}

// Linear interpolation inside [x0,x1] (formula quoted in the header).
function linearAt(x0, y0, x1, y1, x) {
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
}

// Fritsch–Carlson 1980 monotone-piecewise-cubic tangents (formula quoted in the header).
function fritschCarlsonTangents(xs, ys, deltas) {
  const n = xs.length;
  const d = new Array(n);
  if (n === 2) {
    // With a single section the secant slope is the only monotone-safe tangent at both ends.
    d[0] = deltas[0];
    d[1] = deltas[0];
    return d;
  }
  for (let k = 1; k < n - 1; k++) {
    if (deltas[k - 1] * deltas[k] <= 0) {
      d[k] = 0;
    } else {
      const w1 = 2 * (xs[k + 1] - xs[k]) + (xs[k] - xs[k - 1]);
      const w2 = (xs[k + 1] - xs[k]) + 2 * (xs[k] - xs[k - 1]);
      d[k] = (w1 + w2) / (w1 / deltas[k - 1] + w2 / deltas[k]);
    }
  }
  const h0 = xs[1] - xs[0], h1 = xs[2] - xs[1];
  let d0 = ((2 * h0 + h1) * deltas[0] - h0 * deltas[1]) / (h0 + h1);
  if (d0 * deltas[0] <= 0) d0 = 0;
  else if (Math.abs(d0) > 3 * Math.abs(deltas[0])) d0 = 3 * deltas[0];
  d[0] = d0;
  const m = n - 1;
  const hm1 = xs[m] - xs[m - 1], hm2 = xs[m - 1] - xs[m - 2];
  let dn = ((2 * hm1 + hm2) * deltas[m - 1] - hm1 * deltas[m - 2]) / (hm1 + hm2);
  if (dn * deltas[m - 1] <= 0) dn = 0;
  else if (Math.abs(dn) > 3 * Math.abs(deltas[m - 1])) dn = 3 * deltas[m - 1];
  d[m] = dn;
  return d;
}

// Monotone cubic Hermite evaluation inside [x0,x1] with F-C tangents (formula quoted in the header).
function hermiteAt(x0, y0, d0, x1, y1, d1, x) {
  const h = x1 - x0;
  const t = (x - x0) / h;
  const t2 = t * t, t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return h00 * y0 + h10 * h * d0 + h01 * y1 + h11 * h * d1;
}

// Interpolate the benchmark yield at x (guaranteed min <= x <= max by the caller).
function interpolateYield(xs, ys, x, method) {
  let k = 0;
  while (k < xs.length - 2 && x > xs[k + 1]) k++;
  if (method === 'linear') {
    return linearAt(xs[k], ys[k], xs[k + 1], ys[k + 1], x);
  }
  const deltas = [];
  for (let i = 0; i < xs.length - 1; i++) deltas.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  const tangents = fritschCarlsonTangents(xs, ys, deltas);
  return hermiteAt(xs[k], ys[k], tangents[k], xs[k + 1], ys[k + 1], tangents[k + 1], x);
}

/**
 * compute(pp) — pure decision kernel.
 * pp: { benchmark_points: [{ tenor_years, yield_pct }], benchmark_name,
 *       interpolation: 'linear' | 'monotone_cubic_hermite',
 *       bond: { maturity_years, yield_pct } }
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = deNull(pp || {});

  const benchmarkName = pp.benchmark_name;
  if (typeof benchmarkName !== 'string' || benchmarkName.trim() === '') {
    return refusal('BENCHMARK_NAME_REQUIRED', 'benchmark_name must be a non-empty string naming the caller-supplied benchmark (e.g. "UST par, as supplied"); got ' + JSON.stringify(benchmarkName ?? null) + '.');
  }
  const pointsIn = pp.benchmark_points;
  if (!Array.isArray(pointsIn) || pointsIn.length < 2) {
    return refusal('BENCHMARK_POINTS_TOO_FEW', 'benchmark_points must be an array of at least 2 { tenor_years, yield_pct } objects; got ' + (Array.isArray(pointsIn) ? String(pointsIn.length) : typeof pointsIn) + '.');
  }
  const xs = [], ys = [];
  for (let i = 0; i < pointsIn.length; i++) {
    const p = deNull(pointsIn[i] || {});
    const tenor = safeNum(p.tenor_years, NaN);
    const yld = safeNum(p.yield_pct, NaN);
    if (!Number.isFinite(tenor) || tenor <= 0) {
      return refusal('POINT_TENOR_INVALID', 'benchmark_points[' + i + '].tenor_years must be a positive finite number; got ' + JSON.stringify(p.tenor_years ?? null) + '.');
    }
    if (!Number.isFinite(yld)) {
      return refusal('POINT_YIELD_INVALID', 'benchmark_points[' + i + '].yield_pct must be a finite number; got ' + JSON.stringify(p.yield_pct ?? null) + '.');
    }
    if (i > 0 && tenor <= xs[i - 1]) {
      return refusal('TENORS_NOT_STRICTLY_INCREASING', 'benchmark_points tenors must be strictly increasing; benchmark_points[' + i + '].tenor_years (' + tenor + ') is not greater than benchmark_points[' + (i - 1) + '].tenor_years (' + xs[i - 1] + '). Unsorted or duplicate tenors are refused, never silently re-sorted.');
    }
    xs.push(tenor);
    ys.push(yld);
  }
  const interpolation = pp.interpolation === undefined ? 'linear' : pp.interpolation;
  if (!INTERPOLATION_ENUMS.includes(interpolation)) {
    return refusal('INTERPOLATION_INVALID', "interpolation must be one of 'linear' or 'monotone_cubic_hermite'; got " + JSON.stringify(interpolation) + '.');
  }
  const bond = deNull(pp.bond || {});
  const maturity = safeNum(bond.maturity_years, NaN);
  if (!Number.isFinite(maturity) || maturity <= 0) {
    return refusal('BOND_MATURITY_NOT_POSITIVE', 'bond.maturity_years must be a positive finite number; got ' + JSON.stringify(bond.maturity_years ?? null) + '.');
  }
  const bondYield = safeNum(bond.yield_pct, NaN);
  if (!Number.isFinite(bondYield)) {
    return refusal('BOND_YIELD_INVALID', 'bond.yield_pct must be a finite number; got ' + JSON.stringify(bond.yield_pct ?? null) + '.');
  }
  const minTenor = xs[0], maxTenor = xs[xs.length - 1];
  if (maturity < minTenor || maturity > maxTenor) {
    return refusal('MATURITY_OUTSIDE_CURVE_RANGE', 'bond.maturity_years (' + maturity + ') lies outside the benchmark curve range [' + minTenor + ', ' + maxTenor + '] years. No extrapolation is performed — extend benchmark_points to cover the bond\u2019s maturity.');
  }

  const benchYield = interpolateYield(xs, ys, maturity, interpolation);
  const gSpreadBp = (bondYield - benchYield) * 100;

  const assumptions = [
    'Curve assumption: the benchmark curve is built ONLY from the ' + xs.length + ' benchmark point(s) the caller supplied under benchmark_name "' + benchmarkName + '" — there is no live Treasury feed, no market data lookup, and no blending with any other source.',
    'Interpolation assumption: the benchmark yield at the bond\u2019s maturity is read from the curve by ' + (interpolation === 'linear'
      ? 'linear interpolation (method_version linear@1) — inside each section the yield is the straight line between that section\u2019s two benchmark points'
      : 'monotone cubic Hermite interpolation (method_version monotone_cubic_hermite@1, Fritsch–Carlson 1980 tangents) — a piecewise cubic that passes through every benchmark point and preserves the monotone rise/fall pattern of the supplied data') + '; within a section the curve is smooth and no extrapolation happens outside [' + minTenor + ', ' + maxTenor + '] years.',
    'Spread assumption: g_spread_bp is (bond.yield_pct − benchmark_yield_at_maturity_pct) × 100 — a yield difference in basis points against the interpolated benchmark yield, not an asset-swap spread and not a Z-spread; the bond\u2019s own cash flows are not repriced.',
    'Exclusions: no bootstrapping of zero rates from coupon instruments (the supplied points are used exactly as given), no day-count or accrual adjustments (tenors are used as plain year numbers), no interpolation of the bond\u2019s own yield, and no live data of any kind.',
  ];

  const output_payload = {
    curve: {
      benchmark_name: benchmarkName,
      method: interpolation,
      method_version: METHOD_VERSIONS[interpolation],
      points: xs.map((x, i) => ({ tenor_years: x, yield_pct: ys[i] })),
    },
    benchmark_yield_at_maturity_pct: r6(benchYield),
    g_spread_bp: r6(gSpreadBp),
    assumptions,
    regulatory_basis: 'Standard fixed-income relative-value analytics: the G-spread (a.k.a. yield spread) of a bond against a government benchmark yield curve, computed as the difference between the bond\u2019s yield to maturity and the interpolated benchmark yield at the bond\u2019s maturity (Fabozzi, Bond Markets, Analysis and Strategies). The monotone cubic option implements Fritsch and Carlson (1980).',
    note: 'The benchmark curve is caller-supplied by design: deterministic arithmetic over the given points only. Exclusions: no bootstrapping of zero rates, no day-count, no live Treasury feed.',
  };

  return { output_payload, compliance_flags: [] };
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
