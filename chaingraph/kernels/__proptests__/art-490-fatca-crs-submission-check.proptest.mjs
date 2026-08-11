// art-490-fatca-crs-submission-check.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C23-1).
// kernel_digest_at_authoring: sha256:ff7382928e6f04fd05ef9d458b2681f0d86180f02468157ccfa443450eca1d01
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO, direct read confirmed — the entire evaluator is enum-set membership
// (`VALID_DOC_TYPE_INDIC.has`), string presence/emptiness checks, a regex ISO-date format test,
// and Set/Map-based DocRefId uniqueness/referencing. No arithmetic of any kind appears in
// compute(). Forced CATEGORICAL boundary cases used per spec §3's float:no row.
// Checks: fixture-oracle gate, termination (findings.length bounded by a fixed per-record check
// count plus mandatory_element_rules applied per record), differential re-derivation of the
// DocTypeIndic/uniqueness/referencing/TIN/BirthDate/Address findings from raw records,
// boundedness (fail_count === count of non-pass findings, suppressed_finding_count matches the
// suppression-set intersection), forced categorical structural cases (duplicate DocRefId,
// dangling CorrDocRefId, missing CorrDocRefId on a corrective record, malformed BirthDate,
// incomplete Address, a suppression hiding a finding entirely), and a metamorphic
// suppression-monotonicity property (adding a suppressed rule_code can only reduce finding_count
// and fail_count, never increase them).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-490-fatca-crs-submission-check.proptest.mjs

import { compute } from '../art-490-fatca-crs-submission-check.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-490-fatca-crs-submission-check.fixtures.json');
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
const rand = mulberry32(0x490C23);
const DOC_TYPES = ['OECD1', 'OECD2', 'OECD3', 'BADVAL'];

function randomRecord(rng, i, priorRefs) {
  const docType = DOC_TYPES[Math.floor(rng() * DOC_TYPES.length)];
  const hasTin = rng() < 0.8;
  const validBirth = rng() < 0.8;
  const addrOk = rng() < 0.8;
  const dupRef = rng() < 0.15 && priorRefs.length > 0 ? priorRefs[Math.floor(rng() * priorRefs.length)] : `DOC${i}`;
  const corrRef = (docType === 'OECD2' || docType === 'OECD3')
    ? (rng() < 0.6 && priorRefs.length > 0 ? priorRefs[Math.floor(rng() * priorRefs.length)] : (rng() < 0.5 ? '' : 'DANGLING-X'))
    : undefined;
  return {
    doc_ref_id: dupRef,
    corr_doc_ref_id: corrRef,
    doc_type_indic: docType,
    tin: hasTin ? 'TIN123' : '',
    birth_date: validBirth ? '1990-01-01' : 'not-a-date',
    address_street: addrOk ? '1 Main St' : '',
    address_city: addrOk ? 'Anytown' : '',
    address_country_code: addrOk ? 'US' : '',
  };
}

function randomPP(rng) {
  const n = 1 + Math.floor(rng() * 8);
  const records = [];
  const refs = [];
  for (let i = 0; i < n; i++) {
    const r = randomRecord(rng, i, refs);
    records.push(r);
    if (r.doc_ref_id) refs.push(r.doc_ref_id);
  }
  return { submission_id: 'S1', schema_version: 'v2.0', certification_period: '2025', records, mandatory_element_rules: [], suppressed_rule_codes: [] };
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

// Independent reference re-derivation of per-record structural findings (as a count only, not
// full finding objects, since message text is not part of this floor's contract).
function refFindingCount(pp) {
  const docRefIndex = new Set(pp.records.filter((r) => typeof r.doc_ref_id === 'string' && r.doc_ref_id).map((r) => r.doc_ref_id));
  const seen = new Map();
  let count = 0;
  const VALID = new Set(['OECD1', 'OECD2', 'OECD3', 'OECD10', 'OECD11', 'OECD12']);
  const CORRECTIVE = new Set(['OECD2', 'OECD3', 'OECD11', 'OECD12']);
  pp.records.forEach((r) => {
    if (!VALID.has(r.doc_type_indic)) count++;
    if (typeof r.doc_ref_id === 'string' && r.doc_ref_id) {
      if (seen.has(r.doc_ref_id)) count++; else seen.set(r.doc_ref_id, true);
    } else count++;
    if (CORRECTIVE.has(r.doc_type_indic)) {
      if (!(typeof r.corr_doc_ref_id === 'string' && r.corr_doc_ref_id)) count++;
      else if (!docRefIndex.has(r.corr_doc_ref_id)) count++;
    }
    if (!(typeof r.tin === 'string' && r.tin.trim())) count++;
    if (r.birth_date != null && r.birth_date !== '' && !ISO_RE.test(r.birth_date)) count++;
    const addrOk = r.address_street && r.address_city && r.address_country_code;
    if (!addrOk) count++;
  });
  return count;
}

const TRIALS = 5000;

// ---------- P1: termination — record_count === records.length, findings bounded ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.record_count !== pp.records.length) violations++;
    if (output_payload.findings.length > pp.records.length * 6) violations++;
  }
  return { name: 'P1_termination_findings_bounded', trials: checked, violations };
}

// ---------- P2 (differential): total structural finding count re-derived independently ----------
function checkP2_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expectedCount = refFindingCount(pp);
    if (output_payload.finding_count !== expectedCount) violations++;
  }
  return { name: 'P2_finding_count_differential', trials: checked, violations };
}

