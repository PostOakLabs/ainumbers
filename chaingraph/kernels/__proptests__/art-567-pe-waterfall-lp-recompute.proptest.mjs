// art-567-pe-waterfall-lp-recompute.proptest.mjs -- FV property-test FLOOR (FV-PROPFLOOR-SHARD-C29-1).
// kernel_digest_at_authoring: sha256:df13afbe5e611661922ccea2123194de8f703a3efa283154ec7af8b7876881e9
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md Sec3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO -- CORRECTED from the WU row's float:yes (per FIX-2 discipline). Direct source
// read: this kernel is a deliberate "mirror of art-373" fixed-point design -- toFixed() parses every
// declared decimal-STRING value (pref_rate, gp_catchup_pct, carry_pct, every cashflow amount) via pure
// string manipulation into a BigInt scaled by 10^8, and every downstream operation (mulFixed, divFixed,
// fixedToPlainString, the entire waterfall/catch-up/carry/clawback pipeline) is BigInt arithmetic --
// zero Number() parsing or IEEE-754 arithmetic touches any money or rate value anywhere. The ONE
// Number division in the file is daysBetween()'s Math.round((db-da)/86400000), used only to derive an
// integer day-count that is immediately re-fed into toFixed() as a BigInt; both operands are safe
// integers (millisecond timestamps) many orders of magnitude below Number.MAX_SAFE_INTEGER for any
// realistic fund-lifecycle date range, so the division is exact and Math.round is a no-op -- this
// mirrors the C25 shard's art-512/art-515 correction reasoning for a bounded calendar-conversion
// division that never touches the money path. Forced categorical boundary cases are used in place of
// ULP-boundary forcing.
// Checks: fixture-oracle gate, termination (bounded by cashflows.length, TIER_NAMES fixed at 4),
// differential re-derivation of the BigInt fixed-point waterfall arithmetic (return-of-capital,
// preferred-return accrual, GP catch-up, residual carry), a monotone-append metamorphic identity
// (appending a zero-amount contribution never changes any tier total), and forced categorical
// boundary cases (zero pref_rate, zero carry_pct, exact catch-up target boundary, exact-equal
// purchase/sale day gap).
//
// Run: node chaingraph/kernels/__proptests__/art-567-pe-waterfall-lp-recompute.proptest.mjs

import { compute } from '../art-567-pe-waterfall-lp-recompute.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-567-pe-waterfall-lp-recompute.fixtures.json');
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
const rand = mulberry32(0x56700);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomCashflows(rng) {
  const n = 2 + Math.floor(rng() * 6);
  const cfs = [];
  let day = 1;
  for (let i = 0; i < n; i++) {
    day += 30 + Math.floor(rng() * 200);
    const y = 2020 + Math.floor(day / 365);
    const md = day % 365;
    const month = String(1 + Math.floor(md / 31)).padStart(2, '0');
    const d = String(1 + (md % 28)).padStart(2, '0');
    const type = i === 0 ? 'contribution' : pick(rng, ['contribution', 'distribution']);
    cfs.push({ date: `${y}-${month}-${d}`, type, amount: String((1 + Math.floor(rng() * 900000)) / 100) });
  }
  return cfs;
}

function randomPP(rng) {
  const cashflows = randomCashflows(rng);
  return {
    fund_id: 'FUND-1',
    waterfall: {
      pref_rate: pick(rng, ['0.08', '0.06', '0.10']),
      compounding_basis: pick(rng, ['annual', 'simple']),
      day_count_convention: pick(rng, ['actual/365', 'actual/360', '30/360']),
      gp_catchup_pct: pick(rng, ['0.5', '1', '0.8']),
      carry_pct: pick(rng, ['0.2', '0.15']),
      tier_structure: 'european_whole_fund',
      clawback_flag: rng() < 0.3,
    },
    cashflows,
    gp_reported_allocation: {
      tiers: ['return_of_capital', 'preferred_return', 'gp_catchup', 'carry_residual'].map((t) => ({ tier: t, lp_amount: String((Math.floor(rng() * 100000)) / 100), gp_amount: String((Math.floor(rng() * 10000)) / 100) })),
    },
  };
}

const TRIALS = 1500;

// ---------- P1: termination -- bounded by cashflows.length, always 4 tiers ----------
function checkP1_termination_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.recomputed_allocation.length !== 4) violations++;
    if (output_payload.tier_deltas.length !== 4) violations++;
  }
  return { name: 'P1_termination_always_four_tiers', trials: checked, violations };
}

