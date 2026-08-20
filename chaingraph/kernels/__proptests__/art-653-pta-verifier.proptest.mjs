// art-653-pta-verifier.proptest.mjs — class-K property-test FLOOR (FV-PBT-FLOOR-BUILD-SPEC.md).
// kernel_digest_at_authoring: sha256:ebbb6f4037561bc965add6110991854f0ebdb2fe8f9e73b011486ff577dcbd36
// human_sign_off: PENDING
//
// SCOPE: floor tier only, NOT a proof, NOT Dafny. float_sensitive: NO (all money math is
// integer cents, no continuous thresholds). Zero external dependencies — pure Node built-ins
// only (mulberry32 PRNG, hand-rolled synthetic journal-text generator).
//
// Checks: fixture-oracle gate, determinism, balanced-journal never flagged imbalanced,
// deliberately-imbalanced journal always flagged with the exact injected delta, output-shape
// (no NaN/undefined anywhere in output_payload).
//
// Run: node chaingraph/kernels/__proptests__/art-653-pta-verifier.proptest.mjs

import { compute } from '../art-653-pta-verifier.kernel.mjs';
import { runFixtureOracle, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-653-pta-verifier';

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x653A11);
function randInt(rng, lo, hi) { return Math.floor(lo + rng() * (hi - lo + 1)); }

function centsToStr(cents) {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const s = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
  return neg ? `-${s}` : s;
}

// Builds a synthetic journal of `n` two-posting transactions, all balanced by construction
// (posting[1] = -posting[0]), each optionally perturbed by `deltaCents` on ONE transaction.
function buildJournal(rng, n, imbalanceTxnIndex = -1, deltaCents = 0) {
  const lines = [];
  for (let i = 0; i < n; i++) {
    const amt = randInt(rng, 1, 500000); // 0.01 .. 5000.00
    let second = -amt;
    if (i === imbalanceTxnIndex) second += deltaCents;
    lines.push(`2026-01-${String((i % 27) + 1).padStart(2, '0')} Txn ${i}`);
    lines.push(`    Assets:Cash${i % 3}           ${centsToStr(amt)}`);
    lines.push(`    Expenses:Cat${i % 5}          ${centsToStr(second)}`);
    lines.push('');
  }
  return lines.join('\n');
}

function findShapeViolations(value, path = '$') {
  const violations = [];
  if (value === undefined) { violations.push(`${path}: undefined`); return violations; }
  if (typeof value === 'number' && !Number.isFinite(value)) { violations.push(`${path}: non-finite (${value})`); return violations; }
  if (Array.isArray(value)) {
    value.forEach((v, i) => violations.push(...findShapeViolations(v, `${path}[${i}]`)));
  } else if (value !== null && typeof value === 'object') {
    for (const k of Object.keys(value)) violations.push(...findShapeViolations(value[k], `${path}.${k}`));
  }
  return violations;
}

const TRIALS = 500;

// ---------- P1: determinism — same policy_parameters -> byte-identical output_payload ----------
function checkP1_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = randInt(rand, 0, 10);
    const journal_text = buildJournal(rand, n);
    const pp = { journal_text };
    const a = JSON.stringify(compute(pp).output_payload);
    const b = JSON.stringify(compute(pp).output_payload);
    checked++;
    if (a !== b) violations++;
  }
  return { name: 'P1_determinism', checked, violations };
}

// ---------- P2: balanced-by-construction journals never flag an imbalance ----------
function checkP2_balanced_never_flagged() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = randInt(rand, 1, 12);
    const journal_text = buildJournal(rand, n);
    const { output_payload } = compute({ journal_text });
    checked++;
    if (output_payload.imbalanced_transactions.length !== 0) violations++;
    if (output_payload.balanced_transaction_count !== n) violations++;
    if (output_payload.evidence_envelope.result_status !== 'success') violations++;
  }
  return { name: 'P2_balanced_journal_never_flagged', checked, violations };
}

// ---------- P3: a deliberately-perturbed transaction is always caught with the exact delta ----------
function checkP3_imbalance_detected_exactly() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = randInt(rand, 1, 10);
    const badIdx = randInt(rand, 0, n - 1);
    const delta = randInt(rand, 1, 9999) * (rand() < 0.5 ? -1 : 1);
    const journal_text = buildJournal(rand, n, badIdx, delta);
    const { output_payload } = compute({ journal_text });
    checked++;
    if (output_payload.imbalanced_transactions.length !== 1) { violations++; continue; }
    const found = output_payload.imbalanced_transactions[0];
    if (found.index !== badIdx) violations++;
    if (found.imbalance_cents !== delta) violations++;
    if (output_payload.balanced_transaction_count !== n - 1) violations++;
    if (output_payload.evidence_envelope.result_status !== 'error') violations++;
  }
  return { name: 'P3_imbalance_detected_with_exact_delta', checked, violations };
}

// ---------- P4: output shape — no NaN/undefined anywhere in output_payload ----------
function checkP4_output_shape() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = randInt(rand, 0, 8);
    const badIdx = rand() < 0.5 ? randInt(rand, 0, Math.max(0, n - 1)) : -1;
    const delta = randInt(rand, -5000, 5000);
    const journal_text = buildJournal(rand, n, badIdx, delta) + '\nrogue directive line\n';
    const { output_payload } = compute({ journal_text });
    checked++;
    if (findShapeViolations(output_payload).length > 0) violations++;
  }
  return { name: 'P4_output_shape_no_nan_undefined', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1_determinism(),
  checkP2_balanced_never_flagged(),
  checkP3_imbalance_detected_exactly(),
  checkP4_output_shape(),
];
console.log(`[${KERNEL_ID}] class-K floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
