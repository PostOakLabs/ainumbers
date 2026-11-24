// art-663-apy-earned-recompute — class-K property-test FLOOR.
//
// CLASS K — the declared domain is bounded (interest >= 0, days 1..366, balance > 0, band
// (0..1]) and every refusal path is enumerated in the sibling reachability fixtures, but the
// MONEY and RATE AXES are continuous, so no totality claim is made over them. Properties below
// run over a committed mulberry32 seed (deterministic) plus a fixed corpus of structural cases.
//
// kernel_digest_at_authoring: sha256:dde5c49b64af40bd9877ee9dc0ee23dfa58a463ababd68806a3928a8f382238c
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
import { compute, buildArtifact } from '../art-663-apy-earned-recompute.kernel.mjs';
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

// P10 — FAIL-CLOSED REQUIRED FIELDS: every positive fixture vector with one REQUIRED field
// deleted, nulled, emptied or whitespace-only must never stay positive (never MATCHES/DIVERGES).
// Required set is the manifest inputSchema.required literal-read via the kernel's own property reads.
function checkRequiredFieldsFailClosed() {
  const required = ['interest_earned', 'days_in_period'];
  let positives = 0, checked = 0, violations = 0;
  const detail = [];
  for (const vec of FIXTURES.vectors) {
    let base;
    try { base = compute(structuredClone(vec.policy_parameters)).output_payload; } catch { continue; }
    if (base.verdict !== 'MATCHES' && base.verdict !== 'DIVERGES') continue;
    positives++;
    for (const f of required) {
      for (const mode of ['delete', 'null', 'empty', 'blank']) {
        const pp = structuredClone(vec.policy_parameters);
        if (mode === 'delete') delete pp[f];
        else pp[f] = mode === 'null' ? null : mode === 'empty' ? '' : '   ';
        checked++;
        const out = compute(pp).output_payload;
        const staysPositive = out.verdict === 'MATCHES' || out.verdict === 'DIVERGES';
        if (staysPositive || out.verdict !== 'INDETERMINATE' || out.manual_review_required !== true || out.apy_earned_computed !== null) {
          violations++;
          detail.push(vec.name + '.' + f + '.' + mode + ': ' + JSON.stringify({ verdict: out.verdict, manual: out.manual_review_required, computed: out.apy_earned_computed }));
        }
      }
    }
  }
  if (positives === 0) violations++;
  return { name: 'P10-required-field-blank-or-deleted-never-positive', checked, violations, detail: detail.slice(0, 10) };
}

// P11 — buildArtifact_never_throws: one case per unhashable class; each returns a refusal
// artifact with execution_hash null and a hash_refusal marker, never an exception.
async function checkBuildArtifactNeverThrows() {
  let deep = {}; let cur = deep;
  for (let i = 0; i < 511; i++) { cur.n = {}; cur = cur.n; }
  const classes = [
    ['junk_1e300', { interest_earned: 1e300 }],
    ['nan', { interest_earned: NaN }],
    ['neg_infinity', { interest_earned: -Infinity }],
    ['depth_511', { interest_earned: 5.25, days_in_period: 30, average_daily_balance: deep }],
    ['over_1e6_values', { interest_earned: 5.25, days_in_period: 30, average_daily_balance: new Array(1000001).fill(0) }],
  ];
  let violations = 0;
  const rows = [];
  for (const [label, pp] of classes) {
    try {
      const art = await buildArtifact(pp);
      const ok = art.execution_hash === null && art.hash_refusal && typeof art.hash_refusal.reason === 'string';
      if (!ok) violations++;
      rows.push({ label, refused: !!ok });
    } catch (e) {
      violations++;
      rows.push({ label, threw: String(e && e.message).slice(0, 120) });
    }
  }
  return { name: 'buildArtifact_never_throws', checked: classes.length, violations, rows };
}

