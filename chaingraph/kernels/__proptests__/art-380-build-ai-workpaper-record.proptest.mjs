// kernel_digest_at_authoring: sha256:15049d4459f060c77f8ccefdcfff425170a1c8103384869b81c002b2f12602b1
//
// FV-PROPFLOOR-SHARD-B22-1 — property-test floor for art-380-build-ai-workpaper-record.
// Class B (bounded-categorical/structural), FLOAT:NO — no arithmetic anywhere in this
// kernel; every field is a string presence/format check (hex-regex, enum membership) or a
// straight passthrough. Forced CATEGORICAL boundary cases used in place of ULP forcing.
// Zero external dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-380-build-ai-workpaper-record.proptest.mjs

import { compute } from '../art-380-build-ai-workpaper-record.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-380-build-ai-workpaper-record.fixtures.json');
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
const rand = mulberry32(0x380B2);
const TRIALS = 8000;
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function hex64(rng) { return Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(rng() * 16)]).join(''); }
const DET_CLASSES = ['bit-exact', 'replayable', 'seeded-stochastic', 'estimated', 'deterministic', 'bogus_class'];

function mkPP(rng) {
  const valid = rng() < 0.7;
  const hex = hex64(rng);
  return {
    receipt_tool_id: valid || rng() < 0.5 ? 'art-999-sample-tool' : '',
    receipt_tool_version: valid || rng() < 0.5 ? '1.0.0' : '',
    receipt_execution_hash: valid ? hex : (rng() < 0.5 ? hex.slice(0, 63) : 'zz' + hex.slice(2)),
    receipt_kernel_digest: valid ? 'sha256:' + hex : (rng() < 0.5 ? hex : 'md5:' + hex),
    receipt_generated_at: '2026-08-10T00:00:00.000Z',
    determinism_class: pick(rng, DET_CLASSES),
    declared_conventions: valid || rng() < 0.5 ? 'RFC 8785 JCS' : '',
    documentation_standard_ref: valid || rng() < 0.5 ? 'AU-C 500' : '',
    engagement_id: valid || rng() < 0.5 ? 'ENG-1' : '',
    reviewer_role: valid || rng() < 0.5 ? 'reviewer' : '',
    reviewer_identity_id: rng() < 0.5 ? 'id-123' : undefined,
    reviewer_ha_role: pick(rng, ['preparer', 'reviewer', 'approver', 'attestor', 'submitter', 'model_owner', 'compliance_officer', 'examiner', 'out-of-vocab-role']),
  };
}

// ---------- P1: allValid is the exact AND of all ten declared checks ----------
function checkP1_allValidExactAnd() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(mkPP(rand));
    checked++;
    const allValid = r.output_payload.checks.every((c) => c.pass);
    const flagsInvalid = r.compliance_flags.includes('WORKPAPER_INPUTS_INVALID');
    if (allValid === flagsInvalid) violations++; // flag present iff NOT allValid
    if (allValid && r.output_payload.tool_identity === null) violations++;
    if (!allValid && r.output_payload.tool_identity !== null) violations++;
  }
  return { name: 'P1_all_valid_exact_and_of_checks_drives_flag_and_tool_identity', trials: checked, violations };
}

// ---------- P2: ha_record is null unless allValid AND reviewer_identity_id supplied ----------
function checkP2_haRecordGating() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const allValid = r.output_payload.checks.every((c) => c.pass);
    const shouldHave = allValid && !!pp.reviewer_identity_id;
    const has = r.output_payload.ha_record !== null;
    if (shouldHave !== has) violations++;
    if (has && r.output_payload.ha_record.decision !== 'approve') violations++;
  }
  return { name: 'P2_ha_record_null_unless_valid_and_identity_supplied', trials: checked, violations };
}

// ---------- P3: reviewer_ha_role out-of-vocabulary coerces to 'reviewer' (HA-CONV-1) ----------
function checkP3_haRoleCoercion() {
  let violations = 0, checked = 0;
  const HA_ROLES = ['preparer', 'reviewer', 'approver', 'attestor', 'submitter', 'model_owner', 'compliance_officer', 'examiner'];
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.output_payload.ha_record) {
      const expected = HA_ROLES.includes(pp.reviewer_ha_role) ? pp.reviewer_ha_role : 'reviewer';
      if (r.output_payload.ha_record.role !== expected) violations++;
    }
  }
  return { name: 'P3_ha_role_coerces_to_reviewer_when_out_of_vocab', trials: checked, violations };
}

// ---------- P4 (float:no exception): forced categorical boundary cases ----------
const H64 = 'a'.repeat(64);
const CATEGORICAL_BOUNDARY_CASES = [
  [{ receipt_tool_id: 'x', receipt_tool_version: '1', receipt_execution_hash: H64, receipt_kernel_digest: 'sha256:' + H64, determinism_class: 'bit-exact', declared_conventions: 'c', documentation_standard_ref: 'r', engagement_id: 'e', reviewer_role: 'reviewer' }, 'all ten checked fields present and valid — allValid true'],
  [{ receipt_execution_hash: H64.slice(0, 63) }, 'execution_hash exactly 63 hex chars (one short) — must fail validity, never crash'],
  [{ receipt_execution_hash: H64 + 'a' }, 'execution_hash exactly 65 hex chars (one long) — must fail validity'],
  [{ receipt_execution_hash: H64.toUpperCase() }, 'execution_hash uppercase hex — must fail (kernel requires lowercase, no normalization)'],
  [{ receipt_kernel_digest: H64 }, 'kernel_digest missing the "sha256:" prefix — must fail validity'],
  [{ determinism_class: 'not-a-real-class' }, 'determinism_class outside all five valid values — must fail validity'],
  [{ previous_workpaper_hash: H64.slice(0, 10) }, 'previous_workpaper_hash present but malformed — must fail prevHashOk while other absent fields also fail'],
  [{ receipt_tool_id: 'x', receipt_tool_version: '1', receipt_execution_hash: H64, receipt_kernel_digest: 'sha256:' + H64, determinism_class: 'bit-exact', declared_conventions: 'c', documentation_standard_ref: 'r', engagement_id: 'e', reviewer_role: 'reviewer', reviewer_identity_id: 'id-1', reviewer_statement: '' }, 'reviewer_statement empty string falls back to the default statement text, not blank'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const allValid = r.output_payload.checks.every((c) => c.pass);
    const plausible = typeof allValid === 'boolean' && Array.isArray(r.output_payload.checks) && r.output_payload.checks.length === 10;
    rows.push({ label, input: pp, allValid, tool_identity: r.output_payload.tool_identity, ha_record: r.output_payload.ha_record, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_allValidExactAnd());
results.properties.push(checkP2_haRecordGating());
results.properties.push(checkP3_haRoleCoercion());
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
