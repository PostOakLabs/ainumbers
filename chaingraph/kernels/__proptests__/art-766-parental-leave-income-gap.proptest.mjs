// art-766-parental-leave-income-gap.proptest.mjs — class-K property-test FLOOR
// (FV-PBT-FLOOR-BUILD-SPEC.md). Authored against the APEXPORT-131 porting payload
// (kernel + fixtures + VECTORS/DIFFERS/CITES records, GRADES PASS-PENDING-XV
// 2026-10-18, Builder-verifies-at-land 35/35).
// kernel_digest_at_authoring: sha256:642fe7a90b6c04e356e12226107eb6bc5908c7bc9de161f67f606fc1e69403b6
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof, NOT Dafny. Internal engineering QC only.
// float_sensitive: PARTIAL — the kernel deliberately keeps the Apex page's float
// arithmetic (WEEKS_PER_MONTH literal 4.333, per-week accumulation order) so its
// outputs match the ported-from page to the digit. The properties below assert only
// relations that are exact under IEEE-754 (monotone step rounding, equality on
// already-rounded outputs, restatements of the published formula), never fragile
// float equals on arbitrary draws.
//
// Checks: fixture-oracle gate (32 payload vectors: the 7 Apex live result
// vectors with the full week-by-week schedule pinned, the 21 boundary pairs at and
// just past every comparator — employer-paid C1, partial C2, PFL C3, windfall C4,
// gap C5, shortfall C6, coverage C7, recovery-surplus C8, verdict C9, state cap C12 —
// and the 4 non-throwing falsy-default divergences BF-T1/T2/T6/T7; the 3 refusing
// vectors BF-T3/T4/T5 are message-pinned in P4 instead, see below);
// P1 the week schedule is a pure function of the comparator structure (phase
// boundaries at w <= paid and w <= paid+partial, PFL at w <= pfl_weeks) restated
// independently; P2 the total gap is exactly the sum of |net| over negative-net weeks
// and savings_needed == total_gap (fixture-oracle identity restated on random draws);
// P3 determinism (two runs agree byte-for-byte) and output shape (no undefined/NaN/
// non-finite anywhere in output_payload); P4 invalid-domain inputs are refused by
// throw with a named REFUSED_BAD_* reason for every numeric bound, the integer bound,
// the state_program enum, and non-object pp; P5 the recovery contract: finite
// ceil(savings_needed / surplus_per_month) when surplus > 0, the 999 sentinel with
// ART766_RECOVERY_SENTINEL when surplus == 0, and the verdict mapping restated
// (covered -> positive; else savings > gap/2 -> warn, else danger); P6 the windfall
// and cap diagnostics: state_cap_binds == (gross*rate >= cap) and windfall_capped
// per row == (emp_pay + state_pfl > 1.05 * weekly_net), restated independently.
//
// The kernel's declared out-of-domain contract is THROW (DIFFERS D10 — the Apex page
// silently substituted falsy defaults), so the fixture oracle here is local (the
// art-512 precedent): runFixtureOracle has no throw branch, and vectors with
// `refuses: true` pin the thrown REFUSED_BAD_* message plus a deterministic refusal
// record instead of a computed output_payload.
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-766-parental-leave-income-gap.proptest.mjs

import { compute } from '../art-766-parental-leave-income-gap.kernel.mjs';
import { summarize, mulberry32, findShapeViolations, pick } from './_pbt-common.mjs';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KERNEL_ID = 'art-766-parental-leave-income-gap';
const HERE = dirname(fileURLToPath(import.meta.url));

const basePP = (over = {}) => ({
  base_salary: 85000, tax_rate_pct: 22, monthly_expenses: 6500, partner_income: 4000,
  savings: 20000, employer_paid_weeks: 6, employer_partial_weeks: 2, employer_partial_pct: 60,
  state_program: 'none', state_pfl_weeks: 8, custom_pfl_rate_pct: 60,
  total_leave_weeks: 16, baby_expense: 1200, ...over,
});

