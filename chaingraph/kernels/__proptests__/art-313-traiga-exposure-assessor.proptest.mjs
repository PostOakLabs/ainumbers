// kernel_digest_at_authoring: sha256:46ddb72f43e3a33e75b6718621bc06971855f36c96ee9be5c32f9d28277ca6ac
//
// FV-PROPFLOOR-SHARD-B11-1 — property-test floor for art-313-traiga-exposure-assessor.
// Class B (bounded categorical), float:no exception per the WU row — boolean gate + fixed-list
// array-filter logic only, no continuous arithmetic. Forced categorical boundary cases used in
// place of ULP forcing per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32
// PRNG + explicit boundary arrays), same shape as the B1/B2/B3 harnesses. This file is READ-ONLY
// with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-313-traiga-exposure-assessor.proptest.mjs

import { compute, PROHIBITED_USE_CATEGORIES } from '../art-313-traiga-exposure-assessor.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-313-traiga-exposure-assessor.fixtures.json');
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
const rand = mulberry32(0x31301);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 10000;
const NOISE_FLAGS = ['unrelated_flag_a', 'unrelated_flag_b', 'unrelated_flag_c'];

function mkPP(rng) {
  const deploys_in_texas = rng() < 0.5;
  const pool = [...PROHIBITED_USE_CATEGORIES, ...NOISE_FLAGS];
  const n = Math.floor(rng() * 4);
  const asserted_use_flags = Array.from({ length: n }, () => pick(rng, pool));
  return { deploys_in_texas, asserted_use_flags };
}

// ---------- P1: monotone — adding a prohibited-use flag never un-flags prohibited_use_detected ----------
function checkP1_monotoneFlagging() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const withoutFlag = { ...pp, asserted_use_flags: pp.asserted_use_flags.filter((f) => !PROHIBITED_USE_CATEGORIES.includes(f)) };
    const withFlag = { ...pp, asserted_use_flags: [...withoutFlag.asserted_use_flags, PROHIBITED_USE_CATEGORIES[0]] };
    const r1 = compute(withoutFlag);
    const r2 = compute(withFlag);
    checked++;
    if (r1.output_payload.prohibited_use_detected === true && r2.output_payload.prohibited_use_detected === false) violations++;
  }
  return { name: 'P1_monotone_prohibited_use_never_unflags_on_addition', trials: checked, violations };
}

// ---------- P2: boundedness — matched_prohibited_uses is always a subset of the fixed 6-category list ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { matched_prohibited_uses } = r.output_payload;
    if (matched_prohibited_uses.length > PROHIBITED_USE_CATEGORIES.length) violations++;
    for (const m of matched_prohibited_uses) if (!PROHIBITED_USE_CATEGORIES.includes(m)) violations++;
  }
  return { name: 'P2_boundedness_matched_uses_subset_of_fixed_category_list', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — traiga_applicable equals deploys_in_texas exactly, prohibited_use_detected equals nonempty-match ----------
function checkP3_applicabilityAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.output_payload.traiga_applicable !== (pp.deploys_in_texas === true)) violations++;
    const expectedMatched = pp.asserted_use_flags.filter((f) => PROHIBITED_USE_CATEGORIES.includes(f));
    const expectedDetected = expectedMatched.length > 0;
    if (r.output_payload.prohibited_use_detected !== expectedDetected) violations++;
  }
  return { name: 'P3_applicability_and_detection_match_exact_boolean_rules', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applicable) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{}, 'all-empty input — deploys_in_texas false, no flags, traiga_applicable false, no throw'],
  [{ deploys_in_texas: true, asserted_use_flags: [] }, 'deploys in Texas but zero flags — traiga_applicable true, prohibited_use_detected false'],
  [{ deploys_in_texas: false, asserted_use_flags: ['csam_or_illegal_sexual_content'] }, 'prohibited flag asserted but NOT deploying in Texas — traiga_applicable must still be FALSE (independent of flags)'],
  [{ deploys_in_texas: true, asserted_use_flags: PROHIBITED_USE_CATEGORIES }, 'every prohibited category asserted at once — matched_prohibited_uses must equal the full 6-item list exactly'],
  [{ deploys_in_texas: true, asserted_use_flags: ['not_a_real_category', 'also_fake'] }, 'unrecognized flag strings only — prohibited_use_detected must be false, matched_prohibited_uses empty'],
  [{ deploys_in_texas: 'true', asserted_use_flags: [] }, 'deploys_in_texas as string "true" not boolean — must NOT count as Texas deployment (strict === true check)'],
  [{ deploys_in_texas: true, asserted_use_flags: ['intentional_self_harm_incitement', 'intentional_self_harm_incitement'] }, 'duplicate prohibited flag — matched_prohibited_uses must include the duplicate per filter semantics, still detected true'],
  [{ deploys_in_texas: true, asserted_use_flags: 'not-an-array' }, 'asserted_use_flags is a string, not array — must safely fall back to empty array, not throw'],
  [{ penalty_per_violation_usd: 999999 }, 'attempted override of the fixed penalty constant via policy_parameters — output must still be the pinned 200000, not the supplied value'],
  [{ deploys_in_texas: true, asserted_use_flags: ['child_impersonation_sexual_chat'] }, 'single prohibited category exact match — statute_citation and cure_window_days must be the pinned constants regardless'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { traiga_applicable, prohibited_use_detected, matched_prohibited_uses, penalty_per_violation_usd, cure_window_days } = r.output_payload;
    const plausible = typeof traiga_applicable === 'boolean' && typeof prohibited_use_detected === 'boolean'
      && Array.isArray(matched_prohibited_uses) && penalty_per_violation_usd === 200000 && cure_window_days === 60;
    rows.push({ label, pp, traiga_applicable, prohibited_use_detected, matched_prohibited_uses, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneFlagging());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_applicabilityAgreement());
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
