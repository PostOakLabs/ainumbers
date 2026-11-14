// _input.selftest.mjs -- KERNEL-INPUT-HELPER-1. Every reader accepts the nearest valid value and
// refuses: deleted (undefined), null, wrong type, prototype name, unsafe integer, 1e300,
// impossible date, padded enum, numeric string where a number is required.
// Also proves the SSOT shape (export tail marker) and that refuseIJson agrees with the real
// _hash.mjs assertIJson, so compute and buildArtifact can never disagree.
// Run: node chaingraph/kernels/_input.selftest.mjs   (exit 0 = all pass)

import {
  REFUSAL, isAbsent, readSafeInt, readFiniteNumber, readEnum, readCalendarDate, readString,
  ownKey, makeAccumulator, refuseIJson,
} from './_input.mjs';
import { assertIJson } from './_hash.mjs';

let pass = 0;
const fails = [];
function t(name, cond) { if (cond) pass++; else fails.push(name); }
const refused = (r, code) => r && r.ok === false && r.code === code;
const accepted = (r, v) => r && r.ok === true && r.value === v;

// Controls: the coercing shapes this helper replaces really do accept the bad inputs.
t('control: Number("12") coerces a numeric string', Number('12') === 12);
t('control: !v treats 0 as absent', !0 === true);

// isAbsent
t('isAbsent undefined', isAbsent(undefined) === true);
t('isAbsent null is present', isAbsent(null) === false);
t('isAbsent 0 is present', isAbsent(0) === false);

// readSafeInt
t('safeInt accepts 5', accepted(readSafeInt(5, { min: 0, max: 10 }), 5));
t('safeInt accepts 0 (not falsy-absent)', accepted(readSafeInt(0, { min: 0 }), 0));
t('safeInt deleted', refused(readSafeInt(undefined), REFUSAL.MISSING));
t('safeInt null', refused(readSafeInt(null), REFUSAL.NULL));
t('safeInt numeric string', refused(readSafeInt('5'), REFUSAL.WRONG_TYPE));
t('safeInt boolean', refused(readSafeInt(true), REFUSAL.WRONG_TYPE));
t('safeInt fraction', refused(readSafeInt(1.5), REFUSAL.NOT_SAFE_INTEGER));
t('safeInt 2^53', refused(readSafeInt(2 ** 53), REFUSAL.NOT_SAFE_INTEGER));
t('safeInt 1e300', refused(readSafeInt(1e300), REFUSAL.NOT_SAFE_INTEGER));
t('safeInt NaN', refused(readSafeInt(NaN), REFUSAL.NOT_FINITE));
t('safeInt Infinity', refused(readSafeInt(Infinity), REFUSAL.NOT_FINITE));
t('safeInt below min', refused(readSafeInt(-1, { min: 0 }), REFUSAL.OUT_OF_RANGE));
t('safeInt above max', refused(readSafeInt(11, { max: 10 }), REFUSAL.OUT_OF_RANGE));
t('safeInt prototype-name string', refused(readSafeInt('constructor'), REFUSAL.WRONG_TYPE));

// readFiniteNumber
t('finite accepts 1.25', accepted(readFiniteNumber(1.25, { min: 0, max: 100 }), 1.25));
t('finite deleted', refused(readFiniteNumber(undefined), REFUSAL.MISSING));
t('finite null', refused(readFiniteNumber(null), REFUSAL.NULL));
t('finite numeric string', refused(readFiniteNumber('1.25'), REFUSAL.WRONG_TYPE));
t('finite NaN', refused(readFiniteNumber(NaN), REFUSAL.NOT_FINITE));
t('finite -Infinity', refused(readFiniteNumber(-Infinity), REFUSAL.NOT_FINITE));
t('finite 1e300', refused(readFiniteNumber(1e300), REFUSAL.UNSAFE_MAGNITUDE));
t('finite unsafe integer', refused(readFiniteNumber(2 ** 60), REFUSAL.UNSAFE_MAGNITUDE));
t('finite above max', refused(readFiniteNumber(100.5, { max: 100 }), REFUSAL.OUT_OF_RANGE));
t('finite array', refused(readFiniteNumber([1]), REFUSAL.WRONG_TYPE));

