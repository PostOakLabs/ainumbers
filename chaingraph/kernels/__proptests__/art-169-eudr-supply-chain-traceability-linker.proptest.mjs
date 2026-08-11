// art-169-eudr-supply-chain-traceability-linker.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C5-1).
// kernel_digest_at_authoring: sha256:5290987894384c3baf43f5a162fb87c964f0ff074535604e4b89001db38a40b7
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (WU row classification confirmed by direct read — every check is a boolean
// flag, a regex over a string, or an array-length comparison; no arithmetic on non-integer values).
// Checks: fixture-oracle gate, termination (refs_valid loop bounded by upstream_dds_refs.length via
// Array.prototype.every), boundedness (traceability_gaps[] finite), differential re-derivation of
// chain_integrity/single_dds_rule_met, metamorphic (adding a valid upstream ref to a non-first
// operator removes the "must reference upstream" gap), and forced categorical boundary cases for
// the DDS ref regex length bounds (4/40 chars) and the first-operator toggle.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-169-eudr-supply-chain-traceability-linker.proptest.mjs

import { compute } from '../art-169-eudr-supply-chain-traceability-linker.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-169-eudr-supply-chain-traceability-linker.fixtures.json');
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
const rand = mulberry32(0x169A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randRef(rng, valid) {
  if (valid) {
    const len = 4 + Math.floor(rng() * 20);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-';
    let s = '';
    for (let i = 0; i < len; i++) s += chars[Math.floor(rng() * chars.length)];
    return s;
  }
  return pick(rng, ['bad ref!', 'ab', '', 'lowercase-ref-1234']);
}

function randomSupplyChain(rng) {
  const operator_is_first = rng() < 0.5;
  const nRefs = Math.floor(rng() * 5);
  const allValid = rng() < 0.5;
  const upstream_dds_refs = Array.from({ length: nRefs }, () => randRef(rng, allValid));
  return {
    operator_is_first,
    upstream_dds_refs,
    plot_geolocation_present: rng() < 0.7,
    custody_chain_complete: rng() < 0.7,
  };
}

const TRIALS = 5000;

// ---------- P1: termination — refs_valid loop bounded by upstream_dds_refs.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const supply_chain = randomSupplyChain(rand);
    const { output_payload } = compute({ supply_chain });
    checked++;
    if (output_payload.linked_dds_count !== supply_chain.upstream_dds_refs.length) violations++;
    if (output_payload.traceability_gaps.length > 5) violations++; // at most 5 distinct gap kinds
  }
  return { name: 'P1_termination_bounded_by_refs_length', trials: checked, violations };
}

// ---------- P2 (differential): chain_integrity iff gaps empty; single_dds_rule_met re-derivation ----------
function checkP2_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const supply_chain = randomSupplyChain(rand);
    const { output_payload } = compute({ supply_chain });
    checked++;
    if (output_payload.chain_integrity !== (output_payload.traceability_gaps.length === 0)) violations++;
    const expectedRule =
      (supply_chain.operator_is_first && supply_chain.upstream_dds_refs.length === 0) ||
      (!supply_chain.operator_is_first && supply_chain.upstream_dds_refs.length > 0 &&
        supply_chain.upstream_dds_refs.every((r) => /^[A-Z0-9-]{4,40}$/.test(r.trim())));
    if (output_payload.single_dds_rule_met !== expectedRule) violations++;
  }
  return { name: 'P2_chain_integrity_and_rule_differential', trials: checked, violations };
}

// ---------- P3: metamorphic — adding a valid upstream ref to a non-first operator with zero refs removes the "must reference" gap ----------
function checkP3_metamorphic_add_ref_removes_gap() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const base = { operator_is_first: false, upstream_dds_refs: [], plot_geolocation_present: true, custody_chain_complete: true };
    const withRef = { ...base, upstream_dds_refs: [randRef(rand, true)] };
    const r1 = compute({ supply_chain: base }).output_payload;
    const r2 = compute({ supply_chain: withRef }).output_payload;
    checked++;
    if (!r1.traceability_gaps.includes('downstream_operator_must_reference_upstream_dds')) violations++;
    if (r2.traceability_gaps.includes('downstream_operator_must_reference_upstream_dds')) violations++;
  }
  return { name: 'P3_metamorphic_add_valid_ref_removes_gap', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no -> categorical, not ULP) ----------
const BOUNDARY_CASES = [
  { label: 'ref length exactly 4 (regex lower bound) -> valid', supply_chain: { operator_is_first: false, upstream_dds_refs: ['AB12'], plot_geolocation_present: true, custody_chain_complete: true } },
  { label: 'ref length 3 (below regex lower bound) -> invalid format', supply_chain: { operator_is_first: false, upstream_dds_refs: ['AB1'], plot_geolocation_present: true, custody_chain_complete: true } },
  { label: 'ref length exactly 40 (regex upper bound) -> valid', supply_chain: { operator_is_first: false, upstream_dds_refs: ['A'.repeat(40)], plot_geolocation_present: true, custody_chain_complete: true } },
  { label: 'ref length 41 (above regex upper bound) -> invalid format', supply_chain: { operator_is_first: false, upstream_dds_refs: ['A'.repeat(41)], plot_geolocation_present: true, custody_chain_complete: true } },
  { label: 'first operator with zero refs -> single_dds_rule_met true', supply_chain: { operator_is_first: true, upstream_dds_refs: [], plot_geolocation_present: true, custody_chain_complete: true } },
  { label: 'first operator with one ref -> rule violation flagged', supply_chain: { operator_is_first: true, upstream_dds_refs: ['AB12'], plot_geolocation_present: true, custody_chain_complete: true } },
];
function checkP4_forced() {
  return BOUNDARY_CASES.map((c) => {
    const { output_payload } = compute({ supply_chain: c.supply_chain });
    return { label: c.label, single_dds_rule_met: output_payload.single_dds_rule_met, refs_valid: output_payload.refs_valid, traceability_gaps: output_payload.traceability_gaps };
  });
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_differential());
results.properties.push(checkP3_metamorphic_add_ref_removes_gap());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const refLen4Valid = results.boundary_forced[0].refs_valid === true;
const refLen3Invalid = results.boundary_forced[1].refs_valid === false;
const refLen40Valid = results.boundary_forced[2].refs_valid === true;
const refLen41Invalid = results.boundary_forced[3].refs_valid === false;
const firstOpZeroRefsOk = results.boundary_forced[4].single_dds_rule_met === true;
const firstOpWithRefViolation = results.boundary_forced[5].single_dds_rule_met === false;
const anyBoundaryMismatch = !(refLen4Valid && refLen3Invalid && refLen40Valid && refLen41Invalid && firstOpZeroRefsOk && firstOpWithRefViolation);

console.log(JSON.stringify({
  tool_id: 'art-169-eudr-supply-chain-traceability-linker',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_mismatch: anyBoundaryMismatch,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryMismatch ? 1 : 0);
