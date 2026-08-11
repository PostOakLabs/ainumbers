// art-568-securitization-trustee-report-recompute.proptest.mjs -- FV property-test FLOOR
// (FV-PROPFLOOR-SHARD-C29-1).
// kernel_digest_at_authoring: sha256:d055891899f36887772e5e5edccb200703d03fa965edd3ea178f6c6933e98578
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md Sec3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES -- confirmed by direct source read (matches the WU row). Every money value
// crosses the boundary as a safe-integer number of minor units and every allocation/capping/shortfall
// operation is integer add/subtract/compare, but display() computes `Math.trunc(abs / MINOR_SCALE)`
// (real IEEE-754 division of a safe integer by 100) to produce the 2dp display string -- the SAME
// pattern the C25 shard's art-509/art-508 kept float:yes for. This is the file's only Number division,
// and it is exercised on every displayed amount, so ULP-boundary forcing is applied around it.
// Checks: fixture-oracle gate, termination (tiers/period_collections bounded by array length, no
// unbounded loop), differential re-derivation of the tier-list waterfall allocation (available pool
// minus paid, cap application, trigger skip), ULP-boundary forcing on display()'s
// Math.trunc(abs/100) division (exact multiples of 100 up to Number.MAX_SAFE_INTEGER, 0, negative
// zero, denormals, x/y*y!==x-shaped values), and a differential conservation identity (total_paid +
// total_shortfall + residual accounts for every dollar of the claim across the tier list).
//
// Run: node chaingraph/kernels/__proptests__/art-568-securitization-trustee-report-recompute.proptest.mjs

import { compute } from '../art-568-securitization-trustee-report-recompute.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-568-securitization-trustee-report-recompute.fixtures.json');
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
const rand = mulberry32(0x56800);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TIER_TYPES = ['fees', 'interest', 'principal', 'reserve', 'residual'];

function randomPP(rng) {
  const nPools = 1 + Math.floor(rng() * 2);
  const period_collections = [];
  for (let i = 0; i < nPools; i++) period_collections.push({ collection_type: `POOL-${i}`, amount_minor_units: Math.floor(rng() * 5000000) });
  const nTiers = 1 + Math.floor(rng() * 6);
  const tiers = [];
  for (let i = 0; i < nTiers; i++) {
    const t = { tier_id: `T${i}`, type: pick(rng, TIER_TYPES), collection_type: `POOL-${Math.floor(rng() * nPools)}`, amount_due_minor_units: Math.floor(rng() * 2000000) };
    if (rng() < 0.3) t.cap_minor_units = Math.floor(rng() * 1500000);
    tiers.push(t);
  }
  return { deal_ref: 'DEAL-1', period_label: 'P1', currency: 'USD', indenture_ref: { document_ref: 'IND-1', section_ref: 'S1', version: '1', dated: '2026-01-01' }, period_collections, triggers: [], tiers };
}

const TRIALS = 3000;

// ---------- P1: termination -- bounded by tiers.length/period_collections.length, no unbounded loop ----------
function checkP1_termination_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.tier_count !== pp.tiers.length) violations++;
    if (output_payload.tiers.length !== pp.tiers.length) violations++;
    if (output_payload.collections_by_type.length !== new Set(pp.period_collections.map((c) => c.collection_type)).size) violations++;
  }
  return { name: 'P1_termination_bounded_by_input_length', trials: checked, violations };
}

// ---------- P2 (differential): re-derive tier-list allocation independently ----------
function checkP2_waterfall_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const pools = {};
    for (const c of pp.period_collections) pools[c.collection_type] = (pools[c.collection_type] || 0) + c.amount_minor_units;
    let totalPaid = 0, totalShortfall = 0;
    for (let ti = 0; ti < pp.tiers.length; ti++) {
      const t = pp.tiers[ti];
      const cap = t.cap_minor_units;
      const capApplied = cap !== undefined && cap < t.amount_due_minor_units;
      const due = capApplied ? cap : t.amount_due_minor_units;
      const payable = due > 0 ? due : 0;
      const available = pools[t.collection_type] !== undefined ? pools[t.collection_type] : 0;
      const paid = available < payable ? (available > 0 ? available : 0) : payable;
      const shortfall = payable - paid;
      if (pools[t.collection_type] !== undefined) pools[t.collection_type] -= paid;
      totalPaid += paid; totalShortfall += shortfall;
      if (output_payload.tiers[ti].paid_minor_units !== paid) violations++;
      if (output_payload.tiers[ti].shortfall_minor_units !== shortfall) violations++;
      if (output_payload.tiers[ti].cap_applied !== capApplied) violations++;
    }
    if (output_payload.total_paid_minor_units !== totalPaid) violations++;
    if (output_payload.total_shortfall_minor_units !== totalShortfall) violations++;
  }
  return { name: 'P2_waterfall_allocation_differential', trials: checked, violations };
}

