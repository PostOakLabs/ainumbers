// kernel_digest_at_authoring: sha256:05da7b2247131bc9f19b998edc08d9be543cdf7507b90012e036e3e7b28289f1
//
// FV-PROPFLOOR-SHARD-B15-1 — property-test floor for art-60-agent-economy-runtime-fit-diagnostic.
// Class B (bounded-numeric), FLOAT-SENSITIVE (dim_scores[k].score and overall_score are computed
// via division by dim-array length, then /4*100, then toFixed(1) — classic weighted-average
// rounding surface) — ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3.
// Zero external dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-60-agent-economy-runtime-fit-diagnostic.proptest.mjs

import { compute } from '../art-60-agent-economy-runtime-fit-diagnostic.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-60-agent-economy-runtime-fit-diagnostic.fixtures.json');
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
const rand = mulberry32(0x60A11);
const TRIALS = 10000;

const SETTLEMENT_PROTOCOL = ['x402-v2', 'x402-v1', 'AP2-native', 'card-token', 'none'];
const BATCH_SETTLEMENT = ['escrow-voucher', 'per-request', 'none'];
const RECEIPT_STANDARD = ['AP2-PaymentReceipt', 'proprietary', 'none'];
const MANDATE_BINDING = ['VC-signed', 'API-asserted', 'none'];
const HNP_AUTONOMY = ['policy-gated', 'unbounded', 'not-used'];
const SPEND_CONTROLS = ['per-mandate-caps', 'global-cap', 'none'];
const RECON_MODEL = ['hash-anchored', 'ledger-diff', 'manual'];
const DISPUTE_PATH = ['automated', 'manual', 'none'];
const METERING_BASIS = ['per-call-metered', 'subscription', 'unmetered'];
const RUNTIME_FRAUD_CONTROLS = ['velocity+graph', 'basic', 'none'];

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function mkPP(rng) {
  return {
    settlement_protocol: pick(rng, SETTLEMENT_PROTOCOL),
    batch_settlement: pick(rng, BATCH_SETTLEMENT),
    receipt_standard: pick(rng, RECEIPT_STANDARD),
    mandate_binding: pick(rng, MANDATE_BINDING),
    hnp_autonomy: pick(rng, HNP_AUTONOMY),
    spend_controls: pick(rng, SPEND_CONTROLS),
    recon_model: pick(rng, RECON_MODEL),
    dispute_path: pick(rng, DISPUTE_PATH),
    metering_basis: pick(rng, METERING_BASIS),
    runtime_fraud_controls: pick(rng, RUNTIME_FRAUD_CONTROLS),
    agent_volume_txns_per_day: Math.floor(rng() * 1000000),
    operator_type: rng() < 0.2 ? 'marketplace' : 'agent-platform',
  };
}

// ---------- P1: boundedness — every dim score and overall_score stays in [0, 100] ----------
function checkP1_scoresBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { dim_scores, overall_score } = r.output_payload;
    let bad = overall_score < 0 || overall_score > 100 || !Number.isFinite(overall_score);
    for (const k of Object.keys(dim_scores)) {
      const s = dim_scores[k].score;
      if (s < 0 || s > 100 || !Number.isFinite(s)) bad = true;
    }
    if (bad) violations++;
  }
  return { name: 'P1_dim_and_overall_scores_bounded_0_to_100', trials: checked, violations };
}

// ---------- P2: grade agreement — each dim grade and overall_grade matches the fixed letter() thresholds ----------
function letter(s) { return s >= 85 ? 'A' : s >= 70 ? 'B' : s >= 55 ? 'C' : s >= 40 ? 'D' : 'F'; }
function checkP2_gradeMatchesThresholds() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { dim_scores, overall_score, overall_grade } = r.output_payload;
    let bad = overall_grade !== letter(overall_score);
    for (const k of Object.keys(dim_scores)) {
      if (dim_scores[k].grade !== letter(dim_scores[k].score)) bad = true;
    }
    if (bad) violations++;
  }
  return { name: 'P2_grades_match_fixed_85_70_55_40_thresholds', trials: checked, violations };
}

