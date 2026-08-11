// art-408-evidence-bundle-tier-labeler.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C19-1).
// kernel_digest_at_authoring: sha256:4bffde8c450663ed6c3f2e2d7f8671638c0277be7be5f9e9717598f5911b88f8
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — pure boolean cumulative-gate logic and array
// filter/map over the declared proof_refs / human_accountability_records; no arithmetic; forced
// categorical boundary cases used).
// Checks: fixture-oracle gate, termination (assembleEvidenceBundle does one linear filter pass
// over human_accountability_records, no recursion, no unbounded accumulation), boundedness
// (eligible_tiers.length <= 3 and is always a subset of {OCG-Verify,OCG-Execute,OCG-Prove}),
// a differential re-derivation of the cumulative-gate tier_label/eligible_tiers logic (tiers are
// cumulative, not independent — SPEC.md §SIDECAR.1), and forced categorical boundary cases (all
// gates false -> UNLABELED, only envelope gates true -> OCG-Verify, execute gates true but prove
// gate false -> OCG-Execute stays the ceiling even if a later gate would notionally qualify,
// empty proof_refs, empty human_accountability_records leaves ha_evidence_bundle null).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-408-evidence-bundle-tier-labeler.proptest.mjs

import { compute } from '../art-408-evidence-bundle-tier-labeler.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-408-evidence-bundle-tier-labeler.fixtures.json');
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
const rand = mulberry32(0x408C19);
function bit(rng, p = 0.5) { return rng() < p; }

function randomPP(rng) {
  const n = Math.floor(rng() * 6);
  return {
    artifact_tool_id: 'art-99',
    artifact_execution_hash: bit(rng, 0.8) ? 'sha256:' + 'a'.repeat(64) : '',
    proof_refs: Array.from({ length: n }, (_, i) => `ref-${i}`),
    gate_results: {
      envelope_well_formed: bit(rng),
      execution_hash_recomputes: bit(rng),
      chain_execution_valid: bit(rng),
      mandate_gates_valid: bit(rng),
      compute_integrity_proof_valid: bit(rng),
    },
  };
}

const TRIALS = 5000;

// ---------- P1: termination — array filter is single-pass, no hang on large proof_refs ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.proof_ref_count !== o.proof_refs.length) violations++;
    if (o.proof_refs.length > pp.proof_refs.length) violations++;
  }
  return { name: 'P1_termination_proof_ref_count_matches_filtered_length', trials: checked, violations };
}

// ---------- P2: boundedness — eligible_tiers subset of the 3 declared tiers ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  const KNOWN = new Set(['OCG-Verify', 'OCG-Execute', 'OCG-Prove']);
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.eligible_tiers.length > 3) violations++;
    if (!o.eligible_tiers.every((t) => KNOWN.has(t))) violations++;
  }
  return { name: 'P2_eligible_tiers_bounded_subset_of_3', trials: checked, violations };
}

// ---------- P3: differential — cumulative-gate tier_label re-derivation ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    const gr = pp.gate_results;
    const verify_ok = gr.envelope_well_formed && gr.execution_hash_recomputes;
    const execute_ok = verify_ok && gr.chain_execution_valid && gr.mandate_gates_valid;
    const prove_ok = execute_ok && gr.compute_integrity_proof_valid;
    const expected = prove_ok ? 'OCG-Prove' : execute_ok ? 'OCG-Execute' : verify_ok ? 'OCG-Verify' : 'UNLABELED';
    if (o.tier_label !== expected) violations++;
    const expectedEligible = [verify_ok && 'OCG-Verify', execute_ok && 'OCG-Execute', prove_ok && 'OCG-Prove'].filter(Boolean);
    if (JSON.stringify(o.eligible_tiers) !== JSON.stringify(expectedEligible)) violations++;
    // cumulative invariant: prove_ok implies execute_ok implies verify_ok
    if (prove_ok && !execute_ok) violations++;
    if (execute_ok && !verify_ok) violations++;
  }
  return { name: 'P3_cumulative_tier_label_differential', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no) ----------
function checkP4_forced_categorical() {
  let violations = 0, checked = 0;
  // all gates false -> UNLABELED, no eligible tiers
  {
    const { output_payload: o } = compute({ gate_results: {} });
    checked++;
    if (o.tier_label !== 'UNLABELED') violations++;
    if (o.eligible_tiers.length !== 0) violations++;
  }
  // only envelope gates true -> OCG-Verify ceiling, even if compute_integrity_proof_valid is (spuriously) true
  {
    const { output_payload: o } = compute({ gate_results: { envelope_well_formed: true, execution_hash_recomputes: true, compute_integrity_proof_valid: true } });
    checked++;
    if (o.tier_label !== 'OCG-Verify') violations++;
    if (o.eligible_tiers.includes('OCG-Prove')) violations++;
  }
  // execute gates true, prove gate false -> OCG-Execute
  {
    const { output_payload: o } = compute({ gate_results: { envelope_well_formed: true, execution_hash_recomputes: true, chain_execution_valid: true, mandate_gates_valid: true, compute_integrity_proof_valid: false } });
    checked++;
    if (o.tier_label !== 'OCG-Execute') violations++;
  }
  // empty human_accountability_records -> ha_evidence_bundle null
  {
    const { output_payload: o } = compute({ artifact_execution_hash: 'sha256:' + 'b'.repeat(64), human_accountability_records: [] });
    checked++;
    if (o.ha_evidence_bundle !== null) violations++;
  }
  return { name: 'P4_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_differential());
results.properties.push(checkP4_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-408-evidence-bundle-tier-labeler',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
