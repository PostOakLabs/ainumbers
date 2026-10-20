// art-761-caregiver-income-impact.proptest.mjs — class-K property-test FLOOR
// (FV-PBT-FLOOR-BUILD-SPEC.md). Authored against the APEXPORT-117 porting payload
// (kernel + fixtures + VECTORS/DIFFERS/CITES records, GRADES PASS-PENDING-XV
// 2026-10-14, Builder-verifies-at-land 64/64, APEX-PORT-117-LAND-1).
// kernel_digest_at_authoring: sha256:804a97db4e05b09e11175080accb15aaa6636155627abfe51d2e2572245a8f31
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof, NOT Dafny. Internal engineering QC only.
// float_sensitive: PARTIAL — the kernel deliberately keeps the Apex page's float
// annuity arithmetic so its outputs match the ported-from page to the cent. The
// properties below assert only relations that are exact under IEEE-754 (monotone
// rounding of nonneg sums of nonneg terms, equality on already-rounded outputs,
// refusal-domain membership) or restatements of the published formula, never
// fragile float equals on arbitrary draws.
//
// Checks: fixture-oracle gate (the 64 payload vectors: live Apex vectors with
// the money columns pinned to the cent, official-profile vs apex-profile twins,
// and the boundary pairs at and just past every comparator — vintage table edges
// 2025-12-31/2026-01-01, unsupported vintage, the DIFFERS-D3 falsy-fallback
// zeros, fv zero-rate, years_after_care clamp, SS care-year cap, setback
// strategy branch, UI bounds, required inputs, ISO date domain); P1 the money
// outputs are non-decreasing in salary_usd, income_reduction_pct and
// retirement_age (every term feeding them is a nonneg product of the input);
// P2 the payload formula restated independently on a fixed control set (direct
// loss, 401(k) ordinary-annuity fv then post-care compounding, setback fv at
// 200 bp, SS linearisation at the vintage table, total with SS over 20 years);
// P3 determinism (two runs agree byte-for-byte) and output shape (no
// undefined/NaN/non-finite anywhere in output_payload); P4 invalid-domain
// inputs are refused via the returned refusal shape (named refusal_reason +
// nonempty domain_errors), never a throw and never a silent default; P5 the
// DIFFERS-D3 cure: a legitimate 0 is kept (all-zero pp succeeds and prices to
// 0, never rewritten to a default); P6 the vintage table restated (2025 ->
// 176100/24180, 2026 -> 184500/24864, 2027 refused) and the user-supplied
// benefit override surfaces user_supplied + its flag; P7 the compliance-flag
// surface (UI-range flags are flags, not refusals; care-at/after-retirement;
// SS cap reached; setback strategy push above 5%).
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-761-caregiver-income-impact.proptest.mjs

import { compute } from '../art-761-caregiver-income-impact.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick, findShapeViolations } from './_pbt-common.mjs';

const KERNEL_ID = 'art-761-caregiver-income-impact';

const basePP = () => ({
  as_of: '2026-10-13', salary_usd: 90000, current_age: 42, retirement_age: 67,
  care_years: 5, income_reduction_pct: 50, career_setback_pct: 10,
  contribution_401k_pct: 6, investment_return_pct: 7, marginal_tax_rate_pct: 22,
});

const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const isRefused = (r) => r.output_payload.refusal_reason !== null
  && Array.isArray(r.output_payload.domain_errors) && r.output_payload.domain_errors.length > 0;

// P1 — money outputs non-decreasing in salary, income_reduction_pct and
// retirement_age, over the declared UI domain.
function checkP1Monotone() {
  let checked = 0, violations = 0;
  const rng = mulberry32(76101);
  const COLUMNS = ['direct_income_loss_cents', 'retirement_savings_gap_cents',
    'career_setback_cost_cents', 'annual_ss_reduction_cents', 'total_impact_with_ss_cents'];
  for (let i = 0; i < 40; i++) {
    const pp = {
      ...basePP(),
      salary_usd: Math.floor(rng() * 200000),
      income_reduction_pct: Math.floor(rng() * 101),
      career_setback_pct: Math.floor(rng() * 101),
      contribution_401k_pct: Math.floor(rng() * 21),
      investment_return_pct: 1 + Math.floor(rng() * 12),
      care_years: Math.floor(rng() * 15),
    };
    for (const up of [
      { ...pp, salary_usd: pp.salary_usd + 2500 },
      { ...pp, income_reduction_pct: Math.min(100, pp.income_reduction_pct + 5) },
      { ...pp, retirement_age: pp.retirement_age + 1 },
    ]) {
      const a = compute(pp).output_payload;
      const b = compute(up).output_payload;
      checked++;
      for (const col of COLUMNS) {
        if (b[col] < a[col]) { violations++; console.log(`P1 violation: ${col} decreased when a control input increased (${a[col]} -> ${b[col]})`); }
      }
    }
  }
  return { name: 'P1 money outputs non-decreasing in salary / income_reduction_pct / retirement_age', checked, violations };
}

