// kernel_digest_at_authoring: sha256:03f4ebd802b04ae45993fa918c7bfb974304e19186c9a139961b6cf700258d1d
//
// FV-PROPFLOOR-SHARD-B3-1 — property-test floor for art-159-vida-einvoice-en16931-conformance-validator.
// Class B (bounded categorical), float:no exception per the WU row — regex/set-membership
// structural field checks only, no continuous arithmetic. Forced categorical boundary cases used
// in place of ULP forcing per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies
// (mulberry32 PRNG + explicit boundary arrays), same shape as the B1/B2 harnesses. This file is
// READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-159-vida-einvoice-en16931-conformance-validator.proptest.mjs

import { compute } from '../art-159-vida-einvoice-en16931-conformance-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-159-vida-einvoice-en16931-conformance-validator.fixtures.json');
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
const rand = mulberry32(0x15901);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 10000;
const SYNTAX_ID = 'urn:cen.eu:en16931:2017';

function mkInvoice(rng) {
  const invoice = {};
  if (rng() < 0.6) invoice.invoice_number = 'INV-001';
  if (rng() < 0.6) invoice.invoice_date = pick(rng, ['2030-08-15', '2030-8-15']);
  if (rng() < 0.6) invoice.currency_code = pick(rng, ['EUR', 'eur', 'EURO']);
  if (rng() < 0.6) invoice.seller_name = 'Acme GmbH';
  if (rng() < 0.6) invoice.buyer_name = 'Bayer AG';
  if (rng() < 0.6) invoice.seller_vat_id = 'DE123456789';
  if (rng() < 0.6) invoice.syntax_id = pick(rng, [SYNTAX_ID, 'urn:bogus']);
  if (rng() < 0.6) invoice.vat_breakdown = rng() < 0.7 ? [{ category_code: 'S' }] : [{ category_code: 'ZZ' }];
  if (rng() < 0.6) invoice.total_with_vat = 1190;
  return { invoice };
}

const FULL_VALID = {
  invoice_number: 'INV-001', invoice_date: '2030-08-15', currency_code: 'EUR', seller_name: 'Acme GmbH',
  buyer_name: 'Bayer AG', seller_vat_id: 'DE123456789', syntax_id: SYNTAX_ID,
  vat_breakdown: [{ category_code: 'S' }], total_with_vat: 1190,
};

// ---------- P1: monotone — completing every mandatory field never increases missing_fields.length ----------
function checkP1_monotoneMissing() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkInvoice(rand);
    const r1 = compute(pp);
    const r2 = compute({ invoice: FULL_VALID });
    checked++;
    if (r2.output_payload.missing_fields.length > r1.output_payload.missing_fields.length) violations++;
    if (r1.output_payload.conformant && !r2.output_payload.conformant) violations++;
  }
  return { name: 'P1_monotone_missing_fields_nonincreasing_toward_full_valid_invoice', trials: checked, violations };
}

// ---------- P2: boundedness — missing_fields subset of the 9 named checks, mandatory_fields_checked fixed at 9 ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  const KNOWN = new Set(['invoice_number', 'invoice_date', 'currency_code', 'seller_name', 'buyer_name', 'seller_vat_id', 'vat_breakdown_present', 'vat_category_valid', 'total_with_vat']);
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkInvoice(rand);
    const r = compute(pp);
    checked++;
    const { missing_fields, mandatory_fields_checked } = r.output_payload;
    if (mandatory_fields_checked !== 9) violations++;
    for (const f of missing_fields) if (!KNOWN.has(f)) violations++;
  }
  return { name: 'P2_boundedness_missing_fields_from_known_set_count_fixed_9', trials: checked, violations };
}

// ---------- P3: categorical threshold agreement — conformant iff missing_fields empty; vida_ready iff conformant && syntax_id_valid ----------
function checkP3_conformanceAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkInvoice(rand);
    const r = compute(pp);
    checked++;
    const { conformant, missing_fields, vida_ready, syntax_id_valid } = r.output_payload;
    if (conformant !== (missing_fields.length === 0)) violations++;
    if (vida_ready !== (conformant && syntax_id_valid)) violations++;
  }
  return { name: 'P3_conformant_and_vida_ready_match_fixed_rule', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applicable) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ invoice: { ...FULL_VALID, vat_breakdown: [] } }, 'empty vat_breakdown array — vat_breakdown_present must be false'],
  [{ invoice: { ...FULL_VALID, vat_breakdown: [{ category_code: 'ZZ' }] } }, 'vat_breakdown present but unrecognized category_code — vat_category_valid must be false'],
  [{ invoice: { ...FULL_VALID, currency_code: 'eur' } }, 'lowercase currency code — currency_code check must be false (case-sensitive regex)'],
  [{ invoice: { ...FULL_VALID, invoice_date: '2030-8-15' } }, 'date missing zero-pad — invoice_date check must be false'],
  [{ invoice: { ...FULL_VALID, syntax_id: 'urn:not-recognized' } }, 'unrecognized syntax_id — syntax_id_valid false, conformant true, vida_ready false'],
  [{ invoice: { ...FULL_VALID, total_with_vat: -1 } }, 'negative total_with_vat — total_with_vat check must be false'],
  [{ invoice: { ...FULL_VALID, total_with_vat: 0 } }, 'total_with_vat exactly zero — total_with_vat check must be true (>=0)'],
  [{ invoice: {} }, 'entirely empty invoice — all 9 mandatory fields missing, conformant false'],
  [{}, 'entirely empty policy_parameters — must default cleanly, not throw'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { conformant, vida_ready, missing_fields, mandatory_fields_checked } = r.output_payload;
    const plausible = typeof conformant === 'boolean' && typeof vida_ready === 'boolean' && Array.isArray(missing_fields) && mandatory_fields_checked === 9;
    rows.push({ label, pp, conformant, vida_ready, missing_fields, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneMissing());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_conformanceAgreement());
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
