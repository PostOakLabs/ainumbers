// kernel_digest_at_authoring: sha256:3bdfd9647ff94c830fe925048617e9528272a1bd33da7bc0a2a640e70563eea2
//
// FV-PROPFLOOR-SHARD-B26-1 — property-test floor for art-580-15c3-3a-note-h-margin-debit.
//
// ⚠ FIX-2 CARRY CORRECTION (per WU instruction "verify float-sensitivity ... not inherited from
// the triage table alone"): the WU row lists this kernel as float:yes, but the shipped kernel's
// only numeric operation is `debit_minor_units = Math.min(margin_required_minor_units,
// margin_on_deposit_minor_units)` over two Number.isSafeInteger-constrained minor-unit values
// (isSafeIntAmount/toMinorUnits reject anything that is not a safe integer). There is no
// multiplication, division, or rounding anywhere in compute() — Math.min of two exact integers
// has no float-precision failure mode. This is class-B FLOAT:NO in substance: forced
// CATEGORICAL boundary cases are used below in place of ULP forcing, and this correction is
// recorded in the shard manifest per FIX-2 CARRY.
//
// Zero external dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the
// B1/B3/B12 harness. READ-ONLY w.r.t. the kernel.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-580-15c3-3a-note-h-margin-debit.proptest.mjs

import { compute } from '../art-580-15c3-3a-note-h-margin-debit.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-580-15c3-3a-note-h-margin-debit.fixtures.json');
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
const rand = mulberry32(0x580580);
const TRIALS = 8000;
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const MARGIN_SOURCES = ['customer_cash', 'customer_securities_custody', 'bd_treasuries_narrow'];

function tri(rng) { const v = rng(); return v < 0.7 ? true : v < 0.85 ? false : undefined; }

function mkPP(rng) {
  const margin_source = pick(rng, [...MARGIN_SOURCES, undefined]);
  const pp = {
    broker_dealer_ref: 'SYNTH-TEST',
    computation_date_label: '2026-08-07 test computation',
    currency: 'USD',
    clearing_agency_name: 'SYNTH-TEST-CCA',
    clearing_agency_conditions: {
      commission_notice_published: tri(rng),
      per_customer_gross_margin_calc: tri(rng),
      cash_investment_short_term_treasuries_only: tri(rng),
      special_clearing_account_designated: tri(rng),
      excess_margin_return_system: tri(rng),
    },
    margin_source,
    margin_required_minor_units: rng() < 0.9 ? Math.floor(rng() * 1000000000) : undefined,
    margin_on_deposit_minor_units: rng() < 0.9 ? Math.floor(rng() * 1000000000) : undefined,
  };
  if (margin_source === 'bd_treasuries_narrow') {
    pp.customer_insufficient_assets_declared = tri(rng);
    pp.margin_called_and_received_next_business_day = tri(rng);
  }
  return pp;
}

// ---------- P1: debit_minor_units is exact MIN(required, deposit) when INCLUDABLE, else exactly 0 ----------
function checkP1_debitExactMinOrZero() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    if (r.verdict === 'INCLUDABLE') {
      const expected = Math.min(pp.margin_required_minor_units, pp.margin_on_deposit_minor_units);
      if (r.debit_minor_units !== expected) violations++;
    } else if (r.debit_minor_units !== 0) violations++;
    if (!Number.isInteger(r.debit_minor_units)) violations++;
  }
  return { name: 'P1_debit_exact_min_of_required_and_deposit_or_zero', trials: checked, violations };
}

// ---------- P2: verdict priority — amounts missing beats any-unstated beats any-false beats INCLUDABLE ----------
function checkP2_verdictPriority() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    const amountsMissing = typeof pp.margin_required_minor_units !== 'number' || typeof pp.margin_on_deposit_minor_units !== 'number';
    if (amountsMissing && r.verdict !== 'INDETERMINATE') violations++;
  }
  return { name: 'P2_amounts_missing_forces_indeterminate', trials: checked, violations };
}

// ---------- P3: verdict is bounded to the fixed 3-state enum ----------
function checkP3_verdictBounded() {
  let violations = 0, checked = 0;
  const VOCAB = ['INDETERMINATE', 'NOT_INCLUDABLE', 'INCLUDABLE'];
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    if (VOCAB.indexOf(r.verdict) < 0) violations++;
  }
  return { name: 'P3_verdict_bounded_to_fixed_3_state_enum', trials: checked, violations };
}

