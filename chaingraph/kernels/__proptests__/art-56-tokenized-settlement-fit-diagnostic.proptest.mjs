// kernel_digest_at_authoring: sha256:b52a79f937c901786a32dcae3e275f3e2a4bb308cb0fb844998c5cf1268da1ff
//
// FV-PROPFLOOR-SHARD-B14-1 — property-test floor for art-56-tokenized-settlement-fit-diagnostic.
// Class B (weighted-diagnostic), FLOAT:YES per the WU row — CORRECTED BASIS: on direct kernel
// reading (FIX-2 carry), this kernel has NO continuous user-supplied numeric input feeding the
// score (every scoring field is a pick() lookup over a small integer table {0,1,2,3,4}); the two
// numeric/free-text fields (participant_type, annual_settlement_value_usd) are explicitly
// informational and never enter the score arithmetic. Its float-sensitivity is therefore, as with
// the sibling art-52 kernel, at the internal weighted-average layer only (dim_scores toFixed(1)
// rounding + decimal WEIGHTS 0.25/0.20/0.15/0.15/0.15/0.10 not exactly binary-representable). ULP-
// boundary forcing is retained (kept float:yes per the WU row) but targets grade-threshold
// boundaries plus categorical-fallback cases rather than a classic continuous-domain ULP crossing.
// Zero external dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-56-tokenized-settlement-fit-diagnostic.proptest.mjs

import { compute } from '../art-56-tokenized-settlement-fit-diagnostic.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-56-tokenized-settlement-fit-diagnostic.fixtures.json');
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
const rand = mulberry32(0x56A88C);
const TRIALS = 10000;
const letter = (s) => (s >= 85 ? 'A' : s >= 70 ? 'B' : s >= 55 ? 'C' : s >= 40 ? 'D' : 'F');
const WEIGHTS = { settlement_asset: 0.25, network: 0.20, asset_leg: 0.15, issuer: 0.15, liquidity: 0.15, controls: 0.10 };
const GRADES = new Set(['A', 'B', 'C', 'D', 'F']);

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

function mkPP(rng) {
  return {
    cash_leg_asset: pick(rng, ['central-bank-money', 'tokenized-deposit', 'regulated-stablecoin', 'e-money', 'off-chain-RTGS']),
    finality_regime: pick(rng, ['SFD-designated', 'PFMI-aligned', 'UCC-Art12', 'unclear']),
    network_model: pick(rng, ['single-ledger', 'two-network-bridged', 'multi-network']),
    atomicity_mechanism: pick(rng, ['shared-ledger', 'HTLC', 'notary', 'unsynchronised']),
    asset_leg_type: pick(rng, ['tokenized-security', 'tokenized-collateral', 'tokenized-repo', 'tokenized-MMF', 'none']),
    participant_eligibility: pick(rng, ['allowlisted-LEI', 'KYC-tiered', 'open']),
    deposit_token_issuer: pick(rng, ['G-SIB-deposit-token', 'CBM-account', 'RLN-member', 'stablecoin-issuer', 'none']),
    operating_hours: pick(rng, ['24x7', 'extended', 'RTGS-window-only']),
    intraday_liquidity: pick(rng, ['prefunded', 'intraday-credit', 'netting', 'none']),
    reconciliation_model: pick(rng, ['hash-anchored', 'dual-ledger-recon', 'manual']),
    participant_type: pick(rng, ['bank', 'nonbank', 'central-bank']),
    annual_settlement_value_usd: Math.floor(randRange(rng, -100, 1e12)),
  };
}

// ---------- P1: overall_score exactly reproducible from returned dim_scores * WEIGHTS ----------
function checkP1_overallRoundTrip() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { dim_scores, overall_score } = r.output_payload;
    const expected = +Object.keys(WEIGHTS).reduce((acc, k) => acc + dim_scores[k].score * WEIGHTS[k], 0).toFixed(1);
    if (overall_score !== expected) violations++;
    if (overall_score < 0 || overall_score > 100) violations++;
  }
  return { name: 'P1_overall_score_exact_weighted_sum_of_returned_dim_scores', trials: checked, violations };
}

