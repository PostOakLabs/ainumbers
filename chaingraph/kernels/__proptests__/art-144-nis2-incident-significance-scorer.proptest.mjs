// kernel_digest_at_authoring: sha256:3cedfccda08a549a70693a65306d63f4593eb7be89533f956fd171400b76bfd2
//
// FV-PROPFLOOR-SHARD-B3-1 — property-test floor for art-144-nis2-incident-significance-scorer.
// Class B (bounded categorical), float:no exception per the WU row — threshold/set-membership
// logic only, no continuous arithmetic beyond guarded numeric comparisons. Forced categorical
// boundary cases used in place of ULP forcing per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external
// dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the B1/B2 harnesses.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-144-nis2-incident-significance-scorer.proptest.mjs

import { compute } from '../art-144-nis2-incident-significance-scorer.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-144-nis2-incident-significance-scorer.fixtures.json');
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
const rand = mulberry32(0x14401);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const TRIALS = 10000;
const VERDICT_RANK = { not_significant: 0, significant: 1, critical: 2 };

function mkPP(rng) {
  return {
    service_disruption_hours: randRange(rng, 0, 10),
    estimated_affected_users: Math.floor(randRange(rng, 0, 5000)),
    estimated_financial_loss_eur: randRange(rng, 0, 2000000),
    third_party_cascade_impact: rng() < 0.3,
    involves_malicious_act: rng() < 0.3,
    cross_border_impact: rng() < 0.3,
    entity_classification: pick(rng, ['essential', 'important', 'other']),
  };
}

// ---------- P1: monotone — improving every input never downgrades the significance verdict ----------
function checkP1_monotoneVerdict() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const worse = { ...pp, service_disruption_hours: 0, estimated_affected_users: 0, estimated_financial_loss_eur: 0, third_party_cascade_impact: false, involves_malicious_act: false, cross_border_impact: false };
    const better = { ...pp, service_disruption_hours: pp.service_disruption_hours + 5, estimated_affected_users: pp.estimated_affected_users + 5000, estimated_financial_loss_eur: pp.estimated_financial_loss_eur + 2000000, third_party_cascade_impact: true, involves_malicious_act: true, cross_border_impact: true };
    const r1 = compute(worse);
    const r2 = compute(better);
    checked++;
    if (r2.output_payload.triggering_factors.length < r1.output_payload.triggering_factors.length) violations++;
    if (VERDICT_RANK[r2.output_payload.significance_verdict] < VERDICT_RANK[r1.output_payload.significance_verdict]) violations++;
  }
  return { name: 'P1_monotone_verdict_nondecreasing_on_improvement', trials: checked, violations };
}

// ---------- P2: boundedness — triggering_factors/recipients drawn from known sets, sizes in range ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  const KNOWN_FACTORS = new Set(['service_disruption', 'significant_user_impact', 'considerable_financial_loss', 'third_party_cascade', 'malicious_act', 'cross_border_impact']);
  const KNOWN_RECIPIENTS = new Set(['national_csirt', 'supervisory_authority', 'sector_regulator']);
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { triggering_factors, recipients } = r.output_payload;
    if (triggering_factors.length > 6) violations++;
    for (const f of triggering_factors) if (!KNOWN_FACTORS.has(f)) violations++;
    for (const rc of recipients) if (!KNOWN_RECIPIENTS.has(rc)) violations++;
  }
  return { name: 'P2_boundedness_factors_and_recipients_from_known_sets', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — significance_verdict matches the documented rule exactly ----------
function checkP3_verdictAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { triggering_factors, significance_verdict, reporting_required } = r.output_payload;
    const expected_reporting = triggering_factors.length > 0;
    if (reporting_required !== expected_reporting) violations++;
    const expected_critical = triggering_factors.length >= 3 || (pp.third_party_cascade_impact === true && pp.involves_malicious_act === true) || (pp.estimated_financial_loss_eur ?? 0) >= 1_000_000;
    const expected_verdict = !expected_reporting ? 'not_significant' : expected_critical ? 'critical' : 'significant';
    if (significance_verdict !== expected_verdict) violations++;
  }
  return { name: 'P3_verdict_matches_fixed_threshold_rule', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applicable) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ service_disruption_hours: 1, estimated_affected_users: 0, estimated_financial_loss_eur: 0 }, 'disruption exactly at threshold min (1h) — must trigger service_disruption'],
  [{ service_disruption_hours: 0.999999, estimated_affected_users: 0, estimated_financial_loss_eur: 0 }, 'disruption just below threshold — must NOT trigger'],
  [{ estimated_affected_users: 1000 }, 'affected_users exactly at threshold min (1000) — must trigger significant_user_impact'],
  [{ estimated_affected_users: 999 }, 'affected_users just below threshold — must NOT trigger'],
  [{ estimated_financial_loss_eur: 100000 }, 'financial loss exactly at threshold min — must trigger considerable_financial_loss'],
  [{ estimated_financial_loss_eur: 1000000 }, 'financial loss exactly at critical threshold — must force critical verdict alone'],
  [{ third_party_cascade_impact: true, involves_malicious_act: true }, 'cascade+malicious AND-combo — must be critical even with only 2 named triggers'],
  [{}, 'all-empty input — defaults to 0/false, not_significant, no throw'],
  [{ service_disruption_hours: -5, estimated_affected_users: -100, estimated_financial_loss_eur: -1 }, 'negative inputs must clamp to 0, not go negative or throw'],
  [{ estimated_affected_users: 5000, entity_classification: 'essential', involves_malicious_act: true, cross_border_impact: true }, 'essential entity with 3 triggers — sector_regulator must be in recipients'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { significance_verdict, triggering_factors, reporting_required } = r.output_payload;
    const plausible = ['not_significant', 'significant', 'critical'].includes(significance_verdict) && Array.isArray(triggering_factors) && typeof reporting_required === 'boolean';
    rows.push({ label, pp, significance_verdict, triggering_factors, reporting_required, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneVerdict());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_verdictAgreement());
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