const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Local fixture oracle (see header: throw-contract kernels cannot use runFixtureOracle).
function localFixtureOracle() {
  const fixtures = JSON.parse(readFileSync(join(HERE, '..', 'fixtures', `${KERNEL_ID}.fixtures.json`), 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    try {
      const { output_payload } = compute(vec.policy_parameters);
      if (vec.refuses || !deepEqual(output_payload, vec.output_payload)) {
        failures.push({ name: vec.name, expected: vec.refuses ? '(throw ' + vec.output_payload.domain_errors[0].text + ')' : vec.output_payload, got: output_payload });
      }
    } catch (e) {
      const msg = String((e && e.message) || e);
      if (vec.refuses) {
        if (msg !== vec.output_payload.domain_errors[0].text) {
          failures.push({ name: vec.name, expected: vec.output_payload.domain_errors[0].text, got: msg });
        }
      } else {
        failures.push({ name: vec.name, expected: '(clean run)', got: 'threw: ' + msg });
      }
    }
  }
  return { total: fixtures.vectors.length, failures };
}

// P1 — phase/schedule structure restated independently from the comparator rules.
function checkP1ScheduleStructure() {
  let checked = 0, violations = 0;
  const rng = mulberry32(76601);
  const PROGRAMS = ['none', 'ca', 'ny', 'nj', 'wa', 'co', 'or', 'custom'];
  for (let i = 0; i < 60; i++) {
    const paid = Math.floor(rng() * 10), partial = Math.floor(rng() * 10);
    const pfl = Math.floor(rng() * 12), leave = 1 + Math.floor(rng() * 30);
    const pct = Math.floor(rng() * 101);
    const pp = basePP({ employer_paid_weeks: paid, employer_partial_weeks: partial, employer_partial_pct: pct, state_pfl_weeks: pfl, total_leave_weeks: leave, state_program: pick(rng, PROGRAMS) });
    const { output_payload: out } = compute(pp);
    checked += leave;
    if (out.rows.length !== leave) { violations++; console.log(`P1 violation: ${out.rows.length} rows for ${leave} weeks`); }
    for (const r of out.rows) {
      const wantPhase = r.week <= paid ? 'Employer Paid' : r.week <= paid + partial ? 'Employer Partial' : 'Unpaid / FMLA';
      if (r.phase !== wantPhase) { violations++; console.log(`P1 violation: week ${r.week} phase ${r.phase} != ${wantPhase}`); }
      const wantPfl = r.week <= pfl ? out.state_pfl_weekly : 0;
      if (r.state_pfl !== wantPfl) { violations++; console.log(`P1 violation: week ${r.week} state_pfl mismatch`); }
    }
  }
  return { name: 'P1 schedule structure: phase boundaries and PFL window restated per row', checked, violations };
}

// P2 — gap identity restated: total_gap == sum |net| over negative-net weeks; savings_needed == total_gap.
function checkP2GapIdentity() {
  let checked = 0, violations = 0;
  const rng = mulberry32(76602);
  const PROGRAMS = ['none', 'ca', 'ny', 'nj', 'wa', 'co', 'or', 'custom'];
  for (let i = 0; i < 60; i++) {
    const pp = basePP({
      state_program: pick(rng, PROGRAMS),
      base_salary: 10000 + Math.floor(rng() * 400000),
      partner_income: Math.floor(rng() * 15000),
      monthly_expenses: 500 + Math.floor(rng() * 20000),
      baby_expense: Math.floor(rng() * 4000),
      total_leave_weeks: 1 + Math.floor(rng() * 40),
    });
    const { output_payload: out } = compute(pp);
    let sum = 0;
    for (const r of out.rows) if (r.net < 0) sum += Math.abs(r.net);
    checked += 2;
    if (out.total_gap !== sum) { violations++; console.log(`P2 violation: total_gap ${out.total_gap} != negative-net sum ${sum}`); }
    if (out.savings_needed !== out.total_gap) { violations++; console.log('P2 violation: savings_needed != total_gap'); }
  }
  return { name: 'P2 gap identity: total_gap == sum |net| (neg weeks); savings_needed == total_gap', checked, violations };
}

// P3 — determinism and output shape (no undefined/NaN/non-finite anywhere).
function checkP3DeterminismShape() {
  let checked = 0, violations = 0;
  const rng = mulberry32(76603);
  for (let i = 0; i < 30; i++) {
    const pp = basePP({
      base_salary: 10000 + Math.floor(rng() * 400000),
      total_leave_weeks: 1 + Math.floor(rng() * 45),
      state_program: pick(rng, ['none', 'ca', 'ny', 'nj', 'wa', 'co', 'or', 'custom']),
    });
    const a = compute(pp), b = compute(pp);
    checked += 2;
    if (!deepEqual(a, b)) { violations++; console.log('P3 violation: two runs differ'); }
    const v = findShapeViolations(a.output_payload);
    if (v.length) { violations++; console.log('P3 shape violations: ' + v.slice(0, 3).join('; ')); }
  }
  return { name: 'P3 determinism (byte-equal reruns) and shape (no undefined/NaN/non-finite)', checked, violations };
}

// P4 — invalid-domain inputs are refused by throw with a named REFUSED_BAD_* reason.
function checkP4DomainRefusal() {
  let checked = 0, violations = 0;
  const badOver = [
    ['base_salary', 9999], ['base_salary', 500001], ['base_salary', '85000'], ['base_salary', NaN], ['base_salary', Infinity],
    ['tax_rate_pct', -1], ['tax_rate_pct', 51], ['monthly_expenses', 499], ['monthly_expenses', 30001],
    ['partner_income', -1], ['partner_income', 20001], ['savings', -1], ['savings', 500001],
    ['employer_paid_weeks', -1], ['employer_paid_weeks', 27], ['employer_partial_weeks', 27], ['employer_partial_pct', 101],
    ['state_pfl_weeks', -1], ['state_pfl_weeks', 17], ['custom_pfl_rate_pct', 101], ['baby_expense', -1], ['baby_expense', 5001],
    ['total_leave_weeks', 0], ['total_leave_weeks', 53], ['total_leave_weeks', 16.5],
  ];
  for (const [k, v] of badOver) {
    let threw = null;
    try { compute(basePP({ [k]: v })); } catch (e) { threw = e; }
    checked++;
    if (!threw || !/^REFUSED_BAD_/.test(String(threw.message))) { violations++; console.log(`P4 violation: ${k}=${v} did not refuse by name (got ${threw ? threw.message : 'clean run'})`); }
  }
  for (const sp of ['xx', '', 'CA', null, undefined, 7]) {
    let threw = null;
    try { compute(basePP({ state_program: sp })); } catch (e) { threw = e; }
    checked++;
    if (!threw || !String(threw.message).startsWith('REFUSED_BAD_STATE_PROGRAM')) { violations++; console.log(`P4 violation: state_program=${JSON.stringify(sp)} did not refuse by name`); }
  }
  for (const bad of [null, 42, 'x', []]) {
    let threw = null;
    try { compute(bad); } catch (e) { threw = e; }
    checked++;
    if (!threw) { violations++; console.log('P4 violation: non-object pp did not refuse'); }
  }
  // Payload refusal vectors BF-T3/T4/T5, message-pinned verbatim (kept out of the
  // fixtures corpus because the VM-1a parity gate runs every fixtures vector through
  // the worker, whose throw contract makes a refusing vector a hard error there).
  for (const [over, msg] of [
    [{ total_leave_weeks: 0 }, 'REFUSED_BAD_TOTAL_LEAVE_WEEKS: total_leave_weeks=0 outside declared form domain [1, 52]'],
    [{ total_leave_weeks: -3 }, 'REFUSED_BAD_TOTAL_LEAVE_WEEKS: total_leave_weeks=-3 outside declared form domain [1, 52]'],
    [{ state_program: 'xx' }, 'REFUSED_BAD_STATE_PROGRAM: state_program="xx" not in [none, ca, ny, nj, wa, co, or, custom]'],
  ]) {
    let msg2 = null;
    try { compute(basePP(over)); } catch (e) { msg2 = String(e.message); }
    checked++;
    if (msg2 !== msg) { violations++; console.log(`P4 violation: BF refusal message ${msg2} != pinned ${msg}`); }
  }
  return { name: 'P4 every numeric/type/enum bound refuses by named REFUSED_BAD_* throw (incl. payload BF-T3/T4/T5 messages)', checked, violations };
}

// P5 — recovery + verdict contract restated.
function checkP5RecoveryVerdict() {
  let checked = 0, violations = 0;
  const rng = mulberry32(76605);
  for (let i = 0; i < 60; i++) {
    const pp = basePP({
      base_salary: 10000 + Math.floor(rng() * 400000),
      partner_income: Math.floor(rng() * 15000),
      monthly_expenses: 500 + Math.floor(rng() * 20000),
      baby_expense: Math.floor(rng() * 4000),
      savings: Math.floor(rng() * 30000),
      total_leave_weeks: 1 + Math.floor(rng() * 30),
    });
    const { output_payload: out } = compute(pp);
    const surplus = Math.max(0, (pp.base_salary / 12) * (1 - pp.tax_rate_pct / 100) + pp.partner_income - pp.monthly_expenses - pp.baby_expense);
    checked += 3;
    if (out.surplus_per_month !== surplus) { violations++; console.log('P5 violation: surplus_per_month restatement mismatch'); }
    if (surplus > 0) {
      const want = Math.ceil(out.savings_needed / surplus);
      if (out.recovery_finite !== true || out.recovery_months !== want || out.compliance_flags.includes('ART766_RECOVERY_SENTINEL')) {
        violations++; console.log(`P5 violation: finite recovery ${out.recovery_months} != ceil(${out.savings_needed}/${surplus})`);
      }
    } else {
      if (out.recovery_finite !== false || out.recovery_months !== 999 || !out.compliance_flags.includes('ART766_RECOVERY_SENTINEL')) {
        violations++; console.log('P5 violation: sentinel recovery contract broken');
      }
    }
    const covered = pp.savings >= out.savings_needed;
    const wantVerdict = covered ? 'positive' : pp.savings > out.savings_needed * 0.5 ? 'warn' : 'danger';
    if (out.verdict !== wantVerdict) { violations++; console.log(`P5 violation: verdict ${out.verdict} != ${wantVerdict}`); }
    if (out.is_fully_covered !== covered) { violations++; console.log('P5 violation: is_fully_covered mismatch'); }
    checked += 2;
  }
  return { name: 'P5 recovery (finite ceil / 999 sentinel + flag) and verdict mapping restated', checked, violations };
}

// P6 — cap and windfall diagnostics restated per row.
function checkP6CapDiagnostics() {
  let checked = 0, violations = 0;
  const rng = mulberry32(76606);
  const RATES = { none: 0, ca: 0.65, ny: 0.67, nj: 0.85, wa: 0.75, co: 0.90, or: 0.60 };
  const CAPS = { none: 99999, ca: 1620, ny: 1177, nj: 1055, wa: 1574, co: 1292, or: 1470 };
  for (let i = 0; i < 40; i++) {
    const sp = pick(rng, Object.keys(RATES));
    const salary = 10000 + Math.floor(rng() * 450000);
    const pp = basePP({ state_program: sp, base_salary: salary, employer_paid_weeks: 4, employer_partial_weeks: 0, state_pfl_weeks: 6 });
    const { output_payload: out } = compute(pp);
    const gross = salary / 52;
    const rate = sp === 'none' ? 0 : RATES[sp];
    checked += 2;
    if (out.state_cap_binds !== (gross * rate >= CAPS[sp])) { violations++; console.log(`P6 violation: state_cap_binds restatement mismatch (${sp})`); }
    for (const r of out.rows) {
      checked++;
      if (r.windfall_capped !== (r.emp_pay + r.state_pfl > out.weekly_net * 1.05)) { violations++; console.log(`P6 violation: windfall_capped restatement mismatch week ${r.week}`); }
    }
  }
  return { name: 'P6 state_cap_binds and per-row windfall_capped restated', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = localFixtureOracle();
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(35 vectors)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1ScheduleStructure(),
  checkP2GapIdentity(),
  checkP3DeterminismShape(),
  checkP4DomainRefusal(),
  checkP5RecoveryVerdict(),
  checkP6CapDiagnostics(),
];
console.log(`[${KERNEL_ID}] class-K floor property test`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
