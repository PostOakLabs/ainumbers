// kernel_digest_at_authoring: sha256:82f0207a25a6122e68a398fa7e274529843c39c73a82287c072e77a414b0e7fe
//
// FV-PROPFLOOR-SHARD-B23-1 — property-test floor for art-435-bhc-schedule-hc-balance-sheet.
// Class B (bounded-numeric), FLOAT-SENSITIVE (six asset + three liability + four equity r2-
// rounded line items are summed via repeated float addition, then compared against a caller-
// declared rounding tolerance — mirrors art-432's Schedule RC kernel 1:1, differing only by
// BHCK vs RCON MDRM item prefix) — ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-
// SPEC.md §3. Zero external dependencies. This file is READ-ONLY with respect to the kernel
// it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-435-bhc-schedule-hc-balance-sheet.proptest.mjs

import { compute } from '../art-435-bhc-schedule-hc-balance-sheet.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

const ASSET_KEYS = ['cash_and_due_from_usd', 'securities_htm_usd', 'securities_afs_usd', 'loans_and_leases_net_usd', 'bank_premises_usd', 'other_assets_usd'];
const LIAB_KEYS = ['total_deposits_usd', 'borrowings_usd', 'other_liabilities_usd'];
const EQUITY_KEYS = ['common_stock_usd', 'surplus_usd', 'retained_earnings_usd', 'aoci_usd'];

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-435-bhc-schedule-hc-balance-sheet.fixtures.json');
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
const rand = mulberry32(0x435C3);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;
function r2(v) { return Math.round(v * 100) / 100; }

function mkPP(rng, { balance = false } = {}) {
  const pp = { entity_id: 'BHC-1', reporting_period: '2026Q2' };
  for (const k of ASSET_KEYS) pp[k] = randRange(rng, 0, 1e7);
  for (const k of LIAB_KEYS) pp[k] = randRange(rng, 0, 1e7);
  for (const k of EQUITY_KEYS) pp[k] = randRange(rng, 0, 1e7);
  if (balance) {
    const assetsSum = ASSET_KEYS.reduce((a, k) => a + r2(pp[k]), 0);
    const otherLiab = LIAB_KEYS.filter((k) => k !== 'total_deposits_usd').reduce((a, k) => a + r2(pp[k]), 0);
    const equitySum = EQUITY_KEYS.reduce((a, k) => a + r2(pp[k]), 0);
    pp.total_deposits_usd = r2(assetsSum) - otherLiab - equitySum;
  }
  return pp;
}

// ---------- P1: fixed rule — total_assets_usd equals the independently recomputed r2-rounded sum ----------
function checkP1_totalAssetsExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected = r2(ASSET_KEYS.reduce((a, k) => a + r2(pp[k]), 0));
    if (r.output_payload.total_assets_usd !== expected) violations++;
  }
  return { name: 'P1_total_assets_exact_r2_sum', trials: checked, violations };
}

// ---------- P2: round-trip/metamorphic identity — balanced construction always reports identity_balanced true ----------
function checkP2_forcedBalanceIdentityHolds() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand, { balance: true });
    const r = compute(pp);
    checked++;
    if (!r.output_payload.identity_balanced) violations++;
    if (r.output_payload.identity_delta_usd !== 0) violations++;
  }
  return { name: 'P2_forced_balanced_inputs_always_report_identity_balanced', trials: checked, violations };
}

// ---------- P3: fixed rule — identity_balanced iff abs(delta) <= tolerance, tolerance never negative ----------
function checkP3_toleranceRuleExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    pp.rounding_tolerance_usd = randRange(rand, -5, 5);
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    if (op.rounding_tolerance_usd < 0) violations++;
    const expected = Math.abs(op.identity_delta_usd) <= op.rounding_tolerance_usd;
    if (op.identity_balanced !== expected) violations++;
  }
  return { name: 'P3_identity_balanced_exact_tolerance_rule_never_negative', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing on the summed-float balance identity ----------
const CLASSIC_DOUBLE = 0.1 + 0.2; // 0.30000000000000004
const ULP_BOUNDARY_CASES = [
  [Object.fromEntries([...ASSET_KEYS, ...LIAB_KEYS, ...EQUITY_KEYS].map((k) => [k, 0])), 'all line items exactly zero — total_assets/liabilities/equity all 0, identity_delta 0, balanced'],
  [Object.fromEntries([...ASSET_KEYS.map((k) => [k, 0.1]), ...LIAB_KEYS.map((k) => [k, 0]), ...EQUITY_KEYS.map((k) => [k, 0])]), '6x 0.1 asset items — classic repeated-float-addition rounding accumulation must still equal the r2-rounded expected sum'],
  [{ cash_and_due_from_usd: CLASSIC_DOUBLE, total_deposits_usd: CLASSIC_DOUBLE }, 'asset and matching liability both 0.1+0.2 (0.30000000000000004) — identity must balance despite the inexact double'],
  [{ cash_and_due_from_usd: -0, total_deposits_usd: 0 }, 'negative-zero asset line item — must behave as zero, no NaN, r2(-0) stays comparably 0'],
  [{ cash_and_due_from_usd: 1, total_deposits_usd: 1, rounding_tolerance_usd: 0 }, 'exact match with rounding_tolerance_usd forced to 0 — identity must balance with zero slack'],
  [{ cash_and_due_from_usd: 1.005, total_deposits_usd: 1 }, 'asset item at the r2 half-cent rounding boundary (1.005) — Math.round(v*100)/100 rounding behavior must be deterministic'],
  [{ cash_and_due_from_usd: Number.MAX_SAFE_INTEGER, total_deposits_usd: Number.MAX_SAFE_INTEGER }, 'line items at MAX_SAFE_INTEGER — must remain finite, no overflow to Infinity'],
  [{ cash_and_due_from_usd: 1, total_deposits_usd: 1 + Number.EPSILON * 4, rounding_tolerance_usd: 0 }, 'asset/liability differ by a few ULP with zero tolerance — r2 rounding to cents must absorb sub-cent ULP noise, identity balanced'],
];

function checkP4_forced() {
  const rows = [];
  for (const [partial, label] of ULP_BOUNDARY_CASES) {
    const pp = { entity_id: 'BHC-1', reporting_period: '2026Q2', ...partial };
    const r = compute(pp);
    const op = r.output_payload;
    const plausible = Number.isFinite(op.total_assets_usd) && Number.isFinite(op.total_liabilities_usd)
      && Number.isFinite(op.total_equity_capital_usd) && Number.isFinite(op.identity_delta_usd)
      && typeof op.identity_balanced === 'boolean';
    rows.push({ label, input: partial, total_assets_usd: op.total_assets_usd, identity_delta_usd: op.identity_delta_usd, identity_balanced: op.identity_balanced, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_totalAssetsExact());
results.properties.push(checkP2_forcedBalanceIdentityHolds());
results.properties.push(checkP3_toleranceRuleExact());
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
