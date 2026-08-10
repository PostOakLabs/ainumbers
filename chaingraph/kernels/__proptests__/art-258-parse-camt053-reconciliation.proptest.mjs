// art-258-parse-camt053-reconciliation.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C8-1).
// kernel_digest_at_authoring: sha256:483a887df68aeec8656fdaced42c4550167da3ee49bfb2273f2076c6fcaf1dd4
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny — blanket
// class-C Dafny stays frozen. float_sensitive: YES (opening/closing balance arithmetic, ULP-forced below).
// Checks: fixture-oracle gate, termination (bucket maps bounded by transactions.length), boundedness
// (match_rate_pct in [0,100], credit/debit sums finite), ULP-boundary forcing on the balance equation
// (±1 ULP, 0, negative zero, denormals, ties near the 0.005 tolerance), and a metamorphic permutation
// -invariance check on credit_sum/debit_sum (transaction order must not change the totals).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-258-parse-camt053-reconciliation.proptest.mjs

import { compute } from '../art-258-parse-camt053-reconciliation.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-258-parse-camt053-reconciliation.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const output_payload = compute(vec.policy_parameters);
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
const rand = mulberry32(0x258A0);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const DOMAINS = ['PMNT', 'LDAS', 'SECU', 'FORX', 'FEES', 'CAMT', 'OPCL', 'NTAV', 'ACMT', 'DERV', 'XTND'];
const FAMILIES = ['RCDT', 'ICDT', 'IDDT', 'ODDT', 'MCRD', 'CCRD', 'BOOK', 'XBCT', 'CNTR', 'OTHR'];
const CDIS = ['CRDT', 'DBIT'];
const TRIALS = 6000;

function randomTx(rng) {
  return {
    amount: randRange(rng, 0, 100000),
    credit_debit_indicator: pick(rng, CDIS),
    bk_tx_cd: { domain: pick(rng, DOMAINS), family: pick(rng, FAMILIES) },
    remittance_info: { structured: rng() < 0.5, end_to_end_id: rng() < 0.5 ? 'E2E-' + Math.floor(rng() * 1000) : 'NOTPROVIDED' },
  };
}

// ---------- P1: termination — bucket maps and totals bounded by transactions.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 300; i++) {
    const n = Math.floor(randRange(rand, 0, 250));
    const transactions = Array.from({ length: n }, () => randomTx(rand));
    const output_payload = compute({ opening_balance: 0, closing_balance: 0, transactions });
    checked++;
    if (output_payload.total_transactions !== n) violations++;
    if (output_payload.structured_count + output_payload.unstructured_count !== n) violations++;
    const bucketTotal = Object.values(output_payload.tx_counts_by_bucket).reduce((s, v) => s + v, 0);
    if (bucketTotal !== n) violations++;
  }
  return { name: 'P1_termination_bounded_by_tx_count', trials: checked, violations };
}

// ---------- P2: boundedness — match_rate_pct in [0,100], sums finite and non-negative ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(randRange(rand, 0, 20));
    const transactions = Array.from({ length: n }, () => randomTx(rand));
    const output_payload = compute({ opening_balance: randRange(rand, -1e6, 1e6), closing_balance: randRange(rand, -1e6, 1e6), transactions });
    checked++;
    if (output_payload.match_rate_pct < 0 || output_payload.match_rate_pct > 100) violations++;
    if (!Number.isFinite(output_payload.credit_sum) || !Number.isFinite(output_payload.debit_sum)) violations++;
    if (output_payload.credit_sum < -1e-6 || output_payload.debit_sum < -1e-6) violations++;
    if (!Number.isFinite(output_payload.variance) || !Number.isFinite(output_payload.calculated_closing)) violations++;
  }
  return { name: 'P2_boundedness_matchrate_and_sums', trials: checked, violations };
}

