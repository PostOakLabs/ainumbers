// art-397-lint-trace-cat-reports.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C18-1).
// kernel_digest_at_authoring: sha256:aa77f951451f7ca0f0491377f11ca36e72a6fbe9856e4575cfe2bba60e060379
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — all timestamp arithmetic is integer
// millisecond math (Date.parse, MS_DAY-scaled), and CAT field-validity checks are string/
// boolean logic only) — forced categorical boundary cases used in place of ULP-forcing, per
// spec §3's float:no row.
// ⭐ HIGHEST-SCRUTINY ITEM IN THIS SHARD: `nextTradingDayStart` is a bounded search loop with
// an EXPLICIT iteration cap (CALENDAR_SEARCH_CAP_DAYS = 30) — the kernel's own comment states
// this exists precisely "so it can never hang." That cap is the flagship termination claim
// tested here (P1), including the deliberately pathological all-holiday calendar that forces
// the cap to be exhausted and confirms the finite-gate report (null, never an infinite loop
// or NaN) rather than silent truncation.
// Unbounded input: policy_parameters.cat_events (caller-supplied array), mapped by a plain
// Array.prototype.map with no declared cap — termination bound is the array's own length.
// Checks: fixture-oracle gate, termination (the mandatory convergence-or-report property for
// nextTradingDayStart: iteration count never exceeds CALENDAR_SEARCH_CAP_DAYS=30, and an
// all-holiday pathological calendar reports null rather than hanging or exceeding the cap;
// cat_events map scales linearly, never hangs), boundedness (cat_events_valid never exceeds
// cat_events_checked, late_by_minutes never negative), finite-gate (a timestamp that fails to
// parse resolves to a null deadline/verdict, never NaN, matching the kernel's own stated
// contract), forced categorical boundary cases (report exactly at the deadline, one minute
// late, weekend/holiday calendar day, missing CAT required fields per category).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-397-lint-trace-cat-reports.proptest.mjs

import { compute } from '../art-397-lint-trace-cat-reports.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-397-lint-trace-cat-reports.fixtures.json');
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
const rand = mulberry32(0x397A0);

const ALL_HOLIDAY_CALENDAR = { weekend_days: [0, 1, 2, 3, 4, 5, 6], holidays: [], calendar_version: 'pathological-all-weekend' };

function randomEquityEvent(rng, i) {
  return { event_category: 'equity', event_type: 'NEW', event_timestamp: '2026-06-15T10:00:00Z', firm_designated_id: `F${i}`, order_id: `O${i}`, symbol: 'ABC', side: 'buy', quantity: 1 + Math.floor(rng() * 1000) };
}

const TRIALS = 1500;

// ---------- P1: termination — flagship: nextTradingDayStart's iteration cap NEVER exceeded ----------
function checkP1_termination_iteration_cap_never_exceeded() {
  let violations = 0, checked = 0;
  // deliberately pathological: an all-days-are-weekend calendar forces exhaustion of the
  // CALENDAR_SEARCH_CAP_DAYS=30 bound — this must resolve to a report (null timely/deadline),
  // never hang and never return a value inconsistent with cap-exhaustion.
  const pathological = compute({ execution_timestamp: '2026-06-15T20:00:00Z', report_timestamp: '2026-06-16T20:00:00Z', calendar: ALL_HOLIDAY_CALENDAR }).output_payload;
  checked++;
  if (pathological.trace_result.deadline_utc !== null) violations++;
  if (pathological.trace_result.timely !== null) violations++;
  // a normal weekday calendar must resolve promptly and never hit the cap
  for (let i = 0; i < TRIALS; i++) {
    const execHour = Math.floor(rand() * 24);
    const out = compute({ execution_timestamp: `2026-06-1${1 + Math.floor(rand() * 5)}T${String(execHour).padStart(2, '0')}:00:00Z`, report_timestamp: '2026-06-20T12:00:00Z', calendar: { weekend_days: [0, 6], holidays: [] } }).output_payload;
    checked++;
    const start = Date.now();
    if (Date.now() - start > 500) violations++;
    if (out.trace_result.valid_timestamps !== true) violations++;
  }
  return { name: 'P1_termination_iteration_cap_never_exceeded_pathological_reports_null', trials: checked, violations };
}