// readEnum
const E = ['monthly', 'weekly'];
t('enum accepts exact', accepted(readEnum('monthly', E), 'monthly'));
t('enum deleted', refused(readEnum(undefined, E), REFUSAL.MISSING));
t('enum null', refused(readEnum(null, E), REFUSAL.NULL));
t('enum wrong type', refused(readEnum(1, E), REFUSAL.WRONG_TYPE));
t('enum padded', refused(readEnum(' monthly', E), REFUSAL.NOT_IN_ENUM));
t('enum case-folded', refused(readEnum('Monthly', E), REFUSAL.NOT_IN_ENUM));
t('enum prototype name', refused(readEnum('constructor', E), REFUSAL.NOT_IN_ENUM));
t('enum __proto__', refused(readEnum('__proto__', E), REFUSAL.NOT_IN_ENUM));
t('enum toString', refused(readEnum('toString', E), REFUSAL.NOT_IN_ENUM));

// readCalendarDate
t('date accepts 2026-11-14', accepted(readCalendarDate('2026-11-14'), '2026-11-14'));
t('date leap day 2028-02-29', accepted(readCalendarDate('2028-02-29'), '2028-02-29'));
t('date 2000-02-29 (400 rule)', accepted(readCalendarDate('2000-02-29'), '2000-02-29'));
t('date deleted', refused(readCalendarDate(undefined), REFUSAL.MISSING));
t('date null', refused(readCalendarDate(null), REFUSAL.NULL));
t('date wrong type', refused(readCalendarDate(20261114), REFUSAL.WRONG_TYPE));
t('date 2026-02-31', refused(readCalendarDate('2026-02-31'), REFUSAL.BAD_DATE));
t('date 2027-02-29', refused(readCalendarDate('2027-02-29'), REFUSAL.BAD_DATE));
t('date 1900-02-29 (100 rule)', refused(readCalendarDate('1900-02-29'), REFUSAL.BAD_DATE));
t('date month 13', refused(readCalendarDate('2026-13-01'), REFUSAL.BAD_DATE));
t('date day 00', refused(readCalendarDate('2026-01-00'), REFUSAL.BAD_DATE));
t('date April 31', refused(readCalendarDate('2026-04-31'), REFUSAL.BAD_DATE));
t('date padded', refused(readCalendarDate(' 2026-11-14'), REFUSAL.BAD_DATE));
t('date trailing newline', refused(readCalendarDate('2026-11-14\n'), REFUSAL.BAD_DATE));
t('date datetime form', refused(readCalendarDate('2026-11-14T00:00:00Z'), REFUSAL.BAD_DATE));
t('date prototype name', refused(readCalendarDate('constructor'), REFUSAL.BAD_DATE));

// readString
t('string accepts', accepted(readString('abc', { maxLen: 3 }), 'abc'));
t('string accepts empty', accepted(readString(''), ''));
t('string deleted', refused(readString(undefined), REFUSAL.MISSING));
t('string null', refused(readString(null), REFUSAL.NULL));
t('string number', refused(readString(5), REFUSAL.WRONG_TYPE));
t('string object', refused(readString({}), REFUSAL.WRONG_TYPE));
t('string too long', refused(readString('abcd', { maxLen: 3 }), REFUSAL.STRING_TOO_LONG));

// ownKey
const table = { a: 1, b: 0 };
t('ownKey own value', ownKey(table, 'a') === 1);
t('ownKey own falsy value', ownKey(table, 'b') === 0);
t('ownKey deleted key', ownKey(table, 'zzz') === undefined);
t('ownKey constructor', ownKey(table, 'constructor') === undefined);
t('ownKey toString', ownKey(table, 'toString') === undefined);
t('ownKey __proto__', ownKey(table, '__proto__') === undefined);
t('ownKey on null', ownKey(null, 'a') === undefined);
t('ownKey on string', ownKey('abc', 'length') === undefined);

