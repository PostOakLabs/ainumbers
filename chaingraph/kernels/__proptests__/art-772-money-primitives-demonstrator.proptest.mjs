// art-772-money-primitives-demonstrator — class-K property floor for the _money shared
// bundle (SHARED-MONEY-BUNDLE-1). Authored per FV-PBT-FLOOR-BUILD-SPEC.md.
// kernel_digest_at_authoring: sha256:ff6e0c2b54beeaf259b98652668ea26a1a6bd71144d2d1a58f5c21a18f626f3f
// spec: ACCT-INFRA-KERNELS-BUILD-SPEC.md §0.1/§1.4/§4.1 + row SHARED-MONEY-BUNDLE-1
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-772-money-primitives-demonstrator.proptest.mjs

import { compute } from '../art-772-money-primitives-demonstrator.kernel.mjs';
import * as money from '../_money.bundle.mjs';
import { runFixtureOracle, summarize, mulberry32 } from './_pbt-common.mjs';

const KERNEL_ID = 'art-772-money-primitives-demonstrator';
const MODES = ['half_up', 'half_down', 'half_even', 'truncate', 'floor', 'ceiling'];

// ---------- P1: allocate(total, weights) sums EXACTLY to total ----------
function checkAllocateSumsExactly() {
  const rng = mulberry32(0x5eed7772);
  let checked = 0;
  let violations = 0;
  for (let t = 0; t < 300; t++) {
    const scale = Math.floor(rng() * 5);
    const negative = rng() < 0.5;
    const major = Math.floor(rng() * 1000000);
    const total = { v: BigInt(negative ? -major : major) * 10n ** BigInt(scale) + BigInt(Math.floor(rng() * 100)), s: scale };
    const n = 1 + Math.floor(rng() * 12);
    const weights = [];
    for (let i = 0; i < n; i++) weights.push(BigInt(Math.floor(rng() * 1000)));
    if (!weights.some((w) => w !== 0n)) weights[0] = BigInt(1);
    try {
      const parts = money.allocate(total, weights);
      const sum = parts.reduce((a, p) => a + p.v, 0n);
      checked++;
      if (sum !== total.v || parts.length !== n || parts.some((p) => p.s !== scale)) violations++;
      if (parts.some((p) => (total.v >= 0n ? p.v < 0n || p.v > total.v : p.v > 0n || p.v < total.v))) violations++;
    } catch (e) {
      checked++;
      violations++;
    }
  }
  return { name: 'P1_allocate_sums_exactly', checked, violations };
}

// ---------- P2: round is idempotent (every mode, random values and scales) ----------
function checkRoundIdempotent() {
  const rng = mulberry32(0x5eed7773);
  let checked = 0;
  let violations = 0;
  for (let t = 0; t < 360; t++) {
    const sFrom = 2 + Math.floor(rng() * 6);
    const places = Math.max(0, sFrom - 1 - Math.floor(rng() * 3));
    const mode = MODES[Math.floor(rng() * MODES.length)];
    const neg = rng() < 0.5;
    const mag = BigInt(Math.floor(rng() * 1e9)) * 10n ** BigInt(sFrom) + BigInt(Math.floor(rng() * 100));
    const val = { v: neg ? -mag : mag, s: sFrom };
    const r1 = money.round(val, places, mode);
    const r2 = money.round(r1, places, mode);
    checked++;
    if (r1.v !== r2.v || r1.s !== r2.s) violations++;
  }
  return { name: 'P2_round_idempotent_all_modes', checked, violations };
}

// ---------- P3: half_even is unbiased over a symmetric grid ----------
// Rounding the one-sided grid k/100 in [0.00, 20.00] at 1 decimal place: half_up
// drifts UP on every x.x5 tie (200 ties, one-sided), while half_even's ties alternate
// up/down within each decade and its net drift is exactly zero on this grid.
function checkHalfEvenUnbiased() {
  let checked = 0;
  let violations = 0;
  let sumHe = 0n; // rounded sums, hundredths
  let sumHu = 0n;
  let sumRaw = 0n; // raw grid sum, hundredths
  let count = 0;
  for (let cents = 0; cents <= 2000; cents++) {
    const v = { v: BigInt(cents), s: 2 };
    sumHe += BigInt(money.round(v, 1, 'half_even').v) * 10n; // tenth -> hundredth
    sumHu += BigInt(money.round(v, 1, 'half_up').v) * 10n;
    sumRaw += BigInt(cents);
    count++;
    checked++;
  }
  // Drift measure: |sum(rounded) - sum(raw)| over the one-sided grid, in hundredths.
  // half_even must land EXACTLY on the raw sum (its x.x5 ties alternate up/down and
  // cancel per decade); half_up's away-from-zero ties leave a strictly positive drift.
  const heDrift = sumHe >= sumRaw ? sumHe - sumRaw : sumRaw - sumHe;
  const huDrift = sumHu >= sumRaw ? sumHu - sumRaw : sumRaw - sumHu;
  if (huDrift === 0n) violations++; // sanity: away-from-zero ties must expose drift
  if (heDrift !== 0n) violations++; // half_even's alternating ties must cancel exactly here
  if (heDrift * 100n > huDrift) violations++; // belt and braces: at most 1% of half_up's
  return { name: 'P3_half_even_unbiased_symmetric_grid', checked, violations, detail: `count=${count} heDrift=${heDrift} huDrift=${huDrift}` };
}

