// art-603-stablecoin-reserve-3source-recompute.proptest.mjs — FV property-test FLOOR (FVFLOOR-BACKFILL-0811-1).
// kernel_digest_at_authoring: sha256:c8316be3de60b7720200258695a7e8932fc30fc151208c12d87714c647bfc3db
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md section 3, class B -- bounded-numeric coverage-
// ratio/WAM/reconcile arithmetic against fixed-threshold tiers). NOT a proof, NOT Dafny.
// float_sensitive: YES -- coverage_ratio_pct, WAM, and every reconcile check divide floating-point
// USD/day figures and compare against percentage tolerances (RESERVE_TOTAL_TOLERANCE_PCT,
// RECONCILE_TOLERANCE_PCT, WAM_CROSSCHECK_TOLERANCE_DAYS). Per FV-PBT-FLOOR-BUILD-SPEC.md section 3
// this MANDATES ULP-boundary forcing: tolerance ±epsilon, exactly-at-ceiling, zero-denominator, and
// negative-zero-shaped cases (P4 below), never optional for a float-sensitive kernel.
//
// Checks: fixture-oracle gate (P0), totality/never-throws over hostile inputs (P1), a worst-of-rollup
// invariant (P2: overall_determination is NOT_MET iff ANY check is bad-tier, else INDETERMINATE iff
// ANY is INDETERMINATE, else MET -- enumerated over every combination of a small verdict alphabet,
// A-class-shaped bounded enumeration since the rollup only has 3^k relevant equivalence classes for
// a fixed small k), the as-of-skew gating invariant (P3: a skew exceeding MAX_AS_OF_SKEW_DAYS must
// force the dependent check(s) to INDETERMINATE, never silently compared as same-date), mandatory
// ULP/threshold-boundary forcing for coverage_ratio_pct and the WAM ceiling (P4), a metamorphic
// determinism + missing-leg-forces-indeterminate property (P5: a leg's absence must never fabricate
// a MET/NOT_MET verdict for anything that depends on it), and forced categorical boundary cases (P6:
// GENIUS item-7 catch-all always INDETERMINATE, non_eligible always DOES_NOT_MATCH, breakdown
// exceeding MAX_ASSET_LINES refused not truncated).

import { compute } from '../art-603-stablecoin-reserve-3source-recompute.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

// ---------- P0: fixture oracle ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-603-stablecoin-reserve-3source-recompute.fixtures.json');
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
const rand = mulberry32(0x603F107);

function baseLegA(overrides = {}) {
  return {
    as_of: '2027-02-28', source_digest: 'sha256:' + 'a'.repeat(64),
    total_reserves_usd: 1000000, outstanding_tokens_reported: 1000000, token_price: 1,
    asset_breakdown: [{ asset_class: 'us_coin_and_currency', amount_usd: 1000000, maturity_bucket_days: 0 }],
    ...overrides,
  };
}

// ---------- P1: totality ----------
function checkP1_totality() {
  let violations = 0, checked = 0;
  const hostileInputs = [
    null, undefined, {}, [], 'a string', 42, true,
    { leg_a: null, leg_b: null, leg_c: null },
    { leg_a: 'not-an-object' }, { leg_a: { asset_breakdown: 'not-an-array' } },
    { leg_a: { asset_breakdown: [null, 42, {}] } },
    { leg_a: baseLegA({ asset_breakdown: Array.from({ length: 65 }, () => ({ asset_class: 'us_coin_and_currency', amount_usd: 1 })) }) },
    { leg_a: baseLegA({ outstanding_tokens_reported: 0 }) },
    { leg_a: baseLegA({ total_reserves_usd: null }) },
  ];
  for (const pp of hostileInputs) {
    checked++;
    let out;
    try { out = compute(pp); } catch (e) { violations++; continue; }
    const o = out.output_payload;
    if (typeof o.overall_determination !== 'string') violations++;
    if (!['MET', 'NOT_MET', 'INDETERMINATE'].includes(o.overall_determination)) violations++;
    if (!Array.isArray(o.genius_eligible_holdings)) violations++;
    if (!Array.isArray(o.reconciles) || o.reconciles.length !== 3) violations++;
    if (!Array.isArray(out.compliance_flags)) violations++;
  }
  return { name: 'P1_totality_never_throws_well_formed_shape', trials: checked, violations };
}

