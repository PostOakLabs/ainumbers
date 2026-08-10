// kernel_digest_at_authoring: sha256:a8dc570f0262a6be9c06dc3b094353f70b4e87b7b379e93f7113086935456dbc
//
// FV-PROPFLOOR-SHARD-B1-1 — property-test floor for 506-onchain-cash-leg-finality-checker.
// Class B (bounded-numeric), FLOAT-SENSITIVE (pct sums, depeg_bps ratio) — ULP-boundary forcing
// is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies. Read-only w.r.t. kernel.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/506-onchain-cash-leg-finality-checker.proptest.mjs

import { compute } from '../506-onchain-cash-leg-finality-checker.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', '506-onchain-cash-leg-finality-checker.fixtures.json');
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
const rand = mulberry32(0x506A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const FINALITY_MODELS = ['atomic_dvp_bound', 'conditional_irrevocable', 'standard_blockchain', 'traditional_wire', 'unknown_model'];
const JURISDICTIONS = ['us', 'eu', 'uk', 'other'];
const WINDOWS = ['t0', 't1', 't2_plus', 'unknown'];
const TRIALS = 20000;

function randPP(rng) {
  return {
    finality_model: pick(rng, FINALITY_MODELS),
    jurisdiction: pick(rng, JURISDICTIONS),
    reserve_attestation: rng() < 0.5,
    cash_pct: randRange(rng, 0, 100),
    tbills_pct: randRange(rng, 0, 100),
    repo_pct: randRange(rng, 0, 100),
    depeg_bps: randRange(rng, 0, 500),
    redemption_window: pick(rng, WINDOWS),
  };
}

// ---------- P1: monotone in cash_pct (genius_sum increases as cash_pct increases, all else fixed) ----------
function checkP1_monotoneGeniusSum() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const base = randPP(rand);
    const cash1 = randRange(rand, 0, 50);
    const cash2 = cash1 + randRange(rand, 0, 50); // cash2 >= cash1
    const r1 = compute({ ...base, cash_pct: cash1 });
    const r2 = compute({ ...base, cash_pct: cash2 });
    checked++;
    if (r2.output_payload.genius_sum < r1.output_payload.genius_sum - 1e-6) violations++;
  }
  return { name: 'P1_monotone_in_cash_pct_genius_sum', trials: checked, violations };
}

// ---------- P2: boundedness — verdict/finality_flag stay within the declared enum ----------
const VERDICTS = new Set(['PASS', 'CONDITIONAL', 'FAIL']);
const FLAGS = new Set(['FINALITY_ATOMIC', 'FINALITY_CONDITIONAL', 'FINALITY_BLOCKCHAIN', 'FINALITY_TRADITIONAL_WIRE']);
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(randPP(rand)).output_payload;
    checked++;
    if (!VERDICTS.has(r.verdict)) violations++;
    if (!FLAGS.has(r.finality_flag)) violations++;
    if (!Number.isFinite(r.genius_sum)) violations++;
  }
  return { name: 'P2_boundedness_declared_enums', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — depeg_wide iff depeg_bps/100 > 1.0 ----------
function checkP3_depegThreshold() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    const expected = (pp.depeg_bps / 100) > 1.0;
    if (r.depeg_wide !== expected) violations++;
  }
  return { name: 'P3_depeg_wide_threshold_agreement', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  ['depeg_bps=100.00000000000001 boundary', { finality_model: 'atomic_dvp_bound', jurisdiction: 'us', reserve_attestation: true, cash_pct: 100, tbills_pct: 0, repo_pct: 0, depeg_bps: 100.00000000000001, redemption_window: 't0' }],
  ['depeg_bps=99.99999999999999 just under', { finality_model: 'atomic_dvp_bound', jurisdiction: 'us', reserve_attestation: true, cash_pct: 100, tbills_pct: 0, repo_pct: 0, depeg_bps: 99.99999999999999, redemption_window: 't0' }],
  ['depeg_bps=100 exact — 100/100=1.0, must NOT be wide (> not >=)', { finality_model: 'atomic_dvp_bound', jurisdiction: 'us', reserve_attestation: true, cash_pct: 100, tbills_pct: 0, repo_pct: 0, depeg_bps: 100, redemption_window: 't0' }],
  ['depeg_bps=-0 negative zero', { finality_model: 'atomic_dvp_bound', jurisdiction: 'us', reserve_attestation: true, cash_pct: 100, tbills_pct: 0, repo_pct: 0, depeg_bps: -0, redemption_window: 't0' }],
  ['genius_sum boundary: cash+tbills+repo = 95 exactly, us, no attestation', { finality_model: 'atomic_dvp_bound', jurisdiction: 'us', reserve_attestation: false, cash_pct: 60, tbills_pct: 30, repo_pct: 5, depeg_bps: 0, redemption_window: 't0' }],
  ['genius_sum boundary: 94.99999999999999, us, no attestation — must fail genius', { finality_model: 'atomic_dvp_bound', jurisdiction: 'us', reserve_attestation: false, cash_pct: 60, tbills_pct: 29.99999999999999, repo_pct: 5, depeg_bps: 0, redemption_window: 't0' }],
  ['subnormal pct components', { finality_model: 'atomic_dvp_bound', jurisdiction: 'us', reserve_attestation: true, cash_pct: Number.MIN_VALUE, tbills_pct: Number.MIN_VALUE, repo_pct: 0, depeg_bps: 0, redemption_window: 't0' }],
  ['x/y*y!==x-shaped fractional pcts', { finality_model: 'standard_blockchain', jurisdiction: 'eu', reserve_attestation: true, cash_pct: 33.333333333333336, tbills_pct: 33.333333333333336, repo_pct: 33.333333333333336, depeg_bps: 0, redemption_window: 't0' }],
];

function checkP4_forced() {
  const rows = [];
  for (const [label, pp] of ULP_BOUNDARY_CASES) {
    const r = compute(pp).output_payload;
    const finite = Number.isFinite(r.genius_sum);
    const depegExpected = (pp.depeg_bps / 100) > 1.0;
    const depegAgrees = r.depeg_wide === depegExpected;
    rows.push({ label, depeg_bps: pp.depeg_bps, genius_sum: r.genius_sum, depeg_wide: r.depeg_wide, verdict: r.verdict, finite, depeg_agrees: depegAgrees, plausible: finite && depegAgrees });
  }
  return rows;
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneGeniusSum());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_depegThreshold());
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
