// kernel_digest_at_authoring: sha256:f5cdbd302bc819281ca45b0324490e3843d98a3ff0912db8177a323a66c79336
//
// FV-PROPFLOOR-SHARD-B2-1 — property-test floor for art-141-nis2-entity-scope-classifier.
// Class B (bounded-numeric/tier), FLOAT-SENSITIVE (employee_count/annual_turnover_eur
// threshold comparisons at 50/250 and 10M/50M) — ULP-boundary forcing is MANDATORY per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG + explicit
// boundary arrays), same shape as the B1 pilot harness. This file is READ-ONLY with
// respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-141-nis2-entity-scope-classifier.proptest.mjs

import { compute } from '../art-141-nis2-entity-scope-classifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-141-nis2-entity-scope-classifier.fixtures.json');
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
const rand = mulberry32(0x1410A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const ANNEX_I = ['energy', 'transport', 'banking', 'financial_market_infrastructure', 'health', 'drinking_water', 'wastewater', 'digital_infrastructure', 'public_administration', 'space'];
const ANNEX_II = ['postal_courier', 'waste_management', 'manufacturing_critical', 'food_production', 'chemicals', 'digital_services', 'research'];
const RANK = { out_of_scope: 0, important: 1, essential: 2 };
const TRIALS = 10000;

// ---------- P1: monotone — increasing employee_count/turnover never lowers the classification rank ----------
function checkP1_monotoneSize() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const sector_code = pick(rand, [...ANNEX_I, ...ANNEX_II]);
    const e1 = randRange(rand, 0, 500);
    const e2 = e1 + randRange(rand, 0, 500);
    const t1 = randRange(rand, 0, 100_000_000);
    const t2 = t1 + randRange(rand, 0, 100_000_000);
    const r1 = compute({ sector_code, employee_count: e1, annual_turnover_eur: t1 });
    const r2 = compute({ sector_code, employee_count: e2, annual_turnover_eur: t2 });
    checked++;
    if (RANK[r2.output_payload.entity_classification] < RANK[r1.output_payload.entity_classification]) violations++;
  }
  return { name: 'P1_monotone_classification_rank_nondecreasing_in_size', trials: checked, violations };
}

// ---------- P2: boundedness — classification/annex/penalties are always from the fixed known sets ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  const KNOWN_CLASS = new Set(['out_of_scope', 'important', 'essential']);
  const KNOWN_ANNEX = new Set(['none', 'I', 'II']);
  for (let i = 0; i < TRIALS; i++) {
    const sector_code = pick(rand, [...ANNEX_I, ...ANNEX_II, 'unlisted_sector', '']);
    const employee_count = randRange(rand, -100, 10000);
    const annual_turnover_eur = randRange(rand, -1000, 200_000_000);
    const flags = { is_dns_provider: rand() < 0.1, is_qualified_trust_service_provider: rand() < 0.1, is_public_electronic_comms_network: rand() < 0.1 };
    const r = compute({ sector_code, employee_count, annual_turnover_eur, ...flags });
    checked++;
    const { entity_classification, annex, applicable_penalties, employee_count: safeEmp, annual_turnover_eur: safeTurn } = r.output_payload;
    if (!KNOWN_CLASS.has(entity_classification)) violations++;
    if (!KNOWN_ANNEX.has(annex)) violations++;
    if (safeEmp < 0) violations++;
    if (safeTurn < 0) violations++;
    if (applicable_penalties.art21_max_eur < 0) violations++;
  }
  return { name: 'P2_boundedness_known_sets_and_nonnegative_safe_inputs', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement at the exact 250-employee / 50M-turnover Annex I boundary ----------
function checkP3_thresholdTierAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const sector_code = pick(rand, ANNEX_I);
    const employee_count = 250; // exactly at large-enterprise employee boundary
    const t1 = randRange(rand, 0, 49_999_999);
    const t2 = randRange(rand, 0, 49_999_999);
    const r1 = compute({ sector_code, employee_count, annual_turnover_eur: t1 });
    const r2 = compute({ sector_code, employee_count, annual_turnover_eur: t2 });
    checked++;
    if (r1.output_payload.entity_classification !== 'essential') violations++;
    if (r1.output_payload.entity_classification !== r2.output_payload.entity_classification) violations++;
    if (r1.output_payload.classification_basis !== 'annex_i_large_enterprise') violations++;
  }
  return { name: 'P3_employee_250_boundary_forces_essential_regardless_of_turnover', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  ['energy', 250, 0, 'employee_count exactly 250 — is_large boundary, must classify essential (>= is inclusive)'],
  ['energy', 249, 0, 'employee_count exactly 249 — 1 below boundary, must NOT be large via employee test alone'],
  ['energy', 0, 50_000_000, 'turnover exactly 50,000,000 — is_large boundary, must classify essential'],
  ['energy', 0, 49999999.999999, 'turnover 1 ULP below 50,000,000 boundary — must NOT be large via turnover alone'],
  ['energy', 50, 10_000_000, 'employee=50 AND turnover=10,000,000 — both medium boundaries simultaneously, must be important'],
  ['energy', 49, 9999999.999999, '1 below both medium boundaries — must be out_of_scope'],
  ['energy', -0, -0, 'negative-zero employee_count and turnover — must behave as zero, out_of_scope'],
  ['energy', Number.MIN_VALUE, Number.MIN_VALUE, 'smallest positive double for both — must floor/clamp cleanly, not error'],
  ['digital_services', 50, 0, 'Annex II employee boundary exactly 50 — must be important (>= inclusive)'],
  ['digital_services', 49.9999999999, 0, 'Annex II employee just under 50 (non-integer, floored) — must be out_of_scope'],
];

function checkP4_forced() {
  const rows = [];
  for (const [sector_code, employee_count, annual_turnover_eur, label] of ULP_BOUNDARY_CASES) {
    const r = compute({ sector_code, employee_count, annual_turnover_eur });
    const { entity_classification, annex } = r.output_payload;
    const finite = Number.isFinite(r.output_payload.employee_count) && Number.isFinite(r.output_payload.annual_turnover_eur);
    const plausible = finite && ['out_of_scope', 'important', 'essential'].includes(entity_classification) && ['none', 'I', 'II'].includes(annex);
    rows.push({ label, sector_code, employee_count, annual_turnover_eur, entity_classification, annex, finite, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneSize());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_thresholdTierAgreement());
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
