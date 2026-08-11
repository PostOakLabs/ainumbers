// art-278-reputation-score-aggregator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C13-1).
// kernel_digest_at_authoring: sha256:7d2c98e83ecc6bbe23df123d45d26fe3f2b31d5dc6484e5983f535fdbd271c86
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (direct read of art-278-reputation-score-aggregator.kernel.mjs confirmed:
// exponential decay weight uses `pow(2, -ageDays / halfLife)` via the kernel's own hand-rolled
// deterministic exp/log-based pow, a weighted mean is computed via float division
// `sum / totalWeight`, results are clamped to [-1,1] and rounded with `.toFixed(6)`) — ULP-boundary
// forcing is MANDATORY per spec §3.
// Class-C shape: the kernel loops once over an UNBOUNDED `attestations` array (no hidden
// recursion, no iteration cap needed — every pass is a single O(n) filter/map/reduce chain), so
// "termination" here means the output's surviving-attestation count can never exceed the input
// array length, checked explicitly (P1) rather than assumed.
// Checks: fixture-oracle gate, termination/output-count bound (P1), boundedness of dims/composite
// into [-1,1] with no NaN/undefined (P2), permutation-invariance of the attestations array as the
// obvious metamorphic identity for an order-independent weighted aggregation (P3, attestations
// given unique issued_at/issuer_id/receipt_hash to avoid a genuine tie-break-by-order case), and
// mandatory ULP-boundary forcing on dims extremes, decay half-life underflow, weight_hint
// denormals, and the ±0.5 compliance-flag threshold (P4).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-278-reputation-score-aggregator.proptest.mjs

import { compute } from '../art-278-reputation-score-aggregator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-278-reputation-score-aggregator.fixtures.json');
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
const rand = mulberry32(0x278D0);

function isoDatePlusDays(baseIso, days) {
  const t = Date.parse(baseIso) + days * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

// Random attestations with unique issued_at dates (day-spaced) so dedupe/tie-break never depends
// on array insertion order -- keeps the permutation-invariance property (P3) unconfounded.
function randomAttestations(rng, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      subject_id: 'agent-alpha',
      issuer_id: `issuer-${i}`,
      receipt_hash: `sha256:r${i}`,
      dims: {
        competence: rng() * 2 - 1,
        integrity: rng() * 2 - 1,
        timeliness: rng() * 2 - 1,
        cooperation: rng() * 2 - 1,
      },
      issued_at: isoDatePlusDays('2025-01-01', i),
      weight_hint: 0.5 + rng() * 2,
    });
  }
  return out;
}

function randomPP(rng) {
  const n = Math.floor(rng() * 12);
  return {
    subject_id: 'agent-alpha',
    as_of: isoDatePlusDays('2025-01-01', n + Math.floor(rng() * 400)),
    decay_half_life_days: 10 + rng() * 500,
    attestations: randomAttestations(rng, n),
  };
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const TRIALS = 3000;

// ---------- P1: termination -- surviving-attestation count never exceeds input array length ----------
function checkP1_termination_output_count_bound() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.attestation_count > pp.attestations.length) violations++;
    if (output_payload.excluded_self_issued > pp.attestations.length) violations++;
  }
  return { name: 'P1_termination_output_count_never_exceeds_input_length', trials: checked, violations };
}

// ---------- P2: boundedness -- dims/composite stay in [-1,1], no NaN/undefined ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    for (const d of ['competence', 'integrity', 'timeliness', 'cooperation']) {
      const v = output_payload.dims[d];
      if (!Number.isFinite(v) || v < -1 || v > 1) violations++;
    }
    if (!Number.isFinite(output_payload.composite) || output_payload.composite < -1 || output_payload.composite > 1) violations++;
    if (output_payload.attestation_count < 0) violations++;
  }
  return { name: 'P2_boundedness_dims_and_composite_in_unit_range', trials: checked, violations };
}

// ---------- P3: metamorphic -- permutation-invariance of the attestations array ----------
function checkP3_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    if (pp.attestations.length < 2) continue;
    const shuffled = { ...pp, attestations: shuffle(pp.attestations, rand) };
    const a = compute(pp).output_payload;
    const b = compute(shuffled).output_payload;
    checked++;
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
  }
  return { name: 'P3_permutation_invariance_of_attestations_array', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes) ----------
