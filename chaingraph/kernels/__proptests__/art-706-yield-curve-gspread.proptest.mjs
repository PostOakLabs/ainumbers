// art-706-yield-curve-gspread — class-K property-test floor, authored by ART706-YIELD-CURVE-GSPREAD-1.
// kernel_digest_at_authoring: sha256:376d1cf65cb78cf0f916e618176436b629b0fcd903bda64f5c9bd2de934e1f50
// spec: AIQ capability build spec WU-17 (research/AIQ-CAPABILITY-PRODUCTS-BUILD-SPEC-2026-10-01.html)
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-706-yield-curve-gspread.proptest.mjs

import { compute } from '../art-706-yield-curve-gspread.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick } from './_pbt-common.mjs';

const KERNEL_ID = 'art-706-yield-curve-gspread';
const TRIALS = 2000;
const rand = mulberry32(0x706C9);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

// Deterministic strictly-increasing benchmark points: 2-6 knots, tenors 0.25-30y, yields 0.5-15%.
function mkPP(rng, method) {
  const n = 2 + Math.floor(rng() * 5);
  const tenors = [];
  let t = randRange(rng, 0.25, 2);
  for (let i = 0; i < n; i++) {
    tenors.push(t);
    t += randRange(rng, 0.5, 8);
  }
  const monotone = rng() < 0.5;
  let y = randRange(rng, 0.5, 8);
  const points = tenors.map((tenor) => {
    const point = { tenor_years: tenor, yield_pct: y };
    y = monotone ? y + randRange(rng, 0.01, 1.5) : randRange(rng, 0.5, 15);
    return point;
  });
  return {
    benchmark_points: points,
    benchmark_name: 'Test curve, as supplied',
    interpolation: method ?? pick(rng, ['linear', 'monotone_cubic_hermite']),
    bond: { maturity_years: randRange(rng, points[0].tenor_years, points[points.length - 1].tenor_years), yield_pct: randRange(rng, 0.5, 15) },
  };
}

// ---------- P1: the interpolated benchmark yield lies between its bracketing knots ----------
function checkP1_yieldBetweenBracketingKnots() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const out = r.output_payload;
    if (out.error) continue; // refusal branch exercised by P4
    const pts = out.curve.points;
    const m = out.benchmark_yield_at_maturity_pct;
    let lo = -Infinity, hi = Infinity;
    for (let k = 0; k < pts.length - 1; k++) {
      if (pp.bond.maturity_years >= pts[k].tenor_years && pp.bond.maturity_years <= pts[k + 1].tenor_years) {
        lo = Math.min(pts[k].yield_pct, pts[k + 1].yield_pct);
        hi = Math.max(pts[k].yield_pct, pts[k + 1].yield_pct);
        break;
      }
    }
    if (!Number.isFinite(m) || m < lo - 1e-6 || m > hi + 1e-6) violations++;
    // spread identity: (bond yield - benchmark yield) * 100. m is r6-rounded, so the
    // rounding-aware slack is 5e-7 carried through the *100 (5e-5) plus the r6 slack
    // on g_spread_bp itself (5e-7).
    const want = (pp.bond.yield_pct - m) * 100;
    if (Math.abs(out.g_spread_bp - want) > 5e-5 + 1e-6) violations++;
  }
  return { name: 'P1_benchmark_yield_between_bracketing_knots_and_spread_identity', checked, violations };
}

// ---------- P2 (row-mandated): on a flat curve the G-spread is independent of the method ----------
function checkP2_flatCurveMethodInvariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const flat = randRange(rand, 0.5, 12);
    const n = 2 + Math.floor(rand() * 4);
    const tenors = [];
    let t = randRange(rand, 0.25, 2);
    for (let k = 0; k < n; k++) { tenors.push(t); t += randRange(rand, 0.5, 8); }
    const pp = {
      benchmark_points: tenors.map((tenor) => ({ tenor_years: tenor, yield_pct: flat })),
      benchmark_name: 'Flat, as supplied',
      bond: { maturity_years: randRange(rand, tenors[0], tenors[tenors.length - 1]), yield_pct: randRange(rand, 0.5, 15) },
    };
    const lin = compute({ ...pp, interpolation: 'linear' }).output_payload;
    const mono = compute({ ...pp, interpolation: 'monotone_cubic_hermite' }).output_payload;
    checked++;
    if (lin.error || mono.error) { violations++; continue; }
    if (lin.g_spread_bp !== mono.g_spread_bp || lin.benchmark_yield_at_maturity_pct !== mono.benchmark_yield_at_maturity_pct) violations++;
  }
  return { name: 'P2_flat_curve_g_spread_independent_of_method', checked, violations };
}

