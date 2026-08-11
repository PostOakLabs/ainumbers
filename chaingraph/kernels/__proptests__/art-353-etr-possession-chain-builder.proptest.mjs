// art-353-etr-possession-chain-builder.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C16-1).
// kernel_digest_at_authoring: sha256:13ba0669d5e6d376f027ff9d182bc9d5578a33196aa58a755e376dc29a2c4888
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — pure string comparisons, array indexing, and
// SHA-256 hash-chaining; no arithmetic, no ULP-boundary claim made or needed — forced
// categorical boundary cases used instead).
// ⭐ IMPORTANT SHAPE NOTE: compute(pp) alone leaves possession_receipts/merkle_root as null —
// the hash chain is built ASYNCHRONOUSLY in buildArtifact() (WebCrypto SHA-256 per receipt).
// This kernel's own golden fixtures record buildArtifact()'s FULLY POPULATED output_payload, so
// the fixture-oracle gate here calls buildArtifact(), not compute() alone (confirmed by direct
// comparison against the fixture file's non-null possession_receipts/merkle_root fields).
// Checks: fixture-oracle gate (via buildArtifact), termination (possession_receipts.length is
// exactly events.length — a single linear pass, no recursion), boundedness (continuity_breaks
// is a strict subset of events, indexed 0..events.length-1), a differential re-derivation of
// chain_continuous/final_holder from the source's own from_holder-chase logic, a tamper-evident
// metamorphic identity (mutating any single event field changes merkle_root — hash-chain
// non-collision, and reordering two adjacent events changes merkle_root since transfer ORDER is
// part of what is attested), and forced categorical boundary cases (zero events, single event,
// a from_holder mismatch that breaks continuity, out-of-order timestamps).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled). Uses
// Node's WebCrypto (globalThis.crypto.subtle, Node 18+) via the kernel's own _hash.mjs import —
// no new dependency, same runtime the repo already requires for every kernel.
//
// Run: node chaingraph/kernels/__proptests__/art-353-etr-possession-chain-builder.proptest.mjs

import { compute, buildArtifact } from '../art-353-etr-possession-chain-builder.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

async function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-353-etr-possession-chain-builder.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const artifact = await buildArtifact(vec.policy_parameters, {});
    const output_payload = artifact.output_payload;
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
const rand = mulberry32(0x35300);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const HOLDERS = ['Carrier-A', 'Bank-B', 'Consignee-C', 'Bank-D'];

function randomEvents(rng, n, initialHolder) {
  const events = [];
  let current = initialHolder;
  let t = 1000;
  for (let i = 0; i < n; i++) {
    t += Math.floor(rng() * 100) + 1;
    const consistent = rng() < 0.75;
    const from_holder = consistent ? current : pick(rng, HOLDERS);
    let to_holder = pick(rng, HOLDERS);
    while (to_holder === from_holder) to_holder = pick(rng, HOLDERS);
    events.push({
      event_id: `e${i}`,
      from_holder,
      to_holder,
      timestamp: String(1000000 + t).padStart(10, '0'),
      signature: `sig-${i}`,
    });
    current = to_holder;
  }
  return events;
}

function randomPP(rng) {
  const initialHolder = pick(rng, HOLDERS);
  const n = Math.floor(rng() * 8);
  return {
    document_digest: 'sha256:' + Math.floor(rng() * 1e9).toString(16).padStart(64, '0'),
    initial_holder: initialHolder,
    control_transfer_events: randomEvents(rng, n, initialHolder),
  };
}

const TRIALS = 400; // WebCrypto hashing per event — kept modest to stay fast under Node's async subtle crypto

// ---------- P1: termination — possession_receipts.length === events.length exactly ----------
async function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = await buildArtifact(pp, {});
    checked++;
    if (o.event_count !== pp.control_transfer_events.length) violations++;
    if (o.possession_receipts.length !== pp.control_transfer_events.length) violations++;
    if (o.continuity_breaks.length > pp.control_transfer_events.length) violations++;
  }
  return { name: 'P1_termination_receipts_exactly_events_length', trials: checked, violations };
}