// P2 — payload formula restated independently on a fixed control set.
function checkP2FormulaRestated() {
  let checked = 0, violations = 0;
  const fv = (pmt, r, n) => (r === 0 ? pmt * n : pmt * (Math.pow(1 + r, n) - 1) / r);
  /** @type {any[]} */
  const cases = [
    { ...basePP() },
    { ...basePP(), as_of: '2025-12-31' },
    { ...basePP(), investment_return_pct: 0 },
    { ...basePP(), care_years: 0 },
    { ...basePP(), care_years: 35 },
    { ...basePP(), career_setback_pct: 0 },
    { ...basePP(), ss_average_annual_benefit_usd: 23000 },
  ];
  for (const pp of cases) {
    const out = compute(pp).output_payload;
    const r = pp.investment_return_pct / 100;
    const red = pp.income_reduction_pct / 100;
    const ytr = pp.retirement_age - pp.current_age;
    const yac = Math.max(0, ytr - pp.care_years);
    const base = pp.ss_average_annual_benefit_usd ?? { 2025: 24180, 2026: 24864 }[Number(pp.as_of.slice(0, 4))];
    const wageBase = { 2025: 176100, 2026: 184500 }[Number(pp.as_of.slice(0, 4))];
    const gap = fv(pp.salary_usd * red * (pp.contribution_401k_pct / 100), r, pp.care_years) * Math.pow(1 + r, yac);
    const setback = fv(pp.salary_usd * (pp.career_setback_pct / 100), 0.02, yac);
    const annualSS = base * ((pp.salary_usd * red) / wageBase) * Math.min(pp.care_years / 35, 0.15);
    const want = {
      direct_income_loss_cents: Math.round(pp.salary_usd * red * pp.care_years * 100),
      retirement_savings_gap_cents: Math.round(gap * 100),
      career_setback_cost_cents: Math.round(setback * 100),
      ss_wage_base_usd: wageBase,
      ss_average_annual_benefit_usd: base,
      years_after_care: yac,
      annual_ss_reduction_cents: Math.round(annualSS * 100),
      total_impact_with_ss_cents: Math.round((pp.salary_usd * red * pp.care_years + gap + setback + annualSS * 20) * 100),
    };
    checked++;
    for (const [k, v] of Object.entries(want)) {
      if (out[k] !== v) { violations++; console.log(`P2 violation: ${k} got ${out[k]}, restated ${v}`); }
    }
  }
  return { name: 'P2 payload formula restated independently (7 control sets)', checked, violations };
}

// P3 — determinism and output shape.
function checkP3DeterminismShape() {
  let checked = 0, violations = 0;
  const rng = mulberry32(76103);
  for (let i = 0; i < 40; i++) {
    const pp = {
      as_of: `${pick(rng, ['2025', '2026'])}-${String(1 + Math.floor(rng() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rng() * 28)).padStart(2, '0')}`,
      salary_usd: Math.floor(rng() * 300000),
      current_age: 18 + Math.floor(rng() * 60),
      retirement_age: 0, care_years: Math.floor(rng() * 40),
      income_reduction_pct: Math.floor(rng() * 101), career_setback_pct: Math.floor(rng() * 101),
      contribution_401k_pct: Math.floor(rng() * 101), investment_return_pct: Math.floor(rng() * 201) - 100,
      marginal_tax_rate_pct: Math.floor(rng() * 101),
    };
    pp.retirement_age = pp.current_age + Math.floor(rng() * 40);
    const a = compute(pp).output_payload;
    const b = compute(pp).output_payload;
    checked += 2;
    if (!deepEqual(a, b)) { violations++; console.log('P3 violation: two runs differ'); }
    if (findShapeViolations(a).length > 0 || JSON.stringify(a).includes('undefined')) { violations++; console.log('P3 violation: undefined/NaN/non-finite in output_payload'); }
  }
  return { name: 'P3 determinism + output shape (no undefined/NaN/non-finite)', checked, violations };
}

