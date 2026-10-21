// art-754-equity-exit-waterfall.proptest.mjs — class-K property-test FLOOR
// (FV-PBT-FLOOR-BUILD-SPEC.md). Authored against the APEXPORT-141 porting payload
// (kernel + fixtures + VECTORS/DIFFERS/CITES records, GRADES PASS-PENDING-XV
// 2026-10-07T03:0xZ reaudit CONFIRMED 2026-10-07T04:59:15Z, Builder-verifies-at-land
// 18/18 pre-build (17 match + 1 expected DIFFERS-01 refusal), Tim extend ruling
// 2026-10-18T21:20Z).
// kernel_digest_at_authoring: sha256:a46e9cb990a7038f60994f348c3a3471baba8ae89fbd6ee2510c657736e4c520
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof, NOT Dafny. Internal engineering QC only.
// float_sensitive: PARTIAL — the kernel deliberately keeps the Apex page's float
// arithmetic so its outputs match the ported-from page to the digit (double-precision
// artifacts preserved, payload VECTORS.md). The properties below assert only relations
// that are exact under IEEE-754 (monotone comparisons on shared arithmetic, equality on
// already-computed outputs, restatements of the published formula with the SAME
// operation order), never fragile float equals on arbitrary draws.
//
// Checks: fixture-oracle gate (the 7 live Apex vectors and the 11 comparator-boundary
// vectors — exit<=0 refusal boundary, the strict non-participating conversion trigger
// pro-rata == / > liquidation preference, the strict capped-participation hit
// raw == / > max, zero common share, the 0 net and 0 gain floors, the preferred-wins
// heuristic at/past); P1 your_gross_proceeds_usd is non-decreasing in
// exit_valuation_usd and in your_ownership_pct (common role); P2 the position restated:
// your_net === max(0, gross - strike) and your_taxable_gain === max(0, net - basis) with
// the fixed 0 floors, and liquidation_preference_usd === total_preferred_invested_usd *
// liquidation_preference_multiple (same operation order); P3 determinism (two runs agree
// byte-for-byte) and output shape (no undefined/NaN/non-finite anywhere in
// output_payload); P4 domain refusals: every non-finite numeric slot yields
// output_payload.refusal_reason === 'REFUSED_NON_FINITE_INPUT' and a non-positive exit
// yields 'REFUSED_NON_POSITIVE_EXIT', both with the ART754_INPUT_REFUSED flag (the
// payload contract — not a throw); P5 the non-participating conversion contract
// (DIFFERS-06, strict): when preferred pro-rata > liquidation preference the
// ART754_NON_PARTICIPATING_CONVERSION flag fires and common_pool_usd ===
// exit_valuation_usd * (1 - preferred fraction) with the SAME operation order, otherwise
// common_pool_usd === exit_valuation_usd - liquidation_preference_usd; P6 break-even
// restated (DIFFERS-04/05): preferred role gets 0; common role gets
// liquidation_preference_usd + (strike / ((1 - prefFrac) * ((1 - prefFrac) share))) in
// the kernel's exact operation order, and the capped-participation cap-hit flag implies
// raw > capped max with the SAME floor arithmetic.
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-754-equity-exit-waterfall.proptest.mjs

import { compute } from '../art-754-equity-exit-waterfall.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick } from './_pbt-common.mjs';

const KERNEL_ID = 'art-754-equity-exit-waterfall';

const PARTICIPATION = ['non', 'full', 'capped'];
const ROLES = ['common', 'founder', 'employee', 'preferred'];

const basePP = () => ({
  exit_valuation_usd: 50000000, total_preferred_invested_usd: 10000000,
  preferred_ownership_pct: 60, liquidation_preference_multiple: 1,
  participation_type: 'non', participation_cap_multiple: 3,
  your_role: 'common', your_ownership_pct: 5,
  your_option_strike_total_usd: 50000, your_cost_basis_usd: 50000,
});

const hasBadNumber = (x) => {
  if (typeof x === 'number') return !Number.isFinite(x);
  if (x === null || typeof x !== 'object') return false;
  return Object.values(x).some(hasBadNumber);
};

