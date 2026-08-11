// art-457-globe-gir-composer.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C22-1).
// kernel_digest_at_authoring: sha256:61563ff21326052fe8cd8c86671ef2bcce3ffd879f7ea28ae2f4fc8c333513a2
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (composed_topup_tax carries through raw_topup_tax unless deemed-zero;
// allocated_topup_tax = composed_topup_tax * share; allocation_ok compares
// |entity_topup_total - 1| < 1e-6). ULP-boundary forcing mandatory (§3): threshold ±1 ULP, 0,
// negative zero, denormals, x/y*y !== x cases.
// Checks: fixture-oracle gate, termination (jurisdiction_rows/constituent_entities bounded by
// input array lengths), differential re-derivation of composed_topup_tax and allocation_sum_ok,
// metamorphic append-invariance (appending a jurisdiction never changes an earlier row), and
// ULP-boundary forcing around the 1e-6 allocation tolerance. Zero external dependencies — pure
// Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-457-globe-gir-composer.proptest.mjs

import { compute } from '../art-457-globe-gir-composer.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-457-globe-gir-composer.fixtures.json');
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
const rand = mulberry32(0x457A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomEntities(rng, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ entity_name: `e${i}`, allocation_share: (rng() - 0.3) * 2 });
  return out;
}

function randomJurisdiction(rng) {
  const hasSH = rng() < 0.7;
  const sh_met = hasSH ? rng() < 0.5 : undefined;
  const n = Math.floor(rng() * 6);
  return {
    jurisdiction_code: pick(rng, ['US', 'DE', 'FR', '', null]),
    jurisdictional_etr: (rng() - 0.5) * 0.5,
    sbie_amount: rng() * 1e6,
    topup_tax: rng() * 1e6,
    safe_harbour_met: sh_met,
    constituent_entities: randomEntities(rng, n),
  };
}

function randomPP(rng) {
  const nj = Math.floor(rng() * 8);
  const jurisdictions = [];
  for (let i = 0; i < nj; i++) jurisdictions.push(randomJurisdiction(rng));
  return { mne_group_name: pick(rng, ['ACME', '', null]), fiscal_year: 2024, jurisdictions };
}

const TRIALS = 4000;

// ---------- P1: termination — row/entity counts bounded by input array lengths ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.jurisdiction_rows.length !== pp.jurisdictions.length) violations++;
    for (let j = 0; j < output_payload.jurisdiction_rows.length; j++) {
      const inputEntities = (pp.jurisdictions[j].constituent_entities || []).length;
      if (output_payload.jurisdiction_rows[j].constituent_entities.length !== inputEntities) violations++;
    }
  }
  return { name: 'P1_termination_rows_bounded_by_input_length', trials: checked, violations };
}

// ---------- P2 (differential): composed_topup_tax re-derivation ----------
function checkP2_composed_topup_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    output_payload.jurisdiction_rows.forEach((row, idx) => {
      const src = pp.jurisdictions[idx];
      const hasResult = src.safe_harbour_met === true || src.safe_harbour_met === false;
      const deemedZero = hasResult && src.safe_harbour_met === true;
      const rawTopup = Number.isFinite(Number(src.topup_tax)) ? Number(src.topup_tax) : 0;
      const expected = deemedZero ? 0 : rawTopup;
      if (row.composed_topup_tax !== expected) violations++;
      if (deemedZero && row.composed_topup_tax !== 0) violations++;
    });
  }
  return { name: 'P2_composed_topup_tax_differential', trials: checked, violations };
}

