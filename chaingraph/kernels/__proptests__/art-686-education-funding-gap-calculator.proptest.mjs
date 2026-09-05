// art-686-education-funding-gap-calculator — class-K property-test FLOOR.
// Authored by EDUCATION-FUNDING-BUILD-1 per EDUCATION-FUNDING-BUILD-SPEC.md.
// kernel_digest_at_authoring: sha256:4883488338d36311fdf168018cfe449cc797e4fde9d5542f7e49947d640fafa9
// spec: EDUCATION-FUNDING-BUILD-SPEC.md (workspace root)
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-686-education-funding-gap-calculator.proptest.mjs

import { compute } from '../art-686-education-funding-gap-calculator.kernel.mjs';
import { runFixtureOracle, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-686-education-funding-gap-calculator';

// ---------- deterministic PRNG (xorshift32) ----------
let seed = 0x685e0a1f;
function rnd() {
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >> 17;
  seed ^= seed << 5; seed >>>= 0;
  return seed / 4294967296;
}
function randInt(lo, hi) { return lo + Math.floor(rnd() * (hi - lo + 1)); }

// Half-up 2dp reference rounding (independent of the kernel's helper).
function round2HalfUp(x) {
  const scaled = x * 100;
  const r = scaled < 0 ? -Math.floor(-scaled + 0.5) : Math.floor(scaled + 0.5);
  return r / 100;
}

// Deterministic integer-exponent power by repeated multiplication (mirrors the
// kernel's powInt; never Math.pow, which is implementation-defined).
function powInt(base, exp) {
  let result = 1;
  for (let i = 0; i < exp; i++) result *= base;
  return result;
}

// Property 1 — arithmetic + verdict consistency: fv equals the recomputed half-up
// compound growth, funding_gap equals goal - fv (half-up), and the verdict is
// GAP_COMPUTED iff funding_gap > 0, else GOAL_MET.
function checkArithmeticAndVerdict() {
  const N = 2000;
  let violations = 0;
  for (let i = 0; i < N; i++) {
    const goal = round2HalfUp(randInt(1, 500000) / 100);
    const years = randInt(1, 40);
    const rate = randInt(-5, 20);
    const balance = round2HalfUp(randInt(0, 400000) / 100);
    const { output_payload: o, compliance_flags } = compute({ goal, years, annual_return_pct: rate, current_balance: balance });
    if (compliance_flags.includes('DOMAIN_ERROR')) { violations++; continue; }
    const fv = round2HalfUp(balance * powInt(1 + rate / 100, years));
    const gap = round2HalfUp(goal - fv);
    const expect = gap > 0 ? 'GAP_COMPUTED' : 'GOAL_MET';
    if (o.fv_current_balance !== fv || o.funding_gap !== gap || o.overall !== expect) violations++;
  }
  return { name: 'fv/gap arithmetic + GAP_COMPUTED/GOAL_MET verdict', checked: N, violations };
}

// Property 2 — fail-closed: malformed inputs never produce a repaired projection;
// domain_errors names at least one offending field and outputs are all null.
function checkFailClosed() {
  const bad = [
    {},
    { goal: 0, years: 10, annual_return_pct: 5, current_balance: 20000 },
    { goal: -1, years: 10, annual_return_pct: 5, current_balance: 20000 },
    { goal: 120000, years: 0, annual_return_pct: 5, current_balance: 20000 },
    { goal: 120000, years: 10.5, annual_return_pct: 5, current_balance: 20000 },
    { goal: 120000, years: 101, annual_return_pct: 5, current_balance: 20000 },
    { goal: 120000, years: 10, annual_return_pct: -11, current_balance: 20000 },
    { goal: 120000, years: 10, annual_return_pct: 31, current_balance: 20000 },
    { goal: 120000, years: 10, annual_return_pct: '5', current_balance: 20000 },
    { goal: 120000, years: 10, annual_return_pct: 5, current_balance: -1 },
    { goal: 120000, years: 10, annual_return_pct: 5, current_balance: Infinity },
    { goal: 120000, years: 10, annual_return_pct: 5, current_balance: 20000, rollover_cap: '35000' },
    { goal: 120000, years: 10, annual_return_pct: 5, current_balance: 20000, rollover_cap: -1 },
  ];
  let checked = 0;
  let violations = 0;
  for (const pp of bad) {
    const { output_payload: o, compliance_flags } = compute(pp);
    checked++;
    if (!compliance_flags.includes('DOMAIN_ERROR') || o.overall !== null || o.fv_current_balance !== null || o.funding_gap !== null || !Array.isArray(o.domain_errors) || o.domain_errors.length === 0) violations++;
  }
  return { name: 'fail-closed on malformed inputs', checked, violations };
}

// Property 3 — determinism: same pp twice gives identical payloads; and a valid pp
// never reads a clock (the same pp at any later time must still be identical).
function checkDeterminism() {
  const N = 500;
  let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = { goal: randInt(1, 500000), years: randInt(1, 40), annual_return_pct: randInt(-5, 20), current_balance: randInt(0, 400000) };
    if (i % 3 === 0) pp.rollover_cap = randInt(0, 100000);
    const a = JSON.stringify(compute(pp));
    const b = JSON.stringify(compute(pp));
    if (a !== b) violations++;
  }
  return { name: 'determinism (pure function of pp)', checked: N, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkArithmeticAndVerdict(),
  checkFailClosed(),
  checkDeterminism(),
];
console.log(`[${KERNEL_ID}] class-K floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
