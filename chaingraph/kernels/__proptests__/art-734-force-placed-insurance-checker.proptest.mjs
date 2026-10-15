// art-734-force-placed-insurance-checker — class-K property-test FLOOR.
//
// CLASS K — the declared domain is bounded (fixed 45/30/15-day calendar-day
// offsets, closed refusal set enumerated in the sibling reachability fixtures,
// closed mail-class and content-item enums), but the DATE and AMOUNT axes are
// continuous, so no totality claim is made over them. Properties below run over
// a committed mulberry32 seed (deterministic) plus a fixed corpus of structural
// cases.
//
// kernel_digest_at_authoring: sha256:7577f417eecdbf8bca1781682330a4f8fd645c4692ddd0cbfbdf3974c3db9146
// spec: VALON reduction map §B2 item 4 (research/VALON-AI-INVENTORY-AND-AINUMBERS-REDUCTION-MAP-2026-10-05.md)
//   — lender-placed insurance notice-sequence checker built to the pinned
//   primary text (12 CFR 1024.37(b)-(h); SERVICING-CLAUSE-SNAPSHOT-1). The
//   benchmark is values-only: the kernel never labels a premium reasonable or
//   unreasonable, and P5 asserts that.
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-734-force-placed-insurance-checker.proptest.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compute } from '../art-734-force-placed-insurance-checker.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, findShapeViolations } from './_pbt-common.mjs';

const KERNEL_ID = 'art-734-force-placed-insurance-checker';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = JSON.parse(
  fs.readFileSync(path.join(HERE, '..', 'fixtures', KERNEL_ID + '.fixtures.json'), 'utf8'),
);
const REACH = JSON.parse(
  fs.readFileSync(path.join(HERE, '..', 'fixtures', KERNEL_ID + '.reachability.json'), 'utf8'),
);

const SEED = 20261014;
const N = 200;

// ---- independent oracle: Date-object civil-day engine (deliberately a
// different calendar engine from the kernel's Rata Die day-count arithmetic).
const DAY = 86400000;
function isoToMs(s) { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); }
function msToIso(ms) { return new Date(ms).toISOString().slice(0, 10); }
function addDays(iso, n) { return msToIso(isoToMs(iso) + n * DAY); }
function gapDays(a, b) { return Math.round((isoToMs(b) - isoToMs(a)) / DAY); }
// inclusive overlap of two closed ISO date intervals
function overlapInclusive(aS, aE, bS, bE) {
  const s = isoToMs(aS) > isoToMs(bS) ? aS : bS;
  const e = isoToMs(aE) < isoToMs(bE) ? aE : bE;
  if (isoToMs(e) < isoToMs(s)) return 0;
  return gapDays(s, e) + 1;
}
const r2 = (x) => Math.round(x * 100) / 100;

/** Random ISO date in 2026 (fixed year keeps the corpus in one calendar shape). */
function randomIso2026(rng) {
  const month = 1 + Math.floor(rng() * 12);
  const day = 1 + Math.floor(rng() * 28);
  const p = (n) => (n < 10 ? '0' + n : String(n));
  return '2026-' + p(month) + '-' + p(day);
}

/** Random VALID sequence: reminder 30-80 days after first, charge 15-60 days after reminder. */
function randomValidPp(rng) {
  const first = randomIso2026(rng);
  const reminder = addDays(first, 30 + Math.floor(rng() * 51));
  const charge = addDays(reminder, 15 + Math.floor(rng() * 46));
  const pp = {
    first_notice_date: first,
    reminder_notice_date: reminder,
    charge_date: charge,
    charged_premium_amount: r2(200 + rng() * 2000),
    charge_coverage_start: charge,
    charge_coverage_end: addDays(charge, 364),
  };
  if (rng() < 0.5) pp.alternative_quote_amount = r2(100 + rng() * 2500);
  return pp;
}

const SEQUENCE_ELEMENTS = [
  'first_notice_45_day_advance',
  'reminder_15_days_before_charge',
  'reminder_30_days_after_first_notice',
  'no_continuous_coverage_evidence_before_charge',
];

function elementStates(out) {
  const m = {};
  for (const e of out.elements) {
    if (SEQUENCE_ELEMENTS.indexOf(e.element_id) === -1) continue;
    m[e.element_id] = e.state;
  }
  return m;
}