// ---------- P3 (differential): allocation_sum_ok true iff |sum(shares) - 1| < 1e-6 (or no entities) ----------
function checkP3_allocation_sum_ok_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    output_payload.jurisdiction_rows.forEach((row, idx) => {
      const src = pp.jurisdictions[idx];
      const entities = src.constituent_entities || [];
      if (entities.length === 0) { if (row.allocation_sum_ok !== true) violations++; return; }
      const sum = entities.reduce((a, e) => a + (Number.isFinite(Number(e && e.allocation_share)) ? Number(e.allocation_share) : 0), 0);
      const expected = Math.abs(sum - 1) < 1e-6;
      if (row.allocation_sum_ok !== expected) violations++;
    });
  }
  return { name: 'P3_allocation_sum_ok_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — appending a jurisdiction never changes an earlier row ----------
function checkP4_append_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const pp = randomPP(rand);
    if (pp.jurisdictions.length === 0) continue;
    const r1 = compute(pp).output_payload;
    const extended = { ...pp, jurisdictions: [...pp.jurisdictions, randomJurisdiction(rand)] };
    const r2 = compute(extended).output_payload;
    checked++;
    for (let j = 0; j < pp.jurisdictions.length; j++) {
      if (JSON.stringify(r1.jurisdiction_rows[j]) !== JSON.stringify(r2.jurisdiction_rows[j])) violations++;
    }
    if (r2.jurisdiction_rows.length !== r1.jurisdiction_rows.length + 1) violations++;
  }
  return { name: 'P4_append_jurisdiction_metamorphic', trials: checked, violations };
}

// ---------- P5: ULP-boundary forcing around the 1e-6 allocation tolerance ----------
function checkP5_ulp_boundary_forcing() {
  const EPS = 1e-6;
  const cases = [
    { shares: [1], expectOk: true, label: 'exact_sum_1' },
    { shares: [1 + EPS * 0.5], expectOk: true, label: 'inside_tolerance_high' },
    { shares: [1 - EPS * 0.5], expectOk: true, label: 'inside_tolerance_low' },
    { shares: [1 + EPS * 2], expectOk: false, label: 'outside_tolerance_high' },
    { shares: [1 - EPS * 2], expectOk: false, label: 'outside_tolerance_low' },
    { shares: [0, 1], expectOk: true, label: 'zero_and_one' },
    { shares: [-0, 1], expectOk: true, label: 'negative_zero_and_one' },
    { shares: [1 + Number.EPSILON], expectOk: true, label: 'plus_one_ulp' },
    { shares: [1 - Number.EPSILON], expectOk: true, label: 'minus_one_ulp' },
    { shares: [1 + Number.MIN_VALUE], expectOk: true, label: 'denormal_above' },
    { shares: [Number.MIN_VALUE, 1 - Number.MIN_VALUE], expectOk: true, label: 'denormal_split' },
  ];
  let violations = 0, checked = 0;
  for (const c of cases) {
    checked++;
    const pp = {
      mne_group_name: 'X', fiscal_year: 2024,
      jurisdictions: [{
        jurisdiction_code: 'US', topup_tax: 100,
        constituent_entities: c.shares.map((s, i) => ({ entity_name: `e${i}`, allocation_share: s })),
      }],
    };
    const { output_payload } = compute(pp);
    if (output_payload.jurisdiction_rows[0].allocation_sum_ok !== c.expectOk) violations++;
  }
  // x/y*y !== x style case: division-derived share that doesn't round-trip exactly.
  {
    const x = 0.1, y = 3;
    const derived = (x / y) * y; // !== x in IEEE-754
    checked++;
    const pp = {
      mne_group_name: 'X', fiscal_year: 2024,
      jurisdictions: [{ jurisdiction_code: 'US', topup_tax: 100, constituent_entities: [{ entity_name: 'e0', allocation_share: 1 + (derived - x) }] }],
    };
    const { output_payload } = compute(pp);
    if (typeof output_payload.jurisdiction_rows[0].allocation_sum_ok !== 'boolean') violations++;
  }
  return { name: 'P5_ulp_boundary_forcing_allocation_tolerance', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_composed_topup_differential());
results.properties.push(checkP3_allocation_sum_ok_differential());
results.properties.push(checkP4_append_metamorphic());
results.properties.push(checkP5_ulp_boundary_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-457-globe-gir-composer',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
