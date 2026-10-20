// art-755-owner-salary-normalization.proptest.mjs — class-K property-test FLOOR
// (FV-PBT-FLOOR-BUILD-SPEC.md). Authored against the APEXPORT-158 porting payload
// (kernel + fixtures + VECTORS/DIFFERS/CITES records, GRADES PASS-PENDING-XV
// 2026-10-06, CONFIRMED reaudits x2, Builder-verifies-at-land 31/31 per the
// 2026-10-17/2026-10-18 Tim ruling).
// kernel_digest_at_authoring: sha256:97c65a853baa953edbe973bc6cb340838695da64f024b59fd8967c7dfb3492d6
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof, NOT Dafny. Internal engineering QC only.
// float_sensitive: PARTIAL — the kernel deliberately keeps the Apex page's
// whole-dollar Math.round arithmetic (payload DIFFERS-2) so its outputs match the
// ported-from page to the dollar. The properties below assert only relations that
// are exact under IEEE-754 with that rounding (equality on already-rounded
// outputs, monotonicity under +1 dollar steps, restatements of the published
// formulas), never fragile float equals on arbitrary draws.
//
// Checks: fixture-oracle gate (the 6 live Apex vectors plus the 25 boundary
// fixtures grouped by comparator — C1 owner_count round-and-floor, C2a-d
// Math.max clamps, C3 the ===0 compute branch, C4 the OASDI wage-base cap,
// C5/C6 the hourly-rate suppression and divisor guard, C7/C8 the package-pct
// suppression and guard, C9/C10 the reasonable-comp pattern conjuncts);
// P1 the owner package and SDE are non-decreasing in each add-back and the
// normalized EBITDA is non-increasing in the replacement wage, under exact
// +1-dollar steps; P2 the wage-base cap restated independently
// (ss_taxable_wages = min(owner_w2, ss_wage_base) and the two payroll legs
// restated from the capped/uncapped bases with the kernel's own bp rounding);
// P3 determinism (two runs agree byte-for-byte) and output shape (no
// undefined/NaN/non-finite anywhere in output_payload); P4 the NO-REFUSAL
// contract: every input is optional and falls back to the page default, so
// compute() never throws for null pp, non-object pp, nasty strings, NaN or
// out-of-domain numbers, and a fully-default call reproduces the live page's
// shipped defaults; P5 the earnings identities restated exactly (SDE = net
// income + package + one-time; normalized EBITDA = SDE - aggregate replacement
// cost; valuation impact = round(adjustment * multiple); per-owner average =
// round(package / owner_count)); P6 the multi-owner contract (owner_count > 1
// sets multi_owner, aggregate = single * count, per-owner average =
// round(package / count); owner_count 1 leaves aggregate == single and
// multi_owner false; 0 and 0.4 floor to 1, 1.5 rounds to 2).
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-755-owner-salary-normalization.proptest.mjs

import { compute } from '../art-755-owner-salary-normalization.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32 } from './_pbt-common.mjs';
import { NASTY_STRINGS, invalidDate, nullProtoClone } from './_pbt-common.mjs';

const KERNEL_ID = 'art-755-owner-salary-normalization';

const basePP = () => ({
  reported_net_income: 180000,
  one_time_expenses: 15000,
  owner_count: 1,
  owner_w2_salary: 95000,
  owner_distributions: 60000,
  employer_payroll_taxes_entered: 0,
  owner_health_insurance: 14400,
  owner_retirement_contribution: 12000,
  personal_vehicle_and_travel: 9600,
  other_personal_expenses: 6000,
  market_wage_replacement_manager: 85000,
  benefit_load_pct: 22,
  hours_per_week: 55,
  ss_wage_base: 184500,
  ss_rate_pct: 6.2,
  medicare_rate_pct: 1.45,
  sde_multiple: 2.8,
});

const ADD_BACK_KEYS = [
  'owner_distributions', 'owner_health_insurance', 'owner_retirement_contribution',
  'personal_vehicle_and_travel', 'other_personal_expenses', 'one_time_expenses',
];

const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const hasBadNumber = (x) => {
  if (typeof x === 'number') return !Number.isFinite(x);
  if (x === null || typeof x !== 'object') return false;
  return Object.values(x).some(hasBadNumber);
};

// Draw whole-dollar values in a plausible band, payroll taxes left at 0 (computed).
const drawPP = (rng) => ({
  reported_net_income: Math.round((rng() * 2 - 0.5) * 400000),
  one_time_expenses: Math.round(rng() * 60000),
  owner_count: 1 + Math.floor(rng() * 3),
  owner_w2_salary: Math.round(rng() * 260000),
  owner_distributions: Math.round(rng() * 250000),
  employer_payroll_taxes_entered: 0,
  owner_health_insurance: Math.round(rng() * 40000),
  owner_retirement_contribution: Math.round(rng() * 60000),
  personal_vehicle_and_travel: Math.round(rng() * 25000),
  other_personal_expenses: Math.round(rng() * 25000),
  market_wage_replacement_manager: Math.round(rng() * 200000),
  benefit_load_pct: Math.round(rng() * 40),
  hours_per_week: Math.floor(rng() * 80),
  ss_rate_pct: 6.2,
  medicare_rate_pct: 1.45,
  sde_multiple: Math.round(rng() * 8),
});

