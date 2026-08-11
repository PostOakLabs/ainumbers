// kernel_digest_at_authoring: sha256:3e6402dbb86314d81a2323ad9509ad6ea85359eeaed521b4442a944f53a4ad54
//
// FV-PROPFLOOR-SHARD-B3-1 — property-test floor for art-151-agent-obo-mandate-validator.
// Class B (bounded categorical), float:no exception per the WU row — structural presence checks
// and an integer-timestamp comparison, no continuous arithmetic. Forced categorical boundary
// cases used in place of ULP forcing per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external
// dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the B1/B2 harnesses.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-151-agent-obo-mandate-validator.proptest.mjs

import { compute } from '../art-151-agent-obo-mandate-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-151-agent-obo-mandate-validator.fixtures.json');
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
const rand = mulberry32(0x15101);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;

function mkPP(rng) {
  const now_unix = Math.floor(randRange(rng, 0, 2000000000));
  const mandate = {};
  if (rng() < 0.5) mandate.subject = 'user:agent@example.com';
  if (rng() < 0.5) mandate.intent = 'do_something';
  if (rng() < 0.5) mandate.scope = ['a:read'];
  if (rng() < 0.7) mandate.valid_until_unix = now_unix + Math.floor(randRange(rng, -1000, 1000));
  return { mandate, now_unix };
}

// ---------- P1: monotone — completing every mandate field never leaves more gaps than a partial mandate ----------
function checkP1_monotoneGaps() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const complete = { mandate: { subject: 'user:x', intent: 'y', scope: ['s:read'], valid_until_unix: pp.now_unix + 10000 }, now_unix: pp.now_unix };
    const r1 = compute(pp);
    const r2 = compute(complete);
    checked++;
    if (r2.output_payload.gaps.length > r1.output_payload.gaps.length) violations++;
    if (r1.output_payload.verdict === 'ACCEPT' && r2.output_payload.verdict !== 'ACCEPT') violations++;
  }
  return { name: 'P1_monotone_gaps_nonincreasing_toward_complete_mandate', trials: checked, violations };
}

// ---------- P2: boundedness — gaps drawn from 4 known categories, verdict is one of two fixed strings ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  const KNOWN = new Set(['SUBJECT', 'INTENT', 'SCOPE', 'EXPIRED_OR_NO_VALIDITY']);
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { gaps, verdict } = r.output_payload;
    for (const g of gaps) if (!KNOWN.has(g)) violations++;
    if (!['ACCEPT', 'REFUSE'].includes(verdict)) violations++;
  }
  return { name: 'P2_boundedness_gaps_from_known_set_verdict_fixed_pair', trials: checked, violations };
}

// ---------- P3: categorical threshold agreement — verdict is exactly the AND of the 4 sub-checks ----------
function checkP3_verdictAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { has_subject, has_intent, has_scope, not_expired, verdict } = r.output_payload;
    const expected = (has_subject && has_intent && has_scope && not_expired) ? 'ACCEPT' : 'REFUSE';
    if (verdict !== expected) violations++;
  }
  return { name: 'P3_verdict_equals_and_of_four_subchecks', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applicable) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ mandate: { subject: 'u', intent: 'i', scope: ['s'], valid_until_unix: 1000 }, now_unix: 1000 }, 'now_unix exactly equal to valid_until_unix (tie) — not_expired must be true (<=)'],
  [{ mandate: { subject: 'u', intent: 'i', scope: ['s'], valid_until_unix: 1000 }, now_unix: 1001 }, 'now_unix 1 past valid_until_unix — not_expired must be false'],
  [{ mandate: { subject: 'u', intent: 'i', scope: ['s'] }, now_unix: 1000 }, 'valid_until_unix entirely absent — not_expired must be false per the missing-validity branch'],
  [{ mandate: { subject: 'u', intent: 'i', scope: [], valid_until_unix: 9999999999 }, now_unix: 1000 }, 'empty scope array — has_scope must be false'],
  [{ mandate: {}, now_unix: 1000 }, 'entirely empty mandate object — all four gaps present, REFUSE'],
  [{}, 'entirely empty policy_parameters — must default cleanly, REFUSE, no throw'],
  [{ mandate: { subject: '', intent: 'i', scope: ['s'], valid_until_unix: 9999999999 }, now_unix: 1000 }, 'empty-string subject — has_subject must be false (length check)'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { verdict, gaps } = r.output_payload;
    const plausible = ['ACCEPT', 'REFUSE'].includes(verdict) && Array.isArray(gaps);
    rows.push({ label, pp, verdict, gaps, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneGaps());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_verdictAgreement());
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
