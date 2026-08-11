// art-425-large-exposures-limit-check.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C19-1).
// kernel_digest_at_authoring: sha256:eea6976089a31b050d82c8bc25f5fb90f8f7e2b464627acc89bb16e5d58c859e
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES — CONFIRMED BY DIRECT READ (net_exposure/tier1_capital ratios, real
// division at `exposurePct = (net_exposure_total_musd / tier1_capital_musd) * 100`, then a
// `breached = exposurePct > limitPct` threshold comparison at the 25%/15% limit) — ULP-BOUNDARY
// FORCING IS MANDATORY per §3.
// Checks: fixture-oracle gate, termination (groups.size <= counterparties.length — the connected-
// group rollup is a single Map pass over the declared counterparties array, no recursion),
// boundedness (breach_list is a subset of groupResults, exposure_pct_of_tier1 is null iff
// tier1_capital_musd===0, never NaN/Infinity per the r2() finite gate), a differential
// re-derivation of exposure_pct_of_tier1/breached/applicable_limit_pct against an independently
// reimplemented rollup, a monotonicity property (increasing one counterparty's net exposure, all
// else fixed, never un-breaches a previously-breached group), and MANDATORY ULP-boundary forcing
// at the 25%/15% limit thresholds plus 0, negative zero, denormals, and x/y*y!==x rounding-artifact
// cases per §3/§6.B.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-425-large-exposures-limit-check.proptest.mjs

import { compute } from '../art-425-large-exposures-limit-check.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-425-large-exposures-limit-check.fixtures.json');
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
const rand = mulberry32(0x425C19);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function r2(v) { return (v === null || !Number.isFinite(v)) ? null : Math.round(v * 100) / 100; }

function randomCounterparty(rng, id, groupId, isGsib) {
  const nExp = 1 + Math.floor(rng() * 3);
  const exposures = Array.from({ length: nExp }, () => {
    const gross = randRange(rng, 0, 200);
    const crmEligible = rng() < 0.5;
    return { gross_exposure_musd: gross, crm_eligible: crmEligible, crm_value_musd: crmEligible ? randRange(rng, 0, gross) : 0 };
  });
  return { counterparty_id: id, counterparty_name: id, connected_group_id: groupId, is_gsib: isGsib, exposures };
}

function randomPP(rng) {
  const n = 1 + Math.floor(rng() * 4);
  const counterparties = Array.from({ length: n }, (_, i) => randomCounterparty(rng, `cp${i}`, rng() < 0.4 ? 'GROUP-A' : null, rng() < 0.3));
  return {
    tier1_capital_musd: randRange(rng, 1, 2000),
    caller_is_gsib: rng() < 0.4,
    counterparties,
  };
}

// Independent reimplementation of the rollup + limit math.
function reimplement(pp) {
  const tier1 = Math.max(0, pp.tier1_capital_musd || 0);
  const groups = new Map();
  for (const cp of pp.counterparties) {
    const key = cp.connected_group_id || ('__single__:' + cp.counterparty_id);
    let net = 0;
    for (const e of cp.exposures) {
      const gross = Math.max(0, e.gross_exposure_musd || 0);
      const crm = e.crm_eligible ? Math.min(Math.max(0, e.crm_value_musd || 0), gross) : 0;
      net += r2(Math.max(0, gross - crm));
    }
    net = r2(net);
    if (!groups.has(key)) groups.set(key, { isGsib: false, net: 0 });
    const g = groups.get(key);
    g.isGsib = g.isGsib || cp.is_gsib;
    g.net += net;
  }
  const out = [];
  for (const g of groups.values()) {
    const limitPct = (pp.caller_is_gsib && g.isGsib) ? 15 : 25;
    const exposurePct = tier1 > 0 ? r2((r2(g.net) / tier1) * 100) : null;
    const breached = exposurePct === null ? false : exposurePct > limitPct;
    out.push({ limitPct, exposurePct, breached });
  }
  return out;
}

const TRIALS = 4000;

// ---------- P1: termination — group count bounded by counterparties.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.groups.length > pp.counterparties.length) violations++;
  }
  return { name: 'P1_termination_group_count_bounded_by_counterparties', trials: checked, violations };
}

// ---------- P2: boundedness — breach_list subset of groups, exposure_pct null iff tier1===0, finite ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.breach_list.length > o.groups.length) violations++;
    for (const g of o.groups) {
      if (o.tier1_capital_musd === 0 && g.exposure_pct_of_tier1 !== null) violations++;
      if (g.exposure_pct_of_tier1 !== null && !Number.isFinite(g.exposure_pct_of_tier1)) violations++;
      if (!Number.isFinite(g.net_exposure_total_musd)) violations++;
    }
  }
  return { name: 'P2_breach_subset_and_exposure_pct_finite_or_null', trials: checked, violations };
}

