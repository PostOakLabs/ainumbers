// art-18-mcp-developer-readiness-scorecard property-test floor (FV-PROPFLOOR-SHARD-A-REMAINDER-2).
// kernel_digest_at_authoring: sha256:c81916c6a7e22cfeeef2b25f1f7aabff7bdbe4b32867e558653e5324e016ab4c
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape: 15-question yes/partial/no scorecard (6 sections,
// 3^15 = 14,348,907 point domain) -- each answer maps to 2/1/0 points, section pct and overall
// are Math.round()'d, verdict is a 4-band threshold on overall -- confirmed against direct
// kernel source read per this row's fence. This is EXACTLY the case spec §3 exists to keep
// cheap: 300-sample random subset + forced boundary cases, ⛔ never a full 3^15 enumeration.
// float:no (declared yes/partial/no enum only) -- forced CATEGORICAL boundary cases (all-yes,
// all-no, all-partial, and unknown-answer-defaults-to-no) stand in for ULP forcing.
// ZERO external dependencies -- pure Node built-ins only. READ-ONLY w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-18-mcp-developer-readiness-scorecard.proptest.mjs

import { compute } from '../art-18-mcp-developer-readiness-scorecard.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

const SECTIONS = [
  { id: 'tooldef', name: 'Tool Definitions', tool: 'T274 Linter', qs: ['schema', 'desc', 'ann'] },
  { id: 'serverjson', name: 'server.json / Registry', tool: 'T275 Validator', qs: ['name', 'meta', 'pkg'] },
  { id: 'oauth', name: 'OAuth 2.1 Authorization', tool: 'T278 Auditor', qs: ['prm', 'aud', 'pass'] },
  { id: 'transport', name: 'Transport Security', tool: 'T284 Auditor', qs: ['origin', 'bind'] },
  { id: 'poison', name: 'Tool-Poisoning Hygiene', tool: 'T282 Scanner', qs: ['clean', 'trust'] },
  { id: 'spec', name: 'Spec-Revision Compliance', tool: 'T280 Scorer', qs: ['rev', 'stateless'] },
];
const ALL_KEYS = SECTIONS.flatMap((s) => s.qs.map((q) => `${s.id}_${q}`));
const VALID_ANSWERS = ['yes', 'partial', 'no'];

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randomAnswers(rng) {
  const a = {};
  for (const k of ALL_KEYS) a[k] = pick(rng, VALID_ANSWERS);
  return a;
}
function expectedForAnswers(answers) {
  let totalGot = 0, totalMax = 0;
  const sections = [];
  for (const s of SECTIONS) {
    let got = 0;
    const max = s.qs.length * 2;
    for (const q of s.qs) {
      const key = `${s.id}_${q}`;
      const raw = answers[key];
      const v = VALID_ANSWERS.includes(raw) ? raw : 'no';
      got += v === 'yes' ? 2 : v === 'partial' ? 1 : 0;
    }
    sections.push({ id: s.id, pct: Math.round((got / max) * 100) });
    totalGot += got; totalMax += max;
  }
  const overall = Math.round((totalGot / totalMax) * 100);
  const verdict = overall >= 90 ? 'Ship-ready.' : overall >= 70 ? 'Nearly there — close the gaps below.' : overall >= 50 ? 'Not ready — several sections need work.' : 'Significant work before shipping.';
  return { overall, sections, verdict };
}

// ---------- fixture-oracle gate (MANDATORY before any property is trusted) ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-18-mcp-developer-readiness-scorecard.fixtures.json');
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

// ---------- negative control: an oracle never seen rejecting a wrong spec is not known to work ----------
function negativeControl() {
  const { output_payload } = compute({ answers: {} });
  const mutated = { ...output_payload, overall: output_payload.overall === 0 ? 100 : 0 };
  const wouldPass = JSON.stringify(mutated) === JSON.stringify(output_payload);
  return { rejected_wrong_spec: !wouldPass };
}

// P1: overall/section pct agreement with the yes=2/partial=1/no=0 rollup, random 300-sample.
function checkP1_scoreAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(18001);
  for (let i = 0; i < 300; i++) {
    const answers = randomAnswers(rng);
    const { output_payload } = compute({ answers });
    checked++;
    const exp = expectedForAnswers(answers);
    if (output_payload.overall !== exp.overall) violations++;
    for (const es of exp.sections) {
      const actual = output_payload.sections.find((s) => s.id === es.id);
      if (!actual || actual.pct !== es.pct) violations++;
    }
  }
  return { name: 'P1_score_agreement_random300', trials: checked, violations };
}

