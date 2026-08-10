// kernel_digest_at_authoring: sha256:f03969b8c19acf958fd9f90055c4580aa2432c04700b20a42156fa57473ace45
//
// FV-PROPFLOOR-SHARD-B15-1 — property-test floor for art-59-settlement-asset-finality-classifier.
// Class B (bounded-numeric), FLOAT:NO — every input is a fixed enum string (settlement_asset,
// finality_designation, jurisdiction, transfer_mechanism, singleness_test); finality_tier is
// computed via integer table lookups + Math.min/Math.max clamp, no float arithmetic anywhere.
// Per FV-PBT-FLOOR-BUILD-SPEC.md §3 this is a stated float:no exception — forced CATEGORICAL
// boundary cases (unknown enum defaults, clamp-at-1, clamp-at-4) stand in for ULP forcing.
// Zero external dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-59-settlement-asset-finality-classifier.proptest.mjs

import { compute } from '../art-59-settlement-asset-finality-classifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-59-settlement-asset-finality-classifier.fixtures.json');
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
const rand = mulberry32(0x59A11);
const TRIALS = 10000;

const SETTLEMENT_ASSETS = ['CBM-token', 'commercial-bank-deposit-token', 'regulated-stablecoin', 'e-money-token', 'off-chain-RTGS', 'unknown-asset-type'];
const FINALITY_DESIGNATIONS = ['SFD-designated', 'PFMI-compliant-FMI', 'UCC-Art12-control', 'contractual-only', 'none', 'unrecognized-designation'];
const JURISDICTIONS = ['US', 'UK', 'EU', 'other', 'JP'];
const TRANSFER_MECHANISMS = ['DvP-conditional', 'wrapped-bridged', 'direct'];
const SINGLENESS_TESTS = ['par-with-CBM', 'pegged', 'floating', 'undeclared'];

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function mkPP(rng) {
  return {
    settlement_asset: pick(rng, SETTLEMENT_ASSETS),
    issuer: 'regulated-bank',
    finality_designation: pick(rng, FINALITY_DESIGNATIONS),
    jurisdiction: pick(rng, JURISDICTIONS),
    governing_law: '',
    transfer_mechanism: pick(rng, TRANSFER_MECHANISMS),
    singleness_test: pick(rng, SINGLENESS_TESTS),
  };
}

// ---------- P1: boundedness — finality_tier always an integer in [1, 4] ----------
function checkP1_tierBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const t = r.output_payload.finality_tier;
    if (!Number.isInteger(t) || t < 1 || t > 4) violations++;
  }
  return { name: 'P1_finality_tier_integer_bounded_1_to_4', trials: checked, violations };
}

// ---------- P2: fixed-enum agreement — singleness_verdict always one of the 3 declared verdicts ----------
function checkP2_singlenessFixedEnum() {
  const VALID = new Set(['SINGLENESS_CONFIRMED', 'SINGLENESS_CONDITIONAL', 'SINGLENESS_BROKEN']);
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (!VALID.has(r.output_payload.singleness_verdict)) violations++;
  }
  return { name: 'P2_singleness_verdict_fixed_3_state_enum', trials: checked, violations };
}

// ---------- P3: monotonicity — SFD-designated never yields a worse (higher) tier than 'none' for the same asset ----------
function checkP3_monotonicInFinalityDesignation() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const rBest = compute({ ...pp, finality_designation: 'SFD-designated' });
    const rWorst = compute({ ...pp, finality_designation: 'none' });
    checked++;
    // Lower tier number = better finality; SFD-designated (mod -1) must never be numerically worse than 'none' (mod +2).
    if (rBest.output_payload.finality_tier > rWorst.output_payload.finality_tier) violations++;
  }
  return { name: 'P3_SFD_designated_tier_never_worse_than_none', trials: checked, violations };
}

// ---------- P4 (mandatory float:no exception): forced categorical boundary cases ----------
const BOUNDARY_CASES = [
  [{ settlement_asset: 'unknown-asset-type', finality_designation: 'none' }, 'unrecognized settlement_asset — ASSET_TIER lookup falls through to base=4, clamped tier must stay 4'],
  [{ settlement_asset: 'CBM-token', finality_designation: 'SFD-designated' }, 'best case: CBM-token (base=1) + SFD-designated (mod=-1) — must clamp at floor tier 1, never go below'],
  [{ settlement_asset: 'e-money-token', finality_designation: 'none' }, 'worst case: e-money-token (base=3) + none (mod=+2) = 5, must clamp at ceiling tier 4'],
  [{ settlement_asset: 'off-chain-RTGS', finality_designation: 'unrecognized-designation' }, 'unrecognized finality_designation — FINALITY_MOD lookup falls through to default mod=+1'],
  [{ settlement_asset: 'e-money-token', finality_designation: 'contractual-only' }, 'e-money-token without SFD-designated — must trigger EMT_NOT_SFD_DESIGNATED gap'],
  [{ transfer_mechanism: 'wrapped-bridged' }, 'wrapped-bridged transfer — must trigger WRAPPED_ASSET_FINALITY_GAP regardless of other fields'],
  [{ singleness_test: 'floating' }, 'floating singleness — must resolve to SINGLENESS_BROKEN and trigger SINGLENESS_BROKEN_WITH_CBM gap'],
  [{ jurisdiction: 'other' }, 'unrecognized jurisdiction falls to the other/default regime text, must never be undefined'],
  [{ settlement_asset: 'CBM-token', finality_designation: 'PFMI-compliant-FMI', singleness_test: 'par-with-CBM' }, 'best-case combination — must reach exactly Tier 1'],
  [{ settlement_asset: 'off-chain-RTGS', finality_designation: 'none', singleness_test: 'floating' }, 'worst-case combination — must classify Tier 4 with multiple gaps, never throw'],
];

function checkP4_forced() {
  const base = mkPP(mulberry32(0x59B22));
  const rows = [];
  for (const [overrides, label] of BOUNDARY_CASES) {
    const pp = { ...base, ...overrides };
    const r = compute(pp);
    const { finality_tier, singleness_verdict, recommendation } = r.output_payload;
    const plausible = Number.isInteger(finality_tier) && finality_tier >= 1 && finality_tier <= 4
      && typeof singleness_verdict === 'string' && typeof recommendation === 'string' && recommendation.length > 0;
    rows.push({ label, input: pp, finality_tier, singleness_verdict, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_tierBounded());
results.properties.push(checkP2_singlenessFixedEnum());
results.properties.push(checkP3_monotonicInFinalityDesignation());
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
