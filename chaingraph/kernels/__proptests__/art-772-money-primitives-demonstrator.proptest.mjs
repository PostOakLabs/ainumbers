// art-772-money-primitives-demonstrator — class-K property floor for the _money shared
// bundle (SHARED-MONEY-BUNDLE-1). Authored per FV-PBT-FLOOR-BUILD-SPEC.md.
// kernel_digest_at_authoring: sha256:f62737dbdb17a19dd9e2a94982362402465ce65482936b1e6ca3e4a9b3020f74
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

// ---------- P8: exact rounding table per mode (oracle: CPython decimal; mutation floor) ----------
// The mutation tier neutralizes the fixture-oracle leg, so the properties themselves must
// pin exact outputs. Table hand-derived and cross-checked against CPython 3.14.1 decimal.
const TABLE_ROWS = [['2.5',1,0],['-2.5',1,0],['2.25',2,1],['-2.25',2,1],['0.005',3,2],['-0.005',3,2],['1.55',2,1],['-1.55',2,1],['987654321.555',3,2],['-987654321.555',3,2],['1.5',1,0],['-1.5',1,0],['0.5',1,0],['-0.5',1,0],['2.75',2,1],['-2.75',2,1]];
const TABLE = {
  half_up:   ['3','-3','2.3','-2.3','0.01','-0.01','1.6','-1.6','987654321.56','-987654321.56','2','-2','1','-1','2.8','-2.8'],
  half_down: ['2','-2','2.2','-2.2','0.00','0.00','1.5','-1.5','987654321.55','-987654321.55','1','-1','0','0','2.7','-2.7'],
  half_even: ['2','-2','2.2','-2.2','0.00','0.00','1.6','-1.6','987654321.56','-987654321.56','2','-2','0','0','2.8','-2.8'],
  truncate:  ['2','-2','2.2','-2.2','0.00','0.00','1.5','-1.5','987654321.55','-987654321.55','1','-1','0','0','2.7','-2.7'],
  floor:     ['2','-3','2.2','-2.3','0.00','-0.01','1.5','-1.6','987654321.55','-987654321.56','1','-2','0','-1','2.7','-2.8'],
  ceiling:   ['3','-2','2.3','-2.2','0.01','0.00','1.6','-1.5','987654321.56','-987654321.55','2','-1','1','0','2.8','-2.7'],
};
function checkExactRoundingTable() {
  let checked = 0;
  let violations = 0;
  for (const mode of MODES) {
    TABLE_ROWS.forEach(([amt, scale, places], i) => {
      checked++;
      try {
        const r = money.round(money.parseDecimal(amt, scale), places, mode);
        if (money.toString(r, places) !== TABLE[mode][i]) violations++;
      } catch (e) {
        violations++;
      }
    });
  }
  return { name: 'P8_exact_rounding_table_all_modes', checked, violations };
}

// ---------- P9: allocation exact parts, tie-break, sign mirror ----------
function checkAllocateExactParts() {
  let checked = 0;
  let violations = 0;
  /** @type {{ t: string, s: number, w: bigint[], want: bigint[] }[]} */
  const cases = [
    { t: '100.00', s: 2, w: [1n, 1n, 1n], want: [3334n, 3333n, 3333n] }, // split3-first-index-tie-break
    { t: '10.00', s: 2, w: [1n, 2n, 4n], want: [143n, 286n, 571n] }, // weights-1-2-4
    { t: '0.01', s: 2, w: [1n, 1n, 1n], want: [1n, 0n, 0n] }, // one-cent-goes-to-first
    { t: '100.00', s: 2, w: [0n, 3n, 1n], want: [0n, 7500n, 2500n] }, // zero-weight-gets-zero
    { t: '5', s: 0, w: [1n, 1n, 1n, 1n, 1n], want: [1n, 1n, 1n, 1n, 1n] }, // jpy-ones
    { t: '7', s: 0, w: [1n, 1n, 1n], want: [3n, 2n, 2n] }, // int-floor-then-remainder
  ];
  for (const c of cases) {
    checked++;
    const fracLen = c.t.includes('.') ? c.t.split('.')[1].length : 0;
    const total = { v: BigInt(c.t.replace('.', '')) * 10n ** BigInt(c.s - fracLen), s: c.s };
    const parts = money.allocate(total, c.w);
    if (parts.map((p) => p.v).join(',') !== c.want.join(',')) violations++;
  }
  // sign mirror: allocate(-T, w) === -allocate(T, w) exactly, per part
  checked++;
  const T = { v: 100003n, s: 2 };
  const w = [1n, 2n, 5n];
  const pos = money.allocate(T, w);
  const neg = money.allocate({ v: -T.v, s: T.s }, w);
  if (pos.some((p, i) => p.v !== -neg[i].v)) violations++;
  // sum exactness at this exact case
  checked++;
  if (pos.reduce((a, p) => a + p.v, 0n) !== T.v) violations++;
  return { name: 'P9_allocate_exact_parts_tiebreak_signmirror', checked, violations };
}

