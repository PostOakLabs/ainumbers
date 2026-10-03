// art-702-runway-goal-path.proptest.mjs — class-K property-test FLOOR
// (FV-PBT-FLOOR-BUILD-SPEC.md). Authored against the build spec at
// research/hackathon-builds/ART702-RUNWAY-GOAL-PATH-BUILD-SPEC-2026-10-01.md.
// kernel_digest_at_authoring: sha256:a62ea8245d5f29e41c714ffbcfc8b2f52d5a68cefb22a29a500b9dfc61c33beb
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof, NOT Dafny. Internal engineering QC only.
// float_sensitive: NO — every money value and rate is an integer gated through
// Number.isInteger checks, revenue and burn roundings are integer half-up divisions
// (roundHalfUpDiv over integer numerators and denominators), the cash-out
// interpolation is an integer floor, effort is an integer half-up division, and
// compute() touches no Date, no float accumulation and no Math.random.
//
// Checks: fixture-oracle gate (F1..F10); P1 a larger burn cut never shortens the
// runway nor lowers ending cash; P2 adding growth never lowers ending cash when net
// revenue is positive; P3 candidates are always sorted by effort with the declared
// tie order (burn_cut, then price_uplift, then growth_add); P4 invalid-domain inputs
// are refused with named reasons, never a throw; P5 the reported baseline is the
// zero-lever scenario, solvent_through_horizon is exactly runway==null, and a
// qualifying zero-lever candidate always ranks first; P6 determinism (two runs agree
// byte-for-byte) and output shape (no undefined/NaN/non-finite anywhere).
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-702-runway-goal-path.proptest.mjs

import { compute } from '../art-702-runway-goal-path.kernel.mjs';
import { runFixtureOracle, summarize, findShapeViolations, mulberry32 } from './_pbt-common.mjs';

const KERNEL_ID = 'art-702-runway-goal-path';

// ---------- shared random domain (declared-domain inputs only) ----------

const FULL_GRIDS = {
  price_uplift_bp: [0, 500, 1000, 1500, 2000, 3000],
  growth_add_bp: [0, 100, 200, 300, 500],
  burn_cut_bp: [0, 500, 1000, 1500, 2000, 3000],
};

function baseInputs(rng, over = {}) {
  const revenue = 500000 + Math.floor(rng() * 8000000); // 0.5M .. 8.5M
  const burn = Math.floor(rng() * 8000000); // 0 .. 8M
  return {
    cash_minor: revenue * 2 + burn + Math.floor(rng() * 150000000), // month-1 runway always >= 10000 bp
    monthly_revenue_minor: revenue,
    monthly_burn_minor: burn,
    revenue_growth_bp: -5000 + Math.floor(rng() * 8001), // -5000 .. 3000
    horizon_months: 6 + Math.floor(rng() * 19), // 6 .. 24
    goal: { type: 'runway_months', value: 1 }, // every scenario with cash above qualifies
    levers: FULL_GRIDS,
    effort_weights: { price_uplift_bp: 1, growth_add_bp: 2, burn_cut_bp: 1 },
    max_candidates: 1000,
    ...over,
  };
}

const runwayOf = (c) => (c.runway_bp_of_month === null ? Number.MAX_SAFE_INTEGER : c.runway_bp_of_month);
const byLevers = (candidates) => {
  const m = new Map();
  for (const c of candidates) m.set(`${c.levers.price_uplift_bp},${c.levers.growth_add_bp},${c.levers.burn_cut_bp}`, c);
  return m;
};

// ---------- properties ----------

// P1: a larger burn cut never shortens the runway and never lowers ending cash.
// Burn(cut) is non-increasing in the cut (half-up of a smaller product), so the
// month-wise cash path is pointwise >= and the cash-out month moves later or the
// scenario stays solvent. Compared inside ONE compute() per draw, growth grid [0],
// price grid [0], so candidates expose both cuts for every draw.
function checkBurnCutMonotonicity() {
  const rng = mulberry32(702001);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 60; i++) {
    const burnGrid = [0, 500, 1000, 1500, 2000, 3000];
    const pp = baseInputs(rng, {
      revenue_growth_bp: -3000 + Math.floor(rng() * 5001),
      levers: { price_uplift_bp: [0], growth_add_bp: [0], burn_cut_bp: burnGrid },
    });
    const { output_payload } = compute(pp);
    const m = byLevers(output_payload.candidates);
    for (let a = 0; a < burnGrid.length; a++) {
      for (let b = a + 1; b < burnGrid.length; b++) {
        const ca = m.get(`0,0,${burnGrid[a]}`);
        const cb = m.get(`0,0,${burnGrid[b]}`);
        if (!ca || !cb) { violations++; continue; }
        checked++;
        if (runwayOf(cb) < runwayOf(ca)) violations++;
        if (cb.ending_cash_minor < ca.ending_cash_minor) violations++;
      }
    }
  }
  return { name: 'P1 a larger burn cut never shortens the runway nor lowers ending cash', checked, violations };
}