// P2: verdict threshold-band agreement for every overall.
function checkP2_verdictThresholdAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(18002);
  for (let i = 0; i < 300; i++) {
    const { output_payload } = compute({ answers: randomAnswers(rng) });
    checked++;
    const o = output_payload.overall;
    const expected = o >= 90 ? 'Ship-ready.' : o >= 70 ? 'Nearly there — close the gaps below.' : o >= 50 ? 'Not ready — several sections need work.' : 'Significant work before shipping.';
    if (output_payload.verdict !== expected) violations++;
  }
  return { name: 'P2_verdict_threshold_agreement_random300', trials: checked, violations };
}

// P3: gaps_count == gaps.length == count of non-yes answers; bounds [0,15]; boundedness [0,100].
function checkP3_gapsAndBoundedness() {
  let violations = 0, checked = 0;
  const rng = mulberry32(18003);
  for (let i = 0; i < 300; i++) {
    const answers = randomAnswers(rng);
    const { output_payload } = compute({ answers });
    checked++;
    const expectedGaps = ALL_KEYS.filter((k) => answers[k] !== 'yes').length;
    if (output_payload.gaps_count !== expectedGaps) violations++;
    if (output_payload.gaps.length !== expectedGaps) violations++;
    if (output_payload.overall < 0 || output_payload.overall > 100) violations++;
    for (const s of output_payload.sections) {
      if (s.pct < 0 || s.pct > 100) violations++;
    }
  }
  return { name: 'P3_gaps_and_boundedness_random300', trials: checked, violations };
}

// P4: forced categorical boundary cases -- all-yes (100/Ship-ready), all-no (0/Significant work),
// all-partial (50), and unmapped/garbage answer values default to 'no'.
function checkP4_forcedCategoricalBoundaries() {
  let violations = 0, checked = 0;

  let r = compute({ answers: Object.fromEntries(ALL_KEYS.map((k) => [k, 'yes'])) }).output_payload;
  checked++; if (r.overall !== 100 || r.verdict !== 'Ship-ready.' || r.gaps_count !== 0) violations++;

  r = compute({ answers: Object.fromEntries(ALL_KEYS.map((k) => [k, 'no'])) }).output_payload;
  checked++; if (r.overall !== 0 || r.verdict !== 'Significant work before shipping.' || r.gaps_count !== ALL_KEYS.length) violations++;

  r = compute({ answers: Object.fromEntries(ALL_KEYS.map((k) => [k, 'partial'])) }).output_payload;
  checked++; if (r.overall !== 50) violations++;

  r = compute({ answers: Object.fromEntries(ALL_KEYS.map((k) => [k, 'maybe'])) }).output_payload;
  checked++; if (r.overall !== 0) violations++;

  r = compute({ answers: {} }).output_payload;
  checked++; if (r.overall !== 0 || r.gaps_count !== ALL_KEYS.length) violations++;

  return { name: 'P4_forced_categorical_boundary_cases_all_and_unmapped', trials: checked, violations };
}

// P5: output shape / no NaN / undefined across missing-field and empty-object inputs.
function checkP5_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { answers: {} }, { answers: { tooldef_schema: 'yes' } }, undefined];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (!Number.isFinite(output_payload.overall)) violations++;
    if (typeof output_payload.verdict !== 'string') violations++;
    if (!Array.isArray(output_payload.sections) || output_payload.sections.length !== 6) violations++;
    if (!Array.isArray(output_payload.gaps)) violations++;
    if (!Number.isFinite(output_payload.gaps_count)) violations++;
    if (typeof output_payload.answers_used !== 'object' || output_payload.answers_used === null) violations++;
  }
  return { name: 'P5_output_shape_no_nan_undefined', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

const negControl = negativeControl();
if (!negControl.rejected_wrong_spec) {
  console.error('NEGATIVE CONTROL FAILED -- comparator never observed rejecting a wrong output.');
  process.exit(1);
}

results.properties.push(checkP1_scoreAgreement());
results.properties.push(checkP2_verdictThresholdAgreement());
results.properties.push(checkP3_gapsAndBoundedness());
results.properties.push(checkP4_forcedCategoricalBoundaries());
results.properties.push(checkP5_outputShapeInvariant());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  kernel_id: 'art-18-mcp-developer-readiness-scorecard',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  negative_control: negControl,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
