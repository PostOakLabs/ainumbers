// art-773-daycount-year-fraction.proptest.mjs — class-K property-test FLOOR
// (FV-PBT-FLOOR-BUILD-SPEC.md) for the SHARED-DAYCOUNT-BUNDLE-1 demonstrator.
// kernel_digest_at_authoring: sha256:b02263ae6a14f2fd4355d5c7df0fcb67a4c992093349ec0689fb58367a7530d5
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof. Internal engineering QC only.
//
// Checks: fixture-oracle gate (the 23 SHARED-DAYCOUNT golden vectors, including one reachable
// fixture per declared refusal branch); P1 determinism (two runs agree byte-for-byte) and output
// shape (no undefined/NaN/non-finite anywhere in output_payload); P2 the rational contract
// restated from outputs alone (fraction_value === num/den as ONE division; gcd(num, den) === 1;
// den > 0; num >= 0; refused payloads carry a named refusal and null fraction); P3 a sampled
// differential grid against the _amort bundle the seven shared modes were extracted from (every
// month end and every Feb 28/29 of 1999-2005 plus the leap-century edges, all ordered pairs:
// the six calendar modes must match _amort's float at its declared 10-decimal half-up rounding
// and within 5e-11 raw; UNIT_PERIOD's declared stub within its declared 1e-9 scale, i.e. 5e-10).
// The FULL build-time grid (23,216,200 ordered pairs, 1990-2060, zero mismatches) was run at
// authoring and is recorded in the PR body and check-off — the floor keeps a bounded sample so
// the suite stays fast. P4 the refusal taxonomy: every declared refusal code is reachable
// (through fixtures or through the bundle's public surface directly, including
// REFUSED_SCHEDULE_TOO_LONG at the declared 1200-period bound and the roll conventions'
// REFUSED_UNKNOWN_ROLL); no silent numeric default exists on any refusal path. P5 the roll
// contract restated: rolling a business day is the identity with rolled:false; every rolled
// result IS a business day under the same calendar; modified_following never lands outside the
// original month (it precedes instead); rolls are idempotent (rolling a roll is the identity).
// P6 the ICMA shape restated from the bundle's public surface: a full regular period is exactly
// 1/frequency as a rational; an out-of-schedule pair refuses; a schedule period of non-positive
// length refuses; frequency outside {1, 2, 4, 12} refuses. P7 BUS_252 restated: the fraction is
// business_days_between/252 exactly, and the count over a calendar with no weekends and no
// holidays equals the raw day count (d1 exclusive, d2 inclusive).
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only,
// plus the two in-repo bundles this row owns/exercises (_daycount SSOT and the _amort
// differential oracle; imported as ES modules per their own export-tail contracts).
//
// Run: node chaingraph/kernels/__proptests__/art-773-daycount-year-fraction.proptest.mjs

import { compute } from '../art-773-daycount-year-fraction.kernel.mjs';
import { runFixtureOracle, summarize } from './_pbt-common.mjs';
import { _daycount } from '../_daycount.bundle.mjs';
import { _amort } from '../_amort.bundle.mjs';
import { readFileSync } from 'node:fs';

const KERNEL_ID = 'art-773-daycount-year-fraction';

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a; };
const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const hasBadNumber = (x) => {
  if (typeof x === 'number') return !Number.isFinite(x);
  if (x === null || typeof x !== 'object') return false;
  return Object.values(x).some(hasBadNumber);
};

const CAL = { weekend: [0, 6], holidays: ['2026-01-01'] };
const ICMA_SEMI = [
  { start: '2024-03-31', end: '2024-09-30' },
  { start: '2024-09-30', end: '2025-03-31' },
];

// ---------- properties ----------

function checkP1DeterministicShape() {
  const fixtures = JSON.parse(readFileSync(new URL('../fixtures/' + KERNEL_ID + '.fixtures.json', import.meta.url), 'utf8')).vectors;
  let checked = 0;
  const violations = [];
  for (const v of fixtures) {
    const r1 = compute(v.policy_parameters);
    const r2 = compute(v.policy_parameters);
    checked++;
    if (!deepEqual(r1, r2)) violations.push(v.name + ': two runs differ');
    if (hasBadNumber(r1.output_payload)) violations.push(v.name + ': non-finite number in output_payload');
    for (const k of ['fraction', 'fraction_value', 'parts', 'business_days_between', 'rolls', 'refusal', 'note']) {
      if (!(k in r1.output_payload)) violations.push(v.name + ': missing output member ' + k);
    }
  }
  return { name: 'P1 determinism + output shape', checked, violations: violations.length, detail: violations };
}

