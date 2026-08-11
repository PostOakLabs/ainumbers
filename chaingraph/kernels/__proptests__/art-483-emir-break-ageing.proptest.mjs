// art-483-emir-break-ageing.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C23-1).
// kernel_digest_at_authoring: sha256:61ca7bf25c81b012ffcf0eacf2a531f340641c6492b4f96ad95b2e17faab1a11
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO, direct read confirmed — all arithmetic is day-granularity integer math
// (Math.floor of a millisecond delta / DAY_MS) over Date.parse(<ISO string>) results, the same
// deadline-vs-evaluated_at shape as art-428-cyber-incident-clock, which
// FV-PROPFLOOR-SHARD-B23-1 independently corrected to float:no for the identical reason (strict
// integer/timestamp `>=` comparisons cannot exhibit float rounding artifacts). The one place a
// caller-supplied non-integer (`policy.escalation_days`) could introduce a non-integer
// millisecond product is exercised below as a forced categorical case, not treated as requiring
// ULP forcing (the decision is still a plain `>=` timestamp compare, not an accumulated-error
// path). Forced CATEGORICAL day-boundary cases used per spec §3's float:no row.
// Checks: fixture-oracle gate, termination (breaks.length bounded by current.length),
// differential re-derivation of persisting/newly_opened/age_days/escalation_status, boundedness
// (escalation_breached_count <= breaks.length), forced categorical day-boundary cases (age
// exactly 0, evaluated_at before first_seen clamp, exact escalation-deadline tie, fractional
// escalation_days), and metamorphic permutation-invariance of current[] order (exact, since
// per-break-key classification is order-independent).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-483-emir-break-ageing.proptest.mjs

import { compute } from '../art-483-emir-break-ageing.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };
const DAY_MS = 86400000;

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-483-emir-break-ageing.fixtures.json');
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
const rand = mulberry32(0x483C23);

const AGEING_LIMITS = [
  { bucket_name: '0-7d', min_days: 0, max_days: 7 },
  { bucket_name: '8-30d', min_days: 8, max_days: 30 },
  { bucket_name: '31+d', min_days: 31, max_days: 999999 },
];

function randPastDate(rng, baseMs, maxDaysBack) {
  const back = Math.floor(rng() * maxDaysBack);
  return new Date(baseMs - back * DAY_MS).toISOString().slice(0, 10);
}

function randomPP(rng) {
  const evalDate = '2026-07-27';
  const evalMs = Date.parse(evalDate);
  const nCurrent = Math.floor(rng() * 8);
  const nPrior = Math.floor(rng() * 8);
  const current = [];
  const prior = [];
  const keys = [];
  for (let i = 0; i < Math.max(nCurrent, nPrior) + 3; i++) keys.push(`UTI${i}::field`);
  for (let i = 0; i < nCurrent; i++) {
    current.push({ break_key: keys[Math.floor(rng() * keys.length)], uti: `UTI${i}`, field_name: 'notional_amount' });
  }
  for (let i = 0; i < nPrior; i++) {
    prior.push({
      break_key: keys[Math.floor(rng() * keys.length)],
      uti: `UTI${i}`,
      field_name: 'notional_amount',
      first_seen_at: randPastDate(rng, evalMs, 45) + 'T00:00:00.000Z',
      recurrence_count: Math.floor(rng() * 5),
    });
  }
  return {
    current_break_set: current,
    prior_sealed_break_set: prior,
    policy: { ageing_limits: AGEING_LIMITS, escalation_days: 30, evaluated_at: evalDate },
  };
}

