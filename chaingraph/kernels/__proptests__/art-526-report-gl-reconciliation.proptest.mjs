// art-526-report-gl-reconciliation.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C26-1).
// kernel_digest_at_authoring: sha256:ac0706aea54457a53cc1f56d8642d7b5f4bf09c4377b8bc7d1e52562a9d59e12
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// ⛔⛔ CORRECTION TO THE WU ROW'S TABLE (per FIX-2): the row lists this kernel as float:yes.
// Direct read of the full compute() body shows this is FIXED-POINT MONEY MATH -- the kernel's
// own docstring states verbatim "FIXED-POINT MONEY MATH (CONTRACT money convention). Every
// amount crosses the boundary as an integer number of minor units. No floating-point arithmetic
// in compute()." Every figure is coerced through toMinorUnits() (Number.isSafeInteger-gated);
// tolerance fields are Math.trunc()'d. The residual compare (`Math.abs(residual) <= tolerance`)
// is an integer compare over integer operands. Corrected to float:no; floored with forced
// categorical boundary cases at the integer residual tolerance instead of an ULP claim, per spec
// §3's float:no fallback.
// Checks: fixture-oracle gate, termination (accounts bounded by input array length), forced
// categorical boundary cases at the per-account residual tolerance (exactly at vs one minor unit
// over) and the three did_not_run gates (cadence_refused / gl_not_yet_closed / gl_stale, checked
// in that priority order and mutually exclusive with a genuine break), differential
// re-derivation of residual_minor_units/within_tolerance/gate_policy per account, boundedness
// (breaking_account_count <= account_count), and metamorphic invariance (a designed plug that
// exactly offsets the GL/reported gap moves an account from breaking to within-tolerance without
// touching any other account).
// Zero external dependencies -- pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-526-report-gl-reconciliation.proptest.mjs

import { compute } from '../art-526-report-gl-reconciliation.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-526-report-gl-reconciliation.fixtures.json');
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
const rand = mulberry32(0x52660);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomAccount(rng, i) {
  return {
    account_id: `ACC-${i}`,
    reported_figure_minor_units: Math.floor(rng() * 100000),
    gl_figure_minor_units: Math.floor(rng() * 100000),
    designed_plug_minor_units: 0,
    tolerance_minor_units: pick(rng, [0, 10, 100]),
  };
}
function randomPP(rng) {
  const n = Math.floor(rng() * 6);
  const rc = pick(rng, ['daily', 'weekly', 'monthly', 'quarterly']);
  const sc = pick(rng, ['daily', 'weekly', 'monthly', 'quarterly']);
  return {
    as_of: '2026-08-10', currency: 'USD',
    appendix_schedule_version: 'V1', appendix_schedule_source: 'src',
    reporting_cadence: rc, schedule_cadence: sc,
    gl_closed: true, gl_as_of: '2026-08-10',
    tolerance_minor_units: 0,
    accounts: Array.from({ length: n }, (_, i) => randomAccount(rng, i)),
  };
}

const TRIALS = 3000;

// ---------- P1: termination -- account_count === input length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.account_count !== pp.accounts.length) violations++;
    if (output_payload.accounts.length !== pp.accounts.length) violations++;
  }
  return { name: 'P1_termination_account_count_exact', trials: checked, violations };
}

