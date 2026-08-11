// 503-canton-tokenization-readiness-diagnostic property-test floor (FV-PROPFLOOR-SHARD-A-BOOLDIM-2).
// kernel_digest_at_authoring: sha256:cd83aaa98a7055cdc55b74bf14d81e559e4797625a9796e5d8deaa43a9021157
// human_sign_off: PENDING
//
// Total-correctness-by-exhaustion, exact shape reused from FV-PROPFLOOR-SHARD-A-BOOLDIM-1's siblings
// (art-164/170/176/182/188). 12 questions (q1..q12), nominal 3-value domain ('yes'/'partial'/'no') but
// the kernel tests only `pp[q] === 'yes'` per question -- confirmed by direct read of
// ../503-canton-tokenization-readiness-diagnostic.kernel.mjs line 55 (`d.qs.filter(q => pp[q] === 'yes')`).
// 'partial' and 'no' both fold to the same not-yes branch, so this is behaviorally boolean-per-question,
// not ternary -- 2^12 = 4,096 distinct reachable states, enumerated in full below (not sampled).
// ZERO external dependencies -- pure Node built-ins only. READ-ONLY w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/503-canton-tokenization-readiness-diagnostic.proptest.mjs

import { compute } from '../503-canton-tokenization-readiness-diagnostic.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

// ---------- fixture-oracle gate (MANDATORY before any property is trusted) ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', '503-canton-tokenization-readiness-diagnostic.fixtures.json');
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
  const good = { q1: 'yes', q2: 'yes', q3: 'yes', q4: 'yes', q5: 'yes', q6: 'yes', q7: 'yes', q8: 'yes', q9: 'yes', q10: 'yes', q11: 'yes', q12: 'yes' };
  const { output_payload } = compute(good);
  const mutated = { ...output_payload, total_score: output_payload.total_score === 100 ? 50 : 100 };
  const wouldPass = JSON.stringify(mutated) === JSON.stringify(output_payload);
  return { rejected_wrong_spec: !wouldPass };
}

// ---------- declared domains ----------
const DOMAINS = [
  { key: 'settlement_ops',      weight: 20, qs: ['q1', 'q2'],   threshold: 10 },
  { key: 'custody_eligibility', weight: 18, qs: ['q3', 'q4'],   threshold: 9 },
  { key: 'cash_leg',            weight: 18, qs: ['q5', 'q6'],   threshold: 9 },
  { key: 'privacy_disclosure',  weight: 14, qs: ['q7', 'q8'],   threshold: 7 },
  { key: 'aml_kya',             weight: 15, qs: ['q9', 'q10'],  threshold: 7.5 },
  { key: 'capital_governance',  weight: 15, qs: ['q11', 'q12'], threshold: 7.5 },
];
const ALL_QS = DOMAINS.flatMap((d) => d.qs); // q1..q12, index order fixed

function getExpectedGrade(score) {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  if (score >= 25) return 'E';
  return 'F';
}

// P1: full 2^12 enumeration -- domain_scores, total_score, verdict, gaps, compliance_flags all agree
// with a from-scratch re-derivation of the kernel's own spec.
function checkP1_fullEnumerationAgreement() {
  let violations = 0, checked = 0;
  for (let mask = 0; mask < 4096; mask++) {
    const pp = {};
    ALL_QS.forEach((q, i) => { pp[q] = (mask >> i) & 1 ? 'yes' : 'no'; });

    const { output_payload, compliance_flags } = compute(pp);
    checked++;

    let expectedTotal = 0;
    const expectedGaps = [];
    for (const d of DOMAINS) {
      const yesCount = d.qs.filter((q) => pp[q] === 'yes').length;
      const dScore = (yesCount / 2) * d.weight;
      if (Math.abs(output_payload.domain_scores[d.key] - dScore) > 1e-9) violations++;
      if (dScore < d.threshold) expectedGaps.push(d.key);
      expectedTotal += dScore;
    }
    expectedTotal = +expectedTotal.toFixed(1);
    const expectedGrade = getExpectedGrade(expectedTotal);
    const expectedReady = expectedGrade === 'A' || expectedGrade === 'B';

    if (Math.abs(output_payload.total_score - expectedTotal) > 1e-9) violations++;
    if (output_payload.verdict !== expectedGrade) violations++;
    if (JSON.stringify(output_payload.gaps) !== JSON.stringify(expectedGaps)) violations++;
    if (!compliance_flags.includes(expectedReady ? 'CANTON_READY' : 'NOT_CANTON_READY')) violations++;
  }
  return { name: 'P1_full_4096_state_enum_agreement', trials: checked, violations };
}

