// art-850-shariah-equity-purification — class-K property-test floor.
// kernel_digest_at_authoring: sha256:88ef28e687acec45d18a89748966234a7205381a374b6c38dbc1b2665a29bfd4
// spec: research/ISLAMIC-FINANCE-BUILD-SPEC-2026-11.md §5 node D (row ISLAMIC-EQUITY-SCREEN-1)
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Properties:
//   P1 verdict exactness  — every ratio row's compliant bit equals an independent BigInt
//                           cross-multiplication of the reported figures against the pinned
//                           per-profile threshold table; verdict flips exactly at thresholds
//                           (equality passes, one minor unit over fails) across randomized inputs.
//   P2 profile independence — verdict groups for different authorities share no state: mutating
//                           which authorities are requested changes ONLY the requested groups;
//                           groups for an authority are identical whether it runs alone or with
//                           any subset of the others.
//   P3 determinism + shape — compute is pure: same input, identical payload; payload carries
//                           not_a_shariah_ruling on every run, warnings mirror flags, ratio rows
//                           carry the declared fields.
//   P4 purification math  — floor + named residual reconstruct the exact share; purified <=
//                           dividend; zero dividend -> zero purification; absent -> null;
//                           inconsistent income -> null + flag, verdicts untouched.
//   P5 refusal contract   — hostile inputs (each input class, prototype-named keys, unsafe
//                           integers, wrong types, out-of-bounds, missing required) refuse with
//                           named flags, verdicts null, and echo no values back except the
//                           offending methodology string.
//   P6 carve-out + switch — compliant-debt subtraction only for the pinned country set, only
//                           when it removes something, and only on the debt numerator; the
//                           daily-average denominator switches to total assets exactly when the
//                           exact mean falls below total assets.
//   P7 input contract     — safe-integer bounds hold across randomization; every declared
//                           bound refusal fires at the boundary (0/1e15 amounts, 1e13 elements).
//   P8 buildArtifact never throws — hostile preimages (non-finite, unsafe integer, bigint,
//                           too deep, too wide) mint null execution_hash + refusal;
//                           hashable inputs hash; never throws on any generated input.
//
// Run: node chaingraph/kernels/__proptests__/art-850-shariah-equity-purification.proptest.mjs

