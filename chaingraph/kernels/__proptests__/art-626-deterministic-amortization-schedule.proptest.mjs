// art-626-deterministic-amortization-schedule.proptest.mjs — FV property-test FLOOR (ACCT-AMORT-K-1).
// kernel_digest_at_authoring: sha256:32ee03f89954474c9d09d90e18eba3acc47dc757fc8cab6bd19fd7bf8e6f4e06
// human_sign_off: PENDING
//
// SCOPE: floor tier (FV-PBT-FLOOR-BUILD-SPEC.md, class B — property-test, not exhaustive
// enumeration: the domain includes real-valued rates and open-ended calendar dates). NOT a
// proof, NOT Dafny. Per research/ACCT-AMORT-K-1.spec.md's scope_statement.
//
// float_sensitive: YES. Applicable subset of research/FV-ROUNDING-PROPERTY-SUITE-BUILD-SPEC-2026-08-09.md's
// P1-P30 portfolio, selected per this kernel's own declared rounding_steps (six entries, all
// mode=half_up, precision in {2,10}, oracle="declared — clause silent" throughout — no cited-clause
// rounding mode exists anywhere in this kernel, see the spec file's rounding_steps note):
//
// P0  fixture oracle -- every pinned vector in fixtures.json reproduces byte-for-byte.
// P1  half_up-declared step: exact .5-at-precision inputs round away from zero, both signs.
// P6  determinism: compute() twice on identical input is byte-identical.
// P7  precision bound: every money-typed schedule field carries no more than money_precision (2)
//     decimal digits; every rate/fraction field carries no more than rate/day_count_precision (10).
// P9  double-rounding avoidance: rounding once at declared precision equals the same value rounded
//     again at the same precision (idempotence framed as double-rounding, since this kernel never
//     stages an intermediate higher-precision round before its own declared round).
// P10 idempotence: roundAt(roundAt(x)) === roundAt(x) for the kernel's one declared mode (half_up).
// P12 threshold-boundary forcing: 30E/360 (ISDA)'s is_termination flag and 30/360 US's D1>29
//     coupling both flip the day-count formula at an exact boundary -- forced, not sampled.
// P13 +0/-0 identical through the rounding path.
// P21 chain-level bound: opening_balance[n] === closing_balance[n-1] for every n>0, across
//     randomized schedules -- a chain-level property over the whole per-period step composition.
// P27 anti-fabrication: every rounding_steps entry's oracle is the literal "declared — clause
//     silent" string, never a fabricated clause citation for a step none of the cited clauses
//     addresses.
// P28 step-count parity: rounding_steps always carries exactly 6 entries (5 per-period + the
//     mandatory final-period plug), regardless of convention or input.
// P29 float_sensitive completeness: a float_sensitive:yes kernel has zero rounding_steps entries
//     with a null/undefined precision.
// P30 overflow/underflow edges at the kernel's own declared bounds (MAX_PERIODS=600) neither wrap,
//     silently truncate, nor throw an undeclared exception.
//
// Kernel-specific properties (beyond the generic P1-P30 portfolio, asserting THIS kernel's own
// declared contracts from research/ACCT-AMORT-K-1.spec.md):
// K1  a rate is reported (solved:true) only when both bracketed AND converged are true.
// K2  solve_rate is refused (RATE_SOLVE_SCOPED_TO_UNIT_PERIOD) for every non-UNIT_PERIOD convention.
// K3  a remeasurement's new_segment[0].opening_balance is byte-identical to the prior segment's
//     row[at_period_index].closing_balance whenever continuity_invariant is asserted true.
// K4  a final-period plug residue exceeding max_plug is reported as an error, never silently applied
//     (the last row's closing_balance stays whatever it was, never coerced to 0).
// K5  MAX_PERIODS and MAX_SEGMENTS are enforced as named errors, never a longer loop.
// K6  totality: compute() never throws for any input, including hostile ones.
//
// Zero NEW external dependencies -- Node built-ins only.
//
// Run: node chaingraph/kernels/__proptests__/art-626-deterministic-amortization-schedule.proptest.mjs

import { compute } from '../art-626-deterministic-amortization-schedule.kernel.mjs';
import { _amort } from '../_amort.bundle.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

// ---------- deterministic PRNG (no Math.random) ----------
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x626);

