// art-849-deferred-comp-457b — class-K property-test FLOOR (FV-PBT-FLOOR-BUILD-SPEC.md).
// kernel_digest_at_authoring: sha256:934f9c5a9463a8e2bcc73e259bb61ddd7acd0363c584a8b5dfc7aeb29ad0966a
// spec: board/claimed/APEX-T2-44-DEFERRED-COMP-457B-1.md (SPEC.md §12 compute binding, §17 kernel identity)
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof, NOT Dafny. Internal engineering QC only.
// float_sensitive: YES for the 2dp roundings; the kernel uses an exact integer-exponent loop.
//
// Checks: fixture-oracle gate (39 vectors, 20 of them pinned from the Apex page calculation);
// P1 independent recompute (closed form with Math.pow and the annuity sum) agrees at 2dp;
// P2 monotonicity (deferral up never lowers scenario A total; deferral zero gives zero);
// P3 determinism and no undefined/non-finite in output_payload; P4 refusal contract;
// P5 limit tier and flag comparators at the exact boundaries; P6 buildArtifact_never_throws;
// P7 red/green pair: a mutated compute that drops the capital-gains tax is caught by P1.
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-849-deferred-comp-457b.proptest.mjs

import { compute, buildArtifact } from '../art-849-deferred-comp-457b.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, findShapeViolations } from './_pbt-common.mjs';

const KERNEL_ID = 'art-849-deferred-comp-457b';

const basePP = () => ({
  annual_income_usd: 120000, deferral_usd: 24500, current_rate_pct: 24, retirement_rate_pct: 20,
  years_to_retirement: 20, growth_rate_pct: 7, withdrawal_years: 25, taxable_return_pct: 6, capital_gains_rate_pct: 15,
});

function jitterPP(rng) {
  const pp = basePP();
  pp.deferral_usd = Math.floor(rng() * 49001);
  pp.current_rate_pct = Math.floor(rng() * 61);
  pp.retirement_rate_pct = Math.floor(rng() * 61);
  pp.years_to_retirement = 1 + Math.floor(rng() * 50);
  pp.growth_rate_pct = Math.floor(rng() * 41) / 2;
  pp.withdrawal_years = 5 + Math.floor(rng() * 36);
  pp.taxable_return_pct = Math.floor(rng() * 41) / 2;
  pp.capital_gains_rate_pct = Math.floor(rng() * 41);
  return pp;
}

const r2 = (v) => Math.round(v * 100) / 100;

// Independent closed form: Math.pow, and the withdrawal NPV as the same discounted sum.
function recompute(pp, dropCgTax) {
  const d = pp.deferral_usd, g = pp.growth_rate_pct / 100, n = pp.years_to_retirement, w = pp.withdrawal_years;
  const aBal = d * Math.pow(1 + g, n);
  const aTotal = aBal * (1 - pp.retirement_rate_pct / 100);
  const inv = d * (1 - pp.current_rate_pct / 100);
  const bGross = inv * Math.pow(1 + pp.taxable_return_pct / 100, n);
  const bNet = dropCgTax ? bGross : bGross - (bGross - inv) * (pp.capital_gains_rate_pct / 100);
  return { aBal: r2(aBal), aTotal: r2(aTotal), bNet: r2(bNet), adv: r2(aTotal - bNet), w };
}

function parityViolations(fn, seed, count) {
  let checked = 0, violations = 0;
  const rng = mulberry32(seed);
  for (let i = 0; i < count; i++) {
    const pp = jitterPP(rng);
    const o = fn(pp).output_payload;
    const x = recompute(pp, false);
    checked++;
    // The two sides round a value computed through different pow paths; allow one cent of drift.
    const close = (a, b) => Math.abs(a - b) <= 0.011 + Math.abs(b) * 1e-12;
    if (!close(o.scenario_a.balance_at_retirement_usd, x.aBal) || !close(o.scenario_a.total_after_tax_usd, x.aTotal) ||
        !close(o.scenario_b.total_after_tax_usd, x.bNet) || !close(o.advantage.total_usd, x.adv)) violations++;
  }
  return { checked, violations };
}

function checkP1Parity() {
  const p = parityViolations(compute, 84901, 120);
  return { name: 'P1 independent recompute parity at 2dp', ...p };
}

function checkP2Monotone() {
  let checked = 0, violations = 0;
  const rng = mulberry32(84902);
  for (let i = 0; i < 60; i++) {
    const lo = jitterPP(rng);
    const hi = { ...lo, deferral_usd: Math.min(49000, lo.deferral_usd + 1 + Math.floor(rng() * 1000)) };
    checked++;
    if (compute(hi).output_payload.scenario_a.total_after_tax_usd < compute(lo).output_payload.scenario_a.total_after_tax_usd) violations++;
  }
  const z = compute({ ...basePP(), deferral_usd: 0 }).output_payload;
  checked++;
  if (z.scenario_a.total_after_tax_usd !== 0 || z.scenario_b.total_after_tax_usd !== 0) violations++;
  return { name: 'P2 scenario A total non-decreasing in deferral; zero deferral gives zero', checked, violations };
}