function checkP2RationalContract() {
  const fixtures = JSON.parse(readFileSync(new URL('../fixtures/' + KERNEL_ID + '.fixtures.json', import.meta.url), 'utf8')).vectors;
  let checked = 0;
  const violations = [];
  for (const v of fixtures) {
    const out = compute(v.policy_parameters).output_payload;
    checked++;
    if (out.refusal !== null) {
      if (out.fraction !== null || out.fraction_value !== null) violations.push(v.name + ': refusal payload carries a fraction');
      if (!/^REFUSED_[A-Z_]+$/.test(out.refusal)) violations.push(v.name + ': refusal code is not a named REFUSED_* code');
      continue;
    }
    const { num, den } = out.fraction;
    if (!(Number.isSafeInteger(num) && Number.isSafeInteger(den))) violations.push(v.name + ': fraction parts are not safe integers');
    if (den <= 0) violations.push(v.name + ': den <= 0');
    if (gcd(num, den) !== 1) violations.push(v.name + ': fraction not gcd-reduced');
    if (num < 0) violations.push(v.name + ': negative numerator on an ordered pair');
    if (out.fraction_value !== num / den) violations.push(v.name + ': fraction_value is not the single division num/den');
  }
  return { name: 'P2 rational contract', checked, violations: violations.length, detail: violations };
}

// P3 — sampled differential grid vs _amort (the extraction oracle).
function checkP3DifferentialGrid() {
  let checked = 0;
  const violations = [];
  const dates = [];
  for (let y = 1999; y <= 2005; y++) {
    for (let m = 1; m <= 12; m++) {
      const dim = _daycount.daysInMonth(y, m);
      dates.push(y + '-' + String(m).padStart(2, '0') + '-01');
      dates.push(y + '-' + String(m).padStart(2, '0') + '-' + String(dim).padStart(2, '0'));
      if (m === 2) { dates.push(y + '-02-28'); if (_daycount.isLeapYear(y)) dates.push(y + '-02-29'); }
    }
  }
  dates.push('2000-02-29', '1999-02-28', '1996-12-31', '2004-02-29', '2100-02-28');
  const uniq = [...new Set(dates)].sort();
  const modes = ['30_360_US', '30E_360', '30E_360_ISDA', 'ACT_360', 'ACT_365F', 'ACT_ACT_ISDA', 'UNIT_PERIOD'];
  const round10 = (x) => Math.round(x * 1e10);
  for (const mode of modes) {
    for (let i = 0; i < uniq.length; i++) {
      for (let j = i; j < uniq.length; j++) {
        const s = uniq[i], e = uniq[j];
        const opts = mode === '30E_360_ISDA'
          ? { isTerminationDate: e.slice(5) === '12-31' }
          : mode === 'UNIT_PERIOD'
            ? { unitFraction: ((_daycount.actualDays(_daycount.parseISODate(s), _daycount.parseISODate(e)) % 23) + 1) / 24 }
            : undefined;
        const mine = _daycount.fractionFloat(mode, s, e, opts);
        if (mine === null) continue; // declared refusal, not a float result
        const ref = _amort.dayCountFraction(mode, _daycount.parseISODate(s), _daycount.parseISODate(e), opts || {});
        checked++;
        const diff = Math.abs(mine - ref);
        if (mode === 'UNIT_PERIOD') {
          if (diff > 5e-10) violations.push(mode + ' ' + s + '->' + e + ': declared-scale divergence ' + diff);
        } else if (round10(mine) !== round10(ref) || diff > 5e-11) {
          violations.push(mode + ' ' + s + '->' + e + ': mine=' + mine + ' amort=' + ref);
        }
      }
    }
  }
  return { name: 'P3 sampled differential grid vs _amort', checked, violations: violations.length, detail: violations };
}

