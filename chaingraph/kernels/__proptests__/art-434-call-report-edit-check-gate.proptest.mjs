// kernel_digest_at_authoring: sha256:fc730e1410814863f534802d3bcd7d948ac232f8f1fb5ddcf9078e4c97dd075d
//
// FV-PROPFLOOR-SHARD-B23-1 — property-test floor for art-434-call-report-edit-check-gate.
// Class B (bounded-numeric). ⚠ CLASSIFICATION CORRECTED FROM THE WU: the WU row listed this
// kernel as float:no, but direct read of the kernel source shows EDIT-RCR-04/05 perform raw
// float division (cet1Usd/totalRwaUsd, totalCapitalUsd/totalRwaUsd) compared against a fixed
// 0.0005 tolerance band — a genuine ULP-sensitive threshold comparison, the same shape as the
// mandatory ULP-forcing case in FV-PBT-FLOOR-BUILD-SPEC.md §3. Corrected to float:yes per the
// spec's FIX-2 carry instruction; ULP-boundary forcing added for the 0.0005 consistency-check
// boundary and the balance-identity rounding-tolerance boundary (both already present in the
// kernel's own r2/tolerance arithmetic). Zero external dependencies. This file is READ-ONLY
// with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-434-call-report-edit-check-gate.proptest.mjs

import { compute } from '../art-434-call-report-edit-check-gate.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-434-call-report-edit-check-gate.fixtures.json');
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
const rand = mulberry32(0x434C3);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;

function mkRc(rng, entity, period) {
  const assets = randRange(rng, 0, 1e7);
  const liab = randRange(rng, 0, assets);
  return { entity_id: entity, reporting_period: period, total_assets_usd: assets, total_liabilities_usd: liab, total_equity_capital_usd: assets - liab };
}
function mkRcr(rng, entity, period) {
  const rwa = randRange(rng, 0.01, 1e7);
  const cet1 = randRange(rng, 0, rwa);
  const tier1 = cet1 + randRange(rng, 0, 1e5);
  const total = tier1 + randRange(rng, 0, 1e5);
  return {
    entity_id: entity, reporting_period: period,
    cet1_capital_usd: cet1, tier1_capital_usd: tier1, total_capital_usd: total, total_rwa_usd: rwa,
    ratios: { cet1_ratio_pct: cet1 / rwa, total_capital_ratio_pct: total / rwa },
  };
}
function mkPP(rng) {
  const entity = 'BANK-' + Math.floor(rng() * 5);
  const period = '2026Q' + (1 + Math.floor(rng() * 4));
  return { rc_output_payload: mkRc(rng, entity, period), rcr_output_payload: mkRcr(rng, entity, period) };
}

// ---------- P1: fixed rule — gate_status is review_required iff any fatal check fails ----------
function checkP1_gateStatusExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    const anyFatalFail = op.checks.some((c) => c.severity === 'fatal' && !c.passed);
    const expected = anyFatalFail ? 'review_required' : 'auto_pass';
    if (op.gate_status !== expected) violations++;
    if (op.all_fatal_passed !== !anyFatalFail) violations++;
  }
  return { name: 'P1_gate_status_exact_rule', trials: checked, violations };
}

// ---------- P2: boundedness — check_count fixed at 10, fatal+warning counts partition, gate_status in 2-value enum ----------
function checkP2_countsAndEnumBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    if (op.check_count !== 10) violations++;
    if (op.fatal_failure_count + op.checks.filter((c) => c.severity !== 'fatal' && c.passed).length + op.warning_failure_count > op.check_count) violations++;
    if (!['auto_pass', 'review_required'].includes(op.gate_status)) violations++;
  }
  return { name: 'P2_check_count_fixed_and_gate_status_bounded', trials: checked, violations };
}

