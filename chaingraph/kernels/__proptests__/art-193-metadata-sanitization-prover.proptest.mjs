// art-193-metadata-sanitization-prover.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C5-1).
// kernel_digest_at_authoring: sha256:2d8ae35efdc10161078c887a54e33ac94a5faba77d639714ebe390c32a9759b0
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO — CORRECTED from the WU row's initial table (which listed float:yes for this
// kernel). Direct source read confirms `bytes_before`/`bytes_after` are carried through via
// `finiteOrNull()` unmodified (no arithmetic, no comparison against any threshold) and every
// decision (verdict, residual risks) is driven by hex-digest equality, string category/action enum
// membership, and array-length counting — no float comparison exists anywhere. Categorical (not
// ULP) boundary forcing is used instead.
// Checks: fixture-oracle gate, termination (findings-processing loop bounded by findings.length),
// boundedness (counts.total === removed+redacted+retained, always), differential re-derivation of
// `verdict` from file_type/retained.length, metamorphic (permuting the order of the findings array
// leaves counts and verdict unchanged — order-invariance of the classification), and forced
// categorical boundary cases across all FILE_TYPES and the identical-digest-despite-findings edge.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-193-metadata-sanitization-prover.proptest.mjs

import { compute } from '../art-193-metadata-sanitization-prover.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-193-metadata-sanitization-prover.fixtures.json');
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
const rand = mulberry32(0x193A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randHex64(rng) { let s = ''; for (let i = 0; i < 64; i++) s += Math.floor(rng() * 16).toString(16); return s; }

const CATEGORIES = ['gps', 'author', 'device', 'timestamp', 'software', 'comment', 'other'];
const ACTIONS = ['removed', 'redacted', 'retained'];
const FILE_TYPES = ['jpeg', 'png', 'pdf', 'docx', 'generic'];

function randomFindings(rng, n) {
  return Array.from({ length: n }, (_, i) => ({ field: 'field_' + i, category: pick(rng, CATEGORIES), action: pick(rng, ACTIONS) }));
}

const TRIALS = 5000;

// ---------- P1: termination — findings-processing bounded by findings.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 15);
    const findings = randomFindings(rand, n);
    const file_type = pick(rand, FILE_TYPES);
    const { output_payload } = compute({ file_type, original_sha256: randHex64(rand), sanitized_sha256: randHex64(rand), findings });
    checked++;
    const { counts } = output_payload.sanitization_record;
    if (counts.total !== n) violations++;
    if (output_payload.residual_risks.length > n + 3) violations++; // findings-derived + at most 3 file-type-derived
  }
  return { name: 'P1_termination_bounded_by_findings_length', trials: checked, violations };
}

// ---------- P2 (differential): counts sum correctly; verdict re-derivation ----------
function checkP2_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 15);
    const findings = randomFindings(rand, n);
    const file_type = pick(rand, FILE_TYPES);
    const { output_payload } = compute({ file_type, original_sha256: randHex64(rand), sanitized_sha256: randHex64(rand), findings });
    checked++;
    const { counts } = output_payload.sanitization_record;
    if (counts.removed + counts.redacted + counts.retained !== counts.total) violations++;
    let expectedVerdict;
    if (file_type === 'pdf' || file_type === 'docx') expectedVerdict = 'not_verifiable';
    else if (counts.retained > 0) expectedVerdict = 'partially_sanitized';
    else expectedVerdict = 'sanitized';
    if (output_payload.verdict !== expectedVerdict) violations++;
  }
  return { name: 'P2_counts_and_verdict_differential', trials: checked, violations };
}

// ---------- P3: metamorphic — permuting findings order leaves counts/verdict unchanged ----------
function checkP3_metamorphic_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const n = 1 + Math.floor(rand() * 10);
    const findings = randomFindings(rand, n);
    const shuffled = [...findings];
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    const file_type = pick(rand, FILE_TYPES);
    const r1 = compute({ file_type, original_sha256: randHex64(rand), sanitized_sha256: randHex64(rand), findings }).output_payload;
    const r2 = compute({ file_type, original_sha256: r1.sanitization_record.original_sha256, sanitized_sha256: r1.sanitization_record.sanitized_sha256, findings: shuffled }).output_payload;
    checked++;
    if (JSON.stringify(r1.sanitization_record.counts) !== JSON.stringify(r2.sanitization_record.counts)) violations++;
    if (r1.verdict !== r2.verdict) violations++;
  }
  return { name: 'P3_metamorphic_permutation_invariance', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases across all FILE_TYPES + identical-digest edge ----------
function checkP4_forced() {
  const cases = FILE_TYPES.map((ft) => ({
    label: `file_type=${ft}, zero findings -> verdict per type`,
    pp: { file_type: ft, original_sha256: 'a'.repeat(64), sanitized_sha256: 'a'.repeat(64), findings: [] },
  }));
  cases.push({
    label: 'identical original/sanitized digest with findings present -> residual risk flagged',
    pp: { file_type: 'generic', original_sha256: 'b'.repeat(64), sanitized_sha256: 'b'.repeat(64), findings: [{ field: 'x', category: 'gps', action: 'removed' }] },
  });
  return cases.map((c) => {
    const { output_payload } = compute(c.pp);
    return { label: c.label, verdict: output_payload.verdict, residual_risks: output_payload.residual_risks };
  });
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_differential());
results.properties.push(checkP3_metamorphic_permutation_invariance());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const [jpeg, png, pdf, docx, generic, identicalDigest] = results.boundary_forced;
const jpegSanitized = jpeg.verdict === 'sanitized';
const pngSanitized = png.verdict === 'sanitized';
const pdfNotVerifiable = pdf.verdict === 'not_verifiable';
const docxNotVerifiable = docx.verdict === 'not_verifiable';
const genericSanitized = generic.verdict === 'sanitized';
const identicalDigestFlagged = identicalDigest.residual_risks.some((r) => r.includes('identical'));
const anyBoundaryMismatch = !(jpegSanitized && pngSanitized && pdfNotVerifiable && docxNotVerifiable && genericSanitized && identicalDigestFlagged);

console.log(JSON.stringify({
  tool_id: 'art-193-metadata-sanitization-prover',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_mismatch: anyBoundaryMismatch,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryMismatch ? 1 : 0);
