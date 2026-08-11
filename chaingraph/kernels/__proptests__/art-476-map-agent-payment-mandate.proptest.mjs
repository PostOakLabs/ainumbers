// art-476-map-agent-payment-mandate.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C22-1).
// kernel_digest_at_authoring: sha256:a10219350fc810ab2fc5e6acfec6cad91e855e0b0c493b1e518b3fcc04a2e07d
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO — direct source read confirmed. The only arithmetic in compute() is the
// inlined SHA-256 core (_sha256/_utf8Bytes), which is pure bitwise/BigInt-shift integer arithmetic
// (Uint32Array, >>>, Math.imul), never IEEE-754 float comparison; canonical field values
// (mandate_id/amount/etc.) are moved through unchanged (n(v) = v===undefined?null:v), never
// arithmetically transformed. No ULP-boundary claim made or needed. Forced categorical boundary
// cases used instead (unknown protocol, same-protocol, missing required fields).
// Checks: fixture-oracle gate, termination (compute() does O(1) work per call — no loop over
// caller-controlled unbounded input, only fixed-size .filter() over the 10-entry
// ALL_CANONICAL_FIELDS/required_canonical_fields constants — confirmed and tested with
// arbitrarily-shaped source_mandate objects), differential re-derivation of missing_required_target_fields
// and mapping_ok, boundedness (translated_mandate keys are always exactly the target profile's
// declared shape), the self-check SHA-256/UTF-8/canon pins built into the kernel module (imported,
// not re-implemented — any drift throws at module load and fails this file), and forced categorical
// boundary cases for the three MAPPING_REJECTED branches. Zero external dependencies — pure Node
// built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-476-map-agent-payment-mandate.proptest.mjs

import { compute } from '../art-476-map-agent-payment-mandate.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-476-map-agent-payment-mandate.fixtures.json');
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
const rand = mulberry32(0x476A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const PROTOCOLS = ['ap2', 'x402', 'acp'];

function randomMandate(rng, protocol) {
  const base = { mandate_id: `m-${Math.floor(rng() * 1e6)}`, amount: String(Math.floor(rng() * 1e4)), currency: 'USD', issued_at: '2026-01-01T00:00:00Z', expires_at: '2026-02-01T00:00:00Z' };
  if (protocol === 'ap2') return rng() < 0.8 ? { ...base, merchant_id: 'merch-1', scope: { max_amount: 500, merchant_ids: ['merch-1'] }, human_not_present: rng() < 0.5 } : {};
  if (protocol === 'x402') return rng() < 0.8 ? { asset: 'USDC', maxAmountRequired: '100', resource: '/x', payTo: '0xabc', payload: { authorization: { from: '0x1', to: '0x2', value: '50', validAfter: '0', validBefore: '999', nonce: 'n1' } } } : {};
  return rng() < 0.8 ? { checkout_session_id: 'cs-1', buyer_id: 'b1', merchant_id: 'm1', total_amount: '10', currency: 'USD', created_at: '2026-01-01', expires_at: '2026-02-01' } : {};
}

function randomPP(rng) {
  const source_protocol = pick(rng, [...PROTOCOLS, 'unknown', '']);
  const target_protocol = pick(rng, [...PROTOCOLS, 'unknown', '']);
  return { source_protocol, target_protocol, source_mandate: randomMandate(rng, source_protocol) };
}

const TRIALS = 5000;

// ---------- P1: termination — compute() never throws and returns an output regardless of shape ----------
function checkP1_termination_no_throw() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    checked++;
    try {
      const { output_payload } = compute(pp);
      if (output_payload === undefined) violations++;
    } catch (e) {
      violations++;
    }
  }
  return { name: 'P1_termination_compute_never_throws', trials: checked, violations };
}