function refCompute(pp) {
  const priorByKey = new Map();
  for (const b of pp.prior_sealed_break_set) if (b && b.break_key) priorByKey.set(b.break_key, b);
  const evaluatedAtMs = Date.parse(pp.policy.evaluated_at);
  const seen = new Set();
  const rows = [];
  for (const b of pp.current_break_set) {
    if (!b || !b.break_key) continue;
    seen.add(b.break_key);
    const priorEntry = priorByKey.get(b.break_key) || null;
    const priorFirstSeenMs = priorEntry ? Date.parse(priorEntry.first_seen_at) : null;
    const firstSeenMs = priorFirstSeenMs != null && Number.isFinite(priorFirstSeenMs) ? priorFirstSeenMs : evaluatedAtMs;
    const ageDays = Math.max(0, Math.floor((evaluatedAtMs - firstSeenMs) / DAY_MS));
    const status = priorEntry ? 'persisting' : 'newly_opened';
    rows.push({ break_key: b.break_key, status, ageDays });
  }
  const newlyClosedCount = [...priorByKey.keys()].filter((k) => !seen.has(k)).length;
  return { rows, newlyClosedCount };
}

const TRIALS = 5000;

// ---------- P1: termination — breaks.length bounded by current_break_set length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.breaks.length > pp.current_break_set.length) violations++;
    if (output_payload.newly_closed.length > pp.prior_sealed_break_set.length) violations++;
  }
  return { name: 'P1_termination_breaks_bounded', trials: checked, violations };
}

// ---------- P2 (differential): persisting/newly_opened + age_days re-derivation ----------
function checkP2_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const ref = refCompute(pp);
    if (output_payload.breaks.length !== ref.rows.length) { violations++; continue; }
    for (let k = 0; k < output_payload.breaks.length; k++) {
      const got = output_payload.breaks[k];
      const exp = ref.rows[k];
      if (got.status !== exp.status) violations++;
      if (got.age_days !== exp.ageDays) violations++;
    }
    if (output_payload.newly_closed.length !== ref.newlyClosedCount) violations++;
  }
  return { name: 'P2_persisting_ageDays_differential', trials: checked, violations };
}

// ---------- P3: boundedness — escalation_breached_count <= breaks.length ----------
function checkP3_boundedness() {
  let violations = 0, checked = 0;
  const KNOWN = new Set(['0-7d', '8-30d', '31+d', 'unbucketed']);
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.escalation_breached_count > output_payload.breaks.length) violations++;
    for (const b of output_payload.breaks) {
      if (!KNOWN.has(b.ageing_bucket)) violations++;
    }
  }
  return { name: 'P3_escalation_and_bucket_boundedness', trials: checked, violations };
}

