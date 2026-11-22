// art-852-se-tax-and-deductions — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:71940baab48bcc0b613ad16a814122b0fda26b32ad6c39ab6710f91a5b79da46
// spec: SE-TAX-NODE-SPEC-2026-11 (rows SE-TAX-SPEC-1 / SE-TAX-NODE-1), sections 5, 6, 7, 8
// human_sign_off: PENDING
//
// Checks: fixture-oracle gate (all 18 stored vectors, deep-equal); P1 determinism and
// output shape; P2 the rate-split algebra (parts vs total cent-divergence bound, OASDI
// cap coordination, uncapped HI, threshold reduction, half deduction excluding the
// additional tax); P3 monotonicity and the 400 dollar floor edge; P4 refusal contract
// (year gate, optional-method guard, wrong types, present-null, enum, prototype-name
// keys, absent-null equivalence for the optional church input); P5
// buildArtifact_never_throws on unhashable input (deep, wide, cyclic, non-finite,
// unsafe integers) with null execution_hash plus hash_refusal, and a real hash on
// clean input.
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-852-se-tax-and-deductions.proptest.mjs

import { compute, buildArtifact } from '../art-852-se-tax-and-deductions.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, findShapeViolations } from './_pbt-common.mjs';

const KERNEL_ID = 'art-852-se-tax-and-deductions';
const SEED = 852;
const N = 240;
const STATUSES = ['single', 'mfj', 'mfs', 'hoh', 'qss'];
const THRESHOLDS = { single: 200000, mfj: 250000, mfs: 125000, hoh: 200000, qss: 200000 };
const THRESHOLDS_C = { single: 20000000, mfj: 25000000, mfs: 12500000, hoh: 20000000, qss: 20000000 };
const BASES = { 2025: 176100, 2026: 184500 };

function near(a, b, tol = 0.011) { return Math.abs(a - b) <= tol; }

function randInputs(rng) {
  const pp = {
    tax_year: rng() < 0.5 ? 2025 : 2026,
    filing_status: STATUSES[Math.floor(rng() * STATUSES.length)],
    net_se_profit: Math.round((rng() * 300000 - 5000) * 100) / 100,
    w2_wages_ss: Math.round(rng() * 184500 * 100) / 100,
  };
  if (rng() < 0.25) pp.church_employee_income = Math.round(rng() * 5000 * 100) / 100;
  return pp;
}

function checkP1Determinism() {
  const rng = mulberry32(SEED + 1); let checked = 0, violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randInputs(rng);
    const a = compute(pp), b = compute(JSON.parse(JSON.stringify(pp)));
    checked++;
    if (JSON.stringify(a) !== JSON.stringify(b)) { violations++; console.log('P1 violation: nondeterministic'); }
    const sv = findShapeViolations(a.output_payload);
    if (sv.length) { violations++; console.log('P1 violation: ' + sv[0]); }
    if (a.output_payload.not_tax_advice !== true) { violations++; console.log('P1 violation: missing not-tax-advice marker'); }
  }
  return { name: 'P1 determinism, shape and not-tax-advice marker', checked, violations };
}

