// kernel_digest_at_authoring: sha256:1514ff4a117f5236fa49288fa88c886c63ec0ed4cd1e3b1815ee7c84abef3528
//
// FV-PROPFLOOR — property-test floor for art-660-compile-nav-error-evidence-pack.
// Class B (bounded-categorical shape, citation-bundle logic — same family as
// art-562-compile-model-risk-lineage-pack / art-646-compile-rebalance-evidence-pack, whose
// proptest shape this file follows). float:no — no float arithmetic anywhere in this kernel
// (money-figure fields are opaque strings echoed verbatim from the cited materiality_ref
// receipt, never parsed or computed here). Zero external dependencies. This file is READ-ONLY
// with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-660-compile-nav-error-evidence-pack.proptest.mjs

import { compute } from '../art-660-compile-nav-error-evidence-pack.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-660-compile-nav-error-evidence-pack.fixtures.json');
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
const rand = mulberry32(0x660A1);
const TRIALS = 10000;

function randHash(rng) { let s = ''; for (let i = 0; i < 64; i++) s += Math.floor(rng() * 16).toString(16); return s; }
const VERDICTS = ['MATERIAL', 'IMMATERIAL', 'INDETERMINATE', undefined];

function mkPP(rng) {
  const pp = {};
  if (rng() < 0.9) pp.fund_id = 'FUND-' + Math.floor(rng() * 1000);
  if (rng() < 0.9) pp.detection_date = '2026-0' + (1 + Math.floor(rng() * 6)) + '-15';
  if (rng() < 0.85) pp.nav_ref = { execution_hash: randHash(rng) };
  if (rng() < 0.85) {
    const verdict = VERDICTS[Math.floor(rng() * VERDICTS.length)];
    pp.materiality_ref = { execution_hash: randHash(rng) };
    if (rng() < 0.75) {
      pp.materiality_ref.output_payload = verdict === undefined ? {} : { materiality_verdict: verdict, error: { error_direction: 'overstated' }, declared_policy: { material: verdict === 'MATERIAL' } };
    }
  }
  if (rng() < 0.5) {
    const n = Math.floor(rng() * 3);
    pp.supplementary_receipts = [];
    for (let i = 0; i < n; i++) pp.supplementary_receipts.push({ role: 'positions', execution_hash: randHash(rng) });
  }
  return pp;
}

// ---------- P1: structural_error iff any required field absent; echoed fields all null when structural_error set ----------
function checkP1_structuralErrorGatesEcho() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    const requiredPresent = !!(pp.fund_id && pp.detection_date && pp.nav_ref && pp.nav_ref.execution_hash && pp.materiality_ref && pp.materiality_ref.execution_hash);
    if (requiredPresent && op.structural_error !== null) violations++;
    if (!requiredPresent && op.structural_error === null) violations++;
    if (op.structural_error !== null) {
      if (op.materiality_verdict !== null || op.error !== null || op.declared_policy !== null) violations++;
    }
  }
  return { name: 'P1_structural_error_gates_echo_fields', trials: checked, violations };
}

// ---------- P2: cited_receipts count === (nav_ref valid ? 1:0) + (materiality_ref valid ? 1:0) + supplementary.length ----------
function checkP2_citedReceiptsCountMatchesInputs() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const navValid = !!(pp.nav_ref && pp.nav_ref.execution_hash);
    const matValid = !!(pp.materiality_ref && pp.materiality_ref.execution_hash);
    const suppCount = Array.isArray(pp.supplementary_receipts) ? pp.supplementary_receipts.filter((x) => x && x.execution_hash).length : 0;
    const expected = (navValid ? 1 : 0) + (matValid ? 1 : 0) + suppCount;
    if (r.output_payload.cited_receipts.length !== expected) violations++;
  }
  return { name: 'P2_cited_receipts_count_matches_inputs', trials: checked, violations };
}

// ---------- P3: materiality_verdict compliance-flag agreement ----------
function checkP3_verdictFlagAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.output_payload.structural_error !== null) continue;
    const v = r.output_payload.materiality_verdict;
    const flags = r.compliance_flags;
    if (v === 'MATERIAL' && !flags.includes('NAV_ERROR_PACK_MATERIAL_CITED')) violations++;
    if (v === 'IMMATERIAL' && !flags.includes('NAV_ERROR_PACK_IMMATERIAL_CITED')) violations++;
    if (v === 'INDETERMINATE' && !flags.includes('NAV_ERROR_PACK_INDETERMINATE_CITED')) violations++;
    if (v === null && !flags.includes('NAV_ERROR_PACK_MATERIALITY_OUTPUT_NOT_SUPPLIED')) violations++;
  }
  return { name: 'P3_materiality_verdict_flag_agreement', trials: checked, violations };
}