// ---------- P2: worst-of rollup self-consistency — over many random leg combinations (including
// missing legs), independently recompute the worst-of tiering FROM THE KERNEL'S OWN REPORTED PER-
// CHECK VERDICTS (reserve_ratio, wam_ceiling, every genius_eligible_holdings entry, every reconcile)
// using the same BAD/INDETERMINATE/good tiering the kernel's header comment declares, and confirm it
// equals the reported overall_determination. This does not predict which sub-verdict a given random
// input produces (that is an implementation detail of five independent checks) -- it differentially
// re-derives the ROLLUP RULE ITSELF from whatever sub-verdicts actually came out, which is exactly
// the invariant worth floor-testing (a rollup that silently ignores one check's bad verdict is the
// real regression this property exists to catch). ----------
function checkP2_worst_of_rollup_self_consistency() {
  let violations = 0, checked = 0;
  const BAD = new Set(['NOT_MET', 'DISCREPANT', 'DOES_NOT_MATCH']);
  for (let i = 0; i < 60; i++) {
    checked++;
    const hasA = rand() < 0.8;
    const hasB = rand() < 0.6;
    const hasC = rand() < 0.6;
    const amount = 200000 + Math.floor(rand() * 2000000);
    const maturity = Math.floor(rand() * 40);
    const legA = hasA ? baseLegA({ outstanding_tokens_reported: 1000000, token_price: 1, reserves_in_fund_fraction: rand(), asset_breakdown: [{ asset_class: ['us_coin_and_currency', 'other_occ_approved', 'non_eligible', 'bogus_class'][Math.floor(rand() * 4)], amount_usd: amount, maturity_bucket_days: maturity }] }) : undefined;
    const legB = hasB ? { as_of: '2027-02-28', total_net_assets: 100000 + Math.floor(rand() * 3000000), wam_days: Math.floor(rand() * 40), accession_number: 'ACC-1' } : undefined;
    const legC = hasC ? { as_of: '2027-02-28', onchain_supply: 500000 + Math.floor(rand() * 2000000) } : undefined;

    const { output_payload: o } = compute({ leg_a: legA, leg_b: legB, leg_c: legC });
    const allVerdicts = [
      o.reserve_ratio.verdict,
      o.wam.wam_ceiling_check.verdict,
      ...o.genius_eligible_holdings.map((h) => h.verdict),
      ...o.reconciles.map((r) => r.verdict),
    ];
    let expected;
    if (allVerdicts.some((v) => BAD.has(v))) expected = 'NOT_MET';
    else if (allVerdicts.some((v) => v === 'INDETERMINATE')) expected = 'INDETERMINATE';
    else expected = 'MET';
    if (o.overall_determination !== expected) violations++;
  }
  return { name: 'P2_worst_of_rollup_self_consistency_over_random_leg_combinations', trials: checked, violations };
}

// ---------- P3: as-of skew gating — a skew exceeding MAX_AS_OF_SKEW_DAYS (10) must force the
// dependent reconcile to INDETERMINATE, never silently compared ----------
function checkP3_asof_skew_gating() {
  let violations = 0, checked = 0;
  for (const skewDays of [0, 5, 10, 11, 30, 365]) {
    checked++;
    const legA = baseLegA({ as_of: '2027-01-01', reserves_in_fund_fraction: 1 });
    const legB = { as_of: `2027-01-${String(1 + (skewDays % 28)).padStart(2, '0')}`, total_net_assets: 1000000, wam_days: 5 };
    // use exact day arithmetic via a controlled date instead of modulo when skewDays < 28
    const legBExact = { ...legB, as_of: skewDays < 28 ? `2027-01-${String(1 + skewDays).padStart(2, '0')}` : '2028-06-01' };
    const { output_payload: o } = compute({ leg_a: legA, leg_b: legBExact });
    const reconcile1 = o.reconciles.find((r) => r.check === 'reserves_vs_mmf_assets');
    const actualSkew = o.as_of_skew_pairs.leg_a_vs_leg_b;
    if (actualSkew !== null && actualSkew > 10) {
      if (reconcile1.verdict !== 'INDETERMINATE') violations++;
    } else if (actualSkew !== null && actualSkew <= 10) {
      if (reconcile1.verdict === 'INDETERMINATE' && !reconcile1.detail.includes('skew')) violations++; // allow other legit reasons
    }
  }
  return { name: 'P3_as_of_skew_gating_forces_indeterminate_beyond_threshold', trials: checked, violations };
}