// ---------- P3: boundedness — fail_count === count of non-pass findings ----------
function checkP3_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const nonPass = output_payload.findings.filter((f) => !f.pass).length;
    if (output_payload.fail_count !== nonPass) violations++;
    if (output_payload.fail_count !== output_payload.findings.length) violations++; // this kernel only pushes fail-shaped findings
  }
  return { name: 'P3_fail_count_boundedness', trials: checked, violations };
}

// ---------- P4 (float:no exception): forced categorical structural boundary cases ----------
function checkP4_forced() {
  const rows = [];
  const cases = [
    { label: 'duplicate DocRefId -> SEQ-DOCREFID-DUP-001 present', pp: { records: [{ doc_ref_id: 'D1', doc_type_indic: 'OECD1', tin: 'T', address_street: 's', address_city: 'c', address_country_code: 'US' }, { doc_ref_id: 'D1', doc_type_indic: 'OECD1', tin: 'T', address_street: 's', address_city: 'c', address_country_code: 'US' }] }, expect: (o) => o.findings.some((f) => f.rule_code === 'SEQ-DOCREFID-DUP-001') },
    { label: 'OECD2 corrective record with dangling CorrDocRefId', pp: { records: [{ doc_ref_id: 'D1', corr_doc_ref_id: 'NOPE', doc_type_indic: 'OECD2', tin: 'T', address_street: 's', address_city: 'c', address_country_code: 'US' }] }, expect: (o) => o.findings.some((f) => f.rule_code === 'REF-CORRDOCREFID-DANGLING-001') },
    { label: 'OECD2 corrective record missing CorrDocRefId entirely', pp: { records: [{ doc_ref_id: 'D1', doc_type_indic: 'OECD2', tin: 'T', address_street: 's', address_city: 'c', address_country_code: 'US' }] }, expect: (o) => o.findings.some((f) => f.rule_code === 'REF-CORRDOCREFID-MISSING-001') },
    { label: 'OECD2 corrective record with a VALID CorrDocRefId resolving to a prior record -> no dangling/missing finding', pp: { records: [{ doc_ref_id: 'D0', doc_type_indic: 'OECD1', tin: 'T', address_street: 's', address_city: 'c', address_country_code: 'US' }, { doc_ref_id: 'D1', corr_doc_ref_id: 'D0', doc_type_indic: 'OECD2', tin: 'T', address_street: 's', address_city: 'c', address_country_code: 'US' }] }, expect: (o) => !o.findings.some((f) => f.rule_code.startsWith('REF-CORRDOCREFID')) },
    { label: 'malformed BirthDate -> MAND-BIRTHDATE-FORMAT-001', pp: { records: [{ doc_ref_id: 'D1', doc_type_indic: 'OECD1', tin: 'T', birth_date: '01/01/1990', address_street: 's', address_city: 'c', address_country_code: 'US' }] }, expect: (o) => o.findings.some((f) => f.rule_code === 'MAND-BIRTHDATE-FORMAT-001') },
    { label: 'incomplete Address (missing city) -> MAND-ADDRESS-COMPLETENESS-001', pp: { records: [{ doc_ref_id: 'D1', doc_type_indic: 'OECD1', tin: 'T', address_street: 's', address_country_code: 'US' }] }, expect: (o) => o.findings.some((f) => f.rule_code === 'MAND-ADDRESS-COMPLETENESS-001') },
    { label: 'suppression hides a finding entirely (no findings pushed for that rule_code)', pp: { records: [{ doc_ref_id: 'D1', doc_type_indic: 'BAD', tin: 'T', address_street: 's', address_city: 'c', address_country_code: 'US' }], suppressed_rule_codes: ['SEQ-DOCTYPEINDIC-001'] }, expect: (o) => !o.findings.some((f) => f.rule_code === 'SEQ-DOCTYPEINDIC-001') && o.suppressed_finding_count === 1 },
    { label: 'empty records array -> record_count 0, no findings, no throw', pp: { records: [] }, expect: (o) => o.record_count === 0 && o.findings.length === 0 },
  ];
  for (const c of cases) {
    let threw = false, o;
    try { o = compute(c.pp).output_payload; } catch (e) { threw = true; }
    const plausible = !threw && c.expect(o);
    rows.push({ label: c.label, threw, plausible });
  }
  return rows;
}

// ---------- P5: metamorphic — suppression-monotonicity (never increases finding_count/fail_count) ----------
function checkP5_suppression_monotonic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 3000; i++) {
    const pp = randomPP(rand);
    const r1 = compute(pp).output_payload;
    if (r1.findings.length === 0) continue;
    const target = r1.findings[Math.floor(rand() * r1.findings.length)];
    const pp2 = { ...pp, suppressed_rule_codes: [target.rule_code] };
    const r2 = compute(pp2).output_payload;
    checked++;
    if (r2.finding_count > r1.finding_count) violations++;
    if (r2.fail_count > r1.fail_count) violations++;
    if (r2.suppressed_finding_count < 1) violations++;
  }
  return { name: 'P5_suppression_monotonicity_metamorphic', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_differential());
results.properties.push(checkP3_boundedness());
results.boundary_forced = checkP4_forced();
results.properties.push(checkP5_suppression_monotonic());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  tool_id: 'art-490-fatca-crs-submission-check',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);
