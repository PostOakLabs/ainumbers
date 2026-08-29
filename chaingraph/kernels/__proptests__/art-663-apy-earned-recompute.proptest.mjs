// art-663-apy-earned-recompute — class-K property-test FLOOR.
//
// CLASS K — the declared domain is bounded (interest >= 0, days 1..366, balance > 0, band
// (0..1]) and every refusal path is enumerated in the sibling reachability fixtures, but the
// MONEY and RATE AXES are continuous, so no totality claim is made over them. Properties below
// run over a committed mulberry32 seed (deterministic) plus a fixed corpus of structural cases.
//
// kernel_digest_at_authoring: sha256:8f873b59228d5260e6aaaf4c82cf1f455e515ad601dd4133e74517741edd7608
// spec: CORE-VERIFY-BUILD-SPEC.md section 4 (apy-earned-recompute), built to the pinned primary
//   text (12 CFR part 1030 Appendix A Part II) rather than the spec's simple-annualization variant
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-663-apy-earned-recompute.proptest.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compute } from '../art-663-apy-earned-recompute.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, findShapeViolations, runDiscoveryLeg } from './_pbt-common.mjs';

const KERNEL_ID = 'art-663-apy-earned-recompute';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = JSON.parse(
  fs.readFileSync(path.join(HERE, '..', 'fixtures', KERNEL_ID + '.fixtures.json'), 'utf8'),
);
const REACH = JSON.parse(
  fs.readFileSync(path.join(HERE, '..', 'fixtures', KERNEL_ID + '.reachability.json'), 'utf8'),
);

const SEED = 20260829;
const N = 200;

/** Random VALID policy_parameters over the declared domain. */
function randomValidPp(rng) {
  const pp = {
    interest_earned: Math.round(rng() * 10000) / 100,
    days_in_period: [28, 30, 31, 91, 92, 365, 366][Math.floor(rng() * 7)],
    average_daily_balance: Math.round(rng() * 10000000) / 100 + 1,
  };
  if (rng() < 0.7) pp.disclosed_apy_earned = Math.round(rng() * 1000) / 100;
  if (rng() < 0.5) pp.accuracy_band_pp = 0.05;
  return pp;
}

function relClose(a, b, eps) {
  if (a === b) return true;
  const scale = Math.max(Math.abs(a), Math.abs(b)) || 1;
  return Math.abs(a - b) <= (eps || 1e-9) * scale;
}

// P1 — DETERMINISM: identical inputs, identical payload, byte-for-byte.
function checkDeterminism() {
  const rng = mulberry32(SEED);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng);
    const a = JSON.stringify(compute(pp));
    const b = JSON.stringify(compute(pp));
    checked++;
    if (a !== b) violations++;
  }
  return { name: 'P1-determinism-committed-seed', checked, violations };
}

// P2 — MONOTONICITY: with balance and days fixed, more interest never lowers the yield.
function checkMonotonicity() {
  const rng = mulberry32(SEED + 1);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 100; i++) {
    const adb = Math.round(rng() * 100000) / 10 + 10;
    const days = [30, 31, 91, 365, 366][Math.floor(rng() * 5)];
    let prev = -Infinity;
    for (let x = 0; x <= 40; x += 1) {
      const { output_payload } = compute({ interest_earned: x, days_in_period: days, average_daily_balance: adb });
      checked++;
      if (output_payload.apy_earned_computed === null || output_payload.apy_earned_computed < prev - 1e-12) violations++;
      prev = output_payload.apy_earned_computed;
    }
  }
  return { name: 'P2-monotone-in-interest', checked, violations };
}

