// art-308-pld-disclosure-pack-builder.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C11-1).
// kernel_digest_at_authoring: sha256:4d73f240d1e0e36ad7081116436c2a27d5b2c23d184cc4269306079ed753ccfb
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — string sort/join and array filter only, no
// arithmetic comparison anywhere in the kernel).
// Checks: fixture-oracle gate, termination (hashes bounded by receipts.length), differential
// re-derivation of trace_digest/gap_in_window, boundedness (rebuttal_mapping fixed at 2 rows,
// rebutting_receipts subset of receipts), and metamorphic permutation-invariance (shuffling
// input receipts leaves trace_digest and rebuttal_mapping content unchanged since hashes are
// sorted before joining).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-308-pld-disclosure-pack-builder.proptest.mjs

import { compute } from '../art-308-pld-disclosure-pack-builder.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-308-pld-disclosure-pack-builder.fixtures.json');
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
const rand = mulberry32(0x308B0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const TRIGGERS = ['non_disclosure', 'ai_act_breach', 'other_trigger'];

function randomReceipts(rng, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const hasHash = rng() < 0.8;
    const rebuts = rng() < 0.5 ? [pick(rng, TRIGGERS)] : [];
    out.push({ receipt_hash: hasHash ? `rh-${i}` : '', rebuts });
  }
  return out;
}

function randomPP(rng) {
  const n = Math.floor(rng() * 8);
  return {
    disputed_window: { from: '2026-01-01', to: '2026-06-01' },
    product_ref: 'prod-x',
    receipts: randomReceipts(rng, n),
    alleged_defect: pick(rng, ['overheating', null]),
  };
}

const TRIALS = 5000;

// ---------- P1: termination — hashes/trace bounded by input receipts.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const validHashCount = pp.receipts.filter((r) => typeof r.receipt_hash === 'string' && r.receipt_hash.length > 0).length;
    if (output_payload.trace_digest !== null) {
      const parts = output_payload.trace_digest.split(':');
      if (Number(parts[1]) !== validHashCount) violations++;
    } else if (validHashCount > 0) violations++;
  }
  return { name: 'P1_termination_trace_bounded_by_receipts', trials: checked, violations };
}

// ---------- P2 (differential): gap_in_window / insufficient_evidence re-derivation ----------
function checkP2_gap_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expectedGap = pp.receipts.length === 0;
    if (output_payload.gap_in_window !== expectedGap) violations++;
    if (output_payload.insufficient_evidence !== expectedGap) violations++;
  }
  return { name: 'P2_gap_in_window_differential', trials: checked, violations };
}

// ---------- P3: boundedness — rebuttal_mapping fixed at 2 rows, rebutting_receipts subset of input hashes ----------
function checkP3_rebuttal_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.rebuttal_mapping.length !== 2) violations++;
    const inputHashes = new Set(pp.receipts.map((r) => r.receipt_hash).filter((h) => typeof h === 'string'));
    for (const row of output_payload.rebuttal_mapping) {
      for (const h of row.rebutting_receipts) {
        if (!inputHashes.has(h)) violations++;
      }
    }
  }
  return { name: 'P3_rebuttal_mapping_bounded_and_subset', trials: checked, violations };
}

// ---------- P4: metamorphic — permutation-invariance of receipts order ----------
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    const shuffled = [...pp.receipts];
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    const r1 = compute(pp).output_payload;
    const r2 = compute({ ...pp, receipts: shuffled }).output_payload;
    checked++;
    if (r1.trace_digest !== r2.trace_digest) violations++;
    if (r1.gap_in_window !== r2.gap_in_window) violations++;
    const s1 = JSON.stringify(r1.rebuttal_mapping.map((m) => [...m.rebutting_receipts].sort()));
    const s2 = JSON.stringify(r2.rebuttal_mapping.map((m) => [...m.rebutting_receipts].sort()));
    if (s1 !== s2) violations++;
  }
  return { name: 'P4_permutation_invariance_on_receipts_order', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_gap_differential());
results.properties.push(checkP3_rebuttal_bounded());
results.properties.push(checkP4_permutation_invariance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-308-pld-disclosure-pack-builder',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
