// art-156-emir-counterparty-pairing-reconciler.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C4-1).
// kernel_digest_at_authoring: sha256:6fcd67412ed75171ed02a708b27a3f74129a434cdb9c66be88c7442e28c03910
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES — CORRECTION to the WU row's triage-table entry, found on direct read (the row
// itself asked for this: "confirm this against each kernel's own source... do not inherit the
// classification uncritically"). Every field comparison computes diff_pct = (|an-bn|/denom)*100 and
// then makes a CATEGORICAL decision `matched = diff_pct <= tol` against a caller-supplied
// numeric_tolerance_pct -- a genuine threshold float comparison, the exact B-class shape (§3 table,
// "fixed-threshold-tier agreement") that this spec's ULP-forcing mandate applies to regardless of class.
// The WU row flagged art-143 as the shard's most-likely false "no"; this shard's real correction landed
// on art-156 instead. ULP-forcing is applied below (P5): tolerance exactly at the boundary, ±1 ULP
// around it, 0-tolerance, negative-zero difference, and a denom=1 floor case (Math.max(...,1) guards
// div-by-zero when both values are 0).
// Checks: fixture-oracle gate, termination (breaks.length bounded by matching_fields.length), boundedness
// (break_count === breaks.length, every break's field drawn from matching_fields), differential
// re-derivation of uti_paired/breaks/reconciled, mandatory ULP-boundary forcing on the diff_pct <= tol
// comparison, and metamorphic symmetry (swapping report_a/report_b never changes which fields break,
// since |an-bn| and denom are both symmetric in an/bn).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-156-emir-counterparty-pairing-reconciler.proptest.mjs

import { compute } from '../art-156-emir-counterparty-pairing-reconciler.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-156-emir-counterparty-pairing-reconciler.fixtures.json');
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
const rand = mulberry32(0x156A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function expectedMatch(av, bv, tol) {
  const an = Number(av), bn = Number(bv);
  if (Number.isFinite(an) && Number.isFinite(bn)) {
    const denom = Math.max(Math.abs(an), Math.abs(bn), 1);
    const diff_pct = (Math.abs(an - bn) / denom) * 100;
    return Number.isFinite(diff_pct) ? diff_pct <= tol : (an === bn);
  }
  return av === bv;
}

function randomReports(rng, fields) {
  const uti = pick(rng, ['UTI-001', 'UTI-002', null]);
  const uti_b = rng() < 0.8 ? uti : pick(rng, ['UTI-001', 'UTI-002', 'UTI-OTHER']);
  const report_a = { uti };
  const report_b = { uti: uti_b };
  for (const f of fields) {
    report_a[f] = pick(rng, [1000, 1000.5, 999, 0, -50, 'text-val']);
    report_b[f] = rng() < 0.5 ? report_a[f] : pick(rng, [1000, 1050, 999, 0, -55, 'text-val', 'other-text']);
  }
  return { report_a, report_b };
}

const FIELD_NAMES = ['notional', 'asset_class', 'maturity', 'currency'];
const TRIALS = 5000;

// ---------- P1: termination — breaks.length bounded by matching_fields.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const nFields = Math.floor(rand() * 4) + 1;
    const fields = FIELD_NAMES.slice(0, nFields);
    const { report_a, report_b } = randomReports(rand, fields);
    const tol = rand() * 5;
    const { output_payload } = compute({ report_a, report_b, matching_fields: fields, numeric_tolerance_pct: tol });
    checked++;
    if (output_payload.fields_compared !== fields.length) violations++;
    if (output_payload.breaks.length > fields.length) violations++;
    if (output_payload.break_count !== output_payload.breaks.length) violations++;
  }
  return { name: 'P1_termination_bounded_by_fields_length', trials: checked, violations };
}

// ---------- P2 (differential): re-derive uti_paired, breaks[], reconciled ----------
function checkP2_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const nFields = Math.floor(rand() * 4) + 1;
    const fields = FIELD_NAMES.slice(0, nFields);
    const { report_a, report_b } = randomReports(rand, fields);
    const tol = rand() * 5;
    const { output_payload: o } = compute({ report_a, report_b, matching_fields: fields, numeric_tolerance_pct: tol });
    checked++;
    const uti_paired = typeof report_a.uti === 'string' && report_a.uti === report_b.uti;
    if (o.uti_paired !== uti_paired) violations++;
    const breaks = [];
    for (const f of fields) {
      if (!expectedMatch(report_a[f], report_b[f], Math.abs(tol))) breaks.push({ field: f, a: report_a[f] ?? null, b: report_b[f] ?? null });
    }
    if (JSON.stringify(o.breaks) !== JSON.stringify(breaks)) violations++;
    if (o.reconciled !== (uti_paired && breaks.length === 0)) violations++;
  }
  return { name: 'P2_uti_breaks_reconciled_differential', trials: checked, violations };
}