// P1 — your_gross_proceeds_usd non-decreasing in exit value and in own ownership (common role).
function checkP1Monotone() {
  let checked = 0, violations = 0;
  const rng = mulberry32(75401);
  for (let i = 0; i < 50; i++) {
    const pp = basePP();
    pp.exit_valuation_usd = 1000000 + Math.floor(rng() * 500000000);
    pp.your_ownership_pct = 0.5 + rng() * 40;
    pp.participation_type = pick(rng, PARTICIPATION);
    const gross0 = compute(pp).output_payload.your_gross_proceeds_usd;
    const grossExit = compute({ ...pp, exit_valuation_usd: pp.exit_valuation_usd + 5000000 }).output_payload.your_gross_proceeds_usd;
    const grossOwn = compute({ ...pp, your_ownership_pct: pp.your_ownership_pct + 0.5 }).output_payload.your_gross_proceeds_usd;
    for (const [label, g1] of [['exit', grossExit], ['ownership', grossOwn]]) {
      checked++;
      if (g1 < gross0) { violations++; console.log(`P1 violation: gross ${g1} < ${gross0} when raising ${label}`); }
    }
  }
  return { name: 'P1 your_gross_proceeds_usd non-decreasing in exit value / ownership', checked, violations };
}

// P2 — position restated: floors and the preference product, same operation order.
function checkP2PositionRestated() {
  let checked = 0, violations = 0;
  const rng = mulberry32(75402);
  for (let i = 0; i < 60; i++) {
    const pp = basePP();
    pp.participation_type = pick(rng, PARTICIPATION);
    pp.your_role = pick(rng, ROLES);
    const out = compute(pp).output_payload;
    checked += 3;
    if (out.your_net_proceeds_usd !== Math.max(0, out.your_gross_proceeds_usd - pp.your_option_strike_total_usd)) {
      violations++; console.log('P2 violation: your_net != max(0, gross - strike)');
    }
    if (out.your_taxable_gain_usd !== Math.max(0, out.your_net_proceeds_usd - pp.your_cost_basis_usd)) {
      violations++; console.log('P2 violation: your_taxable_gain != max(0, net - basis)');
    }
    if (out.liquidation_preference_usd !== pp.total_preferred_invested_usd * pp.liquidation_preference_multiple) {
      violations++; console.log('P2 violation: liquidation_preference != invested * multiple');
    }
  }
  return { name: 'P2 net/gain floors + preference product restated (same op order)', checked, violations };
}

// P3 — determinism + output shape.
function checkP3DeterminismShape() {
  let checked = 0, violations = 0;
  const rng = mulberry32(75403);
  for (let i = 0; i < 40; i++) {
    const pp = basePP();
    pp.exit_valuation_usd = 100000 + Math.floor(rng() * 900000000);
    pp.participation_type = pick(rng, PARTICIPATION);
    const a = compute(pp), b = compute(pp);
    checked += 2;
    if (JSON.stringify(a) !== JSON.stringify(b)) { violations++; console.log('P3 violation: nondeterministic output'); }
    if (hasBadNumber(a.output_payload)) { violations++; console.log('P3 violation: NaN/undefined/non-finite in output_payload'); }
  }
  return { name: 'P3 determinism + output shape (no NaN/undefined/non-finite)', checked, violations };
}

// P4 — domain refusals (named reason, never a silent guess): every non-finite numeric slot
// and the non-positive exit boundary.
function checkP4DomainRefusal() {
  let checked = 0, violations = 0;
  // Apex reads controls with Number() coercion: numeric strings are VALID inputs
  // (Number('50000000') is finite) and null coerces to 0, which is the non-positive
  // exit boundary, not a non-finite. Only true non-finites are refused here.
  const bads = [NaN, Infinity, -Infinity];
  const slots = ['exit_valuation_usd', 'total_preferred_invested_usd', 'preferred_ownership_pct',
    'liquidation_preference_multiple', 'participation_cap_multiple', 'your_ownership_pct',
    'your_option_strike_total_usd', 'your_cost_basis_usd'];
  for (const bad of bads) {
    for (const key of slots) {
      const r = compute({ ...basePP(), [key]: bad });
      checked++;
      if (r.output_payload.refusal_reason !== 'REFUSED_NON_FINITE_INPUT' || !r.compliance_flags.includes('ART754_INPUT_REFUSED')) {
        violations++; console.log(`P4 violation: ${key}=${String(bad)} not refused with REFUSED_NON_FINITE_INPUT + flag`);
      }
    }
  }
  for (const ev of [0, -1000]) {
    const r = compute({ ...basePP(), exit_valuation_usd: ev });
    checked++;
    if (r.output_payload.refusal_reason !== 'REFUSED_NON_POSITIVE_EXIT' || !r.compliance_flags.includes('ART754_INPUT_REFUSED')) {
      violations++; console.log(`P4 violation: exit=${ev} not refused with REFUSED_NON_POSITIVE_EXIT + flag`);
    }
  }
  return { name: 'P4 refusals: non-finite slots + non-positive exit, named codes + flag', checked, violations };
}

