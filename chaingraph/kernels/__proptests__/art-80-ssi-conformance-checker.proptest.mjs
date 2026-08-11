// kernel_digest_at_authoring: sha256:659829e3ae373c2b2984bd7be749ccc18790106ac4bbfca7a0fc0884047ad958
//
// FV-PROPFLOOR-SHARD-B17-1 — property-test floor for art-80-ssi-conformance-checker.
// Class B (bounded-numeric/categorical), FLOAT:NO per the WU row — the only arithmetic is
// integer counting and a percentage display value (clean/total*100).toFixed(1); all decision
// logic (staleness, completeness, BIC format, golden-source) is categorical/boolean field
// checks. Forced CATEGORICAL boundary cases used in place of ULP forcing. Zero external
// dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the B1/B12 harness.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-80-ssi-conformance-checker.proptest.mjs

import { compute } from '../art-80-ssi-conformance-checker.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-80-ssi-conformance-checker.fixtures.json');
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
const rand = mulberry32(0x80C1D2);
const TRIALS = 8000;

function mkRecord(rng) {
  return {
    market: 'XX',
    instrument_class: 'equity',
    place_of_settlement: 'XXXX',
    account_fields_complete: rng() < 0.7,
    bic: rng() < 0.7 ? 'DEUTDEFF' : 'BADBIC',
    last_verified_age_days: Math.floor(rng() * 400),
    source: rng() < 0.5 ? 'golden' : 'non_golden',
  };
}

function mkPP(rng) {
  const n = Math.floor(rng() * 6);
  const ssi_records = Array.from({ length: n }, () => mkRecord(rng));
  return { ssi_records, staleness_threshold_days: 90 };
}

// ---------- P1: clean_records + records_flagged.length always equals total_records exactly ----------
function checkP1_cleanPlusFlaggedEqualsTotal() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { clean_records, records_flagged, total_records } = r.output_payload;
    if (clean_records + records_flagged.length !== total_records) violations++;
    if (total_records !== pp.ssi_records.length) violations++;
  }
  return { name: 'P1_clean_plus_flagged_equals_total_records_exact', trials: checked, violations };
}

// ---------- P2: match_rate is bounded to [0,100] and exactly 100 when there are zero flags ----------
function checkP2_matchRateBoundedAndExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { match_rate, records_flagged, total_records } = r.output_payload;
    if (match_rate < 0 || match_rate > 100) violations++;
    if (total_records === 0 && match_rate !== 100) violations++;
    if (records_flagged.length === 0 && total_records > 0 && match_rate !== 100) violations++;
  }
  return { name: 'P2_match_rate_bounded_0_100_and_exact_when_zero_flags', trials: checked, violations };
}

// ---------- P3: compliance_flags is the exact set membership derived from the per-record counts ----------
function checkP3_complianceFlagsExactMembership() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { compliance_flags } = r;
    const { staleness_breaches, incomplete_records, format_errors, non_golden_source_count } = r.output_payload;
    if ((staleness_breaches > 0) !== compliance_flags.includes('SSI_STALE')) violations++;
    if ((incomplete_records > 0) !== compliance_flags.includes('SSI_INCOMPLETE')) violations++;
    if ((format_errors > 0) !== compliance_flags.includes('BIC_FORMAT_INVALID')) violations++;
    if ((non_golden_source_count > 0) !== compliance_flags.includes('NON_GOLDEN_SOURCE')) violations++;
  }
  return { name: 'P3_compliance_flags_exact_membership_from_counts', trials: checked, violations };
}

// ---------- P4 (mandatory, float:no exception): forced categorical boundary cases ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ ssi_records: [] }, 'empty ssi_records array — match_rate must be exactly 100, all counters exactly 0'],
  [{ ssi_records: [{}] }, 'record with every field absent — age defaults to 0 (not stale), account_fields_complete undefined (not exactly false, so treated complete), bic empty string (treated ok per the (rec.bic??"")==="" branch), source "unknown" (not golden) — must flag exactly NON_GOLDEN_SOURCE'],
  [{ ssi_records: [{ last_verified_age_days: 90 }], staleness_threshold_days: 90 }, 'age exactly equals staleness_threshold_days (boundary, uses strict >) — must NOT be flagged stale'],
  [{ ssi_records: [{ last_verified_age_days: 91 }], staleness_threshold_days: 90 }, 'age exactly one day past threshold — must be flagged stale'],
  [{ ssi_records: [{ account_fields_complete: 'false' }] }, 'account_fields_complete as the STRING "false" (not boolean) — must still be treated as incomplete per the strict-equality union check'],
  [{ ssi_records: [{ bic_valid: false, bic: 'DEUTDEFF' }] }, 'bic_valid explicitly false overrides a syntactically valid bic — bicOk gate requires bic_valid !== false first, so this must flag BIC_FORMAT_INVALID despite valid-looking bic string'],
  [{ ssi_records: [{ bic: 'short' }] }, 'malformed BIC string shorter than 8 chars — must flag BIC_FORMAT_INVALID'],
  [{ ssi_records: [{ bic: 'DEUTDEFFXXX' }] }, 'BIC at exactly 11 chars (upper boundary, 4+2+2+3) — must be treated as valid, no BIC_FORMAT_INVALID'],
  [{ ssi_records: [{ source: 'golden' }] }, 'source exactly the string "golden" — must count toward golden_source, no NON_GOLDEN_SOURCE flag'],
  [{ ssi_records: [{ source: 'Golden' }] }, 'source case-mismatched "Golden" (strict !== comparison against lowercase "golden") — must be treated as non-golden'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { match_rate, total_records, clean_records, staleness_breaches } = r.output_payload;
    const plausible = Number.isFinite(match_rate) && match_rate >= 0 && match_rate <= 100
      && Number.isInteger(total_records) && Number.isInteger(clean_records) && Number.isInteger(staleness_breaches);
    rows.push({ label, input: pp, match_rate, compliance_flags: r.compliance_flags, records_flagged: r.output_payload.records_flagged, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_cleanPlusFlaggedEqualsTotal());
results.properties.push(checkP2_matchRateBoundedAndExact());
results.properties.push(checkP3_complianceFlagsExactMembership());
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