// P1 — package/SDE non-decreasing in each add-back; EBITDA non-increasing in
// the replacement wage; package non-decreasing in owner_w2 (both payroll legs
// are monotone non-decreasing in W-2 before rounding, and rounding preserves
// monotonicity under a +1 step only weakly, so assert on the exact +1 step:
// whole-dollar rounding of a monotone sequence stays monotone here because each
// leg is round(x) or round(x)+round(y) with x, y non-decreasing in the step).
function checkP1Monotone() {
  let checked = 0, violations = 0;
  const rng = mulberry32(75501);
  for (let i = 0; i < 60; i++) {
    const pp = drawPP(rng);
    const pkg0 = compute(pp).output_payload.total_owner_package;
    for (const key of ADD_BACK_KEYS) {
      const up = compute({ ...pp, [key]: pp[key] + 1 }).output_payload;
      checked++;
      if (up.total_owner_package < pkg0) {
        violations++; console.log(`P1 violation: package ${up.total_owner_package} < ${pkg0} when raising ${key} by 1`);
      }
    }
    const w2up = compute({ ...pp, owner_w2_salary: pp.owner_w2_salary + 1 }).output_payload;
    checked++;
    if (w2up.total_owner_package < pkg0) {
      violations++; console.log('P1 violation: package decreased when raising owner_w2_salary by 1');
    }
    const sde0 = compute(pp).output_payload.seller_discretionary_earnings;
    const niUp = compute({ ...pp, reported_net_income: pp.reported_net_income + 1 }).output_payload;
    checked++;
    if (niUp.seller_discretionary_earnings !== sde0 + 1) {
      violations++; console.log('P1 violation: SDE did not rise exactly 1 when raising reported_net_income by 1');
    }
    const wageUp = compute({ ...pp, market_wage_replacement_manager: pp.market_wage_replacement_manager + 1 }).output_payload;
    checked += 2;
    if (wageUp.replacement_cost_single < compute(pp).output_payload.replacement_cost_single) {
      violations++; console.log('P1 violation: replacement_cost_single decreased when raising market wage');
    }
    if (wageUp.normalized_ebitda > compute(pp).output_payload.normalized_ebitda) {
      violations++; console.log('P1 violation: normalized_ebitda increased when raising market wage');
    }
  }
  return { name: 'P1 package/SDE non-decreasing in add-backs, EBITDA non-increasing in replacement wage', checked, violations };
}

// P2 — the wage-base cap and the two payroll legs restated independently.
function checkP2WageBaseRestated() {
  let checked = 0, violations = 0;
  const rng = mulberry32(75502);
  const bases = [184500, 200000, 100000];
  for (let i = 0; i < 80; i++) {
    const pp = drawPP(rng);
    const ssBase = bases[i % bases.length];
    const full = { ...pp, ss_wage_base: ssBase };
    const out = compute(full).output_payload;
    const w2 = Math.round(pp.owner_w2_salary);
    const wantTaxable = Math.min(w2, ssBase);
    const wantSS = Math.round(wantTaxable * 620 / 10000);
    const wantMed = Math.round(w2 * 145 / 10000);
    checked += 3;
    if (out.ss_taxable_wages !== wantTaxable) { violations++; console.log(`P2 violation: ss_taxable_wages ${out.ss_taxable_wages} != min(${w2}, ${ssBase})`); }
    if (out.employer_ss_tax !== wantSS) { violations++; console.log(`P2 violation: employer_ss_tax ${out.employer_ss_tax} != ${wantSS}`); }
    if (out.employer_medicare_tax !== wantMed) { violations++; console.log(`P2 violation: employer_medicare_tax ${out.employer_medicare_tax} != ${wantMed}`); }
    checked++;
    if (out.employer_payroll_taxes !== wantSS + wantMed) { violations++; console.log('P2 violation: employer_payroll_taxes != ss + medicare legs'); }
  }
  return { name: 'P2 wage-base cap and payroll legs restated (min(w2, base), capped SS, uncapped Medicare)', checked, violations };
}

// P3 — determinism and output shape.
function checkP3DeterminismShape() {
  let checked = 0, violations = 0;
  const rng = mulberry32(75503);
  for (let i = 0; i < 40; i++) {
    const pp = drawPP(rng);
    const a = compute(pp).output_payload;
    const b = compute(pp).output_payload;
    checked += 2;
    if (!deepEqual(a, b)) { violations++; console.log('P3 violation: two runs differ'); }
    if (hasBadNumber(a) || JSON.stringify(a).includes('undefined')) { violations++; console.log('P3 violation: undefined/NaN/non-finite in output_payload'); }
  }
  return { name: 'P3 determinism + output shape (no undefined/NaN/non-finite)', checked, violations };
}

