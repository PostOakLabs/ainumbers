// art-111-arc-corridor-jurisdiction-router.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C2-1).
// kernel_digest_at_authoring: sha256:71061d2cb76db82787091a1621aabb6fdba5b88d31db5d6b378f9ea1b5826f72
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (categorical regime-table lookup + string matching only, per WU row's declared
// exception).
// Checks: fixture-oracle gate, termination (leg_regimes.length === corridor_legs.length), verdict
// differential re-derivation, boundedness (severity of a known-ccy gap is never HIGH), and permutation-
// invariance of the corridor_legs array over aggregate gap counts.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-111-arc-corridor-jurisdiction-router.proptest.mjs

import { compute } from '../art-111-arc-corridor-jurisdiction-router.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

const KNOWN_CCYS = ['EURC', 'JPYC', 'BRLA', 'MXNB', 'AUDF', 'PHPC', 'QCAD', 'ZARU', 'USDC', 'USDT'];

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-111-arc-corridor-jurisdiction-router.fixtures.json');
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
const rand = mulberry32(0xA11A2);
function randInt(rng, lo, hi) { return Math.floor(lo + rng() * (hi - lo + 1)); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const DISCLOSURE_POOL = ['reserve_attestation_monthly', 'MiCA_Art21', 'AML_program', 'PSA_registration', 'reserve_attestation'];
function randomLeg(rng) {
  const ccy = rng() < 0.85 ? pick(rng, KNOWN_CCYS) : 'UNKNOWNCOIN';
  const nDisc = Math.floor(rng() * (DISCLOSURE_POOL.length + 1));
  return {
    ccy_pair: `USD/${ccy}`,
    partner_stablecoin: ccy,
    notional: randInt(rng, 0, 1_000_000),
    disclosures_provided: shuffle(rng, DISCLOSURE_POOL.slice()).slice(0, nDisc),
  };
}

const TRIALS = 4000;

// ---------- P1: termination — leg_regimes.length === corridor_legs.length, always ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = randInt(rand, 0, 20);
    const corridor_legs = Array.from({ length: n }, () => randomLeg(rand));
    const { output_payload } = compute({ corridor_legs });
    checked++;
    if (output_payload.leg_regimes.length !== n) violations++;
  }
  return { name: 'P1_termination_leg_count', trials: checked, violations };
}

// ---------- P2 (differential): all_mapped / verdict re-derivation ----------
function checkP2_verdict_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = randInt(rand, 1, 10);
    const corridor_legs = Array.from({ length: n }, () => randomLeg(rand));
    const { output_payload, compliance_flags } = compute({ corridor_legs });
    checked++;
    const allMapped = !output_payload.leg_regimes.some((l) => l.regime === 'UNKNOWN');
    const highGaps = output_payload.disclosure_gaps.filter((g) => g.severity === 'HIGH');
    const expectedVerdict = allMapped && highGaps.length === 0 ? 'ROUTING_COMPLETE' : 'ROUTING_GAPS';
    if (output_payload.verdict !== expectedVerdict) violations++;
    if (allMapped && !compliance_flags.includes('ALL_REGIMES_MAPPED')) violations++;
    if (!allMapped && !compliance_flags.includes('UNMAPPED_REGIMES')) violations++;
  }
  return { name: 'P2_verdict_differential', trials: checked, violations };
}

// ---------- P3: boundedness — a known-ccy leg never produces a HIGH-severity gap (only NO_REGIME_MAPPED is HIGH) ----------
function checkP3_known_ccy_no_high_gap() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const leg = { ccy_pair: 'USD/EURC', partner_stablecoin: pick(rand, KNOWN_CCYS), notional: randInt(rand, 0, 500000), disclosures_provided: shuffle(rand, DISCLOSURE_POOL.slice()).slice(0, Math.floor(rand() * 3)) };
    const { output_payload } = compute({ corridor_legs: [leg] });
    checked++;
    if (output_payload.disclosure_gaps.some((g) => g.severity === 'HIGH')) violations++;
    if (output_payload.leg_regimes[0].regime === 'UNKNOWN') violations++;
  }
  return { name: 'P3_known_ccy_never_high_severity', trials: checked, violations };
}

// ---------- P4: metamorphic — permutation-invariance of corridor_legs over aggregate gap/mapping counts ----------
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const n = randInt(rand, 2, 10);
    const corridor_legs = Array.from({ length: n }, () => randomLeg(rand));
    const r1 = compute({ corridor_legs }).output_payload;
    const r2 = compute({ corridor_legs: shuffle(rand, corridor_legs) }).output_payload;
    checked++;
    if (r1.verdict !== r2.verdict) violations++;
    if (r1.disclosure_gaps.length !== r2.disclosure_gaps.length) violations++;
    if (r1.leg_regimes.length !== r2.leg_regimes.length) violations++;
  }
  return { name: 'P4_permutation_invariance_legs', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_verdict_differential());
results.properties.push(checkP3_known_ccy_no_high_gap());
results.properties.push(checkP4_permutation_invariance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-111-arc-corridor-jurisdiction-router',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