// P12 — FORMULA ORACLE (kernel header rule 1): APY = 100 * ((1 + I/B)^(365/D) - 1), checked against
// the engine's independent Math.pow over a grid that spans every regime of the inlined fdlibm
// exp/log (ratio from 1e-15 to 1e6, days 1..366). Tolerance sits far above last-ULP drift
// (header DETERMINISM clause) and far below any coefficient or branch error.
function checkFormulaOracleGrid() {
  const ratios = [0, 1e-15, 1e-12, 1e-9, 1e-7, 1e-6, 1e-5, 1e-4, 1e-3, 0.0049, 0.00525, 0.01, 0.05, 0.1, 0.2,
    0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.9, 1, 1.25, 1.5, 2, 3, 4, 7, 10, 31, 100, 1e3, 1e4, 1e6];
  const dayss = [1, 2, 3, 7, 14, 28, 30, 31, 61, 91, 92, 180, 270, 364, 365, 366];
  const bals = [1000, 7.77];
  let checked = 0;
  let violations = 0;
  const detail = [];
  for (const days of dayss) {
    for (const r of ratios) {
      for (const adb of bals) {
        const interest = r * adb;
        const op = compute({ interest_earned: interest, days_in_period: days, average_daily_balance: adb }).output_payload;
        const want = 100 * (Math.pow(1 + interest / adb, 365 / days) - 1);
        const got = op.apy_earned_computed;
        checked++;
        let ok;
        if (want === Infinity) ok = got === Infinity;
        else ok = typeof got === 'number' && Math.abs(got - want) <= 1e-11 + 1e-11 * Math.abs(want);
        if (!ok) { violations++; if (detail.length < 5) detail.push('r=' + r + ' d=' + days + ' adb=' + adb + ' want ' + want + ' got ' + got); }
      }
    }
  }
  return { name: 'P12-formula-oracle-vs-math-pow-grid', checked, violations, detail };
}

