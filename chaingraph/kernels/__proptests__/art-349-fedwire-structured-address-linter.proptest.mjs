// art-349-fedwire-structured-address-linter.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C14-1).
// kernel_digest_at_authoring: sha256:5d00ddaa78f298a5fa938bf6f520102ef38a75b1de34b7fdb631905ef13cadc8
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — string length/regex/array-membership checks only,
// no arithmetic comparison of caller-supplied numbers anywhere in the kernel).
// Checks: fixture-oracle gate, termination (violations[] is bounded by address_lines.length plus
// a fixed set of structural checks; readiness_pct always stays in [0,100]), a differential
// re-derivation of error_count/compliant from violations[], and forced categorical boundary
// cases at the four structural thresholds (MAX_ADR_LINE_LEN=70 chars, MAX_ADR_LINES=2,
// ISO-3166-1 alpha-2 country-code length=2, the silent-fail-duplication length>=3 threshold).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-349-fedwire-structured-address-linter.proptest.mjs

import { compute } from '../art-349-fedwire-structured-address-linter.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-349-fedwire-structured-address-linter.fixtures.json');
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
const rand = mulberry32(0x349E0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randStr(rng, n) { const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 '; let s = ''; for (let i = 0; i < n; i++) s += chars[Math.floor(rng() * chars.length)]; return s; }

function randomPP(rng) {
  const nLines = Math.floor(rng() * 5);
  const lines = [];
  for (let i = 0; i < nLines; i++) lines.push(randStr(rng, Math.floor(rng() * 90)));
  return {
    network: pick(rng, ['fedwire', 'chips', 'other', '']),
    street_name: rng() < 0.5 ? randStr(rng, Math.floor(rng() * 20)) : '',
    building_number: rng() < 0.5 ? randStr(rng, Math.floor(rng() * 8)) : '',
    post_code: rng() < 0.5 ? randStr(rng, Math.floor(rng() * 10)) : '',
    town_name: rng() < 0.5 ? randStr(rng, Math.floor(rng() * 15)) : '',
    country: rng() < 0.7 ? pick(rng, ['US', 'GB', 'us', 'ZZZ', '1', '']) : randStr(rng, Math.floor(rng() * 5)),
    country_subdivision: rng() < 0.3 ? randStr(rng, 5) : '',
    address_lines: lines,
  };
}

const TRIALS = 4000;

// ---------- P1: termination — violations bounded, readiness_pct in [0,100] ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.readiness_pct < 0 || output_payload.readiness_pct > 100) violations++;
    // ADR_LINE_TOO_LONG entries bounded by address_lines.length
    const tooLong = output_payload.violations.filter((v) => v.code === 'ADR_LINE_TOO_LONG').length;
    if (tooLong > pp.address_lines.length) violations++;
  }
  return { name: 'P1_termination_violations_and_readiness_bounded', trials: checked, violations };
}

// ---------- P2 (differential): error_count/compliant re-derivation from violations[] ----------
function checkP2_error_count_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    const expectedErrors = output_payload.violations.filter((v) => v.severity === 'ERROR').length;
    if (output_payload.error_count !== expectedErrors) violations++;
    const expectedCompliant = expectedErrors === 0 && (output_payload.structure_type === 'FULLY_STRUCTURED' || output_payload.structure_type === 'HYBRID');
    if (output_payload.compliant !== expectedCompliant) violations++;
    if (!expectedCompliant !== compliance_flags.includes('FEDWIRE_ADDRESS_NON_COMPLIANT')) violations++;
    const expectedReadiness = expectedCompliant ? 100 : Math.max(0, 100 - expectedErrors * 20);
    if (output_payload.readiness_pct !== expectedReadiness) violations++;
  }
  return { name: 'P2_error_count_compliant_readiness_differential', trials: checked, violations };
}

// ---------- P3: forced categorical boundary cases (float_sensitive: no) ----------
function checkP3_categorical_boundary_forcing() {
  let violations = 0, checked = 0;

  // MAX_ADR_LINE_LEN=70 boundary
  for (const len of [69, 70, 71]) {
    const pp = { town_name: 'Town', country: 'US', address_lines: ['x'.repeat(len)] };
    const { output_payload } = compute(pp);
    checked++;
    const flagged = output_payload.violations.some((v) => v.code === 'ADR_LINE_TOO_LONG');
    if ((len > 70) !== flagged) violations++;
  }

  // MAX_ADR_LINES=2 boundary — structure_type only resolves to HYBRID when adrLines.length<=2
  // (line 66), so exceeding it falls through to MIXED_INVALID rather than reaching the
  // in-hybrid EXCESS_ADR_LINES check (line 90-92, unreachable dead code by construction —
  // confirmed by direct read: no path both enters HYBRID and has adrLines.length>2). The floor
  // asserts the actual boundary behavior: n<=2 stays HYBRID/no INVALID_MIX, n>2 flips to
  // MIXED_INVALID/INVALID_MIX.
  for (const n of [2, 3]) {
    const lines = new Array(n).fill(0).map((_, i) => 'Line' + i);
    const pp = { town_name: 'Town', country: 'US', address_lines: lines };
    const { output_payload } = compute(pp);
    checked++;
    const flaggedMix = output_payload.violations.some((v) => v.code === 'INVALID_MIX');
    if ((n > 2) !== flaggedMix) violations++;
    if ((n > 2) !== (output_payload.structure_type === 'MIXED_INVALID')) violations++;
    if ((n <= 2) !== (output_payload.structure_type === 'HYBRID')) violations++;
  }

  // ISO-3166-1 alpha-2 country-code length boundary
  for (const c of ['U', 'US', 'USA']) {
    const pp = { town_name: 'Town', country: c, address_lines: [] };
    const { output_payload } = compute(pp);
    checked++;
    const invalidCountry = output_payload.violations.some((v) => v.code === 'INVALID_COUNTRY');
    if ((c.length !== 2) !== invalidCountry) violations++;
  }

  // silent-fail-duplication length>=3 threshold
  for (const val of ['ab', 'abc']) {
    const pp = { street_name: val, town_name: 'Town', country: 'US', address_lines: [val + ' Street'] };
    const { output_payload } = compute(pp);
    checked++;
    const flagged = output_payload.violations.some((v) => v.code === 'SILENT_FAIL_DUPLICATION');
    if ((val.length >= 3) !== flagged) violations++;
  }

  return { name: 'P3_categorical_boundary_forcing_four_thresholds', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_error_count_differential());
results.properties.push(checkP3_categorical_boundary_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-349-fedwire-structured-address-linter',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