// P5 — non-participating conversion contract (DIFFERS-06, strict inequality), restated
// with the SAME operation order.
function checkP5ConversionContract() {
  let checked = 0, violations = 0;
  const rng = mulberry32(75405);
  for (let i = 0; i < 60; i++) {
    const pp = basePP();
    pp.participation_type = 'non';
    pp.exit_valuation_usd = 1000000 + Math.floor(rng() * 400000000);
    pp.total_preferred_invested_usd = 1000000 + Math.floor(rng() * 40000000);
    pp.liquidation_preference_multiple = 1 + Math.floor(rng() * 3);
    pp.preferred_ownership_pct = 5 + rng() * 60;
    const out = compute(pp).output_payload;
    const proRata = out.exit_valuation_usd * out.preferred_ownership_fraction;
    checked += 2;
    if (proRata > out.liquidation_preference_usd) {
      if (!out.compliance_flags.includes('ART754_NON_PARTICIPATING_CONVERSION')) { violations++; console.log('P5 violation: conversion fired without flag'); }
      if (out.common_pool_usd !== out.exit_valuation_usd * (1 - out.preferred_ownership_fraction)) { violations++; console.log('P5 violation: converted common_pool != exit * (1 - prefFrac)'); }
    } else {
      if (out.compliance_flags.includes('ART754_NON_PARTICIPATING_CONVERSION')) { violations++; console.log('P5 violation: flag fired without conversion (equality must NOT convert)'); }
      // common pool = remaining = exit - min(exit, preference) — the preference is capped
      // at what the exit can pay (kernel: prefPref = min(remaining, liquidPref)).
      const remaining = out.exit_valuation_usd - Math.min(out.exit_valuation_usd, out.liquidation_preference_usd);
      if (out.common_pool_usd !== remaining) { violations++; console.log('P5 violation: common_pool != exit - min(exit, preference)'); }
    }
  }
  return { name: 'P5 strict conversion trigger + common pool restated (same op order)', checked, violations };
}

// P6 — break-even restated (DIFFERS-04) and the capped-participation hit contract (DIFFERS-05/07).
function checkP6BreakEvenCap() {
  let checked = 0, violations = 0;
  const rng = mulberry32(75406);
  for (let i = 0; i < 60; i++) {
    const pp = basePP();
    pp.your_role = pick(rng, ROLES);
    pp.participation_type = pick(rng, PARTICIPATION);
    pp.preferred_ownership_pct = 10 + rng() * 55;
    pp.your_ownership_pct = 0.5 + rng() * 30;
    pp.your_option_strike_total_usd = Math.floor(rng() * 500000);
    const out = compute(pp).output_payload;
    const prefFrac = out.preferred_ownership_fraction;
    const commonOwnerPct = 1 - prefFrac;
    checked += 3;
    if (pp.your_role === 'preferred') {
      if (out.break_even_exit_usd !== 0) { violations++; console.log('P6 violation: preferred-role break_even != 0'); }
    } else if (commonOwnerPct > 0) {
      const share = pp.your_ownership_pct / 100 / commonOwnerPct;
      const want = share > 0 ? out.liquidation_preference_usd + (pp.your_option_strike_total_usd / (commonOwnerPct * share)) : out.liquidation_preference_usd;
      if (out.break_even_exit_usd !== want) { violations++; console.log('P6 violation: break_even != restated formula'); }
    }
    if (pp.participation_type === 'capped') {
      // Restate the capped branch with the kernel's exact operation order (DIFFERS-05/07/08):
      // remaining = exit - min(exit, preference); raw = remaining * prefFrac;
      // maxPart = max(0, cap*invested - preference); capped = min(raw, maxPart);
      // hit = raw > maxPart (strict); pool = hit ? remaining*common + raw - capped
      //      : remaining*common.
      const remaining = out.exit_valuation_usd - Math.min(out.exit_valuation_usd, out.liquidation_preference_usd);
      const raw = remaining * prefFrac;
      const maxPart = Math.max(0, pp.total_preferred_invested_usd * pp.participation_cap_multiple - out.liquidation_preference_usd);
      const capped = Math.min(raw, maxPart);
      const wantPool = raw > maxPart ? remaining * commonOwnerPct + raw - capped : remaining * commonOwnerPct;
      const hit = out.compliance_flags.includes('ART754_CAP_PARTICIPATION_HIT');
      if (hit !== (raw > maxPart)) { violations++; console.log('P6 violation: cap-hit flag != strict raw > maxPart'); }
      if (out.common_pool_usd !== wantPool) { violations++; console.log('P6 violation: capped common_pool != restated branch'); }
    }
  }
  return { name: 'P6 break-even restated + capped-participation pool contract', checked, violations };
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
  checkP2PositionRestated(),
  checkP3DeterminismShape(),
  checkP4DomainRefusal(),
  checkP5ConversionContract(),
  checkP6BreakEvenCap(),
];
console.log(`[${KERNEL_ID}] class-K floor property test`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
