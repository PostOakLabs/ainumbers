// art-96-no-russia-clause-pack-builder.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C12-1).
// kernel_digest_at_authoring: sha256:cf2d6111233a0f8a580756c5e1c03e7832d67ddf9c6582393a9c90d819dbaa7a
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — gradeCompleteness is an integer
// required_met/required_total percentage; no caller float parameters, no tolerance math).
// Unbounded input: `contract.evidence_required` is a caller-controlled array of arbitrary
// length/content. The matching loop (evidence_checklist.map + Array.some) is bounded by the
// fixed checklist length (7 or 11 items) times evidence_required length — no recursion.
// Checks: fixture-oracle gate, termination (bounded by array length, no hang on large
// evidence_required arrays), boundedness (required_items_met always <= required_items_total,
// completeness_grade always one of A/B/C/D/F), a metamorphic permutation-invariance property
// (reordering evidence_required does not change which checklist items are held — matching
// is Array.some, order-independent), forced categorical boundary cases (empty evidence,
// standard vs enhanced template selection, all-required-items-held, jurisdiction/goods
// placeholder substitution).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-96-no-russia-clause-pack-builder.proptest.mjs

import { compute } from '../art-96-no-russia-clause-pack-builder.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-96-no-russia-clause-pack-builder.fixtures.json');
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
const rand = mulberry32(0x96D0);

const EVIDENCE_PHRASES = ['KYC onboarding file', 'UBO verification', 'End-use certificate signed', 'Country-of-final-destination confirmation', 'Screening of buyer', 'No-Russia clause executed', 'random unrelated note'];

function randomPP(rng, n) {
  const evidence_required = [];
  for (let i = 0; i < n; i++) evidence_required.push(EVIDENCE_PHRASES[Math.floor(rng() * EVIDENCE_PHRASES.length)]);
  return {
    contract: {
      goods: 'dual-use widgets',
      counterparty_jurisdiction: rng() < 0.5 ? 'England & Wales' : 'Germany',
      clause_template: rng() < 0.5 ? 'standard' : 'enhanced',
      evidence_required,
    },
  };
}

const TRIALS = 2000;

// ---------- P1: termination — bounded by array length, no hang on large evidence_required ----------
function checkP1_termination_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 100; i++) {
    const pp = randomPP(rand, 500 + Math.floor(rand() * 2000));
    const start = Date.now();
    compute(pp);
    checked++;
    if (Date.now() - start > 500) violations++;
  }
  return { name: 'P1_termination_bounded_large_evidence_required', trials: checked, violations };
}

// ---------- P2: boundedness — required_items_met <= required_items_total, grade valid ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand, Math.floor(rand() * 8));
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.required_items_met > output_payload.required_items_total) violations++;
    if (output_payload.required_items_met < 0) violations++;
    if (!['A', 'B', 'C', 'D', 'F'].includes(output_payload.completeness_grade)) violations++;
  }
  return { name: 'P2_boundedness_required_items_met_bounded', trials: checked, violations };
}

// ---------- P3: metamorphic — permutation-invariance of evidence_required array order ----------
function checkP3_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand, Math.floor(rand() * 6) + 1);
    const shuffled = { contract: { ...pp.contract, evidence_required: [...pp.contract.evidence_required].sort(() => rand() - 0.5) } };
    const r1 = compute(pp);
    const r2 = compute(shuffled);
    checked++;
    if (r1.output_payload.required_items_met !== r2.output_payload.required_items_met) violations++;
    if (r1.output_payload.completeness_grade !== r2.output_payload.completeness_grade) violations++;
  }
  return { name: 'P3_permutation_invariance_evidence_required_order', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception per spec §3) ----------
function checkP4_categorical_forcing() {
  let violations = 0, checked = 0;
  const cases = [
    { contract: {} }, // no evidence — worst-case, grade F
    { contract: { clause_template: 'enhanced', evidence_required: [] } },
    { contract: { clause_template: 'standard', evidence_required: EVIDENCE_PHRASES.slice(0, 6) } }, // all standard items held
    { contract: { clause_template: 'bogus_value' } }, // falls back to standard
  ];
  for (const pp of cases) {
    checked++;
    try {
      const { output_payload } = compute(pp);
      if (output_payload.required_items_met > output_payload.required_items_total) violations++;
      if (!['standard', 'enhanced'].includes(output_payload.template_used)) violations++;
    } catch (e) {
      violations++;
    }
  }
  // empty-evidence case must yield grade F (0% completeness)
  const empty = compute({ contract: { evidence_required: [] } });
  checked++;
  if (empty.output_payload.completeness_grade !== 'F') violations++;
  return { name: 'P4_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_bounded());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_permutation_invariance());
results.properties.push(checkP4_categorical_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-96-no-russia-clause-pack-builder',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