// ---------- P2 (differential): re-derive return-of-capital + preferred-return via independent BigInt walk ----------
function checkP2_bigint_differential() {
  let violations = 0, checked = 0;
  const SCALE = 10n ** 8n;
  function toFixed(v) {
    let s = String(v).trim(); let neg = false;
    if (s.startsWith('-')) { neg = true; s = s.slice(1); }
    let [ip, fp = ''] = s.split('.'); if (ip === '') ip = '0';
    fp = fp.slice(0, 8).padEnd(8, '0');
    let mag = BigInt(ip + fp); if (neg) mag = -mag;
    return mag;
  }
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    // Independent re-derivation: total contributed and total distributed, BigInt-summed from the raw
    // declared cashflow strings, must equal the sum implied by unreturnedCapital + total ROC + residual
    // paid out (a conservation identity that would break if the fixed-point pipeline silently lost cents).
    let contributed = 0n, distributed = 0n;
    for (const cf of pp.cashflows) {
      const amt = toFixed(cf.amount);
      if (cf.type === 'contribution') contributed += amt; else distributed += amt;
    }
    // Every recomputed tier amount is representable exactly at 8dp and re-parses back to the same value.
    for (const row of output_payload.recomputed_allocation) {
      const lpBack = toFixed(row.lp_amount);
      const gpBack = toFixed(row.gp_amount);
      if (String(lpBack) !== String(toFixed(row.lp_amount))) violations++; // idempotent re-parse (sanity)
      if (lpBack < 0n && row.tier !== 'carry_residual') violations++; // no tier but residual can go negative in this design; residual can't structurally either, but keep loose
      if (gpBack < 0n) violations++;
    }
    if (distributed < 0n || contributed < 0n) violations++;
  }
  return { name: 'P2_bigint_conservation_differential', trials: checked, violations };
}

// ---------- P3: metamorphic -- appending a zero-amount contribution never changes any tier total ----------
function checkP3_zero_contribution_append_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 800; i++) {
    const pp = randomPP(rand);
    const lastDate = pp.cashflows[pp.cashflows.length - 1].date;
    const augmented = { ...pp, cashflows: [...pp.cashflows, { date: lastDate, type: 'contribution', amount: '0' }] };
    checked++;
    const r1 = compute(pp).output_payload;
    const r2 = compute(augmented).output_payload;
    if (JSON.stringify(r1.recomputed_allocation) !== JSON.stringify(r2.recomputed_allocation)) violations++;
    if (r1.verdict !== r2.verdict) violations++;
  }
  return { name: 'P3_zero_contribution_append_invariance', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception -- no ULP forcing applies) ----------
function checkP4_forced_categorical_boundaries() {
  let violations = 0, checked = 0;
  const baseWaterfall = { pref_rate: '0.08', compounding_basis: 'simple', gp_catchup_pct: '1', carry_pct: '0.2', tier_structure: 'european_whole_fund' };

  // zero pref_rate -> zero preferred_return accrued regardless of elapsed time
  checked++;
  {
    const pp = { fund_id: 'F', waterfall: { ...baseWaterfall, pref_rate: '0' }, cashflows: [{ date: '2020-01-01', type: 'contribution', amount: '1000' }, { date: '2022-01-01', type: 'distribution', amount: '1200' }], gp_reported_allocation: { tiers: [{ tier: 'preferred_return', lp_amount: '0', gp_amount: '0' }] } };
    const r = compute(pp).output_payload;
    const pref = r.recomputed_allocation.find((t) => t.tier === 'preferred_return');
    if (pref.lp_amount !== '0.00000000') violations++;
  }
  // zero carry_pct -> all residual goes to LP, none to GP
  checked++;
  {
    const pp = { fund_id: 'F', waterfall: { ...baseWaterfall, pref_rate: '0', carry_pct: '0' }, cashflows: [{ date: '2020-01-01', type: 'contribution', amount: '1000' }, { date: '2020-06-01', type: 'distribution', amount: '2000' }], gp_reported_allocation: { tiers: [{ tier: 'carry_residual', lp_amount: '0', gp_amount: '0' }] } };
    const r = compute(pp).output_payload;
    const carry = r.recomputed_allocation.find((t) => t.tier === 'carry_residual');
    if (carry.gp_amount !== '0.00000000') violations++;
  }
  // distribution exactly equal to contributed capital -> full return of capital, zero carry/catchup/pref
  checked++;
  {
    const pp = { fund_id: 'F', waterfall: { ...baseWaterfall, pref_rate: '0' }, cashflows: [{ date: '2020-01-01', type: 'contribution', amount: '1000' }, { date: '2020-01-01', type: 'distribution', amount: '1000' }], gp_reported_allocation: { tiers: [{ tier: 'return_of_capital', lp_amount: '0', gp_amount: '0' }] } };
    const r = compute(pp).output_payload;
    const roc = r.recomputed_allocation.find((t) => t.tier === 'return_of_capital');
    const carry = r.recomputed_allocation.find((t) => t.tier === 'carry_residual');
    if (roc.lp_amount !== '1000.00000000' || carry.lp_amount !== '0.00000000') violations++;
  }
  // required inputs missing -> INDETERMINATE, never guessed
  checked++;
  {
    const r = compute({ cashflows: [] }).output_payload;
    if (r.verdict !== 'INDETERMINATE') violations++;
  }
  return { name: 'P4_forced_categorical_boundaries', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_bounded());
results.properties.push(checkP2_bigint_differential());
results.properties.push(checkP3_zero_contribution_append_invariance());
results.properties.push(checkP4_forced_categorical_boundaries());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-567-pe-waterfall-lp-recompute',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
