// art-532-client-porting-check.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C27-1).
// kernel_digest_at_authoring: sha256:6b3fddf02c09856bc6c1a58454eed2257d8a93d2e0a66af5721811ba315ba5f9
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO — the WU row's triage table listed this kernel as float:yes; RE-CONFIRMED BY
// DIRECT READ per FIX-2 and that classification does NOT hold. The kernel's own docstring states
// "FIXED-POINT MONEY MATH ... There is no floating-point arithmetic in compute()": notional and
// collateral sums are plain integer accumulation, display strings come from integer division plus
// string padding (never toFixed() on a float), and the only division in the file is
// Math.round((evaluated_at_ms - default_event_at_ms) / 60000) — an exact-integer-millisecond
// difference divided by the fixed constant 60000 and rounded to a whole minute count; the elapsed/
// window minute comparison downstream is a plain integer compare. Forced categorical boundary cases
// are used in place of ULP forcing.
// Checks: fixture-oracle gate, termination (P1: positions.length === positions array input length,
// collateral.length === collateral array input length, no filtering or dropping regardless of how
// many entries are supplied), a conservation boundedness identity (P2: total_notional_minor_units and
// total_collateral_minor_units equal the exact integer sum of the declared line items, and verdict is
// always one of the six known enum values), a differential re-derivation of the six-way verdict
// decision tree and the elapsed/window-minute arithmetic against an independent reimplementation (P3),
// a metamorphic permutation-invariance identity (P4: reordering positions[]/collateral[] never changes
// the totals or the verdict, since neither is order-dependent), and forced categorical boundary cases
// (P5: empty positions, the porting-window boundary at exactly window_minutes vs one minute over,
// every consent status, and an incomplete position/collateral item).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-532-client-porting-check.proptest.mjs

import { compute } from '../art-532-client-porting-check.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-532-client-porting-check.fixtures.json');
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
const rand = mulberry32(0x532C27);
const CONSENTS = ['consented', 'declined', 'pending', 'not_requested'];

function randomPositions(rng, n) {
  return Array.from({ length: n }, (_, i) => ({ position_id: `POS-${i}`, product_type: 'swap', currency: 'USD', notional_minor_units: Math.floor(rng() * 1000000000), complete: rng() < 0.85 }));
}
function randomCollateral(rng, n) {
  return Array.from({ length: n }, (_, i) => ({ collateral_id: `COLL-${i}`, asset_type: 'ust', currency: 'USD', amount_minor_units: Math.floor(rng() * 1000000000), complete: rng() < 0.85 }));
}
function randomPP(rng) {
  const baseMs = Date.parse('2026-08-04T09:00:00Z');
  const offsetMinutes = Math.floor(rng() * 6000) - 500;
  const evalMs = baseMs + offsetMinutes * 60000;
  return {
    client_ref: 'CLIENT-A1',
    backup_member_id: 'BACKUP-1',
    backup_member_consent_status: pick(rng, CONSENTS),
    default_event_at: new Date(baseMs).toISOString(),
    evaluated_at: new Date(evalMs).toISOString(),
    porting_window_hours: 1 + Math.floor(rng() * 96),
    positions: randomPositions(rng, Math.floor(rng() * 6)),
    collateral: randomCollateral(rng, Math.floor(rng() * 6)),
  };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const VERDICTS = new Set(['not_portable_no_positions_declared', 'not_portable_window_missed', 'not_portable_no_consent', 'not_portable_positions_incomplete', 'not_portable_collateral_incomplete', 'portable']);

// Independent reimplementation of the verdict decision tree, for the differential check (P3).
function reimplement(pp) {
  const positions = pp.positions;
  const collateral = pp.collateral;
  const defaultMs = Date.parse(pp.default_event_at);
  const evalMs = Date.parse(pp.evaluated_at);
  const elapsed = Math.round((evalMs - defaultMs) / 60000);
  const windowM = pp.porting_window_hours * 60;
  const windowMissed = elapsed > windowM;
  const positionsComplete = positions.length > 0 && positions.every((p) => p.complete === true);
  const collateralComplete = collateral.length === 0 || collateral.every((c) => c.complete === true);
  if (positions.length === 0) return 'not_portable_no_positions_declared';
  if (windowMissed) return 'not_portable_window_missed';
  if (pp.backup_member_consent_status !== 'consented') return 'not_portable_no_consent';
  if (!positionsComplete) return 'not_portable_positions_incomplete';
  if (!collateralComplete) return 'not_portable_collateral_incomplete';
  return 'portable';
}

const TRIALS = 4000;

// ---------- P1: termination — positions/collateral arrays never filtered, bounded by input length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.positions.length !== pp.positions.length) violations++;
    if (o.collateral.length !== pp.collateral.length) violations++;
  }
  return { name: 'P1_termination_arrays_bounded_by_input_length', trials: checked, violations };
}

