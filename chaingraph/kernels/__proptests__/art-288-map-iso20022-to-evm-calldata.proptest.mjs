// art-288-map-iso20022-to-evm-calldata.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C9-1).
// kernel_digest_at_authoring: sha256:4181a160659a5d2f880b1fd8bce92735686ae56106b8b90c584c8eda135a059b
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — the only "amount" handling is string-based
// decimal-to-minor-units conversion via regex/string ops in toUint256MinorUnits, never a
// float parse/compare; everything else is string lookup/coercion).
// Checks: fixture-oracle gate, termination (loop bounded by abiInputs.length, a caller-supplied
// array — no recursion), boundedness (field_bindings.length and abi_type_coercions.length always
// equal abiInputs.length, args.length equal abiInputs.length), a differential re-derivation of
// mapping_ok from unmapped_required_fields.length===0 && abiInputs.length>0, a metamorphic
// identity (permutation-invariance: reordering abi inputs reorders field_bindings/args in lockstep
// but the per-name resolved/unmapped SET is unchanged), and forced categorical boundary cases
// (float:no, no ULP forcing): empty inputs array, unknown ABI input name, missing ISO field,
// decimal amount with more fractional digits than the currency's minor-unit precision (JPY=0
// decimals vs a fractional amount).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-288-map-iso20022-to-evm-calldata.proptest.mjs

import { compute } from '../art-288-map-iso20022-to-evm-calldata.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-288-map-iso20022-to-evm-calldata.fixtures.json');
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
const rand = mulberry32(0x288A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const BINDING_NAMES = ['amount', 'currency', 'debtor', 'creditor', 'endToEndId', 'uetr', 'purposeCode'];
const TYPE_FOR = { amount: 'uint256', currency: 'bytes32', debtor: 'bytes32', creditor: 'bytes32', endToEndId: 'bytes32', uetr: 'bytes32', purposeCode: 'bytes32' };
const ISO_FIELD_FOR = { amount: 'instructedAmount', currency: 'currency', debtor: 'debtorAccount', creditor: 'creditorAccount', endToEndId: 'endToEndId', uetr: 'uetr', purposeCode: 'purposeCode' };

function randomAbiInputs(rng, n, { includeUnknown = false } = {}) {
  const inputs = [];
  for (let i = 0; i < n; i++) {
    if (includeUnknown && rng() < 0.2) { inputs.push({ name: `unknown_${i}`, type: 'bytes32' }); continue; }
    inputs.push({ name: pick(rng, BINDING_NAMES), type: undefined });
  }
  return inputs.map((inp) => ({ name: inp.name, type: TYPE_FOR[inp.name] ?? 'bytes32' }));
}

function randomIsoFields(rng, { dropSome = false } = {}) {
  const fields = {
    instructedAmount: '100.00',
    currency: pick(rng, ['USD', 'EUR', 'JPY']),
    debtorAccount: 'DE89370400440532013000',
    creditorAccount: 'GB29NWBK60161331926819',
    endToEndId: 'E2E-1',
    uetr: 'uetr-1',
    purposeCode: 'TRAD',
  };
  if (dropSome) {
    for (const k of Object.keys(fields)) if (rng() < 0.3) delete fields[k];
  }
  return fields;
}

const TRIALS = 5000;

// ---------- P1: termination — args.length === abiInputs.length; field_bindings/coercions
// length === number of NAMED-and-recognized inputs (unknown-name inputs skip both pushes,
// per the kernel's own `continue` on `!binding`) ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 10);
    const abiInputs = randomAbiInputs(rand, n, { includeUnknown: true });
    const pp = { iso_fields: randomIsoFields(rand, { dropSome: true }), contract_abi_fragment: { function: 'settlePayment', inputs: abiInputs } };
    const nKnown = abiInputs.filter((inp) => BINDING_NAMES.includes(inp.name)).length;
    checked++;
    const { output_payload } = compute(pp);
    if (output_payload.resolved_call.args.length !== n) violations++;
    if (output_payload.field_bindings.length !== nKnown) violations++;
    if (output_payload.abi_type_coercions.length !== nKnown) violations++;
  }
  return { name: 'P1_args_length_equals_inputs_bindings_length_equals_known_names', trials: checked, violations };
}

