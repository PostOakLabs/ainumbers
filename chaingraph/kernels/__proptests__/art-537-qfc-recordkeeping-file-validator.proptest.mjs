// art-537-qfc-recordkeeping-file-validator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C27-1).
// kernel_digest_at_authoring: sha256:c7d0608caf559ede9bf75c63cee44bcc4cda97cc043ea6c689707e0e956709b9
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO — RE-CONFIRMED BY DIRECT READ per FIX-2; this matches the WU row's own
// float:no classification, no correction needed. The kernel's own docstring states "FIXED POINT
// MONEY, INTEGER MINOR UNITS ONLY. No floating point arithmetic is performed anywhere in this
// file" — same discipline as its sibling art-535-fdic370-output-file-validator, reused exactly (the
// kernel's own docstring: "SAME FILE-SHAPE DISCIPLINE AS art-535 ... NOT A THIRD PATTERN"). Forced
// categorical boundary cases are used in place of ULP forcing.
// Checks: fixture-oracle gate, termination (P1: file_structure_errors.length + conforming.length ===
// suppliedRows.length), a conservation boundedness identity (P2: file_totals fields equal the exact
// integer sum over conforming rows, distinct_counterparty_count equals the true distinct-count),
// a differential re-derivation of the row-shape validation and control-total reconciliation against
// an independent reimplementation (P3), a metamorphic permutation-invariance identity (P4, restricted
// to inputs with no duplicate position_id so row order cannot change which row is flagged), and
// forced categorical boundary cases (P5: a row missing a required field, a genuine duplicate
// position_id, no control_totals supplied forcing did_not_run, a totals mismatch forcing escalate,
// and structural errors taking precedence over a totals mismatch in the same run).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-537-qfc-recordkeeping-file-validator.proptest.mjs

import { compute } from '../art-537-qfc-recordkeeping-file-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-537-qfc-recordkeeping-file-validator.fixtures.json');
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
const rand = mulberry32(0x537C27);
const REQUIRED = ['position_id', 'counterparty_id', 'qfc_type', 'currency_code', 'notional_minor_units', 'collateral_minor_units'];

function randomRow(rng, posId, counterparty, dropField) {
  const row = {
    row_ref: `R-${posId}`,
    position_id: posId,
    counterparty_id: counterparty,
    qfc_type: 'interest_rate_swap',
    currency_code: 'USD',
    notional_minor_units: Math.floor(rng() * 1000000000),
    collateral_minor_units: Math.floor(rng() * 100000000),
  };
  if (dropField) delete row[dropField];
  return row;
}
function randomPP(rng, opts = {}) {
  const n = opts.n ?? Math.floor(rng() * 6);
  const cps = ['cp-1', 'cp-2', 'cp-3'];
  const rows = Array.from({ length: n }, (_, i) => randomRow(rng, `pos-${i}`, cps[i % cps.length], rng() < 0.15 ? REQUIRED[Math.floor(rng() * REQUIRED.length)] : null));
  const conformingRows = rows.filter((r) => REQUIRED.every((f) => f in r));
  const totals = {
    position_count: conformingRows.length,
    distinct_counterparty_count: new Set(conformingRows.map((r) => r.counterparty_id)).size,
    notional_minor_units: conformingRows.reduce((s, r) => s + r.notional_minor_units, 0),
    collateral_minor_units: conformingRows.reduce((s, r) => s + r.collateral_minor_units, 0),
  };
  const control_totals = rng() < 0.8 ? (rng() < 0.85 ? totals : { ...totals, notional_minor_units: totals.notional_minor_units + 1 }) : undefined;
  const pp = { as_of_date: '2026-06-30', institution_ref: 'IDI-1', file_records: rows };
  if (control_totals !== undefined) pp.control_totals = control_totals;
  return pp;
}

