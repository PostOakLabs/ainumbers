// kernel_digest_at_authoring: sha256:057a79e66cb2603cd0a4c91cc179046b19ebe82956a4c3a37cf10e5a3ecd1cfb
//
// FV-PROPFLOOR-SHARD-B4-1 — property-test floor for art-161-vida-recapitulative-statement-migration-assessor.
// Class B (bounded categorical), float:no exception per the WU row — fixed-field presence
// counting and a two-way boolean date-tier switch, no continuous arithmetic beyond a guarded
// numeric coercion. Forced categorical boundary cases used in place of ULP forcing per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG + explicit
// boundary arrays), same shape as the B1/B2/B3 harnesses. This file is READ-ONLY with
// respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-161-vida-recapitulative-statement-migration-assessor.proptest.mjs

import { compute } from '../art-161-vida-recapitulative-statement-migration-assessor.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-161-vida-recapitulative-statement-migration-assessor.fixtures.json');
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
const rand = mulberry32(0x16101);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

const TRIALS = 10000;
const ESL_FIELDS = ['seller_vat_id', 'buyer_vat_id', 'reporting_period', 'supply_type'];

function mkPP(rng) {
  const regime = { pre2024_domestic: rng() < 0.5, transaction_value: randRange(rng, 0, 200000) };
  for (const f of ESL_FIELDS) {
    if (rng() < 0.6) regime[f] = `${f}_${Math.floor(randRange(rng, 1, 999))}`;
  }
  return { regime };
}

// ---------- P1: fixed-tier agreement — harmonize_deadline is exactly one of two fixed dates, keyed by pre2024_domestic ----------
function checkP1_deadlineAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected = pp.regime.pre2024_domestic ? '2035-01-01' : '2030-07-01';
    if (r.output_payload.harmonize_deadline !== expected) violations++;
  }
  return { name: 'P1_harmonize_deadline_matches_fixed_pre2024_tier', trials: checked, violations };
}

// ---------- P2: boundedness — gap_count in [0,4], drr_gap_fields subset of the 4 known ESL fields, migration_ready iff gap_count===0 ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { gap_count, drr_gap_fields, migration_ready } = r.output_payload;
    if (gap_count < 0 || gap_count > 4) violations++;
    for (const f of drr_gap_fields) if (!ESL_FIELDS.includes(f)) violations++;
    if (migration_ready !== (gap_count === 0)) violations++;
  }
  return { name: 'P2_boundedness_gap_count_and_gap_fields_subset', trials: checked, violations };
}

// ---------- P3: monotone — adding one more populated ESL field never increases gap_count ----------
function checkP3_monotoneGapCount() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const missing = ESL_FIELDS.filter((f) => !(f in pp.regime));
    checked++;
    if (missing.length === 0) continue;
    const extra = { ...pp.regime, [missing[0]]: 'now_present' };
    const r1 = compute(pp);
    const r2 = compute({ regime: extra });
    if (r2.output_payload.gap_count > r1.output_payload.gap_count) violations++;
  }
  return { name: 'P3_monotone_gap_count_nonincreasing_on_added_field', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applicable) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{}, 'all-empty input — must not throw, gap_count 4, migration_ready false, new-regime 2030 deadline'],
  [{ regime: { pre2024_domestic: true } }, 'legacy regime with zero ESL fields — harmonize_deadline must be exactly 2035-01-01'],
  [{ regime: { seller_vat_id: 'A', buyer_vat_id: 'B', reporting_period: 'C', supply_type: 'D' } }, 'all 4 ESL fields present, non-legacy — gap_count exactly 0, migration_ready true'],
  [{ regime: { seller_vat_id: '', buyer_vat_id: 'B', reporting_period: 'C', supply_type: 'D' } }, 'whitespace/empty-string field must NOT count as provided — gap_count 1'],
  [{ regime: { seller_vat_id: '   ', buyer_vat_id: 'B', reporting_period: 'C', supply_type: 'D' } }, 'whitespace-only field must NOT count as provided — gap_count 1'],
  [{ regime: { pre2024_domestic: false, transaction_value: -100 } }, 'negative transaction_value — must pass through finite, not throw'],
  [{ regime: { pre2024_domestic: 'true' } }, 'pre2024_domestic as truthy string not === true — must be treated as false (2030 deadline)'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { harmonize_deadline, gap_count, migration_ready } = r.output_payload;
    const plausible = ['2030-07-01', '2035-01-01'].includes(harmonize_deadline) && Number.isFinite(gap_count) && gap_count >= 0 && gap_count <= 4 && typeof migration_ready === 'boolean';
    rows.push({ label, pp, harmonize_deadline, gap_count, migration_ready, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_deadlineAgreement());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_monotoneGapCount());
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
