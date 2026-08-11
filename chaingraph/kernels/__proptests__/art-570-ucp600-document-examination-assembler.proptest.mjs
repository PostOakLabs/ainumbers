// art-570-ucp600-document-examination-assembler.proptest.mjs -- FV property-test FLOOR
// (FV-PROPFLOOR-SHARD-C29-1).
// kernel_digest_at_authoring: sha256:b120516d58cfb7d8628e27b1cef81b01dbf298a4724dff8548143c422eb588c3
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md Sec3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES -- CORRECTED from the WU row's float:no (per FIX-2 discipline). Direct source
// read: `pctVariance(actual, stated)` computes `Math.abs((actual - stated) / stated) * 100` -- a real
// IEEE-754 division followed by a multiplication -- and its result feeds
// `qty_within_tolerance = qty_variance_pct <= qty_tolerance_pct` and the equivalent amount check
// directly (Art. 30 +/-5%/10% tolerance gate). `amount_exceeds_lc = invoice_amount_minor >
// lc_amount_minor * (1 + amount_tolerance_pct / 100)` is a second independent float boundary
// (division then multiplication). The Art. 28(f)(ii) insurance floor
// (`Math.ceil(cif_cip_value_minor * min_insurance_pct_of_cif / 100)`) is a third. This is exactly the
// epsilon-tolerance decision-boundary shape the C25 shard corrected art-513/art-514 TO float:yes for
// (no->yes), applied here identically -- a percentage-variance float division feeding a pass/fail
// compliance gate is genuinely ULP-sensitive at the tolerance boundary.
// Checks: fixture-oracle gate, termination (drafts bounded by MAX_DRAFTS=10, addBankingDays' while
// loop bounded by the declared 5-banking-day window plus at most the caller-declared finite holiday
// set plus weekends -- a genuinely unbounded-in-principle data-dependent loop, the class-C
// centerpiece here), differential re-derivation of pctVariance/amount_exceeds_lc/insurance-floor,
// ULP-boundary forcing on the 5%/10% tolerance boundary and the insurance-floor Math.ceil boundary,
// and forced categorical boundary cases for addBankingDays (holidays, weekends).
//
// Run: node chaingraph/kernels/__proptests__/art-570-ucp600-document-examination-assembler.proptest.mjs

import { compute } from '../art-570-ucp600-document-examination-assembler.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-570-ucp600-document-examination-assembler.fixtures.json');
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
const rand = mulberry32(0x57000);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function basePP(rng, overrides = {}) {
  return {
    lc: {
      amount_minor: 1000000 + Math.floor(rng() * 100000),
      quantity: { value: 100, unit: 'MT' },
      expiry_date: '2026-12-31',
      latest_shipment_date: '2026-11-30',
      named_ports: { loading: 'PORT-A', discharge: 'PORT-B' },
      ...overrides.lc,
    },
    presentation_date: overrides.presentation_date ?? '2026-11-15',
    examination_date: overrides.examination_date,
    bank_holidays: overrides.bank_holidays ?? [],
    documents: {
      invoice: { amount_minor: overrides.invoiceAmount ?? (1000000 + Math.floor(rng() * 100000)), quantity: { value: overrides.invoiceQty ?? 100 }, goods_description: 'goods' },
      transport_doc: { shipment_date: overrides.shipment_date ?? '2026-11-10', port_of_loading: 'PORT-A', port_of_discharge: 'PORT-B' },
      ...overrides.documents,
    },
    goods_description_conforms: { invoice_vs_transport: true },
  };
}

function randomPP(rng) {
  return basePP(rng, {
    invoiceAmount: 900000 + Math.floor(rng() * 200000),
    invoiceQty: 90 + Math.floor(rng() * 20),
  });
}

const TRIALS = 3000;

// ---------- P1: termination -- drafts bounded by MAX_DRAFTS, addBankingDays terminates on finite input ----------
function checkP1_termination_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.drafts.length > 10) violations++;
    // examination_window.examination_deadline must always be defined and >= presentation_date (the
    // while loop in addBankingDays terminates and produces a later calendar date).
    if (output_payload.examination_window.examination_deadline <= pp.presentation_date) violations++;
  }
  return { name: 'P1_termination_drafts_and_banking_day_walk_bounded', trials: checked, violations };
}

// ---------- P2 (differential): re-derive pctVariance / amount_exceeds_lc / insurance floor ----------
function checkP2_tolerance_differential() {
  let violations = 0, checked = 0;
  function pctVariance(actual, stated) {
    if (stated === 0) return actual === 0 ? 0 : Infinity;
    return Math.abs((actual - stated) / stated) * 100;
  }
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expectedQtyVar = pctVariance(pp.documents.invoice.quantity.value, pp.lc.quantity.value);
    if (Math.abs(output_payload.tolerances.quantity.variance_pct - expectedQtyVar) > 1e-9) violations++;
    const expectedAmtVar = pctVariance(pp.documents.invoice.amount_minor, pp.lc.amount_minor);
    if (Math.abs(output_payload.tolerances.amount.variance_pct - expectedAmtVar) > 1e-9) violations++;
    const withinQty = expectedQtyVar <= 5;
    const withinAmt = expectedAmtVar <= 5;
    if (output_payload.tolerances.quantity.within_tolerance !== withinQty) violations++;
    if (output_payload.tolerances.amount.within_tolerance !== withinAmt) violations++;
  }
  return { name: 'P2_tolerance_variance_differential', trials: checked, violations };
}

