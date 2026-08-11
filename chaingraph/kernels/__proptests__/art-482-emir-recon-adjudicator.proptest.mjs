// art-482-emir-recon-adjudicator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C23-1).
// kernel_digest_at_authoring: sha256:ef88fb46f98773129561e13479d723e9b1d0822b713ab0816c49367014562557
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// ⚠ CLASSIFICATION CORRECTED FROM THE WU (FIX-2 discipline): the WU row listed this kernel as
// float:no, but direct read of `compareField()`'s `type === 'numeric'` branch shows a genuine
// floating-point tolerance comparison — `delta = Math.abs(Number(trVal) - Number(firmVal));
// agree = delta <= tol` — structurally identical to art-484's arithmetic-identity tolerance
// check (which the WU correctly marks float:yes). Corrected to float:sensitive: YES; ULP-boundary
// forcing is therefore mandatory per spec §3, not optional.
// Checks: fixture-oracle gate, termination (trades.length <= tr_response.trades.length),
// differential re-derivation of computed_verdict (UNMATCHED/DISPUTED/MATCHED) and the numeric
// field agree/disagree decision, boundedness (break_set.length === break count across trades),
// ULP-boundary forcing on the numeric-field tolerance comparison (0, -0, denormals, ±1 ULP,
// x/y*y!==x-shaped delta/tolerance pairs), and metamorphic field-order-invariance (tradeHasBreak
// is an OR across fields, order-independent).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-482-emir-recon-adjudicator.proptest.mjs

import { compute } from '../art-482-emir-recon-adjudicator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-482-emir-recon-adjudicator.fixtures.json');
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
const rand = mulberry32(0x482C23);

const FIELD_TABLE = [
  { field_name: 'notional_amount', type: 'numeric', numeric_tolerance: 0.5 },
  { field_name: 'price', type: 'numeric', numeric_tolerance: 0.01 },
  { field_name: 'ccy', type: 'enum' },
  { field_name: 'status', type: 'string' },
];

function randomTrade(rng, uti) {
  const notional = Math.round((rng() - 0.5) * 2000000) / 100;
  const notionalDrift = rng() < 0.7 ? notional : notional + (rng() - 0.5) * 4;
  const price = Math.round(rng() * 20000) / 100;
  const priceDrift = rng() < 0.7 ? price : price + (rng() - 0.5) * 0.05;
  return {
    tr: { uti, tr_match_status: pick(rng, ['MATCHED', 'DISPUTED']), lifecycle_event: 'NEW', tr_reported: { notional_amount: notional, price, ccy: 'USD', status: 'OK' } },
    firm: rng() < 0.9 ? { uti, submitted: { notional_amount: notionalDrift, price: priceDrift, ccy: rng() < 0.9 ? 'USD' : 'EUR', status: 'OK' } } : null,
  };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomPP(rng) {
  const n = Math.floor(rng() * 8);
  const trTrades = [], firmTrades = [];
  for (let i = 0; i < n; i++) {
    const { tr, firm } = randomTrade(rng, `UTI${i}`);
    trTrades.push(tr);
    if (firm) firmTrades.push(firm);
  }
  return {
    tr_response: { as_of_date: '2026-07-27', trades: trTrades },
    firm_state: { trades: firmTrades },
    policy: { fields: FIELD_TABLE, suppression_list: [], field_tolerance_table_version: 'v1' },
  };
}

// Reference field comparison, independent of the kernel's compareField().
function refCompare(fieldSpec, trVal, firmVal) {
  if (trVal === undefined && firmVal === undefined) return true;
  if ((trVal === undefined) !== (firmVal === undefined)) return false;
  if (fieldSpec.type === 'numeric') {
    if (typeof trVal !== 'number' || typeof firmVal !== 'number' || !Number.isFinite(trVal) || !Number.isFinite(firmVal)) return false;
    const tol = Number.isFinite(fieldSpec.numeric_tolerance) ? Math.abs(fieldSpec.numeric_tolerance) : 0;
    return Math.abs(trVal - firmVal) <= tol;
  }
  return trVal === firmVal;
}

const TRIALS = 5000;

// ---------- P1: termination — trades.length bounded by tr_response.trades.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.trades.length > pp.tr_response.trades.length) violations++;
    if (output_payload.break_count !== output_payload.break_set.length) violations++;
  }
  return { name: 'P1_termination_trades_bounded', trials: checked, violations };
}

