// art-771-automation-payback.proptest.mjs — class-K property-test FLOOR
// (FV-PBT-FLOOR-BUILD-SPEC.md). Authored against the APEXPORT-180 porting payload
// (kernel + fixtures + VECTORS/DIFFERS/CITES records, GRADES PASS-PENDING-XV
// 2026-10-18, Builder-verifies-at-land 19/19).
// kernel_digest_at_authoring: sha256:f1cbca96684bdb0eb0cc36aab3ccdd2afb1ba0c35afbf5acf2375fc3d781341a
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof, NOT Dafny. Internal engineering QC only.
// float_sensitive: PARTIAL — the kernel deliberately keeps the Apex page's
// calcPayback() expression order so its outputs match the ported-from page to
// the digit. The properties below assert only relations that are exact under
// IEEE-754 (monotone rounding of a positive-coefficient sum, equality on
// already-rounded outputs, integer/horizon relations) or restatements of the
// published formula, never fragile float equals on arbitrary draws.
//
// Checks: fixture-oracle gate (the 4 Apex live vectors and the 15 boundary
// pairs at and just past every comparator — recoverable > 0 break-even
// definition, net >= 0 BUILD/SKIP, keepers==ranked ALL_CLEAR, keepers > 0
// MIXED vs NO_CANDIDATE_CLEARS, net rank sort tie, fastest break-even sort
// tie, the three clamp floors, horizon half-up rounding, the empty-list
// guard); P1 net_mo is non-decreasing in hours_saved_per_week,
// loaded_hourly_rate_usd and error_cost_avoided_usd_month and non-increasing
// in subscription_usd_month and build_cost_usd (positive-coefficient
// arithmetic through a monotone 2dp rounding); P2 the verdict is a pure
// function of the per-candidate calls, restated independently (all BUILD ->
// ALL_CLEAR, some BUILD -> MIXED_LIST, none -> NO_CANDIDATE_CLEARS); P3
// determinism (two runs agree byte-for-byte) and output shape (no
// undefined/NaN/non-finite anywhere in output_payload); P4 the no-refusal
// contract: compute() throws for NO input — unparseable globals coerce to the
// Apex page's 0-then-clamp behaviour, missing fields floor at 0, an empty
// candidates array returns the zero payload with NO_CANDIDATES; P5 the
// ranking contract: ranked is sorted by descending net_mo with ties
// preserving input order, keepers/droppers partition the names, and
// hours_reclaimed_wk sums hours over BUILD rows only; P6 the global clamps
// restated independently (haircut floored at 0, horizon rounded half-up then
// floored at 1, weeks floored at 1) and the compliance flags that fire with
// them.
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-771-automation-payback.proptest.mjs

import { compute } from '../art-771-automation-payback.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick } from './_pbt-common.mjs';

const KERNEL_ID = 'art-771-automation-payback';

const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const hasBadNumber = (x) => {
  if (typeof x === 'number') return !Number.isFinite(x);
  if (x === null || typeof x !== 'object') return false;
  return Object.values(x).some(hasBadNumber);
};

let candSeq = 0;
const candidate = (rng) => ({
  name: pick(rng, ['Alpha', 'Beta', 'Gamma', 'Delta', '']) + '-' + (++candSeq),
  hours_saved_per_week: Math.round(rng() * 200) / 10,
  loaded_hourly_rate_usd: Math.round(rng() * 15000) / 100,
  error_cost_avoided_usd_month: Math.round(rng() * 50000) / 100,
  build_cost_usd: Math.round(rng() * 200000) / 100,
  subscription_usd_month: Math.round(rng() * 50000) / 100,
});

const basePP = (rng) => ({
  as_of: '2026-10-13',
  maintenance_haircut_pct: Math.floor(rng() * 60),
  horizon_months: 1 + Math.floor(rng() * 48),
  weeks_per_month: Math.round((1 + rng() * 4) * 100) / 100,
  candidates: [candidate(rng), candidate(rng), candidate(rng)],
});

