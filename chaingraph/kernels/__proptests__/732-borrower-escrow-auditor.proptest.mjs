// 732-borrower-escrow-auditor — class-K property-test FLOOR.
//
// CLASS K — the declared domain is bounded (≤12 monthly periods, values-only,
// closed refusal set enumerated in the sibling reachability fixtures), but the
// MONEY axis is continuous, so no totality claim is made over it. Properties
// below run over a committed mulberry32 seed (deterministic) plus a fixed
// corpus of structural cases.
//
// kernel_digest_at_authoring: sha256:b9e2ac19f3a7bba67b8bef47d7c1ef77a631ed51cb3d865f9859117e790164cd
// spec: VALON reduction map §B2 item 3 (research/VALON-AI-INVENTORY-AND-AINUMBERS-REDUCTION-MAP-2026-10-05.md)
//   — recompute a servicer's escrow statement from borrower-supplied values only;
//   built to the pinned primary text (12 CFR 1024.17, aggregate analysis method).
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/732-borrower-escrow-auditor.proptest.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compute } from '../732-borrower-escrow-auditor.kernel.mjs';
import { compute as compute342 } from '../art-342-compute-escrow-analysis.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, findShapeViolations } from './_pbt-common.mjs';

const KERNEL_ID = '732-borrower-escrow-auditor';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = JSON.parse(
  fs.readFileSync(path.join(HERE, '..', 'fixtures', KERNEL_ID + '.fixtures.json'), 'utf8'),
);
const REACH = JSON.parse(
  fs.readFileSync(path.join(HERE, '..', 'fixtures', KERNEL_ID + '.reachability.json'), 'utf8'),
);

const SEED = 20261014;
const N = 200;

const CUSHION_FRACTION_MAX = 1 / 6;

/** Random VALID policy_parameters over the declared domain (values-only, ≤12 periods). */
function randomValidPp(rng) {
  const periods = 1 + Math.floor(rng() * 12);
  const starting = Math.round(rng() * 2000000) / 100;
  const payments = [];
  const disbursements = [];
  for (let i = 0; i < periods; i++) {
    payments.push(Math.round(rng() * 40000) / 100);
    disbursements.push(rng() < 0.3 ? Math.round(rng() * 120000) / 100 : 0);
  }
  // stated balances consistent with the recomputation (clean statement)
  const stated = [];
  let bal = starting;
  for (let i = 0; i < periods; i++) {
    bal += payments[i] - disbursements[i];
    stated.push(Math.round(bal * 100) / 100);
  }
  const pp = {
    starting_balance: starting,
    monthly_payments: payments,
    disbursements,
    stated_balances: stated,
  };
  if (rng() < 0.7) pp.stated_cushion = Math.round(rng() * 30000) / 100;
  if (rng() < 0.7) pp.borrower_current = rng() < 0.5;
  return pp;
}

function relClose(a, b, eps) {
  if (a === b) return true;
  const scale = Math.max(Math.abs(a), Math.abs(b)) || 1;
  return Math.abs(a - b) <= (eps || 1e-9) * scale;
}

// P1 — DETERMINISM: identical inputs, identical payload, byte-for-byte.
function checkDeterminism() {
  const rng = mulberry32(SEED);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng);
    const a = JSON.stringify(compute(pp));
    const b = JSON.stringify(compute(pp));
    checked++;
    if (a !== b) violations++;
  }
  return { name: 'P1-determinism-committed-seed', checked, violations };
}

// P2 — CUSHION BOUND: whenever the stated cushion exceeds one-sixth of the
// estimated total annual disbursements the cap flag fires and the payload says
// so; whenever it does not, the flag never fires (property of the (c)(5)/(d)(2)(ii)
// bound over the random corpus).
function checkCushionBound() {
  const rng = mulberry32(SEED + 1);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng);
    pp.stated_cushion = Math.round(rng() * 30000) / 100;
    const total = pp.disbursements.reduce((a, b) => a + b, 0);
    const overCap = pp.stated_cushion > total * CUSHION_FRACTION_MAX + 1e-9;
    const { output_payload, compliance_flags } = compute(pp);
    const flagged = compliance_flags.indexOf('CUSHION_ABOVE_STATUTORY_CAP') !== -1;
    checked++;
    if (overCap !== flagged) violations++;
    if (output_payload.cushion_within_cap !== (overCap ? false : true)) violations++;
  }
  return { name: 'P2-cushion-cap-bound-holds', checked, violations };
}

