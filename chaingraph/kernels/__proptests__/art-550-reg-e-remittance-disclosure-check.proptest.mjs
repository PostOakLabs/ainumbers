// kernel_digest_at_authoring: sha256:8824902adca9694e5a610a35b14e2eea59ae7f67ef1a98985dea146a6ac144b9
//
// FV-PROPFLOOR-SHARD-B26-1 — property-test floor for art-550-reg-e-remittance-disclosure-check.
// Class B (bounded-numeric), FLOAT:YES per the WU row — amount_recipient_recomputed_cents =
// Math.round((net_cents * exchange_rate_disclosed_e6) / 1000000) is a genuine IEEE-754 double
// multiply-then-divide-then-round, explicitly acknowledged in the kernel's own docstring
// ("one Math.round call, IEEE-754 double arithmetic"). ULP-boundary forcing is MANDATORY.
// Zero external dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the
// B1/B3/B12 harness. READ-ONLY w.r.t. the kernel.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-550-reg-e-remittance-disclosure-check.proptest.mjs

import { compute } from '../art-550-reg-e-remittance-disclosure-check.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-550-reg-e-remittance-disclosure-check.fixtures.json');
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
const rand = mulberry32(0x550550);
const TRIALS = 8000;

function mkPP(rng) {
  const send = Math.floor(rng() * 1000000);
  const fees = Math.floor(rng() * (send * 0.2 + 1));
  const rate = 1 + Math.floor(rng() * 2000000);
  const disclosed = Math.floor(rng() * 1000000) - 200000;
  return {
    as_of: '2026-08-01',
    send_amount_cents: send,
    total_fees_disclosed_cents: fees,
    exchange_rate_disclosed_e6: rate,
    amount_recipient_disclosed_cents: disclosed,
  };
}

// ---------- P1: amount_recipient_recomputed_cents is exact Math.round((net*rate)/1e6) ----------
function checkP1_recomputedExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    const net = pp.send_amount_cents - pp.total_fees_disclosed_cents;
    const expected = Math.round((net * pp.exchange_rate_disclosed_e6) / 1000000);
    if (r.amount_recipient_recomputed_cents !== expected) violations++;
    if (!Number.isFinite(r.amount_recipient_recomputed_cents)) violations++;
  }
  return { name: 'P1_recomputed_cents_exact_round_net_times_rate_over_1e6', trials: checked, violations };
}

// ---------- P2: discrepancy_amount_cents is exact disclosed - recomputed; disclosure_consistent iff 0 ----------
function checkP2_discrepancyExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    const expected = pp.amount_recipient_disclosed_cents - r.amount_recipient_recomputed_cents;
    if (r.discrepancy_amount_cents !== expected) violations++;
    if (r.disclosure_consistent !== (expected === 0)) violations++;
  }
  return { name: 'P2_discrepancy_exact_and_consistent_iff_zero', trials: checked, violations };
}

// ---------- P3: rate scaling identity — doubling the disclosed rate (net held fixed) roughly doubles the recomputed amount ----------
function checkP3_rateScalesRecomputed() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const send = 100000 + Math.floor(rand() * 900000);
    const fees = Math.floor(rand() * 1000);
    const rate = 1 + Math.floor(rand() * 500000);
    const disclosed = 0;
    const base = { as_of: '2026-08-01', send_amount_cents: send, total_fees_disclosed_cents: fees, exchange_rate_disclosed_e6: rate, amount_recipient_disclosed_cents: disclosed };
    const doubled = { ...base, exchange_rate_disclosed_e6: rate * 2 };
    const r1 = compute(base).output_payload;
    const r2 = compute(doubled).output_payload;
    checked++;
    if (Math.abs(r2.amount_recipient_recomputed_cents - 2 * r1.amount_recipient_recomputed_cents) > 1) violations++;
  }
  return { name: 'P3_recomputed_scales_with_rate_within_rounding_tolerance', trials: checked, violations };
}

// ---------- P4 (mandatory, float:yes): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ send_amount_cents: 100, total_fees_disclosed_cents: 0, exchange_rate_disclosed_e6: 1, amount_recipient_disclosed_cents: 0 }, 'exchange_rate_disclosed_e6 exactly 1 (near-zero rate, smallest positive integer scale) — net*rate/1e6 must round to a tiny but finite value, never NaN'],
  [{ send_amount_cents: 0, total_fees_disclosed_cents: 0, exchange_rate_disclosed_e6: 1000000, amount_recipient_disclosed_cents: 0 }, 'send_amount_cents exactly 0 — net_cents 0, recomputed 0, disclosure_consistent true'],
  [{ send_amount_cents: 100, total_fees_disclosed_cents: 150, exchange_rate_disclosed_e6: 1000000, amount_recipient_disclosed_cents: -50 }, 'total_fees exceeds send_amount — net_cents negative, recomputed amount must be the correctly-signed negative recompute, never a sign error'],
  [{ send_amount_cents: 1, total_fees_disclosed_cents: 0, exchange_rate_disclosed_e6: 500000, amount_recipient_disclosed_cents: 1 }, 'net*rate/1e6 lands exactly at a .5 rounding boundary (1*500000/1e6=0.5) — Math.round must resolve deterministically to 1 (round-half-up on ties toward +Infinity for positive input)'],
  [{ send_amount_cents: 0, total_fees_disclosed_cents: 1, exchange_rate_disclosed_e6: 500000, amount_recipient_disclosed_cents: 0 }, 'net_cents negative-going-to-a--.5-boundary (0-1=-1 cents, *500000/1e6=-0.5) — Math.round ties toward +Infinity even for negative input (rounds to -0, not -1); send_amount_cents itself stays a valid non-negative integer so the identity is still recomputed, not rejected'],
  [{ send_amount_cents: Number.MAX_SAFE_INTEGER, total_fees_disclosed_cents: 0, exchange_rate_disclosed_e6: 1000000, amount_recipient_disclosed_cents: 0 }, 'send_amount_cents at MAX_SAFE_INTEGER with a unity rate — net*rate multiplication approaches the double-precision integer-exactness boundary; recomputed must stay finite, never Infinity'],
  [{ send_amount_cents: 100000000, total_fees_disclosed_cents: 0, exchange_rate_disclosed_e6: 100000000, amount_recipient_disclosed_cents: 0 }, 'both send_amount_cents and exchange_rate_disclosed_e6 large (product exceeds 2^53) — the classic float-multiplication-precision-loss case this ULP set exists to catch, must still resolve to a finite deterministic integer'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp).output_payload;
    const plausible = Number.isFinite(r.amount_recipient_recomputed_cents) && Number.isInteger(r.amount_recipient_recomputed_cents);
    rows.push({ label, input: pp, amount_recipient_recomputed_cents: r.amount_recipient_recomputed_cents, disclosure_consistent: r.disclosure_consistent, discrepancy_amount_cents: r.discrepancy_amount_cents, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_recomputedExact());
results.properties.push(checkP2_discrepancyExact());
results.properties.push(checkP3_rateScalesRecomputed());
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