// ---------- P3: ULP-boundary forcing on the 5%/10% tolerance boundary and insurance-floor ceiling ----------
function checkP3_ulp_boundary_forcing() {
  let violations = 0, checked = 0;
  // exact 5% boundary: invoice amount = lc amount * 1.05 exactly -> within_tolerance true
  const boundaries = [
    { lc: 1000000, invoice: 1050000, within: true },  // exact +5%
    { lc: 1000000, invoice: 1050001, within: false }, // one unit over
    { lc: 1000000, invoice: 950000, within: true },   // exact -5%
    { lc: 1000000, invoice: 949999, within: false },  // one unit under
    { lc: 3, invoice: 3, within: true },               // classic x/y*y!==x-shaped small values
    { lc: 7, invoice: 7, within: true },
    { lc: 999999999999999, invoice: 999999999999999, within: true }, // near MAX_SAFE_INTEGER, zero variance
  ];
  for (const b of boundaries) {
    checked++;
    const pp = basePP(rand, { lc: { amount_minor: b.lc, quantity: { value: 100, unit: 'MT' }, expiry_date: '2026-12-31', latest_shipment_date: '2026-11-30', named_ports: {} }, invoiceAmount: b.invoice, invoiceQty: 100 });
    const { output_payload } = compute(pp);
    if (output_payload.tolerances.amount.within_tolerance !== b.within) violations++;
  }
  // "about" widens to 10%: exact +10% boundary passes only when amount_tolerance_about is declared
  checked++;
  {
    const pp = basePP(rand, { lc: { amount_minor: 1000000, amount_tolerance_about: true, quantity: { value: 100, unit: 'MT' }, expiry_date: '2026-12-31', latest_shipment_date: '2026-11-30', named_ports: {} }, invoiceAmount: 1100000, invoiceQty: 100 });
    const { output_payload } = compute(pp);
    if (output_payload.tolerances.amount.within_tolerance !== true) violations++;
  }
  // insurance floor: exact 110% boundary meets_floor true, one minor unit under fails
  checked++;
  {
    const pp = basePP(rand, {});
    pp.documents.insurance = { amount_minor: 1100000, cif_cip_value_minor: 1000000, effective_date: '2026-11-01' };
    pp.lc.insurance_required = true;
    const { output_payload } = compute(pp);
    if (output_payload.insurance_check.meets_floor !== true) violations++;
  }
  checked++;
  {
    const pp = basePP(rand, {});
    pp.documents.insurance = { amount_minor: 1099999, cif_cip_value_minor: 1000000, effective_date: '2026-11-01' };
    pp.lc.insurance_required = true;
    const { output_payload } = compute(pp);
    if (output_payload.insurance_check.meets_floor !== false) violations++;
  }
  return { name: 'P3_ulp_boundary_forcing_tolerance_and_insurance_floor', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases for addBankingDays (holidays, weekends) ----------
function checkP4_banking_days_forced_categorical() {
  let violations = 0, checked = 0;
  // presentation on a Friday -> 5 banking days skips the following weekend.
  checked++;
  {
    const pp = basePP(rand, { presentation_date: '2026-11-13', examination_date: '2026-11-20' }); // Fri -> deadline should land the following Friday (skipping 2 weekends)
    const { output_payload } = compute(pp);
    // 5 banking days from a Friday: Mon,Tue,Wed,Thu,Fri of the next week = 2026-11-20.
    if (output_payload.examination_window.examination_deadline !== '2026-11-20') violations++;
  }
  // a declared holiday inside the window pushes the deadline out by one extra day.
  checked++;
  {
    const pp = basePP(rand, { presentation_date: '2026-11-13', bank_holidays: ['2026-11-17'] });
    const { output_payload } = compute(pp);
    if (output_payload.examination_window.examination_deadline !== '2026-11-23') violations++;
  }
  // examination exactly on the deadline -> within window (boundary inclusive).
  checked++;
  {
    const pp = basePP(rand, { presentation_date: '2026-11-13', examination_date: '2026-11-20' });
    const { output_payload } = compute(pp);
    if (output_payload.examination_window.examination_within_window !== true) violations++;
  }
  // examination one calendar day past the deadline -> outside window.
  checked++;
  {
    const pp = basePP(rand, { presentation_date: '2026-11-13', examination_date: '2026-11-21' });
    const { output_payload } = compute(pp);
    if (output_payload.examination_window.examination_within_window !== false) violations++;
  }
  return { name: 'P4_banking_days_forced_categorical', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_bounded());
results.properties.push(checkP2_tolerance_differential());
results.properties.push(checkP3_ulp_boundary_forcing());
results.properties.push(checkP4_banking_days_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-570-ucp600-document-examination-assembler',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