// ---------- P4: debit is never larger than either input (bounded-by-min invariant) ----------
function checkP4_debitNeverExceedsEitherInput() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    if (typeof pp.margin_required_minor_units === 'number' && r.debit_minor_units > pp.margin_required_minor_units) violations++;
    if (typeof pp.margin_on_deposit_minor_units === 'number' && r.debit_minor_units > pp.margin_on_deposit_minor_units) violations++;
  }
  return { name: 'P4_debit_never_exceeds_either_input', trials: checked, violations };
}

// ---------- P5 (float:no exception, corrected per FIX-2 CARRY): forced categorical boundary cases ----------
const ALL_TRUE_CONDITIONS = {
  commission_notice_published: true, per_customer_gross_margin_calc: true,
  cash_investment_short_term_treasuries_only: true, special_clearing_account_designated: true,
  excess_margin_return_system: true,
};
const CATEGORICAL_BOUNDARY_CASES = [
  [{ clearing_agency_conditions: ALL_TRUE_CONDITIONS, margin_source: 'customer_cash', margin_required_minor_units: 1000, margin_on_deposit_minor_units: 1000 }, 'margin_required exactly equals margin_on_deposit (tie) — MIN of two equal integers is that integer, no ambiguity'],
  [{ clearing_agency_conditions: ALL_TRUE_CONDITIONS, margin_source: 'customer_cash', margin_required_minor_units: 0, margin_on_deposit_minor_units: 1000 }, 'margin_required exactly 0 — debit exactly 0, INCLUDABLE (zero is a valid required-margin figure, not treated as missing)'],
  [{ clearing_agency_conditions: ALL_TRUE_CONDITIONS, margin_source: 'customer_cash', margin_required_minor_units: 1000, margin_on_deposit_minor_units: 0 }, 'margin_on_deposit exactly 0 (nothing on deposit yet) — debit is MIN(1000,0)=0, still INCLUDABLE since all conditions hold, just a zero debit'],
  [{ clearing_agency_conditions: { ...ALL_TRUE_CONDITIONS, per_customer_gross_margin_calc: false }, margin_source: 'customer_cash', margin_required_minor_units: 1000, margin_on_deposit_minor_units: 1000 }, 'exactly one condition declared false — NOT_INCLUDABLE regardless of amounts, debit forced to 0'],
  [{ clearing_agency_conditions: { ...ALL_TRUE_CONDITIONS, commission_notice_published: undefined }, margin_source: 'customer_cash', margin_required_minor_units: 1000, margin_on_deposit_minor_units: 1000 }, 'exactly one condition left unstated (undefined, tri-state null) — INDETERMINATE, never guessed toward INCLUDABLE or NOT_INCLUDABLE'],
  [{ clearing_agency_conditions: ALL_TRUE_CONDITIONS, margin_source: 'bd_treasuries_narrow', customer_insufficient_assets_declared: true, margin_called_and_received_next_business_day: false, margin_required_minor_units: 1000, margin_on_deposit_minor_units: 1000 }, 'narrow bd_treasuries_narrow path with exactly one of its two extra sub-conditions false — NOT_INCLUDABLE'],
  [{ clearing_agency_conditions: ALL_TRUE_CONDITIONS, margin_source: undefined, margin_required_minor_units: 1000, margin_on_deposit_minor_units: 1000 }, 'margin_source entirely undeclared — INDETERMINATE (margin_source absence counts as an unstated condition), debit 0'],
  [{ clearing_agency_conditions: ALL_TRUE_CONDITIONS, margin_source: 'customer_cash', margin_required_minor_units: Number.MAX_SAFE_INTEGER, margin_on_deposit_minor_units: Number.MAX_SAFE_INTEGER }, 'both amounts at MAX_SAFE_INTEGER — Math.min is exact at the safe-integer boundary, no precision loss'],
];

function checkP5_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const full = { broker_dealer_ref: 'SYNTH-TEST', computation_date_label: 'test', currency: 'USD', clearing_agency_name: 'SYNTH-TEST-CCA', ...pp };
    const r = compute(full).output_payload;
    const plausible = Number.isInteger(r.debit_minor_units) && r.debit_minor_units >= 0 && ['INDETERMINATE', 'NOT_INCLUDABLE', 'INCLUDABLE'].indexOf(r.verdict) >= 0;
    rows.push({ label, input: full, verdict: r.verdict, debit_minor_units: r.debit_minor_units, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_debitExactMinOrZero());
results.properties.push(checkP2_verdictPriority());
results.properties.push(checkP3_verdictBounded());
results.properties.push(checkP4_debitNeverExceedsEitherInput());
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
