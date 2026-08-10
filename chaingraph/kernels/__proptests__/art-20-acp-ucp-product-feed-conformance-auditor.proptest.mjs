// art-20-acp-ucp-product-feed-conformance-auditor.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C6-1).
// kernel_digest_at_authoring: sha256:6fcabf3a24030e00fb8df1723c7c77039066139306f2100a0bb8a97b53eb07c8
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (conformance_scores use Math.round on an integer ratio*100; no threshold
// comparison against a fractional boundary — confirmed by direct read of calcScore()).
// Checks: fixture-oracle gate, termination (field-audit loops bounded by the FIXED schema arrays,
// never by caller input size), boundedness (scores in [0,100], gap/warning counts bounded by
// schema field count), differential re-derivation of verdict from critical_gaps/warnings_count,
// and metamorphic irrelevant-field invariance (extra unrelated keys on the payload never change
// the audit result, since auditFields only reads the fixed field list).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-20-acp-ucp-product-feed-conformance-auditor.proptest.mjs

import { compute } from '../art-20-acp-ucp-product-feed-conformance-auditor.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-20-acp-ucp-product-feed-conformance-auditor.fixtures.json');
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
const rand = mulberry32(0x200A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

// Field names for each schema — mirrors kernel's private tables (max 10 fields).
const PRODUCT_FIELDS = ['product_id', 'name', 'price', 'currency', 'description', 'image_url', 'quantity', 'merchant_id', 'category', 'ap2_version'];
const CHECKOUT_FIELDS = ['cart_id', 'merchant_id', 'total', 'currency', 'items', 'agent_id', 'mandate_type', 'return_url', 'signature', 'expiry'];
const PAYLOAD_TYPES = ['product', 'checkout', 'mandate'];
const TARGETS = ['acp', 'ucp', 'both'];

function randomObj(rng, fieldPool) {
  const obj = {};
  for (const f of fieldPool) {
    if (rng() < 0.6) {
      const r = rng();
      obj[f] = r < 0.5 ? `val-${Math.floor(rng() * 1000)}` : r < 0.75 ? Math.floor(rng() * 1000) : [1, 2];
    }
  }
  return obj;
}

const TRIALS = 5000;

// ---------- P1: termination — audit result count bounded by the FIXED schema, never by obj size ----------
function checkP1_termination_bounded_by_schema() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const payload_type = pick(rand, PAYLOAD_TYPES);
    const audit_target = pick(rand, TARGETS);
    const fieldPool = payload_type === 'product' ? PRODUCT_FIELDS : CHECKOUT_FIELDS.concat(['extra1', 'extra2', 'extra3']); // extra keys never audited
    const obj = randomObj(rand, fieldPool);
    const { output_payload } = compute({ payload: obj, payload_type, audit_target });
    checked++;
    const acpN = output_payload.acp_missing_required.length;
    const ucpN = output_payload.ucp_missing_required.length;
    if (acpN > 10 || ucpN > 10) violations++;
    if (output_payload.critical_gaps > 20 || output_payload.warnings > 20) violations++;
  }
  return { name: 'P1_termination_bounded_by_fixed_schema', trials: checked, violations };
}

// ---------- P2 (differential): verdict re-derivation from critical_gaps/warnings ----------
function checkP2_verdict_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const payload_type = pick(rand, PAYLOAD_TYPES);
    const audit_target = pick(rand, TARGETS);
    const obj = randomObj(rand, PRODUCT_FIELDS);
    const { output_payload } = compute({ payload: obj, payload_type, audit_target });
    checked++;
    const expected = output_payload.critical_gaps > 0 ? 'non_conformant'
      : output_payload.warnings > 0 ? 'conformant_with_warnings' : 'conformant';
    if (output_payload.verdict !== expected) violations++;
  }
  return { name: 'P2_verdict_differential', trials: checked, violations };
}

// ---------- P3: boundedness — conformance_scores in [0,100] ----------
function checkP3_scores_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const payload_type = pick(rand, PAYLOAD_TYPES);
    const audit_target = pick(rand, TARGETS);
    const obj = randomObj(rand, PRODUCT_FIELDS);
    const { output_payload } = compute({ payload: obj, payload_type, audit_target });
    checked++;
    for (const key of ['acp', 'ucp']) {
      const v = output_payload.conformance_scores[key];
      if (v !== null && (v < 0 || v > 100 || !Number.isInteger(v))) violations++;
    }
  }
  return { name: 'P3_conformance_scores_bounded_0_100_integer', trials: checked, violations };
}

// ---------- P4: metamorphic — irrelevant extra fields never change the audit result ----------
function checkP4_extra_field_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const payload_type = pick(rand, PAYLOAD_TYPES);
    const audit_target = pick(rand, TARGETS);
    const obj = randomObj(rand, PRODUCT_FIELDS);
    const extended = { ...obj, __irrelevant_a: 'x', __irrelevant_b: 12345, __irrelevant_c: [1, 2, 3] };
    const r1 = compute({ payload: obj, payload_type, audit_target }).output_payload;
    const r2 = compute({ payload: extended, payload_type, audit_target }).output_payload;
    checked++;
    if (JSON.stringify(r1) !== JSON.stringify(r2)) violations++;
  }
  return { name: 'P4_irrelevant_field_invariance', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_bounded_by_schema());
results.properties.push(checkP2_verdict_differential());
results.properties.push(checkP3_scores_bounded());
results.properties.push(checkP4_extra_field_invariance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-20-acp-ucp-product-feed-conformance-auditor',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
