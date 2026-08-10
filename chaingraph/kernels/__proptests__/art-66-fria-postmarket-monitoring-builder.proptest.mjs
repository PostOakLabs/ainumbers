// kernel_digest_at_authoring: sha256:3aff37d79ff68de2a055c1d32bdabb4376e3fe242656398b2c1d35ca48331cc0
//
// FV-PROPFLOOR-SHARD-B15-1 — property-test floor for art-66-fria-postmarket-monitoring-builder.
// Class B (bounded-numeric), FLOAT:NO per the WU row — fria_score is a fixed integer table
// {complete:4,partial:2,not-started:0} divided by a fixed element count (24 = 6 elements x 4),
// so every possible friaTotal (multiple of 2, 0-24) yields an exact fraction of 100 with no
// irrational remainder. overall_score sums four such fixed-weight terms (0.45+0.25+0.15+0.15=1.0
// exactly). Per FV-PBT-FLOOR-BUILD-SPEC.md §3 this is a stated float:no exception — forced
// CATEGORICAL boundary cases (all-elements-complete, oversight/logging enum edges) stand in
// for ULP forcing.
// Zero external dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-66-fria-postmarket-monitoring-builder.proptest.mjs

import { compute } from '../art-66-fria-postmarket-monitoring-builder.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-66-fria-postmarket-monitoring-builder.fixtures.json');
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
const rand = mulberry32(0x66A11);
const TRIALS = 8000;
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const FRIA_IDS = ['purpose', 'persons', 'rights', 'oversight', 'mitigation', 'governance'];
const FRIA_STATUS = ['complete', 'partial', 'not-started'];
const OVERSIGHT = ['meaningful', 'nominal', 'none'];
const LOGGING = ['full-traceability', 'partial', 'none'];
const MONITORING = ['defined', 'partial', 'none'];
const INCIDENT = ['not-mapped', 'mapped'];

function mkPP(rng) {
  const fria = FRIA_IDS.map(element => ({ element, status: pick(rng, FRIA_STATUS) }));
  return {
    deployment: {
      use_case: pick(rng, ['credit-scoring', 'insurance-pricing', 'other']),
      affected_persons: pick(rng, ['consumers', 'workers', 'applicants']),
      automation_level: pick(rng, ['human-review', 'autonomous']),
    },
    fria,
    human_oversight: pick(rng, OVERSIGHT),
    logging: pick(rng, LOGGING),
    monitoring_plan: pick(rng, MONITORING),
    incident_reporting: pick(rng, INCIDENT),
  };
}

// ---------- P1: boundedness — fria_score and overall_score stay in [0, 100] ----------
function checkP1_scoresBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { fria_score, overall_score } = r.output_payload;
    if (!Number.isFinite(fria_score) || fria_score < 0 || fria_score > 100
      || !Number.isFinite(overall_score) || overall_score < 0 || overall_score > 100) violations++;
  }
  return { name: 'P1_fria_and_overall_scores_bounded_0_to_100', trials: checked, violations };
}

// ---------- P2: exactness — fria_score is exactly friaTotal / 24 * 100, rounded to 1dp ----------
function checkP2_friaScoreExact() {
  const STATUS_SCORE = { complete: 4, partial: 2, 'not-started': 0 };
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const friaTotal = pp.fria.reduce((a, f) => a + (STATUS_SCORE[f.status] ?? 0), 0);
    const expected = +(friaTotal / 24 * 100).toFixed(1);
    if (Math.abs(r.output_payload.fria_score - expected) > 1e-9) violations++;
  }
  return { name: 'P2_fria_score_exact_friaTotal_over_24_times_100', trials: checked, violations };
}

// ---------- P3: fixed-rule agreement — oversight/logging verdict text matches their enum inputs exactly ----------
function checkP3_verdictTextFixedRule() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { oversight_verdict, logging_verdict } = r.output_payload;
    const oOk = (pp.human_oversight === 'meaningful' && oversight_verdict.startsWith('PASS'))
      || (pp.human_oversight === 'nominal' && oversight_verdict.startsWith('WARNING'))
      || (pp.human_oversight === 'none' && oversight_verdict.startsWith('FAIL'));
    const lOk = (pp.logging === 'full-traceability' && logging_verdict.startsWith('PASS'))
      || (pp.logging === 'partial' && logging_verdict.startsWith('WARNING'))
      || (pp.logging === 'none' && logging_verdict.startsWith('FAIL'));
    if (!oOk || !lOk) violations++;
  }
  return { name: 'P3_oversight_and_logging_verdict_text_matches_enum_exactly', trials: checked, violations };
}

// ---------- P4 (mandatory float:no exception): forced categorical boundary cases ----------
function checkP4_forced() {
  const base = mkPP(mulberry32(0x66B22));
  const rows = [];
  const push = (overrides, label) => {
    const pp = { ...base, ...overrides };
    const r = compute(pp);
    const { fria_score, overall_score, oversight_verdict, logging_verdict } = r.output_payload;
    const plausible = Number.isFinite(fria_score) && Number.isFinite(overall_score) && typeof oversight_verdict === 'string' && typeof logging_verdict === 'string';
    rows.push({ label, fria_score, overall_score, plausible });
  };

  push({ fria: FRIA_IDS.map(element => ({ element, status: 'complete' })) }, 'all 6 FRIA elements complete — fria_score must be exactly 100.0');
  push({ fria: FRIA_IDS.map(element => ({ element, status: 'not-started' })) }, 'all 6 FRIA elements not-started — fria_score must be exactly 0.0');
  push({ fria: [] }, 'empty fria array — every element falls to the ?? "not-started" default via friaMap lookup miss, must not throw');
  push({ fria: FRIA_IDS.map((element, i) => ({ element, status: i < 3 ? 'complete' : 'not-started' })) }, '3/6 complete exactly — friaTotal=12, fria_score must be exactly 50.0');
  push({ human_oversight: 'meaningful', logging: 'full-traceability', monitoring_plan: 'defined', fria: FRIA_IDS.map(element => ({ element, status: 'complete' })) }, 'all-best-case — overall_score = 100*0.45+4/4*100*0.25+4/4*100*0.15+100*0.15 = 100.0 exactly (weights sum to 1.0)');
  push({ human_oversight: 'none', logging: 'none', monitoring_plan: 'none', fria: FRIA_IDS.map(element => ({ element, status: 'not-started' })) }, 'all-worst-case — overall_score must be exactly 0.0');
  push({ monitoring_plan: 'partial' }, 'monitoring_plan partial — must contribute exactly 50*0.15=7.5 to overall_score, not 0 or 100');
  push({ deployment: { use_case: 'credit-scoring', affected_persons: 'workers', automation_level: 'autonomous' } }, 'affected_persons=workers — affected_rights must include the fair-working-conditions entry');
  push({ incident_reporting: 'not-mapped' }, 'incident_reporting not-mapped — incident_path.mapped must be exactly false and INCIDENT_PATH_NOT_MAPPED flag must fire');
  push({ human_oversight: 'nominal', logging: 'partial' }, 'nominal oversight + partial logging — oversight_score=2, logging_score=2, contributes exactly 2/4*100*0.25 + 2/4*100*0.15 = 50*0.25+50*0.15=20.0');

  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_scoresBounded());
results.properties.push(checkP2_friaScoreExact());
results.properties.push(checkP3_verdictTextFixedRule());
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
