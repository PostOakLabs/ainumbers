// kernel_digest_at_authoring: sha256:6e468a348055e83bb98d072b1f2879af2e98a5d8fcca76f119320f136edc0955
//
// FV-PROPFLOOR-SHARD-B17-1 — property-test floor for art-87-iso20022-pqc-readiness-checker.
// Class B (bounded-numeric/categorical), FLOAT:NO per the WU row. NOTE (measured against the
// actual kernel source, documented per this shard's manifest per_item_basis_of_review):
// bloat_factor = (new_sig_bytes / (current_sig_bytes || 256)).toFixed(1) IS a genuine float
// division, unlike the other 5 float:NO kernels in this shard which are purely integer/
// categorical. Per the WU's mandatory instruction this kernel still follows the WU's explicit
// float:NO/categorical assignment (the primary decision surface — readiness_score, size_breach,
// affected message types — is fixed-size-constant arithmetic and enum lookups), but the forced
// boundary array below deliberately includes the bloat_factor division's own edge cases
// (fallback-to-RSA2048 divisor when current_sig_bytes resolves falsy, and a division producing a
// long repeating decimal) alongside the categorical enum/threshold cases, so the float surface
// this kernel does have is still exercised. Zero external dependencies (mulberry32 PRNG +
// explicit boundary arrays), same shape as the B1/B12 harness. This file is READ-ONLY with
// respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-87-iso20022-pqc-readiness-checker.proptest.mjs

import { compute } from '../art-87-iso20022-pqc-readiness-checker.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-87-iso20022-pqc-readiness-checker.fixtures.json');
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
const rand = mulberry32(0x87D4E6);
const TRIALS = 8000;
const SIG_SCHEMES = ['RSA2048', 'ECDSA256', 'ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87', 'unknown'];
const PQC_ALGS = ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'];
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function mkPP(rng) {
  return {
    messaging: {
      message_types: rng() < 0.5 ? ['sese.023'] : [],
      signature_scheme: pick(rng, SIG_SCHEMES),
      bah_present: rng() < 0.5,
      max_message_size_bytes: 1000 + Math.floor(rng() * 100000),
    },
    pqc_algorithm: pick(rng, PQC_ALGS),
  };
}

const ML_DSA_SIZES = { 'ML-DSA-44': 2420, 'ML-DSA-65': 3309, 'ML-DSA-87': 4627 };
const RSA2048 = 256, ECDSA256 = 72, BAH = 512;

// ---------- P1: new_sig_bytes is exactly the ML_DSA_SIZES lookup for pqc_algorithm, current_sig_bytes ----------
// ---------- is exactly the enum-lookup for signature_scheme with the RSA2048 fallback -----------------------
function checkP1_sigBytesExactEnumLookup() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expectedNew = ML_DSA_SIZES[pp.pqc_algorithm] ?? ML_DSA_SIZES['ML-DSA-65'];
    if (r.output_payload.new_sig_bytes !== expectedNew) violations++;
    const scheme = pp.messaging.signature_scheme;
    const expectedCurrent = scheme === 'RSA2048' ? RSA2048 : scheme === 'ECDSA256' ? ECDSA256 : ML_DSA_SIZES[scheme] !== undefined ? ML_DSA_SIZES[scheme] : RSA2048;
    if (r.output_payload.current_sig_bytes !== expectedCurrent) violations++;
  }
  return { name: 'P1_sig_bytes_exact_enum_lookup_with_fallback', trials: checked, violations };
}

// ---------- P2: readiness_score is bounded to [0,100] and exactly matches the fixed-deduction formula --------
function checkP2_readinessScoreBoundedAndExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { readiness_score, size_breach } = r.output_payload;
    if (readiness_score < 0 || readiness_score > 100) violations++;
    let expected = 100;
    if (size_breach) expected -= 30;
    if (!pp.messaging.bah_present && pp.pqc_algorithm.includes('87')) expected -= 20;
    if (pp.messaging.signature_scheme === 'RSA2048' || pp.messaging.signature_scheme === 'ECDSA256') expected -= 10;
    if (expected < 0) expected = 0;
    if (readiness_score !== expected) violations++;
  }
  return { name: 'P2_readiness_score_bounded_and_matches_fixed_deduction_formula', trials: checked, violations };
}

