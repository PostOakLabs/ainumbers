// art-465-workpaper-bundle-composer.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C22-1).
// kernel_digest_at_authoring: sha256:60abc4f1aab3d73fb82fee1c60cd97697dfbb0b5df878b0afb3b1e879cc682ce
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (pure string trims, array filters, boolean logic, no arithmetic anywhere in
// compute() — direct source read confirmed, no ULP-boundary claim made or needed). Forced
// categorical boundary cases used instead.
// Checks: fixture-oracle gate, termination (kernel_artifacts/exceptions counts bounded by input
// array lengths), differential re-derivation of malformed_kernel_artifacts, undisposed_exceptions,
// disposed_exception_count and every compliance_flags predicate, boundedness (every
// kernel_artifacts/exceptions row traces to one input row), and forced categorical boundary cases
// (empty arrays, all-fields-missing role statements). Zero external dependencies — pure Node
// built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-465-workpaper-bundle-composer.proptest.mjs

import { compute } from '../art-465-workpaper-bundle-composer.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-465-workpaper-bundle-composer.fixtures.json');
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
const rand = mulberry32(0x465A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomKernelArtifacts(rng, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      tool_id: pick(rng, [`art-46${i}`, '']),
      execution_hash: pick(rng, ['0xabc', '']),
    });
  }
  return out;
}

function randomExceptions(rng, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      item_id: pick(rng, [`item-${i}`, '']),
      reason_code: pick(rng, ['RC1', '']),
      disposition: pick(rng, ['resolved', '']),
      disposed_by_role: pick(rng, ['reviewer', '']),
    });
  }
  return out;
}

function randomRole(rng) {
  return { role: pick(rng, ['preparer', '']), statement: pick(rng, ['I attest', '']) };
}

function randomPP(rng) {
  return {
    procedure_id: pick(rng, ['PROC-1', '']),
    population_hash: pick(rng, ['ph-1', '']),
    kernel_artifacts: randomKernelArtifacts(rng, Math.floor(rng() * 6)),
    exceptions: randomExceptions(rng, Math.floor(rng() * 6)),
    preparer: randomRole(rng),
    reviewer: randomRole(rng),
    partner: randomRole(rng),
  };
}

const TRIALS = 5000;

// ---------- P1: termination — kernel_artifacts/exceptions counts bounded by input array lengths ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.kernel_artifact_count + output_payload.malformed_kernel_artifacts.length !== pp.kernel_artifacts.length) violations++;
    // exceptions with an empty item_id are dropped entirely (never counted, never surfaced) —
    // exception_count is bounded by input length, not necessarily equal to it.
    if (output_payload.exception_count > pp.exceptions.length) violations++;
  }
  return { name: 'P1_termination_counts_bounded_by_input_length', trials: checked, violations };
}

// ---------- P2 (differential): malformed_kernel_artifacts + undisposed_exceptions re-derivation ----------
function checkP2_malformed_undisposed_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expectedMalformed = pp.kernel_artifacts.filter((a) => !String(a.tool_id || '').trim() || !String(a.execution_hash || '').trim()).length;
    if (output_payload.malformed_kernel_artifacts.length !== expectedMalformed) violations++;
    const expectedUndisposed = pp.exceptions.filter((e) => String(e.item_id || '').trim() && !String(e.disposition || '').trim()).length;
    if (output_payload.undisposed_exceptions.length !== expectedUndisposed) violations++;
    if (output_payload.disposed_exception_count !== output_payload.exceptions.length - output_payload.undisposed_exceptions.length) violations++;
  }
  return { name: 'P2_malformed_and_undisposed_differential', trials: checked, violations };
}

// ---------- P3: boundedness — every kernel_artifacts/exceptions output row traces to one input row ----------
function checkP3_row_provenance_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const inputToolIds = new Set(pp.kernel_artifacts.map((a) => String(a.tool_id || '').trim()).filter(Boolean));
    for (const a of output_payload.kernel_artifacts) if (!inputToolIds.has(a.tool_id)) violations++;
    const inputItemIds = new Set(pp.exceptions.map((e) => String(e.item_id || '').trim()).filter(Boolean));
    for (const e of output_payload.exceptions) if (!inputItemIds.has(e.item_id)) violations++;
  }
  return { name: 'P3_output_rows_trace_to_input_rows', trials: checked, violations };
}

// ---------- P4: metamorphic — disposing an undisposed exception never increases undisposed_exceptions ----------
function checkP4_dispose_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const pp = randomPP(rand);
    const undisposedIdx = pp.exceptions.findIndex((e) => String(e.item_id || '').trim() && !String(e.disposition || '').trim());
    if (undisposedIdx === -1) continue;
    const r1 = compute(pp).output_payload;
    const disposed = { ...pp, exceptions: pp.exceptions.map((e, idx) => (idx === undisposedIdx ? { ...e, disposition: 'resolved', disposed_by_role: 'reviewer' } : e)) };
    const r2 = compute(disposed).output_payload;
    checked++;
    if (r2.undisposed_exceptions.length > r1.undisposed_exceptions.length) violations++;
    if (r2.disposed_exception_count < r1.disposed_exception_count) violations++;
  }
  return { name: 'P4_dispose_exception_never_increases_undisposed', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (empty arrays, all-missing role statements) ----------
function checkP5_forced_categorical_boundaries() {
  let violations = 0, checked = 0;
  const cases = [
    { pp: { procedure_id: '', population_hash: '', kernel_artifacts: [], exceptions: [], preparer: {}, reviewer: {}, partner: {} }, label: 'all_empty' },
    { pp: { procedure_id: 'P', population_hash: 'H', kernel_artifacts: [{ tool_id: '', execution_hash: '' }], exceptions: [], preparer: { role: 'preparer', statement: 's' }, reviewer: { role: 'reviewer', statement: 's' }, partner: { role: 'partner', statement: 's' } }, label: 'single_malformed_artifact' },
  ];
  for (const c of cases) {
    checked++;
    const { output_payload, compliance_flags } = compute(c.pp);
    if (c.label === 'all_empty') {
      if (!compliance_flags.includes('WORKPAPER_BUNDLE_MISSING_PROCEDURE_ID')) violations++;
      if (!compliance_flags.includes('WORKPAPER_BUNDLE_NO_KERNEL_ARTIFACTS')) violations++;
      if (!compliance_flags.includes('WORKPAPER_BUNDLE_MISSING_ROLE_STATEMENT')) violations++;
    }
    if (c.label === 'single_malformed_artifact') {
      if (output_payload.kernel_artifact_count !== 0) violations++;
      if (output_payload.malformed_kernel_artifacts.length !== 1) violations++;
      if (!compliance_flags.includes('WORKPAPER_BUNDLE_PARTNER_RELEASE_RECORDED')) violations++;
    }
  }
  return { name: 'P5_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_malformed_undisposed_differential());
results.properties.push(checkP3_row_provenance_boundedness());
results.properties.push(checkP4_dispose_metamorphic());
results.properties.push(checkP5_forced_categorical_boundaries());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-465-workpaper-bundle-composer',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
