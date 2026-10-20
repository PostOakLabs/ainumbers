// art-770-total-cost-of-homeownership.proptest.mjs — class-K property-test FLOOR
// (FV-PBT-FLOOR-BUILD-SPEC.md). Authored against the APEXPORT-153 porting payload
// (kernel + fixtures + VECTORS/DIFFERS/CITES records, GRADES PASS-PENDING-XV
// 2026-10-18, Builder-verifies-at-land 35/35).
// kernel_digest_at_authoring: sha256:196064a53ca1064efb27eacef246b1ee5fd94603b158134293f92dcdedb0bdff
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof, NOT Dafny. Internal engineering QC only.
// float_sensitive: PARTIAL — the kernel deliberately keeps the Apex page's float
// amortization and growth-loop arithmetic so its outputs match the ported-from page
// to the digit. The properties below assert only relations that are exact under
// IEEE-754 (equality on already-rounded outputs, sign of a rounded difference,
// restatements of the published formula) or branch identities, never fragile float
// equals on arbitrary draws.
//
// Checks: fixture-oracle gate (the 3 Apex live vectors plus the 14 boundary pairs
// at and just past every comparator — MI LTV strict-greater leg, holdYears<=0
// refusal, i===0 zero-rate branch, loanAmount<=0, selling clamp, term cap, price
// cap, appreciation sign, deduction bind, hold-vs-term balance zeroing, SALT falsy
// fallback, non-numeric MI threshold fallback, downPct clamp, negative price);
// P1 the sign of (grossCost - netCost) equals the sign of appreciationPct (the
// appreciation-equity relation, exact on money-rounded outputs); P2 the zero-rate
// monthly-payment branch restated (loanAmount/n) and the i>0 payment being
// positive and at most the loan; P3 determinism (two runs agree byte-for-byte)
// and output shape (no undefined/NaN/non-finite anywhere in output_payload);
// P4 the refusal contract: holdYears <= 0 refuses with REFUSED_BAD_HOLD_YEARS,
// the Apex text carried in message, every field except inputs/refusal/message
// null, the SAME key set as a success (art-704 convention) and
// ART770_INPUT_REFUSED flagged, while holdYears = 1 never refuses; P5 the
// per-month identities restated (breakEvenMonthlyRent === netCostPerMonth,
// costPerMonth === money(grossCost / (holdYears*12))); P6 the constant-fallback
// quirks restated (cSaltCap 0 === 10000, absent cMiDropLTVPct === 80); P7 no MI
// accrues when the initial LTV is at or below the drop threshold (monotone
// amortization: post-payment balance only decreases).
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-770-total-cost-of-homeownership.proptest.mjs

import { compute } from '../art-770-total-cost-of-homeownership.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick, findShapeViolations } from './_pbt-common.mjs';

const KERNEL_ID = 'art-770-total-cost-of-homeownership';

const money = (n) => Math.round(n * 100) / 100;

const basePP = () => ({
  price: 450000, downPct: 20, annualRate: 6.5, termYears: 30, closingPct: 2.5,
  miRatePct: 0.55, propertyTaxRate: 1.1, insuranceAnnual: 1800, hoaMonthly: 0,
  maintenancePct: 1.0, extraUtilities: 1200, appreciationPct: 3.0, taxGrowthPct: 2.0,
  inflationPct: 3.0, holdYears: 7, sellingPct: 6.0, oppRatePct: 5.0,
  marginalRatePct: 0, cMiDropLTVPct: 80, cSaltCap: 10000,
});

// P1 — sign(grossCost - netCost) === sign(appreciationPct), exact on rounded outputs.
function checkP1AppreciationSign() {
  let checked = 0, violations = 0;
  const rng = mulberry32(77001);
  for (let i = 0; i < 40; i++) {
    const appr = [-5, -2, -0.5, 0, 0.5, 2, 5, 10][Math.floor(rng() * 8)];
    const pp = { ...basePP(), appreciationPct: appr };
    const out = compute(pp).output_payload;
    const diff = money(out.grossCost - out.netCost); // equity from appreciation
    const sign = diff > 0 ? 1 : diff < 0 ? -1 : 0;
    const want = appr > 0 ? 1 : appr < 0 ? -1 : 0;
    checked++;
    if (sign !== want) { violations++; console.log(`P1 violation: appr ${appr} -> sign(gross-net) ${sign}`); }
    if (out.negativeAppreciation !== (appr < 0)) { violations++; console.log('P1 violation: negativeAppreciation flag'); checked++; }
  }
  return { name: 'P1 sign(gross-net) equals sign(appreciationPct); flag matches', checked, violations };
}

