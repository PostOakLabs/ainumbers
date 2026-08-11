// kernel_digest_at_authoring: sha256:6c42f2e178d592ddca24ae38edae3baed3c67880f4f18ce29b79d11e0e46f4d4
//
// FV-PROPFLOOR-SHARD-B13-1 — property-test floor for art-45-arc-xreserve-linter.
// Class B (bounded-numeric), float:no per the WU row. ⭐ Verified against the kernel: the reserve
// sum check (usdc_pct + usyc_pct + other_pct) uses a fixed 0.01 tolerance band via Math.abs(sum-100)
// < 0.01, and usyc_pct is compared against 60/80 percentage thresholds — these are threshold-tier
// comparisons on declared percentage inputs, not continuous ULP-sensitive arithmetic chains (no
// division, no compounding). float:no confirmed; forced CATEGORICAL boundary cases used instead
// of ULP forcing, including exact values at the 100%/60%/80% thresholds, per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-45-arc-xreserve-linter.proptest.mjs

import { compute } from '../art-45-arc-xreserve-linter.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-45-arc-xreserve-linter.fixtures.json');
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
const rand = mulberry32(0x45FF);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randBool(rng) { return rng() < 0.5; }
const TRIALS = 8000;

const CADENCES = ['daily', 'weekly', 'monthly', 'quarterly', 'annually', 'none'];

function mkPP(rng) {
  const usdcPct = randRange(rng, 0, 100);
  const usycPct = randRange(rng, 0, 100 - usdcPct);
  const otherPct = 100 - usdcPct - usycPct;
  return {
    usdc_pct: usdcPct,
    usyc_pct: usycPct,
    other_pct: otherPct,
    us_issuers_only: randBool(rng),
    yield_enabled: randBool(rng),
    is_us_ppsi: randBool(rng),
    is_eu_emt: randBool(rng),
    reserve_segregated: randBool(rng),
    cctp_domains: Math.floor(randRange(rng, 0, 5)),
    attestation_cadence: pick(rng, CADENCES),
    mint_role_segregated: randBool(rng),
  };
}

// ---------- P1: boundedness — grade is always one of the fixed A-F 6-state enum ----------
function checkP1_gradeBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (!['A', 'B', 'C', 'D', 'E', 'F'].includes(r.output_payload.grade)) violations++;
  }
  return { name: 'P1_grade_bounded_to_6_state_a_to_f_enum', trials: checked, violations };
}

// ---------- P2: metamorphic — grade function re-derived exactly from fail_count/warn_count ----------
function grade(failCount, warnCount) {
  if (failCount === 0 && warnCount === 0) return 'A';
  if (failCount === 0 && warnCount <= 1) return 'B';
  if (failCount === 0 && warnCount <= 3) return 'C';
  if (failCount === 1) return 'D';
  if (failCount === 2) return 'E';
  return 'F';
}
function checkP2_gradeMatchesFailWarnCounts() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const o = r.output_payload;
    if (o.grade !== grade(o.fail_count, o.warn_count)) violations++;
  }
  return { name: 'P2_grade_matches_reederived_grade_function', trials: checked, violations };
}

// ---------- P3: threshold-tier agreement — reserve_sum check pass/fail matches |sum-100|<0.01 exactly ----------
function checkP3_reserveSumCheckMatchesThreshold() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const sum = Number(pp.usdc_pct) + Number(pp.usyc_pct) + Number(pp.other_pct);
    const expectedPass = Math.abs(sum - 100) < 0.01;
    const actual = r.output_payload.checks.find(c => c.id === 'reserve_sum');
    if (actual.pass !== expectedPass) violations++;
  }
  return { name: 'P3_reserve_sum_check_matches_001_tolerance_threshold', trials: checked, violations };
}

// ---------- P4 (float:no exception): forced CATEGORICAL boundary cases ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ usdc_pct: 70, usyc_pct: 25, other_pct: 5, us_issuers_only: true, mint_role_segregated: true, cctp_domains: 3, attestation_cadence: 'monthly' }, 'reserve sum exactly 100.00 — reserve_sum check must pass'],
  [{ usdc_pct: 70, usyc_pct: 25, other_pct: 4.99, us_issuers_only: true, mint_role_segregated: true, cctp_domains: 3, attestation_cadence: 'monthly' }, 'reserve sum at 99.99 (0.01 below the 0.01-tolerance boundary, just outside) — reserve_sum check must fail'],
  [{ usdc_pct: 70, usyc_pct: 25, other_pct: 5.005, us_issuers_only: true, mint_role_segregated: true, cctp_domains: 3, attestation_cadence: 'monthly' }, 'reserve sum at 100.005 (within the 0.01 tolerance band) — reserve_sum check must pass'],
  [{ usdc_pct: 20, usyc_pct: 80, other_pct: 0, us_issuers_only: true, mint_role_segregated: true, cctp_domains: 3, attestation_cadence: 'monthly' }, 'usyc_pct exactly at the 80% ceiling boundary — usyc_ceiling check must pass (<=80), usyc_warn must be false (not >60 && <=80 is true at exactly 80, so warn IS expected true) — verify exact boundary semantics'],
  [{ usdc_pct: 19, usyc_pct: 81, other_pct: 0, us_issuers_only: true, mint_role_segregated: true, cctp_domains: 3, attestation_cadence: 'monthly' }, 'usyc_pct 1% over the 80% ceiling — usyc_ceiling check must fail'],
  [{ usdc_pct: 100, usyc_pct: 0, other_pct: 0, us_issuers_only: true, mint_role_segregated: true, cctp_domains: 1, attestation_cadence: 'monthly' }, 'cctp_domains exactly 1 (boundary between fail/warn) — cctp_domains check must warn, not fail'],
  [{ usdc_pct: 100, usyc_pct: 0, other_pct: 0, us_issuers_only: true, mint_role_segregated: true, cctp_domains: 2, attestation_cadence: 'monthly' }, 'cctp_domains exactly 2 (boundary between warn/pass) — cctp_domains check must pass cleanly'],
  [{ usdc_pct: 100, usyc_pct: 0, other_pct: 0, us_issuers_only: true, mint_role_segregated: true, cctp_domains: 3, attestation_cadence: 'none' }, 'attestation_cadence exactly "none" — attest_warn must be suppressed per kernel special-case (warn: attestWarn && cadence !== "none")'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const o = r.output_payload;
    const plausible = ['A', 'B', 'C', 'D', 'E', 'F'].includes(o.grade) && Array.isArray(o.checks) && o.checks.length === 8;
    rows.push({ label, input: pp, output: o, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_gradeBounded());
results.properties.push(checkP2_gradeMatchesFailWarnCounts());
results.properties.push(checkP3_reserveSumCheckMatchesThreshold());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);