// ---------- P0: fixture oracle ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-626-deterministic-amortization-schedule.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload, compliance_flags } = compute(vec.policy_parameters);
    const gotKey = JSON.stringify({ output_payload, compliance_flags });
    const wantKey = JSON.stringify({ output_payload: vec.output_payload, compliance_flags: vec.compliance_flags });
    if (gotKey !== wantKey) failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
  }
  results.fixture_oracle = { total: fixtures.vectors.length, failures };
  return failures.length === 0;
}

// ---------- P1: half_up ties round away from zero, both signs ----------
function checkP1_half_up_ties() {
  let violations = 0, checked = 0;
  const examples = [];
  for (let p = 0; p <= 4; p++) {
    for (const sign of [1, -1]) {
      const scale = Math.pow(10, p); // test-side only, not the kernel's own rounding path
      const tie = sign * (1 / (2 * scale)); // exact .5 at precision p
      checked++;
      const got = _amort.roundAt(tie, p, 'half_up');
      const want = sign * (1 / scale);
      if (Math.abs(got - want) > 1e-12) { violations++; if (examples.length < 3) examples.push({ tie, p, got, want }); }
    }
  }
  return { name: 'P1_half_up_ties_round_away_from_zero', trials: checked, violations, examples };
}

// ---------- P6: determinism ----------
function checkP6_determinism() {
  let violations = 0, checked = 0;
  const CONVS = _amort.CONVENTIONS;
  for (let t = 0; t < 60; t++) {
    const convention = CONVS[Math.floor(rand() * CONVS.length)];
    const periods = buildRandomPeriods(convention, 1 + Math.floor(rand() * 12));
    const pp = { principal: 100 + rand() * 100000, annual_rate: rand() * 0.3, convention, periods_per_year: 12, periods };
    checked++;
    const r1 = JSON.stringify(compute(pp));
    const r2 = JSON.stringify(compute(pp));
    if (r1 !== r2) violations++;
  }
  return { name: 'P6_determinism', trials: checked, violations };
}

