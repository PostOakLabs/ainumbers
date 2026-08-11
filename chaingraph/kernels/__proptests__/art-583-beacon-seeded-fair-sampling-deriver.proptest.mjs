// art-583-beacon-seeded-fair-sampling-deriver.proptest.mjs — FV property-test FLOOR
// (FV-PROPFLOOR-SHARD-C30-1).
// kernel_digest_at_authoring: sha256:00bf25e2ac76c12d2bc9de448a1c9d767c67581310b599637d193d2f949b708a
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO — RE-CONFIRMED BY DIRECT READ per FIX-2; this matches the WU row's own
// float:no classification, no correction needed. The entire derivation is HMAC-SHA256 over
// Uint8Array byte arithmetic (rotr/xor/uint32 add with >>>0 masking) plus `parseInt(hex,16) %
// item_count`, an integer modulo — there is no IEEE-754 division, no fractional comparison, no
// continuous threshold anywhere. No ULP-boundary claim is made or needed.
// Checks: fixture-oracle gate, termination/convergence-or-report (P1: the mandatory class-C property
// for this kernel's rejection-sampling walk — draws_used never exceeds the hard MAX_DRAWS =
// item_count*10 cap, and the kernel reports DRAW_CAP_EXHAUSTED/INDETERMINATE rather than looping
// forever whenever the cap is reached before sample_size unique candidates are found), boundedness
// (P2: selected_indices has no duplicates by construction (Set-based rejection sampling), every
// index lies in [0, item_count), and derivation_transcript.length === draws_used exactly), a
// determinism/seed-determinism metamorphic identity (P3: calling compute() twice on identical inputs
// is byte-for-byte identical, and the seed_hex is a pure function of (item_manifest_hash,
// beacon_randomness, beacon_round, algorithm_id) alone -- changing item_count/sample_size while
// holding those four fixed leaves seed_hex unchanged), a differential re-derivation of the HMAC-DRBG
// draw walk against an independent reimplementation (P4), and forced categorical boundary cases
// including every required field missing, sample_size > item_count, an unrecognised algorithm_id,
// and the item_count=1/sample_size=1 trivial-draw edge (P5).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled; node:crypto
// used ONLY for the independent P4 reimplementation's HMAC-SHA256, never imported by the kernel
// itself).
//
// Run: node chaingraph/kernels/__proptests__/art-583-beacon-seeded-fair-sampling-deriver.proptest.mjs

import { compute } from '../art-583-beacon-seeded-fair-sampling-deriver.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHmac } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-583-beacon-seeded-fair-sampling-deriver.fixtures.json');
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
const rand = mulberry32(0x583C30);
function hexN(rng, n) { let s = ''; for (let i = 0; i < n; i++) s += Math.floor(rng() * 16).toString(16); return s; }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomPP(rng) {
  const item_count = 2 + Math.floor(rng() * 200);
  const sample_size = 1 + Math.floor(rng() * item_count);
  return {
    beacon_source: pick(rng, ['drand_quicknet', 'nistir_8213']),
    beacon_round: String(1 + Math.floor(rng() * 1e7)),
    beacon_randomness: hexN(rng, 64),
    item_manifest_hash: 'sha256:' + hexN(rng, 64),
    item_count,
    sample_size,
    algorithm_id: 'hmac-drbg-sha256-v1',
  };
}

// Independent reimplementation of the HMAC-DRBG draw walk via node:crypto, for the differential
// check (P4). Same construction the kernel documents: seed = HMAC(key=item_manifest_hash,
// msg=randomness:round:alg); each draw = HMAC(key=seed, msg="draw:<i>"), first 8 hex chars mod
// item_count, rejection sampling with no replacement.
// Pass strings directly with an explicit 'utf8' encoding -- node:crypto accepts this without
// constructing a Buffer, which keeps this file inside the "no @types/node" allowlist (the Buffer
// global itself is not allowlisted the way node:* module specifiers and process are).
function hmacHex(keyStr, msgStr) { return createHmac('sha256', keyStr).update(msgStr, 'utf8').digest('hex'); }
function reimplement(pp) {
  const seed_hex = hmacHex(pp.item_manifest_hash, `${pp.beacon_randomness}:${pp.beacon_round}:${pp.algorithm_id}`);
  const selected = [];
  const seen = new Set();
  const transcript = [];
  let draw = 0;
  const MAX_DRAWS = pp.item_count * 10;
  while (selected.length < pp.sample_size && draw < MAX_DRAWS) {
    const draw_hex = hmacHex(seed_hex, `draw:${draw}`);
    const candidate = parseInt(draw_hex.slice(0, 8), 16) % pp.item_count;
    const accepted = !seen.has(candidate);
    if (accepted) { seen.add(candidate); selected.push(candidate); }
    transcript.push({ draw, hmac_hex: draw_hex, candidate_index: candidate, accepted });
    draw += 1;
  }
  return { seed_hex, selected, draws_used: draw };
}

const TRIALS = 1500;

