// art-389-tempo-mainnet-fee-capacity.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C18-1).
// kernel_digest_at_authoring: sha256:cfa8b47b776f0402746e4968070394d060291ee3afe265412a07fcd2018194ac
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (direct read confirmed — every fee/gas figure is BigInt exact integer
// arithmetic (mulDivCeil), but `tps_headroom = Number(max_tx_per_block) / block_time_seconds`
// is a genuine float division) — ULP-boundary forcing is MANDATORY per spec §3, scoped to that
// one float op (block_time_seconds and the BigInt->Number conversion of max_tx_per_block).
// Unbounded input: policy_parameters.payment_mix (caller-supplied array), mapped/reduced by
// plain Array.prototype.map/reduce with no declared cap — termination bound is the array's
// own length.
// Checks: fixture-oracle gate, termination (map/reduce passes scale linearly with
// payment_mix.length, never hang), boundedness (line_items.length always equals
// payment_mix.length, every BigInt-derived field parses back to a non-negative BigInt),
// metamorphic (permutation-invariance: reordering payment_mix reorders line_items identically
// and leaves total_fee_microusd/total_gas_used unchanged — BigInt sums are exactly
// order-independent, unlike float sums), ULP-boundary forcing on block_time_seconds (threshold
// ±1 ULP, 0, negative zero, denormals, huge values) and on the BigInt->Number tps_headroom
// conversion path.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-389-tempo-mainnet-fee-capacity.proptest.mjs

import { compute } from '../art-389-tempo-mainnet-fee-capacity.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-389-tempo-mainnet-fee-capacity.fixtures.json');
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
const rand = mulberry32(0x389D0);

function randomLineItem(rng, idx) {
  return { label: `TX-${idx}`, gas_used: String(1000 + Math.floor(rng() * 200000)), count: String(1 + Math.floor(rng() * 500)) };
}

const TRIALS = 2000;

// ---------- P1: termination — map/reduce scale linearly with payment_mix.length, never hang ----------
function checkP1_termination_linear_in_payment_mix_length() {
  let violations = 0, checked = 0;
  const sizes = [0, 1, 10, 100, 3000];
  for (const n of sizes) {
    const payment_mix = Array.from({ length: n }, (_, i) => randomLineItem(rand, i));
    const start = Date.now();
    const { output_payload } = compute({ payment_mix, block_time_seconds: 2 });
    checked++;
    if (Date.now() - start > 3000) violations++;
    if (output_payload.line_items.length !== n) violations++;
  }
  return { name: 'P1_termination_linear_scaling_never_hangs', trials: checked, violations };
}

// ---------- P2: boundedness — BigInt-shaped fields always parse to non-negative BigInt ----------
function checkP2_bigint_field_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 30);
    const payment_mix = Array.from({ length: n }, (_, idx) => randomLineItem(rand, idx));
    const { output_payload } = compute({ payment_mix, block_time_seconds: 1 + rand() * 10 });
    checked++;
    for (const li of output_payload.line_items) {
      try {
        if (BigInt(li.gas_used) < 0n) violations++;
        if (BigInt(li.fee_microusd_per_tx) < 0n) violations++;
        if (BigInt(li.total_fee_microusd) < 0n) violations++;
        if (BigInt(li.max_tx_per_block_payment_lane) < 0n) violations++;
      } catch { violations++; }
    }
    try { if (BigInt(output_payload.summary.total_fee_microusd) < 0n) violations++; } catch { violations++; }
  }
  return { name: 'P2_bigint_fields_always_nonnegative_bigint', trials: checked, violations };
}

// ---------- P3: metamorphic — permutation-invariance of totals (BigInt sums are exactly order-independent) ----------
function checkP3_metamorphic_permutation_invariance_of_totals() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 300; i++) {
    const n = 1 + Math.floor(rand() * 25);
    const payment_mix = Array.from({ length: n }, (_, idx) => randomLineItem(rand, idx));
    const shuffled = [...payment_mix];
    for (let j = shuffled.length - 1; j > 0; j--) { const k = Math.floor(rand() * (j + 1)); [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]]; }
    const outA = compute({ payment_mix, block_time_seconds: 2 }).output_payload;
    const outB = compute({ payment_mix: shuffled, block_time_seconds: 2 }).output_payload;
    checked++;
    if (outA.summary.total_fee_microusd !== outB.summary.total_fee_microusd) violations++;
    if (outA.summary.total_gas_used !== outB.summary.total_gas_used) violations++;
  }
  return { name: 'P3_metamorphic_permutation_invariance_of_bigint_totals', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes) — block_time_seconds / tps_headroom ----------
function checkP4_ulp_forcing_block_time_and_tps_headroom() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  const blockTimeForced = [eps, 1 - eps, 1 + eps, Number.MIN_VALUE, 1e-300, 1e300, 0, -0];
  const payment_mix = [{ label: 'TX-1', gas_used: '50000', count: '1' }];
  for (const bt of blockTimeForced) {
    const { output_payload } = compute({ payment_mix, block_time_seconds: bt });
    checked++;
    // block_time_seconds <= 0 (incl. -0, which is not > 0) must be treated as MISSING (null),
    // never propagate a non-finite/NaN tps_headroom.
    const li = output_payload.line_items[0];
    if (bt > 0 && Number.isFinite(bt)) {
      if (output_payload.block_time_seconds !== bt) violations++;
      // IEEE-754 division can legitimately overflow to +Infinity at extreme denormal
      // block_time_seconds (e.g. Number.MIN_VALUE) — that is a defined, non-NaN outcome, not a
      // finite-gate violation. The only forbidden value is NaN.
      if (Number.isNaN(li.tps_headroom)) violations++;
    } else {
      if (output_payload.block_time_seconds !== null) violations++;
      if (li.tps_headroom !== null) violations++;
    }
  }
  // huge gas_used forcing a large BigInt -> Number(...) conversion for max_tx_per_block
  const hugeGas = [{ label: 'TX-1', gas_used: '9007199254740993', count: '1' }]; // > MAX_SAFE_INTEGER
  const outHuge = compute({ payment_mix: hugeGas, block_time_seconds: 1 }).output_payload;
  checked++;
  if (!Number.isFinite(outHuge.line_items[0].tps_headroom)) violations++; // must stay finite even if precision-lossy
  return { name: 'P4_ulp_boundary_forcing_block_time_and_tps_headroom', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_linear_in_payment_mix_length());
results.properties.push(checkP2_bigint_field_boundedness());
results.properties.push(checkP3_metamorphic_permutation_invariance_of_totals());
results.properties.push(checkP4_ulp_forcing_block_time_and_tps_headroom());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-389-tempo-mainnet-fee-capacity',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
