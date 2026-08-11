// art-535-fdic370-output-file-validator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C27-1).
// kernel_digest_at_authoring: sha256:10cb82f1a665d074500af23e512217234c39f79ad7f298e6f12a74eab4e2eeae
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO — RE-CONFIRMED BY DIRECT READ per FIX-2; this matches the WU row's own
// float:no classification, no correction needed. The kernel's own docstring states "FIXED POINT
// MONEY, INTEGER MINOR UNITS ONLY. No floating point arithmetic is performed anywhere in this
// file" and the code matches: every amount is validated via Number.isSafeInteger, and file_totals is
// a plain integer accumulation over conforming rows. Forced categorical boundary cases are used in
// place of ULP forcing.
// Checks: fixture-oracle gate, termination (P1: file_structure_errors.length + conforming.length ===
// suppliedRows.length -- every row lands in exactly one bucket, no matter how many rows are
// supplied), a conservation boundedness identity (P2: file_totals fields equal the exact integer sum
// over conforming rows only), a differential re-derivation of the row-shape validation and
// totals-reconciliation logic against an independent reimplementation (P3), a metamorphic
// permutation-invariance identity (P4, restricted to inputs with no duplicate
// ownership_right_and_capacity codes so row order cannot change which row is flagged -- under that
// restriction, conforming_row_count/file_totals/gate_policy are all order-independent), and forced
// categorical boundary cases (P5: a row missing a required field, a genuine duplicate code excluding
// the second occurrence, no art507_result supplied forcing did_not_run, a totals mismatch forcing
// escalate, and structural errors taking precedence over a totals mismatch in the same run).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-535-fdic370-output-file-validator.proptest.mjs

import { compute } from '../art-535-fdic370-output-file-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-535-fdic370-output-file-validator.fixtures.json');
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
const rand = mulberry32(0x535C27);
const REQUIRED = ['ownership_right_and_capacity', 'deposit_account_count', 'distinct_account_holder_count', 'fully_insured_account_count', 'accounts_with_uninsured_deposits_count', 'insured_minor_units', 'uninsured_minor_units'];

function randomRow(rng, code, dropField) {
  const row = {
    row_ref: `R-${code}`,
    ownership_right_and_capacity: code,
    deposit_account_count: Math.floor(rng() * 20),
    distinct_account_holder_count: Math.floor(rng() * 20),
    fully_insured_account_count: Math.floor(rng() * 10),
    accounts_with_uninsured_deposits_count: Math.floor(rng() * 10),
    insured_minor_units: Math.floor(rng() * 100000000),
    uninsured_minor_units: Math.floor(rng() * 100000000),
  };
  if (dropField) delete row[dropField];
  return row;
}
function randomPP(rng, opts = {}) {
  const n = opts.n ?? Math.floor(rng() * 6);
  const codes = Array.from({ length: n }, (_, i) => `CODE${i}`); // unique codes -> no duplicate-code ambiguity
  const rows = codes.map((c) => randomRow(rng, c, rng() < 0.15 ? REQUIRED[Math.floor(rng() * REQUIRED.length)] : null));
  const totals = rows.reduce((t, r) => {
    if (Object.keys(r).length < REQUIRED.length + 1) return t; // malformed row not summed
    return {
      fully_insured_account_count: t.fully_insured_account_count + (r.fully_insured_account_count ?? 0),
      accounts_with_uninsured_deposits_count: t.accounts_with_uninsured_deposits_count + (r.accounts_with_uninsured_deposits_count ?? 0),
      insured_minor_units: t.insured_minor_units + (r.insured_minor_units ?? 0),
      uninsured_minor_units: t.uninsured_minor_units + (r.uninsured_minor_units ?? 0),
    };
  }, { fully_insured_account_count: 0, accounts_with_uninsured_deposits_count: 0, insured_minor_units: 0, uninsured_minor_units: 0 });
  const art507_result = rng() < 0.8 ? (rng() < 0.85 ? totals : { ...totals, insured_minor_units: totals.insured_minor_units + 1 }) : undefined;
  const pp = { as_of_date: '2026-06-30', institution_ref: 'IDI-1', file_records: rows };
  if (art507_result !== undefined) pp.art507_result = art507_result;
  return pp;
}

// Independent reimplementation of row-shape validation + totals reconciliation, for P3.
function reimplement(pp) {
  const seen = new Set();
  let structErrors = 0, conformingCount = 0;
  const totals = { fully_insured_account_count: 0, accounts_with_uninsured_deposits_count: 0, insured_minor_units: 0, uninsured_minor_units: 0 };
  for (const r of pp.file_records) {
    const hasAll = REQUIRED.every((f) => f in r && r[f] !== undefined);
    if (!hasAll) { structErrors++; continue; }
    if (seen.has(r.ownership_right_and_capacity)) { structErrors++; continue; }
    seen.add(r.ownership_right_and_capacity);
    conformingCount++;
    totals.fully_insured_account_count += r.fully_insured_account_count;
    totals.accounts_with_uninsured_deposits_count += r.accounts_with_uninsured_deposits_count;
    totals.insured_minor_units += r.insured_minor_units;
    totals.uninsured_minor_units += r.uninsured_minor_units;
  }
  let gate;
  if (pp.art507_result === undefined) gate = null; // did_not_run
  else if (structErrors > 0) gate = 'review_required';
  else {
    const mismatch = ['fully_insured_account_count', 'accounts_with_uninsured_deposits_count', 'insured_minor_units', 'uninsured_minor_units'].some((f) => totals[f] !== pp.art507_result[f]);
    gate = mismatch ? 'escalate' : 'auto_pass';
  }
  return { structErrors, conformingCount, totals, gate };
}

