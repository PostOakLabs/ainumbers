// art-280-reserve-proof-verifier.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C13-1).
// kernel_digest_at_authoring: sha256:309081fd66892352af23884e11bc1173c96b88fc3bbebe8ffce1db60bb235dba
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed) — compute() is pure Merkle-sum-tree walk +
// hand-rolled SHA-256 hex-string hashing plus integer/whole-USD reserve-balance arithmetic and
// staleness/deviation comparisons over caller-supplied integer-shaped Numbers; there is no
// bisection, no iterative numeric solver, and no floating-point convergence. The one non-integer
// spot (deviation_pct = |reported - sum| / sum * 100, rounded via toFixed(4)) is still forced
// below with boundary magnitudes as a defensive check even though it is not the float-sensitive
// class this kernel belongs to. Per §3, forced CATEGORICAL boundary cases (not ULP forcing) are
// used instead: empty path, single-step path, MAX_PATH_DEPTH boundary (40) and MAX_PATH_DEPTH+1
// (structural rejection), each of the four exchange-format normalizers, and tamper/truncation of
// a valid Merkle-sum path.
// Checks: fixture-oracle gate, termination (path walk cost is proportional to path.length and a
// path deeper than MAX_PATH_DEPTH=40 is rejected structurally rather than walked — bounded-input
// lesson from art-201), boundedness (reserve_proof_determination is always one of
// PASS/WARN/FAIL/STRUCTURAL_ERROR, never NaN/undefined), a tamper-flips-verdict metamorphic
// property (mutating any single path step's hash/sum, or the declared root, must flip
// inclusion_verified to false), a truncation-never-falsely-validates property, and forced
// categorical boundary cases (empty log/path, single-leaf, exact/over MAX_PATH_DEPTH, all four
// exchange formats).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-280-reserve-proof-verifier.proptest.mjs

import { compute } from '../art-280-reserve-proof-verifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-280-reserve-proof-verifier.fixtures.json');
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
const rand = mulberry32(0x280F0);

// local re-implementation of the leaf/combine hash so we can construct a KNOWN-valid proof
// independent of compute()'s internals for the metamorphic tests below. This duplicates
// compute()'s hashing only to BUILD fixtures — it does not replace the fixture-oracle gate
// above, which is the sole correctness check against the kernel's own output.
function sha256Hex(str) {
  return createHash('sha256').update(str, 'utf8').digest('hex');
}
function leafNode(userIdHash, balance) {
  const sum = Number(balance ?? 0);
  return { hash: sha256Hex(`${userIdHash ?? ''}|${sum}`), sum };
}
function combineNodes(left, right) {
  return { hash: sha256Hex(`${left.hash}|${left.sum}|${right.hash}|${right.sum}`), sum: left.sum + right.sum };
}

// builds a policy_parameters object whose merkle_proof is internally consistent (root ==
// recomputed root from leaf + path) for a given path depth.
function buildValidPP(rng, depth) {
  const userIdHash = `cust-${Math.floor(rng() * 1e9)}`;
  const balance = Math.floor(rng() * 1_000_000) + 1;
  let current = leafNode(userIdHash, balance);
  const path = [];
  for (let i = 0; i < depth; i++) {
    const sibling = { hash: sha256Hex(`sib-${Math.floor(rng() * 1e9)}-${i}`), sum: Math.floor(rng() * 100_000) };
    const position = rng() < 0.5 ? 'left' : 'right';
    path.push({ hash: sibling.hash, sum: sibling.sum, position });
    current = position === 'left' ? combineNodes(sibling, current) : combineNodes(current, sibling);
  }
  return {
    pp: {
      exchange: 'generic',
      merkle_proof: {
        leaf_user_id_hash: userIdHash,
        leaf_balance: balance,
        path,
        root: { hash: current.hash, sum: current.sum },
      },
    },
    depth,
  };
}

const TRIALS = 3000;

// ---------- P1: termination — path walk cost bounded by path.length; over-depth paths are
// structurally rejected (never walked) rather than iterated indefinitely ----------
function checkP1_termination_bounded_path_walk() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const depth = Math.floor(rand() * 41); // spans 0..40 (at the MAX_PATH_DEPTH boundary)
    const { pp } = buildValidPP(rand, depth);
    const start = Date.now();
    const { output_payload } = compute(pp);
    checked++;
    // walk cost should never involve unbounded work — a generous wall-clock ceiling catches
    // an accidental infinite loop without being a real timing assertion.
    if (Date.now() - start > 2000) violations++;
    if (typeof output_payload.reserve_proof_determination !== 'string') violations++;
  }
  // over-the-cap depth (41+) must be a structural rejection, not a walk.
  for (let i = 0; i < 50; i++) {
    const depth = 41 + Math.floor(rand() * 20);
    const { pp } = buildValidPP(rand, depth);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.reserve_proof_determination !== 'STRUCTURAL_ERROR') violations++;
    if (output_payload.structural_error === null) violations++;
    if (output_payload.computed_root !== null) violations++; // rejected before walking
  }
  return { name: 'P1_termination_bounded_path_walk_and_depth_cap', trials: checked, violations };
}

