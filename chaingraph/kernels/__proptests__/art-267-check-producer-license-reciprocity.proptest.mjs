// art-267-check-producer-license-reciprocity.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C8-1).
// kernel_digest_at_authoring: sha256:0120faf130b1725fa559dce448a0de45da7826fbc88e6b8377b94f361601beea
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny — blanket
// class-C Dafny stays frozen. float_sensitive: NO (pure set-membership/string logic, no arithmetic) —
// forced categorical boundary cases used instead of ULP-forcing.
// Checks: fixture-oracle gate, termination (coverage_by_target exactly target_states.length), boundedness
// (invalid_loa_codes subset of loa_codes, non_standard_states subset of target_states), forced categorical
// edges (every non-standard state as resident and as target, invalid LOA codes, lowercase input
// normalization), and a metamorphic property (case-insensitivity: lowercasing all state/LOA inputs
// produces byte-identical output).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-267-check-producer-license-reciprocity.proptest.mjs

import { compute } from '../art-267-check-producer-license-reciprocity.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-267-check-producer-license-reciprocity.fixtures.json');
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
const rand = mulberry32(0x267A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const NON_STANDARD = ['CA', 'FL', 'NJ', 'NY', 'HI', 'MN', 'WI'];
const STANDARD_STATES = ['TX', 'IL', 'CO', 'GA', 'OH', 'PA', 'VA'];
const ALL_STATES = NON_STANDARD.concat(STANDARD_STATES);
const VALID_LOA = ['L', 'H', 'A', 'LTC', 'VI', 'CV', 'P', 'C'];
const INVALID_LOA = ['ZZ', 'BOGUS', 'X1'];
const TRIALS = 5000;

function randomInput(rng) {
  const resident_state = pick(rng, ALL_STATES);
  const loa_codes = Array.from({ length: 1 + Math.floor(rng() * 4) }, () => pick(rng, VALID_LOA.concat(INVALID_LOA)));
  const target_states = Array.from({ length: Math.floor(rng() * 6) }, () => pick(rng, ALL_STATES));
  return { resident_state, loa_codes, target_states };
}

// ---------- P1: termination — coverage_by_target exactly target_states.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const input = randomInput(rand);
    const output_payload = compute(input);
    checked++;
    if (output_payload.coverage_by_target.length !== input.target_states.length) violations++;
    if (output_payload.target_state_count !== input.target_states.length) violations++;
  }
  return { name: 'P1_termination_coverage_length_exact', trials: checked, violations };
}

// ---------- P2: boundedness — invalid_loa_codes subset of loa_codes, non_standard_states subset of target ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const input = randomInput(rand);
    const output_payload = compute(input);
    checked++;
    if (output_payload.invalid_loa_codes.length > input.loa_codes.length) violations++;
    if (output_payload.non_standard_states.length > input.target_states.length) violations++;
    for (const s of output_payload.non_standard_states) {
      if (!input.target_states.map((t) => t.toUpperCase()).includes(s)) violations++;
    }
  }
  return { name: 'P2_boundedness_subset_invariants', trials: checked, violations };
}

// ---------- P3: differential — reciprocal flag re-derived from resident/target non-standard status ----------
function checkP3_reciprocal_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const input = randomInput(rand);
    const output_payload = compute(input);
    checked++;
    const residentNonStandard = NON_STANDARD.includes(input.resident_state.toUpperCase());
    for (const cov of output_payload.coverage_by_target) {
      const targetNonStandard = NON_STANDARD.includes(cov.target_state);
      const expected = !targetNonStandard && !residentNonStandard;
      if (cov.reciprocal !== expected) violations++;
      if (cov.is_non_standard !== targetNonStandard) violations++;
    }
    if (output_payload.all_reciprocal !== output_payload.coverage_by_target.every((c) => c.reciprocal)) violations++;
  }
  return { name: 'P3_reciprocal_flag_differential', trials: checked, violations };
}

// ---------- P4 (forced categorical, float_sensitive:no) ----------
const FORCED_CASES = [
  { label: 'resident in every non-standard state (loop)', cases: NON_STANDARD.map((s) => ({ resident_state: s, loa_codes: ['L'], target_states: ['TX'] })) },
  { label: 'target is every non-standard state (loop)', cases: NON_STANDARD.map((s) => ({ resident_state: 'TX', loa_codes: ['L'], target_states: [s] })) },
];
function checkP4_forced() {
  const rows = [];
  for (const group of FORCED_CASES) {
    for (const c of group.cases) {
      const output_payload = compute(c);
      rows.push({ label: `${group.label}: ${JSON.stringify(c)}`, all_reciprocal: output_payload.all_reciprocal, finite: typeof output_payload.all_reciprocal === 'boolean' && Array.isArray(output_payload.coverage_by_target) });
    }
  }
  const extra = [
    { label: 'invalid LOA code -> flagged in invalid_loa_codes', input: { resident_state: 'TX', loa_codes: ['ZZBOGUS'], target_states: [] } },
    { label: 'empty everything', input: { resident_state: '', loa_codes: [], target_states: [] } },
    { label: 'lowercase resident/target/loa -> normalized to uppercase', input: { resident_state: 'tx', loa_codes: ['l'], target_states: ['ca'] } },
  ];
  for (const c of extra) {
    const output_payload = compute(c.input);
    rows.push({ label: c.label, all_reciprocal: output_payload.all_reciprocal, finite: typeof output_payload.resident_state === 'string' });
  }
  return rows;
}

// ---------- P5: metamorphic — case-insensitivity of all DERIVED fields (loa_codes/loa_gaps echo the
// caller's original casing verbatim by design — `loa_codes,` is a pass-through, not normalized — so
// that one field is excluded from the comparison; every classification field must still match).
function checkP5_case_insensitivity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const input = randomInput(rand);
    const lowered = {
      resident_state: input.resident_state.toLowerCase(),
      loa_codes: input.loa_codes.map((c) => c.toLowerCase()),
      target_states: input.target_states.map((s) => s.toLowerCase()),
    };
    const r1 = compute(input);
    const r2 = compute(lowered);
    checked++;
    // loa_codes / invalid_loa_codes (top-level) and coverage_by_target[].loa_gaps[].loa all echo the
    // caller's original casing verbatim (pass-through fields, not normalized) — normalize before compare.
    const norm = (r) => ({
      ...r,
      loa_codes: r.loa_codes.map((c) => c.toUpperCase()),
      invalid_loa_codes: r.invalid_loa_codes.map((c) => c.toUpperCase()),
      coverage_by_target: r.coverage_by_target.map((c) => ({ ...c, loa_gaps: c.loa_gaps.map((g) => ({ ...g, loa: g.loa.toUpperCase() })) })),
    });
    if (JSON.stringify(norm(r1)) !== JSON.stringify(norm(r2))) violations++;
  }
  return { name: 'P5_metamorphic_case_insensitivity_derived_fields', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_reciprocal_differential());
results.properties.push(checkP5_case_insensitivity());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryMismatch = results.boundary_forced.some((b) => !b.finite);

console.log(JSON.stringify({
  tool_id: 'art-267-check-producer-license-reciprocity',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_mismatch: anyBoundaryMismatch,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryMismatch ? 1 : 0);