// P3 — BAND SEMANTICS: DIVERGES iff |computed - disclosed| > band. Probed strictly inside
// and strictly outside the band (never at the razor edge, which belongs to fixtures).
function checkBandSemantics() {
  const rng = mulberry32(SEED + 2);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 100; i++) {
    const pp = randomValidPp(rng);
    if (pp.disclosed_apy_earned === undefined) pp.disclosed_apy_earned = 5;
    const base = compute(pp).output_payload;
    if (base.apy_earned_computed === null) continue; // refusal case: not this property's corpus
    const band = base.accuracy_band_pp;
    const c = base.apy_earned_computed;
    const inside = compute({ ...pp, disclosed_apy_earned: c + band * 0.99 }).output_payload;
    const outside = compute({ ...pp, disclosed_apy_earned: c + band * 1.01 }).output_payload;
    checked += 2;
    if (inside.verdict !== 'MATCHES') violations++;
    if (outside.verdict !== 'DIVERGES') violations++;
  }
  return { name: 'P3-band-semantics-diverges-iff-outside', checked, violations };
}

// P4 — INVALID-DOMAIN REJECTION: every declared refusal path returns INDETERMINATE with
// manual_review_required and NO computed number. Never a throw, never a silent number.
function checkInvalidDomainRejection() {
  const base = { interest_earned: 5.25, days_in_period: 30, average_daily_balance: 1000, disclosed_apy_earned: 6.58 };
  const cases = [
    { ...base, average_daily_balance: 0 },
    { ...base, average_daily_balance: -5 },
    { ...base, days_in_period: 0 },
    { ...base, days_in_period: 400 },
    { ...base, days_in_period: 30.5 },
    { ...base, interest_earned: -1 },
    { ...base, accuracy_band_pp: 0 },
    { ...base, accuracy_band_pp: 2 },
    { ...base, accuracy_band_pp: 'wide' },
    { ...base, special_formula_declared: true },
    { ...base, balance_segments: [{ balance: 1500, days: 15 }, { balance: 500, days: 14 }] },
    { ...base, balance_segments: [] },
    { ...base, balance_segments: [{ balance: -1, days: 30 }] },
    {},
    { interest_earned: '5.25', days_in_period: 30, average_daily_balance: 1000 },
    { interest_earned: 5.25, days_in_period: 30, average_daily_balance: NaN },
  ];
  let checked = 0;
  let violations = 0;
  for (const pp of cases) {
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.verdict !== 'INDETERMINATE') violations++;
    if (output_payload.manual_review_required !== true) violations++;
    if (output_payload.apy_earned_computed !== null) violations++;
  }
  return { name: 'P4-invalid-domain-refused-never-numbered', checked, violations };
}

// P5 — SEGMENT/DIRECT EQUIVALENCE: days-weighted span mean equals the directly supplied ADB.
function checkSegmentEquivalence() {
  const rng = mulberry32(SEED + 3);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 100; i++) {
    const days = [30, 31, 91, 365][Math.floor(rng() * 4)];
    const b1 = Math.round(rng() * 50000) / 10;
    const b2 = Math.round(rng() * 50000) / 10;
    const d1 = Math.floor(days / 2);
    const d2 = days - d1;
    const adb = (b1 * d1 + b2 * d2) / days;
    const direct = compute({ interest_earned: 12.34, days_in_period: days, average_daily_balance: adb, disclosed_apy_earned: 5 }).output_payload;
    const segs = compute({ interest_earned: 12.34, days_in_period: days, balance_segments: [{ balance: b1, days: d1 }, { balance: b2, days: d2 }], disclosed_apy_earned: 5 }).output_payload;
    checked++;
    if (!direct.apy_earned_computed || !relClose(direct.apy_earned_computed, segs.apy_earned_computed, 1e-12)) violations++;
    if (segs.balance_segments_days_sum !== days) violations++;
  }
  return { name: 'P5-segment-derivation-equals-direct-adb', checked, violations };
}