// P0 — FIXTURE PROVENANCE: every conformance vector carries an independent
// oracle with a derivation note; every reachability vector is kernel_generated
// and names its refusal.
function checkFixtureProvenance() {
  let checked = 0; let violations = 0;
  for (const v of FIXTURES.vectors) {
    checked++;
    const o = v.independent_oracle;
    if (!o || typeof o.derivation !== 'string' || o.derivation.length < 20 || !o.expect) violations++;
  }
  for (const v of REACH.vectors) {
    checked++;
    if (v.provenance !== 'kernel_generated' || !v.observed || !v.observed_flags || !Array.isArray(v.observed_flags)) violations++;
  }
  return { name: 'P0-fixture-provenance-independent-oracle', checked, violations };
}

// P1 — DETERMINISM: identical inputs, identical payload, byte-for-byte.
function checkDeterminism() {
  const rng = mulberry32(SEED);
  let checked = 0; let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng);
    const a = JSON.stringify(compute(pp));
    const b = JSON.stringify(compute(pp));
    checked++;
    if (a !== b) violations++;
  }
  return { name: 'P1-determinism-committed-seed', checked, violations };
}

// P2 — ORACLE PARITY: every element state matches an independent Date-object
// recomputation over random valid sequences.
function checkDateOracleParity() {
  const rng = mulberry32(SEED + 1);
  let checked = 0; let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng);
    const { output_payload: out } = compute(pp);
    const st = elementStates(out);
    const g1 = gapDays(pp.first_notice_date, pp.charge_date);
    const g2 = gapDays(pp.reminder_notice_date, pp.charge_date);
    const g3 = gapDays(pp.first_notice_date, pp.reminder_notice_date);
    checked += 3;
    if (st.first_notice_45_day_advance !== (g1 >= 45 ? 'met' : 'breached')) violations++;
    if (st.reminder_15_days_before_charge !== (g2 >= 15 ? 'met' : 'breached')) violations++;
    if (st.reminder_30_days_after_first_notice !== (g3 >= 30 ? 'met' : 'breached')) violations++;
    checked++;
    if (out.charge_summary.charged_premium_amount !== pp.charged_premium_amount) violations++;
  }
  return { name: 'P2-date-oracle-parity-sequence-elements', checked, violations };
}

// P3 — REFUND MONOTONICITY: extending borrower coverage (larger overlap) never
// decreases the pro-rata refund owed, owed tracks the independent overlap
// recomputation, and owed never exceeds the charged premium.
function checkRefundMonotonic() {
  const rng = mulberry32(SEED + 2);
  let checked = 0; let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng);
    const evidence = addDays(pp.charge_date, 1 + Math.floor(rng() * 30));
    const base = {
      ...pp,
      evidence_of_continuous_coverage_date: evidence,
      borrower_coverage_start: addDays(pp.charge_coverage_start, -Math.floor(rng() * 40)),
      borrower_coverage_end: addDays(pp.charge_coverage_start, 10),
    };
    let prev = -1;
    for (let k = 0; k <= 12; k++) {
      const p2 = { ...base, borrower_coverage_end: addDays(base.borrower_coverage_end, k * 30) };
      const { output_payload: out } = compute(p2);
      const re = out.refund_evaluation;
      checked++;
      if (!re || typeof re.pro_rata_refund_owed !== 'number') { violations++; continue; }
      const overlap = overlapInclusive(p2.charge_coverage_start, p2.charge_coverage_end, p2.borrower_coverage_start, p2.borrower_coverage_end);
      const want = r2((p2.charged_premium_amount * overlap) / (gapDays(p2.charge_coverage_start, p2.charge_coverage_end) + 1));
      if (re.pro_rata_refund_owed !== want) violations++;
      if (re.pro_rata_refund_owed < prev - 1e-9) violations++;
      if (re.pro_rata_refund_owed > p2.charged_premium_amount + 0.01) violations++;
      prev = re.pro_rata_refund_owed;
    }
  }
  return { name: 'P3-refund-monotonic-in-coverage-overlap', checked, violations };
}

// P4 — REFUND DEADLINE: the refund due date is always exactly evidence + 15
// calendar days (independent Date oracle).
function checkRefundDeadline() {
  const rng = mulberry32(SEED + 3);
  let checked = 0; let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng);
    const evidence = addDays(pp.charge_date, 1 + Math.floor(rng() * 40));
    const p2 = {
      ...pp,
      evidence_of_continuous_coverage_date: evidence,
      borrower_coverage_start: pp.charge_coverage_start,
      borrower_coverage_end: addDays(pp.charge_coverage_start, 100),
    };
    const { output_payload: out } = compute(p2);
    checked++;
    if (out.refund_evaluation.refund_due_date !== addDays(evidence, 15)) violations++;
    if (out.refund_evaluation.days_allowed !== 15) violations++;
  }
  return { name: 'P4-refund-deadline-evidence-plus-15', checked, violations };
}

