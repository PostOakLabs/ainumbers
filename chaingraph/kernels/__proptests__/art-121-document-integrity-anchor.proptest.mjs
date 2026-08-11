// kernel_digest_at_authoring: sha256:7f6d0e49c1eeb8c26e4d0453f504f575f36b4547315236e2d5796bea05076cb0
//
// FV-PROPFLOOR-SHARD-B2-1 — property-test floor for art-121-document-integrity-anchor.
// Class B (bounded categorical), float:no exception per the WU row — regex/string-presence
// logic only, no continuous arithmetic. Forced categorical boundary cases used in place of
// ULP forcing per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG
// + explicit boundary arrays), same shape as the B1 pilot harness. This file is READ-ONLY
// with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-121-document-integrity-anchor.proptest.mjs

import { compute } from '../art-121-document-integrity-anchor.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-121-document-integrity-anchor.fixtures.json');
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
const rand = mulberry32(0x12101);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const TRIALS = 10000;
const VALID_HASH = 'sha256:' + '0123456789abcdef'.repeat(4);
const BAD_HASHES = ['not-a-hash', '', 'sha256:short', 'sha256:' + 'G'.repeat(64), 'SHA256:' + '0'.repeat(64)];
const TIMESTAMPS = ['2026-06-25T10:00:00Z', '', null];
const DOC_TYPES = ['contract', 'invoice', null, 'anything'];

function mkPP(rng) {
  return {
    document_hash: pick(rng, [VALID_HASH, ...BAD_HASHES]),
    claimed_timestamp: pick(rng, TIMESTAMPS),
    hash_algorithm: 'sha256',
    document_type: pick(rng, DOC_TYPES),
  };
}

// ---------- P1: boundedness — anchored equals exact conjunction of hash_well_formed and ts_present ----------
function checkP1_anchoredAgreement() {
  let violations = 0, checked = 0;
  const hashRe = /^sha256:[0-9a-f]{64}$/;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const hashOk = typeof pp.document_hash === 'string' && hashRe.test(pp.document_hash);
    const tsOk = typeof pp.claimed_timestamp === 'string' && pp.claimed_timestamp.length > 0;
    if (r.output_payload.anchored !== (hashOk && tsOk)) violations++;
  }
  return { name: 'P1_anchored_equals_conjunction_of_hash_and_timestamp', trials: checked, violations };
}

// ---------- P2: metamorphic — document_type never affects anchored/hash_well_formed/ts_present ----------
function checkP2_documentTypeIndependence() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r1 = compute({ ...pp, document_type: 'contract' });
    const r2 = compute({ ...pp, document_type: 'wholly_unrelated_type_xyz' });
    checked++;
    if (r1.output_payload.anchored !== r2.output_payload.anchored) violations++;
    if (r1.output_payload.document_hash !== r2.output_payload.document_hash) violations++;
  }
  return { name: 'P2_anchored_independent_of_document_type', trials: checked, violations };
}

// ---------- P3: categorical threshold agreement — compliance_flags mirror the boolean outputs exactly ----------
function checkP3_flagsAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { anchored } = r.output_payload;
    const hashOk = typeof pp.document_hash === 'string' && /^sha256:[0-9a-f]{64}$/.test(pp.document_hash);
    const tsOk = typeof pp.claimed_timestamp === 'string' && pp.claimed_timestamp.length > 0;
    if (anchored && !r.compliance_flags.includes('DOCUMENT_ANCHORED')) violations++;
    if (!hashOk && !r.compliance_flags.includes('MALFORMED_DOCUMENT_HASH')) violations++;
    if (!tsOk && !r.compliance_flags.includes('MISSING_TIMESTAMP')) violations++;
  }
  return { name: 'P3_compliance_flags_mirror_boolean_outputs', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applicable) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [VALID_HASH, '2026-06-25T10:00:00Z', 'contract', 'well-formed 64-hex-char hash + present timestamp — must be anchored true'],
  ['sha256:' + '0'.repeat(63), '2026-06-25T10:00:00Z', 'x', '63 hex chars (1 short of 64) — hash_well_formed must be false'],
  ['sha256:' + '0'.repeat(65), '2026-06-25T10:00:00Z', 'x', '65 hex chars (1 over 64) — hash_well_formed must be false'],
  ['SHA256:' + '0'.repeat(64), '2026-06-25T10:00:00Z', 'x', 'uppercase algorithm prefix — regex is case-sensitive, hash_well_formed must be false'],
  [VALID_HASH, '', 'x', 'empty-string timestamp — ts_present must be false, anchored false'],
  [VALID_HASH, null, 'x', 'null timestamp — ts_present must be false, not throw'],
  [null, '2026-06-25T10:00:00Z', 'x', 'null document_hash — hash_well_formed must be false, not throw'],
];

function checkP4_forced() {
  const rows = [];
  for (const [document_hash, claimed_timestamp, document_type, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute({ document_hash, claimed_timestamp, hash_algorithm: 'sha256', document_type });
    const { anchored } = r.output_payload;
    const plausible = typeof anchored === 'boolean';
    rows.push({ label, document_hash, claimed_timestamp, anchored, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_anchoredAgreement());
results.properties.push(checkP2_documentTypeIndependence());
results.properties.push(checkP3_flagsAgreement());
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
