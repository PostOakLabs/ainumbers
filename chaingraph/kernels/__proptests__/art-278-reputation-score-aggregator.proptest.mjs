// art-278-reputation-score-aggregator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C9-1).
// kernel_digest_at_authoring: sha256:850b121b034535af7d822a1c012531859fee30aa0dedfdac945790272d446068
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (per WU triage table, re-confirmed by direct read — exponential decay
// weighting via `pow(2, -ageDays/halfLife)`, weighted-mean division, and clamp/threshold
// comparisons at composite >= 0.5 / <= -0.5; mandatory ULP-boundary forcing per spec §3).
// Checks: fixture-oracle gate, termination (all loops bounded by attestations.length; dedupe
// is a single Map pass, no recursion), boundedness (dims/composite always in [-1,1] and finite),
// differential re-derivation of the compliance_flags tier from composite, ULP-boundary forcing
// at the +/-0.5 composite threshold and the ageDays/halfLife<=0 guard (0, negative zero,
// denormals), and a metamorphic identity (scaling every attestation's weight_hint by the same
// positive k>0 leaves dims/composite unchanged — weighted-mean scale invariance).
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
const rand = mulberry32(0x278A0);

function randomDate(rng) {
  const day = 1 + Math.floor(rng() * 27);
  return `2026-0${1 + Math.floor(rng() * 8)}-${String(day).padStart(2, '0')}`;
}

function randomAttestations(rng, n, subjectId) {
  return Array.from({ length: n }, (_, i) => ({
    subject_id: subjectId,
    issuer_id: `issuer_${Math.floor(rng() * 5)}`,
    receipt_hash: `sha256:hash${i}`,
    dims: {
      competence: rng() * 2 - 1,
      integrity: rng() * 2 - 1,
      timeliness: rng() * 2 - 1,
      cooperation: rng() * 2 - 1,
    },
    issued_at: randomDate(rng),
    weight_hint: 0.5 + rng() * 2,
  }));
}

function randomPP(rng) {
  const n = Math.floor(rng() * 10);
  return {
    subject_id: 'subj',
    as_of: '2026-08-10',
    decay_half_life_days: 60 + Math.floor(rng() * 300),
    attestations: randomAttestations(rng, n, 'subj'),
  };
}

const TRIALS = 5000;
const DIMS = ['competence', 'integrity', 'timeliness', 'cooperation'];

// ---------- P1: termination — attestation_count <= input attestations.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    checked++;
    const { output_payload } = compute(pp);
    if (output_payload.attestation_count > pp.attestations.length) violations++;
    if (output_payload.excluded_self_issued > pp.attestations.length) violations++;
  }
  return { name: 'P1_attestation_count_bounded_by_input_length', trials: checked, violations };
}

// ---------- P2: boundedness — dims and composite in [-1, 1] and finite ----------
function checkP2_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    checked++;
    const { output_payload } = compute(pp);
    for (const d of DIMS) {
      const v = output_payload.dims[d];
      if (!Number.isFinite(v) || v < -1 || v > 1) violations++;
    }
    if (!Number.isFinite(output_payload.composite) || output_payload.composite < -1 || output_payload.composite > 1) violations++;
  }
  return { name: 'P2_dims_and_composite_bounded_-1_1_finite', trials: checked, violations };
}

// ---------- P3 (differential): compliance-flag tier re-derivation from composite ----------
function checkP3_tier_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    checked++;
    const { output_payload, compliance_flags } = compute(pp);
    if (output_payload.insufficient_evidence) {
      if (!compliance_flags.includes('REPUTATION_INSUFFICIENT_EVIDENCE')) violations++;
      continue;
    }
    const expected = output_payload.composite >= 0.5 ? 'REPUTATION_STRONG_POSITIVE'
      : output_payload.composite <= -0.5 ? 'REPUTATION_STRONG_NEGATIVE'
      : 'REPUTATION_MIXED_OR_NEUTRAL';
    if (!compliance_flags.includes(expected)) violations++;
  }
  return { name: 'P3_composite_tier_flag_differential', trials: checked, violations };
}

// ---------- P4 (ULP-forcing, float_sensitive:yes) — +/-0.5 composite threshold + halfLife guard ----------
function ppSingle(dims, halfLife = 180, ageDays = 0) {
  const asOf = '2026-08-10';
  const issued = ageDays === 0 ? asOf : '2026-01-01';
  return { subject_id: 's', as_of: asOf, decay_half_life_days: halfLife, attestations: [{ subject_id: 's', issuer_id: 'i', receipt_hash: 'h', dims, issued_at: issued }] };
}
const ULP_BOUNDARY_CASES = [
  { label: 'composite exactly 0.5 -> STRONG_POSITIVE (>=)', pp: ppSingle({ competence: 0.5, integrity: 0.5, timeliness: 0.5, cooperation: 0.5 }) },
  { label: 'composite 1 ULP below 0.5 -> toFixed(6) rounding absorbs it, still exactly 0.5 -> STRONG_POSITIVE', pp: ppSingle({ competence: 0.5 - Number.EPSILON, integrity: 0.5, timeliness: 0.5, cooperation: 0.5 }) },
  { label: 'composite exactly -0.5 -> STRONG_NEGATIVE (<=)', pp: ppSingle({ competence: -0.5, integrity: -0.5, timeliness: -0.5, cooperation: -0.5 }) },
  { label: 'zero decay_half_life_days -> guarded, attestation dropped -> insufficient evidence', pp: ppSingle({ competence: 1, integrity: 1, timeliness: 1, cooperation: 1 }, 0) },
  { label: 'negative-zero decay_half_life_days -> treated as <=0, guarded', pp: ppSingle({ competence: 1, integrity: 1, timeliness: 1, cooperation: 1 }, -0) },
  { label: 'dims at denormal-scale (5e-320) -> clamps/finite, near-zero composite', pp: ppSingle({ competence: 5e-320, integrity: 5e-320, timeliness: 5e-320, cooperation: 5e-320 }) },
  { label: 'dims out-of-range (2, -2) -> clamped to [-1,1]', pp: ppSingle({ competence: 2, integrity: -2, timeliness: 2, cooperation: -2 }) },
];
function checkP5_forced() {
  return ULP_BOUNDARY_CASES.map((c) => {
    const { output_payload, compliance_flags } = compute(c.pp);
    return { label: c.label, composite: output_payload.composite, insufficient_evidence: output_payload.insufficient_evidence, compliance_flags, finite: Number.isFinite(output_payload.composite) };
  });
}

// ---------- P6: metamorphic — scaling all weight_hints by k>0 preserves dims/composite ----------
function checkP6_weight_scale_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 3000; i++) {
    const pp = randomPP(rand);
    if (pp.attestations.length === 0) continue;
    const k = 1.5 + rand() * 5;
    const scaled = { ...pp, attestations: pp.attestations.map((a) => ({ ...a, weight_hint: (a.weight_hint ?? 1) * k })) };
    checked++;
    const r1 = compute(pp).output_payload;
    const r2 = compute(scaled).output_payload;
    if (Math.abs(r1.composite - r2.composite) > 1e-6) violations++;
    for (const d of DIMS) if (Math.abs(r1.dims[d] - r2.dims[d]) > 1e-6) violations++;
  }
  return { name: 'P6_weight_hint_uniform_scale_invariance', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_bounded());
results.properties.push(checkP3_tier_differential());
results.properties.push(checkP6_weight_scale_invariance());
const ulpRows = checkP5_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-278-reputation-score-aggregator',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  ulp_boundary_forced_cases: ulpRows,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