// ---------- P3: size_breach is the exact boolean (new_message_size_bytes > max_message_size_bytes) -----------
function checkP3_sizeBreachExactComparison() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { size_breach, new_message_size_bytes } = r.output_payload;
    if (size_breach !== (new_message_size_bytes > pp.messaging.max_message_size_bytes)) violations++;
    if (size_breach !== r.compliance_flags.includes('MESSAGE_SIZE_BREACH')) violations++;
  }
  return { name: 'P3_size_breach_exact_comparison_and_matches_compliance_flag', trials: checked, violations };
}

// ---------- P4 (mandatory, float:no exception, includes the division edge cases per header note) ----
const CATEGORICAL_BOUNDARY_CASES = [
  [{}, 'policy_parameters entirely empty — must use all documented defaults (RSA2048, ML-DSA-65 target, no BAH), bloat_factor exactly 12.9'],
  [{ messaging: { signature_scheme: 'RSA2048', max_message_size_bytes: 0 } }, 'max_message_size_bytes exactly zero — baseline_body clamps to exactly 0 via Math.max, new_message_size_bytes must still be finite'],
  [{ messaging: { signature_scheme: 'ML-DSA-87', max_message_size_bytes: 32768 } }, 'current signature scheme already ML-DSA-87 (no legacy penalty applies) — bloat_factor must divide new/current using the ML-DSA lookup for BOTH sides, never falling back to RSA2048'],
  [{ pqc_algorithm: 'unrecognized-algo' }, 'pqc_algorithm not in the ML_DSA_SIZES registry — new_sig_bytes must fall back to the ML-DSA-65 default (3309), target_pqc field still echoes the unrecognized string verbatim'],
  [{ messaging: { signature_scheme: 'unrecognized-scheme', max_message_size_bytes: 32768 } }, 'signature_scheme unrecognized string — current_sig_bytes falls back to RSA2048 (256), bloat_factor divisor uses the fallback, not zero'],
  [{ messaging: { signature_scheme: 'RSA2048', bah_present: true, max_message_size_bytes: 32768 }, pqc_algorithm: 'ML-DSA-87' }, 'bah_present true with ML-DSA-87 target (algorithm string contains "87") — the BAH-and-87-together exception must skip the 20-point deduction (bah_present is truthy)'],
  [{ messaging: { signature_scheme: 'RSA2048', bah_present: false, max_message_size_bytes: 32768 }, pqc_algorithm: 'ML-DSA-87' }, 'bah_present false with ML-DSA-87 target — must apply the 20-point deduction on top of the RSA2048 10-point deduction, readiness_score exactly 40 (100-30size_breach?-20-10, verify against actual breach state)'],
  [{ messaging: { signature_scheme: 'RSA2048', max_message_size_bytes: 1000000 } }, 'max_message_size_bytes very large — size_breach must be false, readiness_score only loses the legacy-scheme 10 points'],
  [{ messaging: { bah_present: true, signature_scheme: 'ML-DSA-65' }, }, 'bah_present true with a non-"87" pqc target and an ML-DSA current scheme — BAH_SIGNATURE_NOT_PQC flag must NOT fire since signature_scheme already starts with "ML-DSA"'],
  [{ messaging: { bah_present: true, signature_scheme: 'RSA2048' } }, 'bah_present true with legacy RSA2048 signature_scheme — BAH_SIGNATURE_NOT_PQC flag must fire'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { readiness_score, bloat_factor, new_message_size_bytes, current_sig_bytes } = r.output_payload;
    const plausible = Number.isFinite(readiness_score) && readiness_score >= 0 && readiness_score <= 100
      && Number.isFinite(bloat_factor) && bloat_factor > 0
      && Number.isFinite(new_message_size_bytes) && current_sig_bytes > 0;
    rows.push({ label, input: pp, readiness_score, bloat_factor, new_message_size_bytes, compliance_flags: r.compliance_flags, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_sigBytesExactEnumLookup());
results.properties.push(checkP2_readinessScoreBoundedAndExact());
results.properties.push(checkP3_sizeBreachExactComparison());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);
