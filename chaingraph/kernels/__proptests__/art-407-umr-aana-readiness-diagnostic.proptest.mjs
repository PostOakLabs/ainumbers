// art-407-umr-aana-readiness-diagnostic.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C18-1).
// kernel_digest_at_authoring: sha256:ec1ae85431a3f2dc2a83949b48729db2b98414f0424c360c26bac091556f3bea
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — readiness_avg is a division of a two-element
// integer array {0,1,2}+{0,2} by a constant 2, landing only on the discrete set
// {0, 0.5, 1, 1.5, 2}; grade() thresholds (1.75/1.25/0.75/0.25) sit strictly between every
// reachable value with wide margins, so no ULP-adjacency case exists) — forced categorical
// boundary cases used in place of ULP-forcing, per spec §3's float:no row.
// Unbounded input: policy_parameters.counterparties (caller-supplied array), mapped/filtered
// by plain Array.prototype passes with no declared cap — termination bound is the array's
// own length.
// Checks: fixture-oracle gate, termination (map/filter/reduce passes scale linearly with
// counterparties.length, never hang), boundedness (overall_grade is always one of the 6
// declared enum values, readiness_grade lands only on the 5 declared grade letters or 'N/A',
// remediation_checklist.length never exceeds counterparties.length), metamorphic
// (permutation-invariance: reordering counterparties leaves counterparties_over_im_threshold
// and overall_grade unchanged — set-membership, not order, drives every derived count),
// forced categorical boundary cases (AANA exactly at the EUR 8bn scope threshold, IM exactly
// at the EUR 50m threshold, every readiness_avg grade-boundary value {0,0.5,1,1.5,2}).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-407-umr-aana-readiness-diagnostic.proptest.mjs

import { compute } from '../art-407-umr-aana-readiness-diagnostic.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-407-umr-aana-readiness-diagnostic.fixtures.json');
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
const rand = mulberry32(0x407A0);
const DOC_STATUSES = ['executed', 'in_progress', 'not_started'];
const GRADES = new Set(['A', 'B', 'C', 'D', 'F', 'N/A']);

function randomCounterparty(rng, i) {
  return {
    counterparty_id: `CP${i}`,
    estimated_im_eur: rng() * 1e8,
    documentation_status: DOC_STATUSES[Math.floor(rng() * DOC_STATUSES.length)],
    custodian_ready: rng() > 0.5,
  };
}

const TRIALS = 2000;

// ---------- P1: termination — map/filter/reduce passes scale linearly, never hang ----------
function checkP1_termination_linear_scaling() {
  let violations = 0, checked = 0;
  const sizes = [0, 1, 10, 100, 3000];
  for (const n of sizes) {
    const counterparties = Array.from({ length: n }, (_, i) => randomCounterparty(rand, i));
    const start = Date.now();
    const { output_payload } = compute({ aana_group_eur: 9e9, counterparties });
    checked++;
    if (Date.now() - start > 3000) violations++;
    if (output_payload.counterparty_count !== n) violations++;
  }
  return { name: 'P1_termination_linear_scaling_never_hangs', trials: checked, violations };
}

// ---------- P2: boundedness — overall_grade/readiness_grade enum-bounded, checklist bounded ----------
function checkP2_grade_enum_and_checklist_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 20);
    const counterparties = Array.from({ length: n }, (_, idx) => randomCounterparty(rand, idx));
    const { output_payload } = compute({ aana_group_eur: rand() * 2e10, counterparties });
    checked++;
    if (!GRADES.has(output_payload.overall_grade)) violations++;
    for (const c of output_payload.counterparties) if (!GRADES.has(c.readiness_grade)) violations++;
    if (output_payload.remediation_checklist.length > n) violations++;
    if (output_payload.counterparties_over_im_threshold > n) violations++;
  }
  return { name: 'P2_grade_enum_and_checklist_boundedness', trials: checked, violations };
}

