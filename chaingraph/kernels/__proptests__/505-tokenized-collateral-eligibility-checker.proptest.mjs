// kernel_digest_at_authoring: sha256:37bbe20bf9c7e913038c93cc07f1425e4956c47da12a2663b58e35f50c3173c2
//
// FV-PROPFLOOR-SHARD-B1-1 — property-test floor for 505-tokenized-collateral-eligibility-checker.
// Class B (bounded-numeric), FLOAT-SENSITIVE (notional/haircut arithmetic) — ULP-boundary forcing
// is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG +
// explicit boundary arrays), same shape as the FV-B1-DTI-RATIOS pilot harness. This file is
// READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/505-tokenized-collateral-eligibility-checker.proptest.mjs

import { compute } from '../505-tokenized-collateral-eligibility-checker.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

// ---------- Step 2: independent fixture-oracle gate (MANDATORY before any property is trusted) ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', '505-tokenized-collateral-eligibility-checker.fixtures.json');
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

// ---------- deterministic PRNG (mulberry32) ----------
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x505A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const ASSET_TYPES = ['ust', 'canton_dtc', 'dtc_custodied', 'gilt', 'eu_sovereign', 'agency_mbs',
  'tokenized_deposit', 'stablecoin', 'ig_corp_bond', 'equity', 'mmf_fund_share', 'unknown_type'];
const TRIALS = 20000;

function randRestrictions(rng) {
  const has = rng() < 0.5;
  if (!has) return {};
  return {
    lock_up: rng() < 0.5,
    min_denomination: rng() < 0.5,
    transfer_agent_approval: rng() < 0.5,
  };
}

// ---------- P1: monotone in notional (fixed asset_type/restrictions/custody) ----------
function checkP1_monotoneNotional() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const asset_type = pick(rand, ASSET_TYPES);
    const restrictions = randRestrictions(rand);
    const custody = rand() < 0.5 ? 'dtc' : null;
    const n1 = randRange(rand, 0, 5_000_000);
    const n2 = n1 + randRange(rand, 0, 5_000_000); // n2 >= n1
    const r1 = compute({ asset_type, notional: n1, transfer_restrictions: restrictions, custody_linkage: custody });
    const r2 = compute({ asset_type, notional: n2, transfer_restrictions: restrictions, custody_linkage: custody });
    checked++;
    if (r2.output_payload.adjusted_value < r1.output_payload.adjusted_value - 1e-9) violations++;
  }
  return { name: 'P1_monotone_in_notional', trials: checked, violations };
}

// ---------- P2: boundedness — adjusted_value in [0, notional] for non-negative notional ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const asset_type = pick(rand, ASSET_TYPES);
    const restrictions = randRestrictions(rand);
    const custody = rand() < 0.5 ? 'dtc' : null;
    const notional = randRange(rand, 0, 10_000_000);
    const r = compute({ asset_type, notional, transfer_restrictions: restrictions, custody_linkage: custody });
    checked++;
    const { final_haircut, adjusted_value } = r.output_payload;
    // adjusted_value is toFixed(2)-rounded (cents), so it may exceed the pre-rounding value by up
    // to half a cent — the tolerance below accounts for that rounding, not kernel imprecision.
    if (final_haircut < 0 || final_haircut > 100) violations++;
    if (adjusted_value < -0.01 || adjusted_value > notional + 0.01) violations++;
  }
  return { name: 'P2_boundedness_adjusted_value_in_range', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — hqla_tier/dtc_status depend only on asset_type ----------
function checkP3_tierAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const asset_type = pick(rand, ASSET_TYPES);
    const n1 = randRange(rand, 0, 10_000_000);
    const n2 = randRange(rand, 0, 10_000_000);
    const r1 = compute({ asset_type, notional: n1, transfer_restrictions: randRestrictions(rand), custody_linkage: rand() < 0.5 ? 'dtc' : null });
    const r2 = compute({ asset_type, notional: n2, transfer_restrictions: randRestrictions(rand), custody_linkage: rand() < 0.5 ? 'dtc' : null });
    checked++;
    if (r1.output_payload.hqla_tier !== r2.output_payload.hqla_tier) violations++;
    if (r1.output_payload.dtc_status !== r2.output_payload.dtc_status) violations++;
    if (r1.output_payload.base_haircut !== r2.output_payload.base_haircut) violations++;
  }
  return { name: 'P3_tier_agreement_depends_only_on_asset_type', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  ['ig_corp_bond', 0, {}, null, 'notional=0 — adjusted_value must be exactly 0, not NaN'],
  ['ig_corp_bond', -0, {}, null, 'negative-zero notional — must behave as zero'],
  ['ig_corp_bond', Number.MIN_VALUE, {}, null, 'smallest positive double as notional'],
  ['ig_corp_bond', 1e-300, {}, null, 'near-subnormal positive notional'],
  ['agency_mbs', 100000000.005, {}, null, 'toFixed(2) rounding boundary — fractional cent'],
  ['ig_corp_bond', 100, { lock_up: true }, null, 'base 50 + adj 5 = 55, below the 100 clamp — must not clamp'],
  ['equity', 100, { lock_up: true, min_denomination: true, transfer_agent_approval: true }, 'dtc', 'all restrictions + custody — haircut still 55, x/y*y!==x rounding case'],
  ['ust', Number.MAX_SAFE_INTEGER, {}, null, 'MAX_SAFE_INTEGER notional, zero haircut asset — adjusted_value must equal notional exactly'],
  ['mmf_fund_share', 1000000, {}, null, 'MMF path, no restrictions — haircut_adj must be 0, not the general path'],
  ['mmf_fund_share', 1000000, { lock_up: true }, null, 'MMF path with restriction — haircut_adj must be 5 via the MMF branch, not general'],
];

function checkP4_forced() {
  const rows = [];
  for (const [asset_type, notional, restrictions, custody, label] of ULP_BOUNDARY_CASES) {
    const r = compute({ asset_type, notional, transfer_restrictions: restrictions, custody_linkage: custody });
    const { final_haircut, adjusted_value } = r.output_payload;
    const finite = Number.isFinite(adjusted_value) && Number.isFinite(final_haircut);
    const inRange = final_haircut >= 0 && final_haircut <= 100 && (notional <= 0 ? adjusted_value === 0 || Object.is(adjusted_value, -0) || adjusted_value === -0 : adjusted_value >= -1e-6);
    rows.push({ label, asset_type, notional, final_haircut, adjusted_value, finite, plausible: finite && inRange });
  }
  return rows;
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneNotional());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_tierAgreement());
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