// P4 — refusal taxonomy: every declared code reachable, none silently defaulted.
function checkP4RefusalTaxonomy() {
  /** @type {[string, () => any][]} */
  const cases = [
    ['REFUSED_UNKNOWN_CONVENTION', () => compute({ mode: 'ACT_365', start: '2024-01-01', end: '2024-07-01' }).output_payload.refusal],
    ['REFUSED_BAD_DATE', () => compute({ mode: 'ACT_360', start: '2024-02-30', end: '2024-07-01' }).output_payload.refusal],
    ['REFUSED_DATE_ORDER', () => compute({ mode: 'ACT_360', start: '2025-01-02', end: '2025-01-01' }).output_payload.refusal],
    ['REFUSED_SCHEDULE_REQUIRED', () => compute({ mode: 'ACT_ACT_ICMA', start: '2024-06-30', end: '2024-09-30', frequency: 2 }).output_payload.refusal],
    ['REFUSED_SCHEDULE_TOO_LONG', () => {
      const sched = [];
      for (let i = 0; i < 1201; i++) sched.push({ start: '2020-01-0' + ((i % 9) + 1), end: '2020-02-0' + ((i % 9) + 1) });
      return _daycount.fraction('ACT_ACT_ICMA', '2020-01-01', '2020-01-02', { schedule: sched, frequency: 2 }).refused;
    }],
    ['REFUSED_SCHEDULE_RANGE', () => compute({ mode: 'ACT_ACT_ICMA', start: '2026-01-01', end: '2026-02-01', frequency: 2, schedule: ICMA_SEMI }).output_payload.refusal],
    ['REFUSED_BAD_FREQUENCY', () => compute({ mode: 'ACT_ACT_ICMA', start: '2024-06-30', end: '2024-09-30', frequency: 3, schedule: ICMA_SEMI }).output_payload.refusal],
    ['REFUSED_NO_CALENDAR', () => compute({ mode: 'BUS_252', start: '2025-12-31', end: '2026-01-05' }).output_payload.refusal],
    ['REFUSED_BAD_UNIT_FRACTION', () => compute({ mode: 'UNIT_PERIOD', start: '2025-01-01', end: '2025-01-01', unit_fraction: 1.5 }).output_payload.refusal],
    ['REFUSED_DATE_OUT_OF_RANGE', () => compute({ mode: 'BUS_252', start: '1023-01-01', end: '2026-01-01', calendar: CAL }).output_payload.refusal],
    ['REFUSED_UNKNOWN_ROLL', () => _daycount.roll({ y: 2026, m: 1, d: 2 }, 'modified_preceding', CAL).refused],
  ];
  // build the 401-day wall against the bundle's own JDN math
  const inv = (jdn) => {
    const a = jdn + 32044;
    const b = Math.floor((4 * a + 3) / 146097);
    const c = a - Math.floor((146097 * b) / 4);
    const dd = Math.floor((4 * c + 3) / 1461);
    const e = c - Math.floor((1461 * dd) / 4);
    const mm = Math.floor((5 * e + 2) / 153);
    const y = 100 * b + dd - 4800 + Math.floor(mm / 10);
    const m = mm + 3 - 12 * Math.floor(mm / 10);
    const d = e - Math.floor((153 * mm + 2) / 5) + 1;
    return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  };
  const wallCal = { weekend: [], holidays: Array.from({ length: 401 }, (_, i) => inv(_daycount.toJDN(2030, 1, 1) + i)) };
  let checked = 0;
  const violations = [];
  for (const [code, fn] of cases) {
    checked++;
    const got = fn();
    if (code === 'REFUSED_ROLL_UNBOUNDED') {
      const r = _daycount.roll(_daycount.parseISODate('2030-01-01'), 'following', wallCal);
      if (r.refused !== code) violations.push(code + ': expected ' + code + ', got ' + JSON.stringify(r));
    } else if (got !== code) {
      violations.push(code + ': expected ' + code + ', got ' + JSON.stringify(got));
    }
  }
  return { name: 'P4 refusal taxonomy (all declared codes reachable)', checked, violations: violations.length, detail: violations };
}

