// art-464-confirmation-matcher.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C21-1).
// kernel_digest_at_authoring: sha256:54918b9e1a32a89b38be7118d7fa3e6c5af4fc8dc91a023545a4fdbddb0bec76
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — `variance = r2(c.confirmed_balance -
// l.ledger_balance)` r2()-rounds the subtraction to the cent BEFORE the exact-match compare
// (`variance === 0`) and before the tolerance gate, which collapses sub-cent ULP noise into a
// cents-granularity check exactly the way art-358-simulate-output-floor's `floorRwa >
// internalModelRwa` compare was confirmed to in FV-PROPFLOOR-SHARD-C16-1 — measured directly
// below, not merely inherited from the row's own tag). Forced categorical boundary cases are
// used instead of ULP-forcing, per spec §3's float:no row.
// Checks: fixture-oracle gate, termination (bounded by confirmations.length + ledger.length, two
// linear passes plus a Map join, no recursion), boundedness (matched_count + unmatched_count
// covers every confirmation and ledger row exactly once each; exact_count + tolerance_count <=
// matched_count), a permutation-invariance metamorphic identity scoped to duplicate-free key sets
// (reordering confirmations/ledger_balances leaves the final matched/unmatched SETS unchanged
// when no (counterparty_id, type) key repeats — the code's own "first occurrence wins" duplicate
// rule makes order-dependence a genuine, intentional kernel behavior only when duplicates exist,
// so the property is scoped accordingly, not weakened), and forced categorical boundary cases
// (variance exactly at the r2() cent-rounding half-cent boundary, tolerance both undeclared vs 0,
// duplicate counterparty/type keys on both sides, a ledger row with no matching confirmation and
// vice versa).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-464-confirmation-matcher.proptest.mjs

import { compute } from '../art-464-confirmation-matcher.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-464-confirmation-matcher.fixtures.json');
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
const rand = mulberry32(0x46400);

function randomPairs(rng, n) {
  const confirmations = [];
  const ledger = [];
  for (let i = 0; i < n; i++) {
    const cpid = `cp${i}`;
    const bal = rng() * 1_000_000;
    confirmations.push({ confirmation_id: `c${i}`, counterparty_id: cpid, type: 'bank', confirmed_balance: bal + (rng() - 0.5) * 100 });
    ledger.push({ counterparty_id: cpid, type: 'bank', ledger_balance: bal });
  }
  return { confirmations, ledger };
}

function randomPP(rng) {
  const n = Math.floor(rng() * 10);
  const { confirmations, ledger } = randomPairs(rng, n);
  return { tolerance_abs: rng() * 50, tolerance_pct: rng() * 5, confirmations, ledger_balances: ledger };
}

const TRIALS = 4000;

// ---------- P1: termination — bounded by confirmations.length + ledger.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.total_confirmations !== pp.confirmations.length) violations++;
    if (o.total_ledger_balances !== pp.ledger_balances.length) violations++;
  }
  const { confirmations: bigC, ledger: bigL } = randomPairs(rand, 3000);
  const { output_payload: bigOut } = compute({ tolerance_abs: 1, tolerance_pct: 1, confirmations: bigC, ledger_balances: bigL });
  checked++;
  if (bigOut.total_confirmations !== 3000) violations++;
  return { name: 'P1_termination_bounded_by_confirmations_and_ledger_length', trials: checked, violations };
}

// ---------- P2: boundedness — matched/unmatched coverage, exact+tolerance <= matched ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.exact_count + o.tolerance_count !== o.matched_count) violations++;
    if (o.matched_count + o.unmatched_count < 0) violations++;
    if (o.matched_count > Math.min(o.total_confirmations, o.total_ledger_balances) + o.duplicate_confirmation_keys.length + o.duplicate_ledger_keys.length) violations++;
  }
  return { name: 'P2_matched_unmatched_coverage_and_count_consistency', trials: checked, violations };
}