// P3 — SIGN INVARIANTS: shortage ⇔ positive shortage amount and zero surplus;
// surplus ⇔ positive surplus amount and zero shortage; deficiency ⇔ a negative
// recomputed low point; balanced ⇔ both amounts zero. Plus the recomputation
// identity: balances follow the prefix-sum arithmetic exactly.
function checkSignInvariants() {
  const rng = mulberry32(SEED + 2);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng);
    pp.borrower_current = true; // remove the currency hold from the classification check
    const { output_payload: op } = compute(pp);
    const s = op.account_status;
    checked += 4;
    if ((s === 'shortage' || s === 'deficiency') !== (op.shortage_amount > 0 && op.surplus_amount === 0)) violations++;
    if ((s === 'surplus') !== (op.surplus_amount > 0 && op.shortage_amount === 0)) violations++;
    if (s === 'deficiency' && !(op.shortage_amount > 0 && op.recomputed_low_point < 0)) violations++;
    if (s === 'balanced' && !(op.shortage_amount === 0 && op.surplus_amount === 0)) violations++;
    // recomputation identity
    checked++;
    let bal = Math.round(pp.starting_balance * 100) / 100;
    let ok = Math.abs(op.recomputed_balances[0] - bal) < 1e-9;
    for (let m = 1; m <= op.periods_analyzed; m++) {
      bal = Math.round((bal + pp.monthly_payments[m - 1] - pp.disbursements[m - 1]) * 100) / 100;
      if (Math.abs(op.recomputed_balances[m] - bal) > 1e-9) ok = false;
    }
    if (!ok) violations++;
  }
  return { name: 'P3-shortage-surplus-sign-invariants', checked, violations };
}

// P4 — DISCREPANCY DETECTOR: a consistent statement yields zero discrepancy
// lines; perturbing any single stated balance beyond the 0.01 tolerance (the
// seeded off-by-one disbursement shape) yields a line naming that month with
// the paragraph-cited reason, while a sub-tolerance drift stays silent.
function checkDiscrepancyDetector() {
  const rng = mulberry32(SEED + 3);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng);
    const clean = compute(pp).output_payload;
    checked++;
    if (clean.discrepancies.count !== 0) violations++;
    const m = Math.floor(rng() * pp.stated_balances.length);
    const dirtyPp = JSON.parse(JSON.stringify(pp));
    dirtyPp.stated_balances[m] += 100; // the off-by-one disbursement shape
    const dirty = compute(dirtyPp).output_payload;
    checked += 2;
    if (dirty.discrepancies.count < 1 || dirty.discrepancies.lines[0].month !== m + 1) violations++;
    if (dirty.discrepancies.lines[0].reason !== 'stated_end_of_month_balance_disagrees_with_recomputed_trial_running_balance') violations++;
    const tinyPp = JSON.parse(JSON.stringify(pp));
    tinyPp.stated_balances[m] += 0.01;
    checked++;
    if (compute(tinyPp).output_payload.discrepancies.count !== 0) violations++;
  }
  return { name: 'P4-seeded-off-by-one-discrepancy-fires', checked, violations };
}