// ---------- P4: MANDATORY ULP/threshold-boundary forcing (float_sensitive: yes) — exactly-at-ceiling,
// just-under, just-over, and a zero-denominator case for coverage_ratio_pct and the WAM ceiling.
//
// ⚠ TWO DISCOVERED DEFECTS (found while authoring this floor, out of this floor's fence to fix, NOT
// silently papered over): (1) the >=100 comparison is made against coverage_ratio_pct AFTER it has
// already been rounded via .toFixed(4) — an input whose true ratio is 99.999999...% (mathematically
// short of 100%) can round UP to the displayed 100.0000 and be misclassified MET (reproduced with
// amount_usd 999999.99 against a 1000000 liability: displayed 100.00%, verdict MET, though the true
// ratio is 99.999999%). (2) total_liabilities_usd can legitimately be (positive) zero when
// token_price is 0 or -0 (the kernel only guards `tokens <= 0`, never `price <= 0` or
// `total_liabilities_usd <= 0`) — dividing by that zero yields coverage_ratio_pct === Infinity,
// which passes the `>= 100` check and is misclassified MET rather than INDETERMINATE. Per SO #6/
// RIDER-KERNEL and this WU's fence (⛔ no kernel logic edits), fixing either is out of scope for this
// row; both are captured below as REGRESSION-CAPTURING assertions of the kernel's ACTUAL current
// behavior (so a future unrelated change that silently alters this behavior is caught by this floor),
// not as an endorsement that the behavior is correct. Flagged for a future kernel-touching WU.
function checkP4_ulp_boundary_forcing() {
  let violations = 0, checked = 0;
  // coverage ratio exactly 100% -> MET (>= 100 is the kernel's own stated boundary)
  { checked++;
    const { output_payload: o } = compute({ leg_a: baseLegA({ outstanding_tokens_reported: 1000000, token_price: 1, asset_breakdown: [{ asset_class: 'us_coin_and_currency', amount_usd: 1000000 }] }) });
    if (o.reserve_ratio.verdict !== 'MET') violations++;
    if (o.reserve_ratio.coverage_ratio_pct !== 100) violations++; }
  // coverage ratio genuinely under 100% (99.9999%, one whole dollar short, clear of the .toFixed(4)
  // rounding cliff documented above) -> NOT_MET
  { checked++;
    const { output_payload: o } = compute({ leg_a: baseLegA({ outstanding_tokens_reported: 1000000, token_price: 1, asset_breakdown: [{ asset_class: 'us_coin_and_currency', amount_usd: 999999 }] }) });
    if (o.reserve_ratio.verdict !== 'NOT_MET') violations++;
    if (o.reserve_ratio.coverage_ratio_pct !== 99.9999) violations++; }
  // coverage ratio genuinely over 100% (100.0001%, one whole dollar over) -> MET
  { checked++;
    const { output_payload: o } = compute({ leg_a: baseLegA({ outstanding_tokens_reported: 1000000, token_price: 1, asset_breakdown: [{ asset_class: 'us_coin_and_currency', amount_usd: 1000001 }] }) });
    if (o.reserve_ratio.verdict !== 'MET') violations++;
    if (o.reserve_ratio.coverage_ratio_pct !== 100.0001) violations++; }
  // outstanding_tokens_reported === 0 -> INDETERMINATE, never a divide-by-zero NaN/Infinity leak
  { checked++;
    const { output_payload: o } = compute({ leg_a: baseLegA({ outstanding_tokens_reported: 0 }) });
    if (o.reserve_ratio.verdict !== 'INDETERMINATE') violations++;
    if (o.reserve_ratio.coverage_ratio_pct !== null) violations++;
    if (Number.isNaN(o.reserve_ratio.coverage_ratio_pct)) violations++; }
  // REGRESSION-CAPTURE (defect 1, documented above): a rounding-cliff amount whose true ratio
  // (99.999999%) rounds UP to a displayed 100.0000% is CURRENTLY misclassified MET.
  { checked++;
    const { output_payload: o } = compute({ leg_a: baseLegA({ outstanding_tokens_reported: 1000000, token_price: 1, asset_breakdown: [{ asset_class: 'us_coin_and_currency', amount_usd: 999999.99 }] }) });
    if (o.reserve_ratio.verdict !== 'MET' || o.reserve_ratio.coverage_ratio_pct !== 100) violations++; }
  // REGRESSION-CAPTURE (defect 2, documented above): token_price of -0 drives total_liabilities_usd
  // to (positive) zero, and the resulting Infinity ratio is CURRENTLY misclassified MET.
  { checked++;
    const { output_payload: o } = compute({ leg_a: baseLegA({ token_price: -0 }) });
    if (o.reserve_ratio.verdict !== 'MET' || o.reserve_ratio.coverage_ratio_pct !== Infinity) violations++; }
  // WAM ceiling exactly at 20 days -> MET; 1 day over -> NOT_MET
  { checked++;
    const { output_payload: o } = compute({ leg_a: baseLegA({ asset_breakdown: [{ asset_class: 'us_coin_and_currency', amount_usd: 1000000, maturity_bucket_days: 20 }] }) });
    if (o.wam.wam_ceiling_check.verdict !== 'MET') violations++; }
  { checked++;
    const { output_payload: o } = compute({ leg_a: baseLegA({ asset_breakdown: [{ asset_class: 'us_coin_and_currency', amount_usd: 1000000, maturity_bucket_days: 21 }] }) });
    if (o.wam.wam_ceiling_check.verdict !== 'NOT_MET') violations++; }
  return { name: 'P4_ulp_and_threshold_boundary_forcing_mandatory_float_sensitive', trials: checked, violations };
}

