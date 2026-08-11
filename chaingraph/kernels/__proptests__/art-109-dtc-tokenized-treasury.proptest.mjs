// art-109-dtc-tokenized-treasury.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C2-1).
// kernel_digest_at_authoring: sha256:1064b510a277f498468a1e9a05d051d01137cda668f04abae974c0db753376fc
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (categorical/string checks only — no numeric thresholds).
// Checks: fixture-oracle gate, termination (daml_lifecycle_gaps bounded by the 3 required events),
// verdict differential re-derivation, boundedness (gaps subset of the known required-events list), and
// permutation-invariance of the lifecycle_events array (Set-based lookup).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-109-dtc-tokenized-treasury.proptest.mjs

import { compute } from '../art-109-dtc-tokenized-treasury.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

const REQUIRED_LIFECYCLE_EVENTS = ['issuance', 'corporate_actions', 'redemption'];
const CUSIP_CLASS_DTC_ELIGIBLE = ['US-TREASURY', 'UST', 'T-BILL', 'T-NOTE', 'T-BOND'];

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-109-dtc-tokenized-treasury.fixtures.json');
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
const rand = mulberry32(0xA09A1);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function randomConfig(rng) {
  const events = shuffle(rng, REQUIRED_LIFECYCLE_EVENTS.slice()).slice(0, Math.floor(rng() * 4));
  return {
    tokenized_ust_config: {
      cusip_class: pick(rng, [...CUSIP_CLASS_DTC_ELIGIBLE, 'CORP-BOND', 'MUNI']),
      dtc_custody_ref: rng() < 0.7 ? 'DTC-123' : (rng() < 0.5 ? 'none' : ''),
      fed_eligible: rng() < 0.5,
      composerx_daml_template: rng() < 0.6 ? 'composerx:ust-lifecycle-v1' : 'other-template',
      lifecycle_events: events,
      collateral_reuse_policy: pick(rng, ['allowed', 'conditional', 'none', 'disallowed']),
    },
  };
}

const TRIALS = 5000;

// ---------- P1: termination — daml_lifecycle_gaps bounded by the 3 required events ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomConfig(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.daml_lifecycle_gaps.length < 0 || output_payload.daml_lifecycle_gaps.length > REQUIRED_LIFECYCLE_EVENTS.length) violations++;
  }
  return { name: 'P1_termination_bounded_gaps', trials: checked, violations };
}

// ---------- P2 (differential): verdict re-derivation from the four booleans ----------
function checkP2_verdict_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomConfig(rand);
    const { output_payload } = compute(pp);
    checked++;
    const allOk = output_payload.custody_link_ok && output_payload.fed_eligible && output_payload.daml_lifecycle_gaps.length === 0 && output_payload.daml_template_ok && output_payload.dvp_ready;
    const expected = allOk ? 'ISSUANCE_READY' : 'GAPS_FOUND';
    if (output_payload.verdict !== expected) violations++;
    const dvpExpected = output_payload.custody_link_ok && output_payload.fed_eligible;
    if (output_payload.dvp_ready !== dvpExpected) violations++;
  }
  return { name: 'P2_verdict_differential', trials: checked, violations };
}

// ---------- P3: boundedness — every reported gap is one of the 3 known required lifecycle events ----------
function checkP3_gaps_subset() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomConfig(rand);
    const { output_payload } = compute(pp);
    checked++;
    for (const g of output_payload.daml_lifecycle_gaps) {
      if (!REQUIRED_LIFECYCLE_EVENTS.includes(g)) violations++;
    }
  }
  return { name: 'P3_gaps_subset_of_known_events', trials: checked, violations };
}

// ---------- P4: metamorphic — permutation-invariance of lifecycle_events order (Set-based lookup) ----------
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomConfig(rand);
    const shuffled = { tokenized_ust_config: { ...pp.tokenized_ust_config, lifecycle_events: shuffle(rand, pp.tokenized_ust_config.lifecycle_events) } };
    const r1 = compute(pp).output_payload;
    const r2 = compute(shuffled).output_payload;
    checked++;
    if (r1.verdict !== r2.verdict) violations++;
    if (JSON.stringify(r1.daml_lifecycle_gaps.slice().sort()) !== JSON.stringify(r2.daml_lifecycle_gaps.slice().sort())) violations++;
  }
  return { name: 'P4_permutation_invariance_lifecycle_events', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_verdict_differential());
results.properties.push(checkP3_gaps_subset());
results.properties.push(checkP4_permutation_invariance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-109-dtc-tokenized-treasury',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
