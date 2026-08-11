// art-300-aca-226j-response-evidence-pack.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C10-1).
// kernel_digest_at_authoring: sha256:4d4fb49f4aacbbbdeaa9aa38d119217e3cfd2e5234bb80c9fd6bb055afb5fcc9
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO per the WU triage — the one arithmetic op is
// exposureDelta = recomputedExposure - irsAssertedEsrp with an exact-equality "consistent"
// check downstream of it (delta === 0). Confirmed by direct read: both operands are
// caller-supplied whole-dollar-shaped numbers (Number.isFinite gate, no internal division or
// rounding chain), so this is lower-risk than a computed-rate kernel, but the exact-equality
// comparison is still forced as a categorical boundary case below (exact match, and a
// near-miss by the smallest representable double delta) per FIX-2 discipline.
// Checks: fixture-oracle gate, termination (response_deadline recomputed via an independent
// Howard-Hinnant-equivalent date library, Date-based since this is test code not the zkVM
// guest), boundedness (disputed_employee_count === disputed_employee_ids.length), differential
// re-derivation of exposure_delta and both compliance-flag branches, and forced boundary cases
// around the delta===0 exact-equality comparison.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-300-aca-226j-response-evidence-pack.proptest.mjs

import { compute } from '../art-300-aca-226j-response-evidence-pack.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-300-aca-226j-response-evidence-pack.fixtures.json');
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
const rand = mulberry32(0x300A0);
function pad2(n) { return String(n).padStart(2, '0'); }

function randomIsoDate(rng) {
  const y = 2025 + Math.floor(rng() * 3);
  const m = 1 + Math.floor(rng() * 12);
  const d = 1 + Math.floor(rng() * 28);
  return `${y}-${pad2(m)}-${pad2(d)}`;
}
function addDaysUTC(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}
function randomAttestation(rng) {
  const r = rng();
  if (r < 0.3) return undefined;
  if (r < 0.5) return { name: 'Jordan Rivera' }; // missing title/timestamp -> pending
  return { name: 'Jordan Rivera', title: 'VP', timestamp: '2026-08-10T15:00:00Z' };
}
function randomIds(rng) {
  const n = Math.floor(rng() * 8);
  return Array.from({ length: n }, (_, i) => 'EMP-' + i);
}

function randomPP(rng) {
  const letter_date = rng() < 0.9 ? randomIsoDate(rng) : undefined;
  const controlling = Math.round(rng() * 1000000) / 100;
  const sameAsAsserted = rng() < 0.4;
  const irs = sameAsAsserted ? controlling : Math.round(rng() * 1000000) / 100;
  return {
    letter_date,
    irs_asserted_esrp_annual: rng() < 0.9 ? irs : undefined,
    affordability_result: rng() < 0.9 ? { tax_year: '2026', satisfies_any_harbor: rng() < 0.5, harbors_satisfied: [] } : undefined,
    esrp_result: rng() < 0.9 ? { tax_year: '2026', controlling_penalty: 'a', controlling_exposure_annual: controlling } : undefined,
    disputed_employee_ids: randomIds(rng),
    attestation: randomAttestation(rng),
  };
}

const TRIALS = 5000;

// ---------- P1: termination — response_deadline recomputed via an independent date-add ----------
function checkP1_deadline_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (pp.letter_date) {
      const expected = addDaysUTC(pp.letter_date, 30);
      if (output_payload.response_deadline !== null && output_payload.response_deadline !== expected) violations++;
    } else if (output_payload.response_deadline !== null) violations++;
  }
  return { name: 'P1_response_deadline_termination_matches_independent_dateadd', trials: checked, violations };
}

// ---------- P2: boundedness — disputed_employee_count === disputed_employee_ids.length ----------
function checkP2_employee_count_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.disputed_employee_count !== pp.disputed_employee_ids.length) violations++;
  }
  return { name: 'P2_disputed_employee_count_bounded_by_ids_length', trials: checked, violations };
}

// ---------- P3 (differential): exposure_delta + compliance flags re-derived ----------
function checkP3_exposure_delta_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.error !== null) continue;
    const expectedDelta = pp.esrp_result.controlling_exposure_annual - pp.irs_asserted_esrp_annual;
    if (output_payload.exposure_delta !== expectedDelta) violations++;
    if (output_payload.recomputed_exposure_annual !== pp.esrp_result.controlling_exposure_annual) violations++;
  }
  return { name: 'P3_exposure_delta_differential', trials: checked, violations };
}

// ---------- P4: forced boundary cases — exact-equality exposure_delta===0 comparison ----------
function checkP4_delta_zero_boundary_forcing() {
  let violations = 0, checked = 0;
  const cases = [
    { irs: 100000, exposure: 100000 },      // exact match -> delta 0
    { irs: 100000, exposure: 100000 + Number.EPSILON * 100000 }, // smallest representable non-zero delta at this magnitude
    { irs: 0, exposure: 0 },                // zero vs zero
    { irs: 0, exposure: -0 },               // negative zero vs zero
    { irs: -100000, exposure: -100000 },    // negative amounts, exact match
  ];
  for (const c of cases) {
    checked++;
    const pp = {
      letter_date: '2026-08-03',
      irs_asserted_esrp_annual: c.irs,
      affordability_result: { tax_year: '2026', satisfies_any_harbor: false, harbors_satisfied: [] },
      esrp_result: { tax_year: '2026', controlling_penalty: 'a', controlling_exposure_annual: c.exposure },
      disputed_employee_ids: [],
      attestation: { name: 'Jordan Rivera', title: 'VP', timestamp: '2026-08-10T15:00:00Z' },
    };
    const { output_payload } = compute(pp);
    const expectedDelta = c.exposure - c.irs;
    if (output_payload.exposure_delta !== expectedDelta) violations++;
    const expectedFlag = expectedDelta === 0 ? 'ACA_226J_RECOMPUTATION_MATCHES_ASSERTED' : 'ACA_226J_RECOMPUTATION_DISPUTES_ASSERTED';
    const { compliance_flags } = compute(pp);
    if (!compliance_flags.includes(expectedFlag)) violations++;
  }
  return { name: 'P4_exposure_delta_zero_boundary_forcing', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_deadline_termination());
results.properties.push(checkP2_employee_count_bounded());
results.properties.push(checkP3_exposure_delta_differential());
results.properties.push(checkP4_delta_zero_boundary_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-300-aca-226j-response-evidence-pack',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
