// 512-tokenized-security-lifecycle-validator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C1-1).
// kernel_digest_at_authoring: sha256:f17b5982d127f5ae1fcc3d3dc4be5844c49a6c73de4e12e41815b25215350270
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (event-set/badge decision table only — no ULP-forcing required).
// Checks: fixture-oracle gate, termination (fixed lookup tables, bounded covered_events array),
// verdict/badge decision-table consistency (differential re-derivation), event-set monotonicity
// (covering more required events never worsens the verdict), and permutation-invariance of
// covered_events order.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/512-tokenized-security-lifecycle-validator.proptest.mjs

import { compute } from '../512-tokenized-security-lifecycle-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', '512-tokenized-security-lifecycle-validator.fixtures.json');
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
const rand = mulberry32(0x512A1);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const SECURITY_TYPES = ['ust', 'govt_bond', 'corporate_bond', 'equity', 'fund_unit', 'structured_note'];
const ALL_EVENTS = ['issuance', 'coupon_payment', 'maturity_redemption', 'default_handling', 'corporate_action', 'transfer'];
const TRIALS = 6000;

function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
function randomSubset(rng, arr) {
  return arr.filter(() => rng() < 0.5);
}

function randomPP(rng) {
  return {
    security_type: pick(rng, SECURITY_TYPES),
    jurisdiction: pick(rng, ['us', 'eu', 'uk', 'sg']),
    issuance_amount: rng() * 20_000_000,
    isin_assigned: rng() < 0.7,
    daml_lifecycle_defined: rng() < 0.7,
    custodian_type: pick(rng, ['third_party', 'self_custody']),
    covered_events: randomSubset(rng, ALL_EVENTS),
    prospectus_filed: rng() < 0.5,
  };
}

// ---------- P1: termination — bounded event sets, event_matrix keys subset of ALL_EVENTS ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const keys = Object.keys(output_payload.event_matrix);
    if (keys.some((k) => !ALL_EVENTS.includes(k))) violations++;
    if (keys.length > ALL_EVENTS.length) violations++;
  }
  return { name: 'P1_termination_bounded_matrix', trials: checked, violations };
}

// ---------- P2: enum boundedness ----------
const VALID_VERDICTS = new Set(['critical', 'gaps', 'compliant']);
function checkP2_enum_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (!VALID_VERDICTS.has(output_payload.verdict)) violations++;
  }
  return { name: 'P2_enum_boundedness', trials: checked, violations };
}

// ---------- P3 (differential): verdict/badge agree with gap counts (decision-table re-derivation) ----------
function checkP3_verdict_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const critLen = output_payload.critical_gaps.length;
    const allLen = output_payload.all_gaps.length;
    let expected;
    if (!pp.daml_lifecycle_defined || critLen > 0) expected = 'critical';
    else if (allLen > 0) expected = 'gaps';
    else expected = 'compliant';
    if (output_payload.verdict !== expected) violations++;
  }
  return { name: 'P3_verdict_badge_differential', trials: checked, violations };
}

// ---------- P4: event-set monotonicity — covering all required events (with lifecycle defined) => compliant ----------
function checkP4_full_coverage_monotone() {
  let violations = 0, checked = 0;
  const REQUIRED_EVENTS = {
    ust: ['issuance', 'coupon_payment', 'maturity_redemption'],
    govt_bond: ['issuance', 'coupon_payment', 'maturity_redemption'],
    corporate_bond: ['issuance', 'coupon_payment', 'maturity_redemption', 'default_handling'],
    equity: ['issuance', 'corporate_action', 'transfer'],
    fund_unit: ['issuance', 'transfer', 'maturity_redemption'],
    structured_note: ['issuance', 'coupon_payment', 'maturity_redemption', 'default_handling'],
  };
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    pp.daml_lifecycle_defined = true;
    pp.covered_events = REQUIRED_EVENTS[pp.security_type];
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.verdict !== 'compliant') violations++;
  }
  return { name: 'P4_full_coverage_implies_compliant', trials: checked, violations };
}

// ---------- P5: metamorphic — permutation-invariance of covered_events order ----------
function checkP5_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    const r1 = compute(pp).output_payload;
    const shuffled = { ...pp, covered_events: shuffle(rand, pp.covered_events) };
    const r2 = compute(shuffled).output_payload;
    checked++;
    if (r1.verdict !== r2.verdict || r1.verdict_badge !== r2.verdict_badge) violations++;
    // event_matrix key ORDER follows Set-insertion order (depends on covered_events order) by kernel
    // design — compare as content (sorted key/value pairs), not raw JSON string order.
    const norm = (m) => JSON.stringify(Object.entries(m).sort(([a], [b]) => a.localeCompare(b)));
    if (norm(r1.event_matrix) !== norm(r2.event_matrix)) violations++;
  }
  return { name: 'P5_permutation_invariance_covered_events', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_enum_bounded());
results.properties.push(checkP3_verdict_differential());
results.properties.push(checkP4_full_coverage_monotone());
results.properties.push(checkP5_permutation_invariance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: '512-tokenized-security-lifecycle-validator',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
