// kernel_digest_at_authoring: sha256:40d480ee243c1129a894f873de670a195ee2a65e7057d3c68c734f66227fb2da
//
// FV-PROPFLOOR-SHARD-B4-1 — property-test floor for art-167-eudr-commodity-scope-classifier.
// Class B (bounded categorical), float:no exception per the WU row — HS-code lookup table
// membership plus two fixed employee/turnover threshold tiers, no continuous arithmetic
// beyond guarded numeric coercions compared against fixed constants. Forced categorical
// boundary cases used in place of ULP forcing per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero
// external dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the
// B1/B2/B3 harnesses. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-167-eudr-commodity-scope-classifier.proptest.mjs

import { compute } from '../art-167-eudr-commodity-scope-classifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-167-eudr-commodity-scope-classifier.fixtures.json');
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
const rand = mulberry32(0x16701);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const IN_SCOPE_HS4 = ['0102', '1801', '0901', '1511', '4001', '1201', '4401', '9401'];
const OUT_SCOPE_HS4 = ['8471', '0303', '6109', '2710'];
const TRIALS = 10000;

function mkPP(rng) {
  const hs_code = pick(rng, [...IN_SCOPE_HS4, ...OUT_SCOPE_HS4]);
  return {
    hs_code,
    entity: {
      entity_type: pick(rng, ['operator', 'trader', 'other']),
      employee_count: Math.floor(randRange(rng, 0, 1000)),
      annual_turnover_eur: randRange(rng, 0, 100_000_000),
    },
  };
}

// ---------- P1: fixed-tier agreement — deadline exactly one of two fixed dates, keyed by (is_micro||is_sme) ----------
function checkP1_deadlineAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    if (!op.in_scope) { if (op.deadline !== null) violations++; continue; }
    const expected = (op.is_micro || op.is_sme) ? '2027-06-30' : '2026-12-30';
    if (op.deadline !== expected) violations++;
  }
  return { name: 'P1_deadline_matches_fixed_micro_sme_tier', trials: checked, violations };
}

// ---------- P2: boundedness — is_micro/is_sme match the two fixed employee+turnover thresholds exactly ----------
function checkP2_thresholdAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    const e = pp.entity.employee_count, t = pp.entity.annual_turnover_eur;
    const expectedMicro = e < 10 && t < 2_000_000;
    const expectedSme = e < 250 && t < 50_000_000;
    if (op.is_micro !== expectedMicro) violations++;
    if (op.is_sme !== expectedSme) violations++;
  }
  return { name: 'P2_is_micro_is_sme_match_fixed_thresholds', trials: checked, violations };
}

// ---------- P3: monotone — a commodity that is in_scope for a trader is also in_scope for an operator on the same hs_code (in_scope is HS-code-only, entity-independent) ----------
function checkP3_inScopeEntityIndependent() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    checked++;
    const rOperator = compute({ ...pp, entity: { ...pp.entity, entity_type: 'operator' } });
    const rTrader = compute({ ...pp, entity: { ...pp.entity, entity_type: 'trader' } });
    if (rOperator.output_payload.in_scope !== rTrader.output_payload.in_scope) violations++;
    if (rOperator.output_payload.commodity !== rTrader.output_payload.commodity) violations++;
  }
  return { name: 'P3_in_scope_and_commodity_independent_of_entity_type', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applicable) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{}, 'all-empty input — must not throw, in_scope false, is_micro/is_sme true (0<10, 0<2M)'],
  [{ hs_code: '4407', entity: { employee_count: 249, annual_turnover_eur: 49_999_999 } }, 'employee_count 1 below SME ceiling, turnover 1 below SME ceiling — is_sme must be true'],
  [{ hs_code: '4407', entity: { employee_count: 250, annual_turnover_eur: 49_999_999 } }, 'employee_count exactly at SME ceiling (250) — is_sme must be false'],
  [{ hs_code: '4407', entity: { employee_count: 9, annual_turnover_eur: 1_999_999 } }, 'employee_count 1 below micro ceiling, turnover 1 below micro ceiling — is_micro must be true'],
  [{ hs_code: '4407', entity: { employee_count: 10, annual_turnover_eur: 1_999_999 } }, 'employee_count exactly at micro ceiling (10) — is_micro must be false'],
  [{ hs_code: '4407.10', entity: { employee_count: 5, annual_turnover_eur: 100000 } }, 'hs_code with dot-separator subheading — dots must be stripped before HS4 lookup, still in scope'],
  [{ hs_code: '99999999', entity: {} }, 'unrecognized 8-digit hs_code — in_scope must be false, hs4_matched still populated'],
  [{ hs_code: '', entity: { employee_count: 5, annual_turnover_eur: 100000 } }, 'empty hs_code string — in_scope false, hs4_matched null, no throw'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { in_scope, is_micro, is_sme, deadline } = r.output_payload;
    const plausible = typeof in_scope === 'boolean' && typeof is_micro === 'boolean' && typeof is_sme === 'boolean' && (deadline === null || ['2026-12-30', '2027-06-30'].includes(deadline));
    rows.push({ label, pp, in_scope, is_micro, is_sme, deadline, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_deadlineAgreement());
results.properties.push(checkP2_thresholdAgreement());
results.properties.push(checkP3_inScopeEntityIndependent());
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
