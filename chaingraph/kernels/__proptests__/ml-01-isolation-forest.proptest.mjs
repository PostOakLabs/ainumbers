// ml-01-isolation-forest.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C14-1).
// kernel_digest_at_authoring: sha256:157a2103a758127d8f6afe40c5c7733d63896ccf6cfaf8a4f9f1ef80b103126f
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (direct read confirmed — split points, path lengths, and anomaly scores
// are all float arithmetic, and `scores.filter(s => s >= threshold)` is a float-threshold
// comparison) — ULP-boundary forcing is MANDATORY per spec §3.
// ⭐ HIGHEST-SCRUTINY ITEM IN THIS SHARD (per WU row): this is a seeded tree-building simulation
// over generated data. Its termination is bounded (recursion depth capped at maxDepth =
// ceil(log2(subsample)), transaction count capped at min(n_transactions, 5000)), but the
// property that actually matters here is DETERMINISM, not convergence: same seed -> same LCG
// stream -> same generated transactions -> same forest structure -> byte-identical output_payload
// on every run, tested explicitly (P2) as this kernel's convergence-or-report-shaped obligation.
// Checks: fixture-oracle gate, termination (n_transactions_scored always equals
// min(n_transactions,5000); the recursive buildITree/pathLen bottoms out because data.length
// strictly shrinks or maxDepth reaches 0 on every recursive call — no unconditional recursion),
// the mandatory determinism property (identical policy_parameters, including seed, produce
// byte-identical output_payload across repeated calls -- this kernel's LCG PRNG has no hidden
// entropy source), boundedness (flag_rate/mean/p95/max anomaly scores all stay in [0,1], since
// the isolation-forest score is 2^(-avgPathLen/cN) which is always in (0,1]), and ULP-boundary
// forcing on the threshold >= comparison and the degenerate-subsample kill condition at
// subsample=1 and subsample > scored population (ML01-SCORER-GUARDS-1: those refuse as
// structured did_not_run, they never emit a verdict).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/ml-01-isolation-forest.proptest.mjs

import { compute } from '../ml-01-isolation-forest.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'ml-01-isolation-forest.fixtures.json');
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
const rand = mulberry32(0x0159A);

// keep trial sizes modest -- this kernel does real recursive tree-building work per call.
function randomPP(rng) {
  return {
    n_transactions: 20 + Math.floor(rng() * 130),
    contamination_rate: rng() * 0.2,
    seed: Math.floor(rng() * 1e6),
    n_trees: 1 + Math.floor(rng() * 6),
    subsample_size: 4 + Math.floor(rng() * 60),
    threshold: 0.3 + rng() * 0.5,
  };
}

const TRIALS = 200;

// ML01-SCORER-GUARDS-1: a degenerate subsample (<=1 or > scored population) is a structured
// refusal, never a verdict. These helpers let each property test the right contract for the
// draw it got (kill contract itself is asserted directly in P4).
function isRefusal(result) {
  return result.output_payload.execution_state === 'did_not_run';
}
function assertRefusalShape(result) {
  const p = result.output_payload;
  const flags = result.compliance_flags;
  return p.execution_state === 'did_not_run'
    && p.reason === 'degenerate_subsample_size'
    && p.decision === null
    && !('verdict' in p)
    && Array.isArray(flags) && flags.length === 1
    && flags[0] === 'ANOMALY_DETECTION_KILL_CONDITION_DEGENERATE_SUBSAMPLE';
}

// ---------- P1: termination — n_transactions_scored bounded, recursion terminates ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (isRefusal({ output_payload })) continue; // refusal draw: kill contract asserted in P4
    if (output_payload.n_transactions_scored !== Math.min(pp.n_transactions, 5000)) violations++;
  }
  // deliberately large n_transactions -- capped at 5000, never runs unbounded.
  const big = compute({ n_transactions: 50000, contamination_rate: 0.05, seed: 1, n_trees: 1, subsample_size: 32, threshold: 0.6 });
  checked++;
  if (big.output_payload.n_transactions_scored !== 5000) violations++;
  return { name: 'P1_termination_transaction_count_capped', trials: checked, violations };
}

