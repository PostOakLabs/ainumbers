// kernel_digest_at_authoring: sha256:892f0f32b3889153f5a40251ad7cf96f85b3588942c675d4f91008061a33927a
//
// FV-PROPFLOOR-SHARD-B23-1 — property-test floor for art-412-ai-act-procurement-clause-mapper.
// Class B (bounded-numeric), float:no (risk_tier is a normalized enum string, clause sets are
// fixed arrays) — forced CATEGORICAL boundary cases used instead of ULP forcing, per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies. This file is READ-ONLY with
// respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-412-ai-act-procurement-clause-mapper.proptest.mjs

import { compute } from '../art-412-ai-act-procurement-clause-mapper.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-412-ai-act-procurement-clause-mapper.fixtures.json');
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
const rand = mulberry32(0x412C3);
const TRIALS = 10000;
const RISK_TIERS = ['high-risk', 'light', 'High-Risk', ' light ', 'HIGH-RISK', 'unknown', '', undefined, 'medium'];
const CONTEXTS = ['procurement of a hiring tool', '', undefined];

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function mkPP(rng) {
  return { risk_tier: pick(rng, RISK_TIERS), deployment_context: pick(rng, CONTEXTS) };
}

// ---------- P1: boundedness — risk_tier output is always null, 'high-risk', or 'light' ----------
function checkP1_riskTierBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (![null, 'high-risk', 'light'].includes(r.output_payload.risk_tier)) violations++;
  }
  return { name: 'P1_risk_tier_bounded_to_null_or_two_enum_values', trials: checked, violations };
}

// ---------- P2: fixed rule — clause set exact per normalized (trim+lowercase) tier ----------
function checkP2_clauseSetExact() {
  let violations = 0, checked = 0;
  const HIGH = ['transparency', 'risk_management', 'data_governance', 'human_oversight', 'cybersecurity'];
  const LIGHT = ['transparency', 'record_keeping'];
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const normalized = typeof pp.risk_tier === 'string' ? pp.risk_tier.trim().toLowerCase() : '';
    const expected = normalized === 'high-risk' ? HIGH : normalized === 'light' ? LIGHT : [];
    if (JSON.stringify(r.output_payload.applicable_chapter_iii_clauses) !== JSON.stringify(expected)) violations++;
  }
  return { name: 'P2_clause_set_exact_per_normalized_tier', trials: checked, violations };
}

// ---------- P3: round-trip identity — normalization (trim+lowercase) is idempotent on the reported tier ----------
function checkP3_normalizationIdempotent() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.output_payload.risk_tier !== null) {
      const again = compute({ risk_tier: r.output_payload.risk_tier, deployment_context: pp.deployment_context });
      if (again.output_payload.risk_tier !== r.output_payload.risk_tier) violations++;
      if (JSON.stringify(again.output_payload.applicable_chapter_iii_clauses) !== JSON.stringify(r.output_payload.applicable_chapter_iii_clauses)) violations++;
    }
  }
  return { name: 'P3_reapplying_compute_to_normalized_output_is_idempotent', trials: checked, violations };
}

// ---------- P4 (categorical boundary forcing, float:no exception) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ risk_tier: 'high-risk' }, 'exact lowercase high-risk — 5-clause set, template High-Risk'],
  [{ risk_tier: 'light' }, 'exact lowercase light — 2-clause set, template Light'],
  [{ risk_tier: 'HIGH-RISK' }, 'all-caps HIGH-RISK — must normalize to high-risk template'],
  [{ risk_tier: '  light  ' }, 'light with leading/trailing whitespace — must trim and normalize'],
  [{ risk_tier: '' }, 'empty string risk_tier — invalid, null template, empty clause list'],
  [{ risk_tier: 'medium' }, 'unrecognized risk_tier string — invalid, null template, empty clause list, RISK_TIER_INVALID flag'],
  [{}, 'missing risk_tier entirely — same as empty string, invalid'],
  [{ risk_tier: 'high-risk ' }, 'high-risk with trailing space only — must still normalize and match'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const op = r.output_payload;
    const plausible = [null, 'high-risk', 'light'].includes(op.risk_tier)
      && Array.isArray(op.applicable_chapter_iii_clauses)
      && (op.risk_tier === null ? op.applicable_chapter_iii_clauses.length === 0 : op.applicable_chapter_iii_clauses.length > 0);
    rows.push({ label, input: pp, risk_tier: op.risk_tier, template: op.template, clauses: op.applicable_chapter_iii_clauses, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_riskTierBounded());
results.properties.push(checkP2_clauseSetExact());
results.properties.push(checkP3_normalizationIdempotent());
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
