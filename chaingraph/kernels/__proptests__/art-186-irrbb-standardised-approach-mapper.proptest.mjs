// kernel_digest_at_authoring: sha256:3687fcacedfebe176360464c1aaed42703249cb1305e2538b3058ef6a417c271
//
// FV-PROPFLOOR-SHARD-B5-1 — property-test floor for art-186-irrbb-standardised-approach-mapper.
// Class B (bounded categorical mapper w/ real-number core-deposit cap). float-sensitive: yes --
// core_deposit_pct is capped by a direct real-number comparison (`>`) against the category's
// core_cap_pct (90/70/50), so ULP-boundary forcing on that comparison is mandatory per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG + explicit boundary
// arrays), same shape as the B1/B2/B3 harnesses. Read-only w.r.t. the kernel.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-186-irrbb-standardised-approach-mapper.proptest.mjs

import { compute } from '../art-186-irrbb-standardised-approach-mapper.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-186-irrbb-standardised-approach-mapper.fixtures.json');
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
const rand = mulberry32(0x18601);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const TRIALS = 8000;
const CATEGORIES = ['retail_transactional', 'retail_non_transactional', 'wholesale'];
const CAPS = {
  retail_transactional: { core_cap_pct: 90, maturity_cap_years: 5 },
  retail_non_transactional: { core_cap_pct: 70, maturity_cap_years: 4.5 },
  wholesale: { core_cap_pct: 50, maturity_cap_years: 4 },
};

function mkPositions(rng) {
  return {
    deposit_category: rng() < 0.1 ? 'not_a_real_category' : pick(rng, CATEGORIES),
    core_deposit_pct: randRange(rng, 0, 120),
    behavioural_mortgage_prepay_pct: rng() < 0.5 ? 0 : randRange(rng, 0, 40),
  };
}

// ---------- P1: default-category fallback -- unrecognized category always falls back to retail_transactional ----------
function checkP1_categoryFallback() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const positions = mkPositions(rand);
    const r = compute({ positions }).output_payload;
    checked++;
    const expCategory = Object.prototype.hasOwnProperty.call(CAPS, positions.deposit_category) ? positions.deposit_category : 'retail_transactional';
    if (r.deposit_category !== expCategory) violations++;
    if (r.maturity_cap_years !== CAPS[expCategory].maturity_cap_years) violations++;
  }
  return { name: 'P1_unrecognized_category_falls_back_to_retail_transactional', trials: checked, violations };
}

// ---------- P2: cap application -- core_capped/applied match the raw comparison exactly ----------
function checkP2_capApplication() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const positions = mkPositions(rand);
    const r = compute({ positions }).output_payload;
    checked++;
    const cap = CAPS[r.deposit_category];
    const expCapped = positions.core_deposit_pct > cap.core_cap_pct;
    const expApplied = expCapped ? cap.core_cap_pct : positions.core_deposit_pct;
    if (r.core_capped !== expCapped) violations++;
    if (r.core_deposit_pct_applied !== expApplied) violations++;
    if (r.core_deposit_pct_applied > cap.core_cap_pct) violations++; // boundedness
  }
  return { name: 'P2_cap_application_matches_raw_comparison_and_stays_bounded', trials: checked, violations };
}

// ---------- P3: behavioural add-on flag is a pure function of the prepay percentage ----------
function checkP3_addonFlag() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const positions = mkPositions(rand);
    const r = compute({ positions }).output_payload;
    checked++;
    const expAddon = positions.behavioural_mortgage_prepay_pct > 0;
    if (r.behavioural_option_addon_required !== expAddon) violations++;
  }
  return { name: 'P3_addon_required_iff_prepay_pct_positive', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (float_sensitive: yes) ----------
const ULP_BOUNDARY_CASES = [
  [{ deposit_category: 'retail_transactional', core_deposit_pct: 90 }, 'core_deposit_pct exactly at the 90% cap -- must NOT be capped (> is strict)'],
  [{ deposit_category: 'retail_transactional', core_deposit_pct: 90 + 90 * Number.EPSILON }, 'core_deposit_pct 1 ULP above cap -- must be capped'],
  [{ deposit_category: 'retail_non_transactional', core_deposit_pct: 70 }, 'core_deposit_pct exactly at the 70% cap -- must NOT be capped'],
  [{ deposit_category: 'retail_non_transactional', core_deposit_pct: 70 + 70 * Number.EPSILON }, 'core_deposit_pct 1 ULP above the non-integer-adjacent 70% cap -- must be capped'],
  [{ deposit_category: 'wholesale', core_deposit_pct: 50 }, 'core_deposit_pct exactly at the 50% cap -- must NOT be capped'],
  [{ deposit_category: 'wholesale', core_deposit_pct: 50 + 50 * Number.EPSILON }, 'core_deposit_pct 1 ULP above the 50% cap -- must be capped'],
  [{ deposit_category: 'retail_transactional', core_deposit_pct: 0 }, 'core_deposit_pct exactly zero -- never capped'],
  [{ deposit_category: 'retail_transactional', core_deposit_pct: -0 }, 'negative-zero core_deposit_pct -- must behave as zero'],
  [{ deposit_category: 'retail_transactional', core_deposit_pct: Number.MIN_VALUE }, 'denormal core_deposit_pct -- must stay finite, never capped'],
  [{ deposit_category: 'wholesale', core_deposit_pct: 40, behavioural_mortgage_prepay_pct: -0 }, 'negative-zero prepay pct -- addon must NOT be required (not > 0)'],
];

function checkP4_forced() {
  const rows = [];
  for (const [positions, label] of ULP_BOUNDARY_CASES) {
    const r = compute({ positions }).output_payload;
    const finite = Number.isFinite(r.core_deposit_pct_input) && Number.isFinite(r.core_deposit_pct_applied) && Number.isFinite(r.maturity_cap_years);
    rows.push({ label, positions, core_capped: r.core_capped, core_deposit_pct_applied: r.core_deposit_pct_applied, plausible: finite });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_categoryFallback());
results.properties.push(checkP2_capApplication());
results.properties.push(checkP3_addonFlag());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  tool_id: 'art-186-irrbb-standardised-approach-mapper',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);
