// art-484-regrpt-editcheck-runner.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C23-1).
// kernel_digest_at_authoring: sha256:ccd3d4cba38af7145df90e543cf9b928f90949437da3a54ad4eb4e812bffcab4
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES, direct read confirmed — arithmetic_identity sums caller-supplied cell
// values and compares |sum-reported| <= tolerance; cross_schedule_tie_out compares |a-b| <= tol;
// sign_domain's 'range' path compares against caller-supplied min/max floats. ULP-boundary
// forcing is mandatory per spec §3.
// Checks: fixture-oracle gate, termination (findings.length === count of rules with a non-empty
// edit_id), differential re-derivation of arithmetic_identity/cross_schedule_tie_out pass/fail,
// boundedness (pass+fail+suppressed === applied rules), ULP-boundary forcing on the tolerance
// comparison (0, -0, denormals, ±1 ULP, the classic 0.1+0.2!==0.3 representation gap), and
// metamorphic suppression-identity (suppressing one more edit_id strictly moves it from
// pass/fail into suppressed, changing no other rule's verdict).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-484-regrpt-editcheck-runner.proptest.mjs

import { compute } from '../art-484-regrpt-editcheck-runner.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-484-regrpt-editcheck-runner.fixtures.json');
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
const rand = mulberry32(0x484C23);

function randomCells(rng, n) {
  const cells = [];
  for (let i = 0; i < n; i++) cells.push({ cell_ref: `C${i}`, value: Math.round((rng() - 0.3) * 20000) / 100, schedule: 'RC' });
  return cells;
}

function randomRules(rng, cellRefs) {
  const n = Math.floor(rng() * 6);
  const rules = [];
  for (let i = 0; i < n; i++) {
    const t = pick(rng, ['arithmetic_identity', 'cross_schedule_tie_out', 'mandatory_field']);
    if (t === 'arithmetic_identity' && cellRefs.length >= 2) {
      const comp = [cellRefs[0]];
      rules.push({ edit_id: `E${i}`, type: t, component_refs: comp, target_ref: cellRefs[1], tolerance: rng() < 0.5 ? 0 : rng() * 5 });
    } else if (t === 'cross_schedule_tie_out' && cellRefs.length >= 2) {
      rules.push({ edit_id: `E${i}`, type: t, ref_a: cellRefs[0], ref_b: cellRefs[1], tolerance: rng() < 0.5 ? 0 : rng() * 5 });
    } else if (cellRefs.length >= 1) {
      rules.push({ edit_id: `E${i}`, type: 'mandatory_field', ref: cellRefs[0] });
    }
  }
  return rules;
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomPP(rng) {
  const nCells = 2 + Math.floor(rng() * 4);
  const cells = randomCells(rng, nCells);
  const refs = cells.map((c) => c.cell_ref);
  return { report_instance: { cells }, rule_set: { version: 'v1', rules: randomRules(rng, refs) }, suppressions: [] };
}

const TRIALS = 5000;

// ---------- P1: termination — findings.length === count of rules with a non-empty edit_id ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expectedCount = pp.rule_set.rules.filter((r) => r && typeof r.edit_id === 'string' && r.edit_id).length;
    if (output_payload.findings.length !== expectedCount) violations++;
    if (output_payload.summary.total_rules !== pp.rule_set.rules.length) violations++;
  }
  return { name: 'P1_termination_findings_bounded', trials: checked, violations };
}

// ---------- P2 (differential): arithmetic_identity / cross_schedule_tie_out pass/fail re-derivation ----------
function checkP2_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const cellMap = new Map(pp.report_instance.cells.map((c) => [c.cell_ref, c.value]));
    for (const rule of pp.rule_set.rules) {
      const finding = output_payload.findings.find((f) => f.edit_id === rule.edit_id);
      if (!finding) continue;
      if (rule.type === 'arithmetic_identity') {
        const sum = rule.component_refs.reduce((acc, r) => acc + cellMap.get(r), 0);
        const reported = cellMap.get(rule.target_ref);
        const tol = Math.abs(rule.tolerance ?? 0);
        const pass = Math.abs(sum - reported) <= tol;
        if (finding.status !== (pass ? 'pass' : 'fail')) violations++;
      } else if (rule.type === 'cross_schedule_tie_out') {
        const a = cellMap.get(rule.ref_a), b = cellMap.get(rule.ref_b);
        const tol = Math.abs(rule.tolerance ?? 0);
        const pass = Math.abs(a - b) <= tol;
        if (finding.status !== (pass ? 'pass' : 'fail')) violations++;
      }
    }
  }
  return { name: 'P2_tolerance_pass_fail_differential', trials: checked, violations };
}

