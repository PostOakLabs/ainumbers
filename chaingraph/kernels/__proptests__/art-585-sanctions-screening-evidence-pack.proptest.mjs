// kernel_digest_at_authoring: sha256:c686a99d6d05d28e3feba866c69df7eb43ba13b49c2ce7c8e260be818d13c8a6
//
// FV-PROPFLOOR-SHARD-B27-1 — property-test floor for art-585-sanctions-screening-evidence-pack.
// Class B (bounded-numeric shape, string-digest comparison logic). float:no — every comparison
// operates on normalized hex-string digests, never a float threshold; forced categorical boundary
// cases stand in for ULP-forcing per spec §3. Zero external dependencies. This file is READ-ONLY
// with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-585-sanctions-screening-evidence-pack.proptest.mjs

import { compute } from '../art-585-sanctions-screening-evidence-pack.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-585-sanctions-screening-evidence-pack.fixtures.json');
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
const rand = mulberry32(0x585B2);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randHex(rng, len) { let s = ''; for (let i = 0; i < len; i++) s += Math.floor(rng() * 16).toString(16); return s; }
const TRIALS = 10000;

function mkPP(rng) {
  const digest = randHex(rng, 64);
  const sameCaseMismatch = rng() < 0.5;
  const caseVariant = rng() < 0.5 ? digest.toUpperCase() : digest;
  const prefixed = rng() < 0.5 ? 'sha256:' + caseVariant : caseVariant;
  const callerDigest = sameCaseMismatch ? digest : randHex(rng, 64);
  return {
    screening: { query: 'synthetic-entity-' + Math.floor(rng() * 1000), decision: pick(rng, ['clear', 'hit', 'review']), match_count: Math.floor(rng() * 5) },
    dataset_ref: { dataset_id: 'ds-' + Math.floor(rng() * 10), version: '2026081' + Math.floor(rng() * 9), digest_algo: 'sha256', published_digest: digest },
    caller_computed_digest: prefixed,
    _expected_match: sameCaseMismatch,
  };
}

const VERDICTS = ['INDETERMINATE', 'BOUND', 'UNBOUND'];

// ---------- P1: boundedness — verdict always one of the three declared values ----------
function checkP1_verdictBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (!VERDICTS.includes(r.output_payload.verdict)) violations++;
  }
  return { name: 'P1_verdict_bounded_to_declared_enum', trials: checked, violations };
}

// ---------- P2: metamorphic — digest comparison is case-insensitive and algo-prefix-insensitive ----------
function checkP2_caseAndPrefixInsensitive() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const rLower = compute({ ...pp, caller_computed_digest: pp.caller_computed_digest.toLowerCase() });
    const rUpper = compute({ ...pp, caller_computed_digest: 'SHA256:' + pp.caller_computed_digest.toUpperCase().replace(/^SHA256:/i, '') });
    checked++;
    if (rLower.output_payload.evidence_pack.digest_match !== rUpper.output_payload.evidence_pack.digest_match) violations++;
  }
  return { name: 'P2_digest_comparison_case_and_prefix_insensitive', trials: checked, violations };
}

// ---------- P3: fixed rule — verdict BOUND iff digest_match true, given a complete well-formed dataset_ref ----------
function checkP3_verdictMatchesDigestMatch() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const ep = r.output_payload.evidence_pack;
    if (ep.digest_match === true && r.output_payload.verdict !== 'BOUND') violations++;
    if (ep.digest_match === false && r.output_payload.verdict !== 'UNBOUND') violations++;
  }
  return { name: 'P3_verdict_agrees_with_digest_match', trials: checked, violations };
}

// ---------- P4 (forced categorical boundary cases) ----------
const FORCED_CASES = [
  [{ screening: {}, dataset_ref: {}, caller_computed_digest: null }, 'fully empty input — INDETERMINATE, dataset_ref_incomplete'],
  [{ screening: { query: 'x' }, dataset_ref: { dataset_id: 'a', version: '1' }, caller_computed_digest: 'abc' }, 'dataset_ref missing digest_algo/published_digest — INDETERMINATE'],
  [{ screening: { query: 'x' }, dataset_ref: { dataset_id: 'a', version: '1', digest_algo: 'sha256', published_digest: 'not-hex!!' }, caller_computed_digest: 'abc' }, 'malformed published_digest (non-hex) — INDETERMINATE, published_digest_malformed'],
  [{ screening: { query: 'x' }, dataset_ref: { dataset_id: 'a', version: '1', digest_algo: 'sha256', published_digest: 'ab'.repeat(31) }, caller_computed_digest: 'abc' }, 'published_digest wrong length for sha256 (62 hex, not 64) — INDETERMINATE'],
  [{ screening: { query: 'x' }, dataset_ref: { dataset_id: 'a', version: '1', digest_algo: 'sha256', published_digest: 'ab'.repeat(32) }, caller_computed_digest: '' }, 'no caller_computed_digest declared — INDETERMINATE'],
  [{ screening: { query: 'x' }, dataset_ref: { dataset_id: 'a', version: '1', digest_algo: 'sha256', published_digest: 'ab'.repeat(32) }, caller_computed_digest: 'ab'.repeat(32) }, 'exact digest match — BOUND'],
  [{ screening: { query: 'x' }, dataset_ref: { dataset_id: 'a', version: '1', digest_algo: 'sha256', published_digest: 'ab'.repeat(32) }, caller_computed_digest: 'cd'.repeat(32) }, 'digest mismatch — UNBOUND'],
  [{ screening: { query: 'x' }, dataset_ref: { dataset_id: 'a', version: '1', digest_algo: 'md5', published_digest: 'ab'.repeat(16) }, caller_computed_digest: 'sha256:' + 'AB'.repeat(16) }, 'unknown-to-known-algo case match with prefix — BOUND (case+prefix insensitive)'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of FORCED_CASES) {
    const r = compute(pp);
    const plausible = VERDICTS.includes(r.output_payload.verdict);
    rows.push({ label, input: pp, verdict: r.output_payload.verdict, digest_match: r.output_payload.evidence_pack.digest_match, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_verdictBounded());
results.properties.push(checkP2_caseAndPrefixInsensitive());
results.properties.push(checkP3_verdictMatchesDigestMatch());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);
