// art-576-emir3-active-account-representativeness-classifier.proptest.mjs — FV property-test FLOOR
// (FV-PROPFLOOR-SHARD-C30-1).
// kernel_digest_at_authoring: sha256:61ccaaf1ba92ae118685760e5c4c2d2196095b159dd005a1e79d115d31e544c6
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO — RE-CONFIRMED BY DIRECT READ per FIX-2; this matches the WU row's own
// float:no classification, no correction needed. ⚠ Not a rubber-stamp: there IS one genuine float
// division in this kernel — annualizedCount = (rawCount * 12) / pp.reference_period_months, compared
// against a fixed threshold of 5 (met = annualizedCount >= 5). This was checked for real ULP risk and
// found not to carry one for realistic inputs: rawCount and reference_period_months are always
// integers (rawCount is a bounded cleared-trade count, reference_period_months a caller-declared
// positive integer), and IEEE-754 division is correctly rounded to the nearest representable double
// — so whenever the true rational quotient rawCount*12/reference_period_months is exactly an integer
// (including exactly 5, the decision boundary), the computed double equals that integer exactly; no
// representable double can land strictly between two adjacent integers by less than the gap the
// numerator/denominator's own granularity permits at any realistic reference_period_months magnitude
// (this would only become a genuine ULP risk if reference_period_months approached ~1e15, far outside
// any plausible reporting-period value). No ULP-boundary claim is made; the exact-5 boundary is
// floored instead via a forced categorical boundary case (P5), per spec §3's float:no row.
// Checks: fixture-oracle gate, termination (P1: trades_classified.length bounded by well-formed
// trades, unbounded array is never filtered beyond malformed rows), boundedness (P2: every obligation
// verdict is one of the four declared enum values, bucket_counts values are exact per-bucket cleared
// counts), a differential re-derivation of the in-scope gate + active-account verdict + EUR 6bn
// representativeness threshold gate against an independent reimplementation (P3), a metamorphic
// permutation-invariance identity over trades[] order (P4: bucket aggregation is commutative), and
// forced categorical boundary cases including the exact annualized-count-equals-5 boundary (the one
// genuine division named above), the EUR 6 billion threshold boundary, and the missing
// reference_period_months path (P5).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-576-emir3-active-account-representativeness-classifier.proptest.mjs

import { compute } from '../art-576-emir3-active-account-representativeness-classifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-576-emir3-active-account-representativeness-classifier.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = compute(vec.policy_parameters);
    const a = JSON.stringify(output_payload);
    const b = JSON.stringify(vec.output_payload);
    if (a !== b) failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
  }
  results.fixture_oracle = { total: fixtures.vectors.length, failures };
  return failures.length === 0;
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x576C30);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
// Order-independent equality for bucket_counts objects (JS object key insertion order is
// significant to JSON.stringify but not to this kernel's own aggregation semantics).
function sameCounts(a, b) {
  const ak = Object.keys(a), bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  return ak.every((k) => a[k] === b[k]);
}

const CLASSES = ['eur_fixed_float', 'eur_ois', 'eur_fra', 'pln_fixed_float', 'pln_fra', 'eur_stir_euribor', 'eur_stir_ester'];
function randomTrade(rng, i) {
  return {
    trade_id: `T-${i}`,
    class: pick(rng, CLASSES),
    trade_notional_minor_units: Math.floor(rng() * 30_000_000_00), // up to ~300M EUR in cents
    maturity_months: Math.floor(rng() * 200),
    cleared: rng() < 0.7,
  };
}
function randomPP(rng) {
  const nTrades = Math.floor(rng() * 12);
  const eurPln = rng() < 0.6, eurStir = rng() < 0.4;
  const trades = Array.from({ length: nTrades }, (_, i) => randomTrade(rng, i));
  const designations = trades.length > 0 && rng() < 0.5
    ? [{ class: pick(rng, CLASSES), bucket_id: `${pick(rng, CLASSES)}:any:any`, most_relevant: true }]
    : [];
  return {
    counterparty_ref: 'SYNTH-CP',
    as_of_date: '2026-08-07',
    clearing_threshold_exceeded: { eur_pln_ird: eurPln, eur_stir: eurStir },
    active_account: { established: rng() < 0.8, ccp_article14_authorised: rng() < 0.8 },
    trades,
    reference_period_months: rng() < 0.85 ? 1 + Math.floor(rng() * 24) : undefined,
    notional_clearing_volume_minor_units: rng() < 0.85 ? Math.floor(rng() * 12_000_000_000_00) : undefined,
    subcategory_designations: designations,
  };
}

const SIX_BILLION = 6_000_000_000 * 100;

// Independent reimplementation of the in-scope gate + active-account verdict + threshold gate, for
// the differential check (P3).
function reimplement(pp) {
  const inScopeAny = pp.clearing_threshold_exceeded.eur_pln_ird === true || pp.clearing_threshold_exceeded.eur_stir === true;
  let aaVerdict;
  if (!inScopeAny) aaVerdict = 'EXEMPT';
  else if (pp.active_account.established !== true) aaVerdict = 'NOT_MET';
  else if (pp.active_account.ccp_article14_authorised !== true) aaVerdict = 'NOT_MET';
  else aaVerdict = 'MET';
  let repVerdict;
  const volDeclared = typeof pp.notional_clearing_volume_minor_units === 'number';
  if (!inScopeAny) repVerdict = 'EXEMPT';
  else if (!volDeclared) repVerdict = 'INDETERMINATE';
  else if (pp.notional_clearing_volume_minor_units < SIX_BILLION) repVerdict = 'EXEMPT';
  else repVerdict = 'GATE_PASSED'; // full MET/NOT_MET/INDETERMINATE resolution depends on designations/period, checked separately
  return { aaVerdict, repVerdict, inScopeAny };
}