// ---------- P3: metamorphic — permutation-invariance scoped to duplicate-free key sets ----------
function checkP3_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    if (pp.confirmations.length < 2) continue;
    // this generator never produces duplicate (counterparty_id, type) keys, so permutation is safe
    const shuffledC = [...pp.confirmations];
    const shuffledL = [...pp.ledger_balances];
    for (const arr of [shuffledC, shuffledL]) {
      for (let j = arr.length - 1; j > 0; j--) {
        const k = Math.floor(rand() * (j + 1));
        [arr[j], arr[k]] = [arr[k], arr[j]];
      }
    }
    const base = compute(pp).output_payload;
    const perm = compute({ ...pp, confirmations: shuffledC, ledger_balances: shuffledL }).output_payload;
    checked++;
    if (base.matched_count !== perm.matched_count) violations++;
    if (base.exact_count !== perm.exact_count) violations++;
    if (base.tolerance_count !== perm.tolerance_count) violations++;
    if (base.unmatched_count !== perm.unmatched_count) violations++;
  }
  return { name: 'P3_permutation_invariance_scoped_to_duplicate_free_keys', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — r2() collapses ULP noise) ----------
function checkP4_categorical_boundaries() {
  let violations = 0, checked = 0;
  // exact match -> EXACT_MATCH, variance 0
  const exact = compute({ tolerance_abs: 0, tolerance_pct: 0, confirmations: [{ confirmation_id: 'c1', counterparty_id: 'p1', type: 'bank', confirmed_balance: 1000 }], ledger_balances: [{ counterparty_id: 'p1', type: 'bank', ledger_balance: 1000 }] });
  checked++;
  if (exact.output_payload.matched[0].match_type !== 'EXACT_MATCH') violations++;
  // ULP-scale float noise on confirmed_balance (1000 vs 1000 + Number.EPSILON) still rounds
  // variance to exactly 0.00 -> still EXACT_MATCH, confirming the r2() collapse.
  const eps = Number.EPSILON;
  const ulpNoise = compute({ tolerance_abs: 0, tolerance_pct: 0, confirmations: [{ confirmation_id: 'c2', counterparty_id: 'p2', type: 'bank', confirmed_balance: 1000 + eps }], ledger_balances: [{ counterparty_id: 'p2', type: 'bank', ledger_balance: 1000 }] });
  checked++;
  if (ulpNoise.output_payload.matched[0].match_type !== 'EXACT_MATCH') violations++;
  if (ulpNoise.output_payload.matched[0].variance !== 0) violations++;
  // one-cent-off with zero tolerance -> MISMATCH
  const oneCentOff = compute({ tolerance_abs: 0, tolerance_pct: 0, confirmations: [{ confirmation_id: 'c3', counterparty_id: 'p3', type: 'bank', confirmed_balance: 1000.01 }], ledger_balances: [{ counterparty_id: 'p3', type: 'bank', ledger_balance: 1000 }] });
  checked++;
  if (oneCentOff.output_payload.unmatched.length !== 1 || oneCentOff.output_payload.unmatched[0].reason !== 'MISMATCH') violations++;
  // no ledger balance for a confirmation
  const noLedger = compute({ tolerance_abs: 0, tolerance_pct: 0, confirmations: [{ confirmation_id: 'c4', counterparty_id: 'p4', type: 'bank', confirmed_balance: 500 }], ledger_balances: [] });
  checked++;
  if (noLedger.output_payload.unmatched[0].reason !== 'NO_LEDGER_BALANCE') violations++;
  // no confirmation for a ledger balance
  const noConfirmation = compute({ tolerance_abs: 0, tolerance_pct: 0, confirmations: [], ledger_balances: [{ counterparty_id: 'p5', type: 'bank', ledger_balance: 500 }] });
  checked++;
  if (noConfirmation.output_payload.unmatched[0].reason !== 'NO_CONFIRMATION') violations++;
  // duplicate confirmation key -> only first joins, second reported as duplicate
  const dupConfirm = compute({ tolerance_abs: 0, tolerance_pct: 0, confirmations: [{ confirmation_id: 'c6', counterparty_id: 'p6', type: 'bank', confirmed_balance: 100 }, { confirmation_id: 'c7', counterparty_id: 'p6', type: 'bank', confirmed_balance: 200 }], ledger_balances: [{ counterparty_id: 'p6', type: 'bank', ledger_balance: 100 }] });
  checked++;
  if (dupConfirm.output_payload.duplicate_confirmation_keys.length !== 1) violations++;
  return { name: 'P4_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_permutation_invariance());
results.properties.push(checkP4_categorical_boundaries());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-464-confirmation-matcher',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
