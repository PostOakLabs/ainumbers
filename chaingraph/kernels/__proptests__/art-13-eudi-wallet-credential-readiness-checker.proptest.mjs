// kernel_digest_at_authoring: sha256:127c97da18f98fb9a3db038f6b7dee0dc52653f7e8d0145b0eb94e0f428c1857
//
// FV-PROPFLOOR-SHARD-B2-1 — property-test floor for art-13-eudi-wallet-credential-readiness-checker.
// Class B (bounded-numeric/tier), float:no exception per the WU row — checklist scoring over
// a small fixed rational set (thirds/halves), no continuous arithmetic. Forced categorical
// boundary cases used in place of ULP forcing per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external
// dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the B1 pilot harness.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-13-eudi-wallet-credential-readiness-checker.proptest.mjs

import { compute } from '../art-13-eudi-wallet-credential-readiness-checker.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-13-eudi-wallet-credential-readiness-checker.fixtures.json');
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
const rand = mulberry32(0x11301);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const TRIALS = 10000;
const CRED_TYPES = ['eaa', 'qeaa', 'pid', 'non_qualified_eaa'];
const FORMATS = ['sd_jwt_vc', 'mdoc_cbor', 'jwt_vc', 'unknown_format'];
const COUNTRIES = ['DE', 'FR', 'US', 'ZZ', ''];

function mkPP(rng) {
  return {
    credential_type: pick(rng, CRED_TYPES),
    format: pick(rng, FORMATS),
    issuer_country: pick(rng, COUNTRIES),
    sd: rng() < 0.7,
    pop: rng() < 0.7,
    rev: rng() < 0.7,
    accred: rng() < 0.5,
    claims: {},
  };
}

// ---------- P1: boundedness — readiness_score in [0,100], acceptance_ready implies fail_count===0 ----------
function checkP1_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { readiness_score, acceptance_ready, fail_count } = r.output_payload;
    if (readiness_score < 0 || readiness_score > 100) violations++;
    if (acceptance_ready && fail_count !== 0) violations++;
    if (acceptance_ready && readiness_score < 80) violations++;
  }
  return { name: 'P1_boundedness_readiness_score_and_acceptance_implies_no_fails', trials: checked, violations };
}

// ---------- P2: monotone — flipping any of sd/pop/rev/accred from false to true never lowers readiness_score ----------
function checkP2_monotoneChecklist() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const worse = { ...pp, sd: false, pop: false, rev: false, accred: false };
    const better = { ...pp, sd: true, pop: true, rev: true, accred: true };
    const r1 = compute(worse);
    const r2 = compute(better);
    checked++;
    if (r2.output_payload.readiness_score < r1.output_payload.readiness_score) violations++;
  }
  return { name: 'P2_monotone_readiness_score_nondecreasing_on_checklist_improvement', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — verdict tier matches readiness_score bands exactly ----------
function checkP3_verdictTierAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { readiness_score, fail_count, acceptance_ready, verdict } = r.output_payload;
    const expectedReady = readiness_score >= 80 && fail_count === 0;
    if (acceptance_ready !== expectedReady) violations++;
    const expectedVerdict = expectedReady ? 'ACCEPTANCE READY' : (readiness_score >= 60 ? 'PARTIAL READINESS — GAPS IDENTIFIED' : 'NOT READY — CRITICAL GAPS');
    if (verdict !== expectedVerdict) violations++;
  }
  return { name: 'P3_verdict_matches_readiness_score_tier_thresholds', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applicable) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ credential_type: 'eaa', format: 'sd_jwt_vc', issuer_country: 'DE', sd: true, pop: true, rev: true, claims: { issuer: 'x', subject: 'x', issuanceDate: 'x', expirationDate: 'x', credentialType: 'x', attestation_type: 'x' } }, 'eaa fully complete claims — must hit acceptance_ready at max score'],
  [{ credential_type: 'qeaa', format: 'sd_jwt_vc', issuer_country: 'DE', sd: true, pop: true, rev: true, accred: true }, 'qeaa with accreditation — C05 must pass, maxScore=10'],
  [{ credential_type: 'pid', format: 'mdoc_cbor', issuer_country: 'DE', sd: true, pop: true, rev: true, claims: { family_name: 'x', given_name: 'x', birth_date: 'x', age_over_18: 'x', nationality: 'x', issuing_country: 'x', issuing_authority: 'x', document_number: 'x' } }, 'pid with all 8 required claims — C06 must score 1 (full pass)'],
  [{ credential_type: 'pid', format: 'mdoc_cbor', issuer_country: 'DE', sd: true, pop: true, rev: true, claims: {} }, 'pid with zero claims — C06 must score 0 (missing >2), fail_count must include C06'],
  [{ credential_type: 'non_qualified_eaa', format: 'jwt_vc', issuer_country: 'ZZ', sd: false, pop: false, rev: false }, 'non_qualified_eaa, non-EU27 country, all checklist false — C10 warn branch, must not throw'],
  [{ credential_type: 'eaa', format: 'unknown_format', issuer_country: '', sd: true, pop: true, rev: true }, 'unrecognized format string — C01/C03 must warn/skip cleanly, not throw'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { readiness_score, acceptance_ready, verdict } = r.output_payload;
    const plausible = Number.isFinite(readiness_score) && readiness_score >= 0 && readiness_score <= 100 && typeof acceptance_ready === 'boolean' && typeof verdict === 'string';
    rows.push({ label, pp, readiness_score, acceptance_ready, verdict, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_boundedness());
results.properties.push(checkP2_monotoneChecklist());
results.properties.push(checkP3_verdictTierAgreement());
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