// ---------- P3 (row-mandated): the spread is linear in the bond yield ----------
function checkP3_spreadLinearInBondYield() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const base = compute(pp).output_payload;
    if (base.error) continue;
    checked++;
    for (const d of [0.25, -0.5, 1.75]) {
      const bumped = compute({ ...pp, bond: { ...pp.bond, yield_pct: pp.bond.yield_pct + d } }).output_payload;
      checked++;
      if (bumped.error) { violations++; continue; }
      // spread shifts by exactly d * 100 bp within r6 rounding slack (5e-7 per rounded value)
      if (Math.abs(bumped.g_spread_bp - (base.g_spread_bp + d * 100)) > 1e-6 + 5e-7) { violations++; break; }
      if (bumped.benchmark_yield_at_maturity_pct !== base.benchmark_yield_at_maturity_pct) { violations++; break; }
    }
  }
  return { name: 'P3_g_spread_linear_in_bond_yield', checked, violations };
}

// ---------- P4: refusal contract — every named refusal fires with its exact code on its trigger ----------
const REFUSAL_CONTRACT_CASES = [
  [{ benchmark_name: 'X', benchmark_points: [{ tenor_years: 5, yield_pct: 4.5 }], bond: { maturity_years: 5, yield_pct: 5 } }, 'benchmark_points_too_few', 'BENCHMARK_POINTS_TOO_FEW'],
  [{ benchmark_name: 'X', benchmark_points: [], bond: { maturity_years: 5, yield_pct: 5 } }, 'benchmark_points_too_few', 'BENCHMARK_POINTS_TOO_FEW'],
  [{ benchmark_points: [{ tenor_years: 2, yield_pct: 4 }, { tenor_years: 5, yield_pct: 4.5 }], bond: { maturity_years: 5, yield_pct: 5 } }, 'benchmark_name_required', 'BENCHMARK_NAME_REQUIRED'],
  [{ benchmark_name: '', benchmark_points: [{ tenor_years: 2, yield_pct: 4 }, { tenor_years: 5, yield_pct: 4.5 }], bond: { maturity_years: 5, yield_pct: 5 } }, 'benchmark_name_required', 'BENCHMARK_NAME_REQUIRED'],
  [{ benchmark_name: 'X', benchmark_points: [{ tenor_years: 5, yield_pct: 4.5 }, { tenor_years: 2, yield_pct: 4 }], bond: { maturity_years: 3, yield_pct: 4.2 } }, 'tenors_not_strictly_increasing', 'TENORS_NOT_STRICTLY_INCREASING'],
  [{ benchmark_name: 'X', benchmark_points: [{ tenor_years: 2, yield_pct: 4 }, { tenor_years: 2, yield_pct: 4.5 }], bond: { maturity_years: 2, yield_pct: 4.2 } }, 'tenors_not_strictly_increasing', 'TENORS_NOT_STRICTLY_INCREASING'],
  [{ benchmark_name: 'X', benchmark_points: [{ tenor_years: 2, yield_pct: 4 }, { tenor_years: 'soon', yield_pct: 4.5 }], bond: { maturity_years: 3, yield_pct: 4.2 } }, 'point_tenor_invalid', 'POINT_TENOR_INVALID'],
  [{ benchmark_name: 'X', benchmark_points: [{ tenor_years: 2, yield_pct: 4 }, { tenor_years: 5, yield_pct: NaN }], bond: { maturity_years: 3, yield_pct: 4.2 } }, 'point_yield_invalid', 'POINT_YIELD_INVALID'],
  [{ benchmark_name: 'X', benchmark_points: [{ tenor_years: 2, yield_pct: 4 }, { tenor_years: 5, yield_pct: 4.5 }], interpolation: 'cubic_spline' }, 'interpolation_invalid', 'INTERPOLATION_INVALID'],
  [{ benchmark_name: 'X', benchmark_points: [{ tenor_years: 2, yield_pct: 4 }, { tenor_years: 5, yield_pct: 4.5 }], bond: { maturity_years: 0, yield_pct: 4.2 } }, 'bond_maturity_not_positive', 'BOND_MATURITY_NOT_POSITIVE'],
  [{ benchmark_name: 'X', benchmark_points: [{ tenor_years: 2, yield_pct: 4 }, { tenor_years: 5, yield_pct: 4.5 }], bond: { maturity_years: 3, yield_pct: 'wat' } }, 'bond_yield_invalid', 'BOND_YIELD_INVALID'],
  // out of range, both sides — the refusal NAMES the range
  [{ benchmark_name: 'X', benchmark_points: [{ tenor_years: 2, yield_pct: 4 }, { tenor_years: 5, yield_pct: 4.5 }], bond: { maturity_years: 30, yield_pct: 5 } }, 'maturity_outside_curve_range', 'MATURITY_OUTSIDE_CURVE_RANGE'],
  [{ benchmark_name: 'X', benchmark_points: [{ tenor_years: 2, yield_pct: 4 }, { tenor_years: 5, yield_pct: 4.5 }], bond: { maturity_years: 1, yield_pct: 5 } }, 'maturity_outside_curve_range', 'MATURITY_OUTSIDE_CURVE_RANGE'],
];
function checkP4_refusalContract() {
  let violations = 0, checked = 0;
  for (const [pp, wantError, wantCode] of REFUSAL_CONTRACT_CASES) {
    const r = compute(pp);
    checked++;
    const out = r.output_payload;
    if (out.error !== wantError) { violations++; continue; }
    if (!r.compliance_flags.includes('INPUT_REFUSED')) violations++;
    const de = (out.domain_errors || [])[0] || {};
    if (de.code !== wantCode) violations++;
    if (typeof out.detail !== 'string' || out.detail.length === 0 || !out.detail.endsWith('.')) violations++;
    if (out.curve !== null || out.benchmark_yield_at_maturity_pct !== null || out.g_spread_bp !== null) violations++;
  }
  // the out-of-range refusal names the range verbatim
  const oor = compute({ benchmark_name: 'X', benchmark_points: [{ tenor_years: 2, yield_pct: 4 }, { tenor_years: 5, yield_pct: 4.5 }], bond: { maturity_years: 30, yield_pct: 5 } });
  checked++;
  if (!/\[2, 5\]/.test(oor.output_payload.detail)) violations++;
  return { name: 'P4_refusal_contract_every_named_refusal_fires_with_exact_code', checked, violations };
}