// P13 — EXACT REFUSAL CODES, NOTE PROSE, BOUNDARIES AND PAYLOAD FIELDS (kernel header rules 1-5).
// Each case lists the compliance flags in the kernel's documented evaluation order, and the
// substrings the notes for the refusal must carry (the offending field name and, where the
// kernel interpolates one, the offending value).
function checkRefusalCodesAndBoundaries() {
  const base = { interest_earned: 5.25, days_in_period: 30, average_daily_balance: 1000, disclosed_apy_earned: 6.58 };
  const V = 'APY_EARNED_RECOMPUTE_';
  const M = 'MANUAL_REVIEW_REQUIRED';
  /** @type {Array<[string, any, string[], string[]]>} */
  const cases = [
    ['empty', {}, ['MISSING_INTEREST_EARNED', 'MISSING_DAYS_IN_PERIOD', 'DISCLOSED_APY_ABSENT', 'MISSING_BALANCE_INPUT', V + 'INDETERMINATE', M], ['interest_earned', 'days_in_period', 'disclosed_apy_earned', 'average_daily_balance']],
    ['interest-blank', { ...base, interest_earned: '  ' }, ['MISSING_INTEREST_EARNED', V + 'INDETERMINATE', M], ['interest_earned']],
    ['interest-null', { ...base, interest_earned: null }, ['MISSING_INTEREST_EARNED', V + 'INDETERMINATE', M], ['interest_earned']],
    ['interest-neg', { ...base, interest_earned: -1 }, ['NEGATIVE_INTEREST_EARNED', V + 'INDETERMINATE', M], ['interest_earned -1']],
    ['days-missing', { ...base, days_in_period: undefined }, ['MISSING_DAYS_IN_PERIOD', V + 'INDETERMINATE', M], ['days_in_period']],
    ['days-frac', { ...base, days_in_period: 30.5 }, ['DAYS_NOT_INTEGER', V + 'INDETERMINATE', M], ['days_in_period 30.5']],
    ['days-zero', { ...base, days_in_period: 0 }, ['DAYS_IN_PERIOD_OUT_OF_RANGE', V + 'INDETERMINATE', M], ['days_in_period 0', '1..366']],
    ['days-367', { ...base, days_in_period: 367 }, ['DAYS_IN_PERIOD_OUT_OF_RANGE', V + 'INDETERMINATE', M], ['days_in_period 367', '1..366']],
    ['days-neg', { ...base, days_in_period: -3 }, ['DAYS_IN_PERIOD_OUT_OF_RANGE', V + 'INDETERMINATE', M], ['days_in_period -3']],
    ['disclosed-neg', { ...base, disclosed_apy_earned: -0.01 }, ['DISCLOSED_APY_NEGATIVE', V + 'INDETERMINATE', M], ['disclosed_apy_earned -0.01']],
    ['disclosed-string', { ...base, disclosed_apy_earned: '6.58' }, ['DISCLOSED_APY_ABSENT', V + 'INDETERMINATE'], ['disclosed_apy_earned']],
    ['special', { ...base, special_formula_declared: true }, ['SPECIAL_FORMULA_NOT_IMPLEMENTED', V + 'INDETERMINATE', M], ['special_formula_declared']],
    ['band-zero', { ...base, accuracy_band_pp: 0 }, ['ACCURACY_BAND_OUT_OF_RANGE', V + 'INDETERMINATE', M], ['accuracy_band_pp 0']],
    ['band-neg', { ...base, accuracy_band_pp: -0.05 }, ['ACCURACY_BAND_OUT_OF_RANGE', V + 'INDETERMINATE', M], ['accuracy_band_pp -0.05']],
    ['band-over', { ...base, accuracy_band_pp: 1.0001 }, ['ACCURACY_BAND_OUT_OF_RANGE', V + 'INDETERMINATE', M], ['accuracy_band_pp 1.0001', '(0..1]']],
    ['band-string', { ...base, accuracy_band_pp: 'wide' }, ['ACCURACY_BAND_INVALID', V + 'INDETERMINATE', M], ['accuracy_band_pp']],
    ['band-tuple-bad', { ...base, accuracy_band_pp: { value: 'x' } }, ['ACCURACY_BAND_INVALID', V + 'INDETERMINATE', M], ['accuracy_band_pp']],
    ['adb-zero', { ...base, average_daily_balance: 0 }, ['AVERAGE_DAILY_BALANCE_NONPOSITIVE', V + 'INDETERMINATE', M], ['average daily balance for the period is 0']],
    ['adb-neg', { ...base, average_daily_balance: -2 }, ['AVERAGE_DAILY_BALANCE_NONPOSITIVE', V + 'INDETERMINATE', M], ['period is -2']],
    ['no-balance', { interest_earned: 5.25, days_in_period: 30, disclosed_apy_earned: 6.58 }, ['MISSING_BALANCE_INPUT', V + 'INDETERMINATE', M], ['average_daily_balance', 'balance_segments']],
    ['segs-empty', { ...base, balance_segments: [] }, ['SEGMENTS_EMPTY', V + 'INDETERMINATE', M], ['balance_segments']],
    ['segs-neg-balance', { ...base, balance_segments: [{ balance: 10, days: 10 }, { balance: -1, days: 20 }] }, ['SEGMENTS_INVALID', V + 'INDETERMINATE', M], ['entry 1', 'balance']],
    ['segs-missing-balance', { ...base, balance_segments: [{ days: 30 }] }, ['SEGMENTS_INVALID', V + 'INDETERMINATE', M], ['entry 0', 'balance']],
    ['segs-days-frac', { ...base, balance_segments: [{ balance: 10, days: 1.5 }] }, ['SEGMENTS_INVALID', V + 'INDETERMINATE', M], ['entry 0', 'days']],
    ['segs-days-zero', { ...base, balance_segments: [{ balance: 10, days: 0 }] }, ['SEGMENTS_INVALID', V + 'INDETERMINATE', M], ['entry 0', 'days']],
    ['segs-non-object', { ...base, balance_segments: [7] }, ['SEGMENTS_INVALID', V + 'INDETERMINATE', M], ['entry 0']],
    ['segs-mismatch', { ...base, balance_segments: [{ balance: 1500, days: 15 }, { balance: 500, days: 14 }] }, ['SEGMENT_DAYS_MISMATCH', V + 'INDETERMINATE', M], ['29 day(s)', 'days_in_period is 30']],
    ['segs-too-many', { ...base, balance_segments: new Array(513).fill({ balance: 1, days: 1 }) }, ['SEGMENTS_EXCEED_CEILING', V + 'INDETERMINATE', M], ['513', '512']],
  ];
  let checked = 0;
  let violations = 0;
  const detail = [];
  function bad(msg) { violations++; if (detail.length < 8) detail.push(msg); }
  for (const [name, pp, wantFlags, noteBits] of cases) {
    const { output_payload: op, compliance_flags: fl } = compute(pp);
    checked++;
    if (JSON.stringify(fl) !== JSON.stringify(wantFlags)) { bad(name + ' flags ' + JSON.stringify(fl)); continue; }
    if (op.verdict !== 'INDETERMINATE') bad(name + ' verdict');
    if (op.manual_review_required !== wantFlags.includes(M)) bad(name + ' manual');
    if (op.manual_review_required && (op.apy_earned_computed !== null || op.apy_earned_computed_rounded !== null || op.abs_difference_pp !== null || op.within_accuracy_band !== null)) bad(name + ' numbered');
    const warnFlags = wantFlags.filter((f) => f !== M && !f.startsWith(V));
    if (JSON.stringify(op.warnings) !== JSON.stringify(warnFlags)) bad(name + ' warnings');
    // one non-empty sentence-form note per warning flag, in the same order
    if (op.notes.length !== warnFlags.length) { bad(name + ' notes.length ' + op.notes.length); continue; }
    op.notes.forEach((n) => {
      checked++;
      if (typeof n !== 'string' || n.length < 60 || !n.endsWith('.') || n.includes('NaN') || n.includes('[object')) bad(name + ' note malformed');
    });
    for (const bit of noteBits) {
      checked++;
      if (!op.notes.some((n) => n.includes(bit))) bad(name + ' no note carries ' + bit);
    }
  }

  // ---- boundaries that are VALID (not refused) ----
  const okCase = (name, pp, check) => {
    const { output_payload: op, compliance_flags: fl } = compute(pp);
    checked++;
    if (op.manual_review_required !== false || fl.includes(M)) bad(name + ' refused');
    else if (!check(op, fl)) bad(name + ' check');
  };
  okCase('days-1', { ...base, days_in_period: 1 }, (o) => o.days_in_period === 1 && typeof o.apy_earned_computed === 'number');
  okCase('days-366', { ...base, days_in_period: 366 }, (o) => o.days_in_period === 366 && typeof o.apy_earned_computed === 'number');
  okCase('interest-zero', { ...base, interest_earned: 0, disclosed_apy_earned: 0 }, (o) => o.apy_earned_computed === 0 && o.verdict === 'MATCHES' && o.abs_difference_pp === 0);
  okCase('disclosed-zero-ok', { ...base, disclosed_apy_earned: 0 }, (o) => o.verdict === 'DIVERGES');
  okCase('band-1-ok', { ...base, accuracy_band_pp: 1 }, (o) => o.accuracy_band_pp === 1 && o.accuracy_band_provenance === null);
  okCase('band-tiny-ok', { ...base, accuracy_band_pp: 1e-9 }, (o) => o.accuracy_band_pp === 1e-9);
  okCase('band-null-defaults', { ...base, accuracy_band_pp: null }, (o) => o.accuracy_band_pp === 0.05 && o.accuracy_band_provenance === null);
  okCase('band-absent-defaults', { ...base }, (o) => o.accuracy_band_pp === 0.05 && o.annualization_days === 365 && o.balance_segments_used === 0 && o.balance_segments_days_sum === null && o.special_formula_declared === false);
  okCase('band-tuple', { ...base, accuracy_band_pp: { value: 0.1, effective_from: '2026-01-01', effective_to: '2026-12-31', source: 'src', source_digest: 'sha256:ab' } },
    (o) => o.accuracy_band_pp === 0.1 && o.accuracy_band_provenance.effective_from === '2026-01-01' && o.accuracy_band_provenance.effective_to === '2026-12-31' && o.accuracy_band_provenance.source === 'src' && o.accuracy_band_provenance.source_digest === 'sha256:ab');
  okCase('band-tuple-bare', { ...base, accuracy_band_pp: { value: 0.1 } },
    (o) => o.accuracy_band_pp === 0.1 && o.accuracy_band_provenance.effective_from === null && o.accuracy_band_provenance.effective_to === null && o.accuracy_band_provenance.source === null && o.accuracy_band_provenance.source_digest === null);
  okCase('band-tuple-badtypes', { ...base, accuracy_band_pp: { value: 0.1, effective_from: 5, effective_to: 6, source: 7, source_digest: 8 } },
    (o) => o.accuracy_band_provenance.effective_from === null && o.accuracy_band_provenance.effective_to === null && o.accuracy_band_provenance.source === null && o.accuracy_band_provenance.source_digest === null);
  {
    const segs = new Array(366).fill({ balance: 10, days: 1 });
    const { output_payload: op } = compute({ ...base, days_in_period: 366, balance_segments: segs });
    checked++;
    if (op.balance_segments_used !== 366 || op.balance_segments_days_sum !== 366 || op.average_daily_balance !== 10) bad('segs-366');
  }
  // direct ADB supplied alongside valid segments: overlap flagged, segments win, direct echoed
  {
    const { output_payload: op, compliance_flags: fl } = compute({ ...base, average_daily_balance: 999, balance_segments: [{ balance: 1500, days: 15 }, { balance: 500, days: 15 }] });
    checked++;
    const f0 = JSON.stringify(fl);
    if (f0 !== JSON.stringify(['BALANCE_INPUT_OVERLAP', V + 'DIVERGES']) && f0 !== JSON.stringify(['BALANCE_INPUT_OVERLAP', V + 'MATCHES'])) bad('overlap flags ' + f0);
    if (op.average_daily_balance !== 1000 || op.average_daily_balance_supplied_directly !== 999 || op.balance_segments_used !== 2 || op.balance_segments_days_sum !== 30) bad('overlap payload');
    if (JSON.stringify(op.warnings) !== JSON.stringify(['BALANCE_INPUT_OVERLAP']) || op.notes.length !== 1 || !op.notes[0].includes('days-weighted') || !op.notes[0].endsWith('.')) bad('overlap notes');
    if (op.manual_review_required !== false) bad('overlap refused');
  }
  // an invalid segments array poisons the balance: the direct fallback is never used
  {
    const { output_payload: op } = compute({ ...base, balance_segments: [{ balance: -1, days: 30 }] });
    checked++;
    if (op.verdict !== 'INDETERMINATE' || op.average_daily_balance !== null || op.average_daily_balance_supplied_directly !== 1000) bad('poisoned segments');
  }
  // segments with no declared period: one refusal for the period, no extra mismatch refusal
  {
    const { compliance_flags: fl } = compute({ interest_earned: 5.25, balance_segments: [{ balance: 10, days: 5 }] });
    checked++;
    if (JSON.stringify(fl) !== JSON.stringify(['MISSING_DAYS_IN_PERIOD', 'DISCLOSED_APY_ABSENT', V + 'INDETERMINATE', M])) bad('segs-without-days ' + JSON.stringify(fl));
  }
  // days-weighted mean arithmetic (rule 4)
  {
    const { output_payload: op } = compute({ ...base, balance_segments: [{ balance: 100, days: 10 }, { balance: 400, days: 20 }] });
    checked++;
    if (!relClose(op.average_daily_balance, (100 * 10 + 400 * 20) / 30, 1e-15)) bad('weighted mean');
  }
  // ---- band edge (rule 2: MATCHES iff |computed - disclosed| <= band) and display rounding (rule 3) ----
  {
    const z = { interest_earned: 0, days_in_period: 30, average_daily_balance: 1000 };
    const at = compute({ ...z, disclosed_apy_earned: 0.05 }).output_payload;
    const just = compute({ ...z, disclosed_apy_earned: 0.0500001 }).output_payload;
    const w = compute({ ...z, disclosed_apy_earned: 0.5, accuracy_band_pp: 0.5 }).output_payload;
    const w2 = compute({ ...z, disclosed_apy_earned: 0.5000001, accuracy_band_pp: 0.5 }).output_payload;
    checked += 4;
    if (at.verdict !== 'MATCHES' || at.within_accuracy_band !== true || at.abs_difference_pp !== 0.05) bad('band edge at');
    if (just.verdict !== 'DIVERGES' || just.within_accuracy_band !== false) bad('band edge just over');
    if (w.verdict !== 'MATCHES' || w2.verdict !== 'DIVERGES') bad('custom band edge');
    const nd = compute(z).output_payload;
    if (nd.verdict !== 'INDETERMINATE' || nd.within_accuracy_band !== null || nd.abs_difference_pp !== null || nd.apy_earned_computed !== 0) bad('no-disclosed keeps number');
    const nf = compute(z);
    if (JSON.stringify(nf.compliance_flags) !== JSON.stringify(['DISCLOSED_APY_ABSENT', V + 'INDETERMINATE'])) bad('no-disclosed flags');
    if (nf.output_payload.manual_review_required !== false || nf.output_payload.notes.length !== 1) bad('no-disclosed manual/notes');
    // disclosed above and below computed give the same absolute difference
    const c = compute(base).output_payload.apy_earned_computed;
    const lo = compute({ ...base, disclosed_apy_earned: c - 0.01 }).output_payload;
    const hi = compute({ ...base, disclosed_apy_earned: c + 0.01 }).output_payload;
    checked += 2;
    if (!relClose(lo.abs_difference_pp, 0.01, 1e-6) || !relClose(hi.abs_difference_pp, 0.01, 1e-6)) bad('abs diff symmetric');
    if (lo.verdict !== 'MATCHES' || hi.verdict !== 'MATCHES') bad('inside default band');
    if (JSON.stringify(compute({ ...base, disclosed_apy_earned: c }).compliance_flags) !== JSON.stringify([V + 'MATCHES'])) bad('matches flags');
    if (JSON.stringify(compute({ ...base, disclosed_apy_earned: c + 5 }).compliance_flags) !== JSON.stringify([V + 'DIVERGES'])) bad('diverges flags');
  }
  // two-decimal half-up rounding of the displayed figure; the unrounded value drives the band
  {
    const rng = mulberry32(SEED + 9);
    for (let i = 0; i < 60; i++) {
      const pp = randomValidPp(rng);
      const op = compute(pp).output_payload;
      checked++;
      if (op.apy_earned_computed_rounded !== Math.round(op.apy_earned_computed * 100) / 100) bad('rounded ' + JSON.stringify(pp));
      if (op.disclosed_apy_earned !== null) {
        const d = Math.abs(op.apy_earned_computed - op.disclosed_apy_earned);
        if (op.abs_difference_pp !== d || op.within_accuracy_band !== (d <= op.accuracy_band_pp)) bad('abs diff ' + JSON.stringify(pp));
      }
      if (op.interest_earned !== pp.interest_earned || op.days_in_period !== pp.days_in_period || op.average_daily_balance !== pp.average_daily_balance) bad('echo inputs');
    }
  }
  return { name: 'P13-exact-refusal-codes-notes-boundaries', checked, violations, detail };
}

