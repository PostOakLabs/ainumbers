// art-685-direct-indexing-fit-screen — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:8bebade7234612a0a224757aa6c635ee00c4ff33248ddf6f4163cec2186cef6e
// spec: DIRECT-INDEXING-FIT-BUILD-SPEC.md (workspace root)
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-685-direct-indexing-fit-screen.proptest.mjs

import { compute } from '../art-685-direct-indexing-fit-screen.kernel.mjs';
import { runFixtureOracle, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-685-direct-indexing-fit-screen';

// Deterministic pseudo-random draws (LCG) — never Math.random(), the kernel and the
// property test must be reproducible byte-for-byte.
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function round2dpHalfUp(x) {
  const scaled = x * 100;
  const r = Math.sign(scaled) * Math.round(Math.abs(scaled) + Number.EPSILON * Math.abs(scaled));
  return r / 100;
}

// Class-A: net benefit equals declared alpha minus declared fee delta, at 2dp half-up,
// and the trace restates the same numbers.
function checkArithmeticIdentity() {
  const rand = lcg(685);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 300; i++) {
    const di = round2dpHalfUp(rand() * 100);
    const etf = round2dpHalfUp(rand() * 100);
    const alpha = round2dpHalfUp(rand() * 200 - 50);
    const pp = { portfolio_value: 100000 + Math.floor(rand() * 1000000), di_fee_bps: di, etf_expense_bps: etf, expected_tax_alpha_bps: alpha };
    const { output_payload } = compute(pp);
    const expectedDelta = round2dpHalfUp(di - etf);
    const expectedNet = round2dpHalfUp(alpha - expectedDelta);
    checked++;
    if (output_payload.fee_delta_bps !== expectedDelta || output_payload.net_benefit_bps !== expectedNet) {
      violations++;
      continue;
    }
    if (!output_payload.trace.includes(`= ${expectedNet} bps net of the declared fee delta`)) violations++;
  }
  return { name: 'arithmetic-identity-alpha-minus-fee-delta', checked, violations };
}

// Class-B: verdict enum tracks the sign of net_benefit_bps exactly (positive, negative, zero
// reachable) — the verdict describes the declared arithmetic, nothing more.
function checkVerdictTracksSign() {
  const cases = [
    { pp: { portfolio_value: 100, di_fee_bps: 5, etf_expense_bps: 1, expected_tax_alpha_bps: 40 }, want: 'FIT_POSITIVE' },
    { pp: { portfolio_value: 100, di_fee_bps: 25, etf_expense_bps: 3, expected_tax_alpha_bps: 10 }, want: 'FIT_NEGATIVE' },
    { pp: { portfolio_value: 100, di_fee_bps: 12, etf_expense_bps: 4, expected_tax_alpha_bps: 8 }, want: 'FIT_NEUTRAL' },
  ];
  let checked = 0;
  let violations = 0;
  for (const c of cases) {
    const { output_payload } = compute(c.pp);
    checked++;
    if (output_payload.overall !== c.want) violations++;
  }
  const rand = lcg(1685);
  for (let i = 0; i < 200; i++) {
    const di = round2dpHalfUp(rand() * 50);
    const etf = round2dpHalfUp(rand() * 50);
    const alpha = round2dpHalfUp(rand() * 100);
    const { output_payload } = compute({ portfolio_value: 1000, di_fee_bps: di, etf_expense_bps: etf, expected_tax_alpha_bps: alpha });
    const want = output_payload.net_benefit_bps > 0 ? 'FIT_POSITIVE' : output_payload.net_benefit_bps < 0 ? 'FIT_NEGATIVE' : 'FIT_NEUTRAL';
    checked++;
    if (output_payload.overall !== want) violations++;
  }
  return { name: 'verdict-enum-tracks-net-benefit-sign', checked, violations };
}

// Class-K invalid-domain rejection: each required input, when missing or malformed,
// throws (never silently computes), and the output shape stays within the declared schema.
function checkInvalidDomainRejection() {
  const bad = [
    { portfolio_value: -1, di_fee_bps: 9, etf_expense_bps: 3, expected_tax_alpha_bps: 45 },
    { portfolio_value: 0, di_fee_bps: 9, etf_expense_bps: 3, expected_tax_alpha_bps: 45 },
    { portfolio_value: 1000, di_fee_bps: -1, etf_expense_bps: 3, expected_tax_alpha_bps: 45 },
    { portfolio_value: 1000, di_fee_bps: 9, etf_expense_bps: -3, expected_tax_alpha_bps: 45 },
    { portfolio_value: 1000, di_fee_bps: 9, etf_expense_bps: 3 },
    { portfolio_value: 1000, di_fee_bps: 9, etf_expense_bps: 3, expected_tax_alpha_bps: '45' },
    { portfolio_value: 1000, di_fee_bps: 9, etf_expense_bps: 3, expected_tax_alpha_bps: 45, years_held: -2, alpha_exhaustion_years: 5 },
    { portfolio_value: 1000, di_fee_bps: 9, etf_expense_bps: 3, expected_tax_alpha_bps: 45, concentrated_stock_position: 'yes' },
  ];
  let checked = 0;
  let violations = 0;
  for (const pp of bad) {
    let threw = false;
    try { compute(pp); } catch { threw = true; }
    checked++;
    if (!threw) violations++;
  }
  return { name: 'invalid-domain-rejection-throws', checked, violations };
}

// Output-shape: canonical-parity vector carries exactly the four declared members;
// optional members appear only when their inputs are declared; determinism over repeats.
function checkOutputShapeAndDeterminism() {
  const canonical = { portfolio_value: 250000, di_fee_bps: 9, etf_expense_bps: 3, expected_tax_alpha_bps: 45 };
  let checked = 0;
  let violations = 0;
  const a = compute(canonical).output_payload;
  const b = compute(canonical).output_payload;
  checked++;
  if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
  checked++;
  if (JSON.stringify(Object.keys(a).sort()) !== JSON.stringify(['fee_delta_bps', 'net_benefit_bps', 'overall', 'trace'])) violations++;
  const withOptional = compute({ ...canonical, years_held: 6, alpha_exhaustion_years: 5, concentrated_stock_position: true }).output_payload;
  checked++;
  if (JSON.stringify(Object.keys(withOptional).sort()) !== JSON.stringify(['concentrated_stock_note', 'exhaustion_warning', 'fee_delta_bps', 'net_benefit_bps', 'overall', 'trace', 'warnings'])) violations++;
  return { name: 'output-shape-and-determinism', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkArithmeticIdentity(),
  checkVerdictTracksSign(),
  checkInvalidDomainRejection(),
  checkOutputShapeAndDeterminism(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — Direct-Indexing Fit Screen.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