// P4 — invalid-domain inputs refused via the returned refusal shape with a
// named reason (the payload contract: no throw, no silent default).
function checkP4DomainRefusal() {
  let checked = 0, violations = 0;
  const bad = [
    ['pp null', null],
    ['as_of missing', { ...basePP(), as_of: undefined }],
    ['as_of not ISO', { ...basePP(), as_of: '2026-13-45' }],
    ['as_of not a date', { ...basePP(), as_of: 'not-a-date' }],
    ['vintage 2027', { ...basePP(), as_of: '2027-01-01' }],
    ['vintage 2024', { ...basePP(), as_of: '2024-12-31' }],
    ['salary missing', { ...basePP(), salary_usd: undefined }],
    ['salary negative', { ...basePP(), salary_usd: -1 }],
    ['salary NaN', { ...basePP(), salary_usd: NaN }],
    ['income_reduction_pct 101', { ...basePP(), income_reduction_pct: 101 }],
    ['income_reduction_pct -1', { ...basePP(), income_reduction_pct: -1 }],
    ['career_setback_pct 101', { ...basePP(), career_setback_pct: 101 }],
    ['contribution_401k_pct -1', { ...basePP(), contribution_401k_pct: -1 }],
    ['investment_return_pct 101', { ...basePP(), investment_return_pct: 101 }],
    ['investment_return_pct -101', { ...basePP(), investment_return_pct: -101 }],
    ['marginal_tax_rate_pct 101', { ...basePP(), marginal_tax_rate_pct: 101 }],
    ['care_years missing', { ...basePP(), care_years: undefined }],
    ['retirement_age string', { ...basePP(), retirement_age: '67' }],
    ['benefit override zero', { ...basePP(), ss_average_annual_benefit_usd: 0 }],
    ['benefit override negative', { ...basePP(), ss_average_annual_benefit_usd: -5 }],
  ];
  for (const [label, pp] of bad) {
    checked++;
    let r;
    try { r = compute(pp); } catch (e) { violations++; console.log(`P4 violation: ${label} threw (${e.message})`); continue; }
    if (!isRefused(r)) { violations++; console.log(`P4 violation: ${label} not refused (refusal_reason ${r.output_payload.refusal_reason})`); }
  }
  return { name: 'P4 invalid-domain inputs refused via named refusal shape (no throw, no default)', checked, violations };
}

// P5 — DIFFERS-D3 cure: a legitimate 0 stays 0 (all-zero pp succeeds, prices
// to 0, and is never rewritten to a default).
function checkP5ZeroKept() {
  let checked = 0, violations = 0;
  const zero = {
    as_of: '2026-06-30', salary_usd: 0, current_age: 40, retirement_age: 67,
    care_years: 0, income_reduction_pct: 0, career_setback_pct: 0,
    contribution_401k_pct: 0, investment_return_pct: 0, marginal_tax_rate_pct: 0,
  };
  const r = compute(zero);
  checked++;
  if (isRefused(r)) { violations++; console.log('P5 violation: all-zero pp refused'); }
  const out = r.output_payload;
  for (const col of ['direct_income_loss_cents', 'retirement_savings_gap_cents', 'career_setback_cost_cents', 'annual_ss_reduction_cents', 'total_impact_cents', 'total_impact_with_ss_cents']) {
    checked++;
    if (out[col] !== 0) { violations++; console.log(`P5 violation: all-zero pp priced ${col} to ${out[col]}, want 0`); }
  }
  return { name: 'P5 legitimate 0 kept (all-zero pp succeeds and prices to 0)', checked, violations };
}