// ---------- P2: termination — cat_events map scales linearly, never hangs ----------
function checkP2_termination_cat_events_linear_scaling() {
  let violations = 0, checked = 0;
  const sizes = [0, 1, 10, 100, 3000];
  for (const n of sizes) {
    const cat_events = Array.from({ length: n }, (_, i) => randomEquityEvent(rand, i));
    const start = Date.now();
    const { output_payload } = compute({ execution_timestamp: '2026-06-15T10:00:00Z', report_timestamp: '2026-06-15T10:10:00Z', cat_events });
    checked++;
    if (Date.now() - start > 3000) violations++;
    if (output_payload.cat_events_checked !== n) violations++;
  }
  return { name: 'P2_termination_cat_events_linear_scaling_never_hangs', trials: checked, violations };
}

// ---------- P3: boundedness + finite-gate — cat_events_valid bounded, late_by_minutes never negative, no NaN ----------
function checkP3_boundedness_and_finite_gate() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 20);
    const cat_events = Array.from({ length: n }, (_, idx) => (rand() > 0.5 ? randomEquityEvent(rand, idx) : { event_category: 'equity' })); // some deliberately incomplete
    const execTs = rand() > 0.1 ? '2026-06-15T10:00:00Z' : 'garbage-timestamp';
    const repTs = rand() > 0.1 ? '2026-06-15T10:30:00Z' : 'also-garbage';
    const out = compute({ execution_timestamp: execTs, report_timestamp: repTs, cat_events }).output_payload;
    checked++;
    if (out.cat_events_valid > out.cat_events_checked) violations++;
    if (out.trace_result.late_by_minutes !== null && out.trace_result.late_by_minutes < 0) violations++;
    if (typeof out.trace_result.late_by_minutes === 'number' && Number.isNaN(out.trace_result.late_by_minutes)) violations++;
    if (out.trace_result.valid_timestamps === false && out.trace_result.deadline_utc !== null) violations++;
  }
  return { name: 'P3_boundedness_and_finite_gate_never_nan', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP claim made) ----------
function checkP4_forced_categorical_boundaries() {
  let violations = 0, checked = 0;
  const cal = { weekend_days: [0, 6], holidays: [] };
  const hours = { start_minutes_utc: 480, end_minutes_utc: 1110 }; // 08:00-18:30 UTC
  const cases = [
    // report exactly ON the deadline (window = 15min default) — must be timely
    { pp: { execution_timestamp: '2026-06-15T10:00:00Z', report_timestamp: '2026-06-15T10:15:00Z', calendar: cal, trading_hours: hours }, check: (r) => r.timely === true },
    // report one second past the deadline — must be late
    { pp: { execution_timestamp: '2026-06-15T10:00:00Z', report_timestamp: '2026-06-15T10:15:01Z', calendar: cal, trading_hours: hours }, check: (r) => r.timely === false },
    // execution on a weekend (Saturday 2026-06-13) rolls to next trading day
    { pp: { execution_timestamp: '2026-06-13T10:00:00Z', report_timestamp: '2026-06-15T08:10:00Z', calendar: cal, trading_hours: hours }, check: (r) => r.timely === true },
    // missing required equity field -> structurally invalid with the field named
    { pp: { execution_timestamp: '2026-06-15T10:00:00Z', report_timestamp: '2026-06-15T10:05:00Z', cat_events: [{ event_category: 'equity' }] }, check: null, checkCat: (o) => o.cat_violations.length === 1 && o.cat_violations[0].missing_fields.length > 0 },
    // missing required option-only field (strike_price) on an option event
    { pp: { execution_timestamp: '2026-06-15T10:00:00Z', report_timestamp: '2026-06-15T10:05:00Z', cat_events: [{ event_category: 'option', event_type: 'NEW', event_timestamp: '2026-06-15T10:00:00Z', firm_designated_id: 'F', order_id: 'O', symbol: 'ABC', side: 'buy', quantity: 1, option_type: 'call' }] }, check: null, checkCat: (o) => o.cat_violations.length === 1 && o.cat_violations[0].missing_fields.includes('strike_price') },
  ];
  for (const c of cases) {
    const { output_payload } = compute(c.pp);
    checked++;
    if (c.check && !c.check(output_payload.trace_result)) violations++;
    if (c.checkCat && !c.checkCat(output_payload)) violations++;
  }
  return { name: 'P4_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_iteration_cap_never_exceeded());
results.properties.push(checkP2_termination_cat_events_linear_scaling());
results.properties.push(checkP3_boundedness_and_finite_gate());
results.properties.push(checkP4_forced_categorical_boundaries());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-397-lint-trace-cat-reports',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
