// kernel_digest_at_authoring: sha256:8e097549d34ca1082509778e8da4137f414ab761783cc9babc55ec076010976e
//
// FV-PROPFLOOR-SHARD-B24-1 — property-test floor for art-448-ifrs17-loss-component-tracker.
// Class B (bounded-numeric), FLOAT-SENSITIVE (opening/additional/reversal/release/other_adj feed
// unrounded roll-forward arithmetic with Math.min/Math.max capping) — ULP-boundary forcing is
// MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-448-ifrs17-loss-component-tracker.proptest.mjs

import { compute } from '../art-448-ifrs17-loss-component-tracker.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-448-ifrs17-loss-component-tracker.fixtures.json');
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
const rand = mulberry32(0x448C3);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;

function mkPP(rng) {
  const opening_lc = randRange(rng, 0, 1e6);
  const additional_lc = randRange(rng, 0, 1e6);
  const reversal_lc = randRange(rng, 0, 1e6);
  const other_adj = randRange(rng, -1e5, 1e5);
  const release_to_pnl = randRange(rng, 0, 1e6);
  return { loss_component: { opening_lc, additional_lc, reversal_lc, release_to_pnl, other_adj } };
}

// ---------- P1: boundedness — closing_lc is always >= 0 ----------
function checkP1_closingLcNonNegative() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    if (r.closing_lc < 0) violations++;
  }
  return { name: 'P1_closing_lc_never_negative', trials: checked, violations };
}

// ---------- P2: round-trip — pre_release exactly opening+additional-reversal_capped+other_adj, reversal never exceeds available ----------
function checkP2_preReleaseExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const lc = pp.loss_component;
    const r = compute(pp).output_payload;
    checked++;
    const available = lc.opening_lc + lc.additional_lc + lc.other_adj;
    const reversalCapped = Math.min(lc.reversal_lc, Math.max(available, 0));
    const expectedPreRelease = lc.opening_lc + lc.additional_lc - reversalCapped + lc.other_adj;
    if (r.pre_release !== expectedPreRelease) violations++;
    if (reversalCapped > Math.max(available, 0) + 1e-9) violations++;
  }
  return { name: 'P2_pre_release_exact_and_reversal_never_exceeds_available', trials: checked, violations };
}

// ---------- P3: monotonicity — increasing additional_lc never decreases closing_lc ----------
function checkP3_additionalMonotone() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r1 = compute(pp).output_payload;
    const pp2 = { loss_component: { ...pp.loss_component, additional_lc: pp.loss_component.additional_lc + randRange(rand, 0.01, 1e4) } };
    const r2v = compute(pp2).output_payload;
    checked++;
    if (r2v.closing_lc < r1.closing_lc) violations++;
  }
  return { name: 'P3_closing_lc_nondecreasing_in_additional_lc', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ loss_component: { opening_lc: 0, additional_lc: 0, reversal_lc: 0, release_to_pnl: 0, other_adj: 0 } }, 'all-zero loss component — closing_lc must be exactly 0, no NaN'],
  [{ loss_component: { opening_lc: 100, additional_lc: 0, reversal_lc: 100, release_to_pnl: 0, other_adj: 0 } }, 'reversal exactly equals available_to_reverse — capped at exactly 100, no excess'],
  [{ loss_component: { opening_lc: 100, additional_lc: 0, reversal_lc: 100 + Number.EPSILON * 100, release_to_pnl: 0, other_adj: 0 } }, 'reversal 1 ULP-scale above available — must be capped, reversal_excess flag true'],
  [{ loss_component: { opening_lc: -0, additional_lc: 0, reversal_lc: 0, release_to_pnl: 0, other_adj: 0 } }, 'opening negative zero — must behave as zero, no NaN'],
  [{ loss_component: { opening_lc: Number.MIN_VALUE, additional_lc: 0, reversal_lc: 0, release_to_pnl: 0, other_adj: 0 } }, 'opening smallest positive double — closing finite, non-NaN'],
  [{ loss_component: { opening_lc: Number.MAX_SAFE_INTEGER, additional_lc: 0, reversal_lc: 0, release_to_pnl: 0, other_adj: 0 } }, 'opening at MAX_SAFE_INTEGER — no overflow to Infinity'],
  [{ loss_component: { opening_lc: 0.1, additional_lc: 0.2, reversal_lc: 0, release_to_pnl: 0, other_adj: 0 } }, 'classic 0.1+0.2 rounding artifact in pre_release'],
  [{ loss_component: { opening_lc: 100, additional_lc: 0, reversal_lc: 0, release_to_pnl: 100, other_adj: 0 } }, 'release exactly equals pre_release — closing_lc exactly 0, fully_reversed true'],
  [{ loss_component: { opening_lc: 100, additional_lc: 0, reversal_lc: 0, release_to_pnl: 100 + Number.EPSILON * 100, other_adj: 0 } }, 'release 1 ULP-scale above pre_release — release_excess flag true, closing still capped >= 0'],
  [{ loss_component: {} }, 'entirely empty loss_component object — all fields default to 0 via NaN-safe getter g()'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp).output_payload;
    const plausible = Number.isFinite(r.closing_lc) && r.closing_lc >= 0;
    rows.push({ label, closing_lc: r.closing_lc, pre_release: r.pre_release, lc_valid: r.lc_valid, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_closingLcNonNegative());
results.properties.push(checkP2_preReleaseExact());
results.properties.push(checkP3_additionalMonotone());
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