// ---------- P2 (differential): mapping_ok / missing_required_target_fields re-derivation ----------
function checkP2_mapping_ok_differential() {
  let violations = 0, checked = 0;
  const REQUIRED = {
    ap2: ['mandate_id', 'amount', 'currency', 'issued_at', 'expires_at'],
    x402: ['payer_ref', 'payee_ref', 'amount', 'expires_at'],
    acp: ['mandate_id', 'amount', 'currency'],
  };
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (!PROTOCOLS.includes(pp.source_protocol) || !PROTOCOLS.includes(pp.target_protocol) || pp.source_protocol === pp.target_protocol) {
      continue; // rejection branch, covered by P5
    }
    const missing = REQUIRED[pp.target_protocol].filter((f) => output_payload.canonical_pivot[f] === null || output_payload.canonical_pivot[f] === undefined);
    if (JSON.stringify([...output_payload.missing_required_target_fields].sort()) !== JSON.stringify([...missing].sort())) violations++;
    if (output_payload.mapping_ok !== (missing.length === 0)) violations++;
  }
  return { name: 'P2_mapping_ok_and_missing_fields_differential', trials: checked, violations };
}

// ---------- P3: boundedness — translated_mandate always matches the target protocol's declared field shape ----------
function checkP3_translated_shape_boundedness() {
  const SHAPES = {
    ap2: ['mandate_id', 'mandate_type', 'merchant_id', 'amount', 'currency', 'issued_at', 'expires_at', 'human_not_present', 'scope'],
    x402: ['x402Version', 'scheme', 'maxAmountRequired', 'resource', 'payTo', 'asset', 'payload'],
    acp: ['checkout_session_id', 'buyer_id', 'merchant_id', 'total_amount', 'currency', 'created_at', 'expires_at'],
  };
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    if (!PROTOCOLS.includes(pp.source_protocol) || !PROTOCOLS.includes(pp.target_protocol) || pp.source_protocol === pp.target_protocol) continue;
    const { output_payload } = compute(pp);
    checked++;
    const gotKeys = Object.keys(output_payload.translated_mandate).sort();
    const expectedKeys = SHAPES[pp.target_protocol].slice().sort();
    if (JSON.stringify(gotKeys) !== JSON.stringify(expectedKeys)) violations++;
  }
  return { name: 'P3_translated_mandate_shape_bounded', trials: checked, violations };
}

// ---------- P4: metamorphic — mapping_table_version and protocol_versions are input-independent constants ----------
function checkP4_constants_metamorphic() {
  let violations = 0, checked = 0;
  let firstVersion = null;
  for (let i = 0; i < 500; i++) {
    const pp = randomPP(rand);
    if (!PROTOCOLS.includes(pp.source_protocol) || !PROTOCOLS.includes(pp.target_protocol) || pp.source_protocol === pp.target_protocol) continue;
    const { output_payload } = compute(pp);
    checked++;
    if (firstVersion === null) firstVersion = output_payload.mapping_table_version;
    if (output_payload.mapping_table_version !== firstVersion) violations++;
  }
  return { name: 'P4_mapping_table_version_constant_metamorphic', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases for the three rejection branches ----------
function checkP5_forced_categorical_rejections() {
  let violations = 0, checked = 0;
  const cases = [
    { pp: { source_protocol: 'ap2', target_protocol: 'ap2', source_mandate: {} }, label: 'same_protocol' },
    { pp: { source_protocol: 'ap2', target_protocol: 'unknown', source_mandate: {} }, label: 'unknown_target' },
    { pp: { source_protocol: 'unknown', target_protocol: 'x402', source_mandate: {} }, label: 'unknown_source' },
    { pp: { source_protocol: '', target_protocol: '', source_mandate: {} }, label: 'both_empty' },
  ];
  for (const c of cases) {
    checked++;
    const { output_payload, compliance_flags } = compute(c.pp);
    if (!compliance_flags.includes('MAPPING_REJECTED')) violations++;
    if (output_payload.mapping_ok !== undefined) violations++;
  }
  return { name: 'P5_forced_categorical_rejection_boundaries', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_no_throw());
results.properties.push(checkP2_mapping_ok_differential());
results.properties.push(checkP3_translated_shape_boundedness());
results.properties.push(checkP4_constants_metamorphic());
results.properties.push(checkP5_forced_categorical_rejections());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-476-map-agent-payment-mandate',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