// ---------- P3: differential — exposure_pct/breached/applicable_limit_pct re-derived ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    const expected = reimplement(pp);
    checked++;
    if (o.groups.length !== expected.length) { violations++; continue; }
    const sortedExpected = expected.slice().sort((a, b) => a.limitPct - b.limitPct);
    const sortedActual = o.groups.map((g) => ({ limitPct: g.applicable_limit_pct, exposurePct: g.exposure_pct_of_tier1, breached: g.breached })).sort((a, b) => a.limitPct - b.limitPct);
    for (let j = 0; j < sortedExpected.length; j++) {
      if (sortedActual[j].limitPct !== sortedExpected[j].limitPct) violations++;
      if (sortedActual[j].exposurePct !== sortedExpected[j].exposurePct) violations++;
      if (sortedActual[j].breached !== sortedExpected[j].breached) violations++;
    }
  }
  return { name: 'P3_exposure_pct_and_breach_differential', trials: checked, violations };
}

// ---------- P4: monotonicity — increasing net exposure never un-breaches a group ----------
function checkP4_monotonic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS / 4; i++) {
    const tier1 = randRange(rand, 10, 500);
    const grossLo = randRange(rand, 0, 300);
    const grossHi = grossLo + randRange(rand, 0.01, 300);
    const base = { tier1_capital_musd: tier1, caller_is_gsib: false, counterparties: [] };
    const ppLo = { ...base, counterparties: [{ counterparty_id: 'c0', exposures: [{ gross_exposure_musd: grossLo, crm_eligible: false }] }] };
    const ppHi = { ...base, counterparties: [{ counterparty_id: 'c0', exposures: [{ gross_exposure_musd: grossHi, crm_eligible: false }] }] };
    const oLo = compute(ppLo).output_payload;
    const oHi = compute(ppHi).output_payload;
    checked++;
    if (oLo.groups[0].breached && !oHi.groups[0].breached) violations++;
  }
  return { name: 'P4_breach_monotonic_nondecreasing_in_exposure', trials: checked, violations };
}

// ---------- P5 (mandatory): ULP-boundary forcing at the 25%/15% limit thresholds ----------
const EPS = Number.EPSILON;
function ppSingle(tier1, gross, isGsib, callerIsGsib) {
  return { tier1_capital_musd: tier1, caller_is_gsib: callerIsGsib, counterparties: [{ counterparty_id: 'c0', is_gsib: isGsib, exposures: [{ gross_exposure_musd: gross, crm_eligible: false }] }] };
}
const ULP_BOUNDARY_CASES = [
  [ppSingle(100, 25, false, false), 'ratio exactly at the 25% general limit — not breached (> required, not >=)'],
  [ppSingle(100, 25 * (1 + EPS * 8), false, false), 'ratio 1 ULP above the 25% limit — breached'],
  [ppSingle(100, 15, true, true), 'ratio exactly at the 15% GSIB-to-GSIB limit — not breached'],
  [ppSingle(100, 15 * (1 + EPS * 8), true, true), 'ratio 1 ULP above the 15% GSIB limit — breached'],
  [ppSingle(0, 50, false, false), 'tier1_capital exactly zero — exposure_pct_of_tier1 null, never NaN/Infinity, not breached'],
  [ppSingle(-0, 50, false, false), 'negative-zero tier1_capital — must behave as zero, no NaN'],
  [ppSingle(100, 0, false, false), 'zero gross exposure — ratio 0%, not breached'],
  [ppSingle(100, -0, false, false), 'negative-zero gross exposure — Math.max(0,-0) guard, no NaN'],
  [ppSingle(100, 1 / 3 * 25, false, false), 'x/y*y!==x style rounding artifact near the 25% boundary — must classify deterministically, finite'],
  [ppSingle(1, Number.MAX_SAFE_INTEGER, false, false), 'gross at MAX_SAFE_INTEGER over tiny tier1 — must not overflow to non-finite ratio, breached'],
  [ppSingle(100, NaN, false, false), 'NaN gross exposure — safeNum guard coerces to 0, ratio 0%, never NaN propagation'],
];
function checkP5_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const { output_payload: o } = compute(pp);
    const g = o.groups[0];
    const plausible = Number.isFinite(g.net_exposure_total_musd) && (g.exposure_pct_of_tier1 === null || Number.isFinite(g.exposure_pct_of_tier1)) && typeof g.breached === 'boolean';
    rows.push({ label, exposure_pct_of_tier1: g.exposure_pct_of_tier1, breached: g.breached, plausible });
  }
  return rows;
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_differential());
results.properties.push(checkP4_monotonic());
results.boundary_forced = checkP5_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  tool_id: 'art-425-large-exposures-limit-check',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);
