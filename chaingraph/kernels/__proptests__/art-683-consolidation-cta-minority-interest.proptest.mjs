// art-683-consolidation-cta-minority-interest — class-K property-test FLOOR. Authored by CONSOLIDATION-CTA-BUILD-1
// per FV-PBT-FLOOR-BUILD-SPEC.md.
// kernel_digest_at_authoring: sha256:b7ec0688403a72ffdb32ee7b1748d3ef2eefe8f5d5c88a05ec33009ad14d7b2e
// spec: CONSOLIDATION-CTA-BUILD-SPEC.md (canonical preimage, execution_hash pinned at staging:
// 29713a75d87ece357de41777c93e491acf3c752216ca9f4fbb3007b924f42c49)
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-683-consolidation-cta-minority-interest.proptest.mjs

import { compute } from '../art-683-consolidation-cta-minority-interest.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, deepEqual, findShapeViolations } from './_pbt-common.mjs';

const KERNEL_ID = 'art-683-consolidation-cta-minority-interest';

function round2(n) {
  return Math.sign(n) * Math.round(Math.abs(n) * 100 + Number.EPSILON * Math.abs(n) * 100) / 100;
}

// P1: translation / CTA / split identity on the success path. For random
// well-formed inputs: equity_at_current and equity_at_historical are the
// declared equity translated at the declared rates (2dp half-up), cta is
// their difference, the parent/minority split is at the declared ownership,
// and the split always sums back to equity_at_current.
function checkConsolidationArithmetic() {
  const rng = mulberry32(683);
  let checked = 0; const violations = [];
  for (let i = 0; i < 300; i++) {
    const equity = round2(rng() * 1000000) + 0.01;
    const rateCurrent = round2(rng() * 2) + 0.01;
    const rateHistorical = round2(rng() * 2) + 0.01;
    const ownership = round2(rng() * 99) + 0.5;
    const pp = { sub_equity_fc: equity, rate_current: rateCurrent, rate_historical: rateHistorical, parent_ownership_pct: ownership };
    const { output_payload: op, compliance_flags } = compute(pp);
    checked++;
    const ec = round2(equity * rateCurrent);
    const eh = round2(equity * rateHistorical);
    if (op.equity_at_current !== ec) violations.push(`equity_at_current ${op.equity_at_current} != ${ec}`);
    if (op.equity_at_historical !== eh) violations.push(`equity_at_historical ${op.equity_at_historical} != ${eh}`);
    if (op.cta !== round2(ec - eh)) violations.push(`cta ${op.cta} != difference`);
    const ps = round2(ec * ownership / 100);
    if (op.parent_share !== ps) violations.push(`parent_share ${op.parent_share} != ${ps}`);
    if (op.minority_interest !== round2(ec - ps)) violations.push(`minority_interest ${op.minority_interest} != residual`);
    if (round2(op.parent_share + op.minority_interest) !== op.equity_at_current) violations.push('split does not sum to translated equity');
    if (op.overall !== 'CONSOLIDATION_COMPUTED') violations.push(`overall ${op.overall} on well-formed input`);
    if (compliance_flags.length !== 0) violations.push(`unexpected flags ${compliance_flags.join(',')}`);
    if (typeof op.trace !== 'string' || !op.trace.includes('CTA')) violations.push('trace missing');
  }
  return { name: 'consolidation_identity', checked, violations: violations.length };
}

// P2: invalid-domain rejection — malformed inputs always fail closed with named
// errors, CONSOLIDATION_REFUSED, null output fields, never a partial verdict.
function checkFailClosed() {
  const rng = mulberry32(6831);
  let checked = 0; const violations = [];
  const good = { sub_equity_fc: 100000, rate_current: 1.1, rate_historical: 1, parent_ownership_pct: 80 };
  const badInputs = [
    {},
    { sub_equity_fc: null, rate_current: null, rate_historical: null, parent_ownership_pct: null },
    { ...good, sub_equity_fc: 0 },
    { ...good, sub_equity_fc: -5 },
    { ...good, sub_equity_fc: '100000' },
    { ...good, rate_current: 0 },
    { ...good, rate_historical: -1 },
    { ...good, rate_historical: NaN },
    { ...good, parent_ownership_pct: 0 },
    { ...good, parent_ownership_pct: 100 },
    { ...good, parent_ownership_pct: 150 },
    { ...good, parent_ownership_pct: Infinity },
  ];
  for (const pp of badInputs) {
    const { output_payload: op, compliance_flags } = compute(pp);
    checked++;
    if (!Array.isArray(op.domain_errors) || op.domain_errors.length === 0) violations.push('no domain_errors on malformed input');
    if (op.equity_at_current !== null || op.cta !== null || op.parent_share !== null || op.minority_interest !== null) {
      violations.push('fail-closed payload did not null every output field');
    }
    if (op.overall !== 'CONSOLIDATION_REFUSED') violations.push(`overall ${op.overall} on malformed input`);
    if (!compliance_flags.includes('DOMAIN_ERROR')) violations.push('DOMAIN_ERROR flag missing');
  }
  // fuzz: random junk shapes must never throw and never reach CONSOLIDATION_COMPUTED
  for (let i = 0; i < 200; i++) {
    const junk = {};
    for (const k of ['sub_equity_fc', 'rate_current', 'rate_historical', 'parent_ownership_pct']) {
      const r = rng();
      if (r < 0.3) continue; // absent
      else if (r < 0.5) junk[k] = null;
      else if (r < 0.6) junk[k] = Math.floor(rng() * 200) - 50;
      else if (r < 0.8) junk[k] = String(rng() * 100);
      else junk[k] = rng() < 0.5 ? Infinity : NaN;
    }
    const { output_payload: op } = compute(junk);
    checked++;
    const okNum = (v, lo, hi) => typeof v === 'number' && isFinite(v) && v > lo && (hi === undefined || v < hi);
    const valid = okNum(junk.sub_equity_fc, 0) && okNum(junk.rate_current, 0) && okNum(junk.rate_historical, 0) && okNum(junk.parent_ownership_pct, 0, 100);
    if (op.overall === 'CONSOLIDATION_COMPUTED' && !valid) violations.push('computable verdict reached from a malformed input');
    if (valid && op.overall !== 'CONSOLIDATION_COMPUTED') violations.push('well-formed input was refused');
  }
  return { name: 'fail_closed_rejection', checked, violations: violations.length };
}