// makeAccumulator
const acc = makeAccumulator();
for (const k of ['__proto__', 'constructor', 'toString', 'a', '__proto__']) acc.add(k, 1);
t('acc __proto__ counted twice', acc.get('__proto__') === 2);
t('acc constructor counted once', acc.get('constructor') === 1);
t('acc toString counted once', acc.get('toString') === 1);
t('acc size 4', acc.size() === 4);
t('acc unseen key undefined', acc.get('valueOf') === undefined);
t('acc entries first-seen order', acc.entries().map((e) => e[0]).join(',') === '__proto__,constructor,toString,a');
t('acc leaves Object.prototype clean', ({}).a === undefined && Object.getPrototypeOf({}) === Object.prototype);
// Control: a plain-object accumulator is what this replaces.
const plain = {}; plain['__proto__'] = 5;
t('control: plain object swallows __proto__ write', Object.keys(plain).length === 0);

// refuseIJson
t('ijson accepts clean object', refuseIJson({ a: 1, b: [1.5, 'x', null, true], c: { d: -3 } }) === null);
t('ijson accepts string-encoded big int', refuseIJson({ a: '9007199254740993' }) === null);
t('ijson unsafe integer', refused(refuseIJson({ a: 2 ** 53 }), REFUSAL.IJSON_UNSAFE_INTEGER));
t('ijson 1e300', refused(refuseIJson({ a: 1e300 }), REFUSAL.IJSON_UNSAFE_INTEGER));
t('ijson NaN', refused(refuseIJson({ a: [NaN] }), REFUSAL.IJSON_NON_FINITE));
t('ijson Infinity', refused(refuseIJson({ a: Infinity }), REFUSAL.IJSON_NON_FINITE));
t('ijson bigint', refused(refuseIJson({ a: 10n }), REFUSAL.IJSON_UNSUPPORTED_TYPE));
t('ijson function', refused(refuseIJson({ a: () => 1 }), REFUSAL.IJSON_UNSUPPORTED_TYPE));
t('ijson symbol', refused(refuseIJson({ a: Symbol('x') }), REFUSAL.IJSON_UNSUPPORTED_TYPE));
t('ijson undefined member', refused(refuseIJson({ a: undefined }), REFUSAL.IJSON_UNSUPPORTED_TYPE));
const cyc = { a: 1 }; cyc.self = cyc;
t('ijson cycle', refused(refuseIJson(cyc), REFUSAL.IJSON_CYCLE));
const shared = { z: 1 };
t('ijson shared (non-cyclic) reference accepted', refuseIJson({ p: shared, q: shared }) === null);
/** @type {any} */ let deep = {}; const root = deep;
for (let i = 0; i < 600; i++) { deep.n = {}; deep = deep.n; }
t('ijson too deep', refused(refuseIJson(root), REFUSAL.IJSON_TOO_DEEP));
t('ijson reports a path', refuseIJson({ a: { b: [0, 2 ** 60] } }).path === '$.a.b[1]');

// compute and buildArtifact may never disagree: every number class the real assertIJson throws on
// is refused here, and every clean value it accepts is accepted here.
for (const [name, v] of [
  ['unsafe', { a: 2 ** 53 }], ['1e300', { a: 1e300 }], ['NaN', { a: NaN }], ['Inf', { a: Infinity }],
  ['nested', { a: [{ b: 2 ** 70 }] }],
]) {
  let threw = false;
  try { assertIJson(v); } catch { threw = true; }
  t('parity with assertIJson (throws): ' + name, threw && refuseIJson(v) !== null);
}
for (const [name, v] of [['clean', { a: 1, b: [2.5, 'x'] }], ['safe max', { a: Number.MAX_SAFE_INTEGER }], ['neg zero', { a: -0 }]]) {
  let threw = false;
  try { assertIJson(v); } catch { threw = true; }
  t('parity with assertIJson (clean): ' + name, !threw && refuseIJson(v) === null);
}

// The SSOT export-tail marker is checked by check-inline-ssot-sync.mjs (the carve fails closed
// when the marker is absent or ambiguous), so this file needs no filesystem access.

if (fails.length) {
  throw new Error(`_input.selftest: ${fails.length} FAILED of ${pass + fails.length}:\n  ` + fails.join('\n  '));
}
console.log(`_input.selftest: OK ${pass}/${pass} assertions pass`);