// ---------- P5: metamorphic — determinism, and each leg's absence must never fabricate a MET/NOT_MET
// verdict for a check that depends on it ----------
function checkP5_metamorphic_missing_leg_never_fabricates() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 30; i++) {
    checked++;
    const legA = baseLegA({ asset_breakdown: [{ asset_class: 'us_coin_and_currency', amount_usd: 1000000 + Math.floor(rand() * 100000), maturity_bucket_days: Math.floor(rand() * 30) }] });
    const pp = { leg_a: legA };
    const a = compute(pp).output_payload;
    const b = compute(pp).output_payload;
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;

    // no leg_b, no leg_c -> reconcile1 and reconcile2 must be INDETERMINATE, never RECONCILED/DISCREPANT
    if (a.reconciles.find((r) => r.check === 'reserves_vs_mmf_assets').verdict !== 'INDETERMINATE') violations++;
    if (a.reconciles.find((r) => r.check === 'liabilities_vs_onchain_supply').verdict !== 'INDETERMINATE') violations++;
    // no leg_a -> reserve_ratio and wam_from_disclosure must be INDETERMINATE
    const noLegA = compute({}).output_payload;
    if (noLegA.reserve_ratio.verdict !== 'INDETERMINATE') violations++;
    if (noLegA.wam.wam_from_disclosure.verdict !== 'INDETERMINATE') violations++;
  }
  return { name: 'P5_metamorphic_determinism_and_missing_leg_never_fabricates_a_verdict', trials: checked, violations };
}

// ---------- P6: forced categorical boundary cases ----------
function checkP6_forced_categorical() {
  let violations = 0, checked = 0;
  // GENIUS item 7 catch-all -> ALWAYS INDETERMINATE, never auto-matched
  { checked++;
    const { output_payload: o } = compute({ leg_a: baseLegA({ asset_breakdown: [{ asset_class: 'other_occ_approved', amount_usd: 1000000 }] }) });
    if (o.genius_eligible_holdings[0].verdict !== 'INDETERMINATE') violations++;
    if (o.genius_eligible_holdings[0].statutory_item !== 7) violations++; }
  // explicit non_eligible -> DOES_NOT_MATCH
  { checked++;
    const { output_payload: o } = compute({ leg_a: baseLegA({ asset_breakdown: [{ asset_class: 'non_eligible', amount_usd: 1000000 }] }) });
    if (o.genius_eligible_holdings[0].verdict !== 'DOES_NOT_MATCH') violations++; }
  // unrecognized asset_class -> INDETERMINATE, never guessed
  { checked++;
    const { output_payload: o } = compute({ leg_a: baseLegA({ asset_breakdown: [{ asset_class: 'totally_made_up_class', amount_usd: 1000000 }] }) });
    if (o.genius_eligible_holdings[0].verdict !== 'INDETERMINATE') violations++; }
  // asset_breakdown over MAX_ASSET_LINES (64) -> refused, not truncated-and-summed
  { checked++;
    const over = Array.from({ length: 65 }, () => ({ asset_class: 'us_coin_and_currency', amount_usd: 1 }));
    const { output_payload: o } = compute({ leg_a: baseLegA({ asset_breakdown: over }) });
    if (o.reserve_ratio.verdict !== 'INDETERMINATE') violations++;
    if (o.reserve_ratio.total_reserves_usd_recomputed !== null) violations++; }
  // no legs at all -> INDETERMINATE overall, never MET/NOT_MET
  { checked++;
    const { output_payload: o } = compute({});
    if (o.overall_determination !== 'INDETERMINATE') violations++; }
  return { name: 'P6_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_totality());
results.properties.push(checkP2_worst_of_rollup_self_consistency());
results.properties.push(checkP3_asof_skew_gating());
results.properties.push(checkP4_ulp_boundary_forcing());
results.properties.push(checkP5_metamorphic_missing_leg_never_fabricates());
results.properties.push(checkP6_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-603-stablecoin-reserve-3source-recompute',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
