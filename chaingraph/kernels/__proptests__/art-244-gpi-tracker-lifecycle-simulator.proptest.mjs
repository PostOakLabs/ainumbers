// kernel_digest_at_authoring: sha256:95a121c21ae663021a54823e43d3f181762a899c730c31f7d5356f12cd1ba043
//
// FV-PROPFLOOR-SHARD-B28-1 — property-test floor for art-244-gpi-tracker-lifecycle-simulator.
// Class B (bounded-numeric), FLOAT-SENSITIVE (hours_elapsed compared against the fixed
// GPI_SLA_HOURS=24 threshold) — ULP-boundary forcing is MANDATORY per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-244-gpi-tracker-lifecycle-simulator.proptest.mjs

import { compute } from '../art-244-gpi-tracker-lifecycle-simulator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-244-gpi-tracker-lifecycle-simulator.fixtures.json');
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
const rand = mulberry32(0x244C3);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 12000;

const STATUSES = ['PDNG', 'ACSP', 'ACSP/ACWC', 'ACCC', 'RJCT', 'BOGUS'];
const VALID_TRANSITIONS = {
  'PDNG':    ['ACSP', 'RJCT'],
  'ACSP':    ['ACSP', 'ACSP/ACWC', 'ACCC', 'RJCT'],
  'ACSP/ACWC': ['ACSP', 'ACCC', 'RJCT'],
  'ACCC':    [],
  'RJCT':    [],
};
const TERMINAL = ['ACCC', 'RJCT'];

function mkPP(rng) {
  const current_status = pick(rng, STATUSES);
  const next_status = rng() < 0.9 ? pick(rng, STATUSES) : '';
  const hours_elapsed = randRange(rng, -5, 100);
  const amount_usd = randRange(rng, 0, 1000000);
  return { current_status, next_status, hours_elapsed, amount_usd };
}

// ---------- P1: sla_breached exactly matches (current=ACSP && next=ACCC && hours_elapsed>0) => hours_elapsed>24 ----------
function checkP1_slaBreachedExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const applies = pp.current_status === 'ACSP' && pp.next_status === 'ACCC' && pp.hours_elapsed > 0;
    const expected = applies ? pp.hours_elapsed > 24 : false;
    if (r.output_payload.sla_breached !== expected) violations++;
  }
  return { name: 'P1_sla_breached_matches_24h_threshold_when_applicable', trials: checked, violations };
}

// ---------- P2: transition_valid matches the fixed VALID_TRANSITIONS table ----------
function checkP2_transitionValidMatchesTable() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const currentValid = STATUSES.slice(0, 5).indexOf(pp.current_status) !== -1;
    if (!currentValid || pp.next_status.length === 0) continue;
    checked++;
    let expected;
    if (TERMINAL.indexOf(pp.current_status) !== -1) expected = false;
    else expected = (VALID_TRANSITIONS[pp.current_status] || []).indexOf(pp.next_status) !== -1;
    if (r.output_payload.transition_valid !== expected) violations++;
  }
  return { name: 'P2_transition_valid_matches_fixed_table', trials: checked, violations };
}

// ---------- P3: boundedness — is_terminal/is_settled/is_rejected are consistent booleans, output stage is a declared status ----------
function checkP3_boundedFlags() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { is_terminal, is_settled, is_rejected, current_status } = r.output_payload;
    if (is_settled && current_status !== 'ACCC') violations++;
    if (is_rejected && current_status !== 'RJCT') violations++;
    if ((is_settled || is_rejected) && !is_terminal) violations++;
  }
  return { name: 'P3_terminal_settled_rejected_flags_consistent', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing around GPI_SLA_HOURS=24 ----------
const ULP_BOUNDARY_CASES = [
  [{ current_status: 'ACSP', next_status: 'ACCC', hours_elapsed: 24, amount_usd: 1000 }, 'hours_elapsed exactly at 24h threshold — sla_breached must be false (> is strict)'],
  [{ current_status: 'ACSP', next_status: 'ACCC', hours_elapsed: 24 + Number.EPSILON * 24, amount_usd: 1000 }, 'hours_elapsed 1 ULP above 24h — sla_breached must be true'],
  [{ current_status: 'ACSP', next_status: 'ACCC', hours_elapsed: 24 - Number.EPSILON * 24, amount_usd: 1000 }, 'hours_elapsed 1 ULP below 24h — sla_breached must be false'],
  [{ current_status: 'ACSP', next_status: 'ACCC', hours_elapsed: 0, amount_usd: 1000 }, 'hours_elapsed exactly zero — SLA branch does not apply (>0 required), sla_breached false'],
  [{ current_status: 'ACSP', next_status: 'ACCC', hours_elapsed: -0, amount_usd: 1000 }, 'hours_elapsed negative zero — must behave as zero, no NaN, sla_breached false'],
  [{ current_status: 'ACSP', next_status: 'ACCC', hours_elapsed: Number.MIN_VALUE, amount_usd: 1000 }, 'hours_elapsed smallest positive denormal — must classify not-breached, finite'],
  [{ current_status: 'ACSP', next_status: 'ACCC', hours_elapsed: NaN, amount_usd: 1000 }, 'hours_elapsed NaN — safeNum coerces to 0, sla branch does not apply'],
  [{ current_status: 'ACSP', next_status: 'ACCC', hours_elapsed: 8 * 3, amount_usd: 1000 }, 'hours_elapsed = 8*3 arithmetic chain landing exactly at 24 — must not misfire due to rounding'],
  [{ current_status: 'ACSP', next_status: 'ACCC', hours_elapsed: Number.MAX_SAFE_INTEGER, amount_usd: 1000 }, 'hours_elapsed at MAX_SAFE_INTEGER — must remain finite, sla_breached true'],
  [{ current_status: 'ACSP', next_status: '', hours_elapsed: 1e-300, amount_usd: 1000 }, 'hours_elapsed subnormal, no next_status — SLA_AT_RISK branch (elapsed<=24) must not misfire'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const { sla_breached, sla_note } = r.output_payload;
    const plausible = typeof sla_breached === 'boolean' && typeof sla_note === 'string';
    rows.push({ label, input: pp, sla_breached, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_slaBreachedExact());
results.properties.push(checkP2_transitionValidMatchesTable());
results.properties.push(checkP3_boundedFlags());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);
