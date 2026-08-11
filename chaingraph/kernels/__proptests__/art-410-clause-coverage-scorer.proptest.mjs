// art-410-clause-coverage-scorer.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C19-1).
// kernel_digest_at_authoring: sha256:43e9115f892a58de62567becc360a463707b7aa621dc6743cee3bda398be3d4d
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO — RE-CONFIRMED BY DIRECT READ, differs from a naive first read: the kernel
// DOES divide (coverage_pct = round((present/declared)*10000)/100), but every tier-boundary
// comparison (`coverage_pct === 100`, `>= 80`, `>= 50`) is made AFTER Math.round() has already
// collapsed the value to an exact integer-over-100. Since present_count/declared_count are always
// non-negative integers, `Math.round((p/d)*10000)` is always an exact JS integer n in [0,10000],
// and n/100 vs the clean literals 100/80/50 (all exactly representable, multiples of 100 in the
// n-space) can only be exactly equal when n itself is exactly 10000/8000/5000 — an integer
// equality with no floating rounding-noise window. There is no ULP boundary case that can flip a
// tier decision here; forced categorical boundary cases are used instead, per §3's rule that ULP
// forcing applies only where a genuine ULP-boundary decision exists.
// Checks: fixture-oracle gate, termination (all counts bounded by clauses.length, a single filter
// pass, no recursion), boundedness (present+modified+extra+missing === clauses.length after id
// dedup by last-write-wins... N/A, no dedup here so counts sum to clauses.length exactly), a
// differential re-derivation of coverage_pct/modification_pct/maturity_tier from the counts, and
// forced categorical boundary cases (zero clauses -> unrated, exactly 100%/80%/50% coverage
// boundaries, entries missing a string id are dropped).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-410-clause-coverage-scorer.proptest.mjs

import { compute } from '../art-410-clause-coverage-scorer.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-410-clause-coverage-scorer.fixtures.json');
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
const rand = mulberry32(0x410C19);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const STATUSES = ['present', 'modified', 'extra', 'missing', 'bogus'];

function randomPP(rng) {
  const n = Math.floor(rng() * 20);
  const clauses = Array.from({ length: n }, (_, i) => (
    rng() < 0.9 ? { id: `c${i}`, status: pick(rng, STATUSES) } : { status: pick(rng, STATUSES) } // 10%: missing id, dropped
  ));
  return { taxonomy: pick(rng, ['onesaas_52', 'art28_set', 'custom_thing']), clauses };
}

const TRIALS = 4000;

// ---------- P1: termination — counts bounded by clauses.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    const total = o.present_count + o.modified_count + o.extra_count + o.missing_count;
    if (total > pp.clauses.length) violations++;
  }
  return { name: 'P1_termination_status_counts_bounded_by_clauses_length', trials: checked, violations };
}

// ---------- P2: boundedness — declared_count === present+modified+missing, id-having clauses only ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.declared_count !== o.present_count + o.modified_count + o.missing_count) violations++;
    const idCount = pp.clauses.filter((c) => typeof c.id === 'string' && c.id.length > 0).length;
    if (o.present_count + o.modified_count + o.extra_count + o.missing_count !== idCount) violations++;
  }
  return { name: 'P2_declared_count_and_id_dropping_boundedness', trials: checked, violations };
}

// ---------- P3: differential — coverage_pct/modification_pct/maturity_tier re-derived ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    const expectedCoverage = o.declared_count > 0 ? Math.round((o.present_count / o.declared_count) * 10000) / 100 : 0;
    const expectedModification = o.declared_count > 0 ? Math.round((o.modified_count / o.declared_count) * 10000) / 100 : 0;
    if (o.coverage_pct !== expectedCoverage) violations++;
    if (o.modification_pct !== expectedModification) violations++;
    let expectedTier;
    if (o.declared_count === 0) expectedTier = 'unrated';
    else if (o.coverage_pct === 100) expectedTier = 'full';
    else if (o.coverage_pct >= 80) expectedTier = 'substantial';
    else if (o.coverage_pct >= 50) expectedTier = 'partial';
    else expectedTier = 'minimal';
    if (o.maturity_tier !== expectedTier) violations++;
  }
  return { name: 'P3_coverage_pct_and_tier_differential', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no — round-before-compare eliminates ULP risk) ----------
function checkP4_forced_categorical() {
  let violations = 0, checked = 0;
  // zero clauses -> unrated
  {
    const { output_payload: o } = compute({ clauses: [] });
    checked++;
    if (o.maturity_tier !== 'unrated') violations++;
    if (o.coverage_pct !== 0) violations++;
  }
  // exactly 100% coverage (5/5 present)
  {
    const clauses = Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, status: 'present' }));
    const { output_payload: o } = compute({ clauses });
    checked++;
    if (o.coverage_pct !== 100) violations++;
    if (o.maturity_tier !== 'full') violations++;
  }
  // exactly 80% coverage (4 present, 1 missing out of 5)
  {
    const clauses = [...Array.from({ length: 4 }, (_, i) => ({ id: `c${i}`, status: 'present' })), { id: 'c4', status: 'missing' }];
    const { output_payload: o } = compute({ clauses });
    checked++;
    if (o.coverage_pct !== 80) violations++;
    if (o.maturity_tier !== 'substantial') violations++;
  }
  // exactly 50% coverage (1 present, 1 missing out of 2)
  {
    const clauses = [{ id: 'c0', status: 'present' }, { id: 'c1', status: 'missing' }];
    const { output_payload: o } = compute({ clauses });
    checked++;
    if (o.coverage_pct !== 50) violations++;
    if (o.maturity_tier !== 'partial') violations++;
  }
  // entry missing a string id is dropped entirely, not counted as declared or extra
  {
    const { output_payload: o } = compute({ clauses: [{ status: 'present' }, { id: 42, status: 'present' }] });
    checked++;
    if (o.declared_count !== 0) violations++;
  }
  return { name: 'P4_forced_categorical_boundary_cases', trials: checked, violations };
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
results.properties.push(checkP4_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-410-clause-coverage-scorer',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