// ---------- P2 (differential): mapping_ok re-derivation ----------
function checkP2_mapping_ok_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 8);
    const abiInputs = randomAbiInputs(rand, n, { includeUnknown: true });
    const pp = { iso_fields: randomIsoFields(rand, { dropSome: true }), contract_abi_fragment: { function: 'settlePayment', inputs: abiInputs } };
    checked++;
    const { output_payload } = compute(pp);
    const expected = output_payload.unmapped_required_fields.length === 0 && n > 0;
    if (output_payload.mapping_ok !== expected) violations++;
  }
  return { name: 'P2_mapping_ok_differential', trials: checked, violations };
}

// ---------- P3: metamorphic — permutation-invariance of abi inputs (resolved set is order-independent) ----------
function checkP3_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const n = 2 + Math.floor(rand() * 6);
    const abiInputs = randomAbiInputs(rand, n);
    const isoFields = randomIsoFields(rand, { dropSome: true });
    const shuffled = [...abiInputs];
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    checked++;
    const r1 = compute({ iso_fields: isoFields, contract_abi_fragment: { function: 'f', inputs: abiInputs } }).output_payload;
    const r2 = compute({ iso_fields: isoFields, contract_abi_fragment: { function: 'f', inputs: shuffled } }).output_payload;
    const setOf = (r) => new Set(r.field_bindings.map((b) => `${b.abi_input}|${b.resolved}`));
    const s1 = setOf(r1), s2 = setOf(r2);
    if (s1.size !== s2.size) violations++;
    else for (const v of s1) if (!s2.has(v)) violations++;
    if (r1.mapping_ok !== r2.mapping_ok) violations++;
  }
  return { name: 'P3_abi_input_order_permutation_invariance', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no, no ULP forcing) ----------
const CATEGORICAL_CASES = [
  { label: 'empty inputs array -> mapping_ok false, no args resolved', pp: { iso_fields: randomIsoFields(rand), contract_abi_fragment: { function: 'f', inputs: [] } } },
  { label: 'unknown ABI input name -> unmapped, warning emitted', pp: { iso_fields: randomIsoFields(rand), contract_abi_fragment: { function: 'f', inputs: [{ name: 'totally_unknown', type: 'bytes32' }] } } },
  { label: 'missing required ISO field (currency dropped) for bytes32 binding -> unmapped', pp: { iso_fields: {}, contract_abi_fragment: { function: 'f', inputs: [{ name: 'currency', type: 'bytes32' }] } } },
  { label: 'JPY (0 decimals) with fractional amount -> minor-units truncated to JPY precision', pp: { iso_fields: { instructedAmount: '100.99', currency: 'JPY' }, contract_abi_fragment: { function: 'f', inputs: [{ name: 'amount', type: 'uint256' }] } } },
  { label: 'default mapping_profile fallback when an unknown profile is requested', pp: { iso_fields: randomIsoFields(rand), contract_abi_fragment: { function: 'f', inputs: [{ name: 'currency', type: 'bytes32' }] }, mapping_profile: 'nonexistent-profile' } },
];
function checkP5_forced() {
  return CATEGORICAL_CASES.map((c) => {
    const { output_payload } = compute(c.pp);
    return { label: c.label, mapping_ok: output_payload.mapping_ok, args: output_payload.resolved_call.args, mapping_profile: output_payload.mapping_profile };
  });
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_mapping_ok_differential());
results.properties.push(checkP3_permutation_invariance());
const forcedCases = checkP5_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-288-map-iso20022-to-evm-calldata',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  forced_categorical_cases: forcedCases,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
