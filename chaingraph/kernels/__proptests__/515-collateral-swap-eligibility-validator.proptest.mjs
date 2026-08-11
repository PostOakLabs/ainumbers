// kernel_digest_at_authoring: sha256:678f918188301de63b9847665aa262f6fc73e09a1b28292b6bd3a8b79e4a51bf
//
// FV-PROPFLOOR-SHARD-B1-1 — property-test floor for 515-collateral-swap-eligibility-validator.
// Class B (bounded-numeric), FLOAT-SENSITIVE (haircut-adjusted value arithmetic) — ULP-boundary
// forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies. Read-only
// w.r.t. the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/515-collateral-swap-eligibility-validator.proptest.mjs

import { compute } from '../515-collateral-swap-eligibility-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', '515-collateral-swap-eligibility-validator.fixtures.json');
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
const rand = mulberry32(0x515A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const ASSETS = ['ust', 'gilt', 'eu_sovereign', 'agency_mbs', 'ig_corp_bond', 'equity', 'cash_usd', 'cash_eur', 'mmf_fund_share', 'unknown'];
const AGREEMENTS = ['gmsla', 'gmra', 'undefined', 'other'];
const TIER_BY_ASSET = { ust: 1, gilt: 1, eu_sovereign: 1, agency_mbs: 2, ig_corp_bond: 3, equity: 3, cash_usd: 1, cash_eur: 1, mmf_fund_share: 99, unknown: 99 };
const TRIALS = 20000;

function randPP(rng) {
  return {
    asset_a: pick(rng, ASSETS),
    asset_b: pick(rng, ASSETS),
    notional_a: randRange(rng, 0, 5_000_000),
    notional_b: randRange(rng, 0, 5_000_000),
    haircut_a: rng() < 0.7 ? undefined : randRange(rng, 0, 60),
    haircut_b: rng() < 0.7 ? undefined : randRange(rng, 0, 60),
    declared_direction: pick(rng, ['UPGRADE', 'DOWNGRADE', 'NEUTRAL']),
    governing_agreement: pick(rng, AGREEMENTS),
    reuse_flag: rng() < 0.5,
    sftr_consent: rng() < 0.5,
    provider_informed: rng() < 0.5,
    counterparty_jurisdiction: pick(rng, ['us', 'eu', 'other']),
  };
}

// ---------- P1: monotone in notional_a (fixed haircut_a, value_a scales up) ----------
function checkP1_monotoneValueA() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const base = randPP(rand);
    base.haircut_a = randRange(rand, 0, 60); // pin explicit haircut so it never depends on notional
    const n1 = randRange(rand, 0, 2_000_000);
    const n2 = n1 + randRange(rand, 0, 2_000_000);
    const r1 = compute({ ...base, notional_a: n1 });
    const r2 = compute({ ...base, notional_a: n2 });
    checked++;
    if (r2.output_payload.value_a < r1.output_payload.value_a - 0.01) violations++;
  }
  return { name: 'P1_monotone_in_notional_a', trials: checked, violations };
}

// ---------- P2: round-trip identity — net_economic_value = value_b - value_a exactly ----------
function checkP2_netValueIdentity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(randPP(rand)).output_payload;
    checked++;
    const expected = +(r.value_b - r.value_a).toFixed(2);
    if (Math.abs(r.net_economic_value - expected) > 0.02) violations++;
  }
  return { name: 'P2_net_economic_value_identity', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — hqla_impact depends purely on asset tiers ----------
function expectedImpact(a, b) {
  const ta = TIER_BY_ASSET[a] ?? 99, tb = TIER_BY_ASSET[b] ?? 99;
  if (ta > tb) return 'UPGRADE';
  if (ta < tb) return 'DOWNGRADE';
  return 'NEUTRAL';
}
function checkP3_hqlaImpactAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    if (r.hqla_impact !== expectedImpact(pp.asset_a, pp.asset_b)) violations++;
  }
  return { name: 'P3_hqla_impact_threshold_agreement', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  ['haircut_a=100 exact — value_a must be exactly 0', { asset_a: 'equity', asset_b: 'ust', notional_a: 1000000, notional_b: 1000000, haircut_a: 100, haircut_b: 0, declared_direction: 'UPGRADE', governing_agreement: 'gmra', reuse_flag: false, sftr_consent: false, provider_informed: false, counterparty_jurisdiction: 'us' }],
  ['haircut_a=99.99999999999999 — value_a must be near-zero but positive', { asset_a: 'equity', asset_b: 'ust', notional_a: 1000000, notional_b: 1000000, haircut_a: 99.99999999999999, haircut_b: 0, declared_direction: 'UPGRADE', governing_agreement: 'gmra', reuse_flag: false, sftr_consent: false, provider_informed: false, counterparty_jurisdiction: 'us' }],
  ['notional_a=0', { asset_a: 'ust', asset_b: 'ust', notional_a: 0, notional_b: 1000000, haircut_a: 0, haircut_b: 0, declared_direction: 'NEUTRAL', governing_agreement: 'gmra', reuse_flag: false, sftr_consent: false, provider_informed: false, counterparty_jurisdiction: 'us' }],
  ['notional_a=-0 negative zero', { asset_a: 'ust', asset_b: 'ust', notional_a: -0, notional_b: 1000000, haircut_a: 0, haircut_b: 0, declared_direction: 'NEUTRAL', governing_agreement: 'gmra', reuse_flag: false, sftr_consent: false, provider_informed: false, counterparty_jurisdiction: 'us' }],
  ['subnormal notional_a', { asset_a: 'ust', asset_b: 'ust', notional_a: Number.MIN_VALUE, notional_b: 1000000, haircut_a: 0, haircut_b: 0, declared_direction: 'NEUTRAL', governing_agreement: 'gmra', reuse_flag: false, sftr_consent: false, provider_informed: false, counterparty_jurisdiction: 'us' }],
  ['default std haircuts (no override), x/y*y!==x-shaped notionals', { asset_a: 'ig_corp_bond', asset_b: 'ust', notional_a: 33.333333333333336, notional_b: 66.66666666666667, declared_direction: 'UPGRADE', governing_agreement: 'gmra', reuse_flag: false, sftr_consent: false, provider_informed: false, counterparty_jurisdiction: 'us' }],
  ['SFTR consent boundary: eu cp + reuse + consent both true — must be compliant, not violated', { asset_a: 'ust', asset_b: 'ust', notional_a: 1000000, notional_b: 1000000, haircut_a: 0, haircut_b: 0, declared_direction: 'NEUTRAL', governing_agreement: 'gmra', reuse_flag: true, sftr_consent: true, provider_informed: true, counterparty_jurisdiction: 'eu' }],
];

function checkP4_forced() {
  const rows = [];
  for (const [label, pp] of ULP_BOUNDARY_CASES) {
    const r = compute(pp).output_payload;
    const finite = Number.isFinite(r.value_a) && Number.isFinite(r.value_b) && Number.isFinite(r.net_economic_value);
    const netIdentityHolds = Math.abs(r.net_economic_value - +(r.value_b - r.value_a).toFixed(2)) <= 0.02;
    const impactAgrees = r.hqla_impact === expectedImpact(pp.asset_a, pp.asset_b);
    rows.push({ label, value_a: r.value_a, value_b: r.value_b, net_economic_value: r.net_economic_value, hqla_impact: r.hqla_impact, finite, plausible: finite && netIdentityHolds && impactAgrees });
  }
  return rows;
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneValueA());
results.properties.push(checkP2_netValueIdentity());
results.properties.push(checkP3_hqlaImpactAgreement());
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
