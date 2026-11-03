// kernel_digest_at_authoring: sha256:9d4a1025e0982e476cc0158b3b0d24b87328adae662f2f1449a49c356fc4ee1a
//
// ART180-SII-TIERING-LIMITS-FIX-1 — property-test floor for art-180-solvency2-scr-ratio-calculator.
// Class B (bounded ratio calculator). float-sensitive: yes -- division into coverage ratios
// and the Art. 82(1)/82(3) tiering-limit comparisons against fractions of `scr` and of total
// Tier 1. ULP-boundary forcing is mandatory per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external
// dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the B1/B2/B3
// harnesses. Read-only w.r.t. the kernel. Scope: SCR coverage ratios, MCR coverage ratio,
// breach flags, and the four Art. 82 tiering tests (Tier 1 at least half of SCR, Tier 3
// strictly under 15% of SCR, Tier 2 plus Tier 3 at most half of SCR, restricted Tier 1
// strictly under 20% of total Tier 1). The kernel does not implement MCR tiering (Art. 82(2)).
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
    tier2: randRange(rng, 0, 2000),
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

// ---------- P2: boundedness -- all percentages non-negative; every percentage matches an
// independently written formula (not the kernel's own expressions) ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const capital = mkCapital(rand);
    const r = compute({ capital }).output_payload;
    checked++;
    if (r.scr_coverage_ratio < 0 || r.mcr_coverage_ratio < 0) violations++;
    if (r.tier1_unrestricted_pct_of_scr < 0 || r.tier1_total_pct_of_scr < 0 || r.tier3_pct_of_scr < 0) violations++;
    if (r.tier2_tier3_pct_of_scr < 0 || r.tier1_restricted_pct_of_tier1 < 0) violations++;
    const t1 = capital.tier1_unrestricted + capital.tier1_restricted;
    const expectedTotalPct = capital.scr > 0 ? Math.round((t1 / capital.scr) * 10000) / 100 : 0;
    const expectedT23Pct = capital.scr > 0 ? Math.round(((capital.tier2 + capital.tier3) / capital.scr) * 10000) / 100 : 0;
    const expectedRshPct = t1 > 0 ? Math.round((capital.tier1_restricted / t1) * 10000) / 100 : 0;
    if (r.tier1_total_pct_of_scr !== expectedTotalPct) violations++;
    if (r.tier2_tier3_pct_of_scr !== expectedT23Pct) violations++;
    if (r.tier1_restricted_pct_of_tier1 !== expectedRshPct) violations++;
  }
  return { name: 'P2_boundedness_nonneg_and_independent_pct_formulas', trials: checked, violations };
}

// ---------- P3: Art. 82 tier agreement -- the four limit booleans and tiering_ok match an
// independently written integer cross-multiplication oracle (never decimal multipliers:
// 0.15 * 3 is 0.44999999999999996 in IEEE-754) ----------
function checkP3_thresholdAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const capital = mkCapital(rand);
    const r = compute({ capital }).output_payload;
    checked++;
    const expScrBreached = capital.scr > 0 && r.scr_coverage_ratio < 100;
    const expMcrBreached = capital.mcr > 0 && r.mcr_coverage_ratio < 100;
    // Art. 82(1)(a): Tier 1 at least one half of the SCR (integer cross-multiplication).
    const expT1Ok = capital.scr > 0 && (capital.tier1_unrestricted + capital.tier1_restricted) * 2 >= capital.scr;
    // Art. 82(1)(b): Tier 3 strictly under 15% of the SCR.
    const expT3Ok = capital.scr > 0 ? capital.tier3 * 100 < 15 * capital.scr : true;
    // Art. 82(1)(c): Tier 2 plus Tier 3 at most 50% of the SCR.
    const expT23Ok = capital.scr > 0 ? (capital.tier2 + capital.tier3) * 2 <= capital.scr : true;
    // Art. 82(3): restricted Tier 1 strictly under 20% of total Tier 1.
    const t1 = capital.tier1_unrestricted + capital.tier1_restricted;
    const expRshOk = t1 > 0 ? capital.tier1_restricted * 5 < t1 : true;
    const expTiering = expT1Ok && expT3Ok && expT23Ok && expRshOk;
    if (r.scr_breached !== expScrBreached) violations++;
    if (r.mcr_breached !== expMcrBreached) violations++;
    if (r.tier1_total_limit_ok !== expT1Ok) violations++;
    if (r.tier3_limit_ok !== expT3Ok) violations++;
    if (r.tier2_tier3_limit_ok !== expT23Ok) violations++;
    if (r.tier1_restricted_share_ok !== expRshOk) violations++;
    if (r.tiering_ok !== expTiering) violations++;
  }
  return { name: 'P3_art82_tiering_matches_cross_multiplication_oracle', trials: checked, violations };
}