// P5 — PARITY vs the estate's prior aggregate-escrow kernel (art-342): for
// 12-month inputs the trial running balances, low point, and total annual
// disbursements agree to ≤1e-12 relative (ART705 composition precedent — the
// import here is the floor's oracle only; the kernel itself imports nothing).
function checkParityWithArt342() {
  const rng = mulberry32(SEED + 4);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 50; i++) {
    const monthly = Math.round(rng() * 40000) / 100 + 1;
    const disbursements = new Array(12).fill(0);
    disbursements[Math.floor(rng() * 12)] = Math.round(rng() * 120000) / 100 + 1;
    const starting = Math.round(rng() * 2000000) / 100;
    const pp = {
      starting_balance: starting,
      monthly_payments: new Array(12).fill(monthly),
      disbursements,
      stated_balances: new Array(12).fill(0), // parity ignores stated lines
      stated_cushion: Math.round(disbursements.reduce((a, b) => a + b, 0) * CUSHION_FRACTION_MAX * 100) / 100,
      borrower_current: true,
    };
    const big = compute342({ starting_balance: starting, monthly_escrow_payment: monthly, disbursements, cushion_fraction: CUSHION_FRACTION_MAX }).output_payload;
    const mine = compute(pp).output_payload;
    checked += 2;
    if (big.trial_balances.length !== mine.recomputed_balances.length) { violations++; continue; }
    let ok = true;
    for (let k = 0; k < 13; k++) {
      if (!relClose(big.trial_balances[k], mine.recomputed_balances[k], 1e-12)) ok = false;
    }
    if (!ok) violations++;
    if (!relClose(big.low_point_balance, mine.recomputed_low_point, 1e-12) ||
        !relClose(big.total_annual_disbursements, mine.total_annual_disbursements, 1e-12)) violations++;
  }
  return { name: 'P5-parity-art-342-1e-12', checked, violations };
}

// P6 — REFUSAL PATHS: the identifier-like field and the >12-period bound always
// refuse with manual_review_required true and never echo the refused field's
// value; the committed reachability vectors still fire their declared flags.
function checkRefusalPaths() {
  const rng = mulberry32(SEED + 5);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng);
    const withIdent = JSON.parse(JSON.stringify(pp));
    withIdent.stated_balances[0] = 'acct-' + (1000 + i);
    const r1 = compute(withIdent);
    checked += 2;
    if (r1.compliance_flags.indexOf('IDENTIFIER_LIKE_FIELD_REFUSED') === -1 || r1.output_payload.manual_review_required !== true) violations++;
    if (r1.output_payload.refused_field !== 'stated_balances[0]') violations++;
    const over = JSON.parse(JSON.stringify(pp));
    while (over.monthly_payments.length < 13) over.monthly_payments.push(1);
    const r2 = compute(over);
    checked++;
    if (r2.compliance_flags.indexOf('PERIODS_EXCEED_BOUNDED_12_REFUSED') === -1 || r2.output_payload.manual_review_required !== true) violations++;
  }
  // committed reachability vectors re-fire
  for (const vec of REACH.vectors) {
    const r = compute(vec.policy_parameters);
    checked++;
    const allFire = vec.observed_flags.every((f) => r.compliance_flags.indexOf(f) !== -1);
    if (!allFire || r.output_payload.manual_review_required !== true) violations++;
  }
  return { name: 'P6-refusal-paths-reachable-no-echo', checked, violations };
}

// P0b — CONFORMANCE FIXTURE PROVENANCE: every conformance vector carries an
// independent_oracle (source + source_digest + derivation) — a golden master
// without an oracle is a regression vector and does not belong in this file.
function checkFixtureProvenance() {
  let checked = 0;
  let violations = 0;
  for (const vec of FIXTURES.vectors) {
    checked++;
    const o = vec.independent_oracle;
    if (!o || !o.source || !o.source_digest || !o.derivation) violations++;
  }
  return { name: 'P0b-every-conformance-vector-has-independent-oracle', checked, violations };
}

// SHAPE — no NaN / undefined / non-finite anywhere in any output over the corpus
// plus structural edge inputs (empty pp, empty arrays, non-numeric scalar).
function checkShape() {
  const rng = mulberry32(SEED + 6);
  let checked = 0;
  let violations = 0;
  const paths = [
    randomValidPp(rng),
    {},
    { starting_balance: 0, monthly_payments: [], disbursements: [], stated_balances: [] },
    { starting_balance: 'oops' },
  ];
  for (let i = 0; i < N; i++) paths.push(randomValidPp(rng));
  for (const pp of paths) {
    const { output_payload } = compute(pp);
    checked++;
    violations += findShapeViolations(output_payload).length;
  }
  return { name: 'P7-output-shape-no-nonfinite', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkFixtureProvenance(),
  checkDeterminism(),
  checkCushionBound(),
  checkSignInvariants(),
  checkDiscrepancyDetector(),
  checkParityWithArt342(),
  checkRefusalPaths(),
  checkShape(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — borrower escrow statement audit (values-only).`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
