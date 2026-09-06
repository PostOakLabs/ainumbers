// art-686-ltc-funding-comparator — class-K property-test FLOOR.
// Authored by LTC-COMPARATOR-BUILD-1 per LTC-COMPARATOR-BUILD-SPEC.md.
// kernel_digest_at_authoring: sha256:c2eeb9ad5fe1d0a784bf15f6c3f8a66fbd786a954be75ceaa674755f85586727
// spec: LTC-COMPARATOR-BUILD-SPEC.md (workspace root)
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-686-ltc-funding-comparator.proptest.mjs

import { compute } from '../art-686-ltc-funding-comparator.kernel.mjs';
import { runFixtureOracle, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-686-ltc-funding-comparator';

// ---------- deterministic PRNG (xorshift32) ----------
let seed = 0x6861ca7f;
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

// Property 1 — arithmetic + verdict consistency: each total equals the recomputed
// half-up simple sum (hybrid is a lump, no multiplication), the cheapest option is
// the unique minimum, and the verdict is CHEAPEST_IDENTIFIED exactly when the
// minimum is unique (else TIE_IDENTIFIED with cheapest null).
function checkArithmeticAndVerdict() {
  const N = 2000;
  let violations = 0;
  for (let i = 0; i < N; i++) {
    const years = randInt(1, 40);
    const sf = randInt(0, 60000);
    const hy = randInt(0, 600000);
    const ta = randInt(0, 60000);
    const { output_payload: o, compliance_flags } = compute({ horizon_years: years, self_fund_annual: sf, hybrid_premium_total: hy, traditional_annual: ta });
    if (compliance_flags.includes('DOMAIN_ERROR')) { violations++; continue; }
    const sfT = round2HalfUp(sf * years);
    const hyT = round2HalfUp(hy);
    const taT = round2HalfUp(ta * years);
    const totals = { self_fund: sfT, hybrid: hyT, traditional: taT };
    const min = Math.min(sfT, hyT, taT);
    const winners = Object.keys(totals).filter((k) => totals[k] === min);
    const expectOverall = winners.length === 1 ? 'CHEAPEST_IDENTIFIED' : 'TIE_IDENTIFIED';
    const expectCheapest = winners.length === 1 ? winners[0] : null;
    if (o.self_fund_total !== sfT || o.hybrid_total !== hyT || o.traditional_total !== taT || o.overall !== expectOverall || o.cheapest !== expectCheapest) violations++;
  }
  return { name: 'simple-sum totals + CHEAPEST_IDENTIFIED/TIE_IDENTIFIED verdict', checked: N, violations };
}

// Property 2 — fail-closed: malformed inputs never produce a repaired projection;
// domain_errors names at least one offending field and outputs are all null.
function checkFailClosed() {
  const bad = [
    {},
    { horizon_years: 0, self_fund_annual: 4800, hybrid_premium_total: 110000, traditional_annual: 3200 },
    { horizon_years: 101, self_fund_annual: 4800, hybrid_premium_total: 110000, traditional_annual: 3200 },
    { horizon_years: 12.5, self_fund_annual: 4800, hybrid_premium_total: 110000, traditional_annual: 3200 },
    { horizon_years: 25, self_fund_annual: -1, hybrid_premium_total: 110000, traditional_annual: 3200 },
    { horizon_years: 25, self_fund_annual: '4800', hybrid_premium_total: 110000, traditional_annual: 3200 },
    { horizon_years: 25, self_fund_annual: Infinity, hybrid_premium_total: 110000, traditional_annual: 3200 },
    { horizon_years: 25, self_fund_annual: 4800, hybrid_premium_total: -110000, traditional_annual: 3200 },
    { horizon_years: 25, self_fund_annual: 4800, hybrid_premium_total: 1000000001, traditional_annual: 3200 },
    { horizon_years: 25, self_fund_annual: 4800, hybrid_premium_total: 110000, traditional_annual: null },
    { horizon_years: 25, self_fund_annual: 4800, hybrid_premium_total: 110000, traditional_annual: NaN },
  ];
  let checked = 0;
  let violations = 0;
  for (const pp of bad) {
    const { output_payload: o, compliance_flags } = compute(pp);
    checked++;
    if (!compliance_flags.includes('DOMAIN_ERROR') || o.overall !== null || o.self_fund_total !== null || o.hybrid_total !== null || o.traditional_total !== null || o.cheapest !== null || !Array.isArray(o.domain_errors) || o.domain_errors.length === 0) violations++;
  }
  return { name: 'fail-closed on malformed inputs', checked, violations };
}

// Property 3 — determinism: same pp twice gives identical payloads; and a valid pp
// never reads a clock (the same pp at any later time must still be identical).
function checkDeterminism() {
  const N = 500;
  let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = { horizon_years: randInt(1, 40), self_fund_annual: randInt(0, 60000), hybrid_premium_total: randInt(0, 600000), traditional_annual: randInt(0, 60000) };
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