// P1 — net_mo monotone in the per-candidate economic inputs.
function checkP1Monotone() {
  let checked = 0, violations = 0;
  const rng = mulberry32(77101);
  for (let i = 0; i < 60; i++) {
    const pp = basePP(rng);
    const ci = Math.floor(rng() * pp.candidates.length);
    const netOf = (pp2) => {
      const out = compute(pp2).output_payload;
      return out.ranked.find((r) => r.name === (pp2.candidates[ci].name || 'Unnamed candidate')).net_mo;
    };
    const c = pp.candidates[ci];
    const up = (k, d) => {
      const pp2 = JSON.parse(JSON.stringify(pp));
      pp2.candidates[ci][k] = c[k] + d;
      return netOf(pp2);
    };
    const down = (k, d) => {
      const pp2 = JSON.parse(JSON.stringify(pp));
      pp2.candidates[ci][k] = Math.max(0, c[k] - d);
      return netOf(pp2);
    };
    for (const [k, d, dir] of [
      ['hours_saved_per_week', 0.5, 1],
      ['loaded_hourly_rate_usd', 5, 1],
      ['error_cost_avoided_usd_month', 10, 1],
      ['subscription_usd_month', 10, -1],
      ['build_cost_usd', 100, -1],
    ]) {
      const a = netOf(pp);
      const b = dir === 1 ? up(k, d) : down(k, d);
      checked++;
      if (b < a) { violations++; console.log(`P1 violation: net_mo decreased when improving ${k}`); }
    }
  }
  return { name: 'P1 net_mo non-decreasing in hours/rate/error-cost, non-increasing in sub/build', checked, violations };
}

// P2 — verdict restated from the per-row calls.
function checkP2VerdictRestated() {
  let checked = 0, violations = 0;
  const rng = mulberry32(77102);
  for (let i = 0; i < 120; i++) {
    const pp = basePP(rng);
    const out = compute(pp).output_payload;
    const builds = out.ranked.filter((r) => r.call === 'BUILD').length;
    const want = builds === out.ranked.length ? 'ALL_CLEAR' : builds > 0 ? 'MIXED_LIST' : 'NO_CANDIDATE_CLEARS';
    checked++;
    if (out.verdict !== want) { violations++; console.log(`P2 violation: verdict ${out.verdict}, want ${want}`); }
    if (out.verdict === 'ALL_CLEAR' && out.net_keep_mo !== out.net_all_mo) {
      violations++; console.log('P2 violation: ALL_CLEAR with net_keep != net_all');
    }
  }
  return { name: 'P2 verdict restated from BUILD counts; ALL_CLEAR implies net_keep == net_all', checked, violations };
}

// P3 — determinism and output shape.
function checkP3DeterminismShape() {
  let checked = 0, violations = 0;
  const rng = mulberry32(77103);
  for (let i = 0; i < 40; i++) {
    const pp = basePP(rng);
    const a = compute(pp).output_payload;
    const b = compute(pp).output_payload;
    checked += 2;
    if (!deepEqual(a, b)) { violations++; console.log('P3 violation: two runs differ'); }
    if (hasBadNumber(a) || JSON.stringify(a).includes('undefined')) { violations++; console.log('P3 violation: undefined/NaN/non-finite in output_payload'); }
  }
  return { name: 'P3 determinism + output shape (no undefined/NaN/non-finite)', checked, violations };
}

// P4 — the no-refusal contract: compute() throws for NO input.
function checkP4NoRefusal() {
  let checked = 0, violations = 0;
  const junk = [
    'x', 42, null, true,
    {},
    { candidates: [] },
    { candidates: [] },
    { maintenance_haircut_pct: 'nan', horizon_months: NaN, weeks_per_month: null, candidates: [{ name: 'junk' }] },
    { maintenance_haircut_pct: -50, horizon_months: 0.5, weeks_per_month: -3, candidates: [{}] },
    { horizon_months: 'garbage', candidates: [{ name: '', hours_saved_per_week: 'x' }] },
  ];
  for (const pp of junk) {
    checked++;
    let out = null, threw = null;
    try { out = compute(pp); } catch (e) { threw = e; }
    if (threw) { violations++; console.log(`P4 violation: compute threw for ${JSON.stringify(pp).slice(0, 60)}`); continue; }
    if (!out || !out.output_payload || typeof out.output_payload.verdict !== 'string') {
      violations++; console.log('P4 violation: no verdict-shaped payload');
    }
  }
  // Empty list: zero payload + NO_CANDIDATES flag.
  const empty = compute({ candidates: [] });
  checked += 3;
  if (!empty.compliance_flags.includes('NO_CANDIDATES')) { violations++; console.log('P4 violation: empty list without NO_CANDIDATES flag'); }
  if (empty.output_payload.net_all_mo !== 0 || empty.output_payload.best_candidate !== null) { violations++; console.log('P4 violation: empty list payload not zeroed'); }
  if (empty.output_payload.verdict !== 'NO_CANDIDATE_CLEARS') { violations++; console.log('P4 violation: empty list verdict wrong'); }
  return { name: 'P4 no-refusal contract (junk coerces, empty list -> NO_CANDIDATES zero payload)', checked, violations };
}

