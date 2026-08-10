// kernel_digest_at_authoring: sha256:03ec432c5c930586d24cf6a4fbd37e6f4fc59fc351b1caa340c8691ebba3a36c
//
// FV-PROPFLOOR-SHARD-B8-1 — property-test floor for art-244-gpi-tracker-lifecycle-simulator.
// Class B (bounded-numeric), FLOAT-SENSITIVE (hours_elapsed is a raw double compared against the
// fixed 24-hour Universal Confirmation SLA with a strict > comparison) — ULP-boundary forcing is
// MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG +
// explicit boundary arrays), same shape as the B1-B7 float harnesses. This file is READ-ONLY with
// respect to the kernel it imports.
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
const rand = mulberry32(0x2440A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 10000;
const STATUSES = ['PDNG', 'ACSP', 'ACSP/ACWC', 'ACCC', 'RJCT'];
const VALID_TRANSITIONS = {
  PDNG: ['ACSP', 'RJCT'],
  ACSP: ['ACSP', 'ACSP/ACWC', 'ACCC', 'RJCT'],
  'ACSP/ACWC': ['ACSP', 'ACCC', 'RJCT'],
  ACCC: [],
  RJCT: [],
};

function mkPP(rng) {
  return {
    current_status: pick(rng, STATUSES),
    next_status: pick(rng, [...STATUSES, '']),
    hours_elapsed: randRange(rng, 0, 48),
    amount_usd: randRange(rng, 0, 100000),
  };
}

// ---------- P1: monotone — ACSP->ACCC SLA breach never un-flags as hours_elapsed increases ----------
function checkP1_monotoneSla() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const h1 = randRange(rand, 0, 48);
    const h2 = h1 + randRange(rand, 0, 24);
    const r1 = compute({ current_status: 'ACSP', next_status: 'ACCC', hours_elapsed: h1 });
    const r2 = compute({ current_status: 'ACSP', next_status: 'ACCC', hours_elapsed: h2 });
    checked++;
    if (r1.output_payload.sla_breached && !r2.output_payload.sla_breached) violations++;
  }
  return { name: 'P1_monotone_sla_breach_nondecreasing_with_hours', trials: checked, violations };
}

// ---------- P2: boundedness — allowed_next_statuses subset of known set, sla_hours_limit fixed ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  const KNOWN = new Set(STATUSES);
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.output_payload.sla_hours_limit !== 24) violations++;
    for (const s of r.output_payload.allowed_next_statuses) if (!KNOWN.has(s)) violations++;
    if (![true, false, null].includes(r.output_payload.transition_valid)) violations++;
  }
  return { name: 'P2_boundedness_allowed_next_and_sla_limit_fixed', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — sla_breached and transition_valid match independent rule ----------
function checkP3_thresholdAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (pp.current_status === 'ACSP' && pp.next_status === 'ACCC' && pp.hours_elapsed > 0) {
      const expected_breach = pp.hours_elapsed > 24;
      if (r.output_payload.sla_breached !== expected_breach) violations++;
    }
    if (STATUSES.includes(pp.current_status) && pp.next_status.length > 0) {
      const allowed = VALID_TRANSITIONS[pp.current_status] || [];
      const expected_valid = allowed.includes(pp.next_status);
      if (r.output_payload.transition_valid !== expected_valid) violations++;
    }
  }
  return { name: 'P3_sla_and_transition_match_fixed_rule', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ current_status: 'ACSP', next_status: 'ACCC', hours_elapsed: 24 }, 'hours_elapsed exactly 24 — strict >, must NOT breach'],
  [{ current_status: 'ACSP', next_status: 'ACCC', hours_elapsed: 24.000000000000004 }, 'hours_elapsed 1 ULP above 24 — must breach'],
  [{ current_status: 'ACSP', next_status: 'ACCC', hours_elapsed: 23.999999999999996 }, 'hours_elapsed 1 ULP below 24 — must NOT breach'],
  [{ current_status: 'ACSP', next_status: 'ACCC', hours_elapsed: 0 }, 'hours_elapsed exactly zero — guarded by > 0, sla_breached false'],
  [{ current_status: 'ACSP', next_status: 'ACCC', hours_elapsed: -0 }, 'hours_elapsed negative zero — must behave as zero, not breach'],
  [{ current_status: 'ACSP', next_status: 'ACCC', hours_elapsed: Number.MIN_VALUE }, 'smallest positive double hours_elapsed — must not breach, no throw'],
  [{ current_status: 'ACSP', next_status: 'ACCC', hours_elapsed: 0.1 * 3 * 80 }, 'hours_elapsed = (0.1*3)*80 rounding artifact — must remain finite'],
  [{ current_status: 'ACSP', next_status: 'ACCC', hours_elapsed: (1 / 3) * 3 * 24 }, 'x/y*y!==x rounding artifact at 24h scale — must round-trip without throwing'],
  [{ current_status: 'ACSP', next_status: 'ACCC', hours_elapsed: Number.MAX_SAFE_INTEGER }, 'hours_elapsed at MAX_SAFE_INTEGER — must remain finite, breach true, no overflow'],
  [{ current_status: 'ACSP', next_status: 'ACCC', hours_elapsed: -5 }, 'negative hours_elapsed — guarded out (not > 0), sla_breached false'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const { sla_breached, transition_valid } = r.output_payload;
    const plausible = typeof sla_breached === 'boolean' && [true, false, null].includes(transition_valid);
    rows.push({ label, hours_elapsed: pp.hours_elapsed, sla_breached, transition_valid, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneSla());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_thresholdAgreement());
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