// ---------- P3: differential — balance_equation_passes matches |variance| < 0.005 recomputed independently ----------
function checkP3_balance_equation_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(randRange(rand, 0, 15));
    const opening_balance = randRange(rand, -50000, 50000);
    const closing_balance = randRange(rand, -50000, 50000);
    const transactions = Array.from({ length: n }, () => randomTx(rand));
    const output_payload = compute({ opening_balance, closing_balance, transactions });
    checked++;
    const recalculated = Math.round((opening_balance + output_payload.credit_sum - output_payload.debit_sum) * 100) / 100;
    const expectedPasses = Math.abs(Math.round((closing_balance - recalculated) * 100) / 100) < 0.005;
    if (output_payload.balance_equation_passes !== expectedPasses) violations++;
  }
  return { name: 'P3_balance_equation_differential', trials: checked, violations };
}

// ---------- P4 (ULP-forcing, float_sensitive:yes) — balance equation boundary + edge amounts ----------
const ULP_BOUNDARY_CASES = [
  { label: 'zero opening/closing, zero txs -> passes trivially', opening_balance: 0, closing_balance: 0, transactions: [] },
  { label: 'negative-zero balances -> must behave as zero', opening_balance: -0, closing_balance: -0, transactions: [] },
  { label: 'variance exactly at 0.005 tolerance boundary', opening_balance: 100, closing_balance: 100.005, transactions: [] },
  { label: 'variance one ULP inside tolerance (0.00499999...)', opening_balance: 100, closing_balance: 100 + (0.005 - Number.EPSILON * 100), transactions: [] },
  { label: 'denormal amount transaction', opening_balance: 0, closing_balance: Number.MIN_VALUE, transactions: [{ amount: Number.MIN_VALUE, credit_debit_indicator: 'CRDT', bk_tx_cd: { domain: 'PMNT', family: 'RCDT' } }] },
  { label: 'x/y*y !== x style rounding: 0.1+0.2 credit sum', opening_balance: 0, closing_balance: 0.3, transactions: [{ amount: 0.1, credit_debit_indicator: 'CRDT', bk_tx_cd: { domain: 'PMNT' } }, { amount: 0.2, credit_debit_indicator: 'CRDT', bk_tx_cd: { domain: 'PMNT' } }] },
  { label: 'large-magnitude near double precision limit', opening_balance: 0, closing_balance: 9e15, transactions: [{ amount: 9e15, credit_debit_indicator: 'CRDT', bk_tx_cd: { domain: 'PMNT' } }] },
];
function checkP4_forced() {
  const rows = [];
  for (const c of ULP_BOUNDARY_CASES) {
    const output_payload = compute(c);
    rows.push({
      label: c.label,
      variance: output_payload.variance,
      balance_equation_passes: output_payload.balance_equation_passes,
      finite: Number.isFinite(output_payload.variance) && Number.isFinite(output_payload.calculated_closing) && Number.isFinite(output_payload.credit_sum) && Number.isFinite(output_payload.debit_sum),
    });
  }
  return rows;
}

// ---------- P5: metamorphic — permutation-invariance of credit_sum/debit_sum under transaction reorder ----------
function checkP5_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const n = 1 + Math.floor(randRange(rand, 0, 30));
    const transactions = Array.from({ length: n }, () => randomTx(rand));
    const shuffled = transactions.slice();
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    const r1 = compute({ opening_balance: 0, closing_balance: 0, transactions });
    const r2 = compute({ opening_balance: 0, closing_balance: 0, transactions: shuffled });
    checked++;
    const tol = Math.max(0.02, Math.abs(r1.credit_sum) * 1e-6);
    if (Math.abs(r1.credit_sum - r2.credit_sum) > tol) violations++;
    if (Math.abs(r1.debit_sum - r2.debit_sum) > tol) violations++;
    if (r1.total_transactions !== r2.total_transactions) violations++;
  }
  return { name: 'P5_metamorphic_permutation_invariance_sums', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_balance_equation_differential());
results.properties.push(checkP5_permutation_invariance());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryMismatch = results.boundary_forced.some((b) => !b.finite);

console.log(JSON.stringify({
  tool_id: 'art-258-parse-camt053-reconciliation',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_mismatch: anyBoundaryMismatch,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryMismatch ? 1 : 0);
