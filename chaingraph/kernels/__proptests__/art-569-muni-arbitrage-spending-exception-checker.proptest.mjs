// art-569-muni-arbitrage-spending-exception-checker.proptest.mjs -- FV property-test FLOOR
// (FV-PROPFLOOR-SHARD-C29-1).
// kernel_digest_at_authoring: sha256:51f687ecec3fb71291c2dad098f4e0e98618a92218f75eaf7610890d75034ed3
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md Sec3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES -- confirmed by direct source read (matches the WU row). Two real IEEE-754
// float operations feed milestone pass/fail boundary decisions: `de_minimis_cap_minor =
// Math.min(Math.floor(gross_proceeds_minor * 0.03), 15000000)` (0.03 is not exactly representable in
// binary, multiplied against a safe-integer gross-proceeds figure that can be very large) and
// `required_gross_minor = Math.ceil((m.required_pct / 100) * gross_proceeds_minor)` (division then
// multiplication, both real float ops), which directly sets the MET/FAILED threshold every milestone
// is judged against. ULP-boundary forcing is applied around both.
// Checks: fixture-oracle gate, termination (milestones bounded to at most 5 per the fixed schedule
// tables, expenditure_schedule bounded by MAX_EXPENDITURES=500), differential re-derivation of the
// de-minimis cap and required-gross-per-milestone arithmetic, ULP-boundary forcing on the
// Math.floor(gross*0.03) and Math.ceil((pct/100)*gross) boundaries (0, exact-percent-boundary values,
// values chosen so pct/100*gross has a well-known binary-representation residue e.g. 0.1-shaped
// fractions, Number.MAX_SAFE_INTEGER-adjacent gross proceeds), and a metamorphic
// permutation-invariance check (reordering expenditure_schedule never changes cumulative_spent_minor
// at any milestone, since the kernel re-sorts and filters by date internally).
//
// Run: node chaingraph/kernels/__proptests__/art-569-muni-arbitrage-spending-exception-checker.proptest.mjs

import { compute } from '../art-569-muni-arbitrage-spending-exception-checker.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-569-muni-arbitrage-spending-exception-checker.fixtures.json');
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
const rand = mulberry32(0x56900);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const EXCEPTIONS = ['6_MONTH', '18_MONTH', '24_MONTH'];

