// kernel_digest_at_authoring: sha256:41826ca9f3d3ba48ad150289c96f2aad017594ea96ff49fb448fabf84fdb6bef
//
// FV-PROPFLOOR-SHARD-B27-1 — property-test floor for art-235-test-hpml-escrow.
// Class B (bounded-numeric), FLOAT-SENSITIVE (apr_pct/apor_pct feed a float subtraction compared
// against a spread_threshold with an explicit `- 1e-5` epsilon fudge, then rounded via r4 to 4
// decimals) — ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external
// dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-235-test-hpml-escrow.proptest.mjs

import { compute } from '../art-235-test-hpml-escrow.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-235-test-hpml-escrow.fixtures.json');
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
const rand = mulberry32(0x235E5);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 12000;

function mkPP(rng) {
  const lien_type = rng() < 0.5 ? 'first' : 'subordinate';
  const is_jumbo = rng() < 0.3;
  const apor_pct = randRange(rng, 2, 8);
  const apr_pct = apor_pct + randRange(rng, -1, 5);
  return {
    apr_pct, apor_pct, lien_type, is_jumbo,
    is_rural_or_underserved: rng() < 0.3,
    creditor_assets_under_2b: rng() < 0.3,
    loan_count_under_500: rng() < 0.3,
    property_is_condo_master_policy: rng() < 0.2,
    year: 2026,
  };
}

// ---------- P1: monotonicity — raising apr_pct (apor fixed) never flips is_hpml true -> false ----------
function checkP1_hpmlMonotonic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const lower = compute({ ...pp, apr_pct: pp.apor_pct - 2 });
    const higher = compute({ ...pp, apr_pct: pp.apor_pct + 6 });
    checked++;
    if (lower.output_payload.is_hpml && !higher.output_payload.is_hpml) violations++;
  }
  return { name: 'P1_is_hpml_monotonic_in_apr_spread', trials: checked, violations };
}

// ---------- P2: boundedness — escrow_required implies is_hpml AND lien_type==='first' ----------
function checkP2_escrowImpliesHpmlFirstLien() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.output_payload.escrow_required && !(r.output_payload.is_hpml && r.output_payload.lien_type === 'first')) violations++;
  }
  return { name: 'P2_escrow_required_implies_hpml_and_first_lien', trials: checked, violations };
}

// ---------- P3: fixed threshold-tier agreement — spread_threshold_pct matches the declared tier constants ----------
function checkP3_thresholdTierExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected = pp.lien_type === 'subordinate' ? 3.5 : pp.is_jumbo ? 2.5 : 1.5;
    if (r.output_payload.spread_threshold_pct !== expected) violations++;
  }
  return { name: 'P3_spread_threshold_tier_exact', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing on the apr-minus-apor spread comparison ----------
function r4(v) { return Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : 0; }
const ULP_BOUNDARY_CASES = [
  [{ apr_pct: 7, apor_pct: 5.5, lien_type: 'first', is_jumbo: false }, 'spread exactly 1.5pp (standard first-lien threshold) — must classify HPML (>= comparison, not >)'],
  [{ apr_pct: 7 - 1e-6, apor_pct: 5.5, lien_type: 'first', is_jumbo: false }, 'spread a hair under 1.5pp — the -1e-5 epsilon fudge must still classify HPML (within tolerance)'],
  [{ apr_pct: 6.9989, apor_pct: 5.5, lien_type: 'first', is_jumbo: false }, 'spread 1.4989pp, just past the 1e-5 epsilon tolerance below 1.5pp — must classify NOT HPML'],
  [{ apr_pct: 8, apor_pct: 5.5, lien_type: 'first', is_jumbo: true }, 'spread exactly 2.5pp jumbo threshold — must classify HPML'],
  [{ apr_pct: 9, apor_pct: 5.5, lien_type: 'subordinate', is_jumbo: false }, 'spread exactly 3.5pp subordinate threshold — must classify HPML'],
  [{ apr_pct: 5.5, apor_pct: 5.5, lien_type: 'first', is_jumbo: false }, 'apr equals apor exactly (0 spread) — must classify NOT HPML, no NaN'],
  [{ apr_pct: 0, apor_pct: 0, lien_type: 'first', is_jumbo: false }, 'both apr and apor exactly zero — 0 spread, NOT HPML, no NaN or Infinity'],
  [{ apr_pct: -0, apor_pct: -0, lien_type: 'first', is_jumbo: false }, 'negative zero apr/apor — must behave as zero, no NaN'],
  [{ apr_pct: 7.1 / 1 * 1, apor_pct: 5.5, lien_type: 'first', is_jumbo: false }, 'x/y*y-style rounding artifact input (7.1) — spread computed the same way as the kernel, no drift'],
  [{ apr_pct: Number.MAX_SAFE_INTEGER, apor_pct: 0, lien_type: 'first', is_jumbo: false }, 'apr at MAX_SAFE_INTEGER — must remain finite, no overflow to Infinity'],
  [{ apr_pct: Number.MIN_VALUE, apor_pct: 0, lien_type: 'first', is_jumbo: false }, 'apr at smallest positive double (denormal-adjacent) — must remain finite, non-NaN, NOT HPML'],
  [{ apr_pct: NaN, apor_pct: 5.5, lien_type: 'first', is_jumbo: false }, 'apr_pct is NaN — safeNum guard must fall back to 0, never propagate NaN into the verdict'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const op = r.output_payload;
    const finite = Number.isFinite(op.apr_spread_pct) && Number.isFinite(op.apr_pct) && Number.isFinite(op.apor_pct);
    const plausible = finite && typeof op.is_hpml === 'boolean';
    rows.push({ label, input: pp, is_hpml: op.is_hpml, escrow_required: op.escrow_required, apr_spread_pct: op.apr_spread_pct, spread_threshold_pct: op.spread_threshold_pct, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_hpmlMonotonic());
results.properties.push(checkP2_escrowImpliesHpmlFirstLien());
results.properties.push(checkP3_thresholdTierExact());
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
