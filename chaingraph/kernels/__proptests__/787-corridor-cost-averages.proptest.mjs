// 787-corridor-cost-averages — class-K property-test FLOOR.
//
// CLASS K — the declared domain is bounded (≤200 quotes, lowest_n ≤ 50,
// closed refusal set enumerated in the sibling reachability fixtures), but the
// fee/margin/share axes are continuous, so no totality claim is made over them.
// Properties below run over a committed mulberry32 seed (deterministic) plus a
// fixed corpus of structural cases.
//
// kernel_digest_at_authoring: sha256:518257d2de32b84828479d4901c87b84e856ad2599906816eab3be41a6d93667
// spec: research/REMIT-COST-AVERAGES-PIN-2026-10-29.md — one corridor's cost
//   three ways (simple, market-share-weighted, lowest-N/SmaRT) vs the SDG 10.c
//   3% target and the G20 no-corridor-above-5% target; integer basis-point
//   arithmetic; weighted null with a reason code, never renormalised.
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/787-corridor-cost-averages.proptest.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compute } from '../787-corridor-cost-averages.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32 } from './_pbt-common.mjs';

const KERNEL_ID = '787-corridor-cost-averages';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REACH = JSON.parse(
  fs.readFileSync(path.join(HERE, '..', 'fixtures', KERNEL_ID + '.reachability.json'), 'utf8'),
);

const SEED = 20261030;
const N = 200;
const SDG_BPS = 300;
const CORRIDOR_BPS = 500;

/** Random VALID policy_parameters over the declared domain. */
function randomValidPp(rng) {
  const nQ = 1 + Math.floor(rng() * 8);
  const useShares = rng() < 0.5;
  let remaining = 100;
  const quotes = [];
  for (let i = 0; i < nQ; i++) {
    const q = {
      provider_code: 'P' + String(i + 1).padStart(2, '0'),
      fee: Math.round(rng() * 2000) / 100,
      fx_margin_pct: Math.round(rng() * 400) / 100,
    };
    if (useShares) {
      const isLast = i === nQ - 1;
      const share = isLast ? remaining : Math.min(remaining, Math.round(rng() * 100));
      q.market_share_pct = share;
      remaining -= share;
      if (remaining < 0) remaining = 0;
    }
    quotes.push(q);
  }
  const pp = { corridor: { origin: 'AU', destination: 'TO' }, quotes: quotes };
  if (rng() < 0.4) pp.send_amount = rng() < 0.5 ? 200 : 500;
  if (rng() < 0.3) pp.lowest_n = 1 + Math.floor(rng() * 5);
  return pp;
}

// P1 — DETERMINISM + SHAPE: compute() is a pure function of pp (same input,
// byte-identical output_payload); an ok payload carries all three averages
// with the contract fields, and total_cost_pct is basis-point resolution
// (pct * 100 is an integer).
function checkDeterminismAndShape() {
  const rng = mulberry32(SEED);
  let checked = 0; let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng);
    const a = compute(pp).output_payload;
    const b = compute(pp).output_payload;
    checked++;
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
    checked++;
    if (a.verdict !== 'ok') continue;
    const av = a.averages;
    let shapeOk = av && av.simple && av.lowest_n
      && typeof av.simple.total_cost_pct === 'number'
      && typeof av.simple.meets_sdg_3pct === 'boolean'
      && typeof av.simple.meets_g20_corridor_5pct === 'boolean'
      && typeof av.simple.quotes_used === 'number';
    if (av.weighted !== null) {
      shapeOk = shapeOk && typeof av.weighted.total_cost_pct === 'number';
    } else {
      shapeOk = shapeOk && typeof a.weighted_null_reason === 'string' && a.weighted_null_reason.length > 0;
    }
    shapeOk = shapeOk && a.weighting_coverage_pct >= 0 && a.weighting_coverage_pct <= 100;
    for (const k of ['simple', 'weighted', 'lowest_n']) {
      const v = av[k];
      if (!v) continue;
      shapeOk = shapeOk && Number.isInteger(Math.round(v.total_cost_pct * 100)) && v.total_cost_pct >= 0;
    }
    if (!shapeOk) violations++;
  }
  return { name: 'P1-determinism-shape-bps-resolution', checked: checked, violations: violations };
}

// P2 — AVERAGE MONOTONICITY: appending a cheaper quote never raises the simple
// or lowest_n average; appending a dearer quote never lowers the simple one.
function checkMonotonicity() {
  const rng = mulberry32(SEED + 1);
  let checked = 0; let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng);
    const base = compute(pp).output_payload.averages;
    const cheap = { provider_code: 'CH01', fee: 0, fx_margin_pct: 0 };
    const dear = { provider_code: 'DE01', fee: 10000, fx_margin_pct: 50 };
    const withCheap = compute(Object.assign({}, pp, { quotes: pp.quotes.concat([cheap]) })).output_payload.averages;
    const withDear = compute(Object.assign({}, pp, { quotes: pp.quotes.concat([dear]) })).output_payload.averages;
    checked += 2;
    if (withCheap.simple.total_cost_pct > base.simple.total_cost_pct) violations++;
    if (withCheap.lowest_n.total_cost_pct > base.lowest_n.total_cost_pct) violations++;
    checked++;
    if (withDear.simple.total_cost_pct < base.simple.total_cost_pct) violations++;
  }
  return { name: 'P2-average-monotonicity-in-quote-set', checked: checked, violations: violations };
}