// P2: adding growth never lowers ending cash when net revenue is positive. With
// rev0 >= burn (the draw keeps rev*1.3 >= burn so the price uplift cannot break it)
// and a non-negative growth addition, month-wise revenue is pointwise >=, so the
// ending cash is >=. Compared inside ONE compute() per draw on the growth grid.
function checkGrowthMonotonicity() {
  const rng = mulberry32(702002);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 60; i++) {
    const revenue = 2000000 + Math.floor(rng() * 6000000);
    const burn = Math.floor(rng() * revenue / 2); // net revenue positive under any uplift
    const pp = baseInputs(rng, {
      monthly_revenue_minor: revenue,
      monthly_burn_minor: burn,
      revenue_growth_bp: Math.floor(rng() * 2001), // base growth >= 0 for this property
      levers: { price_uplift_bp: [0], growth_add_bp: [0, 100, 200, 300, 500], burn_cut_bp: [0] },
    });
    const { output_payload } = compute(pp);
    const m = byLevers(output_payload.candidates);
    const growthGrid = pp.levers.growth_add_bp;
    for (let a = 0; a + 1 < growthGrid.length; a++) {
      const lo = m.get(`0,${growthGrid[a]},0`);
      const hi = m.get(`0,${growthGrid[a + 1]},0`);
      if (!lo || !hi) { violations++; continue; }
      checked++;
      if (hi.ending_cash_minor < lo.ending_cash_minor) violations++;
      if (runwayOf(hi) < runwayOf(lo)) violations++;
    }
  }
  return { name: 'P2 adding growth never lowers ending cash when net revenue is positive', checked, violations };
}

// P3: candidates are always sorted by effort, ties by burn_cut, then price_uplift,
// then growth_add, all ascending; the candidate count obeys max_candidates; and
// scenarios_evaluated equals the grid product.
function checkSortingAndTieOrder() {
  const rng = mulberry32(702003);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 40; i++) {
    const goal = [
      { type: 'runway_months', value: 1 },
      { type: 'ending_cash_at_least', value: Math.floor(rng() * 200000000) },
      { type: 'breakeven_by_month', value: 1 + Math.floor(rng() * 24) },
      { type: 'solvent_through_horizon' },
    ][Math.floor(rng() * 4)];
    const pp = baseInputs(rng, { goal });
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.scenarios_evaluated !== 6 * 5 * 6) violations++;
    for (let k = 0; k + 1 < output_payload.candidates.length; k++) {
      const a = output_payload.candidates[k];
      const b = output_payload.candidates[k + 1];
      checked++;
      if (a.effort > b.effort) violations++;
      else if (a.effort === b.effort) {
        const ka = [a.levers.burn_cut_bp, a.levers.price_uplift_bp, a.levers.growth_add_bp];
        const kb = [b.levers.burn_cut_bp, b.levers.price_uplift_bp, b.levers.growth_add_bp];
        for (let d = 0; d < 3; d++) {
          if (ka[d] !== kb[d]) { if (ka[d] > kb[d]) violations++; break; }
        }
      }
    }
    if (output_payload.candidates.length > pp.max_candidates) violations++;
  }
  return { name: 'P3 candidates are sorted by effort with the declared tie order', checked, violations };
}

