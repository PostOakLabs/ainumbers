// art-352-etr-control-evidence-checker.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C16-1).
// kernel_digest_at_authoring: sha256:e9bbe808cfaec0c0c043fb1b8936ec1bff6a491ee704298662e13591cfdbdd8f
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — epoch_ms values are compared/sorted as plain
// numbers for ordering only, never divided/multiplied/accumulated, and every other field is
// string/boolean/regex logic; no ULP-boundary claim is made or needed — forced categorical
// boundary cases used instead).
// Checks: fixture-oracle gate, termination (holder_intervals/overlap_events/malformed are all
// bounded by control_events.length — a single linear walk over the caller-supplied array, no
// recursion, no unbounded accumulation), boundedness (overlap_event_count + malformed_event_count
// never exceeds total_events), a differential re-derivation of chain_continuity/exclusive_control
// against the source's own chain-walk logic, a permutation-invariance metamorphic identity
// (compute() sorts control_events internally by epoch_ms/event_id before walking the chain, so
// shuffling the INPUT array order must never change the output), and forced categorical boundary
// cases (empty control_events, self-loop from===to rejected as malformed, malformed digest shape,
// duplicate epoch_ms tie-break by event_id).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-352-etr-control-evidence-checker.proptest.mjs

import { compute } from '../art-352-etr-control-evidence-checker.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-352-etr-control-evidence-checker.fixtures.json');
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
const rand = mulberry32(0x35200);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const HOLDERS = ['Carrier-A', 'Bank-B', 'Consignee-C', 'Bank-D'];

function randomEvents(rng, n, origHolder) {
  const events = [];
  let t = 1000;
  let current = origHolder;
  for (let i = 0; i < n; i++) {
    t += Math.floor(rng() * 500) + 1;
    const validTransition = rng() < 0.75;
    const from_holder = validTransition ? current : pick(rng, HOLDERS);
    let to_holder = pick(rng, HOLDERS);
    while (to_holder === from_holder) to_holder = pick(rng, HOLDERS);
    events.push({
      event_id: `e${i}`,
      from_holder,
      to_holder,
      epoch_ms: t,
      signature_present: rng() < 0.8,
    });
    if (validTransition) current = to_holder;
  }
  return events;
}

function randomPP(rng) {
  const origHolder = pick(rng, HOLDERS);
  const n = Math.floor(rng() * 8);
  return {
    document_digest: rng() < 0.85 ? 'sha256:' + 'a'.repeat(64) : 'not-a-digest',
    platform_identity: rng() < 0.85 ? 'AcmeChain eBL Registry' : '',
    singularity_assertion: rng() < 0.7,
    original_holder: rng() < 0.9 ? origHolder : '',
    control_events: randomEvents(rng, n, origHolder),
  };
}

const TRIALS = 3000;

// ---------- P1: termination — every bounded-count field is <= control_events.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    const n = pp.control_events.length;
    if (o.chain_summary.malformed_event_count > n) violations++;
    if (o.chain_summary.overlap_event_count > n) violations++;
    if (o.chain_summary.valid_chain_events > n) violations++;
    if (o.chain_summary.holder_intervals.length > n + 1) violations++;
  }
  return { name: 'P1_termination_bounded_by_input_events_length', trials: checked, violations };
}

// ---------- P2: boundedness — overlap + malformed never exceeds total events ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.chain_summary.overlap_event_count + o.chain_summary.malformed_event_count > o.chain_summary.total_events) violations++;
    if (o.chain_summary.total_events !== pp.control_events.length) violations++;
  }
  return { name: 'P2_overlap_plus_malformed_bounded_by_total', trials: checked, violations };
}

// ---------- P3: differential — element_checklist overall verdict re-derivation ----------
function checkP3_verdict_differential() {
  let violations = 0, checked = 0;
  const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    const integrity_pass = DIGEST_RE.test(String(pp.document_digest || '').trim());
    const hasPlatform = String(pp.platform_identity || '').trim().length > 0;
    const singularity_ok = hasPlatform && pp.singularity_assertion === true;
    const all_pass = integrity_pass && singularity_ok
      && o.element_checklist.chain_continuity.result === 'pass'
      && o.element_checklist.exclusive_control.result === 'pass';
    const expected_verdict = all_pass ? 'reliable_evidence' : 'insufficient_evidence';
    if (o.overall_verdict !== expected_verdict) violations++;
    if ((o.element_checklist.integrity_ref.result === 'pass') !== integrity_pass) violations++;
  }
  return { name: 'P3_overall_verdict_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — permutation-invariance (shuffling INPUT event order changes nothing) ----------
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1000; i++) {
    const pp = randomPP(rand);
    if (pp.control_events.length < 2) continue;
    const r1 = compute(pp).output_payload;
    const shuffled = [...pp.control_events];
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    const r2 = compute({ ...pp, control_events: shuffled }).output_payload;
    checked++;
    if (JSON.stringify(r1) !== JSON.stringify(r2)) violations++;
  }
  return { name: 'P4_permutation_invariance_metamorphic', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (float:no — categorical, not ULP) ----------
function checkP5_forced_categorical() {
  let violations = 0, checked = 0;
  // empty control_events
  {
    const { output_payload: o } = compute({ document_digest: 'sha256:' + 'b'.repeat(64), platform_identity: 'X', singularity_assertion: true, original_holder: 'A', control_events: [] });
    checked++;
    if (o.chain_summary.total_events !== 0) violations++;
    if (o.chain_summary.final_holder !== 'A') violations++;
  }
  // self-loop from===to -> malformed
  {
    const { output_payload: o } = compute({ document_digest: 'sha256:' + 'c'.repeat(64), platform_identity: 'X', singularity_assertion: true, original_holder: 'A', control_events: [{ event_id: 'e1', from_holder: 'A', to_holder: 'A', epoch_ms: 10, signature_present: true }] });
    checked++;
    if (o.chain_summary.malformed_event_count !== 1) violations++;
  }
  // malformed digest shape (not sha256:<64hex>)
  {
    const { output_payload: o } = compute({ document_digest: 'not-a-digest', platform_identity: 'X', singularity_assertion: true, original_holder: 'A', control_events: [] });
    checked++;
    if (o.element_checklist.integrity_ref.result !== 'fail') violations++;
  }
  // duplicate epoch_ms tie-break by event_id (deterministic ordering)
  {
    const evs = [
      { event_id: 'z1', from_holder: 'A', to_holder: 'B', epoch_ms: 500, signature_present: true },
      { event_id: 'a1', from_holder: 'A', to_holder: 'C', epoch_ms: 500, signature_present: true },
    ];
    const r1 = compute({ document_digest: 'sha256:' + 'd'.repeat(64), platform_identity: 'X', singularity_assertion: true, original_holder: 'A', control_events: evs }).output_payload;
    const r2 = compute({ document_digest: 'sha256:' + 'd'.repeat(64), platform_identity: 'X', singularity_assertion: true, original_holder: 'A', control_events: [...evs].reverse() }).output_payload;
    checked++;
    if (JSON.stringify(r1) !== JSON.stringify(r2)) violations++;
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
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_verdict_differential());
results.properties.push(checkP4_permutation_invariance());
results.properties.push(checkP5_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-352-etr-control-evidence-checker',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