function checkP2RateSplit() {
  const rng = mulberry32(SEED + 2); let checked = 0, violations = 0;
  // every expectation below is computed in integer cents with Math.round, mirroring
  // the kernel's exact BigInt path, so the comparison never sees float fuzz
  const halfUpCents = (dollars) => Math.round(dollars * 100);
  for (let i = 0; i < N; i++) {
    const o = compute(randInputs(rng)).output_payload;
    if (!o.valid_input) { violations++; console.log('P2 violation: valid input refused: ' + o.domain_errors[0]); continue; }
    checked++;
    // exact mirror of the kernel pipeline: everything in a 1e4-scaled integer
    // (hundredths of a cent), floors applied to unrounded values, one rounding
    const pC = halfUpCents(Math.max(0, o.net_se_profit_input));
    const ncNum = pC * 9235;
    const ncTaxNum = ncNum < 400000000 ? 0 : ncNum;
    const chGiven = o.church_income_included !== null;
    const chInC = chGiven ? halfUpCents(o.church_employee_income_input) : 0;
    const chNum = chGiven && o.church_income_included === true ? chInC * 9235 : 0;
    const chTaxNum = chNum < 100000000 ? 0 : chNum;
    const neNum = ncTaxNum + chTaxNum;
    if (!near(o.non_church_net_earnings, ncNum / 1000000, 0.005)) { violations++; console.log('P2 violation: non-church net earnings factor on profit ' + pC / 100); }
    if (chGiven && !near(o.church_net_earnings, chNum / 1000000, 0.005)) { violations++; console.log('P2 violation: church net earnings factor'); }
    if (!near(o.net_earnings, neNum / 1000000, 0.005)) { violations++; if (violations < 4) console.log('P2 dump: ' + JSON.stringify({ p: o.net_se_profit_input, w: o.w2_wages_ss_input, ch: o.church_employee_income_input, incl: o.church_income_included, got_ne: o.net_earnings, got_nc: o.non_church_net_earnings, got_ch: o.church_net_earnings, exp_ne: neNum / 1000000, ncNum, chNum, flags: o.warnings })); console.log('P2 violation: net earnings identity (floors applied separately) on profit ' + pC / 100); }
    // parts vs total: the total rounds from the unrounded sum of the parts
    if (!near(o.se_tax_total, o.se_tax_oasdi + o.se_tax_medicare, 0.011)) { violations++; console.log('P2 violation: total vs parts beyond one cent'); }
    const diverges = Math.abs(o.se_tax_oasdi + o.se_tax_medicare - o.se_tax_total) > 0.0000001;
    if (diverges !== (typeof o.parts_vs_total_rounding_note === 'string' && o.parts_vs_total_rounding_note !== null)) { violations++; console.log('P2 violation: rounding note presence does not match the divergence'); }
    // half deduction is half the unrounded total, never includes the additional tax
    if (!near(o.half_se_deduction * 2, o.se_tax_total, 0.011)) { violations++; console.log('P2 violation: half deduction off total'); }
    if (o.half_se_deduction < 0) { violations++; console.log('P2 violation: negative half deduction'); }
    // OASDI cap coordination
    const baseC = halfUpCents(o.oasdi_base);
    const wC = halfUpCents(o.w2_wages_ss_input);
    const roomNum = Math.max(0, baseC - wC) * 10000;
    const capNum = Math.min(neNum, roomNum);
    const capC = Math.round(capNum * 1240 / 100000000);
    if (!near(o.se_tax_oasdi, capC / 100, 0.005)) { violations++; console.log('P2 violation: OASDI cap algebra'); }
    if (!near(o.oasdi_taxable_net_earnings, capNum / 1000000, 0.005)) { violations++; console.log('P2 violation: taxable OASDI earnings above the room'); }
    // HI is uncapped 2.9 percent of net earnings
    if (!near(o.se_tax_medicare, Math.round(neNum * 290 / 100000000) / 100, 0.005)) { violations++; console.log('P2 violation: HI algebra'); }
    // Additional Medicare: threshold by status, reduced by wages, on net earnings
    const thrC = THRESHOLDS_C[o.filing_status];
    const tRedC = Math.max(0, thrC - wC);
    if (halfUpCents(o.additional_medicare_threshold) !== thrC) { violations++; console.log('P2 violation: threshold value for ' + o.filing_status); }
    if (halfUpCents(o.additional_medicare_threshold_reduced) !== tRedC) { violations++; console.log('P2 violation: reduced threshold'); }
    const addlC = Math.round(Math.max(0, neNum - tRedC * 10000) * 90 / 100000000);
    if (!near(o.additional_medicare, addlC / 100, 0.005)) { violations++; console.log('P2 violation: additional medicare algebra'); }
  }
  return { name: 'P2 rate-split, cap coordination, threshold reduction and half-deduction algebra', checked, violations };
}

