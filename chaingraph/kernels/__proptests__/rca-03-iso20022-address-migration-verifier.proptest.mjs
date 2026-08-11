// rca-03-iso20022-address-migration-verifier.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C15-1).
// kernel_digest_at_authoring: sha256:b41abc8dbbec9f4b614bec77a444fbf320cdc1ff4f6fea220336759777c104e4
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (november_2026_readiness_pct is a plain pass/total*100 percentage compared
// against fixed literal thresholds 95/80, no ULP-sensitive branching found by direct read — same
// float:no "fixed threshold compare, floored via forced categorical boundary case" shape as art-322
// in the sibling C11 shard) — forced categorical boundary cases used instead of ULP-forcing.
// Checks: fixture-oracle gate, termination (batch_summary.total === records.length exactly, and
// failing_records is capped at 20 regardless of how many records fail — the kernel's own
// `.slice(0, 20)`), boundedness (pass+warn+fail === total; readiness_pct in [0,100]), forced
// categorical boundary cases around the 95%/80% verdict thresholds, and a metamorphic property
// (appending an invalid record never raises readiness_pct or improves the verdict).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/rca-03-iso20022-address-migration-verifier.proptest.mjs

import { compute } from '../rca-03-iso20022-address-migration-verifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'rca-03-iso20022-address-migration-verifier.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const output_payload = compute(vec.policy_parameters);
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
const rand = mulberry32(0x1103a8);
const COUNTRIES = ['DE', 'FR', 'GB', 'US', 'NL', 'ZZ', ''];
const STRICTNESS = ['lenient', 'standard', 'strict'];
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomRecord(rng) {
  const valid = rng() < 0.5;
  return {
    nm: valid ? `Name ${Math.floor(rng() * 1000)}` : (rng() < 0.5 ? '' : undefined),
    strt: rng() < 0.7 ? `Street ${Math.floor(rng() * 1000)}` : '',
    bldg: `${Math.floor(rng() * 999)}`,
    pst: rng() < 0.7 ? `${Math.floor(rng() * 99999)}` : '',
    twn: valid ? 'Town' : '',
    ctry: pick(rng, COUNTRIES),
  };
}

function randomPP(rng) {
  const n = Math.floor(rng() * 60);
  const records = Array.from({ length: n }, () => randomRecord(rng));
  return { records, strictness: pick(rng, STRICTNESS), trunc_threshold: rng() };
}

const TRIALS = 2000;

// ---------- P1: termination — total equals input length; failing_records capped at 20 ----------
function checkP1_termination_total_and_cap() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const output_payload = compute(pp);
    checked++;
    if (output_payload.batch_summary.total !== pp.records.length) violations++;
    if (output_payload.failing_records.length > 20) violations++;
  }
  return { name: 'P1_termination_total_equals_input_length_cap_20', trials: checked, violations };
}

// ---------- P2: boundedness — pass+warn+fail===total; readiness_pct in [0,100] ----------
function checkP2_boundedness_summary() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const output_payload = compute(pp);
    checked++;
    const s = output_payload.batch_summary;
    if (s.pass + s.warn + s.fail !== s.total) violations++;
    if (output_payload.november_2026_readiness_pct < 0 || output_payload.november_2026_readiness_pct > 100) violations++;
  }
  return { name: 'P2_boundedness_pass_warn_fail_sum_and_pct_range', trials: checked, violations };
}

// ---------- P3: forced categorical boundary — exact 95%/80% readiness thresholds ----------
function checkP3_forced_categorical_thresholds() {
  let violations = 0, checked = 0;
  const validRec = { nm: 'A', strt: 'S', bldg: '1', pst: '10115', twn: 'T', ctry: 'DE' };
  const invalidRec = { nm: '', strt: '', bldg: '', pst: '', twn: '', ctry: 'ZZ' };
  const cases = [
    { pass: 19, fail: 1, expectVerdict: 'READY' },      // 95.0% exactly -> READY (>=95)
    { pass: 18, fail: 2, expectVerdict: 'PARTIAL' },     // 90.0% -> PARTIAL (>=80,<95)
    { pass: 16, fail: 4, expectVerdict: 'PARTIAL' },     // 80.0% exactly -> PARTIAL (>=80)
    { pass: 15, fail: 5, expectVerdict: 'NOT_READY' },   // 75.0% -> NOT_READY (<80)
    { pass: 0, fail: 0, expectVerdict: 'NOT_READY' },    // empty batch -> 0%
  ];
  for (const c of cases) {
    const records = [
      ...Array.from({ length: c.pass }, () => ({ ...validRec })),
      ...Array.from({ length: c.fail }, () => ({ ...invalidRec })),
    ];
    const output_payload = compute({ records });
    checked++;
    if (output_payload.verdict !== c.expectVerdict) violations++;
  }
  return { name: 'P3_forced_categorical_boundary_readiness_thresholds', trials: checked, violations };
}

// ---------- P4: metamorphic — appending an invalid record never raises readiness_pct ----------
function checkP4_append_invalid_metamorphic() {
  let violations = 0, checked = 0;
  const rankOf = { NOT_READY: 0, PARTIAL: 1, READY: 2 };
  for (let i = 0; i < 1000; i++) {
    const pp = randomPP(rand);
    if (pp.records.length === 0) continue;
    const r1 = compute(pp);
    const extended = { ...pp, records: [...pp.records, { nm: '', strt: '', bldg: '', pst: '', twn: '', ctry: 'ZZ' }] };
    const r2 = compute(extended);
    checked++;
    if (r2.november_2026_readiness_pct > r1.november_2026_readiness_pct + 1e-9) violations++;
    if (rankOf[r2.verdict] > rankOf[r1.verdict]) violations++;
  }
  return { name: 'P4_append_invalid_record_metamorphic', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_total_and_cap());
results.properties.push(checkP2_boundedness_summary());
results.properties.push(checkP3_forced_categorical_thresholds());
results.properties.push(checkP4_append_invalid_metamorphic());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'rca-03-iso20022-address-migration-verifier',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