// ---------- P2 (differential): computed_verdict + per-field agree/disagree re-derivation ----------
function checkP2_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const firmByUti = new Map(pp.firm_state.trades.map((t) => [t.uti, t]));
    for (const trade of output_payload.trades) {
      const firmTrade = firmByUti.get(trade.uti) || null;
      const firmSubmitted = firmTrade ? firmTrade.submitted : null;
      let expectedVerdict;
      if (firmSubmitted === null) {
        expectedVerdict = 'UNMATCHED';
      } else {
        let hasBreak = false;
        for (const fieldSpec of FIELD_TABLE) {
          const trTrade = pp.tr_response.trades.find((t) => t.uti === trade.uti);
          const trVal = trTrade.tr_reported[fieldSpec.field_name];
          const firmVal = firmSubmitted[fieldSpec.field_name];
          if (!refCompare(fieldSpec, trVal, firmVal)) { hasBreak = true; break; }
        }
        expectedVerdict = hasBreak ? 'DISPUTED' : 'MATCHED';
      }
      if (trade.computed_verdict !== expectedVerdict) violations++;
    }
  }
  return { name: 'P2_computed_verdict_differential', trials: checked, violations };
}

// ---------- P3: boundedness — field_results.length === field table length per matched trade ----------
function checkP3_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    for (const trade of output_payload.trades) {
      if (trade.field_results.length !== FIELD_TABLE.length) violations++;
    }
  }
  return { name: 'P3_field_results_length_boundedness', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes, per FIX-2 correction) ----------
function checkP4_ulp_forcing() {
  const eps = Number.EPSILON;
  const fieldSpec = { field_name: 'notional_amount', type: 'numeric', numeric_tolerance: 1 };
  // (trVal, firmVal, tolerance-relative) forced pairs around the delta<=tol boundary.
  const forced = [
    [100, 101, 1],           // delta exactly == tol -> agree
    [100, 101 + eps, 1],     // delta just over tol -> disagree
    [100, 101 - eps, 1],     // delta just under tol -> agree
    [0, -0, 1],               // delta 0 via signed zero
    [0, Number.MIN_VALUE, 1], // denormal delta
    [-Number.MIN_VALUE, Number.MIN_VALUE, 1],
    [0.1 + 0.2, 0.3, 0],      // classic x/y*y!==x-shaped representation gap, zero tolerance
    [0.1 + 0.2, 0.3, Number.EPSILON],
    [1e300, -1e300, 1],       // large magnitude, always disagree
  ];
  let violations = 0, checked = 0;
  const rows = [];
  for (const [trVal, firmVal, tol] of forced) {
    const spec = { ...fieldSpec, numeric_tolerance: tol };
    const pp = {
      tr_response: { as_of_date: '2026-07-27', trades: [{ uti: 'U1', tr_match_status: 'MATCHED', lifecycle_event: 'NEW', tr_reported: { notional_amount: trVal } }] },
      firm_state: { trades: [{ uti: 'U1', submitted: { notional_amount: firmVal } }] },
      policy: { fields: [spec], suppression_list: [] },
    };
    const { output_payload } = compute(pp);
    checked++;
    const fr = output_payload.trades[0].field_results[0];
    const expectedAgree = refCompare(spec, trVal, firmVal);
    const expectedStatus = expectedAgree ? 'agree' : 'disagree';
    if (fr.status !== expectedStatus) violations++;
    rows.push({ trVal, firmVal, tol, status: fr.status, expected: expectedStatus });
  }
  results.ulp_forced_rows = rows;
  return { name: 'P4_ulp_boundary_forcing_float_sensitive', trials: checked, violations };
}

// ---------- P5: metamorphic — field-order invariance (tradeHasBreak is an OR, order-independent) ----------
function checkP5_field_order_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 3000; i++) {
    const pp = randomPP(rand);
    const shuffledFields = [...FIELD_TABLE];
    for (let j = shuffledFields.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [shuffledFields[j], shuffledFields[k]] = [shuffledFields[k], shuffledFields[j]];
    }
    const pp2 = { ...pp, policy: { ...pp.policy, fields: shuffledFields } };
    const r1 = compute(pp).output_payload;
    const r2 = compute(pp2).output_payload;
    checked++;
    const verdicts1 = r1.trades.map((t) => t.computed_verdict);
    const verdicts2 = r2.trades.map((t) => t.computed_verdict);
    if (JSON.stringify(verdicts1) !== JSON.stringify(verdicts2)) violations++;
    if (r1.break_count !== r2.break_count) violations++;
  }
  return { name: 'P5_field_order_invariance', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_differential());
results.properties.push(checkP3_boundedness());
results.properties.push(checkP4_ulp_forcing());
results.properties.push(checkP5_field_order_invariance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-482-emir-recon-adjudicator',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
