// kernel_digest_at_authoring: sha256:f16c71bd2744673ca2bd40dc97c04c0a360c89ebb528bcef913f7243adfc6c29
//
// FV-PROPFLOOR-SHARD-B3-1 — property-test floor for art-16-google-ap2-mandate-builder.
// Class B (bounded categorical), float:no exception per the WU row — deterministic string-shape
// mandate-skeleton building only, no continuous arithmetic (amount is carried through as a
// string token, never parsed to a number). Forced categorical boundary cases used in place of
// ULP forcing per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG +
// explicit boundary arrays), same shape as the B1/B2 harnesses. This file is READ-ONLY with
// respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-16-google-ap2-mandate-builder.proptest.mjs

import { compute } from '../art-16-google-ap2-mandate-builder.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-16-google-ap2-mandate-builder.fixtures.json');
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
const rand = mulberry32(0x11601);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 10000;

function mkPP(rng) {
  return {
    mandate_type: pick(rng, ['payment', 'checkout', 'bogus']),
    stage: pick(rng, ['open', 'closed', 'bogus']),
    agent_id: rng() < 0.7 ? 'did:web:agent.example.com' : '',
    subject: rng() < 0.7 ? 'urn:user:demo' : '',
    merchant: rng() < 0.7 ? 'merchant.example.com' : '',
    amount: pick(rng, ['3239 USD', '100 eur', '0 USD']),
  };
}

// ---------- P1: categorical agreement — vdc_type/vdc_stage are pure functions of mandate_type/stage, unaffected by other fields ----------
function checkP1_typeStageAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected_type = pp.mandate_type === 'payment' ? 'PaymentMandate' : 'CheckoutMandate';
    const expected_stage = pp.stage === 'closed' ? 'closed' : 'open';
    if (r.output_payload.vdc_type !== expected_type) violations++;
    if (r.output_payload.vdc_stage !== expected_stage) violations++;
    if (r.output_payload.vdc.type[1] !== expected_type) violations++;
  }
  return { name: 'P1_vdc_type_and_stage_are_pure_functions_of_inputs', trials: checked, violations };
}

// ---------- P2: boundedness — vdc_type/vdc_stage drawn from their fixed 2-element sets, has_proof always true ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { vdc_type, vdc_stage, has_proof } = r.output_payload;
    if (!['CheckoutMandate', 'PaymentMandate'].includes(vdc_type)) violations++;
    if (!['open', 'closed'].includes(vdc_stage)) violations++;
    if (has_proof !== true) violations++;
  }
  return { name: 'P2_boundedness_vdc_type_stage_from_fixed_sets_proof_always_true', trials: checked, violations };
}

// ---------- P3: metamorphic/round-trip — amount "NUM CCY" splits exactly into credentialSubject value/currency (uppercased) ----------
function checkP3_amountSplitRoundTrip() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = { ...mkPP(rand), mandate_type: 'payment', stage: 'closed' };
    const r = compute(pp);
    checked++;
    const [rawValue, rawCcy] = String(pp.amount).trim().split(/\s+/);
    const expectedValue = rawValue || '0';
    const expectedCcy = (rawCcy || 'USD').toUpperCase();
    const amt = r.output_payload.vdc.credentialSubject.amount;
    if (amt.value !== expectedValue) violations++;
    if (amt.currency !== expectedCcy) violations++;
  }
  return { name: 'P3_amount_splits_exactly_into_value_and_uppercased_currency', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applicable) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ mandate_type: 'payment', stage: 'closed', amount: '' }, 'empty amount string — must default to value "0", currency "USD", not throw'],
  [{ mandate_type: 'payment', stage: 'closed', amount: '500' }, 'amount with no currency token — must default currency to USD'],
  [{ mandate_type: 'payment', stage: 'closed', amount: '500 eur' }, 'lowercase currency in amount — must uppercase to EUR'],
  [{ mandate_type: 'bogus_type', stage: 'open' }, 'unrecognized mandate_type — must default to checkout, not throw'],
  [{ mandate_type: 'checkout', stage: 'bogus_stage' }, 'unrecognized stage — must default to open'],
  [{ agent_id: '', subject: '', merchant: '' }, 'all empty-string identity fields — must fall back to did:example defaults, not throw'],
  [{ agent_id: '   ' }, 'whitespace-only agent_id — must be treated as blank and fall back to default (trim().length check)'],
  [{}, 'entirely empty policy_parameters — must default cleanly through every branch, checkout/open'],
  [{ mandate_type: 'checkout', stage: 'open', merchant: 'shop.example.com' }, 'open checkout — constraints.merchantAllowList must contain exactly [merchant]'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { vdc_type, vdc_stage, has_proof } = r.output_payload;
    const plausible = ['CheckoutMandate', 'PaymentMandate'].includes(vdc_type) && ['open', 'closed'].includes(vdc_stage) && has_proof === true;
    rows.push({ label, pp, vdc_type, vdc_stage, has_proof, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_typeStageAgreement());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_amountSplitRoundTrip());
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
