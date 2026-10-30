// 790-je-period-lock-gate.proptest.mjs — class-K property-test FLOOR
// (FV-PBT-FLOOR-BUILD-SPEC.md), authored in-row by JE-PERIOD-LOCK-GATE-1.
// kernel_digest_at_authoring: sha256:8367d8baee158d08943a084c2bf883eb5442620f5410071d5587e6893e49b866
// spec: board/queued/JE-PERIOD-LOCK-GATE-1.md (fixed contract)
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof.
// float_sensitive: NO (integer civil-date arithmetic and categorical decisions only).
// Checks: fixture-oracle gate, termination/bounded count, enum boundedness,
// hard-closed-refuses-everyone invariant, fail-closed on policy faults,
// entry-order permutation invariance, entry-cap boundary, strict leap-day calendar.
// ZERO external dependencies — Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/790-je-period-lock-gate.proptest.mjs

import { compute } from '../790-je-period-lock-gate.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', '790-je-period-lock-gate.fixtures.json');
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

// mulberry32 PRNG (public-domain reference form), hand-rolled, fixed seed — deterministic runs.
function mulberry32(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x789A11);

const ISO_MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
function isoOfIdx(i) { // deterministic spread of calendar-VALID dates across 2024..2031
  const y = 2024 + (i % 8);
  const m = 1 + (Math.floor(i / 8) % 12);
  const maxD = m === 2 && isLeap(y) ? 29 : ISO_MONTH_DAYS[m - 1];
  const d = 1 + (i % maxD);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function randDateStr(rng) { // MAY be a non-calendar date (Feb 29/30/31 shapes) — that is the point
  const y = 2024 + Math.floor(rng() * 8);
  const m = 1 + Math.floor(rng() * 12);
  const d = 1 + Math.floor(rng() * 31);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const BASE_PERIODS = [
  { period_id: 'P1', start_date: '2024-01-01', end_date: '2024-12-31', lock_events: [{ from_date: '2024-06-01', state: 'soft_locked' }, { from_date: '2024-10-01', state: 'hard_closed' }] },
  { period_id: 'P2', start_date: '2025-01-01', end_date: '2025-06-30', lock_events: [] },
];
const basePolicy = {
  policy_version: 'pv-1',
  periods: BASE_PERIODS,
  soft_lock_exempt_roles: ['controller'],
  reversal_policy: 'original_date',
};
function randEntry(rng, idx) {
  const e = {
    entry_id: `E${idx}`,
    effective_date: randDateStr(rng),
    entered_on: randDateStr(rng),
    roles: rng() < 0.4 ? ['controller'] : (rng() < 0.7 ? ['ap_clerk'] : []),
  };
  if (rng() < 0.4) e.prepared_by = 'u7';
  if (rng() < 0.4) e.approved_by = rng() < 0.5 ? 'u7' : 'u8';
  return e;
}

const VALID_DECISIONS = new Set(['allow', 'allow_exempt', 'refuse']);
const VALID_STATES = new Set(['open', 'soft_locked', 'hard_closed']);
const TRIALS = 6000;

// ---------- P1: termination — entry_count === entries.length, totals sum to it ----------
function checkP1_termination() {
  let violations = 0, trials = 0;
  for (let i = 0; i < 200; i++) {
    const n = Math.floor(rand() * 300);
    const entries = Array.from({ length: n }, (_, idx) => randEntry(rand, idx));
    const { output_payload } = compute({ ...basePolicy, entries });
    trials++;
    if (output_payload.execution_state !== 'ran') violations++;
    else if (output_payload.entry_count !== n || output_payload.entries.length !== n) violations++;
    else {
      const t = output_payload.totals_by_decision;
      if (t.allow + t.allow_exempt + t.refuse !== n) violations++;
      let periodSum = 0;
      for (const pid of Object.keys(output_payload.totals_by_period)) {
        const tp = output_payload.totals_by_period[pid];
        periodSum += tp.allow + tp.allow_exempt + tp.refuse;
      }
      const nullPeriod = output_payload.entries.filter((e) => e.period_id === null).length;
      if (periodSum + nullPeriod !== n) violations++; // gap refusals carry no period
    }
  }
  return { name: 'P1_termination_bounded_count', trials, violations };
}

// ---------- P2: enum boundedness + decision/exempt/refusal mutual exclusion ----------
function checkP2_enum_bounded() {
  let violations = 0, trials = 0;
  for (let i = 0; i < TRIALS; i++) {
    const entries = Array.from({ length: 1 + Math.floor(rand() * 5) }, (_, idx) => randEntry(rand, idx));
    const { output_payload } = compute({ ...basePolicy, entries });
    trials++;
    for (const e of output_payload.entries) {
      if (!VALID_DECISIONS.has(e.decision)) violations++;
      if (e.lock_state_at_entry !== null && !VALID_STATES.has(e.lock_state_at_entry)) violations++;
      if (!(e.self_approval === true || e.self_approval === false || e.self_approval === null)) violations++;
      if (e.decision !== 'refuse' && e.refusal_code !== null) violations++;
      if (e.decision === 'allow_exempt' && e.exempt_role_used === null) violations++;
      if (e.decision !== 'allow_exempt' && e.exempt_role_used !== null) violations++;
      if (e.decision === 'refuse' && e.refusal_code === null) violations++;
    }
  }
  return { name: 'P2_enum_bounded', trials, violations };
}

// ---------- P3: hard_closed refuses everyone, exempt roles included ----------
function checkP3_hard_closed_refuses_everyone() {
  let violations = 0, trials = 0;
  for (let i = 0; i < TRIALS; i++) {
    const entries = Array.from({ length: 1 + Math.floor(rand() * 4) }, (_, idx) => ({
      entry_id: `E${idx}`,
      effective_date: isoOfIdx(idx + i * 7), // stays inside P1 (2024)
      entered_on: '2024-11-15', // after P1's 2024-10-01 hard close
      roles: ['controller', 'staff', 'auditor'],
    }));
    const { output_payload } = compute({ ...basePolicy, entries });
    trials++;
    for (const e of output_payload.entries) {
      if (e.period_id === 'P1' && (e.decision !== 'refuse' || e.refusal_code !== 'HARD_CLOSED')) violations++;
    }
  }
  return { name: 'P3_hard_closed_refuses_everyone', trials, violations };
}

// ---------- P4: fail-closed — a structurally bad policy never yields per-entry decisions ----------
function checkP4_fail_closed_on_policy_fault() {
  let violations = 0, trials = 0;
  const badPolicies = [
    { periods: [...BASE_PERIODS, { period_id: 'OVL', start_date: '2024-06-15', end_date: '2025-12-31', lock_events: [] }], code: 'POLICY_PERIOD_OVERLAP' },
    { periods: [...BASE_PERIODS, { period_id: 'BAD', start_date: '2026-06-01', end_date: '2026-05-01', lock_events: [] }], code: 'POLICY_PERIOD_START_AFTER_END' },
    { periods: [{ period_id: 'U', start_date: '2024-01-01', end_date: '2024-12-31', lock_events: [{ from_date: '2024-06-01', state: 'frozen' }] }], code: 'POLICY_UNKNOWN_LOCK_STATE' },
    { periods: [{ period_id: 'W', start_date: '2024-01-01', end_date: '2024-12-31', lock_events: [{ from_date: '2024-08-01', state: 'soft_locked' }, { from_date: '2024-06-01', state: 'open' }] }], code: 'POLICY_LOCK_EVENTS_UNORDERED' },
    { periods: BASE_PERIODS, reversal_policy: undefined, code: 'POLICY_REVERSAL_POLICY_MISSING' },
    { periods: BASE_PERIODS, reversal_policy: 'explicit_date', code: 'POLICY_EXPLICIT_DATE_MISSING' },
  ];
  const entries = Array.from({ length: 3 }, (_, idx) => randEntry(rand, idx));
  for (let i = 0; i < badPolicies.length * 500; i++) {
    const bp = badPolicies[i % badPolicies.length];
    const { output_payload } = compute({ ...basePolicy, ...bp, entries });
    trials++;
    if (output_payload.execution_state !== 'did_not_run') violations++;
    if (!String(output_payload.reason).startsWith(bp.code)) violations++;
    if (output_payload.entries.length !== 0 || output_payload.entry_count !== 0) violations++;
    if (output_payload.totals_by_decision.allow !== 0 || output_payload.totals_by_decision.allow_exempt !== 0 || output_payload.totals_by_decision.refuse !== 0) violations++;
  }
  return { name: 'P4_fail_closed_on_policy_fault', trials, violations };
}

// ---------- P5: permutation invariance — entry order never changes any per-entry record ----------
function checkP5_permutation_invariance() {
  let violations = 0, trials = 0;
  const key = (e) => JSON.stringify([e.entry_id, e.decision, e.period_id, e.lock_state_at_entry, e.exempt_role_used, e.resolved_effective_date, e.refusal_code, e.self_approval]);
  for (let i = 0; i < 2000; i++) {
    const n = 1 + Math.floor(rand() * 12);
    const entries = Array.from({ length: n }, (_, idx) => randEntry(rand, idx));
    const r1 = compute({ ...basePolicy, entries }).output_payload;
    const r2 = compute({ ...basePolicy, entries: [...entries].reverse() }).output_payload;
    trials++;
    if (r1.execution_state !== 'ran' || r2.execution_state !== 'ran') continue;
    const s1 = new Set(r1.entries.map(key));
    const s2 = new Set(r2.entries.map(key));
    if (s1.size !== s2.size || [...s1].some((k) => !s2.has(k))) violations++;
  }
  return { name: 'P5_permutation_invariance', trials, violations };
}

// ---------- P6: entry cap boundary — 500 runs, 501 refuses the whole run ----------
function checkP6_entry_cap_boundary() {
  let violations = 0, trials = 0;
  for (const n of [499, 500]) {
    const entries = Array.from({ length: n }, (_, idx) => ({ entry_id: `C${idx}`, effective_date: '2024-02-15', entered_on: '2024-02-15', roles: [] }));
    const { output_payload } = compute({ ...basePolicy, entries });
    trials++;
    if (output_payload.execution_state !== 'ran' || output_payload.entry_count !== n) violations++;
  }
  for (const n of [501, 700]) {
    const entries = Array.from({ length: n }, (_, idx) => ({ entry_id: `C${idx}`, effective_date: '2024-02-15', entered_on: '2024-02-15', roles: [] }));
    const { output_payload } = compute({ ...basePolicy, entries });
    trials++;
    if (output_payload.execution_state !== 'did_not_run' || !String(output_payload.reason).startsWith('ENTRY_CAP_EXCEEDED')) violations++;
  }
  return { name: 'P6_entry_cap_boundary', trials, violations };
}

// ---------- P7: strict leap-day calendar — Feb 29 only on real leap years, Feb 30/31 never ----------
function checkP7_strict_leap_calendar() {
  let violations = 0, trials = 0;
  const years = [2024, 2025, 2026, 2027, 2028, 2029, 2100, 2000]; // 2100 NOT a leap year; 2000 IS
  for (const y of years) {
    const leap = isLeap(y);
    const mk = (d) => ({
      ...basePolicy,
      periods: [{ period_id: `FY${y}`, start_date: `${y}-01-01`, end_date: `${y}-12-31`, lock_events: [] }],
      entries: [{ entry_id: 'E1', effective_date: `${y}-02-${d}`, entered_on: `${y}-02-${d}`, roles: ['staff'] }],
    });
    const feb29 = compute(mk('29')).output_payload;
    trials++;
    if (leap) {
      if (feb29.execution_state !== 'ran' || feb29.entries[0].decision !== 'allow') violations++;
    } else if (feb29.entries[0].refusal_code !== 'BAD_DATE') violations++;
    for (const d of ['30', '31']) {
      const got = compute(mk(d)).output_payload;
      trials++;
      if (got.entries[0].refusal_code !== 'BAD_DATE') violations++;
    }
  }
  return { name: 'P7_strict_leap_calendar', trials, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_enum_bounded());
results.properties.push(checkP3_hard_closed_refuses_everyone());
results.properties.push(checkP4_fail_closed_on_policy_fault());
results.properties.push(checkP5_permutation_invariance());
results.properties.push(checkP6_entry_cap_boundary());
results.properties.push(checkP7_strict_leap_calendar());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: '790-je-period-lock-gate',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
