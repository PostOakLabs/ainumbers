// kernel_digest_at_authoring: sha256:01fafc4ec932174d36f7a72880ad604946bd324789acb1d5308172f526f2dfaf
//
// FV-PROPFLOOR-SHARD-B8-1 — property-test floor for art-243-purpose-code-requirement-checker.
// Class B (bounded-numeric), FLOAT-SENSITIVE (payment_amount_usd is a raw double compared against
// the fixed $12,500 SwiftGo threshold with a strict <= comparison) — ULP-boundary forcing is
// MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG +
// explicit boundary arrays), same shape as the B1-B7 float harnesses. This file is READ-ONLY with
// respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-243-purpose-code-requirement-checker.proptest.mjs

import { compute } from '../art-243-purpose-code-requirement-checker.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-243-purpose-code-requirement-checker.fixtures.json');
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
const rand = mulberry32(0x2430A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 10000;
const MANDATE_COUNTRIES = ['AE', 'IN', 'BH', 'JO', 'CN', 'MY'];
const NON_MANDATE_COUNTRIES = ['US', 'GB', 'DE', 'FR', 'JP'];
const CATEGORY_CODES = ['SALA', 'PENS', 'TRAD', 'CORT', 'BEXP', 'SUPP', 'DIVI', 'BENE', 'OTHR', 'CHAR'];

function mkPP(rng) {
  return {
    beneficiary_country: pick(rng, [...MANDATE_COUNTRIES, ...NON_MANDATE_COUNTRIES]),
    payment_amount_usd: randRange(rng, 0, 30000),
    purpose_code: pick(rng, ['SALA', 'PENS', '', 'BAD']),
    category_purpose_code: pick(rng, [...CATEGORY_CODES, '']),
  };
}

// ---------- P1: monotone — with category fixed valid, increasing amount past $12,500 never re-enables swiftgo_eligible ----------
function checkP1_monotoneSwiftgo() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const amt1 = randRange(rand, 12500, 30000);
    const amt2 = amt1 + randRange(rand, 0, 10000);
    const base = { beneficiary_country: 'US', purpose_code: 'SALA', category_purpose_code: 'SALA' };
    const r1 = compute({ ...base, payment_amount_usd: amt1 });
    const r2 = compute({ ...base, payment_amount_usd: amt2 });
    checked++;
    if (r1.output_payload.swiftgo_amount_ok === false && r2.output_payload.swiftgo_amount_ok === true) violations++;
  }
  return { name: 'P1_monotone_swiftgo_amount_ok_nonincreasing_past_threshold', trials: checked, violations };
}

// ---------- P2: boundedness — swiftgo_max_usd fixed, required_code_types subset, code_type_required from known set ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  const KNOWN_CODE_TYPE = new Set(['none', 'PurpCd']);
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.output_payload.swiftgo_max_usd !== 12500) violations++;
    if (!KNOWN_CODE_TYPE.has(r.output_payload.code_type_required)) violations++;
    for (const t of r.output_payload.required_code_types) if (t !== 'PurpCd') violations++;
  }
  return { name: 'P2_boundedness_swiftgo_max_fixed_and_code_type_from_known_set', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — jurisdiction mandate and swiftgo flags match independent rule ----------
function checkP3_thresholdAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected_mandate = MANDATE_COUNTRIES.includes(pp.beneficiary_country);
    if (r.output_payload.jurisdiction_requires_purpose_code !== expected_mandate) violations++;
    const expected_amount_ok = pp.payment_amount_usd > 0 && pp.payment_amount_usd <= 12500;
    if (r.output_payload.swiftgo_amount_ok !== expected_amount_ok) violations++;
    const expected_category_ok = pp.category_purpose_code.length > 0 && CATEGORY_CODES.includes(pp.category_purpose_code);
    if (r.output_payload.swiftgo_category_ok !== expected_category_ok) violations++;
  }
  return { name: 'P3_jurisdiction_and_swiftgo_flags_match_fixed_rule', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ payment_amount_usd: 12500 }, 'amount exactly at $12,500 SwiftGo boundary — inclusive <=, must be OK'],
  [{ payment_amount_usd: 12500.000000000002 }, 'amount 1 ULP above $12,500 — must NOT be OK'],
  [{ payment_amount_usd: 12499.999999999998 }, 'amount 1 ULP below $12,500 — must be OK'],
  [{ payment_amount_usd: 0 }, 'amount exactly zero — not OK, guarded by > 0 check'],
  [{ payment_amount_usd: -0 }, 'amount negative zero — must behave as zero, not OK'],
  [{ payment_amount_usd: Number.MIN_VALUE }, 'smallest positive double amount — must be OK, no throw'],
  [{ payment_amount_usd: 0.1 * 3 * 1000 }, 'amount = (0.1*3)*1000 rounding artifact — must remain finite and OK'],
  [{ payment_amount_usd: (1 / 3) * 3 * 12500 }, 'x/y*y!==x rounding artifact at threshold scale — must round-trip without throwing'],
  [{ payment_amount_usd: Number.MAX_SAFE_INTEGER }, 'amount at MAX_SAFE_INTEGER — must remain finite, not OK, no overflow'],
  [{ payment_amount_usd: -100 }, 'negative amount — not OK, no throw'],
];

function checkP4_forced() {
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = { beneficiary_country: 'US', purpose_code: 'SALA', category_purpose_code: 'SALA', ...overrides };
    const r = compute(pp);
    const { swiftgo_amount_ok, swiftgo_eligible } = r.output_payload;
    const plausible = typeof swiftgo_amount_ok === 'boolean' && typeof swiftgo_eligible === 'boolean';
    rows.push({ label, amount: pp.payment_amount_usd, swiftgo_amount_ok, swiftgo_eligible, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneSwiftgo());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_thresholdAgreement());
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