// ---------- P4: parseDecimal -> toString round-trips at the parse scale ----------
function checkParseToStringRoundTrip() {
  const rng = mulberry32(0x5eed7774);
  let checked = 0;
  let violations = 0;
  const samples = ['0.00', '0.00', '123.45', '-123.45', '0.01', '-0.01', '99999999999999999999999999999999.99', '-99999999999999999999999999999999.99'];
  for (const s of samples) {
    checked++;
    try {
      const v = money.parseDecimal(s, 2);
      if (money.toString(v, 2) !== s) violations++;
    } catch (e) {
      violations++;
    }
  }
  // BigInt has no negative zero, so '-0.00' canonically round-trips to '0.00' - checked
  // explicitly instead of in the exact-equality sample list.
  checked++;
  try {
    if (money.toString(money.parseDecimal('-0.00', 2), 2) !== '0.00') violations++;
  } catch (e) {
    violations++;
  }
  for (let t = 0; t < 300; t++) {
    const scale = Math.floor(rng() * 5);
    const intPart = Math.floor(rng() * 1e9).toString();
    let frac = '';
    for (let i = 0; i < scale; i++) frac += String(Math.floor(rng() * 10));
    if (intPart === '0' && /^0*$/.test(frac)) frac = frac.slice(0, -1) + '1'; // keep the sign meaningful
    const s = (rng() < 0.5 ? '-' : '') + intPart + (scale > 0 ? '.' + frac : '');
    checked++;
    try {
      const v = money.parseDecimal(s, scale);
      if (money.toString(v, scale) !== s) violations++;
    } catch (e) {
      violations++;
    }
  }
  return { name: 'P4_parse_toString_round_trip', checked, violations };
}

// ---------- P5: closed mode set — unknown/missing tokens are structured refusals, never fallbacks (D8/D11) ----------
function checkUnknownModeRefused() {
  let checked = 0;
  let violations = 0;
  const bad = ['HALF_UP', 'halfup', 'bogus', 'floorCeiling', ''];
  for (const m of bad) {
    checked++;
    try {
      money.round({ v: 250n, s: 2 }, 1, m);
      violations++; // a fallback would return here
    } catch (e) {
      if (!(e instanceof money.MoneyRefusal) || e.code !== 'REFUSED_UNKNOWN_ROUNDING_MODE') violations++;
    }
  }
  checked++;
  try {
    money.round({ v: 250n, s: 2 }, 1, undefined);
    violations++;
  } catch (e) {
    if (e.code !== 'REFUSED_UNKNOWN_ROUNDING_MODE') violations++;
  }
  // the demonstrator kernel surfaces the same refusal as a structured output_payload
  checked++;
  const out = compute({ amount: '2.50', ccy: 'EUR', mode: 'bogus', weights: [1], currency_slice: { table_version: 't', currencies: [{ ccy: 'EUR', exponent: 2 }] } });
  if (out.output_payload.status !== 'REFUSED' || out.output_payload.error_code !== 'REFUSED_UNKNOWN_ROUNDING_MODE') violations++;
  return { name: 'P5_unknown_mode_structured_refusal', checked, violations };
}

// ---------- P6: grammar is closed — exponent/comma/empty never parse to a silent zero (D7) ----------
function checkGrammarClosed() {
  let checked = 0;
  let violations = 0;
  const bad = ['1e5', '1,000', '', ' ', '+1.00', '.', '1.', '-.5', '0x10', '1.2.3', 'NaN', 'Infinity', '1 000'];
  for (const s of bad) {
    checked++;
    try {
      money.parseDecimal(s, 2);
      violations++; // any parse here is the D7 defect
    } catch (e) {
      if (!(e instanceof money.MoneyRefusal) || e.code !== 'REFUSED_MONEY_PARSE') violations++;
    }
  }
  return { name: 'P6_parse_grammar_closed', checked, violations };
}

// ---------- P7: mul/div single-rounding; zero divisor refuses (D7's silent 0) ----------
function checkMulDiv() {
  let checked = 0;
  let violations = 0;
  // 1.55 / 2 = 0.775: half_up -> 0.78, half_even -> 0.78 (7 odd), truncate -> 0.77, floor -> 0.77, ceiling -> 0.78, half_down -> 0.77
  const a = { v: 155n, s: 2 };
  const expected = { half_up: '0.78', half_down: '0.77', half_even: '0.78', truncate: '0.77', floor: '0.77', ceiling: '0.78' };
  for (const mode of MODES) {
    checked++;
    const r = money.div(a, { v: 2n, s: 0 }, mode, 2);
    if (money.toString(r, 2) !== expected[mode]) violations++;
  }
  checked++;
  try {
    money.div(a, { v: 0n, s: 0 }, 'half_up', 2);
    violations++; // a silent 0 here is the D7 defect
  } catch (e) {
    if (e.code !== 'REFUSED_DIVIDE_BY_ZERO') violations++;
  }
  // mul: 1.11 * 1.11 = 1.2321 -> at scale 2 half_up = 1.23, floor = 1.23, ceiling = 1.24
  const p = { v: 111n, s: 2 };
  checked += 3;
  if (money.toString(money.mul(p, p, 'half_up', 2), 2) !== '1.23') violations++;
  if (money.toString(money.mul(p, p, 'floor', 2), 2) !== '1.23') violations++;
  if (money.toString(money.mul(p, p, 'ceiling', 2), 2) !== '1.24') violations++;
  return { name: 'P7_mul_div_single_rounding_and_zero_divisor', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(fixtures load)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkAllocateSumsExactly(),
  checkRoundIdempotent(),
  checkHalfEvenUnbiased(),
  checkParseToStringRoundTrip(),
  checkUnknownModeRefused(),
  checkGrammarClosed(),
  checkMulDiv(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — SHARED-MONEY-BUNDLE-1 (_money bundle; fixture oracle: CPython 3.14.1 decimal).`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