const TRIALS = 2000;

// ---------- P1: termination — trades_classified bounded by well-formed trades ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.trades_classified.length > pp.trades.length) violations++;
    if (o.trades_classified.length !== pp.trades.length) violations++; // every randomTrade() is well-formed
  }
  return { name: 'P1_termination_trades_classified_bounded', trials: checked, violations };
}

// ---------- P2: boundedness — verdict enums valid, bucket_counts are exact per-bucket cleared counts ----------
const VALID_VERDICTS = new Set(['EXEMPT', 'MET', 'NOT_MET', 'INDETERMINATE']);
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (!VALID_VERDICTS.has(o.obligations.active_account.verdict)) violations++;
    if (!VALID_VERDICTS.has(o.obligations.representativeness.verdict)) violations++;
    if (!VALID_VERDICTS.has(o.obligations.reporting_window.verdict)) violations++;
    const expectedBuckets = {};
    for (const t of o.trades_classified) if (t.cleared) expectedBuckets[t.bucket_id] = (expectedBuckets[t.bucket_id] || 0) + 1;
    if (!sameCounts(o.bucket_counts, expectedBuckets)) violations++;
  }
  return { name: 'P2_boundedness_verdict_enums_and_bucket_counts', trials: checked, violations };
}

// ---------- P3: differential — in-scope gate + active-account + threshold gate re-derived independently ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    const exp = reimplement(pp);
    if (o.obligations.active_account.verdict !== exp.aaVerdict) violations++;
    if (exp.repVerdict === 'EXEMPT' && o.obligations.representativeness.verdict !== 'EXEMPT') violations++;
    if (exp.repVerdict === 'INDETERMINATE' && o.obligations.representativeness.verdict !== 'INDETERMINATE') violations++;
    if (o.in_scope.eur_pln_ird !== (pp.clearing_threshold_exceeded.eur_pln_ird === true)) violations++;
    if (o.in_scope.eur_stir !== (pp.clearing_threshold_exceeded.eur_stir === true)) violations++;
  }
  return { name: 'P3_in_scope_active_account_threshold_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — permutation-invariance over trades[] order ----------
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 800; i++) {
    const pp = randomPP(rand);
    if (pp.trades.length < 2) continue;
    const shuffled = { ...pp, trades: [...pp.trades].reverse() };
    const a = compute(pp).output_payload;
    const b = compute(shuffled).output_payload;
    checked++;
    if (!sameCounts(a.bucket_counts, b.bucket_counts)) violations++;
    if (a.obligations.representativeness.verdict !== b.obligations.representativeness.verdict) violations++;
  }
  return { name: 'P4_permutation_invariance_trades', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (float:no, incl. the exact annualized-count=5 boundary) ----------
function checkP5_forced_categorical() {
  let violations = 0, checked = 0;
  const base = {
    counterparty_ref: 'CP', as_of_date: '2026-08-07',
    clearing_threshold_exceeded: { eur_pln_ird: true, eur_stir: false },
    active_account: { established: true, ccp_article14_authorised: true },
    notional_clearing_volume_minor_units: SIX_BILLION,
    subcategory_designations: [{ class: 'eur_fixed_float', bucket_id: 'eur_fixed_float:[0-25M]:[0-60mo]', most_relevant: true }],
  };
  // annualizedCount = (rawCount*12)/reference_period_months, exactly 5 -> met (boundary is inclusive, >= 5)
  {
    // 5 cleared trades in the bucket over a 12-month reference period -> (5*12)/12 = 5 exactly.
    const trades = Array.from({ length: 5 }, (_, i) => ({ trade_id: `T${i}`, class: 'eur_fixed_float', trade_notional_minor_units: 100000, maturity_months: 10, cleared: true }));
    const { output_payload: o } = compute({ ...base, reference_period_months: 12, trades });
    checked++;
    if (o.obligations.representativeness.subcategory_results[0].annualized_trade_count !== 5) violations++;
    if (o.obligations.representativeness.subcategory_results[0].met !== true) violations++;
  }
  // just under 5: 4 cleared trades over 12 months -> annualized 4, not met
  {
    const trades = Array.from({ length: 4 }, (_, i) => ({ trade_id: `T${i}`, class: 'eur_fixed_float', trade_notional_minor_units: 100000, maturity_months: 10, cleared: true }));
    const { output_payload: o } = compute({ ...base, reference_period_months: 12, trades });
    checked++;
    if (o.obligations.representativeness.subcategory_results[0].met !== false) violations++;
    if (o.obligations.representativeness.verdict !== 'NOT_MET') violations++;
  }
  // EUR 6 billion threshold: exactly at threshold -> above the "less than" cutoff, so representativeness applies (not EXEMPT)
  { const { output_payload: o } = compute({ ...base, notional_clearing_volume_minor_units: SIX_BILLION, reference_period_months: 12, trades: [] }); checked++; if (o.obligations.representativeness.verdict === 'EXEMPT') violations++; }
  { const { output_payload: o } = compute({ ...base, notional_clearing_volume_minor_units: SIX_BILLION - 1, reference_period_months: 12, trades: [] }); checked++; if (o.obligations.representativeness.verdict !== 'EXEMPT') violations++; }
  // reference_period_months missing -> representativeness INDETERMINATE (when otherwise in-scope+above threshold+has designations)
  { const { output_payload: o } = compute({ ...base, trades: [] }); checked++; if (o.obligations.representativeness.verdict !== 'INDETERMINATE') violations++; }
  return { name: 'P5_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_differential());
results.properties.push(checkP4_permutation_invariance());
results.properties.push(checkP5_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-576-emir3-active-account-representativeness-classifier',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