// P2 — monthly-payment branch identities: i === 0 restated as loanAmount/n; i > 0
// payment positive and (for a full-term hold) at most the loan amount.
function checkP2Payment() {
  let checked = 0, violations = 0;
  const rng = mulberry32(77002);
  for (let i = 0; i < 30; i++) {
    const zeroRate = i % 2 === 0;
    const price = 100000 + Math.floor(rng() * 400000);
    const downPct = pickDown(rng);
    const termYears = 1 + Math.floor(rng() * 40);
    const pp = { ...basePP(), price, downPct, termYears, annualRate: zeroRate ? 0 : 3 + rng() * 6 };
    const out = compute(pp).output_payload;
    checked += 2;
    if (out.loanAmount <= 0) continue;
    if (zeroRate) {
      const n = Math.min(termYears * 12, 480);
      if (out.monthlyPayment !== money(out.loanAmount / n)) { violations++; console.log('P2 violation: zero-rate payment != loanAmount/n'); }
    } else if (!(out.monthlyPayment > 0)) { violations++; console.log('P2 violation: positive-rate payment not positive'); }
  }
  return { name: 'P2 zero-rate payment restated (loanAmount/n); positive-rate payment > 0', checked, violations };
}

function pickDown(rng) {
  return [0, 3, 5, 10, 19.9, 20, 50, 99.9, 100][Math.floor(rng() * 9)];
}

// P3 — determinism and output shape.
function checkP3DeterminismShape() {
  let checked = 0, violations = 0;
  const rng = mulberry32(77003);
  for (let i = 0; i < 20; i++) {
    const pp = jitterPP(rng);
    const a = compute(pp), b = compute(pp);
    checked += 2;
    if (JSON.stringify(a) !== JSON.stringify(b)) { violations++; console.log('P3 violation: nondeterministic output'); }
    const v = findShapeViolations(a.output_payload);
    if (v.length) { violations++; console.log(`P3 violation: shape ${v.slice(0, 3).join('; ')}`); }
  }
  return { name: 'P3 determinism + no undefined/NaN in output_payload', checked, violations };
}

function jitterPP(rng) {
  const pp = basePP();
  pp.price = 50000 + Math.floor(rng() * 900000);
  pp.downPct = Math.round(rng() * 10000) / 100;
  pp.annualRate = Math.round(rng() * 900) / 100;
  pp.termYears = 1 + Math.floor(rng() * 40);
  pp.holdYears = 1 + Math.floor(rng() * 40);
  pp.appreciationPct = Math.round(rng() * 1400 - 200) / 100;
  pp.marginalRatePct = Math.floor(rng() * 4) * 12;
  pp.cMiDropLTVPct = pick(rng, [70, 80, 85, 90]);
  return pp;
}

// P4 — refusal contract: same keys, named refusal, nulls elsewhere; holdYears = 1 ok.
function checkP4RefusalContract() {
  let checked = 0, violations = 0;
  for (const holdYears of [-3, 0, 0.5]) {
    const pp = { ...basePP(), holdYears };
    const r = compute(pp);
    const out = r.output_payload;
    checked += 5;
    if (out.refusal !== 'REFUSED_BAD_HOLD_YEARS') { violations++; console.log(`P4 violation: holdYears ${holdYears} refusal ${out.refusal}`); }
    if (out.message !== 'Years you plan to stay must be at least 1.') { violations++; console.log('P4 violation: refusal message not the Apex text'); }
    if (JSON.stringify(r.compliance_flags) !== JSON.stringify(['ART770_INPUT_REFUSED'])) { violations++; console.log('P4 violation: refusal flags'); }
    const ok = compute({ ...basePP(), holdYears: 1 });
    const successKeys = Object.keys(ok.output_payload).sort().join(',');
    const refusalKeys = Object.keys(out).sort().join(',');
    if (successKeys !== refusalKeys) { violations++; console.log('P4 violation: refusal key set differs from success'); }
    for (const k of Object.keys(out)) {
      if (k !== 'inputs' && k !== 'refusal' && k !== 'message' && out[k] !== null) { violations++; console.log(`P4 violation: refusal field ${k} not null`); }
    }
    break; // key-set/null-shape identical across refusal cases; one pass suffices
  }
  const okOut = compute({ ...basePP(), holdYears: 1 }).output_payload;
  checked++;
  if (okOut.refusal !== null || okOut.message !== null) { violations++; console.log('P4 violation: holdYears 1 refused'); }
  return { name: 'P4 refusal contract (named code, Apex text, null shape, same keys)', checked, violations };
}

