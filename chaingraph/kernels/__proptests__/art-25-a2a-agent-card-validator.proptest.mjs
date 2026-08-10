// art-25-a2a-agent-card-validator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C7-1).
// kernel_digest_at_authoring: sha256:31f05f94d1769d1602bf8a182a0c58acbc94caa2292ed294d99233f5ba0d3e1b
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — field-presence/array-shape linting; only
// integer weight arithmetic in the score formula).
// Checks: fixture-oracle gate, termination (findings length bounded by skills.length plus a
// fixed set of top-level checks), boundedness (score in [0,100]), a differential re-derivation
// of score/verdict from errors/warnings counts, a metamorphic permutation-invariance check
// (skills array reordering never changes the aggregate skill count or verdict), and forced
// categorical boundary cases (missing required fields, non-https url, malformed signatures).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-25-a2a-agent-card-validator.proptest.mjs

import { compute } from '../art-25-a2a-agent-card-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-25-a2a-agent-card-validator.fixtures.json');
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
const rand = mulberry32(0x25A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomSkills(rng, n) {
  return Array.from({ length: n }, (_, i) => ({
    id: rng() < 0.9 ? `skill-${i}` : undefined,
    name: rng() < 0.9 ? `Skill ${i}` : undefined,
    description: rng() < 0.9 ? `Does thing ${i}` : undefined,
    tags: rng() < 0.7 ? [`tag-${i}`] : undefined,
  }));
}

function randomCard(rng) {
  const n = Math.floor(rng() * 6);
  return {
    name: rng() < 0.9 ? 'Test Agent' : undefined,
    description: rng() < 0.9 ? 'A test agent' : undefined,
    url: rng() < 0.7 ? 'https://agent.example.com' : (rng() < 0.5 ? 'http://agent.example.com' : undefined),
    version: rng() < 0.9 ? '1.0' : undefined,
    protocolVersion: rng() < 0.6 ? '1.0' : undefined,
    capabilities: rng() < 0.7 ? { streaming: rng() < 0.5, pushNotifications: rng() < 0.5, extensions: [] } : undefined,
    defaultInputModes: rng() < 0.6 ? ['text/plain'] : undefined,
    defaultOutputModes: rng() < 0.6 ? ['application/json'] : undefined,
    skills: n > 0 ? randomSkills(rng, n) : (rng() < 0.5 ? [] : undefined),
  };
}

const TRIALS = 5000;

// ---------- P1: termination — findings length bounded by fixed checks + skills.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const card = randomCard(rand);
    const { output_payload: o } = compute({ agent_card: card });
    checked++;
    const skillCount = Array.isArray(card.skills) ? card.skills.length : 0;
    if (o.findings.length > 12 + skillCount * 3) violations++;
  }
  return { name: 'P1_termination_findings_bounded_by_skills_length', trials: checked, violations };
}

// ---------- P2: boundedness — score always in [0,100] ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const { output_payload: o } = compute({ agent_card: randomCard(rand) });
    checked++;
    if (o.score < 0 || o.score > 100) violations++;
  }
  return { name: 'P2_score_bounded_0_to_100', trials: checked, violations };
}

// ---------- P3 (differential): score/verdict re-derived from errors/warnings counts ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const { output_payload: o } = compute({ agent_card: randomCard(rand) });
    checked++;
    const refScore = Math.max(0, Math.min(100, 100 - o.errors * 15 - o.warnings * 4));
    const refVerdict = o.errors > 0 ? 'invalid' : o.warnings > 0 ? 'advisory' : 'valid';
    if (o.score !== refScore) violations++;
    if (o.verdict !== refVerdict) violations++;
  }
  return { name: 'P3_differential_score_verdict_from_counts', trials: checked, violations };
}

// ---------- P4 (metamorphic): skills permutation-invariance ----------
function checkP4_permutationInvariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const n = 1 + Math.floor(rand() * 5);
    const skills = randomSkills(rand, n);
    const base = { name: 'A', description: 'D', url: 'https://x.com', version: '1.0' };
    const shuffled = [...skills];
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    const a = compute({ agent_card: { ...base, skills } }).output_payload;
    const b = compute({ agent_card: { ...base, skills: shuffled } }).output_payload;
    checked++;
    if (a.score !== b.score) violations++;
    if (a.verdict !== b.verdict) violations++;
  }
  return { name: 'P4_skills_permutation_invariance_metamorphic', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (float:no) ----------
function checkP5_categoricalBoundaries() {
  let violations = 0, checked = 0;
  const cases = [
    { agent_card: {} }, // missing all required fields
    { agent_card: { name: 'A', description: 'D', url: 'http://x.com', version: '1', skills: [{ id: 's', name: 'S', description: 'd' }] } }, // non-https
    { agent_card: { name: 'A', description: 'D', url: 'https://x.com', version: '1', skills: [] } }, // empty skills array
    { agent_card: { name: 'A', description: 'D', url: 'https://x.com', version: '1', skills: [{ id: 's', name: 'S', description: 'd' }], signatures: [{ protected: 'p' }] } }, // malformed signature (missing signature field)
    { agent_card: { name: 'A', description: 'D', url: 'https://x.com', version: '1', protocolVersion: '1.0', capabilities: { streaming: true, pushNotifications: true, extensions: [] }, defaultInputModes: ['text/plain'], defaultOutputModes: ['application/json'], skills: [{ id: 's', name: 'S', description: 'd', tags: ['t'] }], signatures: [{ protected: 'p', signature: 's' }] } }, // fully valid + signed
    { agent_card: null }, // not an object
  ];
  for (const c of cases) {
    checked++;
    const { output_payload: o } = compute(c);
    if (o.score < 0 || o.score > 100) violations++;
    if (!['valid', 'advisory', 'invalid'].includes(o.verdict)) violations++;
  }
  const missing = compute(cases[0]).output_payload;
  if (missing.verdict !== 'invalid') violations++;
  const fullyValid = compute(cases[4]).output_payload;
  if (fullyValid.verdict !== 'valid' || !fullyValid.has_signed_card) violations++;
  return { name: 'P5_forced_categorical_boundaries', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_differential());
results.properties.push(checkP4_permutationInvariance());
results.properties.push(checkP5_categoricalBoundaries());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-25-a2a-agent-card-validator',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
