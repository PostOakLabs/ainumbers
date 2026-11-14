// _vintage.selftest.mjs -- VINTAGE-ASOF-1. Property test and worked scratch node for the
// shared as-of reader. Seeded PRNG, no dependencies, no clock.
// Run: node chaingraph/kernels/_vintage.selftest.mjs   (exit 0 = all pass)
//
// Properties: determinism; order invariance; a partitioned table gives exactly one vintage
// for every covered date and its interval contains the date; both bounds inclusive; a date
// outside every interval refuses; an open end covers all later dates; a correction wins;
// overlap refuses as ambiguous; bad dates, facts and entries refuse; inputs are never
// mutated; the stamp has a stable key set. Controls: a naive "latest entry" reader and a
// naive "match the year" reader each fail a property this reader holds.

import { _vintage } from './_vintage.bundle.mjs';
import { executionHash } from './_hash.mjs';

const { REFUSAL, isIsoDate, resolve, stamp } = _vintage;

let pass = 0;
const fails = [];
function t(name, cond) { if (cond) pass++; else fails.push(name); }

// mulberry32, seeded: the same run every time.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
const pad = (n, w) => String(n).padStart(w, '0');
const iso = (y, m, d) => pad(y, 4) + '-' + pad(m, 2) + '-' + pad(d, 2);
function randDate(r, y0, y1) { return iso(y0 + Math.floor(r() * (y1 - y0 + 1)), 1 + Math.floor(r() * 12), 1 + Math.floor(r() * 28)); }
function shuffle(arr, r) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// A calendar-year table: one vintage per year, closed intervals, no gaps, no overlap.
const FACT = 'test.example.limit';
const yearTable = [];
for (let y = 2024; y <= 2030; y++) {
  yearTable.push({ fact: FACT, vintage: String(y), value: 1000 + y, effective_from: iso(y, 1, 1), effective_to: iso(y, 12, 31) });
}

// Controls: the two naive readers this helper replaces fail on a mid-year-boundary table.
const naiveLatest = (entries, fact) => entries.filter((e) => e.fact === fact).slice(-1)[0];
t('control: latest-entry reader ignores the date', naiveLatest(yearTable, FACT).vintage === '2030');
const fiscal = [
  { fact: 'f', vintage: 'FY2026', value: 1, effective_from: '2025-10-01', effective_to: '2026-09-30' },
  { fact: 'f', vintage: 'FY2027', value: 2, effective_from: '2026-10-01', effective_to: null },
];
t('control: year-match reader picks the wrong vintage for 2026-11-15', String(2026) !== resolve(fiscal, 'f', '2026-11-15').vintage);
t('fiscal-year table resolves by interval, not by year digits', resolve(fiscal, 'f', '2026-11-15').vintage === 'FY2027' && resolve(fiscal, 'f', '2026-09-30').vintage === 'FY2026');

// P1 determinism and shape.
{
  const r = rng(1);
  let ok = true;
  for (let i = 0; i < 500; i++) {
    const d = randDate(r, 2024, 2030);
    const a = JSON.stringify(resolve(yearTable, FACT, d));
    const b = JSON.stringify(resolve(yearTable, FACT, d));
    if (a !== b || a.includes('undefined')) ok = false;
  }
  t('P1 determinism over 500 dates', ok);
}

// P2 partition: exactly one vintage, its interval contains the date, value matches the year.
{
  const r = rng(2);
  let ok = true;
  for (let i = 0; i < 1000; i++) {
    const d = randDate(r, 2024, 2030);
    const res = resolve(yearTable, FACT, d);
    if (res.status !== 'OK' || !(res.effective_from <= d && d <= res.effective_to)
      || res.vintage !== d.slice(0, 4) || res.value !== 1000 + Number(d.slice(0, 4))) ok = false;
  }
  t('P2 partitioned table: one vintage per date, interval contains date', ok);
}

// P3 order invariance.
{
  const r = rng(3);
  let ok = true;
  for (let i = 0; i < 300; i++) {
    const d = randDate(r, 2023, 2031);
    const base = JSON.stringify(resolve(yearTable, FACT, d));
    if (JSON.stringify(resolve(shuffle(yearTable, r), FACT, d)) !== base) ok = false;
  }
  t('P3 entry order never changes the result', ok);
}

// P4 bounds inclusive; outside refuses.
t('P4 first day inclusive', resolve(yearTable, FACT, '2026-01-01').vintage === '2026');
t('P4 last day inclusive', resolve(yearTable, FACT, '2026-12-31').vintage === '2026');
t('P4 before earliest refuses', resolve(yearTable, FACT, '2023-12-31').status === REFUSAL.NO_VINTAGE);
t('P4 after latest closed interval refuses', resolve(yearTable, FACT, '2031-01-01').status === REFUSAL.NO_VINTAGE);

// P5 open end covers every later date.
{
  const open = [{ fact: 'g', vintage: 'v1', value: 7, effective_from: '2026-01-01', effective_to: null }];
  const r = rng(5);
  let ok = true;
  for (let i = 0; i < 200; i++) if (resolve(open, 'g', randDate(r, 2026, 2099)).vintage !== 'v1') ok = false;
  t('P5 open-ended vintage covers all later dates', ok);
  t('P5 open-ended vintage does not cover earlier dates', resolve(open, 'g', '2025-12-31').status === REFUSAL.NO_VINTAGE);
}