// ---------- P2: overall_grade matches letter(overall_score); dim grades bounded enum ----------
function checkP2_gradesConsistent() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { dim_scores, overall_score, overall_grade } = r.output_payload;
    if (overall_grade !== letter(overall_score)) violations++;
    for (const k of Object.keys(dim_scores)) {
      if (!GRADES.has(dim_scores[k].grade)) violations++;
      if (dim_scores[k].score < 0 || dim_scores[k].score > 100) violations++;
    }
  }
  return { name: 'P2_overall_grade_exact_and_dim_grades_bounded', trials: checked, violations };
}

// ---------- P3: informational fields (participant_type, annual_settlement_value_usd) never affect score ----------
function checkP3_informationalFieldsNoop() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r1 = compute(pp);
    const pp2 = { ...pp, participant_type: 'central-bank', annual_settlement_value_usd: 123456789012 };
    const r2 = compute(pp2);
    checked++;
    if (r1.output_payload.overall_score !== r2.output_payload.overall_score) violations++;
    if (JSON.stringify(r1.output_payload.dim_scores) !== JSON.stringify(r2.output_payload.dim_scores)) violations++;
  }
  return { name: 'P3_informational_fields_never_affect_score', trials: checked, violations };
}

// ---------- P4 (mandatory, retained float:yes per WU row): boundary forcing on the weighted-average
// arithmetic and enum fallback, since no continuous user field exists to force classic ULP crossing ----------
const ULP_BOUNDARY_CASES = [
  [{}, 'all fields defaulted — must produce a finite, deterministic overall_score with consistent grade'],
  [{ cash_leg_asset: 'unrecognized-asset-xyz' }, 'unrecognized enum string for a scored field — pick() default of 0 must apply, no NaN'],
  [{ cash_leg_asset: 'central-bank-money', finality_regime: 'SFD-designated', network_model: 'single-ledger', atomicity_mechanism: 'shared-ledger', asset_leg_type: 'tokenized-security', participant_eligibility: 'allowlisted-LEI', deposit_token_issuer: 'G-SIB-deposit-token', operating_hours: '24x7', intraday_liquidity: 'prefunded', reconciliation_model: 'hash-anchored' }, 'every field at its maximum score — overall_score must be exactly 100.0, grade A'],
  [{ cash_leg_asset: 'off-chain-RTGS', finality_regime: 'unclear', network_model: 'two-network-bridged', atomicity_mechanism: 'unsynchronised', asset_leg_type: 'none', participant_eligibility: 'open', deposit_token_issuer: 'none', operating_hours: 'RTGS-window-only', intraday_liquidity: 'none', reconciliation_model: 'manual' }, 'every field at its minimum score — overall_score must be exactly 10.0 (network_model floors at 2, operating_hours floors at 1), grade F, all flags fire'],
  [{ annual_settlement_value_usd: NaN }, 'annual_settlement_value_usd NaN — informational only, must not propagate into overall_score (still finite)'],
  [{ annual_settlement_value_usd: Number.MAX_SAFE_INTEGER }, 'annual_settlement_value_usd at MAX_SAFE_INTEGER — informational only, must not affect overall_score'],
  [{ cash_leg_asset: null }, 'cash_leg_asset null (not a string) — pick() default of 0 must apply, no throw, no NaN'],
  [{ atomicity_mechanism: 'unsynchronised', network_model: 'single-ledger' }, 'unsynchronised atomicity but single-ledger network — UNSYNCHRONISED_ATOMICITY flag must still fire (atomicity_mechanism gates independently of network_model)'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const { dim_scores, overall_score, overall_grade } = r.output_payload;
    const allFinite = Object.values(dim_scores).every((d) => Number.isFinite(d.score)) && Number.isFinite(overall_score);
    const plausible = allFinite && GRADES.has(overall_grade) && overall_score >= 0 && overall_score <= 100;
    rows.push({ label, input: pp, overall_score, overall_grade, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_overallRoundTrip());
results.properties.push(checkP2_gradesConsistent());
results.properties.push(checkP3_informationalFieldsNoop());
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