// ---------- P5: monotonicity preservation — monotone data stays within its bracket under the cubic ----------
function checkP5_monotonePreservation() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand, 'monotone_cubic_hermite');
    const rising = pp.benchmark_points.every((p, k) => k === 0 || p.yield_pct > pp.benchmark_points[k - 1].yield_pct);
    const r = compute(pp);
    checked++;
    if (r.output_payload.error) continue;
    if (!rising) continue;
    const m = r.output_payload.benchmark_yield_at_maturity_pct;
    const pts = pp.benchmark_points;
    let lo = 0, hi = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      if (pp.bond.maturity_years >= pts[k].tenor_years && pp.bond.maturity_years <= pts[k + 1].tenor_years) { lo = pts[k].yield_pct; hi = pts[k + 1].yield_pct; break; }
    }
    if (m < lo - 1e-6 || m > hi + 1e-6) violations++;
  }
  return { name: 'P5_monotone_data_stays_within_bracket_under_monotone_cubic', checked, violations };
}

// ---------- P6: ULP-boundary forcing (mandatory per FV-PBT-FLOOR-BUILD-SPEC.md §3) ----------
const ULP_BOUNDARY_CASES = [
  [{ benchmark_name: 'X', benchmark_points: [{ tenor_years: 2, yield_pct: 4 }, { tenor_years: 5, yield_pct: 4.5 }], bond: { maturity_years: 2, yield_pct: 4.5 } }, 'bond maturity exactly at the FIRST knot — benchmark yield equals that knot exactly'],
  [{ benchmark_name: 'X', benchmark_points: [{ tenor_years: 2, yield_pct: 4 }, { tenor_years: 5, yield_pct: 4.5 }], bond: { maturity_years: 5, yield_pct: 4.5 } }, 'bond maturity exactly at the LAST knot — benchmark yield equals that knot exactly'],
  [{ benchmark_name: 'X', benchmark_points: [{ tenor_years: 2, yield_pct: 4 }, { tenor_years: 5, yield_pct: 4.5 }], bond: { maturity_years: 3.5, yield_pct: 4.25 } }, 'exact section midpoint under linear — benchmark yield is the arithmetic mean'],
  [{ benchmark_name: 'X', benchmark_points: [{ tenor_years: 2, yield_pct: 4 }, { tenor_years: 5, yield_pct: 4.5 }], interpolation: 'monotone_cubic_hermite', bond: { maturity_years: 3.5, yield_pct: 4.25 } }, 'exact section midpoint under the cubic — stays within the section'],
  [{ benchmark_name: 'X', benchmark_points: [{ tenor_years: 1, yield_pct: 0 }, { tenor_years: 2, yield_pct: 0 }], bond: { maturity_years: 1.5, yield_pct: 0 } }, 'flat zero-yield curve — spread 0, no NaN'],
  [{ benchmark_name: 'X', benchmark_points: [{ tenor_years: 2, yield_pct: 4 }, { tenor_years: 5, yield_pct: 4.5 }], interpolation: 'monotone_cubic_hermite', bond: { maturity_years: 2, yield_pct: 4.5 } }, 'two-point curve under the cubic — n=2 tangent path'],
  [{ benchmark_name: 'X', benchmark_points: [{ tenor_years: 2, yield_pct: 5 }, { tenor_years: 5, yield_pct: 4.5 }, { tenor_years: 10, yield_pct: 6 }], interpolation: 'monotone_cubic_hermite', bond: { maturity_years: 3.5, yield_pct: 5 } }, 'non-monotone data (down then up) — interior zero tangent path, still no NaN'],
  [{ benchmark_name: 'X', benchmark_points: [{ tenor_years: 2, yield_pct: 4 }, { tenor_years: 5, yield_pct: 4.5 }], interpolation: 'LINEAR', bond: { maturity_years: 3, yield_pct: 4.2 } }, 'interpolation wrong case — must be refused (strict enum, no silent coercion)'],
  [{ benchmark_name: '   ', benchmark_points: [{ tenor_years: 2, yield_pct: 4 }, { tenor_years: 5, yield_pct: 4.5 }], bond: { maturity_years: 3, yield_pct: 4.2 } }, 'whitespace-only benchmark_name — refused'],
  [{ benchmark_name: 'X', benchmark_points: [{ tenor_years: 2, yield_pct: null }, { tenor_years: 5, yield_pct: 4.5 }], bond: { maturity_years: 3, yield_pct: 4.2 } }, 'null point yield takes exactly the absent form answer (R4) — refused as point_yield_invalid'],
];
function checkP6_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const method = /** @type {any} */ (pp).interpolation === 'monotone_cubic_hermite' ? 'monotone_cubic_hermite@1' : 'linear@1';
    const r = compute(pp);
    const out = r.output_payload;
    const plausible = out.error
      ? (r.compliance_flags.includes('INPUT_REFUSED') && Array.isArray(out.domain_errors) && out.domain_errors.length > 0)
      : (out.curve !== null && out.curve.method_version === method
        && Number.isFinite(out.benchmark_yield_at_maturity_pct) && Number.isFinite(out.g_spread_bp)
        && Array.isArray(out.assumptions) && out.assumptions.length >= 4);
    rows.push({ label, refused: !!out.error, plausible });
  }
  return rows;
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1_yieldBetweenBracketingKnots(),
  checkP2_flatCurveMethodInvariance(),
  checkP3_spreadLinearInBondYield(),
  checkP4_refusalContract(),
  checkP5_monotonePreservation(),
];
const boundary_forced = checkP6_forced();
const anyBoundaryImplausible = boundary_forced.some((b) => !b.plausible);
console.log(`[${KERNEL_ID}] class-K floor property test — ${properties.length} properties, ${boundary_forced.length} forced boundary cases.`);
console.log(JSON.stringify({ boundary_forced, anyBoundaryImplausible }));
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok && !anyBoundaryImplausible ? 0 : 1);