// P3: determinism — identical inputs produce byte-identical outputs across repeated calls.
function checkDeterminism() {
  const rng = mulberry32(6832);
  let checked = 0; const violations = [];
  for (let i = 0; i < 100; i++) {
    const pp = { sub_equity_fc: round2(rng() * 500000), rate_current: round2(rng() * 2), rate_historical: round2(rng() * 2), parent_ownership_pct: round2(rng() * 100) };
    const a = compute(pp); const b = compute(pp);
    checked++;
    if (!deepEqual(a, b)) violations.push('repeated compute() diverged');
  }
  return { name: 'determinism', checked, violations: violations.length };
}

// P4: output shape — success path carries exactly the seven pinned fields,
// no NaN/undefined anywhere.
function checkOutputShape() {
  const rng = mulberry32(6833);
  let checked = 0; const violations = [];
  const SUCCESS_KEYS = ['equity_at_current', 'equity_at_historical', 'cta', 'parent_share', 'minority_interest', 'trace', 'overall'];
  const FAIL_KEYS = SUCCESS_KEYS.concat(['domain_errors']);
  for (let i = 0; i < 200; i++) {
    const good = rng() < 0.5;
    const pp = good
      ? { sub_equity_fc: 100000, rate_current: 1.1, rate_historical: 1, parent_ownership_pct: 80 }
      : { sub_equity_fc: 'junk', rate_current: null, rate_historical: {}, parent_ownership_pct: NaN };
    const { output_payload: op } = compute(pp);
    checked++;
    const keys = Object.keys(op).sort().join(',');
    const expectedKeys = (good ? SUCCESS_KEYS : FAIL_KEYS).slice().sort().join(',');
    if (keys !== expectedKeys) violations.push(`payload keys ${keys} != ${expectedKeys}`);
    const shape = findShapeViolations(op);
    if (shape.length) violations.push(shape.join('; '));
    if (good && op.overall !== 'CONSOLIDATION_COMPUTED') violations.push('bad overall on success path');
  }
  return { name: 'output_shape_pinned', checked, violations: violations.length };
}

// P5: monotonicity — raising the declared ownership percentage can only move
// value from minority to parent; it never shrinks parent_share and never
// changes translated equity or CTA.
function checkOwnershipMonotonicity() {
  const rng = mulberry32(6834);
  let checked = 0; const violations = [];
  for (let i = 0; i < 200; i++) {
    const base = { sub_equity_fc: round2(rng() * 900000) + 1, rate_current: round2(rng() * 2) + 0.05, rate_historical: round2(rng() * 2) + 0.05 };
    const lo = round2(rng() * 40) + 5;
    const hi = lo + round2(rng() * 30) + 1;
    const a = compute({ ...base, parent_ownership_pct: lo }).output_payload;
    const b = compute({ ...base, parent_ownership_pct: hi }).output_payload;
    checked++;
    if (b.parent_share < a.parent_share) violations.push('higher ownership shrank parent_share');
    if (b.minority_interest > a.minority_interest) violations.push('higher ownership grew minority_interest');
    if (b.equity_at_current !== a.equity_at_current || b.cta !== a.cta) violations.push('ownership moved translated equity or CTA');
  }
  return { name: 'ownership_monotonicity', checked, violations: violations.length };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkConsolidationArithmetic(),
  checkFailClosed(),
  checkDeterminism(),
  checkOutputShape(),
  checkOwnershipMonotonicity(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — CONSOLIDATION-CTA-BUILD-1.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
