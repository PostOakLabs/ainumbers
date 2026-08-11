// kernel_digest_at_authoring: sha256:a003fc6cc8dfa80d68668f62938102ca8f06da330407616dc9d04f146303706e
//
// FV-PROPFLOOR-SHARD-B27-1 — property-test floor for art-242-pacs008-party-completeness-validator.
// Class B (bounded-numeric shape, format/presence validation logic). float:no — cpmi_d218_score is
// an integer percentage (round(present/5*100)) over discrete presence checks, no continuous float
// threshold; forced categorical boundary cases stand in for ULP-forcing per spec §3. Zero external
// dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-242-pacs008-party-completeness-validator.proptest.mjs

import { compute } from '../art-242-pacs008-party-completeness-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-242-pacs008-party-completeness-validator.fixtures.json');
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
const rand = mulberry32(0x242A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randHex(rng, len) { let s = ''; for (let i = 0; i < len; i++) s += Math.floor(rng() * 16).toString(16); return s; }
const TRIALS = 10000;

function uuidv4(rng) {
  return `${randHex(rng, 8)}-${randHex(rng, 4)}-4${randHex(rng, 3)}-${pick(rng, ['8', '9', 'a', 'b'])}${randHex(rng, 3)}-${randHex(rng, 12)}`;
}

function mkPP(rng) {
  const present = rng() < 0.9;
  return {
    uetr: present ? (rng() < 0.85 ? uuidv4(rng) : randHex(rng, 20)) : '',
    debtor_name: rng() < 0.9 ? 'Debtor ' + Math.floor(rng() * 100) : '',
    creditor_name: rng() < 0.9 ? 'Creditor ' + Math.floor(rng() * 100) : '',
    debtor_agent_bic: rng() < 0.8 ? pick(rng, ['DEUTDEFFXXX', 'BARCGB22', 'CHASUS33']) : '',
    creditor_agent_bic: rng() < 0.8 ? pick(rng, ['DEUTDEFFXXX', 'BARCGB22']) : '',
    debtor_lei: rng() < 0.5 ? randHex(rng, 20).toUpperCase() : '',
    creditor_lei: rng() < 0.5 ? randHex(rng, 20).toUpperCase() : '',
    purpose_code: rng() < 0.7 ? pick(rng, ['TRAD', 'SALA', 'GDDS']) : '',
  };
}

// ---------- P1: boundedness — cpmi_d218_score in [0,100]; compliant === (error_count===0) ----------
function checkP1_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    if (op.cpmi_d218_score < 0 || op.cpmi_d218_score > 100) violations++;
    if (op.compliant !== (op.error_count === 0)) violations++;
  }
  return { name: 'P1_score_bounded_and_compliant_agrees_with_error_count', trials: checked, violations };
}

// ---------- P2: fixed rule — cpmi_d218_score recomputes exactly as round(present/5*100) over the 5 CPMI fields ----------
function checkP2_scoreExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const fs = r.output_payload.field_status;
    const present = [fs.uetr.present, fs.debtor_name.present, fs.creditor_name.present, fs.debtor_agent_bic.present, fs.creditor_agent_bic.present].filter(Boolean).length;
    const expected = Math.round(present / 5 * 100);
    if (r.output_payload.cpmi_d218_score !== expected) violations++;
  }
  return { name: 'P2_cpmi_score_exact_recompute', trials: checked, violations };
}

// ---------- P3: metamorphic — a well-formed UUIDv4 always validates; any single hex-nibble corruption of the version position always invalidates ----------
function checkP3_uuidMetamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const uuid = uuidv4(rand);
    const rGood = compute({ uetr: uuid, debtor_name: 'A', creditor_name: 'B', debtor_agent_bic: '', creditor_agent_bic: '' });
    const corrupted = uuid.slice(0, 14) + '9' + uuid.slice(15); // flip version nibble away from '4'
    const rBad = compute({ uetr: corrupted, debtor_name: 'A', creditor_name: 'B', debtor_agent_bic: '', creditor_agent_bic: '' });
    checked++;
    if (!rGood.output_payload.field_status.uetr.valid) violations++;
    if (rBad.output_payload.field_status.uetr.valid) violations++;
  }
  return { name: 'P3_uuid_version_nibble_corruption_always_invalidates', trials: checked, violations };
}

// ---------- P4 (forced categorical boundary cases) ----------
const FORCED_CASES = [
  [{}, 'fully empty input — score 0, multiple ERROR/WARNING issues, non-compliant'],
  [{ uetr: '550e8400-e29b-41d4-a716-446655440000', debtor_name: 'A', creditor_name: 'B', debtor_agent_bic: 'DEUTDEFFXXX', creditor_agent_bic: 'BARCGB22', debtor_lei: '00000000000000000001', creditor_lei: '00000000000000000001', purpose_code: 'TRAD' }, 'every field present and well-formed — 100% score, fully compliant'],
  [{ uetr: '550e8400-e29b-31d4-a716-446655440000', debtor_name: 'A', creditor_name: 'B' }, 'UUID with version nibble 3 instead of 4 — UETR_NOT_UUIDV4 error'],
  [{ uetr: '550e8400e29b41d4a716446655440000', debtor_name: 'A', creditor_name: 'B' }, 'UUID missing all hyphens — UETR_NOT_UUIDV4 error, not a crash'],
  [{ uetr: '550e8400-e29b-41d4-a716-446655440000', debtor_name: 'A', creditor_name: 'B', debtor_agent_bic: 'DEUTDEFF' }, 'BIC exactly 8 chars (no optional branch suffix) — valid ISO 9362 8-char form'],
  [{ uetr: '550e8400-e29b-41d4-a716-446655440000', debtor_name: 'A', creditor_name: 'B', debtor_agent_bic: 'DEUT12FFXXX' }, 'BIC with digits in the bank-code letters position — DEBTOR_BIC_INVALID_FORMAT'],
  [{ uetr: '550e8400-e29b-41d4-a716-446655440000', debtor_name: 'A', creditor_name: 'B', debtor_lei: '0000000000000000000' }, 'LEI 19 chars (one short of 20) — DEBTOR_LEI_FORMAT_INVALID'],
  [{ uetr: '550e8400-e29b-41d4-a716-446655440000', debtor_name: 'A', creditor_name: 'B', purpose_code: 'TR' }, 'purpose_code 2 chars instead of 4 — PURPOSE_CODE_FORMAT_INVALID warning'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of FORCED_CASES) {
    const r = compute(pp);
    const op = r.output_payload;
    const plausible = op.cpmi_d218_score >= 0 && op.cpmi_d218_score <= 100 && typeof op.compliant === 'boolean';
    rows.push({ label, input: pp, compliant: op.compliant, cpmi_d218_score: op.cpmi_d218_score, error_count: op.error_count, issues: op.issues.map((v) => v.code), plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_boundedness());
results.properties.push(checkP2_scoreExact());
results.properties.push(checkP3_uuidMetamorphic());
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