// P14 — buildArtifact refusal artifact: reason code and offending path/kind for each unhashable
// class, plus the success artifact's envelope fields (kernel header NEVER-THROW CONTRACT).
async function checkBuildArtifactRefusalDetail() {
  let deep = {}; let cur = deep;
  for (let i = 0; i < 511; i++) { cur.n = {}; cur = cur.n; }
  const good = { interest_earned: 5.25, days_in_period: 30, average_daily_balance: 1000 };
  /** @type {Array<[string, any, string, string]>} */
  const cases = [
    ['nan', { ...good, interest_earned: NaN }, 'REFUSED_INPUT_UNSAFE_NUMBER', 'pp.interest_earned: non_finite'],
    ['inf', { ...good, days_in_period: Infinity }, 'REFUSED_INPUT_UNSAFE_NUMBER', 'pp.days_in_period: non_finite'],
    ['unsafe', { ...good, average_daily_balance: 2 ** 60 }, 'REFUSED_INPUT_UNSAFE_NUMBER', 'pp.average_daily_balance: unsafe_integer'],
    ['nested-array', { ...good, balance_segments: [{ balance: 1, days: 1 }, { balance: NaN, days: 1 }] }, 'REFUSED_INPUT_UNSAFE_NUMBER', 'pp.balance_segments[1].balance: non_finite'],
    ['too-deep', { ...good, average_daily_balance: deep }, 'REFUSED_INPUT_HASH_LIMIT', ': too_deep'],
  ];
  let checked = 0;
  let violations = 0;
  const detail = [];
  function bad(m) { violations++; if (detail.length < 8) detail.push(m); }
  for (const [name, pp, reason, tail] of cases) {
    const a = await buildArtifact(pp, { now: '2026-01-01T00:00:00Z', parent_hashes: ['h1'], parent_tool_ids: ['t1'], chain_depth: 2 });
    checked++;
    if (a.hash_refusal.reason !== reason || !a.hash_refusal.detail.endsWith(tail) || (tail.startsWith('pp.') && a.hash_refusal.detail !== tail)) bad(name + ' ' + JSON.stringify(a.hash_refusal));
    if (a.execution_hash !== null || a.policy_parameters !== null || a.generated_at !== '2026-01-01T00:00:00Z') bad(name + ' envelope');
    if (a.output_payload.verdict !== 'INDETERMINATE' || a.output_payload.manual_review_required !== true || a.output_payload.refusal !== reason) bad(name + ' payload');
    if (JSON.stringify(a.compliance_flags) !== JSON.stringify(['INPUT_REFUSED', 'APY_EARNED_RECOMPUTE_INDETERMINATE', 'MANUAL_REVIEW_REQUIRED'])) bad(name + ' flags');
    if (a.tool_id !== 'art-663-apy-earned-recompute' || a.tool_version !== '1.0.0' || a.chaingraph_version !== '0.4.0' || a.mandate_type !== 'compliance_control') bad(name + ' ids');
    if (JSON.stringify(a.chain) !== JSON.stringify({ parent_hashes: ['h1'], parent_tool_ids: ['t1'], chain_depth: 2 })) bad(name + ' chain');
    if (a.compute_mode !== 'server' || a.compute_proof_ready !== 'deferred') bad(name + ' mode');
  }
  const ok = await buildArtifact(good, { now: '2026-01-01T00:00:00Z' });
  checked++;
  if (typeof ok.execution_hash !== 'string' || ok.execution_hash.length < 32 || ok.hash_refusal !== undefined) bad('ok hash');
  if (ok.generated_at !== '2026-01-01T00:00:00Z' || ok.policy_parameters !== good || ok.tool_id !== 'art-663-apy-earned-recompute') bad('ok envelope');
  if (JSON.stringify(ok.chain) !== JSON.stringify({ parent_hashes: [], parent_tool_ids: [], chain_depth: 0 })) bad('ok chain default');
  if (ok.output_payload.verdict !== 'INDETERMINATE' || ok.compute_mode !== 'server') bad('ok payload');
  const a2 = await buildArtifact(good);
  checked++;
  if (a2.generated_at !== null || a2.execution_hash !== ok.execution_hash) bad('hash stable across now');
  const a3 = await buildArtifact({ ...good, interest_earned: 5.26 });
  checked++;
  if (a3.execution_hash === ok.execution_hash) bad('hash sensitive to input');
  return { name: 'P14-buildArtifact-refusal-detail-and-envelope', checked, violations, detail };
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
  checkRequiredFieldsFailClosed(),
  await checkBuildArtifactNeverThrows(),
  checkFormulaOracleGrid(),
  checkRefusalCodesAndBoundaries(),
  await checkBuildArtifactRefusalDetail(),
];
console.log('[' + KERNEL_ID + '] class-K floor property test — APY-earned recompute (Core Output Verification pack).');
const ok = summarize(KERNEL_ID, oracle, properties);
for (const p of properties) {
  if (p.violations && p.detail && p.detail.length) console.log('  detail[' + p.name + ']:', JSON.stringify(p.detail.slice(0, 10)));
}
process.exit(ok ? 0 : 1);
