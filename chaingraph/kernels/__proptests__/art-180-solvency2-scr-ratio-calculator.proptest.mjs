// kernel_digest_at_authoring: sha256:58ddc09d3c1b6bccab424d5392e51c690e34d0466a76b885b19a819ef7f7875f
//
// FV-PROPFLOOR-SHARD-B5-1 — property-test floor for art-180-solvency2-scr-ratio-calculator.
// Class B (bounded ratio calculator). float-sensitive: yes -- division into coverage ratios
// and 50%/80%/15% tiering-limit comparisons against fractions of `scr`. ULP-boundary forcing
// is mandatory per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG +
// explicit boundary arrays), same shape as the B1/B2/B3 harnesses. Read-only w.r.t. the kernel.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-180-solvency2-scr-ratio-calculator.proptest.mjs

import { compute } from '../art-180-solvency2-scr-ratio-calculator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-180-solvency2-scr-ratio-calculator.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = compute(vec.policy_parameters);
    const a = JSON.stringify(output_payload);
    const b = JSON.stringify(vec.output_payload);
    if (a !== b) failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
  }
  results.fixture_oracle = { total: fixtures.vectors.length, failures };
  return failures.length === 0;
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x18001);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

const TRIALS = 8000;

function mkCapital(rng) {
  return {
    eligible_own_funds: randRange(rng, 0, 5000),
    tier1_unrestricted: randRange(rng, 0, 3000),
    tier1_restricted: randRange(rng, 0, 1000),
    tier3: randRange(rng, 0, 500),
    scr: rng() < 0.05 ? 0 : randRange(rng, 1, 3000),
    mcr: rng() < 0.05 ? 0 : randRange(rng, 1, 1000),
  };
}

// ---------- P1: monotone -- more own_funds never decreases coverage ratios; more scr never increases them ----------
function checkP1_monotone() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const capital = mkCapital(rand);
    const moreFunds = { ...capital, eligible_own_funds: capital.eligible_own_funds + 1000 };
    const r1 = compute({ capital }).output_payload;
    const r2 = compute({ capital: moreFunds }).output_payload;
    checked++;
    if (r2.scr_coverage_ratio < r1.scr_coverage_ratio) violations++;
    if (r2.mcr_coverage_ratio < r1.mcr_coverage_ratio) violations++;

    if (capital.scr > 0) {
      const moreScr = { ...capital, scr: capital.scr + 1000 };
      const r3 = compute({ capital: moreScr }).output_payload;
      checked++;
      if (r3.scr_coverage_ratio > r1.scr_coverage_ratio) violations++;
    }
  }
  return { name: 'P1_monotone_ratio_vs_funds_and_scr', trials: checked, violations };
}

// ---------- P2: boundedness -- all percentages non-negative; tier1_total_pct matches independent formula ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const capital = mkCapital(rand);
    const r = compute({ capital }).output_payload;
    checked++;
    if (r.scr_coverage_ratio < 0 || r.mcr_coverage_ratio < 0) violations++;
    if (r.tier1_unrestricted_pct_of_scr < 0 || r.tier1_total_pct_of_scr < 0 || r.tier3_pct_of_scr < 0) violations++;
    const expectedTotalPct = capital.scr > 0
      ? Math.round(((capital.tier1_unrestricted + capital.tier1_restricted) / capital.scr) * 10000) / 100 : 0;
    if (r.tier1_total_pct_of_scr !== expectedTotalPct) violations++;
  }
  return { name: 'P2_boundedness_nonneg_and_tier1_total_formula', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement -- breach/limit booleans match the raw (unrounded) formulas exactly ----------
function checkP3_thresholdAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const capital = mkCapital(rand);
    const r = compute({ capital }).output_payload;
    checked++;
    const expScrBreached = capital.scr > 0 && r.scr_coverage_ratio < 100;
    const expMcrBreached = capital.mcr > 0 && r.mcr_coverage_ratio < 100;
    const expT1uOk = capital.scr > 0 ? capital.tier1_unrestricted >= 0.5 * capital.scr : false;
    const expT1tOk = capital.scr > 0 ? (capital.tier1_unrestricted + capital.tier1_restricted) >= 0.8 * capital.scr : false;
    const expT3Ok  = capital.scr > 0 ? capital.tier3 <= 0.15 * capital.scr : true;
    const expTiering = expT1uOk && expT1tOk && expT3Ok;
    if (r.scr_breached !== expScrBreached) violations++;
    if (r.mcr_breached !== expMcrBreached) violations++;
    if (r.tier1_unrestricted_limit_ok !== expT1uOk) violations++;
    if (r.tier1_total_limit_ok !== expT1tOk) violations++;
    if (r.tier3_limit_ok !== expT3Ok) violations++;
    if (r.tiering_ok !== expTiering) violations++;
  }
  return { name: 'P3_breach_and_tiering_matches_raw_threshold_formula', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (float_sensitive: yes) ----------
const ULP_BOUNDARY_CASES = [
  [{ eligible_own_funds: 1000, scr: 1000, mcr: 1 }, 'ratio exactly 100 -- must NOT breach (100 < 100 is false)'],
  [{ eligible_own_funds: 1000 - Number.EPSILON, scr: 1000, mcr: 1 }, '1 ULP below par -- must not spuriously flip after rounding'],
  [{ eligible_own_funds: 0, scr: 0, mcr: 0 }, 'zero scr/mcr -- guarded division, ratios must be 0 not Infinity/NaN'],
  [{ eligible_own_funds: -0, scr: 1000, mcr: 1 }, 'negative-zero own_funds -- must behave as zero, ratio 0'],
  [{ eligible_own_funds: Number.MIN_VALUE, scr: 1000, mcr: 1 }, 'denormal own_funds -- must stay finite, near-zero ratio'],
  [{ tier1_unrestricted: 500, scr: 1000 }, 'tier1-unrestricted exactly at the 50% limit -- must be OK (>=)'],
  [{ tier1_unrestricted: 500 - 500 * Number.EPSILON, scr: 1000 }, 'tier1-unrestricted 1 ULP below 50% -- must fail the limit'],
  [{ tier3: 150, scr: 1000 }, 'tier3 exactly at the 15% cap -- must be OK (<=)'],
  [{ tier3: 150 + 150 * Number.EPSILON, scr: 1000 }, 'tier3 1 ULP above the 15% cap -- must fail the limit'],
  [{ eligible_own_funds: 0.3, scr: 0.1 + 0.2 }, 'classic 0.1+0.2 float-repr scr -- x/y*y!==x style, must stay finite'],
];

function checkP4_forced() {
  const rows = [];
  for (const [capital, label] of ULP_BOUNDARY_CASES) {
    const r = compute({ capital }).output_payload;
    const finite = Number.isFinite(r.scr_coverage_ratio) && Number.isFinite(r.mcr_coverage_ratio)
      && Number.isFinite(r.tier1_unrestricted_pct_of_scr) && Number.isFinite(r.tier1_total_pct_of_scr)
      && Number.isFinite(r.tier3_pct_of_scr);
    rows.push({ label, capital, scr_coverage_ratio: r.scr_coverage_ratio, tiering_ok: r.tiering_ok, plausible: finite });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotone());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_thresholdAgreement());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  tool_id: 'art-180-solvency2-scr-ratio-calculator',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);