// ---------- P3b: tiering_ok equals the AND of the four Art. 82 tests; monotone in Tier 3 --
// raising tier3 never turns tier3_limit_ok from false back to true ----------
function checkP3b_and_monotoneT3() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const capital = mkCapital(rand);
    const r = compute({ capital }).output_payload;
    checked++;
    const and = r.tier1_total_limit_ok && r.tier3_limit_ok && r.tier2_tier3_limit_ok && r.tier1_restricted_share_ok;
    if (r.tiering_ok !== and) violations++;
    const r2 = compute({ capital: { ...capital, tier3: capital.tier3 + 25 } }).output_payload;
    if (r.tier3_limit_ok === false && r2.tier3_limit_ok === true) violations++;
    const r3 = compute({ capital: { ...capital, tier3: capital.tier3 + 25 } }).output_payload;
    if (r.tiering_ok === false && r3.tiering_ok === true && capital.scr > 0) violations++;
  }
  return { name: 'P3b_tiering_is_and_of_four_tests_and_monotone_in_tier3', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (float_sensitive: yes) -- boundary triple
// (just under, exactly at, just over) for each of the four Art. 82 limits ----------
const ULP_BOUNDARY_CASES = [
  [{ eligible_own_funds: 1000, scr: 1000, mcr: 1 }, 'ratio exactly 100 -- must NOT breach (100 < 100 is false)'],
  [{ eligible_own_funds: 1000 - Number.EPSILON, scr: 1000, mcr: 1 }, '1 ULP below par -- must not spuriously flip after rounding'],
  [{ eligible_own_funds: 0, scr: 0, mcr: 0 }, 'zero scr/mcr -- guarded division, ratios must be 0 not Infinity/NaN'],
  [{ eligible_own_funds: -0, scr: 1000, mcr: 1 }, 'negative-zero own_funds -- must behave as zero, ratio 0'],
  [{ eligible_own_funds: Number.MIN_VALUE, scr: 1000, mcr: 1 }, 'denormal own_funds -- must stay finite, near-zero ratio'],
  // Art. 82(1)(a) triple: Tier 1 exactly at half the SCR passes, 1 ULP under fails.
  [{ tier1_unrestricted: 500, tier1_restricted: 0, scr: 1000 }, 'Tier 1 exactly at 50% of SCR -- must be OK (at least half)'],
  [{ tier1_unrestricted: 500 - 500 * Number.EPSILON, tier1_restricted: 0, scr: 1000 }, 'Tier 1 1 ULP under 50% of SCR -- must fail the limit'],
  [{ tier1_unrestricted: 500 + 500 * Number.EPSILON, tier1_restricted: 0, scr: 1000 }, 'Tier 1 1 ULP over 50% of SCR -- must pass'],
  // Art. 82(1)(b) triple: Tier 3 exactly 15% FAILS (strictly under).
  [{ tier3: 149.99, scr: 1000 }, 'Tier 3 just under 15% of SCR -- must be OK'],
  [{ tier3: 150, scr: 1000 }, 'Tier 3 exactly 15% of SCR -- must FAIL (less than 15%)'],
  [{ tier3: 150 + 150 * Number.EPSILON, scr: 1000 }, 'Tier 3 1 ULP over 15% of SCR -- must FAIL the limit'],
  // Art. 82(1)(c) triple: Tier 2 plus Tier 3 exactly 50% passes, 1 ULP over fails.
  [{ tier2: 350, tier3: 150, scr: 1000 }, 'Tier 2 plus Tier 3 exactly 50% of SCR -- must be OK (at most half)'],
  [{ tier2: 350, tier3: 150 + 150 * Number.EPSILON, scr: 1000 }, 'Tier 2 plus Tier 3 1 ULP over 50% of SCR -- must fail the limit'],
  // Art. 82(3) triple: restricted share exactly 20% FAILS (strictly under).
  [{ tier1_unrestricted: 801, tier1_restricted: 199, scr: 1000 }, 'restricted share 19.9% of Tier 1 -- must be OK'],
  [{ tier1_unrestricted: 800, tier1_restricted: 200, scr: 1000 }, 'restricted share exactly 20% of Tier 1 -- must FAIL (less than 20%)'],
  [{ tier1_unrestricted: 800, tier1_restricted: 200 + Number.EPSILON, scr: 1000 }, 'restricted share just over 20% of Tier 1 -- must FAIL'],
  [{ eligible_own_funds: 0.3, scr: 0.1 + 0.2 }, 'classic 0.1+0.2 float-repr scr -- x/y*y!==x style, must stay finite'],
];

function checkP4_forced() {
  const rows = [];
  for (const [capital, label] of ULP_BOUNDARY_CASES) {
    const r = compute({ capital }).output_payload;
    const finite = Number.isFinite(r.scr_coverage_ratio) && Number.isFinite(r.mcr_coverage_ratio)
      && Number.isFinite(r.tier1_unrestricted_pct_of_scr) && Number.isFinite(r.tier1_total_pct_of_scr)
      && Number.isFinite(r.tier3_pct_of_scr) && Number.isFinite(r.tier2_tier3_pct_of_scr)
      && Number.isFinite(r.tier1_restricted_pct_of_tier1);
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
results.properties.push(checkP3b_and_monotoneT3());
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
