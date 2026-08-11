// kernel_digest_at_authoring: sha256:fd8a869feabce17a886f3ccfab9cd1934a02f866b36883269c186a0af544c5a0
//
// FV-PROPFLOOR-SHARD-B12-1 — property-test floor for art-320-rhc-collateral-haircut.
// Class B (bounded-numeric), FLOAT-SENSITIVE (base_haircut is an unrounded float composed with
// fixed decimal add-ons and clamped via Math.max/Math.min) — ULP-boundary forcing is MANDATORY
// per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-320-rhc-collateral-haircut.proptest.mjs

import { compute } from '../art-320-rhc-collateral-haircut.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-320-rhc-collateral-haircut.fixtures.json');
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
const rand = mulberry32(0x320D4);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;

function mkPP(rng) {
  const position_value = randRange(rng, 1, 1000000);
  const base_haircut = randRange(rng, 0, 0.9);
  const current_time = 100000 + Math.floor(randRange(rng, 0, 100000));
  const heartbeat_seconds = Math.floor(randRange(rng, 60, 7200));
  const feed_ts = current_time - Math.floor(randRange(rng, 0, heartbeat_seconds * 2));
  const seq_up = rng() < 0.7;
  const seq_since = current_time - Math.floor(randRange(rng, 0, 600));
  const grace = Math.floor(randRange(rng, 0, 300));
  const halted = rng() < 0.15;
  return {
    position_value, base_haircut,
    feed_round: { timestamp: feed_ts, heartbeat_seconds },
    current_time,
    sequencer_uptime: { is_up: seq_up, since_timestamp: seq_since, grace_period_seconds: grace },
    underlying_market_state: { is_halted: halted },
  };
}

// ---------- P1: boundedness — final_haircut always clamped to [0, 1] ----------
function checkP1_finalHaircutBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const fh = r.output_payload.final_haircut;
    if (fh !== null && (fh < 0 || fh > 1)) violations++;
  }
  return { name: 'P1_final_haircut_clamped_0_to_1', trials: checked, violations };
}

// ---------- P2: fixed rule — extra_haircut exactly sums the declared 0.10/0.05/0.15 add-ons ----------
function checkP2_extraHaircutFixedSum() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { feed_stale, sequencer_down_within_grace, sequencer_down_grace_expired, underlying_halted, extra_haircut } = r.output_payload;
    let expected = 0;
    if (feed_stale) expected += 0.10;
    if (sequencer_down_within_grace) expected += 0.05;
    if (sequencer_down_grace_expired || underlying_halted) expected += 0.15;
    if (Math.abs(extra_haircut - expected) > 1e-12) violations++;
  }
  return { name: 'P2_extra_haircut_exact_fixed_addon_sum', trials: checked, violations };
}

// ---------- P3: monotonicity — increasing base_haircut never decreases final_haircut ----------
function checkP3_monotonicInBaseHaircut() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const lo = Math.min(pp.base_haircut, 0.5);
    const hi = Math.max(pp.base_haircut, 0.5) + 0.01;
    const rLo = compute({ ...pp, base_haircut: lo });
    const rHi = compute({ ...pp, base_haircut: hi });
    checked++;
    if (rHi.output_payload.final_haircut < rLo.output_payload.final_haircut - 1e-12) violations++;
  }
  return { name: 'P3_final_haircut_nondecreasing_in_base_haircut', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ current_time: 2000, feed_round: { timestamp: 1000, heartbeat_seconds: 1000 } }, 'current_time - timestamp EXACTLY equals heartbeat_seconds (strict > required) — feed_stale must be false at the exact boundary'],
  [{ current_time: 2000.0000000001, feed_round: { timestamp: 1000, heartbeat_seconds: 1000 } }, 'current_time - timestamp 1 ULP above heartbeat_seconds — feed_stale must flip true'],
  [{ base_haircut: 0.1 * 3 }, 'base_haircut = 0.1*3 (classic non-exact double 0.30000000000000004) — final_haircut must reflect that exact double before clamp/addons'],
  [{ base_haircut: -0 }, 'base_haircut negative zero — must behave as zero, no NaN'],
  [{ base_haircut: 1.5 }, 'base_haircut already above 1 before any addon — final_haircut must clamp to exactly 1'],
  [{ base_haircut: -0.5 }, 'base_haircut negative — final_haircut must clamp to exactly 0 when no addons apply'],
  [{ position_value: Number.MIN_VALUE }, 'position_value smallest positive double — adjusted_collateral_value must remain finite, non-NaN'],
  [{ sequencer_uptime: { is_up: false, since_timestamp: 1000, grace_period_seconds: 500 }, current_time: 1500 }, 'sequencer down, current_time - since_timestamp EXACTLY equals grace_period_seconds — kernel uses <=, so this must still classify as within-grace (0.05 addon), not grace-expired'],
  [{ base_haircut: NaN }, 'base_haircut is NaN — finite-input gate must trip, verdict INVALID_INPUT, final_haircut null'],
  [{ position_value: Number.MAX_SAFE_INTEGER, base_haircut: 0.15 }, 'position_value at MAX_SAFE_INTEGER — adjusted_collateral_value must not overflow or lose finiteness'],
];

function checkP4_forced() {
  const base = mkPP(mulberry32(0x320E5));
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = { ...base, ...overrides, feed_round: overrides.feed_round ?? base.feed_round, sequencer_uptime: overrides.sequencer_uptime ?? base.sequencer_uptime };
    const r = compute(pp);
    const { verdict, final_haircut, adjusted_collateral_value } = r.output_payload;
    const plausible = typeof verdict === 'string' && (final_haircut === null || Number.isFinite(final_haircut)) && (adjusted_collateral_value === null || Number.isFinite(adjusted_collateral_value));
    rows.push({ label, input: pp, verdict, final_haircut, adjusted_collateral_value, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_finalHaircutBounded());
results.properties.push(checkP2_extraHaircutFixedSum());
results.properties.push(checkP3_monotonicInBaseHaircut());
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