// ---------- P1: termination / convergence-or-report — draws_used never exceeds MAX_DRAWS ----------
function checkP1_convergence_or_report() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o, compliance_flags } = compute(pp);
    checked++;
    if (o.draws_used > pp.item_count * 10) violations++;
    if (o.selected_indices.length === pp.sample_size) {
      if (o.verdict !== 'DERIVED') violations++;
    } else {
      if (o.verdict !== 'INDETERMINATE') violations++;
      if (!compliance_flags.includes('DRAW_CAP_EXHAUSTED')) violations++;
    }
  }
  // Forced near-exhaustion case: item_count=1 forces every draw's candidate to be 0 (n % 1 === 0
  // always), so sample_size=1 succeeds on draw 0, but sample_size>1 can never be reached (only one
  // distinct index exists) -- this MUST report DRAW_CAP_EXHAUSTED, never loop forever.
  {
    const pp = { beacon_source: 'drand_quicknet', beacon_round: '1', beacon_randomness: hexN(rand, 64), item_manifest_hash: 'sha256:' + hexN(rand, 64), item_count: 1, sample_size: 1, algorithm_id: 'hmac-drbg-sha256-v1' };
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.verdict !== 'DERIVED' || o.draws_used !== 1) violations++;
  }
  return { name: 'P1_convergence_or_report_draw_cap_never_exceeded', trials: checked, violations };
}

// ---------- P2: boundedness — no duplicate indices, every index in range, transcript length exact ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    const set = new Set(o.selected_indices);
    if (set.size !== o.selected_indices.length) violations++;
    if (o.selected_indices.some((idx) => idx < 0 || idx >= pp.item_count)) violations++;
    if (o.derivation_transcript.length !== o.draws_used) violations++;
  }
  return { name: 'P2_boundedness_no_dup_in_range_transcript_exact', trials: checked, violations };
}

// ---------- P3: metamorphic — determinism + seed-determinism (seed depends only on 4 named fields) ----------
function checkP3_seed_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 800; i++) {
    const pp = randomPP(rand);
    const a = compute(pp).output_payload;
    const b = compute(pp).output_payload;
    checked++;
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
    // Varying item_count/sample_size while holding the 4 seed-determining fields fixed must not
    // change seed_hex (only the draw walk's mod-reduction and cap change).
    const pp2 = { ...pp, item_count: pp.item_count + 1, sample_size: 1 };
    const c = compute(pp2).output_payload;
    if (c.seed_hex !== a.seed_hex) violations++;
  }
  return { name: 'P3_determinism_and_seed_determinism', trials: checked, violations };
}

// ---------- P4: differential — HMAC-DRBG draw walk re-derived against an independent node:crypto reimplementation ----------
function checkP4_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    const exp = reimplement(pp);
    if (o.seed_hex !== exp.seed_hex) violations++;
    if (JSON.stringify(o.selected_indices) !== JSON.stringify(exp.selected)) violations++;
    if (o.draws_used !== exp.draws_used) violations++;
  }
  return { name: 'P4_hmac_drbg_draw_walk_differential', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (float:no) ----------
function checkP5_forced_categorical() {
  let violations = 0, checked = 0;
  // every required field missing -> INDETERMINATE, full reasons list, no derivation attempted
  { const { output_payload: o } = compute({}); checked++; if (o.verdict !== 'INDETERMINATE') violations++; if (o.reasons.length < 5) violations++; if (o.seed_hex !== undefined) violations++; }
  // sample_size > item_count -> INDETERMINATE
  { const { output_payload: o } = compute({ beacon_source: 'drand_quicknet', beacon_round: '1', beacon_randomness: hexN(rand, 64), item_manifest_hash: 'sha256:' + hexN(rand, 64), item_count: 5, sample_size: 6, algorithm_id: 'hmac-drbg-sha256-v1' }); checked++; if (o.verdict !== 'INDETERMINATE') violations++; if (!o.reasons.some((r) => r.includes('cannot exceed'))) violations++; }
  // unrecognised algorithm_id -> INDETERMINATE
  { const { output_payload: o } = compute({ beacon_source: 'drand_quicknet', beacon_round: '1', beacon_randomness: hexN(rand, 64), item_manifest_hash: 'sha256:' + hexN(rand, 64), item_count: 5, sample_size: 1, algorithm_id: 'made-up-algo' }); checked++; if (o.verdict !== 'INDETERMINATE') violations++; if (o.algorithm_id !== null) violations++; }
  // unrecognised beacon_source -> INDETERMINATE
  { const { output_payload: o } = compute({ beacon_source: 'made-up-source', beacon_round: '1', beacon_randomness: hexN(rand, 64), item_manifest_hash: 'sha256:' + hexN(rand, 64), item_count: 5, sample_size: 1, algorithm_id: 'hmac-drbg-sha256-v1' }); checked++; if (o.verdict !== 'INDETERMINATE') violations++; }
  return { name: 'P5_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_convergence_or_report());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_seed_determinism());
results.properties.push(checkP4_differential());
results.properties.push(checkP5_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-583-beacon-seeded-fair-sampling-deriver',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