// P4 — the NO-REFUSAL contract: the kernel has no refusal branch, so nothing
// throws and every malformed input falls back to the page default.
function checkP4NoRefusalFallback() {
  let checked = 0, violations = 0;
  const defaults = compute(basePP()).output_payload;
  // Values the kernel must absorb without throwing (numOr parseFloat falls back
  // to the page default for every one of these).
  const nasties = [null, undefined, 7, 'x', [1], { owner_w2_salary: 'oops' }, NaN, Infinity, invalidDate()];
  const safeLabel = (v) => { try { return String(v); } catch { return '(unstringable value)'; } };
  for (const nasty of nasties) {
    for (const key of ['reported_net_income', 'owner_w2_salary', 'owner_distributions', 'market_wage_replacement_manager', 'benefit_load_pct', 'sde_multiple']) {
      checked++;
      const pp = nasty === null || typeof nasty !== 'object'
        ? nasty
        : { ...basePP(), [key]: nasty };
      let out;
      try { out = compute(pp).output_payload; } catch (e) {
        violations++; console.log(`P4 violation: threw on ${key} = ${safeLabel(nasty)}: ${e.message}`); continue;
      }
      if (out.error !== null) { violations++; console.log(`P4 violation: error ${out.error} on ${key} = ${safeLabel(nasty)}`); }
    }
  }
  // A prototype-less whole-pp object is read-only accessed, never converted, so
  // it must not throw either. A prototype-less VALUE in a numeric slot hits
  // parseFloat's ToString conversion (inherited verbatim from the Apex page's
  // numOr), which may throw — if it does, it must be a plain Error.
  checked += 2;
  try { compute(nullProtoClone({})); } catch (e) {
    violations++; console.log(`P4 violation: prototype-less whole-pp threw: ${e.message}`);
  }
  try { compute({ ...basePP(), owner_w2_salary: nullProtoClone({}) }); } catch (e) {
    if (!(e instanceof Error) || e.message.length === 0) { violations++; console.log('P4 violation: prototype-less value threw without a named reason'); }
  }
  for (const s of NASTY_STRINGS.slice(0, 8)) {
    checked++;
    let out;
    try { out = compute({ ...basePP(), owner_w2_salary: s }).output_payload; } catch (e) {
      violations++; console.log(`P4 violation: threw on nasty string: ${e.message}`); continue;
    }
    if (out.error !== null) { violations++; console.log('P4 violation: error set on nasty string input'); }
  }
  checked++;
  const blank = compute({}).output_payload;
  if (!deepEqual(blank, defaults)) { violations++; console.log('P4 violation: empty pp did not reproduce the live page defaults'); }
  return { name: 'P4 no-refusal contract: zero throw sites, malformed inputs fall back to page defaults', checked, violations };
}

// P5 — the earnings identities restated exactly.
function checkP5Identities() {
  let checked = 0, violations = 0;
  const rng = mulberry32(75505);
  for (let i = 0; i < 80; i++) {
    const pp = drawPP(rng);
    const out = compute(pp).output_payload;
    const wantSde = pp.reported_net_income + out.total_owner_package + pp.one_time_expenses;
    checked += 4;
    if (out.seller_discretionary_earnings !== wantSde) { violations++; console.log('P5 violation: SDE identity broken'); }
    if (out.normalized_ebitda !== out.seller_discretionary_earnings - out.replacement_cost_aggregate) { violations++; console.log('P5 violation: EBITDA identity broken'); }
    if (out.valuation_impact_at_multiple !== Math.round(out.normalization_adjustment * pp.sde_multiple)) { violations++; console.log('P5 violation: valuation impact identity broken'); }
    if (out.per_owner_average_package !== Math.round(out.total_owner_package / Math.max(1, Math.round(pp.owner_count)))) { violations++; console.log('P5 violation: per-owner average identity broken'); }
  }
  return { name: 'P5 earnings identities restated (SDE, EBITDA, valuation impact, per-owner average)', checked, violations };
}

// P6 — the multi-owner contract.
function checkP6MultiOwner() {
  let checked = 0, violations = 0;
  const rng = mulberry32(75506);
  const counts = [0, 0.4, 1, 1.5, 2, 3, 4];
  for (let i = 0; i < 60; i++) {
    const pp = drawPP(rng);
    for (const c of counts) {
      const out = compute({ ...pp, owner_count: c }).output_payload;
      const n = Math.max(1, Math.round(c));
      checked += 3;
      if (out.multi_owner !== (n > 1)) { violations++; console.log(`P6 violation: multi_owner ${out.multi_owner} for owner_count ${c}`); }
      if (out.replacement_cost_aggregate !== out.replacement_cost_single * n) { violations++; console.log(`P6 violation: aggregate != single * ${n}`); }
      if (out.per_owner_average_package !== Math.round(out.total_owner_package / n)) { violations++; console.log(`P6 violation: per-owner average != round(package / ${n})`); }
    }
  }
  return { name: 'P6 multi-owner contract (round-and-floor count, aggregate, per-owner average)', checked, violations };
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
  checkP2WageBaseRestated(),
  checkP3DeterminismShape(),
  checkP4NoRefusalFallback(),
  checkP5Identities(),
  checkP6MultiOwner(),
];
console.log(`[${KERNEL_ID}] class-K floor property test`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
