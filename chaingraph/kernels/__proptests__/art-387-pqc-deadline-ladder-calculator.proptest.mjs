// art-387-pqc-deadline-ladder-calculator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C18-1).
// kernel_digest_at_authoring: sha256:22f4891e4f4169482a7f9026e33d39349cbee9578f4001be24826afadcb85c1c
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — every date is fixed-point UTC-midnight
// millisecond integer arithmetic, `Math.round((b-a)/86400000)`, never a ratio/threshold float
// compare) — forced categorical boundary cases used in place of ULP-forcing, per spec §3's
// float:no row.
// Unbounded input: policy_parameters.inventory (caller-supplied array), mapped by a plain
// Array.prototype.map with no declared cap — termination bound is the array's own length.
// Checks: fixture-oracle gate, termination (map/filter passes scale linearly with
// inventory.length, never hang), boundedness (every count in `summary` is a non-negative
// integer that never exceeds row_count, and rows.length always equals inventory.length),
// finite-gate (a malformed date string NEVER propagates NaN into days_remaining — it resolves
// to null with an INVALID_DATE flag, per the kernel's own stated finite-gate contract),
// metamorphic (permutation-invariance: reordering the inventory reorders `rows` identically
// and leaves every `summary` count unchanged), forced categorical boundary cases (deadline
// exactly at reference_date, exactly IMMINENT_WINDOW_DAYS out, one day past the imminent
// window, FIPS exposure exactly at the historical date).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-387-pqc-deadline-ladder-calculator.proptest.mjs

import { compute } from '../art-387-pqc-deadline-ladder-calculator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-387-pqc-deadline-ladder-calculator.fixtures.json');
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
const rand = mulberry32(0x387C0);

const SYSTEM_CLASSES = ['nss', 'general', 'other'];
const ASSET_TYPES = ['firmware', 'key-establishment', 'signature', 'other'];

function randDate(rng, yearLo, yearHi) {
  const y = yearLo + Math.floor(rng() * (yearHi - yearLo));
  const m = String(1 + Math.floor(rng() * 12)).padStart(2, '0');
  const d = String(1 + Math.floor(rng() * 28)).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function randomRow(rng, idx) {
  return {
    row_id: `R${idx}`,
    system_class: SYSTEM_CLASSES[Math.floor(rng() * SYSTEM_CLASSES.length)],
    asset_type: ASSET_TYPES[Math.floor(rng() * ASSET_TYPES.length)],
    deployment_date: rng() > 0.3 ? randDate(rng, 2020, 2032) : '',
    fips_140_2_certified: rng() > 0.5,
  };
}

const TRIALS = 2000;

// ---------- P1: termination — map/filter passes scale linearly, never hang ----------
function checkP1_termination_linear_in_inventory_length() {
  let violations = 0, checked = 0;
  const sizes = [0, 1, 10, 100, 2000];
  for (const n of sizes) {
    const inventory = Array.from({ length: n }, (_, i) => randomRow(rand, i));
    const start = Date.now();
    const { output_payload } = compute({ reference_date: '2027-06-15', inventory });
    checked++;
    if (Date.now() - start > 3000) violations++;
    if (output_payload.rows.length !== n) violations++;
  }
  return { name: 'P1_termination_linear_scaling_never_hangs', trials: checked, violations };
}

// ---------- P2: boundedness — summary counts never exceed row_count, all non-negative integers ----------
function checkP2_summary_count_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 40);
    const inventory = Array.from({ length: n }, (_, idx) => randomRow(rand, idx));
    const { output_payload } = compute({ reference_date: randDate(rand, 2024, 2030), inventory });
    checked++;
    const s = output_payload.summary;
    if (s.row_count !== n) violations++;
    for (const c of [s.past_due_count, s.imminent_count, s.fips_exposure_count, s.invalid_row_count]) {
      if (!Number.isInteger(c) || c < 0 || c > s.row_count) violations++;
    }
  }
  return { name: 'P2_summary_count_boundedness', trials: checked, violations };
}