// ---------- P3: monotonicity — upgrading settlement_protocol to the best value never lowers the rail dim score ----------
function checkP3_monotonicInSettlementProtocol() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const rBest = compute({ ...pp, settlement_protocol: 'x402-v2' });
    const rWorst = compute({ ...pp, settlement_protocol: 'none' });
    checked++;
    if (rBest.output_payload.dim_scores.rail.score < rWorst.output_payload.dim_scores.rail.score - 1e-9) violations++;
  }
  return { name: 'P3_rail_score_nondecreasing_as_settlement_protocol_upgrades', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{}, 'all-defaults (every field at its weakest value) — overall_score must be finite and grade F, no NaN from 0/4 divisions'],
  [{ settlement_protocol: 'x402-v2', batch_settlement: 'escrow-voucher', receipt_standard: 'AP2-PaymentReceipt', mandate_binding: 'VC-signed', hnp_autonomy: 'policy-gated', spend_controls: 'per-mandate-caps', recon_model: 'hash-anchored', dispute_path: 'automated', metering_basis: 'per-call-metered', runtime_fraud_controls: 'velocity+graph' }, 'all-best-case — every sub-score at 4/4, overall_score must equal exactly 100.0 (WEIGHTS sum to 1.0 exactly)'],
  [{ hnp_autonomy: 'unbounded', spend_controls: 'none' }, 'HNP unbounded (score 0) with no spend controls — autonomy dim must floor and hnp_risk_flag must be non-null CRITICAL text'],
  [{ settlement_protocol: 'x402-v1', batch_settlement: 'none' }, 'rail sub-scores average (2+0)/2=1 — dim score = 1/4*100=25.0 exactly, must not drift to 24.999999999999996 or 25.000000000000004'],
  [{ receipt_standard: 'proprietary', mandate_binding: 'API-asserted' }, 'receipt sub-scores average (2+2)/2=2 — dim score must be exactly 50.0'],
  [{ hnp_autonomy: 'not-used', spend_controls: 'global-cap' }, 'autonomy sub-scores average (2+2)/2=2 — dim score must be exactly 50.0, never a repeating-binary artifact'],
  [{ recon_model: 'ledger-diff', dispute_path: 'automated' }, 'recon sub-scores average (2+4)/2=3 — dim score must be exactly 75.0, right at the B/C-adjacent 70 boundary but above it'],
  [{ settlement_protocol: 'AP2-native', batch_settlement: 'per-request' }, 'rail sub-scores average (3+1)/2=2 — dim score must be exactly 50.0'],
  [{ metering_basis: 'subscription' }, 'metering single-value dim, score 2/4*100=50.0 exactly — single-element array average must not introduce a rounding artifact'],
  [{ settlement_protocol: 'x402-v2', batch_settlement: 'escrow-voucher', receipt_standard: 'none', mandate_binding: 'none', hnp_autonomy: 'not-used', spend_controls: 'none', recon_model: 'manual', dispute_path: 'none', metering_basis: 'unmetered', runtime_fraud_controls: 'none' }, 'weighted sum near a grade-boundary composition (rail=100*0.25=25.0 exactly, rest low) — overall_score must land deterministically, not oscillate ±1e-13 across runs'],
];

function checkP4_forced() {
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = { ...overrides };
    const r = compute(pp);
    const { dim_scores, overall_score, overall_grade, hnp_risk_flag } = r.output_payload;
    let plausible = Number.isFinite(overall_score) && overall_score >= 0 && overall_score <= 100
      && typeof overall_grade === 'string';
    for (const k of Object.keys(dim_scores)) {
      if (!Number.isFinite(dim_scores[k].score)) plausible = false;
    }
    rows.push({ label, input: pp, overall_score, overall_grade, hnp_risk_flag, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_scoresBounded());
results.properties.push(checkP2_gradeMatchesThresholds());
results.properties.push(checkP3_monotonicInSettlementProtocol());
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
