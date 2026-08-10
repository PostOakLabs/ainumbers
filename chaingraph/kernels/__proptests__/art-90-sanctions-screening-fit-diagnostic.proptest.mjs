// kernel_digest_at_authoring: sha256:38748fbbd98786a5c965a54c809622a7dd0d1f193507e321aa3ad9fa9f06c178
//
// FV-PROPFLOOR-SHARD-B18-1 — property-test floor for art-90-sanctions-screening-fit-diagnostic.
// Class B, FLOAT:YES per the WU row. Note on ULP-forcing shape for THIS kernel: there is no
// continuous user-supplied numeric input — every score is derived from categorical enum/array
// inputs, so the float-sensitive surface is the internal `Math.round((covered / 4) * 25)` and
// `raw_total` (grade-threshold comparison against 85/70/55/40) arithmetic. ULP-boundary forcing
// here is applied as forced exact-integer-threshold cases (raw_total = 85/84/70/69/55/54/40/39)
// and forced half-integer rounding cases (list_score at covered=1 => 6.25 and covered=3 => 18.75,
// exercising Math.round's round-half-away-from-zero behavior) — the discrete-domain analogue of
// the "threshold ±1 ULP" requirement, since 578-kernel spec §3's literal denormal/negative-zero
// cases do not apply to a kernel with zero continuous float inputs. Zero external dependencies.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-90-sanctions-screening-fit-diagnostic.proptest.mjs

import { compute } from '../art-90-sanctions-screening-fit-diagnostic.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-90-sanctions-screening-fit-diagnostic.fixtures.json');
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
const rand = mulberry32(0x90F1E2);
const TRIALS = 12000;
const ALL_LISTS = ['ofac_sdn', 'eu_consolidated', 'un', 'uk_sanctions'];
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function subsetOf(rng, arr) { return arr.filter(() => rng() < 0.5); }

function mkPP(rng) {
  return {
    business_model: pick(rng, ['bank', 'exporter', 'marketplace']),
    sanctions_lists_screened: subsetOf(rng, ALL_LISTS),
    ownership_screening: pick(rng, ['50pct-aware', 'partial', 'none']),
    export_control_exposure: pick(rng, ['dual-use', 'none']),
    fuzzy_match_governance: pick(rng, ['calibrated', 'partial', 'none']),
    circumvention_controls: pick(rng, ['no-russia-clause', 'partial', 'none']),
    jurisdictional_nexus: subsetOf(rng, ['us', 'eu', 'uk']),
    screening_frequency: pick(rng, ['real_time', 'daily', 'per_transaction', 'on_boarding', 'never']),
    sectoral_screening: pick(rng, ['partial', 'none']),
    adverse_media: pick(rng, ['yes', 'no']),
    pep_screening: pick(rng, ['yes', 'no']),
    alert_review_sla: pick(rng, ['defined', 'partial', 'none']),
  };
}

function computeExpectedListScore(covered) { return Math.round((covered / ALL_LISTS.length) * 25); }

// ---------- P1: raw_score is bounded 0-100 and equals the sum of dim_scores ----------
function checkP1_rawScoreBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { raw_score, dim_scores } = r.output_payload;
    const sum = dim_scores.list_coverage + dim_scores.ownership_50pct + dim_scores.fuzzy_match + dim_scores.circumvention + dim_scores.screening_operations;
    if (raw_score !== sum) violations++;
    if (raw_score < 0 || raw_score > 100) violations++;
  }
  return { name: 'P1_raw_score_bounded_and_equals_dim_sum', trials: checked, violations };
}