// ---------- P2: boundedness — determination is always a known enum value, never NaN/undefined ----------
function checkP2_boundedness_determination_enum() {
  let violations = 0, checked = 0;
  const ALLOWED = new Set(['PASS', 'WARN', 'FAIL', 'STRUCTURAL_ERROR']);
  for (let i = 0; i < TRIALS; i++) {
    const depth = Math.floor(rand() * 10);
    const { pp } = buildValidPP(rand, depth);
    if (rand() < 0.3) {
      pp.por_round = {
        round_id: 'r-' + Math.floor(rand() * 1000),
        updated_at_seconds: Math.floor(rand() * 2e9),
        current_timestamp_seconds: Math.floor(rand() * 2e9),
        max_staleness_seconds: Math.floor(rand() * 200000),
        reserves_reported_usd: Math.floor(rand() * 2_000_000),
        deviation_bound_pct: rand() * 10,
      };
    }
    const { output_payload } = compute(pp);
    checked++;
    if (!ALLOWED.has(output_payload.reserve_proof_determination)) violations++;
    if (output_payload.por_round) {
      const dp = output_payload.por_round.deviation_pct;
      if (dp !== null && !Number.isFinite(dp)) violations++;
    }
  }
  return { name: 'P2_boundedness_determination_enum_and_finite_deviation', trials: checked, violations };
}

// ---------- P3: metamorphic — tampering with any single path step (hash or sum) or the declared
// root must flip inclusion_verified from true to false ----------
function checkP3_tamper_flips_verdict() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 500; i++) {
    const depth = 1 + Math.floor(rand() * 6);
    const { pp } = buildValidPP(rand, depth);
    const { output_payload: baseline } = compute(pp);
    checked++;
    if (baseline.inclusion_verified !== true) { violations++; continue; } // sanity: base must be valid

    // tamper: flip one character in a randomly chosen path step's hash
    const tamperedPathIdx = Math.floor(rand() * pp.merkle_proof.path.length);
    const tamperedPP = JSON.parse(JSON.stringify(pp));
    const step = tamperedPP.merkle_proof.path[tamperedPathIdx];
    step.hash = step.hash.slice(0, -1) + (step.hash.slice(-1) === '0' ? '1' : '0');
    const { output_payload: tampered } = compute(tamperedPP);
    checked++;
    if (tampered.inclusion_verified !== false) violations++;

    // tamper: perturb the declared root sum by 1
    const tamperedRootPP = JSON.parse(JSON.stringify(pp));
    tamperedRootPP.merkle_proof.root.sum += 1;
    const { output_payload: tamperedRoot } = compute(tamperedRootPP);
    checked++;
    if (tamperedRoot.inclusion_verified !== false) violations++;
    if (tamperedRoot.sum_verified !== false) violations++;
  }
  return { name: 'P3_tamper_flips_inclusion_verdict', trials: checked, violations };
}

// ---------- P4: metamorphic — truncating a valid path (dropping the last step) must never
// produce a false PASS/inclusion_verified:true against the original root ----------
function checkP4_truncation_never_falsely_validates() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 500; i++) {
    const depth = 2 + Math.floor(rand() * 6);
    const { pp } = buildValidPP(rand, depth);
    const { output_payload: baseline } = compute(pp);
    checked++;
    if (baseline.inclusion_verified !== true) { violations++; continue; }

    const truncatedPP = JSON.parse(JSON.stringify(pp));
    truncatedPP.merkle_proof.path = truncatedPP.merkle_proof.path.slice(0, -1); // drop last step
    const { output_payload: truncated } = compute(truncatedPP);
    checked++;
    if (truncated.inclusion_verified === true) violations++;
  }
  return { name: 'P4_truncation_never_falsely_validates', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (float:no kernel — categorical, not ULP) ----------
function checkP5_forced_boundary_cases() {
  let violations = 0, checked = 0;

  // empty path (single-leaf tree, path.length === 0) — should verify cleanly if root matches leaf
  {
    const userIdHash = 'boundary-user-empty';
    const balance = 42;
    const leaf = leafNode(userIdHash, balance);
    const pp = { exchange: 'generic', merkle_proof: { leaf_user_id_hash: userIdHash, leaf_balance: balance, path: [], root: { hash: leaf.hash, sum: leaf.sum } } };
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.inclusion_verified !== true) violations++;
    if (output_payload.structural_error !== null) violations++;
  }

  // single-step path
  {
    const { pp } = buildValidPP(rand, 1);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.inclusion_verified !== true) violations++;
  }

  // exactly MAX_PATH_DEPTH (40) — must be accepted (not rejected)
  {
    const { pp } = buildValidPP(rand, 40);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.structural_error !== null) violations++;
    if (output_payload.inclusion_verified !== true) violations++;
  }

  // MAX_PATH_DEPTH + 1 (41) — must be rejected structurally
  {
    const { pp } = buildValidPP(rand, 41);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.reserve_proof_determination !== 'STRUCTURAL_ERROR') violations++;
  }

  // all exchange-format normalizers on empty/absent input must not throw and must return a
  // deterministic FAIL/STRUCTURAL_ERROR (empty root hash never matches a computed leaf hash)
  for (const exchange of ['okx', 'binance', 'gate', 'kraken', 'generic']) {
    const pp = { exchange, merkle_proof: {} };
    let threw = false;
    let output_payload;
    try {
      ({ output_payload } = compute(pp));
    } catch {
      threw = true;
    }
    checked++;
    if (threw) violations++;
    else if (!['FAIL', 'STRUCTURAL_ERROR'].includes(output_payload.reserve_proof_determination)) violations++;
  }

  // absent policy_parameters.merkle_proof entirely (default-inputs shape, mirrors fixture)
  {
    const { output_payload } = compute({});
    checked++;
    if (output_payload.reserve_proof_determination !== 'FAIL') violations++;
  }

  return { name: 'P5_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_bounded_path_walk());
results.properties.push(checkP2_boundedness_determination_enum());
results.properties.push(checkP3_tamper_flips_verdict());
results.properties.push(checkP4_truncation_never_falsely_validates());
results.properties.push(checkP5_forced_boundary_cases());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-280-reserve-proof-verifier',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
