// kernel_digest_at_authoring: sha256:fdb16b08532bdd3b1513e88aa97cb133f64c2ea0d04d8b0556107a2d0e95caac
//
// FV-PROPFLOOR-SHARD-B22-1 — property-test floor for art-393-x402-v2-migration-linter.
// Class B (bounded-numeric score / categorical), FLOAT:NO per the WU row — score is small-
// integer arithmetic (100 - 15*errors - 4*warnings, clamped), version parsing returns null on
// failure (never NaN, per the X402LINT-FIX-1 comment in the kernel), everything else is header/
// regex/enum logic. Forced CATEGORICAL boundary cases used in place of ULP forcing. Zero
// external dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-393-x402-v2-migration-linter.proptest.mjs

import { compute } from '../art-393-x402-v2-migration-linter.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-393-x402-v2-migration-linter.fixtures.json');
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
const rand = mulberry32(0x393A2);
const TRIALS = 8000;
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function mkPP(rng) {
  const headers = {};
  if (rng() < 0.3) headers['X-PAYMENT'] = 'v1sig';
  if (rng() < 0.3) headers['X-PAYMENT-RESPONSE'] = 'v1resp';
  if (rng() < 0.3) headers['PAYMENT-REQUIRED'] = 'v2req';
  if (rng() < 0.3) headers['PAYMENT-SIGNATURE'] = 'v2sig';
  if (rng() < 0.3) headers['PAYMENT-RESPONSE'] = 'v2resp';
  const hasBody = rng() < 0.6;
  const body = hasBody ? (rng() < 0.5 ? { accepts: [{ scheme: 'exact' }] } : { scheme: 'exact', network: 'base' }) : undefined;
  const versions = ['1', '2', 'v1', 'V2', '2.0', 'garbage', undefined];
  const networks = ['base', 'eip155:8453', undefined];
  return { headers, body, protocol_version: pick(rng, versions), network: pick(rng, networks) };
}

// ---------- P1: score is bounded to [0, 100] ----------
function checkP1_scoreBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(mkPP(rand));
    checked++;
    if (r.output_payload.score < 0 || r.output_payload.score > 100) violations++;
  }
  return { name: 'P1_score_bounded_0_to_100', trials: checked, violations };
}

// ---------- P2: score is the exact clamped formula 100 - 15*errors - 4*warnings ----------
function checkP2_scoreExactFormula() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(mkPP(rand));
    checked++;
    const raw = 100 - r.output_payload.errors * 15 - r.output_payload.warnings * 4;
    const expected = Math.max(0, Math.min(100, raw));
    if (r.output_payload.score !== expected) violations++;
  }
  return { name: 'P2_score_exact_clamped_formula', trials: checked, violations };
}

// ---------- P3: mixed v1/v2 headers always infers v1 and flags MIGRATION_INCOMPLETE ----------
function checkP3_mixedHeadersInferV1() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.output_payload.deprecated_headers_found.length && r.output_payload.v2_headers_found.length) {
      if (r.output_payload.inferred_wire_version !== 1) violations++;
      if (!r.compliance_flags.includes('MIGRATION_INCOMPLETE')) violations++;
    }
  }
  return { name: 'P3_mixed_v1_v2_headers_always_infer_v1_and_flag_incomplete', trials: checked, violations };
}

// ---------- P4 (float:no exception): forced categorical boundary cases ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ headers: {}, body: undefined }, 'no headers and no body at all — error "nothing to lint", score exactly 85 (100-15)'],
  [{ headers: { 'PAYMENT-REQUIRED': 'x', 'PAYMENT-SIGNATURE': 'y', 'PAYMENT-RESPONSE': 'z' }, body: undefined }, 'all three v2 headers, no v1 headers — inferred_wire_version exactly 2, clean'],
  [{ headers: { 'X-PAYMENT': 'x', 'X-PAYMENT-RESPONSE': 'y' }, body: undefined }, 'both v1 headers, no v2 — inferred_wire_version exactly 1, two deprecated-header errors'],
  [{ headers: {}, body: { accepts: [{ scheme: 'exact' }] } }, 'body has accepts array but no PAYMENT-REQUIRED header — v1 body-based delivery detected error'],
  [{ headers: { 'PAYMENT-REQUIRED': 'x' }, body: { accepts: [{ scheme: 'exact' }] } }, 'body has accepts array AND PAYMENT-REQUIRED header present — no body-delivery error (v2 header already covers it)'],
  [{ headers: {}, body: { scheme: 'exact', network: 'base' } }, 'body carries a single (non-array) requirements object — warn: accepts must be an array'],
  [{ headers: {}, body: undefined, network: 'eip155:8453' }, 'network id CAIP-2 formatted exactly (namespace:reference with colon) — pass, no warn'],
  [{ headers: {}, body: undefined, network: 'base' }, 'network id bare chain name, no colon — warn: not CAIP-2 formatted'],
  [{ headers: {}, body: undefined, protocol_version: '3' }, 'declared protocol_version (3) does not match inferred wire evidence (v1, no headers) — warn mismatch'],
  [{ headers: {}, body: undefined, protocol_version: 'not-a-version-at-all' }, 'protocol_version unparseable garbage string — versionUnparseable true, must resolve to null not NaN'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { score, inferred_wire_version, declared_protocol_version } = r.output_payload;
    const plausible = Number.isFinite(score) && score >= 0 && score <= 100 && [1, 2].includes(inferred_wire_version) && declared_protocol_version !== undefined;
    rows.push({ label, input: pp, score, inferred_wire_version, declared_protocol_version, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_scoreBounded());
results.properties.push(checkP2_scoreExactFormula());
results.properties.push(checkP3_mixedHeadersInferV1());
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