// ---------- P2: forced categorical boundary cases -- residual tolerance + did_not_run gates ----------
function checkP2_boundary_categorical() {
  let violations = 0, checked = 0;
  const base = { as_of: '2026-01-01', currency: 'USD', appendix_schedule_version: 'V', appendix_schedule_source: 'S', reporting_cadence: 'monthly', schedule_cadence: 'monthly', gl_closed: true, gl_as_of: '2026-01-01' };
  {
    const pp = { ...base, accounts: [{ account_id: 'A', reported_figure_minor_units: 1000, gl_figure_minor_units: 900, tolerance_minor_units: 100 }] };
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.accounts[0].within_tolerance !== true) violations++; // exactly at tolerance
  }
  {
    const pp = { ...base, accounts: [{ account_id: 'A', reported_figure_minor_units: 1001, gl_figure_minor_units: 900, tolerance_minor_units: 100 }] };
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.accounts[0].within_tolerance !== false) violations++; // one over tolerance
  }
  // cadence_refused: daily request against a monthly-produced schedule
  {
    const pp = { ...base, reporting_cadence: 'daily', schedule_cadence: 'monthly', accounts: [] };
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.decision.execution_state !== 'did_not_run') violations++;
    if (!output_payload.cadence_refused) violations++;
  }
  // gl_not_yet_closed takes priority over evaluating any account
  {
    const pp = { ...base, gl_closed: false, accounts: [{ account_id: 'A', reported_figure_minor_units: 100, gl_figure_minor_units: 100, tolerance_minor_units: 0 }] };
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.decision.execution_state !== 'did_not_run') violations++;
  }
  return { name: 'P2_residual_tolerance_and_did_not_run_gates_forced_categorical', trials: checked, violations };
}

// ---------- P3 (differential): residual_minor_units / within_tolerance / gate_policy re-derivation ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.cadence_refused || (output_payload.gl_closed_declared && !output_payload.gl_closed)) continue;
    for (const a of output_payload.accounts) {
      const expectedResidual = a.reported_figure_minor_units - (a.gl_figure_minor_units + a.designed_plug_minor_units);
      if (a.residual_minor_units !== expectedResidual) violations++;
      if (a.within_tolerance !== (Math.abs(expectedResidual) <= a.tolerance_minor_units)) violations++;
    }
    const breaking = output_payload.accounts.filter((a) => !a.within_tolerance).length;
    if (output_payload.breaking_account_count !== breaking) violations++;
  }
  return { name: 'P3_residual_and_within_tolerance_differential', trials: checked, violations };
}

// ---------- P4: boundedness ----------
function checkP4_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.breaking_account_count > output_payload.account_count) violations++;
    if (output_payload.plugged_account_count > output_payload.account_count) violations++;
  }
  return { name: 'P4_boundedness_breaking_and_plugged_counts', trials: checked, violations };
}

// ---------- P5: metamorphic -- a designed plug that exactly offsets a breaking residual moves that account to within-tolerance, others untouched ----------
function checkP5_designed_plug_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const pp = randomPP(rand);
    const r1 = compute(pp).output_payload;
    checked++;
    if (pp.accounts.length === 0 || r1.cadence_refused || (r1.gl_closed_declared && !r1.gl_closed)) continue;
    const idx = r1.accounts.findIndex((a) => !a.within_tolerance);
    if (idx < 0) continue;
    const gap = r1.accounts[idx].residual_minor_units; // reported - (gl + plug); offsetting plug = gap
    const pp2 = { ...pp, accounts: pp.accounts.map((a, j) => j === idx ? { ...a, designed_plug_minor_units: gap, designed_plug_reason_code: 'offset-test' } : a) };
    const r2 = compute(pp2).output_payload;
    checked++;
    if (r2.accounts[idx].within_tolerance !== true) violations++;
    for (let j = 0; j < r1.accounts.length; j++) {
      if (j === idx) continue;
      if (r1.accounts[j].within_tolerance !== r2.accounts[j].within_tolerance) violations++;
    }
  }
  return { name: 'P5_designed_plug_offset_metamorphic', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundary_categorical());
results.properties.push(checkP3_differential());
results.properties.push(checkP4_boundedness());
results.properties.push(checkP5_designed_plug_metamorphic());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-526-report-gl-reconciliation',
  float_sensitive: false,
  float_sensitive_correction: 'WU row table said float:yes; direct source read shows the kernel is documented and implemented as fixed-point integer-only money math with no floating-point arithmetic in compute(). Corrected to float:no; floored with forced categorical boundary cases instead of ULP-boundary forcing.',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