import { buildArtifact, compute, AUTHORITIES, METHODOLOGY_AS_OF, MAX_AMOUNT_MINOR, MAX_SERIES_ELEMENT_MINOR, MAX_SERIES_LEN, MAX_MSCI_WINDOW_MONTHS } from '../art-850-shariah-equity-purification.kernel.mjs';
import { runFixtureOracle, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-850-shariah-equity-purification';

// ---------- deterministic PRNG (xorshift32; fixed seeds, no Math.random) ----------
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

// ---------- independent threshold tables (re-stated from the pinned primary texts,
// never imported from the kernel: an import would make the oracle read the code under test) ----------
const RETENTION = {
  msci_islamic: { total_debt: 3333, cash_and_interest_bearing_securities: 3333, receivables_and_cash: 3333 },
  msci_islamic_m: { total_debt: 3333, cash_and_interest_bearing_securities: 3333, receivables_and_cash: 4900 },
};
const ENTRY = {
  msci_islamic: { total_debt: 3000, cash_and_interest_bearing_securities: 3000, receivables_and_cash: 3000 },
  msci_islamic_m: { total_debt: 3000, cash_and_interest_bearing_securities: 3000, receivables_and_cash: 4600 },
};
const FTSE = { business_activity: 500, total_debt: 3300, cash_and_interest_bearing_securities: 3300, non_permissible_income: 500 };
const NIFTY = { interest_based_debt: 2500, interest_income_plus_imputed: 300, receivables_and_cash_bank: 9000 };
const CARVEOUT = ['BH', 'KW', 'OM', 'QA', 'AE', 'BD', 'EG', 'ID', 'MY', 'PK', 'TR'];

// ---------- input generator ----------
// Builds VALID inputs in the declared domain (amounts within bounds, series 1..600 valid
// elements, exactly the required fields per requested authority) plus random junk fields.
function genValidInput(r) {
  const authorities = [...AUTHORITIES].filter(() => r() < 0.5);
  if (authorities.length === 0) authorities.push(pick(r, AUTHORITIES));
  const pp = { methodologies: authorities };
  const money = () => int(r, 0, MAX_AMOUNT_MINOR);
  const wants = (a) => authorities.includes(a);
  const wantsMsci = wants('msci_islamic') || wants('msci_islamic_m');
  if (wantsMsci || wants('ftse_idealratings') || wants('nifty_tasis')) pp.total_assets_minor = int(r, 1, MAX_AMOUNT_MINOR);
  pp.total_debt_minor = money();
  pp.cash_and_interest_bearing_securities_minor = money();
  if (wantsMsci || wants('ftse_idealratings') || wants('nifty_tasis')) pp.receivables_minor = money();
  if (wants('ftse_idealratings')) {
    pp.total_revenue_minor = int(r, 1, MAX_AMOUNT_MINOR);
    pp.non_permissible_revenue_minor = money();
    pp.interest_income_minor = money();
    pp.total_income_minor = int(r, 1, MAX_AMOUNT_MINOR);
  }
  if (wants('nifty_tasis')) {
    pp.interest_income_minor = money();
    pp.total_income_minor = int(r, 1, MAX_AMOUNT_MINOR);
    pp.interest_based_investments_minor = money();
  }
  if (wantsMsci) {
    pp.is_current_constituent = r() < 0.5;
    pp.country_code = pick(r, CARVEOUT.concat(['US', 'GB', 'JP', 'DE']));
    if (CARVEOUT.includes(pp.country_code)) pp.shariah_compliant_debt_minor = int(r, 0, pp.total_debt_minor);
  }
  if (wants('msci_islamic_m') || wants('ftse_idealratings')) {
    const len = int(r, 1, 80);
    pp.market_cap_series_minor = Array.from({ length: len }, () => int(r, 1, MAX_SERIES_ELEMENT_MINOR));
    pp.market_cap_series_period = wants('msci_islamic_m') ? 'month_end' : pick(r, ['day', 'month_end']);
  }
  if (r() < 0.6) {
    pp.dividend_minor = money();
    if (wantsMsci) {
      if (pp.total_income_minor === undefined) pp.total_income_minor = int(r, 1, MAX_AMOUNT_MINOR);
      // keep the purification factor defined most of the time (sometimes deliberately not)
      pp.non_permissible_revenue_minor = int(r, 0, Math.floor(pp.total_income_minor / 2));
      pp.interest_income_minor = int(r, 0, Math.floor(pp.total_income_minor / 3));
    }
  }
  return pp;
}

// ---------- P1: verdict exactness vs independent BigInt recomputation ----------
function exactRowCheck(num, bp, den) { return BigInt(num) * 10000n <= BigInt(bp) * BigInt(den); }
function exactMeanRowCheck(num, sum, len, bp) { return BigInt(num) * 10000n * BigInt(len) <= BigInt(bp) * sum; }

function checkVerdictExactness() {
  const r = rng(0xA85001);
  let checked = 0;
  const violations = [];
  for (let i = 0; i < 220; i++) {
    const pp = genValidInput(r);
    const out = compute(structuredClone(pp));
    if (out.output_payload.valid_input === false) continue;
    const ta = pp.total_assets_minor;
    const debt = pp.total_debt_minor;
    const cash = pp.cash_and_interest_bearing_securities_minor;
    const rec = pp.receivables_minor;
    // series sums
    const series = pp.market_cap_series_minor;
    let mSum = 0n; let mLen = 0;
    if (Array.isArray(series) && pp.market_cap_series_period === 'month_end') {
      mLen = Math.min(MAX_MSCI_WINDOW_MONTHS, series.length);
      for (let j = series.length - mLen; j < series.length; j++) mSum += BigInt(series[j]);
    }
    let fSum = 0n; let fLen = 0;
    if (Array.isArray(series)) { fLen = series.length; for (const e of series) fSum += BigInt(e); }
    const debtNum = (pp.shariah_compliant_debt_minor !== undefined && CARVEOUT.includes(pp.country_code) && pp.shariah_compliant_debt_minor > 0)
      ? debt - pp.shariah_compliant_debt_minor : debt;

    for (const [a, v] of Object.entries(out.output_payload.verdicts)) {
      if (v.ratios.length === 0) continue;
      const isEntry = a === 'msci_islamic' || a === 'msci_islamic_m' ? !pp.is_current_constituent : false;
      const tbl = isEntry ? ENTRY[a] : (a === 'msci_islamic' || a === 'msci_islamic_m' ? RETENTION[a] : a === 'ftse_idealratings' ? FTSE : NIFTY);
      if (tbl === undefined) violations.push(`${i}:${a} no threshold table for authority`);
      let allOk = true;
      for (const row of v.ratios) {
        if (row.threshold_bp === null) continue; // the null dividend-adjustment marker row
        checked++;
        let expect;
        if (a === 'msci_islamic') {
          expect = exactRowCheck(row.numerator_minor, row.threshold_bp, ta);
        } else if (a === 'msci_islamic_m') {
          expect = exactMeanRowCheck(row.numerator_minor, mSum, mLen, row.threshold_bp);
        } else if (a === 'ftse_idealratings') {
          if (row.ratio === 'business_activity') expect = exactRowCheck(pp.non_permissible_revenue_minor, FTSE.business_activity, pp.total_revenue_minor);
          else if (row.ratio === 'non_permissible_income') expect = exactRowCheck(pp.interest_income_minor + pp.non_permissible_revenue_minor, FTSE.non_permissible_income, pp.total_income_minor);
          else if (row.denominator_used === 'total_assets') expect = exactRowCheck(row.numerator_minor, row.threshold_bp, ta);
          else expect = exactMeanRowCheck(row.numerator_minor, fSum, fLen, row.threshold_bp);
        } else {
          if (row.ratio === 'interest_income_plus_imputed') {
            const lhs = BigInt(pp.interest_income_minor) * 10000n + 750n * BigInt(pp.interest_based_investments_minor);
            expect = lhs <= BigInt(NIFTY.interest_income_plus_imputed) * BigInt(pp.total_income_minor);
          } else expect = exactRowCheck(row.numerator_minor, row.threshold_bp, ta);
        }
        if (row.compliant !== expect) violations.push(`${i}:${a}:${row.ratio} kernel ${row.compliant} vs exact ${expect}`);
        if (!row.compliant) allOk = false;
      }
      if (v.ratios.some((row) => row.threshold_bp === null) ? v.compliant !== (v.ratios.filter((x) => x.threshold_bp !== null).every((x) => x.compliant)) : v.compliant !== allOk) {
        violations.push(`${i}:${a} overall verdict inconsistent with its rows`);
      }
    }
  }
  return { name: 'P1-verdict-exactness-and-threshold-flip', checked, violations };
}

// P1b: directed threshold flips — at a random threshold boundary the verdict flips exactly there
function checkThresholdFlips() {
  const r = rng(0xA85002);
  let checked = 0;
  const violations = [];
  for (let i = 0; i < 40; i++) {
    // long-form debt row flip
    const ta = int(r, 2, 10 ** 12);
    const bp = r() < 0.5 ? 3333 : 3000;
    const boundary = Number((BigInt(bp) * BigInt(ta)) / 10000n);
    if (boundary < 1 || boundary > MAX_AMOUNT_MINOR) continue;
    const base = {
      methodologies: ['msci_islamic'],
      is_current_constituent: bp === 3333,
      country_code: 'US',
      total_assets_minor: ta,
      total_debt_minor: boundary,
      cash_and_interest_bearing_securities_minor: 0,
      receivables_minor: 0,
    };
    const eq = compute({ ...base });
    const over = compute({ ...base, total_debt_minor: boundary + 1 });
    if (!eq.output_payload.valid_input || !over.output_payload.valid_input) { violations.push(`${i}: boundary input refused`); continue; }
    if (eq.output_payload.verdicts.msci_islamic.ratios[0].compliant !== true) violations.push(`${i}: equality at ${bp}bp did not pass`);
    if (over.output_payload.verdicts.msci_islamic.ratios[0].compliant !== false) violations.push(`${i}: one minor unit over ${bp}bp did not fail`);
    checked += 2;
    // nifty imputed row flip (ibi multiple of 10000 keeps the reported numerator exact)
    const ti = int(r, 1000, 10 ** 12);
    const iiBoundary = Number((300n * BigInt(ti)) / 10000n);
    if (iiBoundary >= 0 && iiBoundary <= MAX_AMOUNT_MINOR) {
      const nb = {
        methodologies: ['nifty_tasis'],
        total_assets_minor: int(r, 1, MAX_AMOUNT_MINOR),
        total_debt_minor: 0,
        cash_and_interest_bearing_securities_minor: 0,
        receivables_minor: 0,
        interest_income_minor: iiBoundary,
        total_income_minor: ti,
        interest_based_investments_minor: 0,
      };
      const eqN = compute({ ...nb });
      const overN = compute({ ...nb, interest_income_minor: iiBoundary + 1 });
      if (eqN.output_payload.verdicts.nifty_tasis.ratios[1].compliant !== true) violations.push(`${i}: nifty 3% equality did not pass`);
      if (overN.output_payload.verdicts.nifty_tasis.ratios[1].compliant !== false) violations.push(`${i}: nifty 3% one-over did not fail`);
      checked += 2;
    }
    // daily-average switch flip: mean above TA (no switch) vs mean below TA (switch);
    // the boundary itself (mean == TA) does NOT switch — the fallback reads "falls below".
    const taF = int(r, 2, 10 ** 12);
    const noSwitch = compute({
      methodologies: ['ftse_idealratings'],
      total_assets_minor: taF,
      total_debt_minor: int(r, 1, MAX_AMOUNT_MINOR),
      cash_and_interest_bearing_securities_minor: int(r, 1, MAX_AMOUNT_MINOR),
      total_revenue_minor: int(r, 1, MAX_AMOUNT_MINOR),
      non_permissible_revenue_minor: 0,
      interest_income_minor: 0,
      total_income_minor: int(r, 1, MAX_AMOUNT_MINOR),
      market_cap_series_minor: [taF * 2, taF * 2],
      market_cap_series_period: 'day',
    });
    const switchIn = compute({
      methodologies: ['ftse_idealratings'],
      total_assets_minor: taF,
      total_debt_minor: int(r, 1, MAX_AMOUNT_MINOR),
      cash_and_interest_bearing_securities_minor: int(r, 1, MAX_AMOUNT_MINOR),
      total_revenue_minor: int(r, 1, MAX_AMOUNT_MINOR),
      non_permissible_revenue_minor: 0,
      interest_income_minor: 0,
      total_income_minor: int(r, 1, MAX_AMOUNT_MINOR),
      market_cap_series_minor: [taF, taF - 1],
      market_cap_series_period: 'day',
    });
    if (noSwitch.output_payload.warnings.includes('FTSE_DENOMINATOR_SWITCHED_TO_TOTAL_ASSETS')) violations.push(`${i}: switch fired while mean(2TA,2TA) > TA`);
    if (!switchIn.output_payload.warnings.includes('FTSE_DENOMINATOR_SWITCHED_TO_TOTAL_ASSETS')) violations.push(`${i}: mean(TA,TA-1) < TA did not switch`);
    checked += 2;
  }
  return { name: 'P1b-directed-threshold-and-switch-flips', checked, violations };
}

// ---------- P2: profile independence (never merged) ----------
function checkProfileIndependence() {
  const r = rng(0xA85003);
  let checked = 0;
  const violations = [];
  for (let i = 0; i < 60; i++) {
    const pp = genValidInput(r);
    const solo = {};
    for (const a of pp.methodologies) {
      const one = compute(structuredClone({ ...pp, methodologies: [a] }));
      if (one.output_payload.valid_input) solo[a] = one.output_payload.verdicts[a];
    }
    const all = compute(structuredClone(pp));
    if (!all.output_payload.valid_input) continue;
    for (const [a, v] of Object.entries(all.output_payload.verdicts)) {
      if (solo[a] && JSON.stringify(solo[a]) !== JSON.stringify(v)) violations.push(`${i}:${a} verdict differs solo vs joint`);
      checked++;
    }
    if (Object.keys(all.output_payload.verdicts).length !== pp.methodologies.length) violations.push(`${i} verdict groups != requested authorities`);
  }
  return { name: 'P2-profile-independence-never-merged', checked, violations };
}

// ---------- P3: determinism + shape ----------
function checkDeterminismAndShape() {
  const r = rng(0xA85004);
  let checked = 0;
  const violations = [];
  for (let i = 0; i < 50; i++) {
    const pp = genValidInput(r);
    const a = compute(structuredClone(pp));
    const b = compute(structuredClone(pp));
    if (JSON.stringify(a) !== JSON.stringify(b)) violations.push(`${i}: nondeterministic output`);
    if (a.output_payload.valid_input === false) continue;
    const flags = a.compliance_flags;
    if (JSON.stringify(a.output_payload.warnings) !== JSON.stringify(flags)) violations.push(`${i}: warnings do not mirror flags`);
    if (a.output_payload.not_a_shariah_ruling !== true) violations.push(`${i}: not_a_shariah_ruling missing`);
    for (const [auth, v] of Object.entries(a.output_payload.verdicts)) {
      if (METHODOLOGY_AS_OF[auth] === undefined || v.methodology_as_of !== METHODOLOGY_AS_OF[auth]) violations.push(`${i}: missing/stale methodology_as_of for ${auth}`);
      for (const row of v.ratios) {
        for (const f of ['ratio', 'numerator_minor', 'denominator_minor', 'denominator_used', 'threshold_bp', 'comparison', 'compliant']) {
          if (!(f in row)) violations.push(`${i}: ratio row missing ${f}`);
        }
        if (row.numerator_minor !== null && !Number.isSafeInteger(row.numerator_minor)) violations.push(`${i}: payload numerator not a safe integer`);
        if (row.denominator_minor !== null && !Number.isSafeInteger(row.denominator_minor)) violations.push(`${i}: payload denominator not a safe integer`);
      }
    }
    checked++;
  }
  return { name: 'P3-determinism-shape-safe-integers', checked, violations };
}

// ---------- P4: purification math ----------
function checkPurificationMath() {
  const r = rng(0xA85005);
  let checked = 0;
  const violations = [];
  for (let i = 0; i < 80; i++) {
    const pp = genValidInput(r);
    if (pp.dividend_minor === undefined) continue;
    const out = compute(structuredClone(pp));
    if (!out.output_payload.valid_input) continue;
    for (const [a, v] of Object.entries(out.output_payload.verdicts)) {
      const hasFactor = a === 'msci_islamic' || a === 'msci_islamic_m';
      const numer = hasFactor ? pp.non_permissible_revenue_minor + pp.interest_income_minor : pp.interest_income_minor;
      const inconsistent = hasFactor ? numer > pp.total_income_minor : pp.interest_income_minor > pp.total_income_minor;
      checked++;
      if (a === 'ftse_idealratings') {
        if (v.purification !== null) violations.push(`${i}: ftse purification not null`);
        if (!out.compliance_flags.includes('PURIFICATION_NOT_PINNED_FTSE')) violations.push(`${i}: ftse not-pinned flag missing`);
        continue;
      }
      if (inconsistent) {
        const flag = hasFactor ? 'PURIFICATION_INPUT_INCONSISTENT_MSCI' : 'PURIFICATION_INPUT_INCONSISTENT_NIFTY';
        if (v.purification !== null) violations.push(`${i}:${a} inconsistent income but purification present`);
        if (!out.compliance_flags.includes(flag)) violations.push(`${i}: inconsistency flag ${flag} missing`);
        continue;
      }
      const expect = Number((BigInt(pp.dividend_minor) * BigInt(numer)) / BigInt(pp.total_income_minor));
      const expectRem = Number(BigInt(pp.dividend_minor) * BigInt(numer) - BigInt(expect) * BigInt(pp.total_income_minor));
      if (v.purification === null) violations.push(`${i}:${a} purification null without cause`);
      else {
        if (v.purification.purified_portion_minor !== expect) violations.push(`${i}:${a} purified ${v.purification.purified_portion_minor} vs exact floor ${expect}`);
        if (v.purification.purification_remainder_minor !== expectRem) violations.push(`${i}:${a} residual mismatch`);
        if (v.purification.purified_portion_minor > pp.dividend_minor) violations.push(`${i}:${a} purified exceeds dividend`);
      }
    }
  }
  return { name: 'P4-purification-floor-residual-reconstruction', checked, violations };
}

// ---------- P5 + P7: refusal contract over hostile classes ----------
function checkRefusalContract() {
  const r = rng(0xA85006);
  let checked = 0;
  const violations = [];
  const goodMsci = {
    methodologies: ['msci_islamic'],
    is_current_constituent: true,
    country_code: 'US',
    total_assets_minor: 1000,
    total_debt_minor: 100,
    cash_and_interest_bearing_securities_minor: 10,
    receivables_minor: 10,
    non_permissible_revenue_minor: 1,
    interest_income_minor: 1,
    total_income_minor: 1000,
    interest_based_investments_minor: 0,
  };
  const bad = [
    ['null pp', null],
    ['array pp', [goodMsci]],
    ['string pp', 'x'],
    ['no methodologies', { ...goodMsci, methodologies: undefined }],
    ['empty methodologies', { ...goodMsci, methodologies: [] }],
    ['not array methodologies', { ...goodMsci, methodologies: 'msci_islamic' }],
    ['unknown authority', { ...goodMsci, methodologies: ['djim'] }],
    ['dup authority', { ...goodMsci, methodologies: ['msci_islamic', 'msci_islamic'] }],
    ['missing required', { ...goodMsci, receivables_minor: undefined }],
    ['wrong type', { ...goodMsci, total_debt_minor: '100' }],
    ['null field', { ...goodMsci, total_debt_minor: null }],
    ['negative', { ...goodMsci, total_debt_minor: -1 }],
    ['above max', { ...goodMsci, total_debt_minor: MAX_AMOUNT_MINOR + 1 }],
    ['unsafe int', { ...goodMsci, total_debt_minor: 2 ** 53 }],
    ['float', { ...goodMsci, total_debt_minor: 1.5 }],
    ['NaN', { ...goodMsci, total_debt_minor: NaN }],
    ['Infinity', { ...goodMsci, total_debt_minor: Infinity }],
    ['zero denominator TA', { ...goodMsci, total_assets_minor: 0 }],
    ['zero denominator TI', { ...goodMsci, total_income_minor: 0 }],
    ['bad country', { ...goodMsci, country_code: 'usa' }],
    ['bad constituent', { ...goodMsci, is_current_constituent: 'yes' }],
    ['scd exceeds debt', { ...goodMsci, country_code: 'MY', shariah_compliant_debt_minor: 101 }],
    ['series not array', { ...goodMsci, methodologies: ['ftse_idealratings'], market_cap_series_minor: 5, market_cap_series_period: 'day' }],
    ['series empty', { ...goodMsci, methodologies: ['ftse_idealratings'], market_cap_series_minor: [], market_cap_series_period: 'day' }],
    ['series element zero', { ...goodMsci, methodologies: ['ftse_idealratings'], market_cap_series_minor: [0], market_cap_series_period: 'day' }],
    ['series element over bound', { ...goodMsci, methodologies: ['ftse_idealratings'], market_cap_series_minor: [MAX_SERIES_ELEMENT_MINOR + 1], market_cap_series_period: 'day' }],
    ['series too long', { ...goodMsci, methodologies: ['ftse_idealratings'], market_cap_series_minor: new Array(MAX_SERIES_LEN + 1).fill(1), market_cap_series_period: 'day' }],
    ['bad period', { ...goodMsci, methodologies: ['ftse_idealratings'], market_cap_series_minor: [1], market_cap_series_period: 'weekly' }],
    ['m needs month_end', { ...goodMsci, methodologies: ['msci_islamic_m'], market_cap_series_minor: [1], market_cap_series_period: 'day' }],
    ['m without series', { ...goodMsci, methodologies: ['msci_islamic_m'] }],
    ['dividend without purification inputs', { ...goodMsci, dividend_minor: 5, non_permissible_revenue_minor: undefined }],
  ];
  for (const [label, pp] of bad) {
    const out = compute(pp);
    checked++;
    const isPurOnly = label === 'dividend without purification inputs';
    if (isPurOnly) {
      if (out.output_payload.valid_input !== false) violations.push(`${label}: expected refusal`);
      continue;
    }
    if (out.output_payload.valid_input !== false) { violations.push(`${label}: expected refusal, got valid`); continue; }
    if (out.output_payload.verdicts !== null) violations.push(`${label}: verdicts not null on refusal`);
    if (out.output_payload.not_a_shariah_ruling !== true) violations.push(`${label}: refusal payload missing not_a_shariah_ruling`);
    if (JSON.stringify(out.output_payload.warnings) !== JSON.stringify(out.compliance_flags)) violations.push(`${label}: warnings mirror broken on refusal`);
    if (!Array.isArray(out.output_payload.domain_errors) || out.output_payload.domain_errors.length === 0) violations.push(`${label}: no domain errors`);
    const wantsAuthorityFlag = label === 'unknown authority';
    if (wantsAuthorityFlag && !out.compliance_flags.includes('AUTHORITY_NOT_PINNED')) violations.push(`${label}: AUTHORITY_NOT_PINNED missing`);
    if (!out.compliance_flags.includes('EQUITY_SCREEN_INPUT_OUT_OF_DECLARED_DOMAIN')) violations.push(`${label}: domain flag missing`);
    // refusal payloads echo no amounts: scan for any caller money value leaking back
    const s = JSON.stringify(out.output_payload);
    if (label === 'unknown authority' && !s.includes('djim')) violations.push('unknown authority value not named');
  }
  // proto-key inertness on a VALID input
  const validProto = JSON.parse('{"methodologies":["msci_islamic"],"is_current_constituent":true,"country_code":"US","total_assets_minor":1000,"total_debt_minor":100,"cash_and_interest_bearing_securities_minor":10,"receivables_minor":10,"__proto__":{"total_debt_minor":999999}}');
  const vp = compute(validProto);
  checked++;
  if (vp.output_payload.valid_input !== true || vp.output_payload.verdicts.msci_islamic.ratios[0].numerator_minor !== 100) violations.push('proto key leaked into verdicts');
  return { name: 'P5-P7-refusal-contract-input-classes', checked, violations };
}

// ---------- P6: carve-out behavior ----------
function checkCarveout() {
  const r = rng(0xA85007);
  let checked = 0;
  const violations = [];
  const base = {
    methodologies: ['msci_islamic'],
    is_current_constituent: true,
    country_code: 'MY',
    total_assets_minor: 1000,
    total_debt_minor: 500,
    shariah_compliant_debt_minor: 200,
    cash_and_interest_bearing_securities_minor: 10,
    receivables_minor: 10,
  };
  const out = compute(structuredClone(base));
  checked++;
  const row = out.output_payload.verdicts.msci_islamic.ratios[0];
  if (row.numerator_minor !== 300) violations.push(`carve-out numerator ${row.numerator_minor} != 300`);
  if (!out.compliance_flags.includes('MSCI_CARVEOUT_APPLIED')) violations.push('carve-out flag missing on subtraction');
  const zero = compute({ ...base, shariah_compliant_debt_minor: 0 });
  checked++;
  if (zero.compliance_flags.includes('MSCI_CARVEOUT_APPLIED')) violations.push('flag fired on zero subtraction');
  const outside = compute({ ...base, country_code: 'US' });
  checked++;
  if (outside.output_payload.verdicts.msci_islamic.ratios[0].numerator_minor !== 500) violations.push('carve-out applied outside the country set');
  if (outside.compliance_flags.includes('MSCI_CARVEOUT_APPLIED')) violations.push('carve-out flag outside the country set');
  for (let i = 0; i < 30; i++) {
    const cc = pick(r, CARVEOUT.concat(['US', 'FR']));
    const debt = int(r, 0, MAX_AMOUNT_MINOR);
    const scd = int(r, 0, debt);
    const o = compute({ ...base, country_code: cc, total_debt_minor: debt, shariah_compliant_debt_minor: scd });
    checked++;
    const expectNum = CARVEOUT.includes(cc) ? debt - scd : debt;
    if (o.output_payload.verdicts.msci_islamic.ratios[0].numerator_minor !== expectNum) violations.push(`${cc}: numerator != expected`);
    if (CARVEOUT.includes(cc) && scd > 0 && !o.compliance_flags.includes('MSCI_CARVEOUT_APPLIED')) violations.push(`${cc}: flag missing`);
  }
  return { name: 'P6-carveout-country-set-and-flag', checked, violations };
}

// ---------- P8: buildArtifact never throws ----------
async function checkBuildArtifactNeverThrows() {
  const r = rng(0xA85008);
  let checked = 0;
  const violations = [];
  const hostile = [
    null,
    undefined,
    42,
    'x',
    [],
    { deep: (() => { let o = JSON.parse('{"v":1}'); for (let i = 0; i < 600; i++) o = JSON.parse(JSON.stringify({ o })); return o; })() },
    { wide: new Array(1000001).fill(1) },
    { junk: Infinity },
    { junk: NaN },
    { junk: 2 ** 60 },
    { junk: -(2 ** 60) },
    { junk: 123456789012345678901234567890n },
    54321n,
  ];
  for (const pp of hostile) {
    const a = await buildArtifact(pp, { now: '2026-11-20T00:00:00Z' });
    checked++;
    if (a.execution_hash === null) {
      if (!a.hash_refusal || !a.hash_refusal.reason) violations.push('null hash without hash_refusal');
      if (!a.output_payload.not_a_shariah_ruling) violations.push('artifact payload missing not_a_shariah_ruling');
    } else if (a.hash_refusal) violations.push('hash present but hash_refusal set');
  }
  for (let i = 0; i < 40; i++) {
    const pp = genValidInput(r);
    const a = await buildArtifact(pp, { now: '2026-11-20T00:00:00Z' });
    const b = await buildArtifact(pp, { now: '2026-11-20T00:00:00Z' });
    checked++;
    if (a.execution_hash === null) violations.push(`${i}: valid input refused its hash`);
    else if (a.execution_hash !== b.execution_hash) violations.push(`${i}: execution_hash nondeterministic`);
    if (a.compute_proof_ready !== 'deferred') violations.push(`${i}: compute_proof_ready != deferred`);
  }
  return { name: 'P8-buildArtifact-never-throws-and-deterministic', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const raw = [
  checkVerdictExactness(),
  checkThresholdFlips(),
  checkProfileIndependence(),
  checkDeterminismAndShape(),
  checkPurificationMath(),
  checkRefusalContract(),
  checkCarveout(),
  await checkBuildArtifactNeverThrows(),
];
// the floor reads violations as a COUNT; keep the detail list beside it for diagnostics
const properties = raw.map((p) => ({ name: p.name, checked: p.checked, violations: p.violations.length, detail: p.violations }));
for (const p of properties) if (p.violations > 0) console.log(`  violations[${p.name}]:\n    ${p.detail.slice(0, 12).join('\n    ')}`);
console.log(`[${KERNEL_ID}] class-K property test — shariah equity screen + purification`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