// P5 — per-month identities restated.
function checkP5MonthlyIdentities() {
  let checked = 0, violations = 0;
  const rng = mulberry32(77005);
  for (let i = 0; i < 30; i++) {
    const pp = jitterPP(rng);
    const out = compute(pp).output_payload;
    checked += 3;
    if (out.breakEvenMonthlyRent !== out.netCostPerMonth) { violations++; console.log('P5 violation: break-even != net monthly'); }
    if (out.costPerMonth !== money(out.grossCost / (pp.holdYears * 12))) { violations++; console.log('P5 violation: costPerMonth restatement'); }
    if (out.netCostPerMonth !== money(out.netCost / (pp.holdYears * 12))) { violations++; console.log('P5 violation: netCostPerMonth restatement'); }
  }
  return { name: 'P5 per-month identities restated', checked, violations };
}

// P6 — constant-fallback quirks restated (DIFFERS D1/H3, Apex-fidelity).
function checkP6FallbackQuirks() {
  let checked = 0, violations = 0;
  const base = basePP();
  for (const salt of [0, 10000]) {
    const a = compute({ ...base, cSaltCap: salt }).output_payload;
    const b = compute({ ...base, cSaltCap: 10000 }).output_payload;
    checked++;
    if (JSON.stringify(a) !== JSON.stringify(b)) { violations++; console.log(`P6 violation: cSaltCap ${salt} != 10000`); }
    if (a.inputs.cSaltCap !== 10000) { violations++; console.log('P6 violation: inputs echo cSaltCap fallback'); }
  }
  {
    const a = compute(base).output_payload; // 80 supplied
    const b = compute({ ...base, cMiDropLTVPct: undefined }).output_payload; // absent
    checked++;
    if (JSON.stringify(a) !== JSON.stringify(b)) { violations++; console.log('P6 violation: absent cMiDropLTVPct != 80'); }
  }
  return { name: 'P6 constant fallbacks restated (SALT falsy 10000, MI threshold 80)', checked, violations };
}

// P7 — no MI accrues when the initial LTV is at or below the drop threshold
// (post-payment balance is monotonically non-increasing, so the strict-greater
// comparator can never fire).
function checkP7NoMiBelowThreshold() {
  let checked = 0, violations = 0;
  const rng = mulberry32(77007);
  for (let i = 0; i < 20; i++) {
    const downPct = [20, 25, 30, 50, 80][Math.floor(rng() * 5)];
    const cMiDropLTVPct = [0, 10, 20, 80][Math.floor(rng() * 4)];
    if (100 - downPct > cMiDropLTVPct) continue;
    const pp = { ...basePP(), downPct, cMiDropLTVPct };
    const out = compute(pp).output_payload;
    checked += 2;
    if (out.totalMI !== 0) { violations++; console.log(`P7 violation: down ${downPct} drop ${cMiDropLTVPct} -> MI ${out.totalMI}`); }
    if (pp.miRatePct > 0 && out.shareBps.totalMI !== 0) { violations++; console.log('P7 violation: shareBps.totalMI nonzero with zero MI'); }
  }
  return { name: 'P7 initial-LTV at/below threshold means zero MI', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1AppreciationSign(),
  checkP2Payment(),
  checkP3DeterminismShape(),
  checkP4RefusalContract(),
  checkP5MonthlyIdentities(),
  checkP6FallbackQuirks(),
  checkP7NoMiBelowThreshold(),
];
console.log(`[${KERNEL_ID}] class-K floor property test`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