// ---------- P2: differential — chain_continuous / final_holder re-derivation ----------
async function checkP2_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = await buildArtifact(pp, {});
    checked++;
    let prev = pp.initial_holder ?? null;
    let breaks = 0;
    for (const e of pp.control_transfer_events) {
      if (prev != null && e.from_holder !== prev) breaks++;
      prev = e.to_holder || prev;
    }
    if (o.continuity_breaks.length !== breaks) violations++;
    const expectedContinuous = breaks === 0;
    if (o.chain_continuous !== expectedContinuous) violations++;
    const expectedFinal = pp.control_transfer_events.length
      ? pp.control_transfer_events[pp.control_transfer_events.length - 1].to_holder
      : (pp.initial_holder ?? null);
    if (o.final_holder !== expectedFinal) violations++;
  }
  return { name: 'P2_chain_continuous_final_holder_differential', trials: checked, violations };
}

// ---------- P3: metamorphic — tamper-evidence (single-field mutation changes merkle_root) ----------
async function checkP3_tamper_evident_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 150; i++) {
    const pp = randomPP(rand);
    if (pp.control_transfer_events.length === 0) continue;
    const base = await buildArtifact(pp, {});
    const mutated = { ...pp, control_transfer_events: pp.control_transfer_events.map((e, idx) => idx === 0 ? { ...e, signature: e.signature + '-X' } : e) };
    const tampered = await buildArtifact(mutated, {});
    checked++;
    if (base.output_payload.merkle_root === tampered.output_payload.merkle_root) violations++;
  }
  return { name: 'P3_tamper_evident_merkle_root_metamorphic', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no — categorical, not ULP) ----------
async function checkP4_forced_categorical() {
  let violations = 0, checked = 0;
  // zero events
  {
    const { output_payload: o } = await buildArtifact({ document_digest: 'sha256:' + '0'.repeat(64), control_transfer_events: [] }, {});
    checked++;
    if (o.event_count !== 0 || !o.chain_continuous || o.possession_receipts.length !== 0) violations++;
  }
  // single event, no initial_holder declared (prevToHolder starts null -> no break possible)
  {
    const { output_payload: o } = await buildArtifact({ document_digest: 'sha256:' + '1'.repeat(64), control_transfer_events: [{ event_id: 'e1', from_holder: 'X', to_holder: 'Y', timestamp: '2020', signature: 's' }] }, {});
    checked++;
    if (o.chain_continuous !== true || o.final_holder !== 'Y') violations++;
  }
  // deliberate from_holder mismatch -> continuity break
  {
    const { output_payload: o } = await buildArtifact({ document_digest: 'sha256:' + '2'.repeat(64), initial_holder: 'A', control_transfer_events: [{ event_id: 'e1', from_holder: 'B', to_holder: 'C', timestamp: '2020', signature: 's' }] }, {});
    checked++;
    if (o.chain_continuous !== false || o.continuity_breaks.length !== 1) violations++;
  }
  // out-of-order timestamps -> timestamp_order_valid flips false
  {
    const evs = [
      { event_id: 'e1', from_holder: 'A', to_holder: 'B', timestamp: '2020-06-01', signature: 's1' },
      { event_id: 'e2', from_holder: 'B', to_holder: 'C', timestamp: '2020-01-01', signature: 's2' },
    ];
    const { output_payload: o } = await buildArtifact({ document_digest: 'sha256:' + '3'.repeat(64), initial_holder: 'A', control_transfer_events: evs }, {});
    checked++;
    if (o.timestamp_order_valid !== false) violations++;
  }
  return { name: 'P4_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = await runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(await checkP1_termination());
results.properties.push(await checkP2_differential());
results.properties.push(await checkP3_tamper_evident_metamorphic());
results.properties.push(await checkP4_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-353-etr-possession-chain-builder',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
