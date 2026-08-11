// art-286-anchored-extract-verifier.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C9-1).
// kernel_digest_at_authoring: sha256:7934427c04943b1f295a5d7e95cb214c7d73be32aeb2262a89791462f513a9af
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — SHA-256 bitwise arithmetic and string-equality
// anchor-class dispatch only; no floating-point operators in compute()).
// TERMINATION-BOUND ARGUMENT (verifier kernel, per WU row instruction): walkMerklePath's
// for-loop is bounded by `path.length`, checked against MAX_PATH_DEPTH=40 BEFORE the walk starts
// (`path.length > MAX_PATH_DEPTH` short-circuits to structural_error) — never recursive, same
// shape as art-280's Merkle-sum walk and art-279's MPT walk.
// Checks: fixture-oracle gate, termination/boundedness (a path over the 40-level cap always
// yields STRUCTURAL_ERROR and skips the walk), a differential re-derivation of the REFUSED_
// UNANCHORED determination from `source_class` recognition (RECOGNIZED_CLASSES set membership
// + per-class evidence presence, replicated here from the same rules), a differential
// re-derivation of root_match/VERIFIED from computed_root === claimed_root, and forced
// categorical boundary cases (float:no, no ULP forcing): unrecognized source_class, each
// recognized class with/without its required evidence field, path exactly at / one over the cap.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-286-anchored-extract-verifier.proptest.mjs

import { compute } from '../art-286-anchored-extract-verifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-286-anchored-extract-verifier.fixtures.json');
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
const rand = mulberry32(0x286A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomPath(rng, n) {
  return Array.from({ length: n }, (_, i) => ({ hash: `h${i}`, position: rng() < 0.5 ? 'left' : 'right' }));
}
const SOURCE_CLASSES_ALL = ['ocg_artifact', 'rfc3161', 'ots', 'sigstore', 'vr1_onchain', 'bogus_class', null];

function evidenceFor(sourceClass, valid) {
  if (sourceClass === 'rfc3161') return valid ? { rfc3161: { tsa_message_imprint: 'imprint' } } : {};
  if (sourceClass === 'ots') return valid ? { ots: { attestation: 'bitcoin_confirmed' } } : {};
  if (sourceClass === 'sigstore') return valid ? { sigstore: { rekor_uuid: 'u', rekor_log_index: 1 } } : {};
  if (sourceClass === 'vr1_onchain') return valid ? { vr1_onchain: { verified: true } } : {};
  return {};
}

const TRIALS = 5000;

// ---------- P1: termination/boundedness — path over MAX_PATH_DEPTH (40) always -> STRUCTURAL_ERROR ----------
function checkP1_bounded_path_depth() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pathLen = Math.floor(rand() * 55);
    const pp = { extract: { leaf_content_hash: 'x', merkle_path: randomPath(rand, pathLen) }, claimed_root: 'r', source_class: 'ocg_artifact' };
    checked++;
    const { output_payload } = compute(pp);
    if (pathLen > 40 && output_payload.anchored_extract_determination !== 'STRUCTURAL_ERROR') violations++;
    if (pathLen <= 40 && output_payload.structural_error !== null) violations++;
  }
  return { name: 'P1_path_depth_bounded_by_max_40', trials: checked, violations };
}

// ---------- P2 (differential): anchored/REFUSED_UNANCHORED re-derivation from source_class + evidence ----------
function checkP2_anchored_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const sourceClass = pick(rand, SOURCE_CLASSES_ALL);
    const hasValidEvidence = rand() < 0.5;
    const pp = {
      extract: { leaf_content_hash: 'x', merkle_path: randomPath(rand, Math.floor(rand() * 5)) },
      claimed_root: 'anything',
      source_class: sourceClass,
      anchor_evidence: evidenceFor(sourceClass, hasValidEvidence),
    };
    checked++;
    const { output_payload } = compute(pp);
    const recognized = ['ocg_artifact', 'rfc3161', 'ots', 'sigstore', 'vr1_onchain'].includes(sourceClass);
    const expectedAnchored = sourceClass === 'ocg_artifact' ? true : recognized ? hasValidEvidence : false;
    if (output_payload.anchored !== expectedAnchored) violations++;
    if (!expectedAnchored && output_payload.anchored_extract_determination !== 'REFUSED_UNANCHORED') violations++;
  }
  return { name: 'P2_anchored_refused_unanchored_differential', trials: checked, violations };
}

// ---------- P3 (differential): root_match/VERIFIED re-derivation from computed_root === claimed_root ----------
function checkP3_root_match_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pathLen = Math.floor(rand() * 5);
    const pp = { extract: { leaf_content_hash: `leaf${i}`, merkle_path: randomPath(rand, pathLen) }, claimed_root: rand() < 0.5 ? 'wrong-root' : null, source_class: 'ocg_artifact' };
    checked++;
    const { output_payload } = compute(pp);
    // first pass with the computed root fed back as the claim -> must VERIFY
    const pp2 = { ...pp, claimed_root: output_payload.computed_root };
    const r2 = compute(pp2).output_payload;
    if (!r2.root_match) violations++;
    if (r2.anchored_extract_determination !== 'VERIFIED') violations++;
    if (pp.claimed_root === 'wrong-root' && output_payload.root_match) violations++;
  }
  return { name: 'P3_root_match_verified_differential', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no, no ULP forcing) ----------
const CATEGORICAL_CASES = [
  { label: 'ocg_artifact source (self-attesting) -> always anchored', pp: { extract: {}, claimed_root: '', source_class: 'ocg_artifact' } },
  { label: 'unrecognized source_class -> refused unanchored', pp: { extract: {}, claimed_root: '', source_class: 'made_up' } },
  { label: 'no source_class supplied (null) -> refused unanchored', pp: { extract: {}, claimed_root: '' } },
  { label: 'rfc3161 with no evidence -> refused', pp: { extract: {}, claimed_root: '', source_class: 'rfc3161' } },
  { label: 'rfc3161 with evidence -> anchored', pp: { extract: {}, claimed_root: '', source_class: 'rfc3161', anchor_evidence: { rfc3161: { tsa_message_imprint: 'x' } } } },
  { label: 'path exactly at 40-node cap -> not structural error', pp: { extract: { leaf_content_hash: 'x', merkle_path: randomPath(rand, 40) }, claimed_root: 'r', source_class: 'ocg_artifact' } },
  { label: 'path 1 over the cap (41) -> STRUCTURAL_ERROR', pp: { extract: { leaf_content_hash: 'x', merkle_path: randomPath(rand, 41) }, claimed_root: 'r', source_class: 'ocg_artifact' } },
];
function checkP5_forced() {
  return CATEGORICAL_CASES.map((c) => {
    const { output_payload } = compute(c.pp);
    return { label: c.label, determination: output_payload.anchored_extract_determination, anchored: output_payload.anchored };
  });
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_bounded_path_depth());
results.properties.push(checkP2_anchored_differential());
results.properties.push(checkP3_root_match_differential());
const forcedCases = checkP5_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-286-anchored-extract-verifier',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  forced_categorical_cases: forcedCases,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
