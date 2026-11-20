// art-793-government-stablecoin-acceptance — class-K property test floor.
// kernel_digest_at_authoring: sha256:d35efd76b9c97ae13a71db844e350570fc1a1748624f040938d56a4ecf39ba64
// spec: GOV-STABLECOIN-ACCEPTANCE-1 contract (aggregate-only acceptor-side acceptance audit)
// human_sign_off: PENDING
//
// Properties (class K):
//   P1 output-shape/verdict-enum — assessed outputs always carry the contract members and a
//      verdict from the closed {CONFORMS, CONFORMS_WITH_BREAKS, NONCONFORMING} enum; refused
//      outputs always carry refusal_reason + verdict REFUSED.
//   P2 reconciliation carry non-negativity — the per-token carry is never negative after
//      assessment (over-conversion is recorded as a RECEIPT_IDENTITY_BREAK and clamped).
//   P3 cap monotonicity — raising max_unconverted_value can never turn a non-NONCONFORMING
//      verdict into NONCONFORMING (relaxing the cap cannot create a policy breach).
//   P4 invalid-domain rejection — sub-minor-unit fractional money is refused, never rounded.
//   P5 determinism — identical inputs give deep-equal outputs.
//   P6 safe-integer gate — unsafe integers and unsafe running sums refuse.
//   P7 buildArtifact never throws on any unhashable input class.
//
// Run: node chaingraph/kernels/__proptests__/art-793-government-stablecoin-acceptance.proptest.mjs

import { compute, buildArtifact } from '../art-793-government-stablecoin-acceptance.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32 } from './_pbt-common.mjs';

const KERNEL_ID = 'art-793-government-stablecoin-acceptance';

const VERDICTS = new Set(['CONFORMS', 'CONFORMS_WITH_BREAKS', 'NONCONFORMING']);

const basePolicy = () => ({
  eligible_tokens: [{ token_code: 'USDC', issuer_regime: 'synthetic-regime' }],
  conversion_window_hours: 24,
  max_unconverted_value: 5000000,
  refund_rule: 'in_kind',
  custody: 'custodian',
  fiat_tolerance_value: 0,
});

function randReceipt(rng, day) {
  const received = Math.floor(rng() * 8000000);
  const converted = Math.floor(rng() * (received + 1));
  const refunds = Math.floor(rng() * (received - converted + 1));
  return {
    token_code: 'USDC', day,
    received_value: received,
    converted_value: converted,
    fiat_credited_value: converted - Math.floor(rng() * 3), // within 2 minor units short of converted
    refunds_value: refunds,
    max_hours_to_conversion: Math.floor(rng() * 48),
    conversion_rate_variance_bp: Math.floor(rng() * 30),
  };
}

// P1 — shape + closed verdict enum over random declared-domain inputs
function checkShapeAndVerdictEnum() {
  const rng = mulberry32(793001);
  let checked = 0, violations = 0;
  for (let i = 0; i < 200; i++) {
    const receipts = [];
    for (let d = 1; d <= 5; d++) receipts.push(randReceipt(rng, '2026-03-0' + d));
    const { output_payload } = compute({ profile: 'generic', policy: basePolicy(), receipts });
    checked++;
    if (!VERDICTS.has(output_payload.verdict)) { violations++; continue; }
    for (const k of ['policy_conformance', 'reconciliation', 'exposure', 'totals', 'rounding_rule']) {
      if (output_payload[k] === undefined) { violations++; break; }
    }
  }
  return { name: 'P1-shape-and-verdict-enum', checked, violations };
}

// P2 — carry non-negativity: no assessed total is negative and totals reconcile line sums
function checkCarryNonNegative() {
  const rng = mulberry32(793002);
  let checked = 0, violations = 0;
  for (let i = 0; i < 200; i++) {
    const receipts = [];
    for (let d = 1; d <= 4; d++) receipts.push(randReceipt(rng, '2026-03-0' + d));
    const { output_payload } = compute({ profile: 'generic', policy: basePolicy(), receipts });
    checked++;
    const t = output_payload.totals;
    if (t.closing_unconverted_value < 0 || t.peak_unconverted_value < 0) violations++;
    if (t.received_value !== receipts.reduce((a, r) => a + r.received_value, 0)) violations++;
  }
  return { name: 'P2-carry-non-negative', checked, violations };
}

// P3 — cap monotonicity: relaxing the cap never creates a NONCONFORMING verdict
function checkCapMonotonicity() {
  const rng = mulberry32(793003);
  let checked = 0, violations = 0;
  for (let i = 0; i < 200; i++) {
    const receipts = [];
    for (let d = 1; d <= 4; d++) receipts.push(randReceipt(rng, '2026-03-0' + d));
    const tight = compute({ profile: 'generic', policy: basePolicy(), receipts }).output_payload;
    const loose = compute({ profile: 'generic', policy: { ...basePolicy(), max_unconverted_value: 9007199254740991 }, receipts }).output_payload;
    checked++;
    if (tight.verdict !== 'NONCONFORMING' && loose.verdict === 'NONCONFORMING') violations++;
    if (loose.policy_conformance.cap_breach_days.length > tight.policy_conformance.cap_breach_days.length) violations++;
  }
  return { name: 'P3-cap-monotonicity', checked, violations };
}