// P6 — OUTPUT SHAPE: no NaN/undefined/non-finite anywhere; verdict in the closed enum.
function checkShape() {
  const rng = mulberry32(SEED + 4);
  let checked = 0;
  let violations = 0;
  const corpus = [];
  for (let i = 0; i < 80; i++) corpus.push(randomValidPp(rng));
  corpus.push({}, { interest_earned: 1 }, { interest_earned: 1, days_in_period: 30, average_daily_balance: 0 });
  for (const pp of corpus) {
    const { output_payload } = compute(pp);
    checked++;
    violations += findShapeViolations(output_payload).length;
    if (!['MATCHES', 'DIVERGES', 'INDETERMINATE'].includes(output_payload.verdict)) violations++;
    if (!Array.isArray(output_payload.warnings)) violations++;
    if (typeof output_payload.manual_review_required !== 'boolean') violations++;
  }
  return { name: 'P6-output-shape-closed-verdict-enum', checked, violations };
}

// P7 — INDEPENDENT-ORACLE ASSERTIONS: every conformance vector's independent_oracle.expect
// must hold on the LIVE kernel output (SO #34: the oracle is external, never the recorded payload).
function checkIndependentOracles() {
  let checked = 0;
  let violations = 0;
  const detail = [];
  for (const vec of FIXTURES.vectors) {
    const { output_payload } = compute(vec.policy_parameters);
    const expect = vec.independent_oracle.expect;
    for (const [k, v] of Object.entries(expect)) {
      checked++;
      const got = output_payload[k];
      const ok = typeof v === 'number' && got !== null && typeof got === 'number'
        ? relClose(got, v, 1e-9)
        : got === v;
      if (!ok) { violations++; detail.push(vec.name + '.' + k + ' expected ' + JSON.stringify(v) + ' got ' + JSON.stringify(got)); }
    }
  }
  return { name: 'P7-independent-oracle-expectations-hold', checked, violations, detail };
}

// P8 — REACHABILITY: every declared refusal path actually fires on the live kernel.
function checkReachability() {
  let checked = 0;
  let violations = 0;
  const detail = [];
  for (const vec of REACH.vectors) {
    const { output_payload, compliance_flags } = compute(vec.policy_parameters);
    checked++;
    if (vec.expect.verdict !== output_payload.verdict) { violations++; detail.push(vec.name + ' verdict'); }
    if (output_payload.manual_review_required !== true) { violations++; detail.push(vec.name + ' manual_review_required'); }
    for (const f of vec.expect.flags_present) {
      checked++;
      if (!compliance_flags.includes(f)) { violations++; detail.push(vec.name + ' missing flag ' + f); }
    }
  }
  return { name: 'P8-reachability-refusals-fire', checked, violations, detail };
}

// P9 — NASTY-VALUE LEG: substituting one nasty value at a time into a valid baseline never
// throws and never emits a NaN/undefined payload (refusal is the only legal outcome).
function checkNastyLeg() {
  const rng = mulberry32(SEED + 5);
  const baseline = { interest_earned: 5.25, days_in_period: 30, average_daily_balance: 1000, disclosed_apy_earned: 6.58 };
  const findings = runDiscoveryLeg(KERNEL_ID, compute, baseline, rng);
  return { name: 'P9-nasty-substitutions-never-throw-or-shape-violate', checked: Object.keys(baseline).length * 10, violations: findings.length, detail: findings.map((f) => f.key + ': ' + f.outcome.kind) };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkDeterminism(),
  checkMonotonicity(),
  checkBandSemantics(),
  checkInvalidDomainRejection(),
  checkSegmentEquivalence(),
  checkShape(),
  checkIndependentOracles(),
  checkReachability(),
  checkNastyLeg(),
];
console.log('[' + KERNEL_ID + '] class-K floor property test — APY-earned recompute (Core Output Verification pack).');
const ok = summarize(KERNEL_ID, oracle, properties);
for (const p of properties) {
  if (p.violations && p.detail && p.detail.length) console.log('  detail[' + p.name + ']:', JSON.stringify(p.detail.slice(0, 10)));
}
process.exit(ok ? 0 : 1);