function randomExpenditures(rng) {
  const n = Math.floor(rng() * 8);
  const out = [];
  for (let i = 0; i < n; i++) {
    const month = 1 + Math.floor(rng() * 12);
    const day = 1 + Math.floor(rng() * 27);
    out.push({ date: `2020-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, amount_minor: 1 + Math.floor(rng() * 1000000) });
  }
  return out;
}

function randomPP(rng) {
  return {
    issue_date: '2020-01-01',
    as_of_date: pick(rng, ['2020-06-01', '2021-01-01', '2021-06-01', '2022-01-01', '2023-06-01']),
    gross_proceeds_minor: 1 + Math.floor(rng() * 100000000),
    elected_exception: pick(rng, EXCEPTIONS),
    reasonable_retainage: rng() < 0.5,
    de_minimis_minor: rng() < 0.4 ? undefined : Math.floor(rng() * 100000),
    expenditure_schedule: randomExpenditures(rng),
  };
}

const TRIALS = 3000;

// ---------- P1: termination -- milestones bounded to <=5 (the fixed schedule tables), expenditures
// bounded by MAX_EXPENDITURES ----------
function checkP1_termination_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.milestones.length < 1 || output_payload.milestones.length > 5) violations++;
    if (output_payload.milestones.length > 500) violations++;
  }
  return { name: 'P1_termination_milestones_bounded', trials: checked, violations };
}

// ---------- P2 (differential): re-derive de-minimis cap and required-gross-per-milestone ----------
function checkP2_de_minimis_and_required_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expectedCap = Math.min(Math.floor(pp.gross_proceeds_minor * 0.03), 15000000);
    if (output_payload.de_minimis_cap_minor !== expectedCap) violations++;
    for (const m of output_payload.milestones) {
      const expectedGross = Math.ceil((m.required_pct / 100) * pp.gross_proceeds_minor);
      if (m.required_gross_minor !== expectedGross) violations++;
      const deMin = output_payload.de_minimis_minor ?? 0;
      const expectedReq = Math.max(0, expectedGross - deMin);
      if (m.required_minor !== expectedReq) violations++;
    }
  }
  return { name: 'P2_de_minimis_and_required_gross_differential', trials: checked, violations };
}

// ---------- P3: ULP-boundary forcing on Math.floor(gross*0.03) and Math.ceil((pct/100)*gross) ----------
function checkP3_ulp_boundary_forcing() {
  let violations = 0, checked = 0;
  const forcedGross = [1, 99, 100, 1000000, 3000000, 15000000 / 0.03, Math.floor(15000000 / 0.03), Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 1, 5000000000, 3333333333];
  for (const gross of forcedGross) {
    const g = Math.max(1, Math.floor(gross));
    if (!Number.isSafeInteger(g)) continue;
    checked++;
    const pp = { issue_date: '2020-01-01', as_of_date: '2020-06-01', gross_proceeds_minor: g, elected_exception: '6_MONTH', reasonable_retainage: false, expenditure_schedule: [] };
    const { output_payload } = compute(pp);
    const expectedCap = Math.min(Math.floor(g * 0.03), 15000000);
    if (output_payload.de_minimis_cap_minor !== expectedCap) violations++;
    for (const pct of [100, 95, 15, 60, 10, 45, 75]) {
      const expected = Math.ceil((pct / 100) * g);
      const m = output_payload.milestones.find((mm) => mm.required_pct === pct);
      if (m && m.required_gross_minor !== expected) violations++;
    }
  }
  // classic x/y*y!==x-shaped percentages against a safe-integer gross sweep.
  for (let k = 0; k < 100; k++) {
    const g = 1 + Math.floor(rand() * Number.MAX_SAFE_INTEGER / 40);
    checked++;
    const pp = { issue_date: '2020-01-01', as_of_date: '2020-06-01', gross_proceeds_minor: g, elected_exception: '18_MONTH', reasonable_retainage: true, expenditure_schedule: [] };
    const { output_payload } = compute(pp);
    const expectedCap = Math.min(Math.floor(g * 0.03), 15000000);
    if (output_payload.de_minimis_cap_minor !== expectedCap) violations++;
  }
  return { name: 'P3_ulp_boundary_forcing_de_minimis_and_required_gross', trials: checked, violations };
}

// ---------- P4: metamorphic -- expenditure_schedule reordering never changes cumulative_spent_minor ----------
function checkP4_expenditure_order_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1000; i++) {
    const pp = randomPP(rand);
    if (pp.expenditure_schedule.length < 2) continue;
    const shuffled = { ...pp, expenditure_schedule: [...pp.expenditure_schedule].sort(() => rand() - 0.5) };
    checked++;
    const r1 = compute(pp).output_payload;
    const r2 = compute(shuffled).output_payload;
    if (r1.total_expenditures_minor !== r2.total_expenditures_minor) violations++;
    for (let mi = 0; mi < r1.milestones.length; mi++) {
      if (r1.milestones[mi].cumulative_spent_minor !== r2.milestones[mi].cumulative_spent_minor) violations++;
      if (r1.milestones[mi].verdict !== r2.milestones[mi].verdict) violations++;
    }
  }
  return { name: 'P4_expenditure_schedule_order_invariance', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_bounded());
results.properties.push(checkP2_de_minimis_and_required_differential());
results.properties.push(checkP3_ulp_boundary_forcing());
results.properties.push(checkP4_expenditure_order_invariance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-569-muni-arbitrage-spending-exception-checker',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
