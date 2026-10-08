// autofix-selftest-alpha.proptest.mjs — class-K property-test FLOOR
// (FV-PBT-FLOOR-BUILD-SPEC.md). Authored against the APEXPORT-WF15 porting
// payload (kernel + fixtures + VECTORS/DIFFERS/CITES records, GRADES abc4e16d).
// kernel_digest_at_authoring: sha256:56366d0e4c2c17333b3883c7183babaac09e05f39fdf98828f06bcdc1ae8c377
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof, NOT Dafny. Internal engineering QC only.
// float_sensitive: PARTIAL — the kernel deliberately keeps the Apex tool's float
// USD/percent arithmetic so its outputs match the ported-from page to the digit
// (recorded open question: integer minor units). The properties below therefore
// assert only relations that are exact under IEEE-754 doubling/halving (scaling
// by 2 commutes with rounding) or that are monotone under +delta, never exact
// cent-level equals on arbitrary draws.
//
// Checks: fixture-oracle gate (the manifest example, the seven Apex live vectors
// with statuses/costs/counts pinned, and the 23 boundary pairs at and just past
// every comparator); P1 raising any outcome input never lowers the met/exceeded
// counts, never lowers the 3-year return per dollar, never raises the break-even
// horizon, and never drops the grade tier; P2 doubling the budget exactly doubles
// cost per participant / cost per employed / cost per credential / break-even and
// exactly halves the return per dollar (binade-exact scalings); P3 a null or
// absent participants_exited is byte-identical to participants_exited =
// participants_enrolled; P4 invalid-domain inputs are refused with named reasons
// and the ART712_INPUT_REFUSED flag, never a throw; P5 determinism (two runs
// agree byte-for-byte) and output shape (no undefined/NaN/non-finite anywhere);
// P6 the grade table restated independently: the Excellent/Strong/Moderate
// thresholds fire exactly at return >= {2.0,1.5,1.0} with met >= {4,3,2}, the
// ART712_BELOW_TARGET flag is carried exactly when the grade is Below Target,
// and ART712_NO_TAX_RECAPTURE exactly when annual_tax_recapture === 0.
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/autofix-selftest-alpha.proptest.mjs

import { compute } from '../autofix-selftest-alpha.kernel.mjs';
import { runFixtureOracle, summarize, findShapeViolations, mulberry32, pick } from './_pbt-common.mjs';

const KERNEL_ID = 'autofix-selftest-alpha';
const PROGRAM_TYPES = ['adult', 'dislocated_worker', 'youth'];
const SECTORS = ['healthcare', 'manufacturing', 'construction', 'it_tech', 'retail', 'transportation', 'finance', 'education', 'hospitality', 'professional', 'public_admin', 'other'];
const GRADE_RANK = { 'Below Target': 1, Moderate: 2, Strong: 3, Excellent: 4 };

// ---------- shared random domain (declared-domain inputs only) ----------

function basePP(rng, over = {}) {
  const enrolled = 1 + Math.floor(rng() * 500);
  const rate = () => (rng() < 0.25 ? null : Math.round(rng() * 1000) / 10); // null or 0..100, one decimal
  const pp = {
    program_name: pick(rng, ['Cohort A', 'River Valley Training', '', 'Cohort 12 (evening)']),
    program_type: pick(rng, PROGRAM_TYPES),
    program_year: pick(rng, ['PY 2023', 'PY 2022', 'PY 2021']),
    sector: pick(rng, SECTORS),
    total_budget: 1000 * (1 + Math.floor(rng() * 5000)),
    avg_training_weeks: rng() < 0.2 ? null : 1 + Math.floor(rng() * 104),
    participants_enrolled: enrolled,
    participants_exited: rng() < 0.3 ? null : Math.floor(rng() * (enrolled + 1)),
    emp_rate_q2: rate(),
    emp_rate_q4: rate(),
    median_earnings_q2: rng() < 0.25 ? null : Math.round(rng() * 60000 * 100) / 100,
    credential_rate: rate(),
    skill_gains_rate: rate(),
    ...over,
  };
  return pp;
}