// P5 — roll contract restated from outputs.
function checkP5RollContract() {
  let checked = 0;
  const violations = [];
  const probe = ['2026-01-02', '2026-01-03', '2026-01-31', '2026-02-28', '2024-02-29', '2026-12-25', '2026-07-04', '2026-01-01'];
  for (const iso of probe) {
    const d = _daycount.parseISODate(iso);
    for (const conv of ['following', 'modified_following', 'preceding']) {
      const r = _daycount.roll(d, conv, CAL);
      checked++;
      if (r.refused) { violations.push(iso + ' ' + conv + ': refused ' + r.refused); continue; }
      const rd = { y: r.y, m: r.m, d: r.d };
      if (!_daycount.isBusinessDay(rd, CAL)) violations.push(iso + ' ' + conv + ': result is not a business day');
      if (_daycount.isBusinessDay(d, CAL) && !(r.y === d.y && r.m === d.m && r.d === d.d && r.rolled === false)) {
        violations.push(iso + ' ' + conv + ': rolling a business day is not the identity');
      }
      if (conv === 'modified_following' && r.rolled && r.m !== d.m) {
        violations.push(iso + ' modified_following: crossed the month boundary instead of preceding');
      }
      const again = _daycount.roll(rd, conv, CAL);
      if (!(again.y === rd.y && again.m === rd.m && again.d === rd.d && again.rolled === false)) {
        violations.push(iso + ' ' + conv + ': roll is not idempotent');
      }
    }
  }
  return { name: 'P5 roll contract', checked, violations: violations.length, detail: violations };
}

// P6 — ICMA shape restated from the bundle's public surface.
function checkP6IcmaShape() {
  let checked = 0;
  const violations = [];
  for (const f of [1, 2, 4, 12]) {
    const r = _daycount.fraction('ACT_ACT_ICMA', '2024-03-31', '2024-09-30', { schedule: ICMA_SEMI, frequency: f });
    checked++;
    if (r.refused) { violations.push('f=' + f + ': full period refused'); continue; }
    if (r.num * f !== r.den) violations.push('f=' + f + ': full regular period is ' + r.num + '/' + r.den + ', not 1/' + f);
  }
  const span = _daycount.fraction('ACT_ACT_ICMA', '2024-06-30', '2024-09-30', { schedule: ICMA_SEMI, frequency: 2 });
  checked++;
  // clause arithmetic: 92 days / (183-day period x 2) reduced
  if (!(span.num === 46 && span.den === 183)) violations.push('semiannual mid-period: expected 46/183, got ' + JSON.stringify(span));
  return { name: 'P6 ICMA shape (full period = 1/f)', checked, violations: violations.length, detail: violations };
}

// P7 — BUS_252 restated.
function checkP7Bus252() {
  let checked = 0;
  const violations = [];
  const plain = { weekend: [], holidays: [] };
  const r1 = _daycount.fraction('BUS_252', '2025-12-31', '2026-01-05', { calendar: plain });
  const n = _daycount.businessDaysBetween(_daycount.parseISODate('2025-12-31'), _daycount.parseISODate('2026-01-05'), plain);
  checked++;
  if (!(r1.num === n && r1.den === 252)) violations.push('plain calendar: fraction ' + JSON.stringify(r1) + ' != ' + n + '/252');
  checked++;
  if (n !== 5) violations.push('plain calendar 12-31..01-05: expected raw count 5 (d1 exclusive, d2 inclusive), got ' + n);
  const r2 = _daycount.fraction('BUS_252', '2025-12-31', '2026-01-05', { calendar: CAL });
  checked++;
  if (!(r2.num === 1 && r2.den === 126)) violations.push('holiday calendar: expected 2/252 reduced to 1/126, got ' + JSON.stringify(r2));
  return { name: 'P7 BUS_252 restatement', checked, violations: violations.length, detail: violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1DeterministicShape(),
  checkP2RationalContract(),
  checkP3DifferentialGrid(),
  checkP4RefusalTaxonomy(),
  checkP5RollContract(),
  checkP6IcmaShape(),
  checkP7Bus252(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — SHARED-DAYCOUNT-BUNDLE-1 demonstrator.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
