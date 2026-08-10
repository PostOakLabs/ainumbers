// kernel_digest_at_authoring: sha256:fa0c0c6dff1a33577f8de9a44bbd6c3d35d4a2d544a0d9f83ed9c1635870b792
//
// FV-PROPFLOOR-SHARD-B10-1 — property-test floor for art-272-restaking-risk.
// Class B (bounded-numeric), FLOAT-SENSITIVE (reward/slash waterfall passes raw doubles
// through multiple chained percentage divisions and a risk/reward ratio division) —
// ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external
// dependencies (mulberry32 PRNG + explicit boundary arrays). READ-ONLY with respect to
// the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-272-restaking-risk.proptest.mjs

import { compute } from '../art-272-restaking-risk.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-272-restaking-risk.fixtures.json');
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
const rand = mulberry32(0x272B10);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;
const PROTOCOLS = ['eigenlayer', 'symbiotic'];

function mkPP(rng) {
  return {
    protocol: PROTOCOLS[Math.floor(rng() * PROTOCOLS.length)],
    staked_eth: randRange(rng, 0.1, 1000),
    eth_price_usd: randRange(rng, 100, 10000),
    slash_magnitude_pct: randRange(rng, 0, 100),
    first_loss_tranche_pct: randRange(rng, 0, 100),
    slashing_risk_pct: randRange(rng, 0, 100),
  };
}

// ---------- P1: monotonicity — delegator_net_slash_usd is nonincreasing as first_loss_tranche_pct grows ----------
function checkP1_bufferMonotone() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r1 = compute({ ...pp, first_loss_tranche_pct: Math.min(90, pp.first_loss_tranche_pct) });
    const r2 = compute({ ...pp, first_loss_tranche_pct: Math.min(90, pp.first_loss_tranche_pct) + 10 });
    checked++;
    if (!(r2.output_payload.delegator_net_slash_usd <= r1.output_payload.delegator_net_slash_usd)) violations++;
  }
  return { name: 'P1_delegator_net_slash_nonincreasing_as_buffer_grows', trials: checked, violations };
}

// ---------- P2: boundedness — slash waterfall never exceeds max_slash, all money fields finite and nonnegative ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    if (!Number.isFinite(op.max_slash_usd) || op.max_slash_usd < 0) violations++;
    if (!Number.isFinite(op.buffer_absorbs_usd) || op.buffer_absorbs_usd < 0) violations++;
    if (!Number.isFinite(op.delegator_net_slash_usd) || op.delegator_net_slash_usd < 0) violations++;
    if (op.buffer_absorbs_usd > op.max_slash_usd + 1e-6) violations++;
    if (op.delegator_net_slash_usd > op.max_slash_usd + 1e-6) violations++;
  }
  return { name: 'P2_slash_waterfall_bounded_by_max_slash_all_fields_finite_nonneg', trials: checked, violations };
}

// ---------- P3: round-trip identity — net_apy_pct = gross_apy_pct - operator_cut_pct exactly (to rounding) ----------
function checkP3_apyIdentity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    const expected = Math.round((op.gross_apy_pct - op.operator_cut_pct) * 1e4) / 1e4;
    if (Math.abs(op.net_apy_pct - expected) > 1e-6) violations++;
  }
  return { name: 'P3_net_apy_equals_gross_minus_operator_cut_identity', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ slash_magnitude_pct: 0 }, 'slash_magnitude exactly zero — max_slash_usd must be exactly 0'],
  [{ first_loss_tranche_pct: 100 }, 'first_loss_tranche exactly 100% — buffer_absorbs must equal max_slash exactly, delegator_net_slash exactly 0'],
  [{ first_loss_tranche_pct: -0 }, 'first_loss_tranche negative zero — Math.max(0,-0) clamp must normalize to 0'],
  [{ insurance_premium_pct_of_rewards: 0 }, 'insurance premium exactly zero — risk_reward_ratio must be null (division-by-zero guard), not Infinity'],
  [{ slashing_risk_pct: 0.1 * 3 }, 'slashing_risk = 0.1*3 (classic non-exact double 0.30000000000000004) — expected_annual_slash_usd must reflect the EXACT double'],
  [{ operator_fee_pct: 100 }, 'operator_fee exactly 100% — operator_cut_pct must equal gross_apy_pct exactly, net_apy_pct exactly 0'],
  [{ staked_eth: Number.MIN_VALUE }, 'staked_eth at smallest positive double — staked_usd computation must not throw or NaN'],
  [{ slash_magnitude_pct: (1 / 3) * 3 * 10 }, 'slash_magnitude = (1/3)*3*10 (x/y*y!==x rounding artifact) — max_slash_usd round2 must not misround'],
  [{ first_loss_tranche_pct: 100, slash_magnitude_pct: 100 }, 'both tranche and magnitude at 100% ceiling — delegator_net_slash_usd must be exactly 0, no residual epsilon'],
  [{ eth_price_usd: Number.MAX_SAFE_INTEGER, staked_eth: 1000 }, 'eth_price at MAX_SAFE_INTEGER with large stake — staked_usd must not overflow or lose precision'],
];

function checkP4_forced() {
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = { protocol: 'eigenlayer', staked_eth: 32, eth_price_usd: 3500, slash_magnitude_pct: 1, first_loss_tranche_pct: 0, slashing_risk_pct: 0.5, ...overrides };
    const r = compute(pp);
    const op = r.output_payload;
    const finite = Number.isFinite(op.max_slash_usd) && Number.isFinite(op.delegator_net_slash_usd) && Number.isFinite(op.net_apy_pct);
    rows.push({ label, overrides, max_slash_usd: op.max_slash_usd, delegator_net_slash_usd: op.delegator_net_slash_usd, risk_reward_ratio: op.risk_reward_ratio, net_apy_pct: op.net_apy_pct, finite, plausible: finite });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_bufferMonotone());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_apyIdentity());
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