// P1: raising any outcome input is weakly improving — met/exceeded counts never
// fall, the 3-year return per dollar never falls, the break-even horizon never
// lengthens (null counts as no horizon yet), and the grade tier never drops.
function checkOutcomeMonotonicity() {
  const rng = mulberry32(712001);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 120; i++) {
    const pp = basePP(rng);
    const keys = ['emp_rate_q2', 'emp_rate_q4', 'median_earnings_q2', 'credential_rate', 'skill_gains_rate'];
    const k = keys[Math.floor(rng() * keys.length)];
    const before = compute(pp).output_payload;
    const raise = k === 'median_earnings_q2' ? 100 + Math.floor(rng() * 5000) : 0.5 + Math.floor(rng() * 40) / 10;
    const raised = { ...pp, [k]: (pp[k] === null ? 0 : pp[k]) + raise };
    if (raised[k] > 100 && k !== 'median_earnings_q2') raised[k] = 100;
    const after = compute(raised).output_payload;
    checked += 4;
    if (after.indicators_met < before.indicators_met) violations++;
    if (after.indicators_exceeded < before.indicators_exceeded) violations++;
    if (before.return_per_dollar_3yr !== null && after.return_per_dollar_3yr === null) violations++;
    else if (before.return_per_dollar_3yr !== null && after.return_per_dollar_3yr < before.return_per_dollar_3yr) violations++;
    const bBE = before.breakeven_months === null ? Infinity : before.breakeven_months;
    const aBE = after.breakeven_months === null ? Infinity : after.breakeven_months;
    if (aBE > bBE) violations++;
    checked++;
    const bRank = GRADE_RANK[before.grade] ?? 0;
    const aRank = GRADE_RANK[after.grade] ?? 0;
    if (aRank < bRank) violations++;
  }
  return { name: 'P1 raising an outcome never lowers met/exceeded, return, or the grade tier, and never lengthens break-even', checked, violations };
}

// P2: doubling the budget exactly doubles the per-participant/employed/credential
// costs and the break-even horizon, and exactly halves the return per dollar —
// all binade-exact scalings (multiplication/division by 2 commutes with IEEE-754
// rounding), asserted with == where the value is defined on both sides.
function checkBudgetScaling() {
  const rng = mulberry32(712002);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 80; i++) {
    const pp = basePP(rng, { participants_exited: null });
    const b = compute(pp).output_payload;
    const d = compute({ ...pp, total_budget: pp.total_budget * 2 }).output_payload;
    const pairs = [
      [b.cost_per_participant, d.cost_per_participant, (x) => x * 2],
      [b.return_per_dollar_3yr, d.return_per_dollar_3yr, (x) => x / 2],
      [b.cost_per_employed_q2, d.cost_per_employed_q2, (x) => x * 2],
      [b.cost_per_credential, d.cost_per_credential, (x) => x * 2],
      [b.breakeven_months, d.breakeven_months, (x) => x * 2],
    ];
    for (const [vb, vd, f] of pairs) {
      if (vb === null || vd === null) continue;
      checked++;
      if (vd !== f(vb)) violations++;
    }
    checked++;
    if (b.sector_baseline_annual !== d.sector_baseline_annual) violations++;
  }
  return { name: 'P2 doubling the budget exactly doubles unit costs and break-even and halves the return per dollar', checked, violations };
}

// P3: a null or absent participants_exited computes with exited = enrolled, and
// the whole payload is byte-identical to passing participants_exited = enrolled.
function checkExitedDefault() {
  const rng = mulberry32(712003);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 60; i++) {
    const pp = basePP(rng, { participants_exited: null });
    const r1 = compute(pp);
    const r2 = compute({ ...pp, participants_exited: pp.participants_enrolled });
    const r3 = compute({ ...pp, participants_exited: undefined });
    checked += 2;
    if (JSON.stringify(r1) !== JSON.stringify(r2)) violations++;
    if (JSON.stringify(r1) !== JSON.stringify(r3)) violations++;
    checked++;
    if (r1.output_payload.participants_exited !== pp.participants_enrolled) violations++;
  }
  return { name: 'P3 null/absent participants_exited defaults to participants_enrolled byte-identically', checked, violations };
}

