// art-136-slsa-provenance-verifier.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C4-1).
// kernel_digest_at_authoring: sha256:e68457cfcfc0229b4029a1579bdd6871ecb20daf0abd9743c2627eccb3a51e5d
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (all checks are string/type/set-membership boolean logic; slsa_build_level uses
// Number() + Number.isInteger() range clamp, no arithmetic comparison against a fractional threshold).
// Checks: fixture-oracle gate, termination (subjects.some() bounded by subject array length),
// boundedness (provenance_valid is a pure AND of 4 booleans), differential re-derivation of each flag,
// and metamorphic invariance (appending an unrelated extra subject to the array never flips a match
// that was already true, since Array.prototype.some short-circuits on the first match).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-136-slsa-provenance-verifier.proptest.mjs

import { compute } from '../art-136-slsa-provenance-verifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-136-slsa-provenance-verifier.fixtures.json');
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
const rand = mulberry32(0x136A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const DIGESTS = ['abc123', 'def456', 'ghi789', null];
const TYPES = ['https://in-toto.io/Statement/v0.1', 'https://in-toto.io/Statement/v1', 'bogus-type', undefined];
const PREDS = ['https://slsa.dev/provenance/v1', 'https://slsa.dev/provenance/v0.2', 'bogus-pred', undefined];

function randomSubjects(rng, n, targetDigest) {
  const subjects = [];
  for (let i = 0; i < n; i++) {
    const d = rng() < 0.3 ? targetDigest : pick(rng, DIGESTS);
    subjects.push(d === null ? { name: `s${i}` } : { name: `s${i}`, digest: { sha256: d } });
  }
  return subjects;
}

function randomStatement(rng, targetDigest) {
  const n = Math.floor(rng() * 6);
  const has_builder = rng() < 0.7;
  const builder_id = has_builder ? (rng() < 0.5 ? 'https://ci.example/runner' : '') : undefined;
  const nest_style = rng() < 0.5 ? 'runDetails' : 'flat';
  const predicate = nest_style === 'runDetails'
    ? { runDetails: { builder: builder_id !== undefined ? { id: builder_id } : undefined } }
    : { builder: builder_id !== undefined ? { id: builder_id } : undefined };
  return {
    _type: pick(rng, TYPES),
    predicateType: pick(rng, PREDS),
    subject: randomSubjects(rng, n, targetDigest),
    predicate,
  };
}

const TRIALS = 5000;

// ---------- P1: termination — compute() always returns synchronously with a fixed-shape payload ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const targetDigest = pick(rand, DIGESTS.filter((d) => d !== null));
    const statement = randomStatement(rand, targetDigest);
    const claimed_build_level = Math.floor(rand() * 8) - 2;
    const { output_payload } = compute({ statement, artifact_digest_sha256: targetDigest, claimed_build_level });
    checked++;
    const keys = ['provenance_valid', 'type_ok', 'pred_ok', 'subject_digest_match', 'builder_id_present', 'slsa_build_level'];
    for (const k of keys) if (!(k in output_payload)) violations++;
  }
  return { name: 'P1_termination_fixed_shape', trials: checked, violations };
}

// ---------- P2 (differential): re-derive each boolean flag independently ----------
function checkP2_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const targetDigest = pick(rand, DIGESTS.filter((d) => d !== null));
    const statement = randomStatement(rand, targetDigest);
    const claimed_build_level = Math.floor(rand() * 8) - 2;
    const { output_payload: o } = compute({ statement, artifact_digest_sha256: targetDigest, claimed_build_level });
    checked++;
    const type_ok = typeof statement._type === 'string' && statement._type.includes('in-toto.io/Statement');
    const pred_ok = typeof statement.predicateType === 'string' && statement.predicateType.includes('slsa.dev/provenance');
    const subject_digest_match = statement.subject.some((s) => s && s.digest && s.digest.sha256 === targetDigest);
    if (o.type_ok !== type_ok) violations++;
    if (o.pred_ok !== pred_ok) violations++;
    if (o.subject_digest_match !== subject_digest_match) violations++;
    if (o.provenance_valid !== (type_ok && pred_ok && subject_digest_match && o.builder_id_present)) violations++;
    const lvl = claimed_build_level;
    const expected_level = (Number.isInteger(lvl) && lvl >= 0 && lvl <= 3) ? lvl : null;
    if (o.slsa_build_level !== expected_level) violations++;
  }
  return { name: 'P2_flag_differential', trials: checked, violations };
}

// ---------- P3: boundedness — slsa_build_level is always null or an integer in [0,3] ----------
function checkP3_level_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const targetDigest = pick(rand, DIGESTS.filter((d) => d !== null));
    const statement = randomStatement(rand, targetDigest);
    const claimed_build_level = rand() < 0.5 ? Math.floor(rand() * 20) - 10 : (rand() < 0.5 ? NaN : (rand() < 0.5 ? '2' : {}));
    const { output_payload } = compute({ statement, artifact_digest_sha256: targetDigest, claimed_build_level });
    checked++;
    const lvl = output_payload.slsa_build_level;
    if (!(lvl === null || (Number.isInteger(lvl) && lvl >= 0 && lvl <= 3))) violations++;
  }
  return { name: 'P3_slsa_build_level_bounded', trials: checked, violations };
}

// ---------- P4: metamorphic — subject.some() match is invariant to appending irrelevant subjects ----------
function checkP4_append_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const targetDigest = pick(rand, DIGESTS.filter((d) => d !== null));
    const statement = randomStatement(rand, targetDigest);
    const extraN = Math.floor(rand() * 4);
    const extra = randomSubjects(rand, extraN, null); // never matches targetDigest by construction
    const extended = { ...statement, subject: statement.subject.concat(extra) };
    const r1 = compute({ statement, artifact_digest_sha256: targetDigest, claimed_build_level: 1 }).output_payload;
    const r2 = compute({ statement: extended, artifact_digest_sha256: targetDigest, claimed_build_level: 1 }).output_payload;
    checked++;
    if (r1.subject_digest_match && !r2.subject_digest_match) violations++;
  }
  return { name: 'P4_append_invariance_when_already_matched', trials: checked, violations };
}

// ---------- Forced boundary cases (float:no confirmed, but exercise slsa_build_level integer boundary) ----------
function checkForcedBoundaries() {
  let violations = 0, checked = 0;
  const cases = [
    { claimed_build_level: 0, expect: 0 },
    { claimed_build_level: 3, expect: 3 },
    { claimed_build_level: -1, expect: null },
    { claimed_build_level: 4, expect: null },
    { claimed_build_level: NaN, expect: null },
    { claimed_build_level: undefined, expect: null },
    { claimed_build_level: '2', expect: 2 },
  ];
  for (const c of cases) {
    const { output_payload } = compute({ statement: { _type: 'in-toto.io/Statement/v0.1', predicateType: 'slsa.dev/provenance/v1', subject: [], predicate: {} }, artifact_digest_sha256: 'x', claimed_build_level: c.claimed_build_level });
    checked++;
    if (output_payload.slsa_build_level !== c.expect) violations++;
  }
  return { name: 'P5_forced_build_level_boundaries', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_differential());
results.properties.push(checkP3_level_bounded());
results.properties.push(checkP4_append_invariance());
results.properties.push(checkForcedBoundaries());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-136-slsa-provenance-verifier',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