// ---------- P10: kernel payload shape + echo semantics (exact, no fixture leg) ----------
const SLICE = {
  table_version: 'iso4217-amendment-180-2026-01-01',
  currencies: [
    { ccy: 'EUR', exponent: 2, status: 'effective', valid_from: '2026-01-01', valid_to: null },
    { ccy: 'JPY', exponent: 0, status: 'effective', valid_from: null, valid_to: null },
    { ccy: 'XXX', exponent: null, status: 'no_currency', valid_from: null, valid_to: null },
  ],
};
function computeOk(pp) {
  return compute(Object.assign({ amount: '10.00', ccy: 'EUR', mode: 'half_up', weights: [1, 2, 4], currency_slice: SLICE }, pp));
}
function checkKernelPayloadExact() {
  let checked = 0;
  let violations = 0;
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // exact core fields on the canonical call
  checked++;
  const out = computeOk({});
  const op = out.output_payload;
  if (!(op.status === 'OK' && op.error_code === null && op.mode === 'half_up' && op.mode_echo === 'half_up'
    && op.ccy === 'EUR' && op.exponent === 2 && op.places === 2
    && op.parsed_amount === '10.00' && op.rounded_amount === '10.00'
    && eq(op.allocations, ['1.43', '2.86', '5.71']) && op.allocation_sum === '10.00'
    && op.table_version === 'iso4217-amendment-180-2026-01-01'
    && eq(op.weights_echo, [1, 2, 4])
    && eq(out.compliance_flags, { MONEY_SLICE_IS_DATA_NOT_CODE: true, MONEY_PARSE_STRICT: true, MONEY_MODE_CLOSED_SET_REFUSES_UNKNOWNS: true, MONEY_ALLOCATE_SUMS_EXACTLY: true })
    && op.float_sensitive === false && eq(op.closed_mode_set, ['half_up', 'half_down', 'half_even', 'truncate', 'floor', 'ceiling'])
    && eq(op.bounds, { max_slice_entries: 64, max_scale: 38, max_alloc_parts: 1000, max_weight: 1000000000000000 })
    && eq(op.currency_entry_echo, { ccy: 'EUR', exponent: 2, status: 'effective', valid_from: '2026-01-01', valid_to: null }))) violations++;
  // places override: JPY (exponent 0) at places 0; EUR at places 1 rounds 10.55 -> 10.6 half_up
  checked++;
  if (computeOk({ ccy: 'JPY', amount: '5', weights: [1, 1, 1, 1, 1] }).output_payload.allocations.join(',') !== '1,1,1,1,1') violations++;
  checked++;
  if (computeOk({ amount: '10.55', places: 1, weights: [1] }).output_payload.rounded_amount !== '10.6') violations++;
  checked++;
  if (computeOk({ amount: '10.55', places: 4, weights: [1] }).output_payload.rounded_amount !== '10.5500') violations++;
  // truncate_excess echo, both directions
  checked++;
  if (computeOk({ amount: '10.005', truncate_excess: true, weights: [1] }).output_payload.truncate_excess_declared !== true) violations++;
  checked++;
  if (computeOk({ weights: [1] }).output_payload.truncate_excess_declared !== false) violations++;
  // parsed_amount at the EXPONENT, not at places
  checked++;
  if (computeOk({ amount: '10.5', places: 1, weights: [1] }).output_payload.parsed_amount !== '10.50') violations++;
  // entry echo selection: JPY exponent 0, XXX no-minor-unit refusal, missing ccy refusal
  checked++;
  if (computeOk({ ccy: 'JPY', amount: '5', weights: [1] }).output_payload.currency_entry_echo.exponent !== 0) violations++;
  checked++;
  if (computeOk({ ccy: 'XXX' }).output_payload.error_code !== 'REFUSED_CCY_NO_MINOR_UNIT') violations++;
  checked++;
  if (computeOk({ ccy: 'GBP' }).output_payload.error_code !== 'REFUSED_CCY_NOT_IN_SLICE') violations++;
  checked++;
  if (Object.keys(computeOk({ ccy: 'GBP' }).compliance_flags).join(',') !== 'MONEY_DEMONSTRATOR_REFUSED') violations++;
  // slice validation branches: each named refusal code is reachable and pinned
  const bad = [
    [null, 'REFUSED_SLICE_MALFORMED'],
    [{ currencies: [] }, 'REFUSED_SLICE_MALFORMED'],
    [{ currencies: [{ ccy: 'eur', exponent: 2 }] }, 'REFUSED_SLICE_MALFORMED'],
    [{ currencies: [{ ccy: 'EUR', exponent: 2 }, { ccy: 'EUR', exponent: 2 }] }, 'REFUSED_SLICE_MALFORMED'],
    [{ currencies: [{ ccy: 'EUR', exponent: 9 }] }, 'REFUSED_SLICE_MALFORMED'],
    [{ currencies: [{ ccy: 'EUR' }] }, 'REFUSED_SLICE_MALFORMED'],
  ];
  for (const [slice, code] of bad) {
    checked++;
    if (computeOk({ currency_slice: slice }).output_payload.error_code !== code) violations++;
  }
  // places bounds
  checked++;
  if (computeOk({ places: 39 }).output_payload.error_code !== 'REFUSED_PLACES_INVALID') violations++;
  checked++;
  if (computeOk({ places: -1 }).output_payload.error_code !== 'REFUSED_PLACES_INVALID') violations++;
  // weight validation branch
  checked++;
  if (computeOk({ weights: [1.5] }).output_payload.error_code !== 'REFUSED_ALLOCATE_WEIGHTS') violations++;
  // overflow branch (39 significant digits at EUR exponent 2)
  checked++;
  if (computeOk({ amount: '1' + '0'.repeat(38) }).output_payload.error_code !== 'REFUSED_MONEY_OVERFLOW') violations++;
  // refusal message carries the stable code prefix exactly once
  checked++;
  const msg = computeOk({ mode: 'bogus' }).output_payload.message;
  if (!(msg.startsWith('REFUSED_UNKNOWN_ROUNDING_MODE:') && msg.indexOf('REFUSED_UNKNOWN_ROUNDING_MODE:', 5) === -1)) violations++;
  return { name: 'P10_kernel_payload_exact_and_echo_semantics', checked, violations };
}

