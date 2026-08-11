// art-510-build-art5-diligence-evidence.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C25-1).
// kernel_digest_at_authoring: sha256:72798cbb71379e42e0b388c97b0781d1189fd20a06e289e2bbff86254b0dd17e
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO — CORRECTED from the WU row's float:yes (per FIX-2 discipline). Direct source
// read: this kernel performs zero numeric arithmetic of any kind. Every field is a string, a boolean,
// an array, or an integer COUNT (`roles_satisfied`, `duty_count`, `performed_count`). Date comparisons
// (`within_period`) compare ISO yyyy-mm-dd strings lexicographically, never parsed as numbers or Dates.
// There is no division, no percentage, no rate, and no floating-point representation anywhere in this
// file. Forced categorical boundary cases are used in place of ULP-boundary forcing.
// Checks: fixture-oracle gate, termination (duty_results bounded by shipped-duty-count plus supplied
// additional_duties count), differential re-derivation of the per-duty status precedence order,
// metamorphic append-invariance (an accountability record or declaration for an unrelated duty_id
// never changes any other duty's evaluation), and forced categorical boundary cases (bare-year
// citation rejection, self-approval flag, period bounds absent/inverted, empty input).
//
// Run: node chaingraph/kernels/__proptests__/art-510-build-art5-diligence-evidence.proptest.mjs

import { compute } from '../art-510-build-art5-diligence-evidence.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-510-build-art5-diligence-evidence.fixtures.json');
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
const rand = mulberry32(0x51000);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const SHIPPED_DUTY_IDS = [
  'verify_credit_granting_standards', 'verify_risk_retention', 'verify_article_7_disclosure',
  'assess_risk_characteristics', 'monitor_ongoing_performance', 'perform_stress_tests', 'report_internally',
];

function randomDeclarations(rng) {
  const decls = [];
  for (const id of SHIPPED_DUTY_IDS) {
    if (rng() < 0.3) continue; // some duties get no declaration -> outstanding
    decls.push({
      duty_id: id,
      performed: rng() < 0.8,
      evidence: rng() < 0.7 ? [{ evidence_ref: `EV-${id}`, evidence_type: 'doc', dated: '2026-03-15' }] : [],
    });
  }
  return decls;
}

function randomAccountabilityRecords(rng) {
  const recs = [];
  for (const id of SHIPPED_DUTY_IDS) {
    if (rng() < 0.4) continue;
    const performerId = `perf-${Math.floor(rng() * 3)}`;
    const approverId = rng() < 0.2 ? performerId : `appr-${Math.floor(rng() * 3)}`;
    for (const [role, identity_id] of [['performer', performerId], ['approver', approverId]]) {
      if (rng() < 0.15) continue;
      recs.push({
        duty_id: id, role, record_type: 'approval',
        identity: { id: identity_id },
        audit_signature: { proof: { cryptosuite: 'eddsa-jcs-2022', verificationMethod: `${identity_id}#key-1` } },
      });
    }
  }
  return recs;
}

function randomPP(rng) {
  return {
    position_ref: 'POS-1', deal_ref: 'D1', investor_ref: 'INV-1',
    period: { label: 'Q1-2026', start_date: '2026-01-01', end_date: '2026-03-31' },
    duty_declarations: randomDeclarations(rng),
    accountability_records: randomAccountabilityRecords(rng),
    additional_duties: [],
  };
}

const TRIALS = 2500;

// ---------- P1: termination — duty_results bounded by shipped + additional duty counts ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.duty_results.length !== SHIPPED_DUTY_IDS.length + pp.additional_duties.length) violations++;
    if (output_payload.duty_count !== output_payload.duty_results.length) violations++;
    if (output_payload.performed_count > output_payload.duty_count) violations++;
  }
  return { name: 'P1_duty_results_bounded_by_shipped_plus_additional', trials: checked, violations };
}