const TRIALS = 2000;

// ---------- P1: termination — every row lands in exactly one bucket ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.file_structure_errors.length + o.conforming_row_count !== o.supplied_row_count) violations++;
    if (o.supplied_row_count !== pp.file_records.length) violations++;
  }
  return { name: 'P1_termination_every_row_in_exactly_one_bucket', trials: checked, violations };
}

// ---------- P2: boundedness — file_totals equal the exact integer sum over conforming rows ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    const expected = reimplement(pp);
    for (const f of Object.keys(expected.totals)) { if (o.file_totals[f] !== expected.totals[f]) violations++; }
  }
  return { name: 'P2_boundedness_totals_exact_integer_sum', trials: checked, violations };
}

// ---------- P3: differential — validation + reconciliation re-derived against an independent reimplementation ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    const expected = reimplement(pp);
    if (o.file_structure_errors.length !== expected.structErrors) violations++;
    if (o.conforming_row_count !== expected.conformingCount) violations++;
    if ((o.decision.gate_policy ?? null) !== expected.gate) violations++;
  }
  return { name: 'P3_validation_and_reconciliation_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — permutation-invariance (no duplicate codes, so order never matters) ----------
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 800; i++) {
    const pp = randomPP(rand, { n: 2 + Math.floor(rand() * 4) });
    if (pp.file_records.length < 2) continue;
    const shuffled = { ...pp, file_records: [...pp.file_records].reverse() };
    const a = compute(pp).output_payload;
    const b = compute(shuffled).output_payload;
    checked++;
    if (a.conforming_row_count !== b.conforming_row_count) violations++;
    if (JSON.stringify(a.file_totals) !== JSON.stringify(b.file_totals)) violations++;
    if ((a.decision.gate_policy ?? null) !== (b.decision.gate_policy ?? null)) violations++;
  }
  return { name: 'P4_permutation_invariance_no_duplicate_codes', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (float:no) ----------
function checkP5_forced_categorical() {
  let violations = 0, checked = 0;
  const okRow = randomRow(rand, 'SGL', null);
  // missing required field
  { const { output_payload: o } = compute({ file_records: [randomRow(rand, 'JNT', 'insured_minor_units')], art507_result: { fully_insured_account_count: 0, accounts_with_uninsured_deposits_count: 0, insured_minor_units: 0, uninsured_minor_units: 0 } }); checked++; if (o.file_structure_errors.length !== 1) violations++; if (o.decision.gate_policy !== 'review_required') violations++; }
  // genuine duplicate code -> second occurrence excluded
  { const r1 = randomRow(rand, 'SGL', null); const r2 = randomRow(rand, 'SGL', null); const { output_payload: o } = compute({ file_records: [r1, r2], art507_result: { fully_insured_account_count: r1.fully_insured_account_count, accounts_with_uninsured_deposits_count: r1.accounts_with_uninsured_deposits_count, insured_minor_units: r1.insured_minor_units, uninsured_minor_units: r1.uninsured_minor_units } }); checked++; if (o.conforming_row_count !== 1) violations++; if (o.file_structure_errors.length !== 1) violations++; }
  // no art507_result -> did_not_run
  { const { output_payload: o } = compute({ file_records: [okRow] }); checked++; if (o.decision.execution_state !== 'did_not_run') violations++; if (o.art507_supplied) violations++; }
  // totals mismatch -> escalate
  { const { output_payload: o } = compute({ file_records: [okRow], art507_result: { fully_insured_account_count: okRow.fully_insured_account_count + 1, accounts_with_uninsured_deposits_count: okRow.accounts_with_uninsured_deposits_count, insured_minor_units: okRow.insured_minor_units, uninsured_minor_units: okRow.uninsured_minor_units } }); checked++; if (o.decision.gate_policy !== 'escalate') violations++; }
  // structural error takes precedence over a totals mismatch
  { const { output_payload: o } = compute({ file_records: [randomRow(rand, 'X', 'deposit_account_count')], art507_result: { fully_insured_account_count: 999, accounts_with_uninsured_deposits_count: 999, insured_minor_units: 999, uninsured_minor_units: 999 } }); checked++; if (o.decision.gate_policy !== 'review_required') violations++; }
  return { name: 'P5_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_differential());
results.properties.push(checkP4_permutation_invariance());
results.properties.push(checkP5_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-535-fdic370-output-file-validator',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
