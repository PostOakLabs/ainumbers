// art-782-modified-premium — class-K property-test FLOOR (KERNEL-SCAFFOLD-1 scaffold, authored).
// kernel_digest_at_authoring: sha256:92a9428b25c9a25d1be8b834795a16a72e993668f04d9d467351593594c6517e
// spec: modified premium = subject premium × experience modification, whole dollars
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md). NOT a proof.
// float_sensitive: YES (subject_premium × mod is float multiplication; the whole-dollar
// rounding is a .50 half-up boundary decision) — ULP-boundary forcing is included below
// per spec §3.
// Checks: fixture-oracle gate; monotonicity in subject_premium for a fixed positive mod;
// a positive mod never yields a negative premium; the mod-0 case never yields a number
// (it flags); non-finite / negative inputs never emit NaN or Infinity anywhere; rounding
// differential re-derivation vs the pinned nearest-dollar rule; determinism.
// Zero external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-782-modified-premium.proptest.mjs

import { compute } from '../art-782-modified-premium.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, findShapeViolations } from './_pbt-common.mjs';

const KERNEL_ID = 'art-782-modified-premium';
const rand = mulberry32(0x782D0);

// Monotone in subject_premium for a fixed positive mod: larger subject premium never
// yields a smaller modified premium (whole-dollar rounding is monotone non-decreasing).
function checkMonotoneInSubjectPremium() {
  let checked = 0, violations = 0;
  for (let i = 0; i < 400; i++) {
    const mod = Math.round((0.5 + rand() * 2) * 100) / 100;
    const s1 = Math.round(rand() * 500000 * 100) / 100;
    const s2 = s1 + Math.round(rand() * 10000 * 100) / 100;
    const a = compute({ mod, subject_premium: s1 }).output_payload.modified_premium;
    const b = compute({ mod, subject_premium: s2 }).output_payload.modified_premium;
    if (typeof a !== 'number' || typeof b !== 'number' || b < a) violations++;
    checked++;
  }
  return { name: 'monotone_in_subject_premium_for_fixed_positive_mod', checked, violations };
}

// A positive mod never yields a negative premium, and the premium never exceeds the
// rounded product of the inputs.
function checkNonNegativeAndBounded() {
  let checked = 0, violations = 0;
  for (let i = 0; i < 400; i++) {
    const mod = Math.round((0.01 + rand() * 4) * 100) / 100;
    const subject = Math.round(rand() * 1000000 * 100) / 100;
    const out = compute({ mod, subject_premium: subject }).output_payload;
    if (typeof out.modified_premium !== 'number' || out.modified_premium < 0) violations++;
    checked++;
  }
  return { name: 'positive_mod_never_yields_negative_premium', checked, violations };
}

// The mod-0 case (the experience-modification node's undetermined-rating output) must
// never yield a number: modified_premium is null, the flag fires, and no NaN/Infinity
// escapes anywhere in the payload. Boundary-adjacent mod values (exactly 0, tiny
// positive, tiny negative) are forced explicitly.
function checkZeroModNeverYieldsNumber() {
  let checked = 0, violations = 0;
  const forced = [0, -0, -1e-9, -0.001, -2.38];
  for (let i = 0; i < 200; i++) forced.push(-rand() * 3);
  for (const mod of forced) {
    const { output_payload, compliance_flags } = compute({ mod, subject_premium: 10000 });
    if (typeof output_payload.modified_premium === 'number') violations++;
    if (output_payload.modified_premium !== null) violations++;
    if (!compliance_flags.includes('NONPOSITIVE_MOD')) violations++;
    if (findShapeViolations(output_payload).length) violations++;
    checked++;
  }
  return { name: 'nonpositive_mod_flags_and_never_yields_a_number', checked, violations };
}

// Non-finite or negative inputs resolve to a flag and never emit NaN or Infinity
// anywhere. Nasty inputs are cycled over both keys.
function checkInvalidInputsNeverEmitNonFinite() {
  let checked = 0, violations = 0;
  const nasties = [undefined, null, NaN, Infinity, -Infinity, 'abc', '', [], {}, '1e999'];
  for (let i = 0; i < 300; i++) {
    const key = i % 2 === 0 ? 'mod' : 'subject_premium';
    const nasty = i < nasties.length ? nasties[i] : (rand() < 0.5 ? NaN : undefined);
    const pp = { mod: 1.15, subject_premium: 20000, [key]: nasty };
    const { output_payload, compliance_flags } = compute(pp);
    const shape = findShapeViolations(output_payload);
    if (shape.length) violations++;
    if (output_payload.modified_premium !== null) violations++;
    if (compliance_flags.length === 0) violations++;
    checked++;
  }
  return { name: 'invalid_inputs_flag_and_never_emit_nan_or_infinity', checked, violations };
}

// Differential re-derivation of the pinned rounding rule: the premium equals the
// subject×mod product rounded to whole dollars, half-up (nearest dollar, remainder of
// $0.50 or more to the next higher dollar). ULP-boundary forcing around .5 products.
function checkRoundingRule() {
  let checked = 0, violations = 0;
  for (let i = 0; i < 400; i++) {
    const subject = Math.round(rand() * 200000 * 100) / 100;
    const mod = Math.round((0.5 + rand() * 2) * 100) / 100;
    // half-up whole dollars via decimal-integer arithmetic on cents
    const cents = Math.round(subject * mod * 100);
    const dollars = Math.floor(cents / 100);
    const rem = cents - dollars * 100;
    const want = rem >= 50 ? dollars + 1 : dollars;
    const got = compute({ mod, subject_premium: subject }).output_payload.modified_premium;
    if (got !== want) violations++;
    checked++;
    // ULP nudge around exact .50-dollar products must round UP (next higher dollar)
    if (i < 40) {
      const s = 1000 + i;
      const halfUp = compute({ mod: 1.005, subject_premium: s }).output_payload.modified_premium;
      const centsH = Math.round(s * 1.005 * 100);
      const dH = Math.floor(centsH / 100);
      const wantH = (centsH - dH * 100) >= 50 ? dH + 1 : dH;
      if (halfUp !== wantH) violations++;
      checked++;
    }
  }
  return { name: 'whole_dollar_half_up_rounding_differential', checked, violations };
}

// Determinism: same pp, same payload, byte-for-byte, across repeated calls.
function checkDeterminism() {
  let checked = 0, violations = 0;
  for (let i = 0; i < 100; i++) {
    const pp = { mod: Math.round(rand() * 300) / 100, subject_premium: Math.round(rand() * 100000) };
    const a = JSON.stringify(compute(pp));
    const b = JSON.stringify(compute(pp));
    if (a !== b) violations++;
    checked++;
  }
  return { name: 'determinism', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkMonotoneInSubjectPremium(),
  checkNonNegativeAndBounded(),
  checkZeroModNeverYieldsNumber(),
  checkInvalidInputsNeverEmitNonFinite(),
  checkRoundingRule(),
  checkDeterminism(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — modified premium (subject premium × experience mod).`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