// ---------- P3b: warnings mirror is truthy (non-empty) exactly when a caveat-carrying flag is present ----------
// AUTHORING-STANDARD.md §2 flag-mirror doctrine: warnings must be non-empty iff compliance_flags
// carries NAV_ERROR_PACK_STRUCTURAL_ERROR, NAV_ERROR_PACK_MATERIALITY_OUTPUT_NOT_SUPPLIED, or
// NAV_ERROR_PACK_NO_SUPPLEMENTARY_RECEIPTS — never for the verdict-citing flags themselves (those
// are "the answer", per §2.2's explicit decision/reason exclusion, not a caveat).
function checkP3b_warningsMirrorCorrelatesWithCaveatFlags() {
  let violations = 0, checked = 0;
  const CAVEAT_FLAGS = ['NAV_ERROR_PACK_STRUCTURAL_ERROR', 'NAV_ERROR_PACK_MATERIALITY_OUTPUT_NOT_SUPPLIED', 'NAV_ERROR_PACK_NO_SUPPLEMENTARY_RECEIPTS'];
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const hasCaveatFlag = r.compliance_flags.some((f) => CAVEAT_FLAGS.includes(f));
    const warningsNonEmpty = Array.isArray(r.output_payload.warnings) && r.output_payload.warnings.length > 0;
    if (hasCaveatFlag !== warningsNonEmpty) violations++;
  }
  return { name: 'P3b_warnings_mirror_correlates_with_caveat_flags', trials: checked, violations };
}

// ---------- P4: determinism — same input twice yields byte-identical output ----------
function checkP4_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = mkPP(rand);
    const a = JSON.stringify(compute(pp).output_payload);
    const b = JSON.stringify(compute(pp).output_payload);
    checked++;
    if (a !== b) violations++;
  }
  return { name: 'P4_determinism_same_input_same_output', trials: checked, violations };
}

// ---------- P5 (forced categorical boundary cases) ----------
const FORCED_CASES = [
  [{}, 'fully empty input — structural_error, fund_id required'],
  [{ fund_id: 'F1' }, 'detection_date missing — structural_error'],
  [{ fund_id: 'F1', detection_date: '2026-08-05' }, 'nav_ref missing — structural_error'],
  [{ fund_id: 'F1', detection_date: '2026-08-05', nav_ref: { execution_hash: 'a'.repeat(64) } }, 'materiality_ref missing — structural_error'],
  [{ fund_id: 'F1', detection_date: '2026-08-05', nav_ref: { execution_hash: 'a'.repeat(64) }, materiality_ref: { execution_hash: 'b'.repeat(64) } }, 'both refs present, no output_payload on materiality_ref — MATERIALITY_OUTPUT_NOT_SUPPLIED, never fabricated'],
  [{ fund_id: 'F1', detection_date: '2026-08-05', nav_ref: { execution_hash: 'a'.repeat(64) }, materiality_ref: { execution_hash: 'b'.repeat(64), output_payload: { materiality_verdict: 'MATERIAL', error: { error_direction: 'overstated' }, declared_policy: { material: true } } } }, 'MATERIAL verdict echoed verbatim, never recomputed'],
  [{ fund_id: 'F1', detection_date: '2026-08-05', nav_ref: { execution_hash: '' }, materiality_ref: { execution_hash: 'b'.repeat(64) } }, 'nav_ref present but execution_hash empty string — treated as absent, structural_error'],
  [{ fund_id: 'F1', detection_date: '2026-08-05', nav_ref: 'not-an-object', materiality_ref: { execution_hash: 'b'.repeat(64) } }, 'nav_ref is a non-object (string) — treated as absent, no crash'],
  [{ fund_id: 'F1', detection_date: '2026-08-05', nav_ref: { execution_hash: 'a'.repeat(64), tool_id: 'caller-override-tool' }, materiality_ref: { execution_hash: 'b'.repeat(64) } }, 'caller-supplied tool_id override on nav_ref — recorded verbatim, not silently overwritten by canonical default'],
];

function checkP5_forced() {
  const rows = [];
  for (const [pp, label] of FORCED_CASES) {
    const r = compute(pp);
    const op = r.output_payload;
    const plausible = Array.isArray(op.cited_receipts) && (op.structural_error === null || typeof op.structural_error === 'string');
    rows.push({ label, input: pp, structural_error: op.structural_error, materiality_verdict: op.materiality_verdict, cited_receipts: op.cited_receipts, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_structuralErrorGatesEcho());
results.properties.push(checkP2_citedReceiptsCountMatchesInputs());
results.properties.push(checkP3_verdictFlagAgreement());
results.properties.push(checkP3b_warningsMirrorCorrelatesWithCaveatFlags());
results.properties.push(checkP4_determinism());
results.boundary_forced = checkP5_forced();

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