// P2: strict 'yes' read -- 'partial' and any non-'yes' truthy value never count toward a domain.
function checkP2_strictYesRead() {
  let violations = 0, checked = 0;
  const NEAR_YES = ['partial', 'Yes', 'YES', true, 1, ' yes', 'yes ', null, undefined, ''];
  for (const v of NEAR_YES) {
    const pp = {};
    ALL_QS.forEach((q) => { pp[q] = v; });
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.total_score !== 0) violations++;
    if (output_payload.verdict !== 'F') violations++;
    if (output_payload.gaps.length !== DOMAINS.length) violations++;
  }
  return { name: 'P2_strict_yes_read_non_yes_never_counts', trials: checked, violations };
}

// P3: output shape / no NaN / undefined, values in expected ranges, regardless of input.
function checkP3_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [
    {},
    { q1: 'yes' },
    { q1: 'yes', q2: 'partial', q3: 'no' },
    { q1: 'yes', q2: 'yes', q3: 'yes', q4: 'yes', q5: 'yes', q6: 'yes', q7: 'yes', q8: 'yes', q9: 'yes', q10: 'yes', q11: 'yes', q12: 'yes' },
  ];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (!Number.isFinite(output_payload.total_score)) violations++;
    if (output_payload.total_score < 0 || output_payload.total_score > 100) violations++;
    if (!['A', 'B', 'C', 'D', 'E', 'F'].includes(output_payload.verdict)) violations++;
    if (!Array.isArray(output_payload.gaps)) violations++;
    if (typeof output_payload.domain_scores !== 'object' || output_payload.domain_scores === null) violations++;
    if (Object.keys(output_payload.domain_scores).length !== DOMAINS.length) violations++;
  }
  return { name: 'P3_output_shape_no_nan_undefined', trials: checked, violations };
}

// P4: monotonicity -- flipping any single question from not-yes to yes never decreases total_score
// (score is monotone non-decreasing in yes-count).
function checkP4_monotonicity() {
  let violations = 0, checked = 0;
  const rng = mulberry32Local(42);
  for (let trial = 0; trial < 500; trial++) {
    const base = {};
    ALL_QS.forEach((q) => { base[q] = rng() < 0.5 ? 'yes' : 'no'; });
    const flipIdx = Math.floor(rng() * ALL_QS.length);
    const flipQ = ALL_QS[flipIdx];
    if (base[flipQ] === 'yes') continue; // only test not-yes -> yes flips
    const bumped = { ...base, [flipQ]: 'yes' };

    const before = compute(base).output_payload;
    const after = compute(bumped).output_payload;
    checked++;
    if (after.total_score < before.total_score - 1e-9) violations++;
  }
  return { name: 'P4_monotone_nondecreasing_on_yes_flip', trials: checked, violations };
}

function mulberry32Local(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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

results.properties.push(checkP1_fullEnumerationAgreement());
results.properties.push(checkP2_strictYesRead());
results.properties.push(checkP3_outputShapeInvariant());
results.properties.push(checkP4_monotonicity());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  kernel_id: '503-canton-tokenization-readiness-diagnostic',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  negative_control: negControl,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
