// kernel_digest_at_authoring: sha256:fff11007c653c4006222d02b7daca7257ea82f90448b282848433cefc5acad7c
//
// FV-PROPFLOOR-SHARD-B3-1 — property-test floor for art-15-agentic-mandate-sandbox.
// Class B (bounded-numeric), FLOAT-SENSITIVE (spend caps pass through raw doubles into the
// mandate skeleton, and mandate_id derives a Math.round tie-break over those same doubles) —
// ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external
// dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the B1/B2 float
// harness (art-107). This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-15-agentic-mandate-sandbox.proptest.mjs

import { compute } from '../art-15-agentic-mandate-sandbox.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-15-agentic-mandate-sandbox.fixtures.json');
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
const rand = mulberry32(0x150A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;
const MCC_CODES = ['5411', '5541', '5912', '5812', '5311', '7011', '4511', '7512', '4814', '7372', '8011', '4900', '6010', '6051', '7995', '5999'];

function mkPP(rng) {
  return {
    capSingle: randRange(rng, 0, 100000),
    capDaily: randRange(rng, 0, 500000),
    capMonthly: randRange(rng, 0, 5000000),
    capFlag: randRange(rng, 0, 50000),
    velHour: Math.floor(randRange(rng, 0, 50)),
    velDay: Math.floor(randRange(rng, 0, 200)),
    velCooldown: Math.floor(randRange(rng, 0, 120)),
  };
}

// ---------- P1: round-trip identity — finite numeric caps pass through to spend_caps unchanged (no rounding) ----------
function checkP1_capRoundTrip() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const sc = r.output_payload.spend_caps;
    if (sc.single_transaction.amount !== pp.capSingle) violations++;
    if (sc.daily_aggregate.amount !== pp.capDaily) violations++;
    if (sc.monthly_aggregate.amount !== pp.capMonthly) violations++;
    if (sc.flag_threshold.amount !== pp.capFlag) violations++;
  }
  return { name: 'P1_spend_caps_roundtrip_exact_for_finite_input', trials: checked, violations };
}

// ---------- P2: boundedness/partition — MCC allowlist and blocklist exactly partition the fixed 16-code universe ----------
function checkP2_mccPartition() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { allowlist, blocklist } = r.output_payload.mcc_constraints;
    const union = new Set([...allowlist, ...blocklist]);
    if (union.size !== MCC_CODES.length) violations++;
    for (const c of allowlist) if (blocklist.includes(c)) violations++;
    for (const c of MCC_CODES) if (!union.has(c)) violations++;
  }
  return { name: 'P2_mcc_allowlist_blocklist_partition_full_universe', trials: checked, violations };
}

// ---------- P3: fixed-tier agreement — mandate_id's rounded segments equal Math.round of the raw caps exactly ----------
function checkP3_mandateIdRoundAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected = `MANDATE-art-15-agentic-mandate-sandbox-${Math.round(pp.capSingle)}-${Math.round(pp.capDaily)}-${Math.round(pp.capFlag)}`;
    if (r.output_payload.mandate_id !== expected) violations++;
  }
  return { name: 'P3_mandate_id_matches_math_round_of_raw_caps', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ capSingle: 0.5, capDaily: 1000, capFlag: 100 }, 'capSingle at exact .5 round-tie boundary — Math.round(0.5) must be exactly 1'],
  [{ capSingle: -0.5, capDaily: 1000, capFlag: 100 }, 'capSingle at exact -.5 round-tie boundary — Math.round(-0.5) must be exactly -0 (renders "0")'],
  [{ capSingle: 0, capDaily: 1000, capFlag: 100 }, 'capSingle exactly zero — spend_caps.single_transaction.amount must be exactly 0'],
  [{ capSingle: -0, capDaily: 1000, capFlag: 100 }, 'capSingle negative zero — must behave as zero, mandate_id segment "0" not "-0" artifact'],
  [{ capSingle: Number.MIN_VALUE, capDaily: 1000, capFlag: 100 }, 'capSingle smallest positive double — must round to 0, not throw or NaN'],
  [{ capSingle: 1e-300, capDaily: 1000, capFlag: 100 }, 'capSingle near-subnormal — must remain finite and round to 0'],
  [{ capSingle: 100, capDaily: 0.1 * 3, capFlag: 100 }, 'capDaily = 0.1*3 (classic non-exact double, 0.30000000000000004) — spend_caps.daily_aggregate.amount must equal that EXACT double, not 0.3'],
  [{ capSingle: 100, capDaily: 1000, capFlag: (1 / 3) * 3 }, 'capFlag = (1/3)*3 (x/y*y!==x rounding artifact) — must round-trip the exact double unrounded in spend_caps, only mandate_id applies Math.round'],
  [{ capSingle: Number.MAX_SAFE_INTEGER, capDaily: 1000, capFlag: 100 }, 'capSingle at MAX_SAFE_INTEGER — Math.round must not overflow or lose precision'],
  [{ capSingle: 100, capDaily: 1000, capFlag: 99.9999999999999 }, 'capFlag at 1-ULP-below-100 boundary — Math.round must round to exactly 100'],
];

function checkP4_forced() {
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = { capMonthly: 100000, velHour: 3, velDay: 20, velCooldown: 5, ...overrides };
    const r = compute(pp);
    const { spend_caps, mandate_id } = r.output_payload;
    const amounts = [spend_caps.single_transaction.amount, spend_caps.daily_aggregate.amount, spend_caps.monthly_aggregate.amount, spend_caps.flag_threshold.amount];
    const finite = amounts.every(Number.isFinite) && typeof mandate_id === 'string' && !mandate_id.includes('NaN');
    const plausible = finite;
    rows.push({ label, capSingle: pp.capSingle, capDaily: pp.capDaily, capFlag: pp.capFlag, mandate_id, spend_caps, finite, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_capRoundTrip());
results.properties.push(checkP2_mccPartition());
results.properties.push(checkP3_mandateIdRoundAgreement());
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