// ---------- P11: bundle validation refusals, boundaries, declared truncation ----------
function checkBundleValidationAndBounds() {
  let checked = 0;
  let violations = 0;
  const codeOf = (fn) => { try { fn(); return null; } catch (e) { return e instanceof money.MoneyRefusal ? e.code : 'NON_REFUSAL'; } };
  const msgOf = (fn) => { try { fn(); return null; } catch (e) { return e instanceof money.MoneyRefusal ? e.message : 'NON_REFUSAL'; } };
  const V = { v: 100n, s: 2 };
  // value-shape refusals, every public entry point
  const shapeBad = [
    () => money.round(null, 1, 'half_up'),
    () => money.round({ v: 1n }, 1, 'half_up'),
    () => money.round({ v: 1n, s: '2' }, 1, 'half_up'),
    () => money.round({ v: 1n, s: -1 }, 1, 'half_up'),
    () => money.round({ v: 1n, s: 39 }, 1, 'half_up'),
    () => money.mul(V, null, 'half_up', 2),
    () => money.div(null, V, 'half_up', 2),
    () => money.allocate(null, [1n]),
    () => money.toString({ v: 1n, s: 99 }, 2),
  ];
  for (const fn of shapeBad) {
    checked++;
    if (codeOf(fn) !== 'REFUSED_MONEY_SHAPE') violations++;
  }
  checked++;
  if (msgOf(() => money.round(null, 1, 'half_up')) !== 'REFUSED_MONEY_SHAPE: round expects {v: BigInt, s: integer scale 0..38}') violations++;
  // scale-argument refusals
  const scaleBad = [() => money.parseDecimal('1', -1), () => money.parseDecimal('1', 39), () => money.round(V, 39, 'half_up'), () => money.mul(V, V, 'half_up', -1), () => money.div(V, V, 'half_up', 39)];
  for (const fn of scaleBad) {
    checked++;
    if (codeOf(fn) !== 'REFUSED_MONEY_SCALE') violations++;
  }
  checked++;
  if (msgOf(() => money.round(V, 39, 'half_up')) !== 'REFUSED_MONEY_SCALE: round scale must be an integer 0..38, got 39') violations++;
  // significant-digit boundary: exactly 38 OK (leading zeros are not significant), 39 refused
  checked++;
  try { money.parseDecimal('1' + '0'.repeat(37), 0); } catch { violations++; }
  checked++;
  if (codeOf(() => money.parseDecimal('1' + '0'.repeat(38), 0)) !== 'REFUSED_MONEY_OVERFLOW') violations++;
  checked++;
  // zeros are not significant: 0. + 37 zeros + 1 at scale 38 is still 1 significant digit
  try { money.parseDecimal('0.' + '0'.repeat(37) + '1', 38); } catch { violations++; }
  checked++;
  if (msgOf(() => money.parseDecimal('1' + '0'.repeat(38), 0)) !== 'REFUSED_MONEY_OVERFLOW: value exceeds MAX_DIGITS=38 significant digits') violations++;
  // precision + declared truncation (toward zero), and the precision message
  checked++;
  if (msgOf(() => money.parseDecimal('1.999', 2)) !== 'REFUSED_MONEY_PRECISION: input has 3 fractional digits, scale is 2; pass {truncateExcess:true} to DECLARE truncation') violations++;
  checked++;
  try {
    const t = money.parseDecimal('1.999', 2, { truncateExcess: true });
    if (t.v !== 199n || t.s !== 2 || money.toString(t, 2) !== '1.99') violations++;
  } catch { violations++; }
  // exact parse-refusal message (grammar)
  checked++;
  if (msgOf(() => money.parseDecimal('1e5', 2)) !== 'REFUSED_MONEY_PARSE: expected -?digits(.digits)? at scale 2, got "1e5"') violations++;
  // toString refuses to round without a mode; exact code + message prefix
  checked++;
  if (codeOf(() => money.toString({ v: 155n, s: 2 }, 1)) !== 'REFUSED_ROUNDING_MODE_REQUIRED') violations++;
  // toString pads zeros when places exceeds the value scale; sign-minimal zero
  checked++;
  if (money.toString(money.parseDecimal('1.5', 2), 5) !== '1.50000') violations++;
  checked++;
  if (money.toString(money.parseDecimal('0', 2), 2) !== '0.00') violations++;
  checked++;
  if (money.toString(money.parseDecimal('-0.001', 3), 3) !== '-0.001') violations++;
  // allocate refusals: negative weight, non-bigint weight, zero weight sum, empty weights, negative-index message
  checked++;
  if (codeOf(() => money.allocate(V, [1n, -1n])) !== 'REFUSED_ALLOCATE_WEIGHTS') violations++;
  checked++;
  if (codeOf(() => money.allocate(V, [0n, 0n])) !== 'REFUSED_ALLOCATE_WEIGHTS') violations++;
  checked++;
  if (codeOf(() => money.allocate(V, [])) !== 'REFUSED_ALLOCATE_WEIGHTS') violations++;
  checked++;
  if (msgOf(() => money.allocate(V, [1n, 'x'])) !== 'REFUSED_ALLOCATE_WEIGHTS: weight[1] must be a non-negative BigInt, got "x"') violations++;
  checked++;
  if (codeOf(() => money.allocate({ v: -1n, s: 0 }, [1n])) !== null) violations++; // negative total legal: sign mirror
  // scale-mismatch refusals on add/sub/cmp
  for (const op of ['add', 'sub', 'cmp']) {
    checked++;
    if (codeOf(() => money[op]({ v: 1n, s: 1 }, { v: 1n, s: 2 })) !== 'REFUSED_SCALE_MISMATCH') violations++;
  }
  checked++;
  // String form: the bundle's inferred value type at this call site is loose, and a
  // direct bigint cast trips TS2352; the receipts are string-canonical anyway.
  const sumV = String(money.add({ v: 1n, s: 2 }, { v: 2n, s: 2 }).v);
  const subV = String(money.sub({ v: 1n, s: 2 }, { v: 2n, s: 2 }).v);
  const cmpV = String(money.cmp({ v: 1n, s: 2 }, { v: 2n, s: 2 }));
  if (sumV !== '3' || subV !== '-1' || cmpV !== '-1') violations++;
  // isParseable agrees with the grammar on both sides
  checked++;
  if (money.isParseable('12.34') !== true || money.isParseable('1e5') !== false || money.isParseable(12.34) !== false) violations++;
  // ACCEPT-path boundaries: the largest legal scale and smallest legal scale must PASS
  // (kills >= / <= boundary mutations of the validation guards that the refusal-only
  // assertions above cannot distinguish).
  checked++;
  try { const big = money.round(V, 38, 'half_up'); if (big.s !== 38 || big.v !== 100n * 10n ** 36n) violations++; } catch { violations++; }
  checked++;
  try { const z = money.parseDecimal('0', 0); if (z.v !== 0n || z.s !== 0) violations++; } catch { violations++; }
  checked++;
  try { if (money.toString(V, 38) !== '1.00' + '0'.repeat(36)) violations++; } catch { violations++; }
  checked++;
  try { if (money.parseDecimal('-0.5', 2).v !== -50n) violations++; } catch { violations++; }
  // arity boundary: MAX_ALLOC_PARTS weights allocate cleanly
  checked++;
  try {
    const many = new Array(1000).fill(1n);
    const parts = money.allocate({ v: 1000n, s: 2 }, many);
    if (parts.length !== 1000 || parts.reduce((a, p) => a + p.v, 0n) !== 1000n) violations++;
  } catch { violations++; }
  // exact unknown-mode messages from the closed-set guard
  checked++;
  if (msgOf(() => money.round(V, 1, 'bogus')) !== 'REFUSED_UNKNOWN_ROUNDING_MODE: round mode "bogus" is outside the closed set {half_up, half_down, half_even, truncate, floor, ceiling}') violations++;
  checked++;
  if (msgOf(() => money.round(V, 1, null)) !== 'REFUSED_UNKNOWN_ROUNDING_MODE: round mode must be a string, got object') violations++;
  return { name: 'P11_bundle_validation_bounds_declared_truncation', checked, violations };
}