function checkP3MonotoneAndFloor() {
  const rng = mulberry32(SEED + 3); let checked = 0, violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randInputs(rng);
    if (pp.net_se_profit < 0) continue;
    const a = compute(pp).output_payload, b = compute({ ...pp, net_se_profit: pp.net_se_profit * 2 }).output_payload;
    if (!a.valid_input || !b.valid_input) continue;
    checked++;
    if (b.net_earnings < a.net_earnings - 0.0000001) { violations++; console.log('P3 violation: net earnings decreased when profit doubled'); }
    if (b.se_tax_total < a.se_tax_total - 0.0000001) { violations++; console.log('P3 violation: total tax decreased when profit doubled'); }
    if (b.additional_medicare < a.additional_medicare - 0.0000001) { violations++; console.log('P3 violation: additional medicare decreased when profit doubled'); }
  }
  // the floor edge: net earnings reach the 400 dollar floor from a profit of about
  // 433.14 (40000 cents of net earnings needs 400000000/9235 = 43313.48... cents of
  // profit); just below it the tax is zero with the flag, just above it is positive
  const below = compute({ tax_year: 2025, filing_status: 'single', net_se_profit: 433.13, w2_wages_ss: 0 }).output_payload;
  checked++;
  if (below.se_tax_total !== 0 || below.net_earnings !== 0) { violations++; console.log('P3 violation: below-floor profit still taxed: ' + JSON.stringify({ t: below.se_tax_total, ne: below.net_earnings })); }
  const above = compute({ tax_year: 2025, filing_status: 'single', net_se_profit: 433.15, w2_wages_ss: 0 }).output_payload;
  checked++;
  if (!(above.net_earnings >= 400) || !(above.se_tax_total > 0)) { violations++; console.log('P3 violation: above-floor profit produced no tax: ' + JSON.stringify({ t: above.se_tax_total, ne: above.net_earnings })); }
  return { name: 'P3 monotonicity under doubling and the 400 dollar floor edge', checked, violations };
}

function checkP4RefusalContract() {
  const base = { tax_year: 2025, filing_status: 'single', net_se_profit: 50000, w2_wages_ss: 0 };
  let checked = 0, violations = 0;
  const nonObjects = [null, undefined, 5, 'x', [], true];
  for (const pp of nonObjects) {
    checked++;
    const o = compute(pp).output_payload;
    if (o.valid_input !== false || o.refusal_code !== 'REFUSED_INPUT_WRONG_TYPE') { violations++; console.log('P4 violation: non-object not refused by name'); }
  }
  const deltas = [
    { tax_year: 2024, code: 'LOOKUP_YEAR_UNAVAILABLE' },
    { tax_year: '2025', code: 'LOOKUP_YEAR_UNAVAILABLE' },
    { tax_year: null, code: 'LOOKUP_YEAR_UNAVAILABLE' },
    { method: 'farm', code: 'OPTIONAL_METHOD_UNSUPPORTED' },
    { method: 'nonfarm', code: 'OPTIONAL_METHOD_UNSUPPORTED' },
    { method: 'farm_and_nonfarm', code: 'OPTIONAL_METHOD_UNSUPPORTED' },
    { method: 'both', code: 'REFUSED_INPUT_NOT_IN_ENUM' },
    { filing_status: 'SINGLE', code: 'REFUSED_INPUT_NOT_IN_ENUM' },
    { filing_status: null, code: 'REFUSED_INPUT_NOT_IN_ENUM' },
    { net_se_profit: '50000', code: 'REFUSED_INPUT_WRONG_TYPE' },
    { net_se_profit: null, code: 'REFUSED_INPUT_WRONG_TYPE' },
    { net_se_profit: Number.POSITIVE_INFINITY, code: 'REFUSED_INPUT_UNSAFE_NUMBER' },
    { w2_wages_ss: -1, code: 'REFUSED_INPUT_WRONG_TYPE' },
    { w2_wages_ss: null, code: 'REFUSED_INPUT_WRONG_TYPE' },
    { church_employee_income: -5, code: 'REFUSED_INPUT_WRONG_TYPE' },
  ];
  for (const d of deltas) {
    checked++;
    const pp = { ...base, ...d };
    const o = compute(pp).output_payload;
    if (o.valid_input !== false) { violations++; console.log('P4 violation: accepted ' + JSON.stringify(d)); }
    else if (o.refusal_code !== d.code) { violations++; console.log('P4 violation: ' + JSON.stringify(d) + ' code ' + o.refusal_code); }
  }
  // a positive church amount under 108.28 is an exclusion, not an error; a present
  // null church input behaves exactly like an absent one
  const churchLow = compute({ ...base, church_employee_income: 50 }).output_payload;
  checked++;
  if (churchLow.valid_input !== true || !churchLow.warnings.includes('CHURCH_BELOW_FLOOR')) { violations++; console.log('P4 violation: low church income not flagged as excluded'); }
  const absent = compute(base).output_payload;
  const explicitNull = compute({ ...base, church_employee_income: null }).output_payload;
  checked++;
  if (JSON.stringify(absent) !== JSON.stringify(explicitNull)) { violations++; console.log('P4 violation: null church form differs from absent form'); }
  // prototype-name keys are ordinary keys and must not change the verdict
  checked++;
  const proto = JSON.parse(JSON.stringify(base).slice(0, -1) + ',"constructor":5,"toString":"x","__proto__":{"tax_year":2026}}');
  if (JSON.stringify(compute(proto).output_payload) !== JSON.stringify(compute(base).output_payload)) { violations++; console.log('P4 violation: prototype-name keys changed the output'); }
  return { name: 'P4 refusal contract, year gate, optional-method guard, presence rules', checked, violations };
}

