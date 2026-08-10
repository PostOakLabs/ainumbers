// kernel_digest_at_authoring: sha256:7acd49f6f660a85da84398f65f694822d18b97e1241d8b3fc15fc177b11285a5
//
// FV-PROPFLOOR-SHARD-B1-1 — property-test floor for 508-repo-haircut-collateral-calculator.
// Class B (bounded-numeric), FLOAT-SENSITIVE (haircut arithmetic, notional scaling) — ULP-boundary
// forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies. Read-only
// w.r.t. the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/508-repo-haircut-collateral-calculator.proptest.mjs

import { compute } from '../508-repo-haircut-collateral-calculator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', '508-repo-haircut-collateral-calculator.fixtures.json');
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
const rand = mulberry32(0x508A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const COLLATERAL_TYPES = ['ust_10y', 'ust_30y', 'agency_mbs', 'ig_corp_bond', 'gilt_10y', 'eu_sovereign', 'unknown_type'];
const TENORS = ['overnight', 'open_term', '6m', '1m'];
const CP_TYPES = ['bank', 'hedge_fund', 'corporate'];
const TRIALS = 20000;

function randPP(rng) {
  return {
    collateral_type: pick(rng, COLLATERAL_TYPES),
    notional_usd: randRange(rng, 0, 500_000_000),
    tenor: pick(rng, TENORS),
    cross_border: rng() < 0.5,
    counterparty_type: pick(rng, CP_TYPES),
    canton247: rng() < 0.5,
    concentration_pct: randRange(rng, 0, 40),
  };
}

// ---------- P1: monotone in notional (initial_margin_usd scales with notional, all else fixed) ----------
function checkP1_monotoneMargin() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const base = randPP(rand);
    const n1 = randRange(rand, 0, 200_000_000);
    const n2 = n1 + randRange(rand, 0, 200_000_000);
    const r1 = compute({ ...base, notional_usd: n1 });
    const r2 = compute({ ...base, notional_usd: n2 });
    checked++;
    if (r2.output_payload.initial_margin_usd < r1.output_payload.initial_margin_usd - 0.01) violations++;
    if (r2.output_payload.vm_threshold_usd < r1.output_payload.vm_threshold_usd - 0.01) violations++;
  }
  return { name: 'P1_monotone_in_notional', trials: checked, violations };
}

// ---------- P2: boundedness — haircuts respect the d349 floor and stay non-negative ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    if (r.legacy_haircut_pct < r.d349_floor_pct - 1e-9) violations++;
    if (r.canton_haircut_pct < r.d349_floor_pct - 1e-9) violations++;
    // canton (excludes weekend gap) must never exceed legacy (includes it), after floor is applied.
    if (r.canton_haircut_pct > r.legacy_haircut_pct + 1e-9) violations++;
    if (r.initial_margin_usd < -0.01) violations++;
  }
  return { name: 'P2_boundedness_floor_and_canton_le_legacy', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — haircut_tier vs active_haircut_pct ----------
function expectedTier(h) { if (h <= 4) return 'teal'; if (h <= 6) return 'warn'; return 'red'; }
function checkP3_tierAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(randPP(rand)).output_payload;
    checked++;
    if (r.haircut_tier !== expectedTier(r.active_haircut_pct)) violations++;
  }
  return { name: 'P3_haircut_tier_threshold_agreement', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  ['notional=0', { collateral_type: 'ust_10y', notional_usd: 0, tenor: 'overnight', cross_border: false, counterparty_type: 'bank', canton247: false, concentration_pct: 0 }],
  ['notional=-0 negative zero', { collateral_type: 'ust_10y', notional_usd: -0, tenor: 'overnight', cross_border: false, counterparty_type: 'bank', canton247: false, concentration_pct: 0 }],
  ['notional=Number.MIN_VALUE', { collateral_type: 'ust_10y', notional_usd: Number.MIN_VALUE, tenor: 'overnight', cross_border: false, counterparty_type: 'bank', canton247: false, concentration_pct: 0 }],
  ['concentration_pct=20 exact — must NOT trigger the >20 surcharge', { collateral_type: 'ig_corp_bond', notional_usd: 1000000, tenor: 'overnight', cross_border: false, counterparty_type: 'bank', canton247: false, concentration_pct: 20 }],
  ['concentration_pct=20.00000000000001 — must trigger the surcharge (1 ULP over)', { collateral_type: 'ig_corp_bond', notional_usd: 1000000, tenor: 'overnight', cross_border: false, counterparty_type: 'bank', canton247: false, concentration_pct: 20.00000000000001 }],
  ['haircut_tier boundary: active=4 exact — teal', { collateral_type: 'ust_10y', notional_usd: 1000000, tenor: 'overnight', cross_border: false, counterparty_type: 'bank', canton247: true, concentration_pct: 0 }],
  ['haircut_tier boundary: active=4.000000000000001 — must flip to warn (1 ULP over 4)', { collateral_type: 'ust_10y', notional_usd: 1000000, tenor: 'overnight', cross_border: false, counterparty_type: 'bank', canton247: false, concentration_pct: 0 }],
  ['non-sovereign floor boundary: base 4 + no adj vs floor 2.0 — floor must not bind here', { collateral_type: 'ig_corp_bond', notional_usd: 1000000, tenor: 'overnight', cross_border: false, counterparty_type: 'bank', canton247: true, concentration_pct: 0 }],
];

function checkP4_forced() {
  const rows = [];
  for (const [label, pp] of ULP_BOUNDARY_CASES) {
    const r = compute(pp).output_payload;
    const finite = Number.isFinite(r.legacy_haircut_pct) && Number.isFinite(r.canton_haircut_pct) && Number.isFinite(r.initial_margin_usd);
    const tierAgrees = r.haircut_tier === expectedTier(r.active_haircut_pct);
    const floorHeld = r.legacy_haircut_pct >= r.d349_floor_pct - 1e-9 && r.canton_haircut_pct >= r.d349_floor_pct - 1e-9;
    rows.push({ label, active_haircut_pct: r.active_haircut_pct, haircut_tier: r.haircut_tier, d349_floor_pct: r.d349_floor_pct, finite, tier_agrees: tierAgrees, floor_held: floorHeld, plausible: finite && tierAgrees && floorHeld });
  }
  return rows;
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneMargin());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_tierAgreement());
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