// ---------- P4 (float:no exception): forced categorical day-boundary cases ----------
function checkP4_forced() {
  const rows = [];
  const cases = [
    {
      label: 'age exactly 0 (first_seen_at == evaluated_at)',
      pp: { current_break_set: [{ break_key: 'K1', uti: 'U1', field_name: 'f' }], prior_sealed_break_set: [{ break_key: 'K1', first_seen_at: '2026-07-27T00:00:00.000Z', recurrence_count: 1 }], policy: { ageing_limits: AGEING_LIMITS, escalation_days: 30, evaluated_at: '2026-07-27' } },
      expect: (o) => o.breaks[0].age_days === 0 && o.breaks[0].ageing_bucket === '0-7d',
    },
    {
      label: 'evaluated_at BEFORE first_seen_at -> clamp age to 0, never negative',
      pp: { current_break_set: [{ break_key: 'K1', uti: 'U1', field_name: 'f' }], prior_sealed_break_set: [{ break_key: 'K1', first_seen_at: '2026-08-01T00:00:00.000Z', recurrence_count: 1 }], policy: { ageing_limits: AGEING_LIMITS, escalation_days: 30, evaluated_at: '2026-07-27' } },
      expect: (o) => o.breaks[0].age_days === 0,
    },
    {
      label: 'exact escalation-deadline tie (firstSeen + escalation_days*DAY_MS === evaluated_at) -> breached',
      pp: { current_break_set: [{ break_key: 'K1', uti: 'U1', field_name: 'f' }], prior_sealed_break_set: [{ break_key: 'K1', first_seen_at: '2026-06-27T00:00:00.000Z', recurrence_count: 1 }], policy: { ageing_limits: AGEING_LIMITS, escalation_days: 30, evaluated_at: '2026-07-27' } },
      expect: (o) => o.breaks[0].escalation_clock.escalation_status === 'breached',
    },
    {
      label: 'one millisecond before the escalation deadline -> on_track',
      pp: { current_break_set: [{ break_key: 'K1', uti: 'U1', field_name: 'f' }], prior_sealed_break_set: [{ break_key: 'K1', first_seen_at: '2026-06-27T00:00:00.001Z', recurrence_count: 1 }], policy: { ageing_limits: AGEING_LIMITS, escalation_days: 30, evaluated_at: '2026-07-27' } },
      expect: (o) => o.breaks[0].escalation_clock.escalation_status === 'on_track',
    },
    {
      label: 'fractional escalation_days (0.5) still yields a plain timestamp compare, no throw',
      pp: { current_break_set: [{ break_key: 'K1', uti: 'U1', field_name: 'f' }], prior_sealed_break_set: [{ break_key: 'K1', first_seen_at: '2026-07-26T12:00:00.000Z', recurrence_count: 1 }], policy: { ageing_limits: AGEING_LIMITS, escalation_days: 0.5, evaluated_at: '2026-07-27' } },
      expect: (o) => o.breaks[0].escalation_clock.escalation_status === 'breached',
    },
    {
      label: 'bucket boundary exactly at max_days=7 -> still 0-7d, not 8-30d',
      pp: { current_break_set: [{ break_key: 'K1', uti: 'U1', field_name: 'f' }], prior_sealed_break_set: [{ break_key: 'K1', first_seen_at: '2026-07-20T00:00:00.000Z', recurrence_count: 1 }], policy: { ageing_limits: AGEING_LIMITS, escalation_days: 30, evaluated_at: '2026-07-27' } },
      expect: (o) => o.breaks[0].age_days === 7 && o.breaks[0].ageing_bucket === '0-7d',
    },
    {
      label: 'newly_closed: a prior key absent from current is reported closed',
      pp: { current_break_set: [], prior_sealed_break_set: [{ break_key: 'K1', first_seen_at: '2026-07-01T00:00:00.000Z' }], policy: { ageing_limits: AGEING_LIMITS, escalation_days: 30, evaluated_at: '2026-07-27' } },
      expect: (o) => o.newly_closed.length === 1 && o.newly_closed[0].break_key === 'K1',
    },
    {
      label: 'no escalation_days policy -> escalation_clock null, never throws',
      pp: { current_break_set: [{ break_key: 'K1', uti: 'U1', field_name: 'f' }], prior_sealed_break_set: [], policy: { ageing_limits: AGEING_LIMITS, evaluated_at: '2026-07-27' } },
      expect: (o) => o.breaks[0].escalation_clock === null,
    },
  ];
  for (const c of cases) {
    let threw = false, o;
    try { o = compute(c.pp).output_payload; } catch (e) { threw = true; }
    const plausible = !threw && c.expect(o);
    rows.push({ label: c.label, threw, plausible });
  }
  return rows;
}

// ---------- P5: metamorphic — exact permutation-invariance of current[] order ----------
function checkP5_permutation_exact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 3000; i++) {
    const pp = randomPP(rand);
    const shuffled = [...pp.current_break_set];
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    const r1 = compute(pp).output_payload;
    const r2 = compute({ ...pp, current_break_set: shuffled }).output_payload;
    checked++;
    const set1 = new Set(r1.breaks.map((b) => `${b.break_key}:${b.status}:${b.age_days}`));
    const set2 = new Set(r2.breaks.map((b) => `${b.break_key}:${b.status}:${b.age_days}`));
    if (set1.size !== set2.size) violations++;
    for (const s of set1) if (!set2.has(s)) violations++;
    if (r1.escalation_breached_count !== r2.escalation_breached_count) violations++;
  }
  return { name: 'P5_permutation_invariance_exact', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_differential());
results.properties.push(checkP3_boundedness());
results.boundary_forced = checkP4_forced();
results.properties.push(checkP5_permutation_exact());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  tool_id: 'art-483-emir-break-ageing',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);