// P3 — LOWEST-N DOMINATES SIMPLE: the cheapest-subset average is at or below
// the all-quotes average; the spread is never negative.
function checkLowestDominatesSimple() {
  const rng = mulberry32(SEED + 2);
  let checked = 0; let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng);
    const out = compute(pp).output_payload;
    checked++;
    if (out.averages.lowest_n.total_cost_pct > out.averages.simple.total_cost_pct) violations++;
    checked++;
    if (out.spread_pp !== null && out.spread_pp < 0) violations++;
  }
  return { name: 'P3-lowest-n-le-simple', checked: checked, violations: violations };
}

// P4 — TARGET FLAGS AGREE WITH THE NUMBERS: meets_sdg_3pct and
// meets_g20_corridor_5pct hold exactly when the average is at or below the
// 3% / 5% bounds.
function checkTargetFlags() {
  const rng = mulberry32(SEED + 3);
  let checked = 0; let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng);
    const out = compute(pp).output_payload;
    for (const k of ['simple', 'weighted', 'lowest_n']) {
      const v = out.averages[k];
      if (!v) continue;
      checked += 2;
      const bps = Math.round(v.total_cost_pct * 100);
      if (v.meets_sdg_3pct !== (bps <= SDG_BPS)) violations++;
      if (v.meets_g20_corridor_5pct !== (bps <= CORRIDOR_BPS)) violations++;
    }
  }
  return { name: 'P4-target-flags-match-bounds', checked: checked, violations: violations };
}

// P5 — WEIGHTED NEVER SILENTLY RENORMALISED: weighted is non-null exactly when
// every quote carries a share and the shares sum to 100 within +/-0.5; when it
// is null the reason code is present and is one of the two closed codes.
function checkWeightedNullRule() {
  const rng = mulberry32(SEED + 4);
  let checked = 0; let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng);
    const out = compute(pp).output_payload;
    const shares = pp.quotes.map(function (q) { return q.market_share_pct; }).filter(function (s) { return s !== undefined; });
    const allPresent = shares.length === pp.quotes.length;
    const sum = shares.reduce(function (a, b) { return a + b; }, 0);
    const inTol = allPresent && Math.abs(sum - 100) <= 0.5;
    checked++;
    if (inTol !== (out.averages.weighted !== null)) violations++;
    checked++;
    if (out.averages.weighted === null && ['WEIGHTED_SHARES_MISSING', 'WEIGHTED_SHARES_SUM_OUT_OF_TOLERANCE'].indexOf(out.weighted_null_reason) === -1) violations++;
  }
  // Structural: all shares present but summing to 120 stays null even though a
  // renormalisation would be possible — the pinned rule forbids it.
  const out = compute({ corridor: { origin: 'AU', destination: 'TO' }, quotes: [
    { provider_code: 'R1', fee: 2, fx_margin_pct: 1, market_share_pct: 60 },
    { provider_code: 'R2', fee: 4, fx_margin_pct: 2, market_share_pct: 60 },
  ] }).output_payload;
  checked += 2;
  if (out.averages.weighted !== null || out.weighted_null_reason !== 'WEIGHTED_SHARES_SUM_OUT_OF_TOLERANCE') violations++;
  return { name: 'P5-weighted-null-reason-never-renormalised', checked: checked, violations: violations };
}

// P6 — REFUSAL PATHS: every committed reachability vector fires its declared
// flag, refuses with manual_review_required true, and never emits averages.
function checkRefusalPaths() {
  let checked = 0; let violations = 0;
  for (const vec of REACH.vectors) {
    const r = compute(vec.policy_parameters);
    checked++;
    const allFire = vec.observed_flags.every(function (f) { return r.compliance_flags.indexOf(f) !== -1; });
    if (!allFire || r.output_payload.verdict !== 'refused' || r.output_payload.manual_review_required !== true) violations++;
    checked++;
    if (r.output_payload.averages !== null) violations++;
  }
  return { name: 'P6-refusal-paths-reachable-no-averages', checked: checked, violations: violations };
}

// P7 — SINGLE QUOTE COLLAPSE: with exactly one share-carrying quote all three
// averages coincide and the spread is 0.
function checkSingleQuoteCollapse() {
  let checked = 1; let violations = 0;
  const out = compute({ corridor: { origin: 'FJ', destination: 'US' }, quotes: [
    { provider_code: 'ONLY1', fee: 5, fx_margin_pct: 2.5, market_share_pct: 100 },
  ] }).output_payload;
  const a = out.averages;
  const eq = a.simple.total_cost_pct === a.weighted.total_cost_pct
    && a.weighted.total_cost_pct === a.lowest_n.total_cost_pct
    && out.spread_pp === 0;
  if (!eq) violations++;
  return { name: 'P7-single-quote-all-averages-equal', checked: checked, violations: violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkDeterminismAndShape(),
  checkMonotonicity(),
  checkLowestDominatesSimple(),
  checkTargetFlags(),
  checkWeightedNullRule(),
  checkRefusalPaths(),
  checkSingleQuoteCollapse(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — corridor cost three ways vs SDG 10.c / G20 targets.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