// ---------- P3: boundedness — every break's field drawn from matching_fields ----------
function checkP3_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const nFields = Math.floor(rand() * 4) + 1;
    const fields = FIELD_NAMES.slice(0, nFields);
    const { report_a, report_b } = randomReports(rand, fields);
    const tol = rand() * 5;
    const { output_payload } = compute({ report_a, report_b, matching_fields: fields, numeric_tolerance_pct: tol });
    checked++;
    for (const b of output_payload.breaks) if (!fields.includes(b.field)) violations++;
  }
  return { name: 'P3_break_field_bounded', trials: checked, violations };
}

// ---------- P4: metamorphic — swapping report_a/report_b never changes which fields break (symmetric diff) ----------
function checkP4_symmetry() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const nFields = Math.floor(rand() * 4) + 1;
    const fields = FIELD_NAMES.slice(0, nFields);
    const { report_a, report_b } = randomReports(rand, fields);
    const tol = rand() * 5;
    const r1 = compute({ report_a, report_b, matching_fields: fields, numeric_tolerance_pct: tol }).output_payload;
    const r2 = compute({ report_a: report_b, report_b: report_a, matching_fields: fields, numeric_tolerance_pct: tol }).output_payload;
    checked++;
    const fields1 = r1.breaks.map((b) => b.field).sort();
    const fields2 = r2.breaks.map((b) => b.field).sort();
    if (JSON.stringify(fields1) !== JSON.stringify(fields2)) violations++;
  }
  return { name: 'P4_symmetric_break_set_under_swap', trials: checked, violations };
}

// ---------- P5: MANDATORY ULP-boundary forcing on diff_pct <= tol ----------
function checkP5_ulp_forcing() {
  let violations = 0, checked = 0;
  const cases = [];
  // exact boundary: diff_pct === tol should match
  // a=200,b=198: denom=max(200,198,1)=200, diff=2, diff_pct=(2/200)*100=1 exactly
  cases.push({ a: 200, b: 198, tol: 1, expectMatch: true });
  cases.push({ a: 200, b: 198, tol: 1 - Number.EPSILON, expectMatch: false });
  cases.push({ a: 200, b: 198, tol: 1 + Number.EPSILON * 4, expectMatch: true });
  // zero tolerance, exact equality
  cases.push({ a: 42, b: 42, tol: 0, expectMatch: true });
  cases.push({ a: 42, b: 42.0000001, tol: 0, expectMatch: false });
  // negative zero vs positive zero
  cases.push({ a: -0, b: 0, tol: 0, expectMatch: true });
  // denom floor: both values 0 (denom clamped to 1 by Math.max(...,1))
  cases.push({ a: 0, b: 0, tol: 0, expectMatch: true });
  // denom floor engaged (both |a|,|b| < 1): diff_pct = (0.005/1)*100 = 0.5, tol=0.4 -> break
  cases.push({ a: 0, b: 0.005, tol: 0.4, expectMatch: false });
  cases.push({ a: 0, b: 0.005, tol: 0.5, expectMatch: true });
  // sub-normal-scale values: denom floor of 1 dominates, so any tiny absolute diff is a ~0% diff_pct
  cases.push({ a: 1e-300, b: 2e-300, tol: 1e-296, expectMatch: true });

  for (const c of cases) {
    const { output_payload } = compute({
      report_a: { uti: 'X', v: c.a }, report_b: { uti: 'X', v: c.b },
      matching_fields: ['v'], numeric_tolerance_pct: c.tol,
    });
    checked++;
    const matched = output_payload.breaks.length === 0;
    if (matched !== c.expectMatch) violations++;
  }
  return { name: 'P5_ulp_boundary_forcing_diff_pct_threshold', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_differential());
results.properties.push(checkP3_bounded());
results.properties.push(checkP4_symmetry());
results.properties.push(checkP5_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-156-emir-counterparty-pairing-reconciler',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