function checkP4_ulp_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;

  // (a) dims extremes: -1, 1, 0, -0, EPSILON, values just past the clamp boundary, denormals.
  const dimExtremes = [-1, 1, 0, -0, eps, -eps, 1 + eps, -1 - eps, Number.MIN_VALUE, -Number.MIN_VALUE];
  for (const v of dimExtremes) {
    const pp = {
      subject_id: 'agent-alpha',
      as_of: '2025-06-01',
      decay_half_life_days: 180,
      attestations: [{
        subject_id: 'agent-alpha', issuer_id: 'issuer-x', receipt_hash: 'sha256:ulp1',
        dims: { competence: v, integrity: v, timeliness: v, cooperation: v },
        issued_at: '2025-06-01',
      }],
    };
    const { output_payload } = compute(pp);
    checked++;
    for (const d of ['competence', 'integrity', 'timeliness', 'cooperation']) {
      const out = output_payload.dims[d];
      if (!Number.isFinite(out) || out < -1 || out > 1) violations++;
    }
    if (!Number.isFinite(output_payload.composite)) violations++;
  }

  // (b) decay half-life underflow: ageDays/halfLife huge -> pow(2,-huge) underflows toward 0,
  // weight<=0 gets excluded -- must never surface NaN/Infinity, must fall back to
  // insufficient_evidence cleanly.
  const underflowCases = [
    { decay_half_life_days: 1e-10, issued_at: '2020-01-01', as_of: '2025-06-01' },
    { decay_half_life_days: Number.MIN_VALUE, issued_at: '2020-01-01', as_of: '2025-06-01' },
    { decay_half_life_days: 1e300, issued_at: '2020-01-01', as_of: '2025-06-01' },
  ];
  for (const c of underflowCases) {
    const pp = {
      subject_id: 'agent-alpha',
      as_of: c.as_of,
      decay_half_life_days: c.decay_half_life_days,
      attestations: [{
        subject_id: 'agent-alpha', issuer_id: 'issuer-x', receipt_hash: 'sha256:ulp2',
        dims: { competence: 0.5, integrity: 0.5, timeliness: 0.5, cooperation: 0.5 },
        issued_at: c.issued_at,
      }],
    };
    const { output_payload } = compute(pp);
    checked++;
    if (!Number.isFinite(output_payload.composite)) violations++;
    for (const d of ['competence', 'integrity', 'timeliness', 'cooperation']) {
      if (!Number.isFinite(output_payload.dims[d])) violations++;
    }
  }

  // (c) weight_hint denormals -- must never poison the weighted sum with NaN/Infinity.
  const hintCases = [Number.MIN_VALUE, eps, 0, -0, -1, 1e300];
  for (const hint of hintCases) {
    const pp = {
      subject_id: 'agent-alpha',
      as_of: '2025-06-01',
      decay_half_life_days: 180,
      attestations: [{
        subject_id: 'agent-alpha', issuer_id: 'issuer-x', receipt_hash: 'sha256:ulp3',
        dims: { competence: 0.3, integrity: 0.3, timeliness: 0.3, cooperation: 0.3 },
        issued_at: '2025-06-01', weight_hint: hint,
      }],
    };
    const { output_payload } = compute(pp);
    checked++;
    if (!Number.isFinite(output_payload.composite)) violations++;
  }

  // (d) +/-0.5 compliance-flag threshold -- the kernel rounds composite to 6 decimals
  // (`.toFixed(6)`) before the >=0.5/<=-0.5 compare, so the effective "ULP" of this comparison is
  // 1e-6, not Number.EPSILON (a raw-EPSILON offset gets absorbed by the rounding and lands back on
  // the boundary -- verified empirically, not assumed). Forcing is therefore at the finest
  // resolution the kernel actually observes: exactly-at-threshold vs. one part in 1e6 short of it.
  const thresholdCases = [
    { x: 0.5, expect: 'REPUTATION_STRONG_POSITIVE' },
    { x: 0.499999, expect: 'REPUTATION_MIXED_OR_NEUTRAL' },
    { x: -0.5, expect: 'REPUTATION_STRONG_NEGATIVE' },
    { x: -0.499999, expect: 'REPUTATION_MIXED_OR_NEUTRAL' },
  ];
  for (const c of thresholdCases) {
    const pp = {
      subject_id: 'agent-alpha',
      as_of: '2025-06-01',
      decay_half_life_days: 180,
      attestations: [{
        subject_id: 'agent-alpha', issuer_id: 'issuer-x', receipt_hash: 'sha256:ulp4',
        dims: { competence: c.x, integrity: c.x, timeliness: c.x, cooperation: c.x },
        issued_at: '2025-06-01',
      }],
    };
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    if (!compliance_flags.includes(c.expect)) violations++;
    if (!Number.isFinite(output_payload.composite)) violations++;
  }

  return { name: 'P4_ulp_boundary_forcing_dims_decay_hint_and_threshold', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_output_count_bound());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_permutation_invariance());
results.properties.push(checkP4_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-278-reputation-score-aggregator',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