// Independent reimplementation of row-shape validation + totals reconciliation, for P3.
function reimplement(pp) {
  const seen = new Set();
  let structErrors = 0, conformingCount = 0;
  const counterparties = new Set();
  const totals = { notional_minor_units: 0, collateral_minor_units: 0 };
  for (const r of pp.file_records) {
    const hasAll = REQUIRED.every((f) => f in r && r[f] !== undefined);
    if (!hasAll) { structErrors++; continue; }
    if (seen.has(r.position_id)) { structErrors++; continue; }
    seen.add(r.position_id);
    conformingCount++;
    counterparties.add(r.counterparty_id);
    totals.notional_minor_units += r.notional_minor_units;
    totals.collateral_minor_units += r.collateral_minor_units;
  }
  let gate;
  if (pp.control_totals === undefined) gate = null;
  else if (structErrors > 0) gate = 'review_required';
  else {
    const fileTotals = { position_count: conformingCount, distinct_counterparty_count: counterparties.size, ...totals };
    const mismatch = ['position_count', 'distinct_counterparty_count', 'notional_minor_units', 'collateral_minor_units'].some((f) => fileTotals[f] !== pp.control_totals[f]);
    gate = mismatch ? 'escalate' : 'auto_pass';
  }
  return { structErrors, conformingCount, counterpartyCount: counterparties.size, totals, gate };
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

// ---------- P2: boundedness — file_totals equal the exact integer sum, distinct_counterparty_count exact ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    const expected = reimplement(pp);
    if (o.file_totals.notional_minor_units !== expected.totals.notional_minor_units) violations++;
    if (o.file_totals.collateral_minor_units !== expected.totals.collateral_minor_units) violations++;
    if (o.file_totals.distinct_counterparty_count !== expected.counterpartyCount) violations++;
    if (o.file_totals.position_count !== expected.conformingCount) violations++;
  }
  return { name: 'P2_boundedness_totals_and_distinct_counterparty_exact', trials: checked, violations };
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
    if ((o.decision.gate_policy ?? null) !== expected.gate) violations++;
  }
  return { name: 'P3_validation_and_reconciliation_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — permutation-invariance (no duplicate position_id, so order never matters) ----------
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
  return { name: 'P4_permutation_invariance_no_duplicate_position_id', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (float:no) ----------
function checkP5_forced_categorical() {
  let violations = 0, checked = 0;
  const okRow = randomRow(rand, 'pos-ok', 'cp-1', null);
  // missing required field
  { const { output_payload: o } = compute({ file_records: [randomRow(rand, 'pos-x', 'cp-2', 'notional_minor_units')], control_totals: { position_count: 0, distinct_counterparty_count: 0, notional_minor_units: 0, collateral_minor_units: 0 } }); checked++; if (o.file_structure_errors.length !== 1) violations++; if (o.decision.gate_policy !== 'review_required') violations++; }
  // genuine duplicate position_id -> second occurrence excluded
  { const r1 = randomRow(rand, 'pos-dup', 'cp-1', null); const r2 = randomRow(rand, 'pos-dup', 'cp-2', null); const { output_payload: o } = compute({ file_records: [r1, r2], control_totals: { position_count: 1, distinct_counterparty_count: 1, notional_minor_units: r1.notional_minor_units, collateral_minor_units: r1.collateral_minor_units } }); checked++; if (o.conforming_row_count !== 1) violations++; if (o.file_structure_errors.length !== 1) violations++; }
  // no control_totals -> did_not_run
  { const { output_payload: o } = compute({ file_records: [okRow] }); checked++; if (o.decision.execution_state !== 'did_not_run') violations++; if (o.control_totals_supplied) violations++; }
  // totals mismatch -> escalate
  { const { output_payload: o } = compute({ file_records: [okRow], control_totals: { position_count: 1, distinct_counterparty_count: 1, notional_minor_units: okRow.notional_minor_units + 1, collateral_minor_units: okRow.collateral_minor_units } }); checked++; if (o.decision.gate_policy !== 'escalate') violations++; }
  // structural error takes precedence over a totals mismatch
  { const { output_payload: o } = compute({ file_records: [randomRow(rand, 'pos-y', 'cp-3', 'qfc_type')], control_totals: { position_count: 999, distinct_counterparty_count: 999, notional_minor_units: 999, collateral_minor_units: 999 } }); checked++; if (o.decision.gate_policy !== 'review_required') violations++; }
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
  tool_id: 'art-537-qfc-recordkeeping-file-validator',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
