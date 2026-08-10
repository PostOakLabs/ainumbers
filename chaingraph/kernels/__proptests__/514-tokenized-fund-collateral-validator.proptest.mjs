// kernel_digest_at_authoring: sha256:0ffd03e4aa9960ce7c1c4b4ed9d985e33b3a166f5f96942ff5eb419487a0e62b
//
// FV-PROPFLOOR-SHARD-B1-1 — property-test floor for 514-tokenized-fund-collateral-validator.
// Class B (bounded-numeric), FLOAT-SENSITIVE (DLA/WLA %, NAV collar arithmetic, haircut) — ULP-
// boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// Read-only w.r.t. the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/514-tokenized-fund-collateral-validator.proptest.mjs

import { compute } from '../514-tokenized-fund-collateral-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', '514-tokenized-fund-collateral-validator.fixtures.json');
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
const rand = mulberry32(0x514A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const FUND_TYPES = ['sec_govt_mmf', 'sec_retail_prime_mmf', 'sec_inst_prime_mmf', 'eu_cnav', 'eu_lvnav', 'eu_vnav', 'other_govt_fund', 'other'];
const COLLATERAL_USES = ['repo_collateral', 'im_derivative', 'vm_derivative', 'lender_collateral', 'none'];
const PLATFORMS = ['canton_benji', 'other'];
const TRIALS = 20000;

function randPP(rng) {
  return {
    fund_type: pick(rng, FUND_TYPES),
    total_fund_value: randRange(rng, 0, 10_000_000),
    daily_liquid_assets_pct: randRange(rng, 0, 100),
    weekly_liquid_assets_pct: randRange(rng, 0, 100),
    nav: randRange(rng, 0.98, 1.02),
    collateral_use: pick(rng, COLLATERAL_USES),
    platform: pick(rng, PLATFORMS),
    sftr_consent: rng() < 0.5,
    reuse_flag: rng() < 0.5,
    cp_jurisdiction: pick(rng, ['us', 'eu', 'other']),
  };
}

// ---------- P1: monotone in total_fund_value (fixed everything else, adjusted_collateral_value scales) ----------
function checkP1_monotoneValue() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const base = randPP(rand);
    const v1 = randRange(rand, 0, 5_000_000);
    const v2 = v1 + randRange(rand, 0, 5_000_000);
    const r1 = compute({ ...base, total_fund_value: v1 });
    const r2 = compute({ ...base, total_fund_value: v2 });
    checked++;
    if (r2.output_payload.adjusted_collateral_value < r1.output_payload.adjusted_collateral_value - 0.01) violations++;
  }
  return { name: 'P1_monotone_in_total_fund_value', trials: checked, violations };
}

// ---------- P2: boundedness — haircut in {0, 0.10}, adjusted_collateral_value in [0, total_fund_value] ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    if (r.haircut_applied !== 0 && r.haircut_applied !== 0.10) violations++;
    if (r.adjusted_collateral_value < -0.01 || r.adjusted_collateral_value > pp.total_fund_value + 0.01) violations++;
  }
  return { name: 'P2_boundedness_haircut_and_adjusted_value', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — repo_collateral always INELIGIBLE regardless of other params ----------
function checkP3_repoAlwaysIneligible() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randPP(rand);
    pp.collateral_use = 'repo_collateral';
    const r = compute(pp).output_payload;
    checked++;
    if (r.eligibility !== 'INELIGIBLE') violations++;
  }
  return { name: 'P3_repo_collateral_always_ineligible', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  ['SEC DLA exactly at 25 — must NOT breach (< not <=)', { fund_type: 'sec_govt_mmf', total_fund_value: 1000000, daily_liquid_assets_pct: 25, weekly_liquid_assets_pct: 60, nav: 1.0, collateral_use: 'lender_collateral', platform: 'other', sftr_consent: true, reuse_flag: false, cp_jurisdiction: 'us' }],
  ['SEC DLA 1 ULP under 25 — must breach', { fund_type: 'sec_govt_mmf', total_fund_value: 1000000, daily_liquid_assets_pct: 25 - Number.EPSILON * 32, weekly_liquid_assets_pct: 60, nav: 1.0, collateral_use: 'lender_collateral', platform: 'other', sftr_consent: true, reuse_flag: false, cp_jurisdiction: 'us' }],
  ['EU LVNAV collar exactly 0.0020 — must NOT breach (> not >=)', { fund_type: 'eu_lvnav', total_fund_value: 1000000, daily_liquid_assets_pct: 50, weekly_liquid_assets_pct: 50, nav: 1.0020, collateral_use: 'lender_collateral', platform: 'other', sftr_consent: true, reuse_flag: false, cp_jurisdiction: 'eu' }],
  ['EU LVNAV collar 1 ULP over 0.0020 — must breach', { fund_type: 'eu_lvnav', total_fund_value: 1000000, daily_liquid_assets_pct: 50, weekly_liquid_assets_pct: 50, nav: 1.0020 + Number.EPSILON * 4, collateral_use: 'lender_collateral', platform: 'other', sftr_consent: true, reuse_flag: false, cp_jurisdiction: 'eu' }],
  ['SEC inst-prime FNAV boundary: abs(nav-1)=0.0001 exactly — must NOT trigger (< not <=)', { fund_type: 'sec_inst_prime_mmf', total_fund_value: 1000000, daily_liquid_assets_pct: 50, weekly_liquid_assets_pct: 50, nav: 1.0001, collateral_use: 'lender_collateral', platform: 'other', sftr_consent: true, reuse_flag: false, cp_jurisdiction: 'us' }],
  ['total_fund_value=0', { fund_type: 'sec_govt_mmf', total_fund_value: 0, daily_liquid_assets_pct: 50, weekly_liquid_assets_pct: 50, nav: 1.0, collateral_use: 'lender_collateral', platform: 'other', sftr_consent: true, reuse_flag: false, cp_jurisdiction: 'us' }],
  ['total_fund_value=-0 negative zero', { fund_type: 'sec_govt_mmf', total_fund_value: -0, daily_liquid_assets_pct: 50, weekly_liquid_assets_pct: 50, nav: 1.0, collateral_use: 'lender_collateral', platform: 'other', sftr_consent: true, reuse_flag: false, cp_jurisdiction: 'us' }],
  ['subnormal total_fund_value', { fund_type: 'sec_govt_mmf', total_fund_value: Number.MIN_VALUE, daily_liquid_assets_pct: 50, weekly_liquid_assets_pct: 50, nav: 1.0, collateral_use: 'lender_collateral', platform: 'other', sftr_consent: true, reuse_flag: false, cp_jurisdiction: 'us' }],
];

function checkP4_forced() {
  const rows = [];
  for (const [label, pp] of ULP_BOUNDARY_CASES) {
    const r = compute(pp).output_payload;
    const finite = Number.isFinite(r.adjusted_collateral_value) && Number.isFinite(r.haircut_applied);
    const haircutValid = r.haircut_applied === 0 || r.haircut_applied === 0.10;
    const valueInRange = r.adjusted_collateral_value >= -0.01 && r.adjusted_collateral_value <= Math.max(pp.total_fund_value, 0) + 0.01;
    rows.push({ label, eligibility: r.eligibility, haircut_applied: r.haircut_applied, adjusted_collateral_value: r.adjusted_collateral_value, finite, plausible: finite && haircutValid && valueInRange });
  }
  return rows;
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneValue());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_repoAlwaysIneligible());
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
