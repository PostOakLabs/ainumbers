// kernel_digest_at_authoring: sha256:7128ee0185f75fbe40c14da89571121926b7e634ea5764267e21766fe999983b
//
// FV-PROPFLOOR-SHARD-B2-1 — property-test floor for art-101-mica-art67-own-funds-calculator.
// Class B (bounded-numeric), FLOAT-SENSITIVE (fixed_overheads_annual/4 division, own_funds
// arithmetic) — ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero
// external dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the B1
// pilot harness. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-101-mica-art67-own-funds-calculator.proptest.mjs

import { compute } from '../art-101-mica-art67-own-funds-calculator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

// ---------- Step 2: independent fixture-oracle gate (MANDATORY before any property is trusted) ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-101-mica-art67-own-funds-calculator.fixtures.json');
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

// ---------- deterministic PRNG (mulberry32) ----------
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x1010A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const SERVICE_CLASSES = ['advisory', 'trading-platform', 'custody-exchange'];
const PERMANENT_MINIMUMS = { advisory: 50000, 'trading-platform': 125000, 'custody-exchange': 150000 };
const TRIALS = 10000;

// ---------- P1: monotone in own_funds_held (fixed service_class/overheads) ----------
function checkP1_monotoneOwnFundsHeld() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const service_class = pick(rand, SERVICE_CLASSES);
    const fixed_overheads_annual = randRange(rand, 0, 2_000_000);
    const own_funds_form = rand() < 0.5 ? 'cet1' : 'insurance';
    const h1 = randRange(rand, 0, 1_000_000);
    const h2 = h1 + randRange(rand, 0, 1_000_000); // h2 >= h1
    const r1 = compute({ inputs: { service_class, fixed_overheads_annual, own_funds_held: h1, own_funds_form } });
    const r2 = compute({ inputs: { service_class, fixed_overheads_annual, own_funds_held: h2, own_funds_form } });
    checked++;
    if (r2.output_payload.surplus_shortfall < r1.output_payload.surplus_shortfall - 1e-9) violations++;
  }
  return { name: 'P1_monotone_in_own_funds_held', trials: checked, violations };
}

// ---------- P2: boundedness — required_own_funds >= permanent_minimum, always >= 0 ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const service_class = pick(rand, SERVICE_CLASSES);
    const fixed_overheads_annual = randRange(rand, 0, 5_000_000);
    const own_funds_held = randRange(rand, -100000, 5_000_000);
    const own_funds_form = pick(rand, ['cet1', 'insurance', 'guarantee']);
    const r = compute({ inputs: { service_class, fixed_overheads_annual, own_funds_held, own_funds_form } });
    checked++;
    const { required_own_funds, permanent_minimum } = r.output_payload;
    if (required_own_funds < permanent_minimum - 1e-9) violations++;
    if (required_own_funds < 0) violations++;
    if (permanent_minimum !== PERMANENT_MINIMUMS[service_class]) violations++;
  }
  return { name: 'P2_boundedness_required_ge_permanent_minimum', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — binding_basis depends only on service_class + overheads ----------
function checkP3_bindingBasisAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const service_class = pick(rand, SERVICE_CLASSES);
    const fixed_overheads_annual = randRange(rand, 0, 3_000_000);
    const h1 = randRange(rand, 0, 2_000_000);
    const h2 = randRange(rand, 0, 2_000_000);
    const r1 = compute({ inputs: { service_class, fixed_overheads_annual, own_funds_held: h1, own_funds_form: 'cet1' } });
    const r2 = compute({ inputs: { service_class, fixed_overheads_annual, own_funds_held: h2, own_funds_form: 'insurance' } });
    checked++;
    if (r1.output_payload.binding_basis !== r2.output_payload.binding_basis) violations++;
    if (r1.output_payload.required_own_funds !== r2.output_payload.required_own_funds) violations++;
  }
  return { name: 'P3_binding_basis_agreement_depends_only_on_class_and_overheads', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  ['advisory', 0, 0, 'cet1', 'zero overheads, zero own_funds — required must equal permanent_minimum exactly'],
  ['advisory', -0, 0, 'cet1', 'negative-zero overheads — must behave as zero'],
  ['advisory', Number.MIN_VALUE, 0, 'cet1', 'smallest positive double overheads — quarter is subnormal, must not error'],
  ['advisory', 1e-300, 0, 'cet1', 'near-subnormal overheads'],
  ['advisory', 200000.02, 0, 'cet1', 'foh_quarter = 50000.005 — 1 ULP above permanent_minimum boundary (50000), must flip binding_basis'],
  ['advisory', 199999.98, 0, 'cet1', 'foh_quarter = 49999.995 — 1 ULP below permanent_minimum boundary, must stay permanent-minimum'],
  ['advisory', 200000, 50000, 'cet1', 'foh_quarter exactly equals permanent_minimum — tie goes to permanent-minimum (strict >)'],
  ['custody-exchange', Number.MAX_SAFE_INTEGER, 0, 'cet1', 'MAX_SAFE_INTEGER overheads — required must scale, x/y*y!==x division-rounding case'],
  ['trading-platform', 500000, 125000, 'cet1', 'own_funds_held equals required exactly — surplus_shortfall must be exactly 0, not epsilon-off'],
  ['advisory', 0, -0, 'cet1', 'negative-zero own_funds_held — surplus_shortfall must equal -required exactly'],
];

function checkP4_forced() {
  const rows = [];
  for (const [service_class, fixed_overheads_annual, own_funds_held, own_funds_form, label] of ULP_BOUNDARY_CASES) {
    const r = compute({ inputs: { service_class, fixed_overheads_annual, own_funds_held, own_funds_form } });
    const { required_own_funds, surplus_shortfall, binding_basis } = r.output_payload;
    const finite = Number.isFinite(required_own_funds) && Number.isFinite(surplus_shortfall);
    const plausible = finite && required_own_funds >= PERMANENT_MINIMUMS[service_class] - 1e-6 && ['permanent-minimum', 'fixed-overheads-quarter'].includes(binding_basis);
    rows.push({ label, service_class, fixed_overheads_annual, own_funds_held, required_own_funds, surplus_shortfall, binding_basis, finite, plausible });
  }
  return rows;
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneOwnFundsHeld());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_bindingBasisAgreement());
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