// ---------- P2 (mandatory, determinism-as-convergence-or-report): same seed -> byte-identical output ----------
function checkP2_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 100; i++) {
    const pp = randomPP(rand);
    const r1 = compute(pp).output_payload;
    const r2 = compute({ ...pp }).output_payload;
    checked++;
    if (JSON.stringify(r1) !== JSON.stringify(r2)) violations++;
  }
  // flagship case: 3 repeated calls with the identical fixture-shaped params.
  const fixed = { n_transactions: 200, contamination_rate: 0.05, seed: 42, n_trees: 5, subsample_size: 64, threshold: 0.6 };
  const runs = [compute(fixed).output_payload, compute(fixed).output_payload, compute(fixed).output_payload];
  checked++;
  if (JSON.stringify(runs[0]) !== JSON.stringify(runs[1]) || JSON.stringify(runs[1]) !== JSON.stringify(runs[2])) violations++;
  return { name: 'P2_determinism_mandatory_same_seed_byte_identical', trials: checked, violations };
}

// ---------- P3: boundedness — flag_rate/mean/p95/max anomaly scores in [0,1] ----------
function checkP3_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (isRefusal({ output_payload })) continue; // refusal draw: kill contract asserted in P4
    if (output_payload.flag_rate < 0 || output_payload.flag_rate > 1) violations++;
    if (output_payload.mean_anomaly_score < 0 || output_payload.mean_anomaly_score > 1) violations++;
    if (output_payload.p95_anomaly_score < 0 || output_payload.p95_anomaly_score > 1) violations++;
    if (output_payload.max_anomaly_score < 0 || output_payload.max_anomaly_score > 1) violations++;
    if (!Number.isFinite(output_payload.mean_anomaly_score)) violations++;
    if (output_payload.flagged_count < 0 || output_payload.flagged_count > output_payload.n_transactions_scored) violations++;
  }
  return { name: 'P3_boundedness_scores_and_flag_rate_in_unit_interval', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes) ----------
function checkP4_ulp_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  const base = { n_transactions: 60, contamination_rate: 0.05, seed: 7, n_trees: 3, subsample_size: 16 };

  // threshold boundary forcing -- values around 0, 1, and near typical score magnitudes
  const thresholds = [0, -0, 1, 1 - eps, 1 + eps, eps, 0.5, 0.5 - eps, 0.5 + eps];
  for (const threshold of thresholds) {
    const { output_payload } = compute({ ...base, threshold });
    checked++;
    if (!Number.isFinite(output_payload.flag_rate)) violations++;
    if (output_payload.flagged_count < 0) violations++;
  }

  // subsample_size=1 edge -> cN(1) = 0 (the kernel's own cN()), so the score's
  // -avgLen/cN exponent divides by zero and the pre-ML01-SCORER-GUARDS-1 kernel emitted
  // NaN scores (JSON.stringify(NaN) === null) with a "NORMAL" verdict. The kernel now
  // FAILS CLOSED: the degenerate subsample is a structured did_not_run refusal
  // (art-536 pattern), never a verdict, never NaN in the payload.
  const single1 = compute({ ...base, subsample_size: 1 });
  checked++;
  if (!assertRefusalShape(single1)) violations++;
  const single1b = compute({ ...base, subsample_size: 1 });
  checked++;
  if (JSON.stringify(single1) !== JSON.stringify(single1b)) violations++; // refusal still deterministic

  // subsample_size=2 -> cN(2)=1 (nonzero), scores stay finite; confirms the kill is isolated to n<=1.
  const single2 = compute({ ...base, subsample_size: 2 });
  checked++;
  if (!Number.isFinite(single2.output_payload.mean_anomaly_score)) violations++;

  // subsample_size > scored population -> the same refusal (the unclamped-normaliser defect
  // class: trees drew min(ss,n) points while the normaliser divided by cN(declared ss)).
  const over = compute({ ...base, subsample_size: 999 });
  checked++;
  if (!assertRefusalShape(over)) violations++;

  // n_transactions small edges. NOTE: `Number(pp.n_transactions) || 1000` means
  // n_transactions:0 is falsy and silently falls back to the 1000 default -- documented as
  // kernel behavior, not treated as a floor violation. n=1 and n=2 with subsample_size=4
  // are degenerate (ss > scored population) and must REFUSE, never emit a verdict.
  for (const [n, wantRefusal] of [[0, false], [1, true], [2, true]]) {
    const r = compute({ contamination_rate: 0.05, seed: 7, n_trees: 3, subsample_size: 4, n_transactions: n });
    checked++;
    if (wantRefusal) {
      if (!assertRefusalShape(r)) violations++;
    } else if (isRefusal(r) || r.output_payload.n_transactions_scored !== 1000) violations++;
  }

  return { name: 'P4_ulp_boundary_forcing_threshold_and_subsample_edges', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_determinism());
results.properties.push(checkP3_boundedness());
results.properties.push(checkP4_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'ml-01-isolation-forest',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
