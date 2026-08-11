// ptg-01-ap2-prompt-template-generator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C15-1).
// kernel_digest_at_authoring: sha256:5f23d03d4d538507b92a3f3461e5d0ebb6987227fd3a7ae41281216fc2fabe8e
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (pure string template composition and lookup-table selection, no arithmetic
// comparison of any kind, direct read confirmed) — forced categorical boundary cases used instead of
// ULP-forcing, per spec §3's float:no row.
// Checks: fixture-oracle gate, termination (compute() is a single O(1) pass over fixed fields, no
// unbounded loop — the one data-dependent size is JSON.stringify(output_payload) of the upstream
// artifact, whose length is bounded by the input artifact_json string length), differential
// re-derivation of generated_prompt_length, robustness (malformed/unparseable artifact_json never
// throws and falls back to defaults), and forced categorical boundary cases on audience/tone/
// include_citations (unknown enum values, missing artifact, string-vs-boolean include_citations).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/ptg-01-ap2-prompt-template-generator.proptest.mjs

import { compute } from '../ptg-01-ap2-prompt-template-generator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'ptg-01-ap2-prompt-template-generator.fixtures.json');
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
const rand = mulberry32(0x1103a2);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const TASKS = ['plain_english_summary', 'risk_brief', 'unknown_task_xyz'];
const AUDIENCES = ['board', 'risk_committee', 'regulator', 'quant', 'ops', 'unknown_audience'];
const TONES = ['formal', 'technical', 'plain', 'unknown_tone'];

function randomArtifact(rng) {
  if (rng() < 0.15) return null;
  if (rng() < 0.15) return '{not valid json';
  const artifact = {
    mandate_type: pick(rng, ['aml_rule', 'compliance_mandate', null]),
    tool_id: `art-${Math.floor(rng() * 999)}`,
    execution_hash: rng() < 0.8 ? `sha256:${Math.floor(rng() * 1e9)}` : undefined,
    chain: { chain_depth: Math.floor(rng() * 10) },
    output_payload: { some_field: rng(), nested: { arr: [1, 2, 3] } },
  };
  return rng() < 0.5 ? JSON.stringify(artifact) : artifact;
}

function randomPP(rng) {
  return {
    artifact_json: randomArtifact(rng),
    task: pick(rng, TASKS),
    audience: pick(rng, AUDIENCES),
    tone: pick(rng, TONES),
    include_citations: pick(rng, [true, false, 'false', 'true', undefined]),
  };
}

const TRIALS = 4000;

// ---------- P1: termination/robustness — compute() never throws on any input shape ----------
function checkP1_never_throws() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    checked++;
    try {
      compute(pp);
    } catch (e) {
      violations++;
    }
  }
  return { name: 'P1_termination_never_throws_on_malformed_input', trials: checked, violations };
}

// ---------- P2 (differential): generated_prompt_length re-derivation ----------
function checkP2_length_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.generated_prompt_length !== output_payload.generated_prompt.length) violations++;
  }
  return { name: 'P2_generated_prompt_length_differential', trials: checked, violations };
}

// ---------- P3: forced categorical boundary — unknown tone falls back to 'formal' modifier text;
// unknown audience is echoed verbatim into the prompt header (audienceFormatMap lookup exists but its
// result is never interpolated into generatedPrompt — confirmed by direct read: audienceLabel is
// computed and discarded), so the forced case for audience asserts the passthrough instead. ----------
function checkP3_forced_categorical_fallback() {
  let violations = 0, checked = 0;
  const cases = [
    { audience: 'unknown_audience', expectAudienceEcho: 'unknown_audience' },
    { tone: 'unknown_tone', expectToneModifier: 'Formal professional language' },
  ];
  for (const c of cases) {
    const { output_payload } = compute({ artifact_json: null, task: 't', audience: c.audience ?? 'board', tone: c.tone ?? 'formal' });
    checked++;
    if (c.expectAudienceEcho && !output_payload.generated_prompt.includes(c.expectAudienceEcho)) violations++;
    if (c.expectToneModifier && !output_payload.generated_prompt.includes(c.expectToneModifier)) violations++;
  }
  // include_citations: string 'false' must be treated as false (forced categorical, not truthy-string bug)
  {
    const { output_payload } = compute({ artifact_json: null, include_citations: 'false' });
    checked++;
    if (output_payload.include_citations !== false) violations++;
  }
  // null/missing artifact -> mandate_type_matched === 'unknown'
  {
    const { output_payload } = compute({ artifact_json: null });
    checked++;
    if (output_payload.mandate_type_matched !== 'unknown') violations++;
  }
  return { name: 'P3_forced_categorical_boundary_fallbacks', trials: checked, violations };
}

// ---------- P4: metamorphic — include_citations=false never emits the citation sentence ----------
function checkP4_citation_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const pp = randomPP(rand);
    const withoutCitations = { ...pp, include_citations: false };
    const { output_payload } = compute(withoutCitations);
    checked++;
    if (output_payload.generated_prompt.includes('Include regulatory citations')) violations++;
  }
  return { name: 'P4_include_citations_false_metamorphic', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_never_throws());
results.properties.push(checkP2_length_differential());
results.properties.push(checkP3_forced_categorical_fallback());
results.properties.push(checkP4_citation_metamorphic());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'ptg-01-ap2-prompt-template-generator',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
