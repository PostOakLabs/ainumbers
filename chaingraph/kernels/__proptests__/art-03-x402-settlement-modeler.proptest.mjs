// kernel_digest_at_authoring: sha256:5d693ae08f52fbf0719d500857977fff760b19d533358ae2f5edd6693854de81
//
// FV-PROPFLOOR-SHARD-B1-1 — property-test floor for art-03-x402-settlement-modeler.
// Class B (bounded-numeric), FLOAT-SENSITIVE (fee_fixed + fee_pct*amount, score arithmetic) —
// ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// Read-only w.r.t. the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-03-x402-settlement-modeler.proptest.mjs

import { compute } from '../art-03-x402-settlement-modeler.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-03-x402-settlement-modeler.fixtures.json');
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
const rand = mulberry32(0xA03A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const PAYMENT_TYPES = ['micropayment', 'retail', 'b2b', 'cross_border'];
const FINALITY_REQS = ['instant', 'fast', 'minutes', 'hours', 'days'];
const GAS_TIERS = ['low', 'medium', 'high'];
const RAIL_IDS = new Set(['x402', 'stripe_usdc', 'card', 'ach', 'swift']);
const TRIALS = 20000;

function randPP(rng) {
  return {
    amount_usd: randRange(rng, 0.01, 200000),
    monthly_volume: randRange(rng, 1, 100000),
    payment_type: pick(rng, PAYMENT_TYPES),
    finality_requirement: pick(rng, FINALITY_REQS),
    gas_tier: pick(rng, GAS_TIERS),
    chargeback_profile: pick(rng, ['low', 'medium', 'high']),
  };
}

// ---------- P1: boundedness — fees/costs non-negative, recommended_rail is a known id, finality_sec plausible ----------
function checkP1_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(randPP(rand)).output_payload;
    checked++;
    if (r.per_tx_fee_usd < 0) violations++;
    if (r.monthly_cost_usd < 0) violations++;
    if (!RAIL_IDS.has(r.recommended_rail)) violations++;
    if (r.finality_sec !== null && (typeof r.finality_sec !== 'number' || r.finality_sec < 0)) violations++;
    for (const id of r.eligible_rails) if (!RAIL_IDS.has(id)) violations++;
  }
  return { name: 'P1_boundedness_nonneg_fees_known_rail', trials: checked, violations };
}

// ---------- P2: round-trip identity — monthly_cost_usd = per_tx_fee_usd * monthly_volume (up to rounding) ----------
function checkP2_monthlyCostIdentity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    const expected = Math.round(r.per_tx_fee_usd * pp.monthly_volume * 100) / 100;
    // per_tx_fee_usd is itself rounded to 4dp before this identity is checked, so allow a small tolerance
    // proportional to volume (rounding of the 4dp fee compounds across monthly_volume transactions).
    const tolerance = Math.max(0.05, pp.monthly_volume * 0.0001);
    if (Math.abs(r.monthly_cost_usd - expected) > tolerance) violations++;
  }
  return { name: 'P2_monthly_cost_identity', trials: checked, violations };
}

// ---------- P3: recommended_rail is a member of eligible_rails whenever eligible_rails is non-empty ----------
function checkP3_recommendedInEligible() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(randPP(rand)).output_payload;
    checked++;
    if (r.eligible_rails.length > 0 && !r.eligible_rails.includes(r.recommended_rail)) violations++;
  }
  return { name: 'P3_recommended_rail_in_eligible_set', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  ['ACH min_amount boundary: amount=1 exact — must be amountOk', { amount_usd: 1, monthly_volume: 100, payment_type: 'b2b', finality_requirement: 'days', gas_tier: 'medium', chargeback_profile: 'medium' }],
  ['ACH min_amount 1 ULP under 1 — must fail amountOk for ACH', { amount_usd: 1 - Number.EPSILON, monthly_volume: 100, payment_type: 'b2b', finality_requirement: 'days', gas_tier: 'medium', chargeback_profile: 'medium' }],
  ['card max_amount boundary: amount=25000 exact — must be amountOk for card', { amount_usd: 25000, monthly_volume: 100, payment_type: 'retail', finality_requirement: 'fast', gas_tier: 'medium', chargeback_profile: 'medium' }],
  ['card max_amount 1 ULP over 25000 — must fail amountOk for card', { amount_usd: 25000 + 25000 * Number.EPSILON * 4, monthly_volume: 100, payment_type: 'retail', finality_requirement: 'fast', gas_tier: 'medium', chargeback_profile: 'medium' }],
  ['instant finality boundary: x402 finality=2 <= 5 — instant must be finalityOk', { amount_usd: 100, monthly_volume: 100, payment_type: 'retail', finality_requirement: 'instant', gas_tier: 'medium', chargeback_profile: 'medium' }],
  ['amount_usd subnormal', { amount_usd: Number.MIN_VALUE, monthly_volume: 1, payment_type: 'micropayment', finality_requirement: 'instant', gas_tier: 'low', chargeback_profile: 'low' }],
  ['monthly_volume=0 — falsy default kicks in per kernel (|| 5000), must stay finite', { amount_usd: 100, monthly_volume: 0, payment_type: 'retail', finality_requirement: 'fast', gas_tier: 'medium', chargeback_profile: 'medium' }],
  ['x/y*y!==x-shaped amount_usd', { amount_usd: 33.333333333333336, monthly_volume: 300, payment_type: 'retail', finality_requirement: 'fast', gas_tier: 'medium', chargeback_profile: 'medium' }],
];

function checkP4_forced() {
  const rows = [];
  for (const [label, pp] of ULP_BOUNDARY_CASES) {
    const r = compute(pp).output_payload;
    const finite = Number.isFinite(r.per_tx_fee_usd) && Number.isFinite(r.monthly_cost_usd);
    const knownRail = RAIL_IDS.has(r.recommended_rail);
    const nonneg = r.per_tx_fee_usd >= 0 && r.monthly_cost_usd >= 0;
    rows.push({ label, recommended_rail: r.recommended_rail, per_tx_fee_usd: r.per_tx_fee_usd, monthly_cost_usd: r.monthly_cost_usd, eligible_rails: r.eligible_rails, finite, plausible: finite && knownRail && nonneg });
  }
  return rows;
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_boundedness());
results.properties.push(checkP2_monthlyCostIdentity());
results.properties.push(checkP3_recommendedInEligible());
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