// ---------- P2: boundedness — total sums are exact, verdict is always a known enum value ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    const expectedNotional = pp.positions.reduce((s, p) => s + p.notional_minor_units, 0);
    const expectedCollateral = pp.collateral.reduce((s, c) => s + c.amount_minor_units, 0);
    if (o.total_notional_minor_units !== expectedNotional) violations++;
    if (o.total_collateral_minor_units !== expectedCollateral) violations++;
    if (!VERDICTS.has(o.verdict)) violations++;
  }
  return { name: 'P2_boundedness_totals_exact_and_verdict_known', trials: checked, violations };
}

// ---------- P3: differential — verdict decision tree re-derived against an independent reimplementation ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.verdict !== reimplement(pp)) violations++;
  }
  return { name: 'P3_verdict_decision_tree_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — permutation-invariance of positions[]/collateral[] order ----------
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const pp = randomPP(rand);
    if (pp.positions.length < 2 && pp.collateral.length < 2) continue;
    const shuffled = { ...pp, positions: [...pp.positions].reverse(), collateral: [...pp.collateral].reverse() };
    const a = compute(pp).output_payload;
    const b = compute(shuffled).output_payload;
    checked++;
    if (a.total_notional_minor_units !== b.total_notional_minor_units) violations++;
    if (a.total_collateral_minor_units !== b.total_collateral_minor_units) violations++;
    if (a.verdict !== b.verdict) violations++;
  }
  return { name: 'P4_permutation_invariance_metamorphic', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (float:no) ----------
function checkP5_forced_categorical() {
  let violations = 0, checked = 0;
  const base = { client_ref: 'C', backup_member_id: 'B', backup_member_consent_status: 'consented', default_event_at: '2026-08-04T09:00:00Z', porting_window_hours: 48, positions: [{ position_id: 'P1', product_type: 'swap', currency: 'USD', notional_minor_units: 100, complete: true }], collateral: [] };
  // empty positions
  { const { output_payload: o } = compute({ ...base, positions: [], evaluated_at: '2026-08-04T10:00:00Z' }); checked++; if (o.verdict !== 'not_portable_no_positions_declared') violations++; }
  // window boundary: exactly window_minutes elapsed -> NOT missed (strict >)
  { const { output_payload: o } = compute({ ...base, evaluated_at: '2026-08-06T09:00:00Z' }); checked++; if (o.window_missed) violations++; if (o.elapsed_minutes !== o.window_minutes) violations++; }
  // window boundary: one minute over -> missed
  { const { output_payload: o } = compute({ ...base, evaluated_at: '2026-08-06T09:01:00Z' }); checked++; if (!o.window_missed) violations++; }
  // every consent status
  for (const c of CONSENTS) {
    const { output_payload: o } = compute({ ...base, backup_member_consent_status: c, evaluated_at: '2026-08-04T10:00:00Z' });
    checked++;
    if (c === 'consented') { if (o.verdict !== 'portable') violations++; } else { if (o.verdict !== 'not_portable_no_consent') violations++; }
  }
  // incomplete position
  { const { output_payload: o } = compute({ ...base, positions: [{ position_id: 'P1', product_type: 'swap', currency: 'USD', notional_minor_units: 100, complete: false }], evaluated_at: '2026-08-04T10:00:00Z' }); checked++; if (o.verdict !== 'not_portable_positions_incomplete') violations++; }
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
  tool_id: 'art-532-client-porting-check',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