// P4 — invalid-domain rejection: fractional money is refused, never rounded
function checkInvalidDomainRefused() {
  let checked = 0, violations = 0;
  const pp = { profile: 'generic', policy: basePolicy(), receipts: [{
    token_code: 'USDC', day: '2026-03-02', received_value: 1000.5, converted_value: 0,
    fiat_credited_value: 0, refunds_value: 0, max_hours_to_conversion: 0, conversion_rate_variance_bp: 0,
  }] };
  const { output_payload, compliance_flags } = compute(pp);
  checked++;
  if (output_payload.verdict !== 'REFUSED' || !compliance_flags.includes('REFUSED_NON_INTEGER_MONEY')) violations++;
  return { name: 'P4-fractional-money-refused', checked, violations };
}

// P5 — determinism: same input twice, deep-equal payload
function checkDeterminism() {
  const rng = mulberry32(793005);
  let checked = 0, violations = 0;
  for (let i = 0; i < 50; i++) {
    const receipts = [];
    for (let d = 1; d <= 3; d++) receipts.push(randReceipt(rng, '2026-03-0' + d));
    const pp = { profile: 'generic', policy: basePolicy(), receipts };
    const a = compute(pp).output_payload;
    const b = compute(pp).output_payload;
    checked++;
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
  }
  return { name: 'P5-determinism', checked, violations };
}

// P6 — safe-integer gate: an unsafe integer anywhere in the input refuses (never a verdict on a
// rounded value), and a sum that leaves the safe range refuses. Regression for the 2^53 cap
// counterexample (cap 2^53, receipts 2^53 and 1 once gave CONFORMS with a rounded total).
function checkSafeIntegerGate() {
  let checked = 0, violations = 0;
  const rcpt = (rv) => ({ token_code: 'USDC', day: '2026-03-02', received_value: rv, converted_value: 0, fiat_credited_value: 0, refunds_value: 0, max_hours_to_conversion: 0, conversion_rate_variance_bp: 0 });
  const unsafeCap = { profile: 'generic', policy: { ...basePolicy(), max_unconverted_value: 9007199254740992 }, receipts: [rcpt(9007199254740992), rcpt(1)] };
  const a = compute(unsafeCap);
  checked++;
  if (a.output_payload.verdict !== 'REFUSED' || a.output_payload.refusal_reason !== 'REFUSED_INPUT_UNSAFE_NUMBER') violations++;
  const sumPp = { profile: 'generic', policy: { ...basePolicy(), max_unconverted_value: 9007199254740991 }, receipts: [rcpt(9007199254740991), rcpt(1)] };
  const b = compute(sumPp);
  checked++;
  if (b.output_payload.verdict !== 'REFUSED' || b.output_payload.refusal_reason !== 'REFUSED_SUM_UNSAFE') violations++;
  const bigPp = { profile: 'generic', policy: { ...basePolicy(), max_unconverted_value: 1e300 }, receipts: [rcpt(1)] };
  const c = compute(bigPp);
  checked++;
  if (c.output_payload.verdict !== 'REFUSED') violations++;
  return { name: 'P6-safe-integer-gate', checked, violations };
}

// P7 — buildArtifact never throws: each unhashable class mints an artifact (null hash plus
// hash_refusal) instead of throwing.
async function checkBuildArtifactNeverThrows() {
  let checked = 0, violations = 0;
  const rcpt = (rv) => ({ token_code: 'USDC', day: '2026-03-02', received_value: rv, converted_value: 0, fiat_credited_value: 0, refunds_value: 0, max_hours_to_conversion: 0, conversion_rate_variance_bp: 0 });
  let deep = { x: 1 };
  for (let i = 0; i < 600; i++) deep = { x: deep };
  const junk = [
    { policy: basePolicy(), receipts: [rcpt(9007199254740992)] },
    { policy: basePolicy(), receipts: [rcpt(1e300)] },
    { policy: basePolicy(), receipts: [rcpt(NaN)] },
    { policy: basePolicy(), receipts: [rcpt(Infinity)] },
    { policy: basePolicy(), receipts: [rcpt(1)], extra: deep },
    null, undefined, 7, 'x', [],
  ];
  for (const pp of junk) {
    checked++;
    try {
      const art = await buildArtifact(pp);
      if (art.execution_hash === null && !art.hash_refusal) violations++;
    } catch (_e) { violations++; }
  }
  return { name: 'P7-buildArtifact-never-throws', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkShapeAndVerdictEnum(),
  checkCarryNonNegative(),
  checkCapMonotonicity(),
  checkInvalidDomainRefused(),
  checkDeterminism(),
  checkSafeIntegerGate(),
  await checkBuildArtifactNeverThrows(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — acceptance policy conformance + reconciliation.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