// P4: invalid-domain inputs are refused with a named reason and the input flag,
// never a throw.
function checkRefusals() {
  let checked = 0;
  let violations = 0;
  const good = basePP(mulberry32(712013), { participants_exited: 50 });
  const bad = /** @type {{ key: string, value: unknown }[]} */ ([
    { key: 'program_type', value: null }, { key: 'program_type', value: 'senior' }, { key: 'program_type', value: '' },
    { key: 'program_type', value: 42 }, { key: 'program_type', value: undefined },
    { key: 'sector', value: null }, { key: 'sector', value: 'aerospace' }, { key: 'sector', value: '' }, { key: 'sector', value: 7 },
    { key: 'total_budget', value: null }, { key: 'total_budget', value: 0 }, { key: 'total_budget', value: -1000 },
    { key: 'total_budget', value: '500000' }, { key: 'total_budget', value: Infinity }, { key: 'total_budget', value: NaN },
    { key: 'participants_enrolled', value: null }, { key: 'participants_enrolled', value: 0 }, { key: 'participants_enrolled', value: -5 },
    // NB (graded contract, inherited from the Apex page's own validation): people
    // counts are validated as NUMBERS >= {1, 0}, not integers — a fractional
    // count is accepted, so it is NOT in the refused set below.
    { key: 'participants_exited', value: -1 }, { key: 'participants_exited', value: '120' },
    { key: 'emp_rate_q2', value: -0.1 }, { key: 'emp_rate_q2', value: 100.1 }, { key: 'emp_rate_q2', value: '76' }, { key: 'emp_rate_q2', value: Infinity },
    { key: 'emp_rate_q4', value: -1 }, { key: 'emp_rate_q4', value: 101 },
    { key: 'credential_rate', value: -3 }, { key: 'credential_rate', value: 200 },
    { key: 'skill_gains_rate', value: -0.5 }, { key: 'skill_gains_rate', value: '56' },
    { key: 'median_earnings_q2', value: -1 }, { key: 'median_earnings_q2', value: '6200' },
  ]);
  for (const { key, value } of bad) {
    const r = compute({ ...good, [key]: value });
    checked++;
    if (r.compliance_flags[0] !== 'ART712_INPUT_REFUSED') violations++;
    if (!r.output_payload.refusal_reason || !String(r.output_payload.refusal_reason).startsWith('REFUSED_')) violations++;
    if (!Array.isArray(r.output_payload.domain_errors) || r.output_payload.domain_errors.length !== 1) violations++;
  }
  const noInput = [null, undefined, 'x', 42, []];
  for (const v of noInput) {
    const r = compute(v);
    checked++;
    if (r.compliance_flags[0] !== 'ART712_INPUT_REFUSED') violations++;
    if (!r.output_payload.refusal_reason) violations++;
  }
  return { name: 'P4 invalid-domain inputs refused with named reasons and ART712_INPUT_REFUSED, never a throw', checked, violations };
}

// P5: compute() is deterministic (two runs agree byte-for-byte) and every payload —
// success and refusal — is free of undefined/NaN/non-finite values.
function checkDeterminismAndShape() {
  const rng = mulberry32(712005);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 40; i++) {
    const pp = basePP(rng);
    const r1 = compute(pp);
    const r2 = compute(pp);
    checked++;
    if (JSON.stringify(r1) !== JSON.stringify(r2)) violations++;
    checked++;
    if (findShapeViolations(r1.output_payload).length > 0) violations++;
    const refusedRun = compute({ ...pp, sector: 'not-a-sector' });
    checked++;
    if (findShapeViolations(refusedRun.output_payload).length > 0) violations++;
  }
  return { name: 'P5 determinism and output shape: no undefined/NaN/non-finite anywhere', checked, violations };
}

// P6: the grade table restated independently — Excellent at return >= 2.0 with
// met >= 4, Strong at 1.5/3, Moderate at 1.0/2, else Below Target (when ROI
// exists); flag parity for ART712_BELOW_TARGET and ART712_NO_TAX_RECAPTURE.
function checkGradeTable() {
  const rng = mulberry32(712006);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 150; i++) {
    const pp = basePP(rng, { participants_exited: null });
    const { output_payload: op, compliance_flags: flags } = compute(pp);
    const r = op.return_per_dollar_3yr;
    const met = op.indicators_met;
    let want;
    if (r === null) {
      want = op.indicators_scored > 0 ? 'Scored' : 'Pending Data';
    } else if (r >= 2.0 && met >= 4) want = 'Excellent';
    else if (r >= 1.5 && met >= 3) want = 'Strong';
    else if (r >= 1.0 && met >= 2) want = 'Moderate';
    else want = 'Below Target';
    checked++;
    if (op.grade !== want) violations++;
    checked++;
    if (flags.includes('ART712_BELOW_TARGET') !== (op.grade === 'Below Target')) violations++;
    checked++;
    if (flags.includes('ART712_NO_TAX_RECAPTURE') !== (op.annual_tax_recapture === 0)) violations++;
    checked++;
    if (op.indicators_met !== op.benchmarks.filter((b) => b.status === 'exceeds' || b.status === 'meets').length) violations++;
  }
  return { name: 'P6 grade table, flag parity and met-count recomputation match an independent restatement', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkOutcomeMonotonicity(),
  checkBudgetScaling(),
  checkExitedDefault(),
  checkRefusals(),
  checkDeterminismAndShape(),
  checkGradeTable(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — 31-vector fixture oracle + P1..P6.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