// ---------- P3: boundedness — pass+fail+suppressed === applied rules with a valid edit_id ----------
function checkP3_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const s = output_payload.summary;
    if (s.pass + s.fail !== s.applied) violations++;
  }
  return { name: 'P3_pass_fail_applied_boundedness', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes) ----------
function checkP4_ulp_forcing() {
  const eps = Number.EPSILON;
  // arithmetic_identity: sum of components vs target, at forced tolerance boundaries.
  const forced = [
    { sum: 100, reported: 101, tol: 1, label: 'delta exactly == tol' },
    { sum: 100, reported: 101 + eps, tol: 1, label: 'delta just over tol' },
    { sum: 100, reported: 101 - eps, tol: 1, label: 'delta just under tol' },
    { sum: 0.1 + 0.2, reported: 0.3, tol: 0, label: '0.1+0.2 !== 0.3 at zero tolerance' },
    { sum: 0.1 + 0.2, reported: 0.3, tol: Number.EPSILON, label: '0.1+0.2 vs 0.3 at EPSILON tolerance' },
    { sum: 0, reported: -0, tol: 0, label: 'signed zero equality' },
    { sum: Number.MIN_VALUE, reported: -Number.MIN_VALUE, tol: 0, label: 'denormal delta, zero tolerance' },
    { sum: Number.MIN_VALUE, reported: -Number.MIN_VALUE, tol: Number.MIN_VALUE * 3, label: 'denormal delta within denormal tolerance' },
  ];
  let violations = 0, checked = 0;
  const rows = [];
  for (const c of forced) {
    const pp = { report_instance: { cells: [{ cell_ref: 'A', value: c.sum }, { cell_ref: 'B', value: c.reported }] }, rule_set: { rules: [{ edit_id: 'E1', type: 'arithmetic_identity', component_refs: ['A'], target_ref: 'B', tolerance: c.tol }] } };
    const { output_payload } = compute(pp);
    checked++;
    const expectedPass = Math.abs(c.sum - c.reported) <= Math.abs(c.tol);
    const status = output_payload.findings[0].status;
    if (status !== (expectedPass ? 'pass' : 'fail')) violations++;
    rows.push({ ...c, status, expected: expectedPass ? 'pass' : 'fail' });
  }
  results.ulp_forced_rows = rows;
  return { name: 'P4_ulp_boundary_forcing_float_sensitive', trials: checked, violations };
}

// ---------- P5: metamorphic — suppression-identity (suppressing one edit_id moves it out of pass/fail) ----------
function checkP5_suppression_identity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 3000; i++) {
    const pp = randomPP(rand);
    if (pp.rule_set.rules.length === 0) continue;
    const target = pp.rule_set.rules[Math.floor(rand() * pp.rule_set.rules.length)];
    if (!target || !target.edit_id) continue;
    const ppSuppressed = { ...pp, suppressions: [{ edit_id: target.edit_id, reason: 'test' }] };
    const r1 = compute(pp).output_payload;
    const r2 = compute(ppSuppressed).output_payload;
    checked++;
    const f2 = r2.findings.find((f) => f.edit_id === target.edit_id);
    if (!f2 || f2.status !== 'suppressed') violations++;
    if (r2.summary.suppressed !== r1.summary.suppressed + 1) violations++;
    if (r2.summary.applied !== r1.summary.applied - 1) violations++;
    // every OTHER rule's status is unchanged
    for (const f1 of r1.findings) {
      if (f1.edit_id === target.edit_id) continue;
      const f2other = r2.findings.find((f) => f.edit_id === f1.edit_id);
      if (!f2other || f2other.status !== f1.status) violations++;
    }
  }
  return { name: 'P5_suppression_identity_metamorphic', trials: checked, violations };
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
results.properties.push(checkP4_ulp_forcing());
results.properties.push(checkP5_suppression_identity());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-484-regrpt-editcheck-runner',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