// P5 — VALUES-ONLY: a missing alternative quote yields a benchmark refusal and
// NO output string ever labels the premium reasonable or unreasonable; the
// sequence verdict is NOT flipped by a missing quote.
function checkValuesOnlyNeverJudges() {
  const rng = mulberry32(SEED + 4);
  let checked = 0; let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng);
    delete pp.alternative_quote_amount;
    const { output_payload: out } = compute(pp);
    const s = JSON.stringify(out);
    checked++;
    const bench = out.elements.find((e) => e.element_id === 'premium_benchmark');
    if (!bench || bench.state !== 'refused' || bench.refused_because !== 'alternative_quote_missing') violations++;
    // no reasonableness JUDGEMENT field may exist (the values_only note that
    // says the node never labels is the disclaimer, not a label)
    if (/"is_reasonable"|"reasonableness"|"reasonableness_verdict"|"premium_assessment"|"benchmark_verdict"/i.test(s)) violations++;
    if (out.verdict !== 'compliant') violations++;
  }
  return { name: 'P5-values-only-no-reasonableness-label', checked, violations };
}

// P6 — OPTIONAL-INPUT INVARIANCE: sequence element verdicts are invariant to
// the presence of non-triggering optional inputs (content checklist, mail
// class, quote, refund values), and to the key order of the input object.
function checkNonTriggeringInvariance() {
  const rng = mulberry32(SEED + 5);
  let checked = 0; let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng);
    const base = compute(pp);
    const baseStates = JSON.stringify(elementStates(base.output_payload));
    const withExtras = compute({
      ...pp,
      first_notice_content_items: ['c2_i', 'c2_iv', 'c2_xi'],
      notice_mail_class: 'certified',
      alternative_quote_amount: 1,
      cancellation_date: pp.charge_date,
      refund_date: pp.charge_date,
      refund_amount: 0,
      evidence_of_continuous_coverage_date: addDays(pp.charge_date, 50),
      borrower_coverage_start: pp.charge_coverage_start,
      borrower_coverage_end: addDays(pp.charge_coverage_start, 5),
    });
    checked++;
    if (JSON.stringify(elementStates(withExtras.output_payload)) !== baseStates) violations++;
    // key order of optional inputs must not matter
    const reordered = {};
    const keys = Object.keys(pp).reverse();
    for (const k of keys) reordered[k] = pp[k];
    checked++;
    if (JSON.stringify(compute(reordered)) !== JSON.stringify(base)) violations++;
  }
  return { name: 'P6-sequence-verdicts-invariant-to-non-triggering-inputs', checked, violations };
}

// P7 — PRO-RATA LINEARITY: doubling the charged premium exactly doubles the
// refund owed (2-decimal rounding tolerance).
function checkLinearity() {
  const rng = mulberry32(SEED + 7);
  let checked = 0; let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng);
    const evidence = addDays(pp.charge_date, 5);
    const base = {
      ...pp,
      evidence_of_continuous_coverage_date: evidence,
      borrower_coverage_start: addDays(pp.charge_coverage_start, 3),
      borrower_coverage_end: addDays(pp.charge_coverage_start, 93),
    };
    const a = compute(base).output_payload.refund_evaluation.pro_rata_refund_owed;
    const b = compute({ ...base, charged_premium_amount: base.charged_premium_amount * 2 })
      .output_payload.refund_evaluation.pro_rata_refund_owed;
    checked++;
    if (Math.abs(b - 2 * a) > 0.02) violations++;
  }
  return { name: 'P7-pro-rata-linear-in-charged-premium', checked, violations };
}

// P8 — SHAPE: no NaN / undefined / non-finite anywhere in any output over the
// corpus plus structural edge inputs (empty pp, every declared refusal).
function checkShape() {
  const rng = mulberry32(SEED + 8);
  let checked = 0; let violations = 0;
  const paths = [randomValidPp(rng), {}, ...REACH.vectors.map((v) => v.policy_parameters)];
  for (let i = 0; i < N; i++) paths.push(randomValidPp(rng));
  for (const pp of paths) {
    const { output_payload } = compute(pp);
    checked++;
    violations += findShapeViolations(output_payload).length;
  }
  return { name: 'P8-output-shape-no-nonfinite', checked, violations };
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
  checkDateOracleParity(),
  checkRefundMonotonic(),
  checkRefundDeadline(),
  checkValuesOnlyNeverJudges(),
  checkNonTriggeringInvariance(),
  checkLinearity(),
  checkShape(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — force-placed insurance notice sequence (notice dates + values, values-only benchmark).`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