// ---------- P12: div negative-tie table + mul exactness (all modes) ----------
function checkDivNegativeTable() {
  let checked = 0;
  let violations = 0;
  // -1.55 / 2 = -0.775 at scale 2
  const a = { v: -155n, s: 2 };
  const want = { half_up: '-0.78', half_down: '-0.77', half_even: '-0.78', truncate: '-0.77', floor: '-0.78', ceiling: '-0.77' };
  for (const mode of MODES) {
    checked++;
    if (money.toString(money.div(a, { v: 2n, s: 0 }, mode, 2), 2) !== want[mode]) violations++;
  }
  // exact-quotient path (r === 0) never perturbs: 1.50/2 = 0.75 everywhere
  checked++;
  for (const mode of MODES) {
    if (money.toString(money.div({ v: 150n, s: 2 }, { v: 2n, s: 0 }, mode, 2), 2) !== '0.75') violations++;
  }
  checked++;
  // mul by negative, out-scale pad: -1.11 * 2 = -2.22; -1.11 * 2 at scale 3 = -2.220
  if (money.toString(money.mul({ v: -111n, s: 2 }, { v: 2n, s: 0 }, 'half_up', 2), 2) !== '-2.22') violations++;
  checked++;
  if (money.toString(money.mul({ v: -111n, s: 2 }, { v: 2n, s: 0 }, 'half_up', 3), 3) !== '-2.220') violations++;
  // divisor scaling: a at scale 2 / b at scale 2 == same as scale-0 divisor
  checked++;
  if (money.toString(money.div({ v: 155n, s: 2 }, { v: 200n, s: 2 }, 'half_up', 2), 2) !== '0.78') violations++;
  return { name: 'P12_div_negative_ties_mul_sign_pad', checked, violations };
}

