// pnr-01-dora-ict-cascade-simulator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C15-1).
// kernel_digest_at_authoring: sha256:9d917a01d1bdbc594839dfc77028fc2bbd81a07914a295e215976b7fa3141cb6
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (Monte Carlo cascade propagation, cascade_threshold folded into the LCG seed
// via bitwise ^ on a rounded float, direct read confirmed) — ULP-boundary forcing is MANDATORY.
// Checks: fixture-oracle gate, termination (n_paths structurally clamped to [50,2000]), boundedness
// (dora_reporting_probability and every node_cascade_probabilities entry in [0,1]), seed-determinism
// metamorphic (same pp -> byte-identical output, twice), and ULP-boundary forcing on cascade_threshold.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/pnr-01-dora-ict-cascade-simulator.proptest.mjs
//
// MUTATION-MODE TRIAL CAP (PNR01-MUTATION-MC-COST-1, test-side MC-cost cut):
// Under the mutation tier (scripts/run-mutation-tier.mjs, Stryker 8.7.1 command
// runner) each of the kernel's 1,668 mutants (at authoring) re-runs this whole
// floor, so the full-trial counts cost ~293 s per mutant in-sandbox (measured
// repro of the 600 s MUTATION-TIER-HANG-MMS03-PNR01-1 TIMEOUT, EXIT=1) and no
// wall-clock bound is viable: the 600 s default is gone on the initial dry run
// plus the per-mutant process floor alone. The proptest may therefore cap its
// MC trial counts IN MUTATION MODE, detected two ways: (a) the seam Stryker
// itself owns — CommandTestRunner.mutantRun() sets env __STRYKER_ACTIVE_MUTANT__
// for MUTANT runs; (b) the tier sandbox cwd — run-mutation-tier.mjs copies this
// proptest into %TEMP%\ain-mutation-tier-<pid>\ and runs the Stryker INITIAL
// DRY RUN there too, so __dirname under that root marks dry-run context.
// MEASURED 2026-09-14 (push attempt 1, push-logs/pnr01-push-2026-09-14T151xZ):
// the first design left the dry run at FULL trials ("floor validated at FULL
// trials before any mutant runs"), but Stryker's own dryRunTimeout (default
// 300 s) killed the ~293 s full-trial dry run at exactly 5m01s — "Initial test
// run timed out" — before any mutant ran, a HARD FAIL (SO #34c: no report).
// The runner is out of this row's fence, so the dry run runs CAPPED too; the
// floor is still validated at FULL trials by the standalone repo-checkout run
// (full-trial proptest exit 0 quoted on the row's PR — run OUTSIDE the tier,
// where neither detection fires). OUTSIDE mutation mode nothing changes: full
// trials (2000 / 2000 / 1200 x2 / 8 + the 7 fixture vectors), the shipped
// floor. INSIDE the tier (dry run or mutant run) P1 trials, P2 trials and P3
// iterations are capped (default 25; override with documented
// env PROPFLOOR_TRIAL_CAP, a positive integer, invalid values throw). The
// fixture oracle and P4 ULP-boundary forcing are NEVER capped (mandatory,
// float_sensitive: YES). Every property is deterministic (seeded mulberry32;
// a capped run takes the first N draws of the same stream), so a violation
// found under the cap is found under full trials too: kill-power can only be
// affected by violations that first surface on a late draw, quantified by the
// fixed-mutant-subset before/after comparison quoted on the row's PR. The
// other named lever, perTest coverage via per-property files, does not exist
// for this tier: the command runner "does not know how many tests are executed
// or any code coverage results" (command-test-runner.ts, Stryker 8.7.1), one
// full command per mutant, so per-property split files would all still run.

import { compute } from '../pnr-01-dora-ict-cascade-simulator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'pnr-01-dora-ict-cascade-simulator.fixtures.json');
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
const rand = mulberry32(0x1103a1);
const TOPOLOGIES = ['bank_core', 'cloud_native', 'legacy_hybrid'];
const MTTR = ['fast', 'standard', 'slow'];
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomPP(rng) {
  return {
    topology: pick(rng, TOPOLOGIES),
    mttr_profile: pick(rng, MTTR),
    cascade_threshold: rng(),
    n_paths: Math.floor(rng() * 4000) - 1000, // deliberately spans outside [50,2000] both ends
    seed: Math.floor(rng() * 1e9),
  };
}

// ---------- mutation-mode trial cap (PNR01-MUTATION-MC-COST-1; see header) ----------
const MUTATION_MODE =
  process.env.__STRYKER_ACTIVE_MUTANT__ !== undefined ||
  __dirname.replace(/\\/g, '/').includes('/ain-mutation-tier-');
let mutationTrials = 25; // default per-mutant cap; full trials remain the default outside the tier
if (process.env.PROPFLOOR_TRIAL_CAP !== undefined) {
  const cap = Number(process.env.PROPFLOOR_TRIAL_CAP);
  if (!Number.isInteger(cap) || cap <= 0) {
    throw new Error(`PROPFLOOR_TRIAL_CAP must be a positive integer, got "${process.env.PROPFLOOR_TRIAL_CAP}"`);
  }
  mutationTrials = cap;
}
const TRIALS = MUTATION_MODE ? mutationTrials : 2000;
const P3_ITERATIONS = MUTATION_MODE ? mutationTrials : 1200;

// ---------- P1: termination — n_paths structurally clamped to [50,2000] ----------
function checkP1_termination_npaths_clamp() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.n_paths < 50 || output_payload.n_paths > 2000) violations++;
  }
  return { name: 'P1_termination_n_paths_clamped_50_to_2000', trials: checked, violations };
}

// ---------- P2: boundedness — every cascade probability stays in [0,1] ----------
function checkP2_boundedness_probabilities() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.dora_reporting_probability < 0 || output_payload.dora_reporting_probability > 1) violations++;
    for (const v of Object.values(output_payload.node_cascade_probabilities)) {
      if (v < 0 || v > 1) { violations++; break; }
    }
  }
  return { name: 'P2_boundedness_probabilities_in_0_1', trials: checked, violations };
}

// ---------- P3: metamorphic — seed-determinism (same pp twice -> byte-identical output) ----------
function checkP3_seed_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < P3_ITERATIONS; i++) {
    const pp = randomPP(rand);
    const r1 = compute(pp);
    const r2 = compute(pp);
    checked++;
    if (JSON.stringify(r1) !== JSON.stringify(r2)) violations++;
  }
  return { name: 'P3_seed_determinism_metamorphic', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes) ----------
function checkP4_ulp_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  const cascadeForced = [0, -0, eps, 1 - eps, 1, Number.MIN_VALUE, 0.5 - eps, 0.5 + eps];
  for (const ct of cascadeForced) {
    const { output_payload } = compute({ topology: 'bank_core', n_paths: 100, cascade_threshold: ct, seed: 7 });
    checked++;
    if (!Number.isFinite(output_payload.dora_reporting_probability)) violations++;
    if (output_payload.n_paths !== 100) violations++;
  }
  return { name: 'P4_ulp_boundary_forcing_cascade_threshold', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_npaths_clamp());
results.properties.push(checkP2_boundedness_probabilities());
results.properties.push(checkP3_seed_determinism());
results.properties.push(checkP4_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'pnr-01-dora-ict-cascade-simulator',
  float_sensitive: true,
  mutation_mode: MUTATION_MODE,
  trial_cap_applied: MUTATION_MODE ? mutationTrials : null,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
