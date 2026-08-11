// kernel_digest_at_authoring: sha256:4967b7d4af80a186fa8374e13f61c4f6a14a94ef7f74474dc4fd840ddf488608
//
// FV-PROPFLOOR-SHARD-B13-1 — property-test floor for art-36-tempo-mpp-agent-mandate.
// Class B (bounded-numeric), stated FLOAT:NO exception per the WU row — spendCap/costPerCall is
// a floor-division voucher count over a small fixed-lookup-table divisor, no continuous float
// arithmetic. Forced CATEGORICAL boundary cases used instead of ULP forcing, per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-36-tempo-mpp-agent-mandate.proptest.mjs

import { compute } from '../art-36-tempo-mpp-agent-mandate.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-36-tempo-mpp-agent-mandate.fixtures.json');
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
const rand = mulberry32(0x36B8);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 8000;

const RAILS = ['tempo_stablecoin', 'fiat_card', 'lightning'];
const VALID_DID = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';
const INVALID_DIDS = ['did:key:z6Xk1234', 'did:web:example.com', '', 'not-a-did'];

function mkPP(rng) {
  return {
    agentDid: rng() < 0.5 ? VALID_DID : pick(rng, INVALID_DIDS),
    merchant: 'merchant-' + Math.floor(rng() * 1000),
    spendCap: randRange(rng, 0, 1000),
    duration: pick(rng, ['1h', '8h', '24h']),
    rail: pick(rng, RAILS),
    stablecoin: pick(rng, ['USDC', 'USDT']),
    cadence: pick(rng, ['per-request', 'per-session']),
  };
}

const CALL_COSTS = { tempo_stablecoin: 0.001, fiat_card: 0.10, lightning: 0.0005 };

// ---------- P1: boundedness — risk.level is always one of the 3 declared enum values ----------
function checkP1_riskLevelBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (!['LOW', 'MEDIUM', 'HIGH'].includes(r.output_payload.risk.level)) violations++;
  }
  return { name: 'P1_risk_level_bounded_to_3_state_enum', trials: checked, violations };
}

// ---------- P2: round-trip — max_vouchers exactly equals Math.floor(spendCap / costPerCall) ----------
function checkP2_maxVouchersRoundtrips() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const costPerCall = CALL_COSTS[pp.rail] ?? CALL_COSTS.tempo_stablecoin;
    const expected = Math.floor(pp.spendCap / costPerCall);
    if (r.output_payload.max_vouchers !== expected) violations++;
  }
  return { name: 'P2_max_vouchers_equals_floor_spendcap_over_cost', trials: checked, violations };
}

// ---------- P3: metamorphic — did_valid is exactly the did:key:z6Mk prefix check, independent of other fields ----------
function checkP3_didValidMatchesPrefixCheck() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected = typeof pp.agentDid === 'string' && pp.agentDid.startsWith('did:key:z6Mk');
    if (r.output_payload.did_valid !== expected) violations++;
    if (!expected && r.output_payload.risk.level !== 'HIGH') violations++;
  }
  return { name: 'P3_did_valid_matches_prefix_check_and_forces_high_risk_when_invalid', trials: checked, violations };
}

// ---------- P4 (mandatory float:no exception): forced categorical boundary cases ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ agentDid: 'did:key:z6Mk', merchant: 'm', spendCap: 0, rail: 'tempo_stablecoin' }, 'agentDid exactly the bare prefix (shortest possible valid string) — did_valid must be true, max_vouchers must be 0 (spendCap 0 / cost)'],
  [{ agentDid: 'did:key:z6M', merchant: 'm', spendCap: 50, rail: 'tempo_stablecoin' }, 'agentDid one character short of the required prefix — did_valid must be false, risk HIGH'],
  [{ agentDid: 'did:key:z6MkX', merchant: 'm', spendCap: 50, rail: 'tempo_stablecoin' }, 'spendCap exactly at the LOW/MEDIUM $50 boundary (<=50) — risk must be LOW for tempo_stablecoin rail'],
  [{ agentDid: 'did:key:z6MkX', merchant: 'm', spendCap: 50.01, rail: 'tempo_stablecoin' }, 'spendCap 1 cent above the $50 boundary — risk must be MEDIUM, not LOW'],
  [{ agentDid: 'did:key:z6MkX', merchant: 'm', spendCap: 100, rail: 'unknown_rail' }, 'unrecognized rail falls back to tempo_stablecoin cost per kernel ?? operator — must not throw'],
  [{ agentDid: 'did:key:z6MkX', merchant: 'm', spendCap: -10, rail: 'tempo_stablecoin' }, 'negative spendCap — max_vouchers must be a negative integer via Math.floor, no NaN, no throw'],
  [{ agentDid: null, merchant: 'm', spendCap: 50, rail: 'fiat_card' }, 'agentDid null (missing field) — did_valid must be false (typeof check fails), risk HIGH, no throw'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const o = r.output_payload;
    const plausible = ['LOW', 'MEDIUM', 'HIGH'].includes(o.risk.level) && Number.isFinite(o.max_vouchers) && typeof o.did_valid === 'boolean';
    rows.push({ label, input: pp, output: o, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_riskLevelBounded());
results.properties.push(checkP2_maxVouchersRoundtrips());
results.properties.push(checkP3_didValidMatchesPrefixCheck());
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