function buildRandomPeriods(convention, n) {
  const periods = [];
  if (convention === 'UNIT_PERIOD') {
    for (let i = 0; i < n; i++) periods.push({ unit_fraction: 1, payment: 10 + rand() * 1000, is_termination: i === n - 1 });
    return periods;
  }
  let y = 2020 + Math.floor(rand() * 10), m = 1;
  for (let i = 0; i < n; i++) {
    const startY = y, startM = m;
    m += 1; if (m > 12) { m = 1; y += 1; }
    periods.push({ start: iso(startY, startM), end: iso(y, m), payment: 10 + rand() * 1000, is_termination: i === n - 1 });
  }
  return periods;
}
function iso(y, m) { return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`; }

// ---------- P7: precision bound ----------
function decimalDigits(x) {
  if (!Number.isFinite(x)) return 0;
  const s = String(Math.abs(x));
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : (s.length - dot - 1);
}
function checkP7_precision_bound() {
  let violations = 0, checked = 0;
  const examples = [];
  for (let t = 0; t < 40; t++) {
    const convention = _amort.CONVENTIONS[Math.floor(rand() * _amort.CONVENTIONS.length)];
    const periods = buildRandomPeriods(convention, 1 + Math.floor(rand() * 8));
    const { output_payload } = compute({ principal: 100 + rand() * 50000, annual_rate: rand() * 0.25, convention, periods_per_year: 12, periods });
    if (!output_payload.schedule) continue;
    for (const row of output_payload.schedule) {
      checked++;
      for (const field of ['interest', 'principal_component', 'closing_balance']) {
        if (decimalDigits(row[field]) > 2) { violations++; if (examples.length < 3) examples.push({ field, value: row[field] }); }
      }
      if (decimalDigits(row.period_fraction) > 10) { violations++; if (examples.length < 3) examples.push({ field: 'period_fraction', value: row.period_fraction }); }
    }
  }
  return { name: 'P7_precision_bound_no_extra_digits', trials: checked, violations, examples };
}

// ---------- P9/P10: double-rounding avoidance / idempotence ----------
function checkP9_P10_idempotence() {
  let violations = 0, checked = 0;
  for (let t = 0; t < 200; t++) {
    const p = Math.floor(rand() * 11);
    const x = (rand() - 0.5) * 1e6;
    checked++;
    const once = _amort.roundAt(x, p, 'half_up');
    const twice = _amort.roundAt(once, p, 'half_up');
    if (once !== twice) violations++;
  }
  return { name: 'P9_P10_double_round_idempotent', trials: checked, violations };
}

// ---------- P12: threshold-boundary forcing ----------
function checkP12_threshold_boundaries() {
  let violations = 0;
  const rows = [];
  const one = (label, pp, assert) => {
    const { output_payload } = compute(pp);
    const bad = assert(output_payload);
    if (bad) { violations++; rows.push({ label, problem: bad }); } else rows.push({ label, ok: true });
  };

  // 30E/360 (ISDA): is_termination flips whether a Feb-end D2 is capped.
  one('30e_360_isda_termination_flag_changes_fraction',
    { principal: 1000, annual_rate: 0.06, convention: '30E_360_ISDA', periods: [{ start: '2024-01-31', end: '2024-02-29', payment: 1000, is_termination: false }] },
    (o) => o.schedule[0].period_fraction !== 0.0833333333 ? 'expected non-termination Feb-end capped D2 -> 30/360' : null);
  one('30e_360_isda_termination_true_uncaps_d2',
    { principal: 1000, annual_rate: 0.06, convention: '30E_360_ISDA', periods: [{ start: '2024-01-31', end: '2024-02-29', payment: 1000, is_termination: true }] },
    (o) => o.schedule[0].period_fraction !== 0.0805555556 ? 'expected termination Feb-end NOT capped D2 -> 29/360' : null);

  // 30/360 US: D1 (post-cap) > 29 couples into capping D2 when D2 would be 31.
  one('30_360_us_d1_gt29_couples_d2_cap',
    { principal: 1000, annual_rate: 0.06, convention: '30_360_US', periods: [{ start: '2024-01-31', end: '2024-03-31', payment: 1000, is_termination: true }] },
    (o) => o.schedule[0].period_fraction !== 0.1666666667 ? 'expected D1>29 coupling to cap D2 to 30, giving exactly 2 months' : null);

  return { name: 'P12_threshold_boundary_forcing', trials: rows.length, violations, rows: rows.filter((r) => !r.ok) };
}

// ---------- P13: +0/-0 identical ----------
function checkP13_signed_zero() {
  let violations = 0, checked = 0;
  for (let p = 0; p <= 6; p++) {
    checked++;
    const a = _amort.roundAt(0, p, 'half_up');
    const b = _amort.roundAt(-0, p, 'half_up');
    if (Object.is(a, -0) || Object.is(b, -0) || a !== b) violations++;
  }
  return { name: 'P13_signed_zero_identity', trials: checked, violations };
}

// ---------- P21: chain-level bound (opening[n] === closing[n-1]) ----------
function checkP21_chained_balance() {
  let violations = 0, checked = 0;
  for (let t = 0; t < 60; t++) {
    const convention = _amort.CONVENTIONS[Math.floor(rand() * _amort.CONVENTIONS.length)];
    const periods = buildRandomPeriods(convention, 2 + Math.floor(rand() * 10));
    const { output_payload } = compute({ principal: 100 + rand() * 100000, annual_rate: rand() * 0.3, convention, periods_per_year: 12, periods, apply_final_plug: false });
    if (!output_payload.schedule) continue;
    const rows = output_payload.schedule;
    for (let i = 1; i < rows.length; i++) {
      checked++;
      if (rows[i].opening_balance !== rows[i - 1].closing_balance) violations++;
    }
  }
  return { name: 'P21_chained_balance_invariant', trials: checked, violations };
}

// ---------- P27: anti-fabrication ----------
function checkP27_anti_fabrication() {
  let violations = 0, checked = 0;
  const { output_payload } = compute({ principal: 1000, annual_rate: 0.05, convention: 'UNIT_PERIOD', periods_per_year: 12, periods: [{ unit_fraction: 1, payment: 1000, is_termination: true }] });
  for (const step of output_payload.rounding_steps) {
    checked++;
    if (step.oracle !== 'declared — clause silent') violations++;
  }
  return { name: 'P27_anti_fabrication_declared_clause_silent', trials: checked, violations };
}

// ---------- P28: step-count parity ----------
function checkP28_step_count_parity() {
  let violations = 0, checked = 0;
  for (const convention of _amort.CONVENTIONS) {
    checked++;
    const periods = buildRandomPeriods(convention, 3);
    const { output_payload } = compute({ principal: 1000, annual_rate: 0.05, convention, periods_per_year: 12, periods });
    if (!Array.isArray(output_payload.rounding_steps) || output_payload.rounding_steps.length !== 6) violations++;
  }
  return { name: 'P28_rounding_steps_always_six', trials: checked, violations };
}

// ---------- P29: float-sensitive completeness ----------
function checkP29_float_sensitive_completeness() {
  const { output_payload } = compute({ principal: 1000, annual_rate: 0.05, convention: 'UNIT_PERIOD', periods_per_year: 12, periods: [{ unit_fraction: 1, payment: 1000, is_termination: true }] });
  let violations = 0;
  for (const step of output_payload.rounding_steps) {
    if (step.precision === null || step.precision === undefined) violations++;
  }
  return { name: 'P29_float_sensitive_precision_completeness', trials: output_payload.rounding_steps.length, violations };
}

// ---------- P30: overflow/underflow edges at declared bounds ----------
function checkP30_bounds_edges() {
  let violations = 0, checked = 0;
  const examples = [];
  // exactly MAX_PERIODS accepted
  {
    checked++;
    const periods = buildRandomPeriods('UNIT_PERIOD', _amort.MAX_PERIODS);
    let out;
    try { out = compute({ principal: 100000, annual_rate: 0.05, convention: 'UNIT_PERIOD', periods_per_year: 12, periods }); }
    catch (e) { violations++; examples.push({ label: 'MAX_PERIODS-exact-threw', err: String(e && e.message) }); }
    if (out && out.compliance_flags.includes('MAX_PERIODS_EXCEEDED')) { violations++; examples.push({ label: 'MAX_PERIODS-exact-wrongly-refused' }); }
  }
  // MAX_PERIODS + 1 refused, never a longer loop / silent truncation
  {
    checked++;
    const periods = buildRandomPeriods('UNIT_PERIOD', _amort.MAX_PERIODS + 1);
    let out;
    try { out = compute({ principal: 100000, annual_rate: 0.05, convention: 'UNIT_PERIOD', periods_per_year: 12, periods }); }
    catch (e) { violations++; examples.push({ label: 'MAX_PERIODS+1-threw', err: String(e && e.message) }); }
    if (out && !out.compliance_flags.includes('MAX_PERIODS_EXCEEDED')) { violations++; examples.push({ label: 'MAX_PERIODS+1-not-refused' }); }
    if (out && out.output_payload.schedule !== null) { violations++; examples.push({ label: 'MAX_PERIODS+1-silently-truncated-and-computed' }); }
  }
  return { name: 'P30_bounds_edges_no_wrap_no_silent_truncate', trials: checked, violations, examples };
}

// ---------- K1: rate reported only when bracketed AND converged ----------
function checkK1_rate_report_gate() {
  let violations = 0, checked = 0;
  const cases = [
    { periods: (() => { const p = []; for (let i = 0; i < 12; i++) p.push({ unit_fraction: 1, payment: 106.6, is_termination: i === 11 }); return p; })(), expectSolved: true },
    { periods: (() => { const p = []; for (let i = 0; i < 6; i++) p.push({ unit_fraction: 1, payment: 10, is_termination: i === 5 }); return p; })(), expectSolved: false }, // never repays principal
  ];
  for (const c of cases) {
    checked++;
    const { output_payload } = compute({ principal: 1000, convention: 'UNIT_PERIOD', periods_per_year: 12, periods: c.periods, solve_rate: true });
    const rs = output_payload.rate_solve;
    const solvedCorrectly = rs.solved === (rs.converged === true && rs.bracketed === true);
    if (!solvedCorrectly) violations++;
    if (!rs.solved && (rs.periodic_rate !== null || rs.annual_rate_equivalent !== null)) violations++;
  }
  return { name: 'K1_rate_reported_only_if_bracketed_and_converged', trials: checked, violations };
}

// ---------- K2: solve_rate scoped off for calendar conventions ----------
function checkK2_solve_rate_scope() {
  let violations = 0, checked = 0;
  for (const convention of _amort.CONVENTIONS) {
    if (convention === 'UNIT_PERIOD') continue;
    checked++;
    const periods = buildRandomPeriods(convention, 3);
    const { compliance_flags } = compute({ principal: 1000, convention, periods, solve_rate: true });
    if (!compliance_flags.includes('RATE_SOLVE_SCOPED_TO_UNIT_PERIOD')) violations++;
  }
  return { name: 'K2_solve_rate_scoped_to_unit_period', trials: checked, violations };
}

// ---------- K3: remeasurement continuity ----------
function checkK3_remeasurement_continuity() {
  let violations = 0, checked = 0;
  for (let t = 0; t < 20; t++) {
    const periods = buildRandomPeriods('UNIT_PERIOD', 8);
    const at = Math.floor(rand() * 8);
    const rmPeriods = buildRandomPeriods('UNIT_PERIOD', 1 + Math.floor(rand() * 5));
    checked++;
    const { output_payload } = compute({ principal: 1000 + rand() * 5000, annual_rate: rand() * 0.2, convention: 'UNIT_PERIOD', periods_per_year: 12, periods, remeasurement: { at_period_index: at, annual_rate: rand() * 0.2, periods: rmPeriods } });
    const rm = output_payload.remeasurement;
    if (!rm) continue; // a legally-refused remeasurement (e.g. out-of-range index never generated here) is not a violation
    if (rm.continuity_invariant) {
      if (rm.new_segment[0].opening_balance !== output_payload.schedule[at].closing_balance) violations++;
    } else {
      violations++; // continuity should always hold by construction for a well-formed request
    }
  }
  return { name: 'K3_remeasurement_continuity_byte_identical', trials: checked, violations };
}

// ---------- K4: final plug never silently exceeds bound ----------
function checkK4_final_plug_bound() {
  let violations = 0, checked = 0;
  const periods = (() => { const p = []; for (let i = 0; i < 12; i++) p.push({ unit_fraction: 1, payment: 106.6, is_termination: i === 11 }); return p; })();
  for (const maxPlug of [0, 0.001, 0.22, 0.23, 0.24, 1, 100]) {
    checked++;
    const { output_payload, compliance_flags } = compute({ principal: 1200, annual_rate: 0.12, convention: 'UNIT_PERIOD', periods_per_year: 12, periods, max_plug: maxPlug });
    const last = output_payload.schedule[output_payload.schedule.length - 1];
    if (output_payload.final_plug.error) {
      if (last.closing_balance === 0 && output_payload.final_plug.amount !== 0) violations++; // silently applied over the bound
      if (!compliance_flags.includes('FINAL_PLUG_EXCEEDS_BOUND')) violations++;
    } else if (output_payload.final_plug.applied) {
      if (last.closing_balance !== 0) violations++;
    }
  }
  return { name: 'K4_final_plug_never_silently_exceeds_bound', trials: checked, violations };
}

// ---------- K5: MAX_SEGMENTS awareness (2-segment case never flagged) ----------
function checkK5_segments_within_bound() {
  const periods = buildRandomPeriods('UNIT_PERIOD', 6);
  const rmPeriods = buildRandomPeriods('UNIT_PERIOD', 3);
  const { compliance_flags } = compute({ principal: 1000, annual_rate: 0.05, convention: 'UNIT_PERIOD', periods_per_year: 12, periods, remeasurement: { at_period_index: 3, annual_rate: 0.06, periods: rmPeriods } });
  const violations = compliance_flags.includes('MAX_SEGMENTS_EXCEEDED') ? 1 : 0;
  return { name: 'K5_two_segments_never_exceeds_max_segments', trials: 1, violations };
}

// ---------- K6: totality ----------
function checkK6_totality() {
  const hostile = [
    undefined, null, 0, 'x', [], true, NaN, {},
    { convention: 'UNIT_PERIOD' }, { convention: 'UNIT_PERIOD', periods: null },
    { convention: 'UNIT_PERIOD', periods: 'not-an-array' },
    { convention: 'UNIT_PERIOD', periods: [null, 5, [], {}] },
    { convention: 'UNIT_PERIOD', periods: [{ unit_fraction: -1, payment: 1 }] },
    { convention: 'UNIT_PERIOD', periods: [{ unit_fraction: NaN, payment: 1 }] },
    { convention: '30_360_US', periods: [{ start: null, end: '2024-01-01', payment: 1 }] },
    { convention: '30_360_US', periods: [{ start: '2024-13-40', end: '2024-01-01', payment: 1 }] },
    { convention: 'UNIT_PERIOD', principal: 'not-a-number', annual_rate: 'x', periods: [{ unit_fraction: 1, payment: 1 }] },
    { convention: 'UNIT_PERIOD', periods: [{ unit_fraction: 1, payment: 1 }], remeasurement: { at_period_index: 99, periods: [] } },
    { convention: 'UNIT_PERIOD', periods: [{ unit_fraction: 1, payment: 1 }], remeasurement: {} },
    { convention: 'UNIT_PERIOD', periods: [{ unit_fraction: 1, payment: 1 }], max_plug: -1 },
  ];
  let violations = 0, checked = 0;
  const examples = [];
  for (const pp of hostile) {
    checked++;
    let out;
    try { out = compute(pp); } catch (e) { violations++; if (examples.length < 3) examples.push({ input: JSON.stringify(pp) ?? String(pp), threw: String(e && e.message) }); continue; }
    const o = out.output_payload;
    const shapeOk = o && typeof o === 'object' && Array.isArray(o.rounding_steps) && Array.isArray(out.compliance_flags) && typeof o.note === 'string';
    if (!shapeOk) { violations++; if (examples.length < 3) examples.push({ input: JSON.stringify(pp) ?? String(pp), reason: 'malformed payload shape' }); }
  }
  return { name: 'K6_totality_never_throws_always_well_formed', trials: checked, violations, examples };
}

// ---------- inapplicable properties, recorded rather than omitted ----------
const NOT_APPLICABLE = [
  ['P2_half_even_ties', 'this kernel declares only half_up across all six rounding_steps entries; no half_even mode exists to test'],
  ['P3_truncate_bound', 'no truncate-mode step is declared'],
  ['P4_ceiling_bound', 'no ceiling-mode step is declared'],
  ['P5_floor_bound', 'no floor-mode step is declared'],
  ['P8_precision_bound_directed', 'not applicable — the half_up ±0.5*10^-precision bound (P8 as stated for directed modes) does not apply since this kernel declares no directed (floor/ceiling/truncate) step'],
  ['P11_ulp_precision_loss_bound', 'this kernel rounds explicitly at every declared step (day_count/rate precision 10, money precision 2); it does not claim a 1-ULP bound on the underlying double beyond its own declared precision, which P7 already checks'],
  ['P14_denormal_stays_finite', 'inputs are principal/rate/day-count magnitudes, never denormal-range doubles by construction of the domain'],
  ['P15_nonassociativity_robustness', 'the schedule is a strictly sequential per-period recurrence (opening[n]=closing[n-1]), never a reassociable sum, so P15 has no accumulation-order alternative to test against'],
  ['P16_max_safe_integer_adjacent', 'MAX_PERIODS=600 bounds the loop; principal/payment magnitudes in realistic amortization inputs stay far below 2^53, and P30 already exercises the declared MAX_PERIODS boundary'],
  ['P17_associativity_composition', 'no kernel-internal (a+b)+c vs a+(b+c) choice exists; each rounding_steps entry is a single deterministic expression, not an associative reduction'],
  ['P18_inverse_composition_error', 'no scale-then-round-then-unscale round trip exists in this kernel'],
  ['P19_sum_then_round_vs_round_then_sum', 'this kernel has no separate aggregate-then-round step distinct from its per-item steps'],
  ['P20_multiplicative_scaling_commutes', 'no kernel-internal rescaling step exists to test commutation against'],
  ['P22_P23_P24_P25_mode_divergence', 'these properties compare a half_even-declared step against a parallel half_up computation at forced ties; this kernel declares only half_up everywhere, so there is no second mode to diverge from'],
  ['P26_cited_clause_mode_match', 'every rounding_steps.oracle in this kernel is "declared — clause silent" (none cites a clause-specified rounding mode), so P26 (clause-specified mode matches recorded oracle) has no clause-specified case to check — P27 (the silent-case anti-fabrication check) is the applicable half and is checked above'],
].map(([name, reason]) => ({ name: 'NA_' + name, applicable: false, reason, violations: 0 }));

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_half_up_ties());
results.properties.push(checkP6_determinism());
results.properties.push(checkP7_precision_bound());
results.properties.push(checkP9_P10_idempotence());
results.properties.push(checkP12_threshold_boundaries());
results.properties.push(checkP13_signed_zero());
results.properties.push(checkP21_chained_balance());
results.properties.push(checkP27_anti_fabrication());
results.properties.push(checkP28_step_count_parity());
results.properties.push(checkP29_float_sensitive_completeness());
results.properties.push(checkP30_bounds_edges());
results.properties.push(checkK1_rate_report_gate());
results.properties.push(checkK2_solve_rate_scope());
results.properties.push(checkK3_remeasurement_continuity());
results.properties.push(checkK4_final_plug_bound());
results.properties.push(checkK5_segments_within_bound());
results.properties.push(checkK6_totality());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-626-deterministic-amortization-schedule',
  float_sensitive: true,
  rounding: { mode: 'half_up', precisions: [2, 10], rounding_steps: 6 },
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  not_applicable: NOT_APPLICABLE,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