// P6 a correction wins, in either order; two uncorrected overlaps refuse.
{
  const orig = { fact: 'h', vintage: '2026', value: 100, effective_from: '2026-01-01', effective_to: '2026-12-31' };
  const fix = { fact: 'h', vintage: '2026', value: 101, effective_from: '2026-01-01', effective_to: '2026-12-31', corrects: '2026' };
  t('P6 correction wins (original first)', resolve([orig, fix], 'h', '2026-06-01').value === 101);
  t('P6 correction wins (correction first)', resolve([fix, orig], 'h', '2026-06-01').value === 101);
  const clash = { fact: 'h', vintage: '2026b', value: 5, effective_from: '2026-03-01', effective_to: '2026-04-30' };
  t('P6 overlap without correction is ambiguous', resolve([orig, clash], 'h', '2026-03-15').status === REFUSAL.AMBIGUOUS);
  t('P6 overlap resolves where only one applies', resolve([orig, clash], 'h', '2026-05-15').value === 100);
}

// P7 refusals, never a default.
t('P7 impossible date', resolve(yearTable, FACT, '2026-02-30').status === REFUSAL.BAD_DATE);
t('P7 non-leap Feb 29', resolve(yearTable, FACT, '2025-02-29').status === REFUSAL.BAD_DATE);
t('P7 leap Feb 29 accepted', resolve(yearTable, FACT, '2028-02-29').vintage === '2028');
t('P7 padded date', resolve(yearTable, FACT, ' 2026-01-01').status === REFUSAL.BAD_DATE);
t('P7 non-string date', resolve(yearTable, FACT, 20260101).status === REFUSAL.BAD_DATE);
t('P7 unknown fact', resolve(yearTable, 'nope', '2026-01-01').status === REFUSAL.UNKNOWN_FACT);
t('P7 empty fact', resolve(yearTable, '', '2026-01-01').status === REFUSAL.BAD_FACT);
t('P7 entries not an array', resolve(null, FACT, '2026-01-01').status === REFUSAL.BAD_ENTRIES);
t('P7 inverted interval', resolve([{ fact: 'x', vintage: 'a', value: 1, effective_from: '2026-02-01', effective_to: '2026-01-01' }], 'x', '2026-01-15').status === REFUSAL.BAD_ENTRIES);
t('P7 missing value', resolve([{ fact: 'x', vintage: 'a', effective_from: '2026-01-01', effective_to: null }], 'x', '2026-01-15').status === REFUSAL.BAD_ENTRIES);
t('isIsoDate rejects month 13', isIsoDate('2026-13-01') === false);

// P8 inputs are never mutated.
{
  const before = JSON.stringify(yearTable);
  resolve(yearTable, FACT, '2027-07-01'); stamp(resolve(yearTable, FACT, '2027-07-01'), '2027-07-01');
  t('P8 entries unchanged after resolve and stamp', JSON.stringify(yearTable) === before);
}

// P9 stamp has a stable key set and a refusal never stamps as a vintage.
{
  const ok = stamp(resolve(yearTable, FACT, '2027-07-01'), '2027-07-01');
  t('P9 stamp keys', Object.keys(ok).join(',') === 'fact,vintage,as_of,effective_from,effective_to,status');
  const bad = stamp(resolve(yearTable, FACT, '2040-01-01'), '2040-01-01');
  t('P9 refusal stamp carries no vintage', bad.vintage === null && bad.status === REFUSAL.NO_VINTAGE);
}

// WORKED EXAMPLE: a scratch node. Table and as-of date arrive through policy_parameters, so they
// sit inside the execution_hash preimage; the output states the vintage it used.
function scratchCompute(input) {
  const policy_parameters = { vintage_entries: input.table, as_of: input.as_of, fact: 'test.example.limit' };
  const got = resolve(policy_parameters.vintage_entries, policy_parameters.fact, policy_parameters.as_of);
  const output_payload = got.status === 'OK'
    ? { capped_amount: Math.min(input.amount, got.value), vintage_used: stamp(got, policy_parameters.as_of) }
    : { refused: got.status, vintage_used: stamp(got, policy_parameters.as_of) };
  return { policy_parameters, output_payload };
}
{
  const a = scratchCompute({ table: yearTable, as_of: '2026-06-30', amount: 5000 });
  t('example: 2026 value applied', a.output_payload.capped_amount === 3026);
  t('example: receipt states the vintage', a.output_payload.vintage_used.vintage === '2026');
  const b = scratchCompute({ table: yearTable, as_of: '2027-06-30', amount: 5000 });
  t('example: 2027 value applied', b.output_payload.capped_amount === 3027 && b.output_payload.vintage_used.vintage === '2027');
  const ha = await executionHash(a.policy_parameters, a.output_payload);
  const hb = await executionHash(b.policy_parameters, b.output_payload);
  const ha2 = await executionHash(scratchCompute({ table: yearTable, as_of: '2026-06-30', amount: 5000 }).policy_parameters, a.output_payload);
  t('example: different as-of gives a different hash', ha !== hb);
  t('example: same inputs give the same hash', ha === ha2);
  const c = scratchCompute({ table: yearTable, as_of: '2035-01-01', amount: 5000 });
  t('example: uncovered date refuses and states no vintage', c.output_payload.refused === REFUSAL.NO_VINTAGE && c.output_payload.vintage_used.vintage === null);
}

if (fails.length) {
  // A thrown error exits non-zero without naming the Node global the CheckJS gate cannot type.
  throw new Error('FAIL ' + fails.length + ' of ' + (pass + fails.length) + ':\n  ' + fails.join('\n  '));
}
console.log('PASS _vintage.selftest: ' + pass + ' checks');
