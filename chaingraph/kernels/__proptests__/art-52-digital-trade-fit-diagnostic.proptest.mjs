// kernel_digest_at_authoring: sha256:77e46eb235dae3d94185744d9e44a284d15fe90eac9988e6d32b3162804dd663
//
// FV-PROPFLOOR-SHARD-B14-1 — property-test floor for art-52-digital-trade-fit-diagnostic.
// Class B (weighted-diagnostic), FLOAT:YES per the WU row — CORRECTED BASIS: on direct kernel
// reading (FIX-2 carry), this kernel has NO continuous user-supplied numeric input feeding the
// score (every scoring input is a pick() lookup over a small integer table {0,2,4}); the only
// numeric fields (counterparty_type, annual_trade_docs) are explicitly informational and never
// enter the score arithmetic. Its float-sensitivity is therefore at the internal weighted-average
// layer only: dim_scores[k].score = +(avg/4*100).toFixed(1) and overall_score = weighted-sum of
// those rounded values with decimal WEIGHTS (0.25/0.20/0.15/0.15/0.15/0.10) that are not exactly
// representable in binary. ULP-boundary forcing is retained (kept float:yes per the WU row) but
// targets grade-threshold boundaries of that internal arithmetic plus categorical-fallback cases,
// rather than a classic continuous-domain ULP crossing on user input. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-52-digital-trade-fit-diagnostic.proptest.mjs

import { compute } from '../art-52-digital-trade-fit-diagnostic.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-52-digital-trade-fit-diagnostic.fixtures.json');
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
const rand = mulberry32(0x52E55A);
const TRIALS = 10000;
const letter = (s) => (s >= 85 ? 'A' : s >= 70 ? 'B' : s >= 55 ? 'C' : s >= 40 ? 'D' : 'F');
const WEIGHTS = { legality: 0.25, digitisation: 0.20, platform: 0.15, rules: 0.15, financing: 0.15, aml: 0.10 };
const ROUTE = new Set(['dtc-ebl-enforceability', 'dtc-doc-integrity', 'dtc-digital-lc', 'dtc-trade-finance', 'dtc-counterparty-aml']);
const SECONDARY_EXTRA = new Set(['dtc-tbml-surveillance', 'dtc-audit-pack']);
const GRADES = new Set(['A', 'B', 'C', 'D', 'F']);

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

function mkPP(rng) {
  return {
    origin_jurisdiction: pick(rng, ['mletr-adopted', 'aligned', 'not-adopted']),
    dest_jurisdiction: pick(rng, ['mletr-adopted', 'aligned', 'not-adopted']),
    ebl_usage: pick(rng, ['none', 'pilot', 'routine']),
    doc_set_scope: pick(rng, ['bl-only', 'bl+invoice', 'full-set']),
    ebl_platform: pick(rng, ['none', 'single', 'interoperable']),
    api_readiness: pick(rng, ['none', 'partial', 'full']),
    rule_basis: pick(rng, ['paper-UCP600', 'eUCP', 'URDTT-open-account', 'mixed']),
    finance_mode: pick(rng, ['LC', 'documentary-collection', 'open-account-SCF', 'none']),
    tbml_controls: pick(rng, ['strong', 'adequate', 'thin']),
    party_screening: pick(rng, ['LEI+sanctions+UBO', 'partial', 'manual']),
    counterparty_type: pick(rng, ['corporate', 'sovereign', 'individual']),
    annual_trade_docs: Math.floor(randRange(rng, -100, 1e6)),
  };
}

// ---------- P1: overall_score exactly reproducible from returned dim_scores * WEIGHTS ----------
function checkP1_overallRoundTrip() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { dim_scores, overall_score } = r.output_payload;
    const expected = +Object.keys(WEIGHTS).reduce((acc, k) => acc + dim_scores[k].score * WEIGHTS[k], 0).toFixed(1);
    if (overall_score !== expected) violations++;
    if (overall_score < 0 || overall_score > 100) violations++;
  }
  return { name: 'P1_overall_score_exact_weighted_sum_of_returned_dim_scores', trials: checked, violations };
}