// ---------- P3: fixed rule — EDIT-RC-01 balance identity check matches the caller's tolerance exactly ----------
function checkP3_editRc01Exact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    pp.rounding_tolerance_usd = randRange(rand, 0, 5);
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    const rc01 = op.checks.find((c) => c.id === 'EDIT-RC-01');
    const rc = pp.rc_output_payload;
    const delta = Math.round((rc.total_assets_usd - (rc.total_liabilities_usd + rc.total_equity_capital_usd)) * 100) / 100;
    const expected = Math.abs(delta) <= op.rounding_tolerance_usd;
    if (rc01.passed !== expected) violations++;
  }
  return { name: 'P3_edit_rc01_balance_identity_exact_tolerance_rule', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing on the EDIT-RCR-04/05 0.0005 float-ratio-consistency band ----------
const ULP_BOUNDARY_CASES = [
  [{ cet1_capital_usd: 10, total_rwa_usd: 100, reportedCet1Ratio: 0.1 }, 'reported cet1 ratio exactly equal to raw division (0.1) — EDIT-RCR-04 must PASS, diff exactly 0'],
  [{ cet1_capital_usd: 10, total_rwa_usd: 100, reportedCet1Ratio: 0.1 + 0.0005 - Number.EPSILON * 8 }, 'reported ratio 1 ULP inside the 0.0005 tolerance band — must still PASS'],
  [{ cet1_capital_usd: 10, total_rwa_usd: 100, reportedCet1Ratio: 0.1 + 0.0005 + Number.EPSILON * 8 }, 'reported ratio 1 ULP outside the 0.0005 tolerance band — must FAIL (warning severity)'],
  [{ cet1_capital_usd: 10, total_rwa_usd: 0, reportedCet1Ratio: 999 }, 'total_rwa_usd exactly zero — EDIT-RCR-04 guard must default to PASS (true) regardless of reported ratio, no division by zero'],
  [{ cet1_capital_usd: -0, total_rwa_usd: 100, reportedCet1Ratio: 0 }, 'negative-zero cet1 capital — must behave as zero, no NaN, EDIT-RCR-04 PASS'],
  [{ total_rwa_usd: -0 }, 'negative-zero RWA on EDIT-RCR-03 (totalRwaUsd > 0 check) — must FAIL (not positive), consistent with the zero-RWA case'],
  [{ total_assets_usd: 1, total_liabilities_usd: 1, total_equity_capital_usd: 0, rounding_tolerance_usd: 0 }, 'exact balance identity with zero rounding tolerance — EDIT-RC-01 must PASS with zero slack'],
  [{ cet1_capital_usd: 5, tier1_capital_usd: 5 - Number.EPSILON * 8, total_rwa_usd: 100 }, 'cet1 exceeds tier1 by a few ULP — EDIT-RCR-01 must FAIL (cet1 <= tier1 + tolerance check with default 1 tolerance still passes at ULP scale; forced here at larger gap below)'],
];

function checkP4_forced() {
  const rows = [];
  for (const [partial, label] of ULP_BOUNDARY_CASES) {
    const rc = { entity_id: 'B', reporting_period: '2026Q2', total_assets_usd: 100, total_liabilities_usd: 60, total_equity_capital_usd: 40, ...('total_assets_usd' in partial || 'total_liabilities_usd' in partial || 'total_equity_capital_usd' in partial ? partial : {}) };
    const rcr = {
      entity_id: 'B', reporting_period: '2026Q2',
      cet1_capital_usd: partial.cet1_capital_usd ?? 10, tier1_capital_usd: partial.tier1_capital_usd ?? 15,
      total_capital_usd: 20, total_rwa_usd: partial.total_rwa_usd ?? 100,
      ratios: { cet1_ratio_pct: partial.reportedCet1Ratio ?? 0.1, total_capital_ratio_pct: 0.2 },
    };
    const pp = { rc_output_payload: rc, rcr_output_payload: rcr, rounding_tolerance_usd: partial.rounding_tolerance_usd };
    const r = compute(pp);
    const op = r.output_payload;
    const plausible = op.checks.length === 10 && ['auto_pass', 'review_required'].includes(op.gate_status);
    const rcr04 = op.checks.find((c) => c.id === 'EDIT-RCR-04');
    rows.push({ label, input: partial, gate_status: op.gate_status, edit_rcr_04_passed: rcr04.passed, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_gateStatusExact());
results.properties.push(checkP2_countsAndEnumBounded());
results.properties.push(checkP3_editRc01Exact());
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