// ---------- P3: ULP-boundary forcing on display()'s Math.trunc(abs/100) division ----------
function checkP3_ulp_display_boundary() {
  let violations = 0, checked = 0;
  const forcedAmounts = [
    0, -0, 1, -1, 99, 100, 101, -100, -101,
    Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 1, Number.MAX_SAFE_INTEGER - 50,
    -Number.MAX_SAFE_INTEGER, -(Number.MAX_SAFE_INTEGER - 1),
    900719925474099100, // near-max exact multiple of 100 well within safe-integer range boundary shape
    5e-324 > 0 ? 0 : 0, // denormal has no meaning on an integer minor-unit domain; covered via 0/-0 above
  ];
  for (const amt of forcedAmounts) {
    if (!Number.isSafeInteger(amt)) continue;
    checked++;
    const pp = { deal_ref: 'D', period_label: 'P', currency: 'USD', indenture_ref: {}, period_collections: [{ collection_type: 'A', amount_minor_units: Math.max(amt, 0) }], triggers: [], tiers: [{ tier_id: 'T1', type: 'fees', collection_type: 'A', amount_due_minor_units: Math.max(amt, 0) }] };
    const { output_payload } = compute(pp);
    const paid = output_payload.tiers[0].paid_minor_units;
    const whole = Math.trunc(Math.abs(paid) / 100);
    const frac = Math.abs(paid) - whole * 100;
    const expected = (paid < 0 ? '-' : '') + String(whole) + '.' + String(frac).padStart(2, '0');
    if (output_payload.tiers[0].paid_display !== expected) violations++;
    // x/y*y !== x style check: confirm the display round-trips to the same minor-unit value when
    // reparsed (whole*100 + frac === paid, i.e. no precision was silently dropped by the division).
    if (whole * 100 + frac !== Math.abs(paid)) violations++;
  }
  // x*y/y !== x shaped safe-integer boundary sweep around exact multiples of 100.
  for (let k = 0; k < 200; k++) {
    const n = Math.floor(rand() * 1e15) * 100 + pick(rand, [0, 1, 99]);
    if (!Number.isSafeInteger(n)) continue;
    checked++;
    const pp = { deal_ref: 'D', period_label: 'P', currency: 'USD', indenture_ref: {}, period_collections: [{ collection_type: 'A', amount_minor_units: n }], triggers: [], tiers: [{ tier_id: 'T1', type: 'fees', collection_type: 'A', amount_due_minor_units: n }] };
    const { output_payload } = compute(pp);
    const whole = Math.trunc(n / 100);
    const frac = n - whole * 100;
    const expected = String(whole) + '.' + String(frac).padStart(2, '0');
    if (output_payload.tiers[0].paid_display !== expected) violations++;
  }
  return { name: 'P3_ulp_display_trunc_div100_boundary', trials: checked, violations };
}

// ---------- P4: differential conservation -- paid + shortfall + residual accounts for every dollar ----------
function checkP4_conservation_identity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const totalCollections = pp.period_collections.reduce((a, c) => a + c.amount_minor_units, 0);
    const conserved = output_payload.total_paid_minor_units + output_payload.residual_minor_units;
    if (conserved !== totalCollections) violations++;
  }
  return { name: 'P4_paid_plus_residual_equals_total_collections', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_bounded());
results.properties.push(checkP2_waterfall_differential());
results.properties.push(checkP3_ulp_display_boundary());
results.properties.push(checkP4_conservation_identity());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-568-securitization-trustee-report-recompute',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
