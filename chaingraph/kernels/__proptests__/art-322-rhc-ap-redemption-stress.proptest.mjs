// art-322-rhc-ap-redemption-stress.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C11-1).
// kernel_digest_at_authoring: sha256:043b1b5c17986181cd446d5ffa5594209cc4cf4e29416c72e3a47a436160ea2d
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — daily_volume_usd < 100000 is a fixed integer
// threshold comparison, no ULP-sensitive claim; the rest is boolean/enum logic).
// Checks: fixture-oracle gate, termination (ap_count bounded by authorised_participants.length),
// differential re-derivation of concentration_risk from ap_count, boundedness
// (structural_dependencies length fixed <=4, always contains the issuer_credit_exposure entry),
// forced categorical boundary case at the liquidity_flag 100000 threshold, and metamorphic
// permutation-invariance of authorised_participants order.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-322-rhc-ap-redemption-stress.proptest.mjs

import { compute } from '../art-322-rhc-ap-redemption-stress.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-322-rhc-ap-redemption-stress.fixtures.json');
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
const rand = mulberry32(0x322B0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomAPs(rng, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ name: `AP${i}`, active: rng() < 0.6 });
  return out;
}

function randomPP(rng) {
  const n = Math.floor(rng() * 8);
  return {
    authorised_participants: randomAPs(rng, n),
    secondary_market_depth: { daily_volume_usd: pick(rng, [0, 50000, 99999, 100000, 100001, 500000]), bid_ask_spread_bps: 5 },
    issuer_credit: { obligor: 'RHJ', rating_available: rng() < 0.5 },
  };
}

const TRIALS = 5000;

// ---------- P1: termination — ap_count bounded by authorised_participants.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.ap_count > pp.authorised_participants.length) violations++;
    const expected = pp.authorised_participants.filter((ap) => ap.active === true).length;
    if (output_payload.ap_count !== expected) violations++;
  }
  return { name: 'P1_termination_ap_count_bounded_exact', trials: checked, violations };
}

// ---------- P2 (differential): concentration_risk tier re-derivation ----------
function checkP2_concentration_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    let expected;
    if (output_payload.ap_count <= 1) expected = 'SINGLE_AP_CONCENTRATION';
    else if (output_payload.ap_count <= 3) expected = 'ELEVATED';
    else expected = 'DIVERSIFIED';
    if (output_payload.concentration_risk !== expected) violations++;
  }
  return { name: 'P2_concentration_risk_differential', trials: checked, violations };
}

// ---------- P3: boundedness — structural_dependencies bounded <=4, always contains the issuer entry ----------
function checkP3_structural_deps_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.structural_dependencies.length > 4) violations++;
    const hasIssuerEntry = output_payload.structural_dependencies.some((s) => s.startsWith('issuer_credit_exposure_to_'));
    if (!hasIssuerEntry) violations++;
  }
  return { name: 'P3_structural_dependencies_bounded', trials: checked, violations };
}

// ---------- P4: forced categorical boundary — liquidity_flag threshold at 100000 ----------
function checkP4_liquidity_threshold_forced() {
  let violations = 0, checked = 0;
  const cases = [
    { vol: 99999, expect: 'THIN' },
    { vol: 100000, expect: 'ADEQUATE' },
    { vol: 100001, expect: 'ADEQUATE' },
    { vol: 0, expect: 'THIN' },
  ];
  for (const c of cases) {
    const pp = { authorised_participants: [{ name: 'AP1', active: true }], secondary_market_depth: { daily_volume_usd: c.vol }, issuer_credit: {} };
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.liquidity_flag !== c.expect) violations++;
  }
  return { name: 'P4_liquidity_flag_threshold_forced', trials: checked, violations };
}

// ---------- P5: metamorphic — permutation-invariance of authorised_participants order ----------
function checkP5_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    const shuffled = [...pp.authorised_participants];
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    const r1 = compute(pp).output_payload;
    const r2 = compute({ ...pp, authorised_participants: shuffled }).output_payload;
    checked++;
    if (r1.ap_count !== r2.ap_count) violations++;
    if (r1.concentration_risk !== r2.concentration_risk) violations++;
  }
  return { name: 'P5_permutation_invariance_ap_order', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_concentration_differential());
results.properties.push(checkP3_structural_deps_bounded());
results.properties.push(checkP4_liquidity_threshold_forced());
results.properties.push(checkP5_permutation_invariance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-322-rhc-ap-redemption-stress',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