// P4: invalid-domain inputs are refused with a named reason and the input flag,
// never a throw.
function checkRefusals() {
  const rng = mulberry32(702004);
  let checked = 0;
  let violations = 0;
  const good = baseInputs(mulberry32(702014));
  const bad = /** @type {{ key: string, value: unknown }[]} */ ([
    { key: 'cash_minor', value: 1.5 }, { key: 'cash_minor', value: -1 }, { key: 'cash_minor', value: 'x' },
    { key: 'monthly_revenue_minor', value: -5 }, { key: 'monthly_burn_minor', value: 2.25 },
    { key: 'revenue_growth_bp', value: -10001 }, { key: 'revenue_growth_bp', value: 0.5 },
    { key: 'horizon_months', value: 0 }, { key: 'horizon_months', value: 61 }, { key: 'horizon_months', value: 12.5 },
    { key: 'goal', value: { type: 'no_such_goal', value: 1 } },
    { key: 'goal', value: { type: 'runway_months', value: 1.5 } },
    { key: 'goal', value: { type: 'breakeven_by_month', value: 0 } },
    { key: 'goal', value: { type: 'ending_cash_at_least', value: -3 } },
    { key: 'levers', value: { ...FULL_GRIDS, price_uplift_bp: [3, 1] } },
    { key: 'levers', value: { ...FULL_GRIDS, burn_cut_bp: [-500, 0] } },
    { key: 'levers', value: { ...FULL_GRIDS, growth_add_bp: [0, 0.5] } },
    { key: 'levers', value: { ...FULL_GRIDS, price_uplift_bp: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200] } },
    { key: 'effort_weights', value: { price_uplift_bp: 1, growth_add_bp: 2, burn_cut_bp: -1 } },
    { key: 'effort_weights', value: { price_uplift_bp: 1, growth_add_bp: 2.5, burn_cut_bp: 1 } },
    { key: 'max_candidates', value: 0 }, { key: 'max_candidates', value: 2.5 },
    { key: 'levers', value: null }, { key: 'effort_weights', value: null },
    { key: 'goal', value: null }, { key: 'goal', value: 'runway_months' },
  ]);
  for (const { key, value } of bad) {
    const r = compute({ ...good, [key]: value });
    checked++;
    if (r.compliance_flags[0] !== 'ART702_INPUT_REFUSED') violations++;
    if (!r.output_payload.refusal_reason || !String(r.output_payload.refusal_reason).startsWith('REFUSED_')) violations++;
  }
  void rng;
  return { name: 'P4 invalid-domain inputs refused with named reasons, never a throw', checked, violations };
}

// P5: the reported baseline is the zero-lever scenario; solvent_through_horizon is
// exactly runway_bp_of_month === null; and when the grids contain the all-zero
// combination and it qualifies, it is candidates[0] with effort 0.
function checkBaselineContract() {
  const rng = mulberry32(702005);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 40; i++) {
    const pp = baseInputs(rng);
    const { output_payload } = compute(pp);
    const b = output_payload.baseline;
    checked += 2;
    if (b.solvent_through_horizon !== (b.runway_bp_of_month === null)) violations++;
    if (b.breakeven_month !== null && b.breakeven_month < 1) violations++;
    const zero = byLevers(output_payload.candidates).get('0,0,0');
    if (output_payload.baseline_meets_goal) {
      checked++;
      const zeroScenario = compute({ ...pp, levers: { price_uplift_bp: [0], growth_add_bp: [0], burn_cut_bp: [0] }, max_candidates: 1 });
      if (zeroScenario.output_payload.baseline_meets_goal !== true) violations++;
      if (JSON.stringify(zeroScenario.output_payload.baseline) !== JSON.stringify(b)) violations++;
      if (zero && (zero.effort !== 0 || output_payload.candidates[0] !== zero)) violations++;
    }
  }
  return { name: 'P5 baseline is the zero-lever scenario and a qualifying zero candidate ranks first', checked, violations };
}

// P6: compute() is deterministic (two runs agree byte-for-byte) and every payload —
// success and refusal — is free of undefined/NaN/non-finite values.
function checkDeterminismAndShape() {
  const rng = mulberry32(702006);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 25; i++) {
    const pp = baseInputs(rng, { goal: { type: 'runway_months', value: 1 + Math.floor(rng() * 24) } });
    const r1 = compute(pp);
    const r2 = compute(pp);
    checked++;
    if (JSON.stringify(r1) !== JSON.stringify(r2)) violations++;
    checked++;
    if (findShapeViolations(r1.output_payload).length > 0) violations++;
    const bad = compute({ ...pp, horizon_months: 61 });
    checked++;
    if (findShapeViolations(bad.output_payload).length > 0) violations++;
  }
  return { name: 'P6 determinism and output shape: no undefined/NaN/non-finite anywhere', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkBurnCutMonotonicity(),
  checkGrowthMonotonicity(),
  checkSortingAndTieOrder(),
  checkRefusals(),
  checkBaselineContract(),
  checkDeterminismAndShape(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — F1..F10 fixture oracle + P1..P6.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