// ---------- P3: metamorphic — permutation-invariance of aggregate counts and overall_grade ----------
function checkP3_metamorphic_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 300; i++) {
    const n = 1 + Math.floor(rand() * 15);
    const counterparties = Array.from({ length: n }, (_, idx) => randomCounterparty(rand, idx));
    const shuffled = [...counterparties];
    for (let j = shuffled.length - 1; j > 0; j--) { const k = Math.floor(rand() * (j + 1)); [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]]; }
    const aana_group_eur = 9e9;
    const outA = compute({ aana_group_eur, counterparties }).output_payload;
    const outB = compute({ aana_group_eur, counterparties: shuffled }).output_payload;
    checked++;
    if (outA.counterparties_over_im_threshold !== outB.counterparties_over_im_threshold) violations++;
    if (outA.overall_grade !== outB.overall_grade) violations++;
    if (outA.in_scope_aana !== outB.in_scope_aana) violations++;
  }
  return { name: 'P3_metamorphic_permutation_invariance_of_counts_and_grade', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP claim made) ----------
function checkP4_forced_categorical_boundaries() {
  let violations = 0, checked = 0;
  const cases = [
    // AANA exactly at the threshold (8bn) — kernel uses ">", so exactly-at must be OUT of scope
    { pp: { aana_group_eur: 8_000_000_000, counterparties: [] }, check: (o) => o.in_scope_aana === false },
    { pp: { aana_group_eur: 8_000_000_000.01, counterparties: [] }, check: (o) => o.in_scope_aana === true },
    // IM exactly at the threshold (50m) — kernel uses ">", exactly-at must be N/A (not over)
    { pp: { aana_group_eur: 9e9, counterparties: [{ counterparty_id: 'C', estimated_im_eur: 50_000_000, documentation_status: 'executed', custodian_ready: true }] }, check: (o) => o.counterparties[0].over_im_threshold === false && o.counterparties[0].readiness_grade === 'N/A' },
    { pp: { aana_group_eur: 9e9, counterparties: [{ counterparty_id: 'C', estimated_im_eur: 50_000_000.01, documentation_status: 'executed', custodian_ready: true }] }, check: (o) => o.counterparties[0].over_im_threshold === true },
    // readiness_avg grade-boundary values: 2 (A), 1.5 (B), 1 (C), 0.5 (D), 0 (F)
    { pp: { aana_group_eur: 9e9, counterparties: [{ counterparty_id: 'C', estimated_im_eur: 1e8, documentation_status: 'executed', custodian_ready: true }] }, check: (o) => o.counterparties[0].readiness_grade === 'A' }, // avg=2
    { pp: { aana_group_eur: 9e9, counterparties: [{ counterparty_id: 'C', estimated_im_eur: 1e8, documentation_status: 'in_progress', custodian_ready: true }] }, check: (o) => o.counterparties[0].readiness_grade === 'B' }, // avg=1.5
    { pp: { aana_group_eur: 9e9, counterparties: [{ counterparty_id: 'C', estimated_im_eur: 1e8, documentation_status: 'executed', custodian_ready: false }] }, check: (o) => o.counterparties[0].readiness_grade === 'C' }, // avg=1
    { pp: { aana_group_eur: 9e9, counterparties: [{ counterparty_id: 'C', estimated_im_eur: 1e8, documentation_status: 'in_progress', custodian_ready: false }] }, check: (o) => o.counterparties[0].readiness_grade === 'D' }, // avg=0.5
    { pp: { aana_group_eur: 9e9, counterparties: [{ counterparty_id: 'C', estimated_im_eur: 1e8, documentation_status: 'not_started', custodian_ready: false }] }, check: (o) => o.counterparties[0].readiness_grade === 'F' }, // avg=0
  ];
  for (const c of cases) {
    const { output_payload } = compute(c.pp);
    checked++;
    if (!c.check(output_payload)) violations++;
  }
  return { name: 'P4_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_linear_scaling());
results.properties.push(checkP2_grade_enum_and_checklist_boundedness());
results.properties.push(checkP3_metamorphic_permutation_invariance());
results.properties.push(checkP4_forced_categorical_boundaries());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-407-umr-aana-readiness-diagnostic',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
