// art-358-simulate-output-floor.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C16-1).
// kernel_digest_at_authoring: sha256:8f781a73d514cd1ee4db0e654c32b3a632a43e3a7fdd02cc1c2f881a6bfbd873
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — this row's own triage table tags art-358 float:no,
// and direct source read agrees: every per-year figure is r2()-rounded to 2 decimal places BEFORE
// the binding comparison `floorRwa > internalModelRwa` is made, which collapses genuine ULP-scale
// noise into a cents-granularity comparison; the file therefore uses forced categorical boundary
// cases — the binding/non-binding edge, zero/empty inputs — rather than an ULP-forcing claim).
// Checks: fixture-oracle gate, termination (capital_impact_path.length === phase_in_schedule.length
// exactly — a single map over the caller-supplied array, no recursion), boundedness (applied_rwa
// is never less than internal_model_rwa for any path entry — the max() invariant the whole kernel
// exists to enforce), a differential re-derivation of floor_rwa/applied_rwa/binding/incremental_rwa
// per entry, an append-invariance metamorphic identity (appending one more schedule entry never
// changes any EARLIER entry's computed path values — each entry is computed independently, with
// no cross-entry state), and forced categorical boundary cases (empty schedule, floor_pct exactly
// 0 and 1, internal_model_rwa/standardized_rwa exactly 0, and the binding boundary itself —
// floor_rwa exactly equal to internal_model_rwa, where binding must be false since the compare is
// strictly `>`, not `>=`).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-358-simulate-output-floor.proptest.mjs

import { compute } from '../art-358-simulate-output-floor.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-358-simulate-output-floor.fixtures.json');
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
const rand = mulberry32(0x35800);

function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }
function clamp01(v) { return Math.min(1, Math.max(0, v)); }

function randomSchedule(rng, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ year: 2025 + i, floor_pct: rng() });
  return out;
}

function randomPP(rng) {
  const n = Math.floor(rng() * 8);
  return {
    internal_model_rwa: rng() * 2_000_000,
    standardized_rwa: rng() * 2_000_000,
    phase_in_schedule: randomSchedule(rng, n),
  };
}

const TRIALS = 4000;

// ---------- P1: termination — capital_impact_path.length === phase_in_schedule.length exactly ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.capital_impact_path.length !== pp.phase_in_schedule.length) violations++;
  }
  return { name: 'P1_termination_capital_impact_path_exactly_schedule_length', trials: checked, violations };
}

// ---------- P2: boundedness — applied_rwa >= internal_model_rwa for every path entry (the core floor invariant) ----------
function checkP2_applied_rwa_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    for (const entry of o.capital_impact_path) {
      if (entry.applied_rwa < o.internal_model_rwa - 0.01) violations++;
      if (entry.incremental_rwa < -0.01) violations++;
      if (entry.binding !== (entry.floor_rwa > o.internal_model_rwa)) violations++;
    }
    if (o.floor_ever_binds !== o.capital_impact_path.some((e) => e.binding)) violations++;
  }
  return { name: 'P2_applied_rwa_never_below_internal_model_rwa', trials: checked, violations };
}

// ---------- P3: metamorphic — appending one more schedule entry never changes any earlier entry's path values ----------
function checkP3_append_invariance_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const pp = randomPP(rand);
    const base = compute(pp).output_payload;
    const extended = compute({ ...pp, phase_in_schedule: [...pp.phase_in_schedule, { year: 2099, floor_pct: rand() }] }).output_payload;
    checked++;
    for (let j = 0; j < base.capital_impact_path.length; j++) {
      if (JSON.stringify(base.capital_impact_path[j]) !== JSON.stringify(extended.capital_impact_path[j])) violations++;
    }
    if (extended.capital_impact_path.length !== base.capital_impact_path.length + 1) violations++;
  }
  return { name: 'P3_append_schedule_entry_invariance_metamorphic', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no — categorical, not ULP) ----------
function checkP4_forced_categorical() {
  let violations = 0, checked = 0;
  // empty schedule
  {
    const { output_payload: o } = compute({ internal_model_rwa: 100, standardized_rwa: 200, phase_in_schedule: [] });
    checked++;
    if (o.capital_impact_path.length !== 0 || o.floor_ever_binds !== false || o.binding_floor_year !== null) violations++;
  }
  // floor_pct exactly 0 and exactly 1
  {
    const { output_payload: o } = compute({ internal_model_rwa: 100, standardized_rwa: 500, phase_in_schedule: [{ year: 2025, floor_pct: 0 }, { year: 2026, floor_pct: 1 }] });
    checked++;
    if (o.capital_impact_path[0].floor_rwa !== 0) violations++;
    if (o.capital_impact_path[1].floor_rwa !== 500) violations++;
    if (o.capital_impact_path[1].binding !== true) violations++;
  }
  // internal_model_rwa / standardized_rwa exactly 0
  {
    const { output_payload: o } = compute({ internal_model_rwa: 0, standardized_rwa: 0, phase_in_schedule: [{ year: 2025, floor_pct: 0.5 }] });
    checked++;
    if (o.capital_impact_path[0].floor_rwa !== 0) violations++;
    if (o.capital_impact_path[0].binding !== false) violations++; // 0 > 0 is false — floor never STRICTLY exceeds
  }
  // the binding boundary itself — floor_rwa EXACTLY equal to internal_model_rwa (strict > , not >=)
  {
    const { output_payload: o } = compute({ internal_model_rwa: 500, standardized_rwa: 1000, phase_in_schedule: [{ year: 2025, floor_pct: 0.5 }] });
    checked++;
    if (o.capital_impact_path[0].floor_rwa !== 500) violations++;
    if (o.capital_impact_path[0].binding !== false) violations++; // equal, not greater -> not binding
    if (o.capital_impact_path[0].applied_rwa !== 500) violations++;
  }
  return { name: 'P4_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_applied_rwa_boundedness());
results.properties.push(checkP3_append_invariance_metamorphic());
results.properties.push(checkP4_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-358-simulate-output-floor',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