// ---------- P2 (differential): per-duty status precedence re-derived ----------
function checkP2_status_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    for (const d of output_payload.duty_results) {
      const decl = pp.duty_declarations.find((x) => x.duty_id === d.duty_id);
      const performedAsserted = !!(decl && decl.performed === true);
      const evidenceLen = decl && Array.isArray(decl.evidence) ? decl.evidence.length : 0;
      if (d.performed_asserted !== performedAsserted) violations++;
      if (d.evidence_count !== evidenceLen) violations++;
      // status precedence: citation_unusable > judgment_required > outstanding > asserted_without_evidence > evidence_unsigned > performed
      if (d.citation === null && d.status !== 'citation_unusable') violations++;
      if (d.citation !== null && !performedAsserted && d.status !== 'outstanding') violations++;
      if (d.citation !== null && performedAsserted && evidenceLen === 0 && d.status !== 'asserted_without_evidence') violations++;
    }
  }
  return { name: 'P2_status_precedence_differential', trials: checked, violations };
}

// ---------- P3: metamorphic — a declaration/record for an unrelated duty_id never changes any other duty ----------
function checkP3_unrelated_duty_append_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1200; i++) {
    const pp = randomPP(rand);
    const extended = {
      ...pp,
      duty_declarations: [...pp.duty_declarations, { duty_id: 'NOT_A_REAL_DUTY', performed: true, evidence: [{ evidence_ref: 'X' }] }],
      accountability_records: [...pp.accountability_records, { duty_id: 'NOT_A_REAL_DUTY', role: 'performer', record_type: 'approval', identity: { id: 'ghost' } }],
    };
    const r1 = compute(pp).output_payload;
    const r2 = compute(extended).output_payload;
    checked++;
    if (JSON.stringify(r1.duty_results) !== JSON.stringify(r2.duty_results)) violations++;
    if (r1.performed_count !== r2.performed_count) violations++;
  }
  return { name: 'P3_unrelated_duty_id_append_invariance', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applies) ----------
function checkP4_forced_categorical_boundaries() {
  let violations = 0, checked = 0;
  const base = { position_ref: 'P', deal_ref: 'D', investor_ref: 'I', period: { label: 'Q1', start_date: '2026-01-01', end_date: '2026-03-31' } };

  // bare four-digit-year citation is rejected
  checked++;
  {
    const r = compute({ ...base, duty_declarations: [{ duty_id: 'verify_credit_granting_standards', performed: true, evidence: [{ evidence_ref: 'E1' }], citation: { scheme: 'eu-regulation', id: 'X', in_force_from: '2021' } }] }).output_payload;
    const d = r.duty_results.find((x) => x.duty_id === 'verify_credit_granting_standards');
    // shipped pin still applies (citation not null); no accountability records supplied here, so the
    // trail is unsigned rather than performed -- the point under test is the citation rejection itself.
    if (r.rejected_citations.length !== 1 || d.citation === null || d.status !== 'evidence_unsigned') violations++;
  }
  // self-approval: performer === approver by identity -> flagged, not counted twice
  checked++;
  {
    const r = compute({
      ...base,
      accountability_records: [
        { duty_id: 'verify_risk_retention', role: 'performer', record_type: 'approval', identity: { id: 'same' }, audit_signature: { proof: { cryptosuite: 'eddsa-jcs-2022', verificationMethod: 'same#k1' } } },
        { duty_id: 'verify_risk_retention', role: 'approver', record_type: 'approval', identity: { id: 'same' }, audit_signature: { proof: { cryptosuite: 'eddsa-jcs-2022', verificationMethod: 'same#k1' } } },
      ],
    }).output_payload;
    if (!r.agent_parity_findings.some((f) => f.code === 'ART5_PERFORMER_IS_ALSO_APPROVER')) violations++;
  }
  // period start after period end -> order_invalid flag, dates carried unchanged
  checked++;
  {
    const r = compute({ ...base, period: { label: 'Q1', start_date: '2026-06-01', end_date: '2026-01-01' } }).output_payload;
    if (r.period.order_valid !== false) violations++;
  }
  // period bounds absent entirely -> bounds_present false
  checked++;
  {
    const r = compute({ ...base, period: { label: 'Q1' } }).output_payload;
    if (r.period.bounds_present !== false) violations++;
  }
  // empty input -> finite gate, no throw, all duties outstanding
  checked++;
  {
    const r = compute({}).output_payload;
    if (r.duty_count !== SHIPPED_DUTY_IDS.length || r.performed_count !== 0) violations++;
  }
  return { name: 'P4_forced_categorical_boundaries', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_status_differential());
results.properties.push(checkP3_unrelated_duty_append_invariance());
results.properties.push(checkP4_forced_categorical_boundaries());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-510-build-art5-diligence-evidence',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