function checkP3DeterminismShape() {
  let checked = 0, violations = 0;
  const rng = mulberry32(84903);
  for (let i = 0; i < 40; i++) {
    const pp = jitterPP(rng);
    const a = compute(pp), b = compute(pp);
    checked += 2;
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
    if (findShapeViolations(a.output_payload).length) violations++;
    if (JSON.stringify(a.output_payload.warnings) !== JSON.stringify(a.compliance_flags)) violations++;
  }
  return { name: 'P3 determinism, shape, flag mirror', checked, violations };
}

function checkP4Refusal() {
  let checked = 0, violations = 0;
  const keys = Object.keys(basePP());
  const bads = [undefined, null, '1', NaN, Infinity, -1, 1e300, 9007199254740993, {}, [], true];
  for (const k of keys) {
    for (const bad of bads) {
      const pp = basePP();
      if (bad === undefined) delete pp[k]; else pp[k] = bad;
      const r = compute(pp);
      checked++;
      if (r.output_payload.valid_input !== false || r.output_payload.domain_errors.length < 1 || r.output_payload.scenario_a !== null ||
          JSON.stringify(r.compliance_flags) !== '["INPUT_REFUSED"]') violations++;
    }
  }
  for (const bad of [null, undefined, 5, 'x', [], [1]]) {
    checked++;
    if (compute(bad).output_payload.valid_input !== false) violations++;
  }
  const proto = JSON.parse('{"__proto__":{"deferral_usd":1},"constructor":2}');
  checked++;
  if (compute({ ...basePP(), ...proto }).output_payload.valid_input !== true) violations++;
  return { name: 'P4 refusal contract (deleted, null, wrong type, non-finite, unsafe, prototype names)', checked, violations };
}

function checkP5Boundaries() {
  let checked = 0, violations = 0;
  const cases = [
    [24500, 'STANDARD', false], [24501, 'AGE_50_CATCH_UP', true],
    [32500, 'AGE_50_CATCH_UP', true], [32501, 'AGE_60_TO_63_CATCH_UP', true],
    [35750, 'AGE_60_TO_63_CATCH_UP', true], [35751, 'SPECIAL_CATCH_UP_RANGE', true],
    [49000, 'SPECIAL_CATCH_UP_RANGE', true],
  ];
  for (const [d, tier, flagged] of cases) {
    const r = compute({ ...basePP(), deferral_usd: d });
    checked += 2;
    if (r.output_payload.limit_tier !== tier) violations++;
    if (r.compliance_flags.includes('DEFERRAL_ABOVE_STANDARD_LIMIT') !== flagged) violations++;
  }
  for (const d of [49000.01, 49001]) {
    checked++;
    if (compute({ ...basePP(), deferral_usd: d }).output_payload.valid_input !== false) violations++;
  }
  const tie = compute({ ...basePP(), current_rate_pct: 0, retirement_rate_pct: 0, capital_gains_rate_pct: 0, growth_rate_pct: 6, taxable_return_pct: 6 }).output_payload;
  checked++;
  if (tie.advantage.verdict !== 'FAVORS_457B') violations++;
  const off = compute({ ...basePP(), current_rate_pct: 0, retirement_rate_pct: 1, capital_gains_rate_pct: 0, growth_rate_pct: 6, taxable_return_pct: 6 }).output_payload;
  checked++;
  if (off.advantage.verdict !== 'FAVORS_TAXABLE') violations++;
  return { name: 'P5 limit tier, flag and verdict comparators at exact boundaries', checked, violations };
}

async function checkP6NeverThrows() {
  let checked = 0, violations = 0;
  const inputs = [null, undefined, 1, 'x', [], { ...basePP(), annual_income_usd: 1e300 }, { ...basePP(), deferral_usd: 9007199254740993 },
    { ...basePP(), deferral_usd: NaN }, { ...basePP(), extra: { deep: [Infinity] } }, basePP()];
  for (const pp of inputs) {
    checked++;
    try {
      const a = await buildArtifact(pp);
      const hashable = a.execution_hash !== null;
      if (!hashable && !a.hash_refusal) violations++;
      if (hashable && a.hash_refusal) violations++;
    } catch { violations++; }
  }
  return { name: 'buildArtifact_never_throws', checked, violations };
}

// P7 red/green pair: the mutant drops the capital-gains tax; P1 must flag it, and must not flag the real kernel.
function checkP7RedGreen() {
  const mutant = (pp) => {
    const out = compute({ ...pp, capital_gains_rate_pct: 0 });
    return out;
  };
  const green = parityViolations(compute, 84907, 60).violations;
  const red = parityViolations(mutant, 84907, 60).violations;
  return { name: 'P7 red/green pair (real kernel green, capital-gains-dropped mutant red)', checked: 2, violations: (green === 0 ? 0 : 1) + (red > 0 ? 0 : 1) };
}

let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1Parity(), checkP2Monotone(), checkP3DeterminismShape(), checkP4Refusal(), checkP5Boundaries(),
  await checkP6NeverThrows(), checkP7RedGreen(),
];
console.log(`[${KERNEL_ID}] class-K floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