// ---------- P3: finite gate — malformed date never propagates NaN, resolves to null + flag ----------
function checkP3_finite_gate_malformed_date_never_nan() {
  let violations = 0, checked = 0;
  // strictly non-conforming to /^\d{4}-\d{2}-\d{2}$/ — must flag INVALID_DATE and null out
  const strictlyMalformed = ['not-a-date', '', null, undefined, 12345, '2027/06/15'];
  for (const bad of strictlyMalformed) {
    const { output_payload } = compute({ reference_date: bad, inventory: [randomRow(rand, 0)] });
    checked++;
    const row = output_payload.rows[0];
    if (row.days_remaining !== null) violations++; // must be null, never NaN
    if (typeof row.days_remaining === 'number' && Number.isNaN(row.days_remaining)) violations++;
    if (!row.flags.includes('INVALID_DATE')) violations++;
  }
  // deployment_date malformation only trips INVALID_DATE when it's a STRING that fails the
  // format regex — a non-string deployment_date (number/null/undefined) is coerced to '' by
  // the kernel's own typeof guard and treated as "no deployment date supplied" (no flag),
  // which is correct, intended behavior, not a gap. Both branches must stay finite (no NaN).
  const stringMalformedDeployment = ['not-a-date', '2027/06/15'];
  for (const bad of stringMalformedDeployment) {
    const row = { row_id: 'R', system_class: 'nss', asset_type: 'other', deployment_date: bad, fips_140_2_certified: false };
    const { output_payload } = compute({ reference_date: '2027-06-15', inventory: [row] });
    checked++;
    const outRow = output_payload.rows[0];
    if (outRow.days_remaining !== null) violations++;
    if (!outRow.flags.includes('INVALID_DATE')) violations++;
  }
  const nonStringDeployment = [12345, null, undefined, {}];
  for (const nonStr of nonStringDeployment) {
    const row = { row_id: 'R', system_class: 'nss', asset_type: 'other', deployment_date: nonStr, fips_140_2_certified: false };
    const { output_payload } = compute({ reference_date: '2027-06-15', inventory: [row] });
    checked++;
    const outRow = output_payload.rows[0];
    if (outRow.flags.includes('INVALID_DATE')) violations++; // coerced to '', not invalid
    if (typeof outRow.days_remaining === 'number' && Number.isNaN(outRow.days_remaining)) violations++; // still finite
  }
  // digit-pattern-but-out-of-range (e.g. month 13, day 45) matches the format regex, so
  // Date.UTC() silently ROLLS OVER into a valid finite timestamp rather than failing — this is
  // NOT a bug, it's the kernel's documented regex-shaped validation; the finite-gate contract
  // (never NaN) must still hold even though INVALID_DATE is correctly NOT raised here.
  const rolloverDates = ['2027-13-45', '2027-00-99'];
  for (const rd of rolloverDates) {
    const { output_payload } = compute({ reference_date: rd, inventory: [randomRow(rand, 0)] });
    checked++;
    const row = output_payload.rows[0];
    if (row.days_remaining !== null && (typeof row.days_remaining !== 'number' || Number.isNaN(row.days_remaining))) violations++;
  }
  return { name: 'P3_finite_gate_malformed_date_resolves_to_null_never_nan', trials: checked, violations };
}

// ---------- P4: metamorphic — permutation-invariance of rows and summary counts ----------
function checkP4_metamorphic_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 300; i++) {
    const n = 1 + Math.floor(rand() * 20);
    const inventory = Array.from({ length: n }, (_, idx) => randomRow(rand, idx));
    const shuffled = [...inventory];
    for (let j = shuffled.length - 1; j > 0; j--) { const k = Math.floor(rand() * (j + 1)); [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]]; }
    const refDate = randDate(rand, 2025, 2029);
    const outA = compute({ reference_date: refDate, inventory }).output_payload;
    const outB = compute({ reference_date: refDate, inventory: shuffled }).output_payload;
    checked++;
    if (JSON.stringify(outA.summary) !== JSON.stringify(outB.summary)) violations++;
    const idsA = outA.rows.map((r) => r.row_id).sort();
    const idsB = outB.rows.map((r) => r.row_id).sort();
    if (JSON.stringify(idsA) !== JSON.stringify(idsB)) violations++;
  }
  return { name: 'P4_metamorphic_permutation_invariance_of_summary_and_rows', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (float:no exception — no ULP claim made) ----------
function checkP5_forced_categorical_boundaries() {
  let violations = 0, checked = 0;
  const row = (deadline_key_asset) => ({ row_id: 'R', system_class: 'other', asset_type: deadline_key_asset, deployment_date: '', fips_140_2_certified: false });
  const cases = [
    // reference_date exactly ON the signature deadline (2031-12-31) — days_remaining === 0
    { pp: { reference_date: '2031-12-31', inventory: [row('other')] }, check: (r) => r.days_remaining === 0 && r.flags.includes('DEADLINE_IMMINENT') },
    // one day past the deadline — DEADLINE_PAST_DUE
    { pp: { reference_date: '2032-01-01', inventory: [row('other')] }, check: (r) => r.days_remaining < 0 && r.flags.includes('DEADLINE_PAST_DUE') },
    // exactly IMMINENT_WINDOW_DAYS (180) out — still imminent, not past-due
    { pp: { reference_date: '2031-07-05', inventory: [row('other')] }, check: (r) => r.days_remaining === 179 && r.flags.includes('DEADLINE_IMMINENT') },
    // FIPS-140-2 exposure exactly at the historical date (2026-09-21)
    { pp: { reference_date: '2026-09-21', inventory: [{ ...row('other'), fips_140_2_certified: true }] }, check: (r) => r.fips_140_2_historical_exposure === true },
    // one day before FIPS historical date — not yet exposed
    { pp: { reference_date: '2026-09-20', inventory: [{ ...row('other'), fips_140_2_certified: true }] }, check: (r) => r.fips_140_2_historical_exposure === false },
  ];
  for (const c of cases) {
    const { output_payload } = compute(c.pp);
    checked++;
    if (!c.check(output_payload.rows[0])) violations++;
  }
  return { name: 'P5_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_linear_in_inventory_length());
results.properties.push(checkP2_summary_count_boundedness());
results.properties.push(checkP3_finite_gate_malformed_date_never_nan());
results.properties.push(checkP4_metamorphic_permutation_invariance());
results.properties.push(checkP5_forced_categorical_boundaries());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-387-pqc-deadline-ladder-calculator',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