// P6 — vintage table restated + user-supplied benefit override surface.
function checkP6VintageAndOverride() {
  let checked = 0, violations = 0;
  const rows = [
    ['2025-01-01', 176100, 24180, 'pinned_official_2025'],
    ['2025-12-31', 176100, 24180, 'pinned_official_2025'],
    ['2026-01-01', 184500, 24864, 'pinned_official_2026'],
    ['2026-12-31', 184500, 24864, 'pinned_official_2026'],
  ];
  for (const [asOf, wageBase, benefit, source] of rows) {
    const out = compute({ ...basePP(), as_of: asOf }).output_payload;
    checked++;
    if (out.ss_wage_base_usd !== wageBase || out.ss_average_annual_benefit_usd !== benefit || out.ss_average_benefit_source !== source) {
      violations++; console.log(`P6 violation: ${asOf} -> base ${out.ss_wage_base_usd}, benefit ${out.ss_average_annual_benefit_usd}, source ${out.ss_average_benefit_source}`);
    }
  }
  const ov = compute({ ...basePP(), ss_average_annual_benefit_usd: 23000 });
  checked++;
  if (ov.output_payload.ss_average_benefit_source !== 'user_supplied'
    || ov.output_payload.ss_average_annual_benefit_usd !== 23000
    || !ov.compliance_flags.includes('ART761_SS_AVERAGE_BENEFIT_USER_SUPPLIED')) {
    violations++; console.log('P6 violation: 23000 override did not surface user_supplied + flag');
  }
  // Apex-profile twin reproducibility: override 23000 must reproduce the source
  // exactly on the shipped control defaults (DIFFERS-D2 fixture pair v1/v1-apex).
  const apexTwins = compute({ ...basePP(), ss_average_annual_benefit_usd: 23000 }).output_payload;
  checked++;
  if (apexTwins.total_impact_with_ss_cents !== 51978878) {
    violations++; console.log(`P6 violation: apex-profile control total ${apexTwins.total_impact_with_ss_cents}, payload pins 51978878`);
  }
  return { name: 'P6 vintage table restated + user-supplied override surface', checked, violations };
}

// P7 — compliance-flag surface: UI-range overshoot is a FLAG, not a refusal;
// care-at/after-retirement and SS-cap flags; setback strategy push.
function checkP7Flags() {
  let checked = 0, violations = 0;
  const flagged = compute({ ...basePP(), contribution_401k_pct: 50, income_reduction_pct: 100, care_years: 35, career_setback_pct: 10 });
  checked++;
  if (!flagged.compliance_flags.some((f) => f.startsWith('ART761_OUT_OF_UI_RANGE_CONTRIBUTION_401K_PCT'))) {
    violations++; console.log('P7 violation: contribution_401k_pct 50 produced no UI-range flag');
  }
  checked++;
  if (isRefused(flagged)) { violations++; console.log('P7 violation: UI-range overshoot refused instead of flagged'); }
  checked++;
  if (!flagged.compliance_flags.includes('ART761_SS_CARE_YEAR_CAP_REACHED')) {
    violations++; console.log('P7 violation: care_years 35 did not set the SS cap flag');
  }
  const late = compute({ ...basePP(), current_age: 66, care_years: 5 });
  checked++;
  if (!late.compliance_flags.includes('ART761_CARE_AT_OR_AFTER_RETIREMENT')) {
    violations++; console.log('P7 violation: care ending at retirement did not set the care flag');
  }
  const noPush = compute({ ...basePP(), career_setback_pct: 5 });
  const push = compute({ ...basePP(), career_setback_pct: 10 });
  checked += 2;
  if (noPush.output_payload.strategies.length !== 5) { violations++; console.log(`P7 violation: setback 5% pushed a strategy (${noPush.output_payload.strategies.length})`); }
  if (push.output_payload.strategies.length !== 6 || !push.compliance_flags.includes('ART761_SETBACK_ABOVE_FIVE_PCT')) {
    violations++; console.log('P7 violation: setback 10% did not push the credential strategy + flag');
  }
  checked++;
  if (!compute(basePP()).compliance_flags.includes('ART761_SS_ESTIMATE_MODELED')) {
    violations++; console.log('P7 violation: SS_ESTIMATE_MODELED always-on flag missing');
  }
  return { name: 'P7 compliance-flag surface (flags not refusals; cap, clamp, setback branch)', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1Monotone(),
  checkP2FormulaRestated(),
  checkP3DeterminismShape(),
  checkP4DomainRefusal(),
  checkP5ZeroKept(),
  checkP6VintageAndOverride(),
  checkP7Flags(),
];
console.log(`[${KERNEL_ID}] class-K floor property test`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
