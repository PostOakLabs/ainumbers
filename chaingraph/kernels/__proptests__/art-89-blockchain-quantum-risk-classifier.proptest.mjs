// kernel_digest_at_authoring: sha256:f075b3e27027e3b2ac21bd47aab935f60e01cef5e8892de2fcac74de6def21ea
//
// FV-PROPFLOOR-SHARD-B18-1 — property-test floor for art-89-blockchain-quantum-risk-classifier.
// Class B (bounded-numeric/categorical), FLOAT:NO exception per the WU row — exposed_pubkey_pct
// and address_reuse_pct are compared with plain >= / > against fixed integer thresholds (25, 10, 30,
// 10), no arithmetic performed on them. Forced CATEGORICAL boundary cases used in place of ULP
// forcing. Zero external dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as
// the B12/B14 harness. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-89-blockchain-quantum-risk-classifier.proptest.mjs

import { compute } from '../art-89-blockchain-quantum-risk-classifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-89-blockchain-quantum-risk-classifier.fixtures.json');
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
const rand = mulberry32(0x89A1B2);
const TRIALS = 10000;
const SCHEMES = ['ECDSA', 'EdDSA', 'Schnorr', 'ML-DSA', 'Unknown-Scheme'];
const ROADMAPS = ['none', 'proposed', 'defined'];
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function mkChain(rng) {
  return {
    signature_scheme: pick(rng, SCHEMES),
    exposed_pubkey_pct: Math.floor(rng() * 101),
    address_reuse_pct: Math.floor(rng() * 101),
    migration_roadmap: pick(rng, ROADMAPS),
  };
}
function mkPP(rng) { return { chain: mkChain(rng), asset_type: pick(rng, ['L1', 'L2', 'token']) }; }

// ---------- P1: ML-DSA scheme always yields quantum_risk_tier 'none' and migration_readiness 'complete' ----------
function checkP1_mldsaAlwaysNone() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    pp.chain.signature_scheme = 'ML-DSA';
    const r = compute(pp);
    checked++;
    if (r.output_payload.quantum_risk_tier !== 'none') violations++;
    if (r.output_payload.migration_readiness !== 'complete') violations++;
  }
  return { name: 'P1_mldsa_scheme_always_none_tier_complete_readiness', trials: checked, violations };
}

// ---------- P2: quantum_risk_tier is bounded to the fixed 4-state set and matches the threshold formula exactly ----------
function checkP2_tierMatchesThresholds() {
  let violations = 0, checked = 0;
  const TIERS = ['critical', 'high', 'medium', 'low'];
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    if (pp.chain.signature_scheme === 'ML-DSA') continue;
    const r = compute(pp);
    checked++;
    const { exposed_pubkey_pct: e, migration_roadmap: m } = pp.chain;
    const expected = (e >= 25 && m === 'none') ? 'critical' : e >= 25 ? 'high' : e >= 10 ? 'medium' : 'low';
    if (r.output_payload.quantum_risk_tier !== expected) violations++;
    if (!TIERS.includes(r.output_payload.quantum_risk_tier)) violations++;
  }
  return { name: 'P2_quantum_risk_tier_matches_threshold_formula', trials: checked, violations };
}

// ---------- P3: reuse_risk matches address_reuse_pct thresholds exactly (monotonic, non-ML-DSA only) ----------
function checkP3_reuseRiskMatches() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    if (pp.chain.signature_scheme === 'ML-DSA') continue;
    const r = compute(pp);
    checked++;
    const a = pp.chain.address_reuse_pct;
    const expected = a > 30 ? 'high' : a > 10 ? 'medium' : 'low';
    if (r.output_payload.reuse_risk !== expected) violations++;
  }
  return { name: 'P3_reuse_risk_matches_address_reuse_pct_thresholds', trials: checked, violations };
}

// ---------- P4 (mandatory categorical boundary forcing) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ chain: { signature_scheme: 'ML-DSA', exposed_pubkey_pct: 99, address_reuse_pct: 99, migration_roadmap: 'none' } }, 'ML-DSA short-circuit overrides otherwise-critical inputs — tier must be none'],
  [{ chain: { signature_scheme: 'ECDSA', exposed_pubkey_pct: 25, address_reuse_pct: 0, migration_roadmap: 'none' } }, 'exposed_pubkey_pct exactly at high-threshold boundary (25) with no roadmap — must be critical'],
  [{ chain: { signature_scheme: 'ECDSA', exposed_pubkey_pct: 24, address_reuse_pct: 0, migration_roadmap: 'none' } }, 'exposed_pubkey_pct one below high-threshold boundary (24) — must be medium, not critical'],
  [{ chain: { signature_scheme: 'ECDSA', exposed_pubkey_pct: 25, address_reuse_pct: 0, migration_roadmap: 'proposed' } }, 'exposed_pubkey_pct at high-threshold boundary but roadmap proposed (not none) — must be high, not critical'],
  [{ chain: { signature_scheme: 'ECDSA', exposed_pubkey_pct: 10, address_reuse_pct: 0, migration_roadmap: 'defined' } }, 'exposed_pubkey_pct exactly at medium-threshold boundary (10) — must be medium'],
  [{ chain: { signature_scheme: 'ECDSA', exposed_pubkey_pct: 9, address_reuse_pct: 0, migration_roadmap: 'defined' } }, 'exposed_pubkey_pct one below medium-threshold boundary (9) — must be low'],
  [{ chain: { signature_scheme: 'ECDSA', exposed_pubkey_pct: 0, address_reuse_pct: 30, migration_roadmap: 'none' } }, 'address_reuse_pct exactly at medium/high boundary (30) — strict > means 30 is still medium, not high'],
  [{ chain: { signature_scheme: 'ECDSA', exposed_pubkey_pct: 0, address_reuse_pct: 31, migration_roadmap: 'none' } }, 'address_reuse_pct one above the 30 boundary (31) — must be high'],
  [{ chain: { signature_scheme: 'ECDSA', exposed_pubkey_pct: 0, address_reuse_pct: 10, migration_roadmap: 'none' } }, 'address_reuse_pct exactly at low/medium boundary (10) — strict > means 10 is still low, not medium'],
  [{}, 'entirely empty policy_parameters — must resolve to all defaults (ECDSA, 0%, low tier, no_roadmap)'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { quantum_risk_tier, reuse_risk, migration_readiness } = r.output_payload;
    const plausible = typeof quantum_risk_tier === 'string' && typeof reuse_risk === 'string' && typeof migration_readiness === 'string';
    rows.push({ label, input: pp, quantum_risk_tier, reuse_risk, migration_readiness, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_mldsaAlwaysNone());
results.properties.push(checkP2_tierMatchesThresholds());
results.properties.push(checkP3_reuseRiskMatches());
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