// P5 — ranking contract: descending net with input-order ties, partition, hours.
function checkP5Ranking() {
  let checked = 0, violations = 0;
  const rng = mulberry32(77105);
  for (let i = 0; i < 60; i++) {
    const pp = basePP(rng);
    const out = compute(pp).output_payload;
    checked++;
    for (let j = 1; j < out.ranked.length; j++) {
      checked++;
      if (out.ranked[j - 1].net_mo < out.ranked[j].net_mo) { violations++; console.log('P5 violation: ranked not descending by net_mo'); }
    }
    const names = out.ranked.map((r) => r.name);
    const part = [...out.keepers, ...out.droppers].sort();
    checked += 2;
    if (JSON.stringify([...names].sort()) !== JSON.stringify(part)) { violations++; console.log('P5 violation: keepers/droppers do not partition ranked'); }
    const wantHours = out.ranked.filter((r) => r.call === 'BUILD')
      .reduce((s, r) => s + out.candidates.find((c) => c.name === r.name).hours_saved_wk, 0);
    if (out.hours_reclaimed_wk !== Math.round(wantHours * 10) / 10) { violations++; console.log('P5 violation: hours_reclaimed_wk not the BUILD-hours sum'); }
  }
  return { name: 'P5 ranked descending net, keepers/droppers partition, hours over BUILD only', checked, violations };
}

// P6 — global clamps and flags restated independently.
function checkP6Clamps() {
  let checked = 0, violations = 0;
  const raw = compute({ maintenance_haircut_pct: -7, horizon_months: 0.4, weeks_per_month: 0.2, candidates: [{ name: 'C' }] });
  const out = raw.output_payload;
  checked += 6;
  if (out.haircut_pct !== 0) { violations++; console.log('P6 violation: haircut not floored at 0'); }
  if (out.horizon_months !== 1) { violations++; console.log('P6 violation: horizon not floored at 1'); }
  if (out.weeks_per_month !== 1) { violations++; console.log('P6 violation: weeks not floored at 1'); }
  for (const f of ['HAIRCUT_CLAMPED_TO_FLOOR', 'HORIZON_CLAMPED_TO_FLOOR', 'WEEKS_PER_MONTH_CLAMPED_TO_FLOOR']) {
    if (!raw.compliance_flags.includes(f)) { violations++; console.log(`P6 violation: missing flag ${f}`); }
  }
  const rounded = compute({ horizon_months: 6.5, candidates: [{ name: 'R' }] });
  checked += 2;
  if (rounded.output_payload.horizon_months !== 7) { violations++; console.log('P6 violation: 6.5 did not round half-up to 7'); }
  if (!rounded.compliance_flags.includes('HORIZON_ROUNDED_TO_WHOLE_MONTHS')) { violations++; console.log('P6 violation: missing HORIZON_ROUNDED_TO_WHOLE_MONTHS'); }
  return { name: 'P6 clamps (0/1/1) + half-up horizon rounding + flags restated', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1Monotone(),
  checkP2VerdictRestated(),
  checkP3DeterminismShape(),
  checkP4NoRefusal(),
  checkP5Ranking(),
  checkP6Clamps(),
];
console.log(`[${KERNEL_ID}] class-K floor property test`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