// ---------- P13: compute-routed refusal messages, exact (mutation floor) ----------
// Bundle-level tests cannot see the kernel's INLINED copy (mutations apply to the kernel
// file only), so every refusal string the kernel can emit is pinned here THROUGH compute().
function checkComputeRefusalMessages() {
  let checked = 0;
  let violations = 0;
  const msg = (pp) => computeOk(pp).output_payload.message;
  const want = (pp, m) => { checked++; const g = msg(pp); if (g !== m) { console.error('P13 DIFF want:', m, 'got:', g); violations++; } };
  want({ currency_slice: 'x' }, 'REFUSED_SLICE_MALFORMED: currency_slice must be an array of {ccy, exponent} entries');
  want({ currency_slice: { currencies: [] } }, 'REFUSED_SLICE_MALFORMED: currency_slice must hold 1..64 entries, got 0');
  want({ currency_slice: { currencies: [{ ccy: 'eur', exponent: 2 }] } }, 'REFUSED_SLICE_MALFORMED: currency_slice[0].ccy must be a 3-letter uppercase ISO 4217 code');
  want({ currency_slice: { currencies: [{ ccy: 'EUR', exponent: 2 }, { ccy: 'EUR', exponent: 2 }] } }, 'REFUSED_SLICE_MALFORMED: currency_slice carries duplicate code EUR');
  want({ currency_slice: { currencies: [{ ccy: 'EUR', exponent: 9 }] } }, 'REFUSED_SLICE_MALFORMED: currency_slice[0].exponent must be an integer 0..4 or null (no minor unit)');
  want({ currency_slice: { currencies: [{ ccy: 'EUR' }] } }, 'REFUSED_SLICE_MALFORMED: currency_slice[0].exponent must be an integer 0..4 or null (no minor unit)');
  want({ currency_slice: { currencies: [{ ccy: 'EUR', exponent: 2 }, 'x'] } }, 'REFUSED_SLICE_MALFORMED: currency_slice[1] is not an object');
  want({ ccy: 'GBP' }, 'REFUSED_CCY_NOT_IN_SLICE: currency code "GBP" is not in the caller-supplied currency_slice - exponents are data and this kernel bakes none');
  want({ ccy: 'XXX' }, 'REFUSED_CCY_NO_MINOR_UNIT: XXX has no minor unit in the supplied slice; minor-unit arithmetic is undefined');
  want({ amount: '10.005' }, 'REFUSED_MONEY_PRECISION: input has 3 fractional digits, scale is 2; pass {truncateExcess:true} to DECLARE truncation');
  want({ amount: '1e5' }, 'REFUSED_MONEY_PARSE: expected -?digits(.digits)? at scale 2, got "1e5"');
  want({ amount: 10 }, 'REFUSED_MONEY_PARSE: expected -?digits(.digits)? at scale 2, got ""');
  want({ places: 39 }, 'REFUSED_PLACES_INVALID: places must be an integer 0..38');
  want({ weights: [] }, 'REFUSED_ALLOCATE_WEIGHTS: weights must be a non-empty array of at most 1000 integers');
  want({ weights: [1, -2] }, 'REFUSED_ALLOCATE_WEIGHTS: weight[1] must be a non-negative safe integer <= 1000000000000000');
  want({ weights: [1, 2.5] }, 'REFUSED_ALLOCATE_WEIGHTS: weight[1] must be a non-negative safe integer <= 1000000000000000');
  want({ mode: 'bogus' }, 'REFUSED_UNKNOWN_ROUNDING_MODE: round mode "bogus" is outside the closed set {half_up, half_down, half_even, truncate, floor, ceiling}');
  want({ mode: null }, 'REFUSED_UNKNOWN_ROUNDING_MODE: round mode must be a string, got undefined'); // null canonicalizes to absent (R4)
  want({}, 'parsed at the currency exponent, rounded once with the required mode, allocated by largest remainder (parts sum exactly)');
  // MAX_SLICE_ENTRIES upper bound branch
  const big = { table_version: 't', currencies: [] };
  for (let i = 0; i < 65; i++) big.currencies.push({ ccy: 'A' + String(100 + i).padStart(0, '0'), exponent: 2 });
  // ensure 3-letter unique codes
  big.currencies = [];
  const pad2 = (n) => String(n).padStart(2, '0');
  for (let i = 0; i < 65; i++) big.currencies.push({ ccy: 'T' + pad2(i), exponent: 2 });
  // three-letter codes for the last entries keep the {ccy} shape honest
  for (let i = 0; i < 65; i++) if (i >= 26) big.currencies[i].ccy = 'T' + pad2(i);
  want({ currency_slice: big }, 'REFUSED_SLICE_MALFORMED: currency_slice must hold 1..64 entries, got 65');
  return { name: 'P13_compute_refusal_messages_exact', checked, violations };
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
  checkExactRoundingTable(),
  checkAllocateExactParts(),
  checkKernelPayloadExact(),
  checkBundleValidationAndBounds(),
  checkDivNegativeTable(),
  checkComputeRefusalMessages(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — SHARED-MONEY-BUNDLE-1 (_money bundle; fixture oracle: CPython 3.14.1 decimal).`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