async function checkP5BuildArtifactNeverThrows() {
  let checked = 0, violations = 0;
  const rng = mulberry32(SEED + 5);
  /** @type {any} */ let deep = 1; for (let i = 0; i < 600; i++) deep = [deep];
  const wide = new Array(1000001).fill(0);
  const cyc = { ok: true }; cyc.self = cyc;
  const deltas = [
    { zzz: 1e300 }, { zzz: Infinity }, { zzz: NaN },
    { zzz: { a: [Number.MAX_SAFE_INTEGER + 2] } },
    { zzz: deep }, { zzz: wide }, { zzz: cyc },
  ];
  for (const delta of deltas) {
    checked++;
    try {
      const art = await buildArtifact({ ...randInputs(rng), ...delta });
      const r = art.hash_refusal;
      if (art.execution_hash !== null || !r || !/^(REFUSED_INPUT_UNSAFE_NUMBER|REFUSED_INPUT_HASH_LIMIT|REFUSED_INPUT_UNHASHABLE_CYCLE)$/.test(r.reason)) {
        violations++; console.log('P5 violation: artifact shape on hostile input: ' + JSON.stringify(r));
      }
      if (art.output_payload.valid_input !== false) { violations++; console.log('P5 violation: compute accepted hostile input'); }
    } catch (e) { violations++; console.log('P5 violation: buildArtifact threw: ' + String(e && e.message).slice(0, 80)); }
  }
  for (const pp of [randInputs(rng), null, 5, []]) {
    checked++;
    try {
      const art = await buildArtifact(pp);
      if (!/^[0-9a-f]{64}$/.test(art.execution_hash) || art.hash_refusal !== undefined) { violations++; console.log('P5 violation: clean input lost its hash'); }
    } catch (e) { violations++; console.log('P5 violation: buildArtifact threw on a clean input: ' + String(e && e.message).slice(0, 80)); }
  }
  return { name: 'buildArtifact_never_throws (null hash plus hash_refusal on unhashable, hash on clean)', checked, violations };
}

let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1Determinism(), checkP2RateSplit(), checkP3MonotoneAndFloor(),
  checkP4RefusalContract(), await checkP5BuildArtifactNeverThrows(),
];
console.log('[' + KERNEL_ID + '] class-K floor property test.');
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
