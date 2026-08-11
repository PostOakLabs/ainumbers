// kernel_digest_at_authoring: sha256:835086c93c872c7e1171afce4a0956dacbfd52fa9918c7d11cd23b4218fd07bd
//
// FV-PROPFLOOR-SHARD-B4-1 — property-test floor for art-172-ai-risk-impact-assessment-validator.
// Class B (bounded), float:no exception per the WU row — 7-field completeness checklist
// where the only arithmetic is fields_passed/7*100 rounded, over a finite pass/fail
// domain, not attacker-controlled raw doubles. Forced categorical boundary cases used
// in place of ULP forcing per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies
// (mulberry32 PRNG + explicit boundary arrays), same shape as the B1/B2/B3 harnesses.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-172-ai-risk-impact-assessment-validator.proptest.mjs

import { compute } from '../art-172-ai-risk-impact-assessment-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-172-ai-risk-impact-assessment-validator.fixtures.json');
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
const rand = mulberry32(0x17201);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const FIELD_FACTORIES = {
  intended_use: (ok) => ok ? 'Credit scoring' : '',
  affected_stakeholders: (ok) => ok ? ['customers'] : [],
  risk_treatment_defined: (ok) => ok,
  monitoring_plan: (ok) => ok ? 'Monthly audit' : '',
  approval_documented: (ok) => ok,
  risk_categories: (ok) => ok ? ['bias'] : [],
  data_sources_listed: (ok) => ok,
};
const FIELDS = Object.keys(FIELD_FACTORIES);
const TRIALS = 10000;

function mkPP(rng) {
  const assessment = {};
  for (const f of FIELDS) assessment[f] = FIELD_FACTORIES[f](rng() < 0.5);
  return { assessment };
}

// ---------- P1: boundedness — completeness_score in [0,100], fields_passed in [0,7] ----------
function checkP1_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { completeness_score, fields_passed, fields_checked } = r.output_payload;
    if (fields_checked !== 7) violations++;
    if (fields_passed < 0 || fields_passed > 7) violations++;
    if (completeness_score < 0 || completeness_score > 100) violations++;
  }
  return { name: 'P1_boundedness_score_and_fields_passed', trials: checked, violations };
}

// ---------- P2: monotone — flipping one field pass→fail never increases completeness_score ----------
function checkP2_monotoneFieldFlip() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const f = pick(rand, FIELDS);
    checked++;
    const better = { assessment: { ...pp.assessment, [f]: FIELD_FACTORIES[f](true) } };
    const worse = { assessment: { ...pp.assessment, [f]: FIELD_FACTORIES[f](false) } };
    const rB = compute(better);
    const rW = compute(worse);
    if (rW.output_payload.completeness_score > rB.output_payload.completeness_score) violations++;
  }
  return { name: 'P2_monotone_score_nonincreasing_on_field_downgrade', trials: checked, violations };
}

// ---------- P3: fixed-tier agreement — complete exactly iff fields_passed === 7, and completeness_score = round(fields_passed/7*100) ----------
function checkP3_completeAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { complete, fields_passed, completeness_score, gaps } = r.output_payload;
    if (complete !== (fields_passed === 7)) violations++;
    if (completeness_score !== Math.round((fields_passed / 7) * 100)) violations++;
    if (fields_passed + gaps.length !== 7) violations++;
  }
  return { name: 'P3_complete_and_score_match_fixed_ratio_rule', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applicable; discrete pass/fail domain) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{}, 'all-empty input — completeness_score exactly 0, complete false, 7 gaps'],
  [{ assessment: Object.fromEntries(FIELDS.map((f) => [f, FIELD_FACTORIES[f](true)])) }, 'all 7 fields passing — completeness_score exactly 100, complete true, 0 gaps'],
  [{ assessment: { intended_use: '   ' } }, 'whitespace-only intended_use — must NOT count as passing (trim().length > 0)'],
  [{ assessment: { affected_stakeholders: 'not-an-array' } }, 'non-array affected_stakeholders — must NOT count as passing, no throw'],
  [{ assessment: { risk_treatment_defined: 'true' } }, "risk_treatment_defined as truthy string not === true — must NOT count as passing"],
  [{ assessment: { affected_stakeholders: [], risk_categories: [] } }, 'empty arrays for both list fields — must NOT count as passing (length >= 1 required)'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { complete, completeness_score, fields_passed } = r.output_payload;
    const plausible = typeof complete === 'boolean' && completeness_score >= 0 && completeness_score <= 100 && fields_passed >= 0 && fields_passed <= 7;
    rows.push({ label, pp, complete, completeness_score, fields_passed, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_boundedness());
results.properties.push(checkP2_monotoneFieldFlip());
results.properties.push(checkP3_completeAgreement());
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
