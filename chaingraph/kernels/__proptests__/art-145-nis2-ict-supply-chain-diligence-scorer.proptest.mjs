// kernel_digest_at_authoring: sha256:5568ba2aecf8ca9923d20122d22c9cfd8950d2e781ea7cc58041c885e3de85b4
//
// FV-PROPFLOOR-SHARD-B3-1 — property-test floor for art-145-nis2-ict-supply-chain-diligence-scorer.
// Class B (bounded categorical/scoring), float:no exception per the WU row — integer risk-point
// accumulation and fixed-tier thresholds only, no continuous arithmetic. Forced categorical
// boundary cases used in place of ULP forcing per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external
// dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the B1/B2 harnesses.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-145-nis2-ict-supply-chain-diligence-scorer.proptest.mjs

import { compute } from '../art-145-nis2-ict-supply-chain-diligence-scorer.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-145-nis2-ict-supply-chain-diligence-scorer.fixtures.json');
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
const rand = mulberry32(0x14501);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;
const TIER_RANK = { low: 0, medium: 1, high: 2, critical: 3 };

function mkPP(rng) {
  return {
    vendor_iso27001_certified: rng() < 0.5,
    vendor_incident_history_12mo: Math.floor(randRange(rng, 0, 5)),
    audit_clause_in_contract: rng() < 0.5,
    breach_notification_sla_hours: rng() < 0.8 ? randRange(rng, 0, 200) : null,
    data_residency_eu_only: rng() < 0.5,
    sub_contractor_count: Math.floor(randRange(rng, 0, 10)),
    service_availability_pct: randRange(rng, 90, 100),
  };
}

// ---------- P1: monotone — worsening any single control never decreases risk_score, never lowers tier ----------
function checkP1_monotoneRisk() {
  let violations = 0, checked = 0;
  const GOOD = { vendor_iso27001_certified: true, vendor_incident_history_12mo: 0, audit_clause_in_contract: true, breach_notification_sla_hours: 1, data_residency_eu_only: true, sub_contractor_count: 0, service_availability_pct: 100 };
  const BAD = { vendor_iso27001_certified: false, vendor_incident_history_12mo: 5, audit_clause_in_contract: false, breach_notification_sla_hours: null, data_residency_eu_only: false, sub_contractor_count: 10, service_availability_pct: 50 };
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const better = { ...pp, ...GOOD };
    const worse = { ...pp, ...BAD };
    const r1 = compute(better);
    const r2 = compute(worse);
    checked++;
    if (r2.output_payload.risk_score < r1.output_payload.risk_score) violations++;
    if (TIER_RANK[r2.output_payload.risk_tier] < TIER_RANK[r1.output_payload.risk_tier]) violations++;
  }
  return { name: 'P1_monotone_risk_nondecreasing_on_worsening', trials: checked, violations };
}

// ---------- P2: boundedness — risk_score in [0,165], coverage_pct in [0,100] ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { risk_score, enisa_control_coverage_pct } = r.output_payload;
    if (risk_score < 0 || risk_score > 165) violations++;
    if (enisa_control_coverage_pct < 0 || enisa_control_coverage_pct > 100) violations++;
  }
  return { name: 'P2_boundedness_risk_score_and_coverage_pct', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — risk_tier matches the documented score bands exactly ----------
function checkP3_tierAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { risk_score, risk_tier } = r.output_payload;
    const expected = risk_score <= 20 ? 'low' : risk_score <= 50 ? 'medium' : risk_score <= 80 ? 'high' : 'critical';
    if (risk_tier !== expected) violations++;
  }
  return { name: 'P3_risk_tier_matches_fixed_score_bands', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applicable) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ vendor_iso27001_certified: true, audit_clause_in_contract: true, breach_notification_sla_hours: 72, data_residency_eu_only: true, sub_contractor_count: 3, service_availability_pct: 99.5 }, 'exactly all boundary-pass values — risk_score must be exactly 0, tier low'],
  [{}, 'empty input — all 7 flags default to worst case, risk_score high/critical'],
  [{ vendor_incident_history_12mo: 1 }, 'exactly 1 incident — risk contribution must be exactly 30 (min(1*30,60))'],
  [{ vendor_incident_history_12mo: 2 }, 'exactly 2 incidents — risk contribution must be exactly 60 (min(2*30,60))'],
  [{ vendor_incident_history_12mo: 3 }, 'exactly 3 incidents — risk contribution must be capped at 60, not 90'],
  [{ breach_notification_sla_hours: 72 }, 'SLA exactly at 72h boundary — must NOT trigger slow_breach_notification'],
  [{ breach_notification_sla_hours: 72.0001 }, 'SLA 1 unit over 72h boundary — must trigger slow_breach_notification'],
  [{ sub_contractor_count: 3 }, 'sub_contractor_count exactly at 3 — must NOT trigger unmapped_subcontractors'],
  [{ sub_contractor_count: 4 }, 'sub_contractor_count exactly at 4 — must trigger unmapped_subcontractors'],
  [{ service_availability_pct: 99.5 }, 'availability exactly at 99.5 — must NOT trigger low_availability_sla'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { risk_score, risk_tier, enisa_control_coverage_pct } = r.output_payload;
    const plausible = Number.isFinite(risk_score) && ['low', 'medium', 'high', 'critical'].includes(risk_tier) && enisa_control_coverage_pct >= 0 && enisa_control_coverage_pct <= 100;
    rows.push({ label, pp, risk_score, risk_tier, enisa_control_coverage_pct, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneRisk());
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