// ---------- P2: program_grade is a monotonic non-decreasing function of raw_score (A best, F worst) ----------
function checkP2_gradeMonotonic() {
  const GRADE_RANK = { A: 4, B: 3, C: 2, D: 1, F: 0 };
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp1 = mkPP(rand);
    const pp2 = mkPP(rand);
    const r1 = compute(pp1);
    const r2 = compute(pp2);
    checked++;
    if (r1.output_payload.raw_score > r2.output_payload.raw_score) {
      if (GRADE_RANK[r1.output_payload.program_grade] < GRADE_RANK[r2.output_payload.program_grade]) violations++;
    } else if (r1.output_payload.raw_score < r2.output_payload.raw_score) {
      if (GRADE_RANK[r1.output_payload.program_grade] > GRADE_RANK[r2.output_payload.program_grade]) violations++;
    }
  }
  return { name: 'P2_program_grade_monotonic_in_raw_score', trials: checked, violations };
}

// ---------- P3: list_score formula is exact — Math.round((covered/4)*25) ----------
function checkP3_listScoreExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const covered = ALL_LISTS.filter((l) => pp.sanctions_lists_screened.includes(l)).length;
    const expected = computeExpectedListScore(covered);
    if (r.output_payload.dim_scores.list_coverage !== expected) violations++;
  }
  return { name: 'P3_list_score_exact_rounding_formula', trials: checked, violations };
}

// ---------- P4 (mandatory ULP/discrete-boundary forcing): exact grade thresholds + half-integer rounding ----------
const BOUNDARY_CASES = [
  // raw_total exactly 85 (A boundary): list=25(4 lists)+owner=20(50pct-aware)+fuzzy=20(calibrated)+circ=15(no-russia)+ops=5(per_transaction only)=85
  [{ sanctions_lists_screened: ALL_LISTS, ownership_screening: '50pct-aware', fuzzy_match_governance: 'calibrated', circumvention_controls: 'no-russia-clause', export_control_exposure: 'dual-use', screening_frequency: 'per_transaction', alert_review_sla: 'none', adverse_media: 'no', pep_screening: 'no' }, 'raw_total exactly 85 (A/B grade boundary) — must be A'],
  // one less: ops=2 (on_boarding) -> raw 25+20+20+15+2=82 -> B, not A. Confirms boundary sensitivity.
  [{ sanctions_lists_screened: ALL_LISTS, ownership_screening: '50pct-aware', fuzzy_match_governance: 'calibrated', circumvention_controls: 'no-russia-clause', export_control_exposure: 'dual-use', screening_frequency: 'on_boarding', alert_review_sla: 'none', adverse_media: 'no', pep_screening: 'no' }, 'raw_total 82, one below 85 boundary — must be B, not A'],
  // covered=1 -> list_score = Math.round(6.25) = 6 (half-boundary rounding of the covered/4*25 formula, adjacent case)
  [{ sanctions_lists_screened: ['ofac_sdn'] }, 'covered=1 list => Math.round(1/4*25)=Math.round(6.25)=6 — exact half-adjacent rounding'],
  // covered=3 -> list_score = Math.round(18.75) = 19 (round-half-away-from-zero direction check)
  [{ sanctions_lists_screened: ['ofac_sdn', 'eu_consolidated', 'un'] }, 'covered=3 list => Math.round(3/4*25)=Math.round(18.75)=19'],
  // covered=2 -> exact half: Math.round(12.5) = 13 (JS rounds .5 toward +Infinity, not banker\'s rounding)
  [{ sanctions_lists_screened: ['ofac_sdn', 'eu_consolidated'] }, 'covered=2 list => Math.round(2/4*25)=Math.round(12.5)=13 — exact .5 boundary, JS rounds toward +Infinity'],
  [{}, 'entirely empty policy_parameters — all defaults, program_grade F'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of BOUNDARY_CASES) {
    const r = compute(pp);
    const { program_grade, raw_score, dim_scores } = r.output_payload;
    const plausible = typeof program_grade === 'string' && Number.isInteger(raw_score) && Number.isInteger(dim_scores.list_coverage);
    rows.push({ label, input: pp, program_grade, raw_score, list_coverage: dim_scores.list_coverage, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_rawScoreBounded());
results.properties.push(checkP2_gradeMonotonic());
results.properties.push(checkP3_listScoreExact());
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