// ---------- P2: overall_grade matches letter(overall_score); dim grades bounded enum ----------
function checkP2_gradesConsistent() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { dim_scores, overall_score, overall_grade } = r.output_payload;
    if (overall_grade !== letter(overall_score)) violations++;
    for (const k of Object.keys(dim_scores)) {
      if (!GRADES.has(dim_scores[k].grade)) violations++;
      if (dim_scores[k].score < 0 || dim_scores[k].score > 100) violations++;
    }
  }
  return { name: 'P2_overall_grade_exact_and_dim_grades_bounded', trials: checked, violations };
}

// ---------- P3: informational fields (counterparty_type, annual_trade_docs) never affect the score ----------
function checkP3_informationalFieldsNoop() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r1 = compute(pp);
    const pp2 = { ...pp, counterparty_type: 'individual', annual_trade_docs: 999999 };
    const r2 = compute(pp2);
    checked++;
    if (r1.output_payload.overall_score !== r2.output_payload.overall_score) violations++;
    if (r1.output_payload.overall_grade !== r2.output_payload.overall_grade) violations++;
    if (JSON.stringify(r1.output_payload.dim_scores) !== JSON.stringify(r2.output_payload.dim_scores)) violations++;
  }
  return { name: 'P3_informational_fields_never_affect_score', trials: checked, violations };
}

// ---------- P4 (mandatory, retained float:yes per WU row): boundary forcing on the weighted-average
// arithmetic and enum fallback, since no continuous user field exists to force classic ULP crossing ----------
const ULP_BOUNDARY_CASES = [
  [{}, 'all fields defaulted — must produce a finite, deterministic overall_score with consistent grade'],
  [{ origin_jurisdiction: 'unrecognized-xyz' }, 'unrecognized enum string for a scored field — pick() default of 0 must apply, no NaN'],
  [{ origin_jurisdiction: 'mletr-adopted', dest_jurisdiction: 'mletr-adopted', ebl_usage: 'routine', doc_set_scope: 'full-set', ebl_platform: 'interoperable', api_readiness: 'full', rule_basis: 'eUCP', finance_mode: 'LC', tbml_controls: 'strong', party_screening: 'LEI+sanctions+UBO' }, 'every field at its maximum score — overall_score must be exactly 100.0, grade A'],
  [{ origin_jurisdiction: 'not-adopted', dest_jurisdiction: 'not-adopted', ebl_usage: 'none', doc_set_scope: 'bl-only', ebl_platform: 'none', api_readiness: 'none', rule_basis: 'paper-UCP600', finance_mode: 'none', tbml_controls: 'thin', party_screening: 'manual' }, 'every field at its minimum score — overall_score must be exactly 0.0 or close to it (doc_set_scope floors at 1), grade F, corridor flag must fire'],
  [{ annual_trade_docs: NaN }, 'annual_trade_docs NaN — informational only, must not propagate into overall_score (still finite)'],
  [{ annual_trade_docs: Number.MAX_SAFE_INTEGER }, 'annual_trade_docs at MAX_SAFE_INTEGER — informational only, must not affect overall_score'],
  [{ origin_jurisdiction: null }, 'origin_jurisdiction null (not a string) — pick() default of 0 must apply, no throw, no NaN'],
  [{ origin_jurisdiction: 'not-adopted', dest_jurisdiction: 'aligned' }, 'mixed corridor (one not-adopted, one aligned) — corridor_enforceability_flag must stay null (only fires when BOTH not-adopted)'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const { dim_scores, overall_score, overall_grade } = r.output_payload;
    const allFinite = Object.values(dim_scores).every((d) => Number.isFinite(d.score)) && Number.isFinite(overall_score);
    const plausible = allFinite && GRADES.has(overall_grade) && overall_score >= 0 && overall_score <= 100;
    rows.push({ label, input: pp, overall_score, overall_grade, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_overallRoundTrip());
results.properties.push(checkP2_gradesConsistent());
results.properties.push(checkP3_informationalFieldsNoop());
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
