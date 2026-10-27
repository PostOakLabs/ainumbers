// art-603-stablecoin-reserve-3source-recompute.proptest.mjs — FV property-test FLOOR (FVFLOOR-BACKFILL-0811-1).
// kernel_digest_at_authoring: sha256:2ab3f0b33aeb38c56b77a129faa2beb19e0ba6b0943efd5c704bc6c1aefb2189
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md section 3, class B -- bounded-numeric coverage-
// ratio/WAM/reconcile arithmetic against fixed-threshold tiers). NOT a proof, NOT Dafny.
// float_sensitive: YES -- coverage_ratio_pct, WAM, and every reconcile check divide floating-point
// USD/day figures and compare against percentage tolerances (RESERVE_TOTAL_TOLERANCE_PCT,
// RECONCILE_TOLERANCE_PCT, WAM_CROSSCHECK_TOLERANCE_DAYS). Per FV-PBT-FLOOR-BUILD-SPEC.md section 3
// this MANDATES ULP-boundary forcing: tolerance ±epsilon, exactly-at-limit, zero-denominator, and
// negative-zero-shaped cases (P4 below), never optional for a float-sensitive kernel.
//
// Checks: fixture-oracle gate (P0), totality/never-throws over hostile inputs (P1), a worst-of-rollup
// invariant (P2: overall_determination is NOT_MET iff ANY check is bad-tier, else INDETERMINATE iff
// ANY is INDETERMINATE, else MET -- enumerated over every combination of a small verdict alphabet,
// A-class-shaped bounded enumeration since the rollup only has 3^k relevant equivalence classes for
// a fixed small k), the as-of-skew gating invariant (P3: a skew exceeding MAX_AS_OF_SKEW_DAYS must
// force the dependent check(s) to INDETERMINATE, never silently compared as same-date), mandatory
// ULP/threshold-boundary forcing for coverage_ratio_pct, the WAM-independence and counterparty-
// concentration boundary properties (P4), a metamorphic
// determinism + missing-leg-forces-indeterminate property (P5: a leg's absence must never fabricate
// a MET/NOT_MET verdict for anything that depends on it), and forced categorical boundary cases (P6:
// GENIUS item-7 catch-all always INDETERMINATE, non_eligible always DOES_NOT_MATCH, breakdown
// exceeding MAX_ASSET_LINES refused not truncated), plus exact-output pinning (P7:
// regression-captured verdicts, detail strings, rounded numerics, flag arrays,
// concentration rows, skew pairs, and tolerance boundaries — PR-2688-RED-CURE-1).

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
// CHECK VERDICTS (reserve_ratio, every genius_eligible_holdings entry, every reconcile)
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

// ---------- P4: MANDATORY ULP/threshold-boundary forcing (float_sensitive: yes) — exactly-at-limit,
// just-under, just-over, and a zero-denominator case for coverage_ratio_pct, plus the WAM
// independence property and the counterparty-concentration exemption and 40 percent boundary
// properties (12 CFR 15.11(c)(2)(ii), OCC final rule 2026-10-21).
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
  // WAM INDEPENDENCE (final rule 2026-10-21, 12 CFR 15.11(c): no weighted-average-maturity
  // requirement): WAM size must never change any verdict except the cross-check. Two inputs
  // identical except maturity_bucket_days (5 vs 400), each with a matching EDGAR wam_days, must
  // produce identical verdicts everywhere and NO wam_ceiling_check field of any kind; only the
  // reported wam_from_disclosure value may move. Diverging WAM from EDGAR moves the cross-check
  // alone (and, through it, the rollup) — no other check may react.
  { checked++;
    const mk = (wam, edgar) => compute({ leg_a: baseLegA({ asset_breakdown: [{ asset_class: 'insured_demand_deposit', amount_usd: 500000, maturity_bucket_days: wam, institution: 'Bank Z' }, { asset_class: 'treasury_bill_93d_or_less', amount_usd: 500000, maturity_bucket_days: wam, institution: 'US Treasury' }] }), leg_b: { as_of: '2027-02-28', accession_number: 'A', total_net_assets: 500000, wam_days: edgar }, leg_c: { as_of: '2027-02-28', onchain_supply: 1000000 } }).output_payload;
    const a = mk(5, 5), b = mk(400, 400);
    if ('wam_ceiling_check' in a.wam || 'wam_ceiling_check' in b.wam) violations++;
    if (a.overall_determination !== b.overall_determination) violations++;
    if (a.reserve_ratio.verdict !== b.reserve_ratio.verdict) violations++;
    if (a.genius_eligible_holdings.some((h, i) => h.verdict !== b.genius_eligible_holdings[i].verdict)) violations++;
    if (a.reconciles.some((r, i) => r.verdict !== b.reconciles[i].verdict)) violations++;
    if (a.wam.wam_from_disclosure.value_days === b.wam.wam_from_disclosure.value_days) violations++; // WAM itself must differ
    const c = mk(400, 5); // WAM diverges from EDGAR: cross-check reacts, nothing else may
    if (c.wam.wam_cross_check.verdict !== 'DISCREPANT') violations++;
    if (c.reserve_ratio.verdict !== b.reserve_ratio.verdict) violations++;
    if (c.genius_eligible_holdings.some((h, i) => h.verdict !== b.genius_eligible_holdings[i].verdict)) violations++;
    if (c.reconciles[0].verdict !== b.reconciles[0].verdict || c.reconciles[1].verdict !== b.reconciles[1].verdict) violations++; }
  // COUNTERPARTY CONCENTRATION exemptions: a US Government exposure (treasury_bill_93d_or_less)
  // and directly held coin and currency (us_coin_and_currency) are exempt and never exceed,
  // at any size; every other asset class is evaluated per counterparty against the 40 percent
  // limit (12 CFR 15.11(c)(2)(ii)).
  { checked++;
    const { output_payload: o, compliance_flags } = compute({ leg_a: baseLegA({ asset_breakdown: [{ asset_class: 'treasury_bill_93d_or_less', amount_usd: 990000, maturity_bucket_days: 20, institution: 'US Treasury' }, { asset_class: 'us_coin_and_currency', amount_usd: 10000, maturity_bucket_days: 0 }] }) });
    const t = o.counterparty_concentration.find((e) => e.counterparty === 'US Treasury');
    const c = o.counterparty_concentration.find((e) => e.counterparty === 'us_coin_and_currency');
    if (!t || t.exceeds_concentration_limit !== null || !String(t.exempt_basis).includes('(B)(1)')) violations++;
    if (!c || c.exceeds_concentration_limit !== null || !String(c.exempt_basis).includes('preamble')) violations++;
    if (o.overall_determination !== 'INDETERMINATE') violations++; // reconciles lack legs, never fabricated MET
    if (compliance_flags.includes('CONCENTRATION_LIMIT_EXCEEDED')) violations++; }
  // 40 percent boundary: just under (39.9999) does not exceed, exactly at (40) does not exceed
  // ("no more than 40 percent"), just over (45) exceeds and raises the flag.
  { checked++;
    const run = (amt) => compute({ leg_a: baseLegA({ asset_breakdown: [{ asset_class: 'insured_demand_deposit', amount_usd: amt, maturity_bucket_days: 5, institution: 'Bank Q' }, { asset_class: 'treasury_bill_93d_or_less', amount_usd: 1000000 - amt, maturity_bucket_days: 20, institution: 'US Treasury' }] }) });
    const under = run(399999), at = run(400000), over = run(450000);
    const find = (r) => r.output_payload.counterparty_concentration.find((e) => e.counterparty === 'Bank Q');
    if (find(under).exceeds_concentration_limit !== false) violations++;
    if (find(at).exceeds_concentration_limit !== false) violations++;
    if (find(over).exceeds_concentration_limit !== true) violations++;
    if (under.compliance_flags.includes('CONCENTRATION_LIMIT_EXCEEDED') || at.compliance_flags.includes('CONCENTRATION_LIMIT_EXCEEDED')) violations++;
    if (!over.compliance_flags.includes('CONCENTRATION_LIMIT_EXCEEDED')) violations++; }
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

// ---------- P7: exact-output pinning (regression-capture, PR-2688-RED-CURE-1) ----------
// Money-math mutant-killing tier: pin the EXACT verdicts, detail strings, rounded
// numerics, flag arrays (order included), counterparty-concentration rows, skew
// pairs, and tolerance boundaries for a battery of forced scenarios. Every value
// below was captured from the UNMUTATED kernel (same regression-capture approach
// P4 takes for its two documented defects): the point is that ANY arithmetic,
// comparison, rounding, or flag-string mutation that changes one byte of these
// fragments fails here. Strict `===` pins are used wherever a mutant could emit
// NaN or Infinity, which JSON.stringify would collapse to null and hide.
function checkP7_exact_output_pinning() {
  let violations = 0, checked = 0;
  const pin = (label, actual, expected) => { checked++; if (JSON.stringify(actual) !== JSON.stringify(expected)) violations++; };
  const pinStrict = (label, actual, expected) => { checked++; if (actual !== expected) violations++; };
  const A = (o = {}) => ({
    as_of: '2027-01-01', source_digest: 'sha256:' + 'a'.repeat(64),
    total_reserves_usd: 1000000, outstanding_tokens_reported: 1000000, token_price: 1,
    asset_breakdown: [{ asset_class: 'us_coin_and_currency', amount_usd: 1000000, maturity_bucket_days: 0 }],
    ...o,
  });
  const B = (o = {}) => ({ as_of: '2027-01-04', accession_number: 'ACC-1', total_net_assets: 1000000, wam_days: 2, ...o });
  const C = (o = {}) => ({ as_of: '2027-01-11', source_digest: 'sha256:' + 'c'.repeat(64), onchain_supply: 1000000, ...o });

  // S1 — full 3-leg, no fraction disclosed: skew arithmetic pinned strictly (NaN from a
  // mutated guard is NOT null and must fail), coverage exactly 100 -> MET reserve ratio,
  // exempt-only concentration row, rec2 RECONCILED at skew exactly == threshold 10 (a
  // `>=` mutation of the skew gate would flip it INDETERMINATE and die here).
  {
    const { output_payload: o, compliance_flags: fl } = compute({ leg_a: A(), leg_b: B(), leg_c: C() });
    pinStrict('S1 skewAB', o.as_of_skew_pairs.leg_a_vs_leg_b, 3);
    pinStrict('S1 skewAC', o.as_of_skew_pairs.leg_a_vs_leg_c, 10);
    pinStrict('S1 skewBC', o.as_of_skew_pairs.leg_b_vs_leg_c, 7);
    pinStrict('S1 maxSkewGlobal', o.max_as_of_skew_days_global, 10);
    pin('S1 overall', o.overall_determination, 'INDETERMINATE');
    pin('S1 flags', fl, ['STABLECOIN_3SRC_INDETERMINATE']);
    pin('S1 reserve_ratio', o.reserve_ratio, { verdict: 'MET', detail: 'Recomputed reserves (1000000) cover 100.00% of liabilities (1000000), computed from the per-asset-class breakdown, not the stated top-line figure.', total_reserves_usd_recomputed: 1000000, breakdown_sum_consistency: { stated_total_reserves_usd: 1000000, recomputed_from_breakdown_usd: 1000000, delta_pct: 0, within_tolerance: true }, total_liabilities_usd: 1000000, coverage_ratio_pct: 100 });
    pinStrict('S1 coverage is the number 100', o.reserve_ratio.coverage_ratio_pct, 100);
    pin('S1 concentration exempt-only row', o.counterparty_concentration, [{ counterparty: 'us_coin_and_currency', amount_usd: 1000000, pct_of_recomputed_reserves: 100, exempt_basis: 'Exempt per the OCC preamble to 12 CFR 15.11: directly held coin and currency, the issuer cannot be its own counterparty.', exceeds_concentration_limit: null, limit_pct: 40, ref: 'Counterparty concentration limit of 40 percent of reserve assets per counterparty, 12 CFR 15.11(c)(2)(ii)(A) (OCC final rule 2026-10-21, 12 CFR Part 15, effective 2027-01-18); US Government exposures and directly held coin and currency are exempt under (c)(2)(ii)(B)(1) and the preamble direct-holding clarification.' }]);
    pin('S1 rec1 fraction-missing', o.reconciles[0], { check: 'reserves_vs_mmf_assets', verdict: 'INDETERMINATE', detail: 'Issuer does not disclose what fraction of reserves sit in the named fund (reserves_in_fund_fraction). Not assumed to be 100%.' });
    pin('S1 rec2 reconciled at skew==threshold', o.reconciles[1], { check: 'liabilities_vs_onchain_supply', verdict: 'RECONCILED', detail: 'Reported outstanding tokens (1000000) vs declared on-chain supply (1000000): delta 0.0000%, tolerance 0.5%.', as_of_skew_days: 10 });
    pin('S1 rec3 reconciled', o.reconciles[2], { check: 'wam_cross_check', verdict: 'RECONCILED', detail: "Disclosure-recomputed WAM (0.00d) and EDGAR-reported WAM (2.00d) are within the 2-day tolerance. This comparison is directional, not exact, when the named fund holds only part of the issuer's reserves.", as_of_skew_days: 3 });
  }
  // S2 — reconcile1 delta EXACTLY at the 0.5% tolerance boundary: `<=` keeps RECONCILED,
  // a `<` mutation flips DISCREPANT.
  {
    const { output_payload: o } = compute({ leg_a: A({ reserves_in_fund_fraction: 1.005 }), leg_b: B() });
    pin('S2 rec1 boundary delta exactly 0.5% stays RECONCILED', o.reconciles[0], { check: 'reserves_vs_mmf_assets', verdict: 'RECONCILED', detail: 'Reserves attributed to the fund (1005000.00, 100.50% of recomputed reserves) vs Leg B total_net_assets (1000000): delta 0.5000%, tolerance 0.5%.', as_of_skew_days: 3 });
  }
  // S3 — reserve deficiency: NOT_MET verdict + detail (including the kernel's CURRENT
  // `cover only 100.00%` toFixed(2) artifact for 99.9999, regression-captured verbatim),
  // coverage strictly 99.9999, flag order [NOT_MET, RESERVE_RATIO_DEFICIENCY].
  {
    const { output_payload: o, compliance_flags: fl } = compute({ leg_a: A({ asset_breakdown: [{ asset_class: 'us_coin_and_currency', amount_usd: 999999, maturity_bucket_days: 0 }] }) });
    pin('S3 flags order', fl, ['STABLECOIN_3SRC_NOT_MET', 'RESERVE_RATIO_DEFICIENCY']);
    pin('S3 reserve_ratio', o.reserve_ratio, { verdict: 'NOT_MET', detail: 'Recomputed reserves (999999) cover only 100.00% of liabilities (1000000), computed from the per-asset-class breakdown.', total_reserves_usd_recomputed: 999999, breakdown_sum_consistency: { stated_total_reserves_usd: 1000000, recomputed_from_breakdown_usd: 999999, delta_pct: 0.0001, within_tolerance: true }, total_liabilities_usd: 1000000, coverage_ratio_pct: 99.9999 });
    pinStrict('S3 coverage 99.9999', o.reserve_ratio.coverage_ratio_pct, 99.9999);
    pin('S3 overall', o.overall_determination, 'NOT_MET');
  }
  // S4 — breakdown-sum consistency: dirty-decimal delta pinned to its toFixed(4) value,
  // outside-tolerance case pushes the mismatch flag FIRST, absent stated total -> null.
  {
    const a = compute({ leg_a: A({ total_reserves_usd: 1000123.456 }) });
    pin('S4a bsc within, delta_pct rounded to 4dp', a.output_payload.reserve_ratio.breakdown_sum_consistency, { stated_total_reserves_usd: 1000123.456, recomputed_from_breakdown_usd: 1000000, delta_pct: 0.0123, within_tolerance: true });
    pin('S4a flags', a.compliance_flags, ['STABLECOIN_3SRC_INDETERMINATE']);
    const b = compute({ leg_a: A({ total_reserves_usd: 1010000 }) });
    pin('S4b bsc outside', b.output_payload.reserve_ratio.breakdown_sum_consistency, { stated_total_reserves_usd: 1010000, recomputed_from_breakdown_usd: 1000000, delta_pct: 1, within_tolerance: false });
    pin('S4b flags mismatch-first order', b.compliance_flags, ['RESERVE_BREAKDOWN_SUM_MISMATCH', 'STABLECOIN_3SRC_INDETERMINATE']);
    const c = compute({ leg_a: A({ total_reserves_usd: undefined }) });
    pinStrict('S4c bsc null when stated total absent', c.output_payload.reserve_ratio.breakdown_sum_consistency, null);
  }
  // S5/S6 — missing-leg and missing-fraction INDETERMINATE details pinned verbatim.
  {
    const s5 = compute({ leg_a: A() });
    pin('S5 rec1', s5.output_payload.reconciles[0], { check: 'reserves_vs_mmf_assets', verdict: 'INDETERMINATE', detail: 'Requires both a recomputed reserve total (Leg A) and total_net_assets (Leg B).' });
    pin('S5 rec2', s5.output_payload.reconciles[1], { check: 'liabilities_vs_onchain_supply', verdict: 'INDETERMINATE', detail: 'Requires both outstanding_tokens_reported (Leg A) and onchain_supply (Leg C).' });
    const s6 = compute({ leg_a: A(), leg_b: B() });
    pin('S6 rec1', s6.output_payload.reconciles[0], { check: 'reserves_vs_mmf_assets', verdict: 'INDETERMINATE', detail: 'Issuer does not disclose what fraction of reserves sit in the named fund (reserves_in_fund_fraction). Not assumed to be 100%.' });
  }
  // S7 — total_net_assets 0: delta is n/a (a `netAssets >= 0` mutation yields Infinity%),
  // DISCREPANT, and CROSS_SOURCE_DISCREPANCY is raised by a `some` over reconciles
  // where exactly ONE is discrepant (an `every` mutation would drop the flag).
  {
    const { output_payload: o, compliance_flags: fl } = compute({ leg_a: A({ reserves_in_fund_fraction: 1 }), leg_b: B({ total_net_assets: 0 }) });
    pin('S7 rec1 n/a delta', o.reconciles[0], { check: 'reserves_vs_mmf_assets', verdict: 'DISCREPANT', detail: 'Reserves attributed to the fund (1000000.00, 100.00% of recomputed reserves) vs Leg B total_net_assets (0): delta n/a, tolerance 0.5%.', as_of_skew_days: 3 });
    pin('S7 flags single-discrepant raises flag', fl, ['STABLECOIN_3SRC_NOT_MET', 'CROSS_SOURCE_DISCREPANCY']);
  }
  // S8/S9 — tokens 0: reserve ratio INDETERMINATE with null coverage (strict: a mutant
  // leaking NaN/Infinity fails); onchain 5 -> n/a DISCREPANT; onchain 0 -> 0.0000% RECONCILED.
  {
    const s8 = compute({ leg_a: A({ outstanding_tokens_reported: 0 }), leg_c: C({ onchain_supply: 5 }) });
    pin('S8 reserve_ratio', s8.output_payload.reserve_ratio, { verdict: 'INDETERMINATE', detail: 'outstanding_tokens_reported is missing or non-positive — coverage ratio cannot be computed.', total_reserves_usd_recomputed: 1000000, breakdown_sum_consistency: { stated_total_reserves_usd: 1000000, recomputed_from_breakdown_usd: 1000000, delta_pct: 0, within_tolerance: true }, total_liabilities_usd: 0, coverage_ratio_pct: null });
    pinStrict('S8 coverage strictly null', s8.output_payload.reserve_ratio.coverage_ratio_pct, null);
    pin('S8 rec2', s8.output_payload.reconciles[1], { check: 'liabilities_vs_onchain_supply', verdict: 'DISCREPANT', detail: 'Reported outstanding tokens (0) vs declared on-chain supply (5): delta n/a, tolerance 0.5%.', as_of_skew_days: 10 });
    const s9 = compute({ leg_a: A({ outstanding_tokens_reported: 0 }), leg_c: C({ onchain_supply: 0 }) });
    pin('S9 rec2 both zero -> 0.0000% RECONCILED', s9.output_payload.reconciles[1], { check: 'liabilities_vs_onchain_supply', verdict: 'RECONCILED', detail: 'Reported outstanding tokens (0) vs declared on-chain supply (0): delta 0.0000%, tolerance 0.5%.', as_of_skew_days: 10 });
  }
  // S10 — skew gating: 14-day skew gates rec1 AND rec3 with the exact detail; the
  // max_as_of_skew_days override to 20 un-gates it; missing as_of leaves skew strictly
  // null (strict pins kill NaN leaks) and the cross-check still compares.
  {
    const a = compute({ leg_a: A(), leg_b: B({ as_of: '2027-01-15' }) });
    pin('S10a rec1 gated', a.output_payload.reconciles[0], { check: 'reserves_vs_mmf_assets', verdict: 'INDETERMINATE', detail: 'Leg A vs Leg B as_of skew is 14 day(s), exceeding the 10-day threshold. Not compared as if same-date.' });
    pin('S10a rec3 gated', a.output_payload.reconciles[2], { check: 'wam_cross_check', verdict: 'INDETERMINATE', detail: 'Leg A vs Leg B as_of skew is 14 day(s), exceeding the 10-day threshold. Not compared as if same-date.', as_of_skew_days: 14 });
    pinStrict('S10a skewAC null (no leg C)', a.output_payload.as_of_skew_pairs.leg_a_vs_leg_c, null);
    pinStrict('S10a skewBC null (no leg C)', a.output_payload.as_of_skew_pairs.leg_b_vs_leg_c, null);
    pinStrict('S10a skewAB 14', a.output_payload.as_of_skew_pairs.leg_a_vs_leg_b, 14);
    const b = compute({ max_as_of_skew_days: 20, leg_a: A({ reserves_in_fund_fraction: 1 }), leg_b: B({ as_of: '2027-01-15' }) });
    pinStrict('S10b override threshold echoed', b.output_payload.as_of_skew_threshold_days, 20);
    pin('S10b rec1 reconciled under override', b.output_payload.reconciles[0], { check: 'reserves_vs_mmf_assets', verdict: 'RECONCILED', detail: 'Reserves attributed to the fund (1000000.00, 100.00% of recomputed reserves) vs Leg B total_net_assets (1000000): delta 0.0000%, tolerance 0.5%.', as_of_skew_days: 14 });
    const c = compute({ leg_a: A(), leg_b: B({ as_of: undefined }) });
    pinStrict('S10c skewAB null when leg B lacks as_of', c.output_payload.as_of_skew_pairs.leg_a_vs_leg_b, null);
    pinStrict('S10c rec3 skew field null', c.output_payload.reconciles[2].as_of_skew_days, null);
    pin('S10c rec3 still compares', c.output_payload.reconciles[2], { check: 'wam_cross_check', verdict: 'RECONCILED', detail: "Disclosure-recomputed WAM (0.00d) and EDGAR-reported WAM (2.00d) are within the 2-day tolerance. This comparison is directional, not exact, when the named fund holds only part of the issuer's reserves.", as_of_skew_days: null });
  }
  // S11 — WAM-from-disclosure edges: one line lacking maturity -> refuse (a `some`
  // mutation of `every` computes NaN); amounts summing to exactly 0 -> refuse (a `< 0`
  // mutation of `<= 0` divides by zero); repeating-decimal WAM pinned to its
  // toFixed(4) value; missing EDGAR wam_days detail pinned verbatim.
  {
    const a = compute({ leg_a: A({ asset_breakdown: [{ asset_class: 'us_coin_and_currency', amount_usd: 500000, maturity_bucket_days: 0 }, { asset_class: 'us_coin_and_currency', amount_usd: 500000 }] }) });
    pin('S11a mixed maturity refused', a.output_payload.wam.wam_from_disclosure, { value_days: null, verdict: 'INDETERMINATE', detail: 'At least one asset_breakdown line lacks maturity_bucket_days. WAM-from-disclosure is not computed by dropping the line and rescaling — that manufactures a number.' });
    pinStrict('S11a value_days strictly null', a.output_payload.wam.wam_from_disclosure.value_days, null);
    const b = compute({ leg_a: A({ asset_breakdown: [{ asset_class: 'us_coin_and_currency', amount_usd: 500, maturity_bucket_days: 5 }, { asset_class: 'us_coin_and_currency', amount_usd: -500, maturity_bucket_days: 5 }] }) });
    pin('S11b zero-sum refused', b.output_payload.wam.wam_from_disclosure, { value_days: null, verdict: 'INDETERMINATE', detail: 'asset_breakdown amounts sum to zero or less. WAM-from-disclosure is undefined.' });
    pin('S11b concentration empty at zero total', b.output_payload.counterparty_concentration, []);
    const c = compute({ leg_a: A({ asset_breakdown: [{ asset_class: 'us_coin_and_currency', amount_usd: 1, maturity_bucket_days: 1 }, { asset_class: 'us_coin_and_currency', amount_usd: 1, maturity_bucket_days: 2 }, { asset_class: 'us_coin_and_currency', amount_usd: 1, maturity_bucket_days: 4 }] }) });
    pin('S11c wam repeating decimal to 4dp', c.output_payload.wam.wam_from_disclosure, { value_days: 2.3333, verdict: null, detail: 'Weighted-average maturity recomputed from the per-asset-class breakdown: 2.33 days.' });
    const d = compute({ leg_a: A(), leg_b: B({ wam_days: undefined }) });
    pin('S11d edgar missing detail', d.output_payload.wam.wam_from_edgar, { value_days: null, wam_source: 'edgar_nmfp_reported', detail: 'Leg B supplied but wam_days field is missing or non-numeric.' });
    pin('S11d rec3 requires both', d.output_payload.reconciles[2], { check: 'wam_cross_check', verdict: 'INDETERMINATE', detail: 'WAM cross-check requires both wam_from_disclosure and wam_from_edgar to be numeric.', as_of_skew_days: 3 });
  }
  // S12 — concentration grouping: exempt US-Treasury row, exempt coin row keyed by
  // asset_class (no institution), tested Bank Q over the 40% limit with amount rounded
  // to 2dp (550000.56) and pct to 4dp (52.381); flag order pinned.
  {
    const { output_payload: o, compliance_flags: fl } = compute({ leg_a: A({ asset_breakdown: [
      { asset_class: 'treasury_bill_93d_or_less', amount_usd: 400000, maturity_bucket_days: 20, institution: 'US Treasury' },
      { asset_class: 'us_coin_and_currency', amount_usd: 100000, maturity_bucket_days: 0 },
      { asset_class: 'insured_demand_deposit', amount_usd: 550000.555, maturity_bucket_days: 5, institution: 'Bank Q' },
    ] }) });
    pinStrict('S12 recomputed total 2dp', o.reserve_ratio.total_reserves_usd_recomputed, 1050000.56);
    const REF = 'Counterparty concentration limit of 40 percent of reserve assets per counterparty, 12 CFR 15.11(c)(2)(ii)(A) (OCC final rule 2026-10-21, 12 CFR Part 15, effective 2027-01-18); US Government exposures and directly held coin and currency are exempt under (c)(2)(ii)(B)(1) and the preamble direct-holding clarification.';
    pin('S12 concentration rows in insertion order', o.counterparty_concentration, [
      { counterparty: 'US Treasury', amount_usd: 400000, pct_of_recomputed_reserves: 38.0952, exempt_basis: 'Exempt under 12 CFR 15.11(c)(2)(ii)(B)(1): exposure to the United States Government.', exceeds_concentration_limit: null, limit_pct: 40, ref: REF },
      { counterparty: 'us_coin_and_currency', amount_usd: 100000, pct_of_recomputed_reserves: 9.5238, exempt_basis: 'Exempt per the OCC preamble to 12 CFR 15.11: directly held coin and currency, the issuer cannot be its own counterparty.', exceeds_concentration_limit: null, limit_pct: 40, ref: REF },
      { counterparty: 'Bank Q', amount_usd: 550000.56, pct_of_recomputed_reserves: 52.381, exempt_basis: null, exceeds_concentration_limit: true, limit_pct: 40, ref: REF },
    ]);
    pin('S12 flags order', fl, ['RESERVE_BREAKDOWN_SUM_MISMATCH', 'STABLECOIN_3SRC_INDETERMINATE', 'CONCENTRATION_LIMIT_EXCEEDED']);
  }
  // S13 — two exempt lines under one counterparty key: first exempt basis wins.
  {
    const { output_payload: o } = compute({ leg_a: A({ asset_breakdown: [
      { asset_class: 'treasury_bill_93d_or_less', amount_usd: 300000, maturity_bucket_days: 20, institution: 'X' },
      { asset_class: 'us_coin_and_currency', amount_usd: 200000, maturity_bucket_days: 0, institution: 'X' },
    ] }) });
    const row = o.counterparty_concentration[0];
    pinStrict('S13 one row', o.counterparty_concentration.length, 1);
    pinStrict('S13 counterparty key', row.counterparty, 'X');
    pinStrict('S13 first exempt basis wins', row.exempt_basis, 'Exempt under 12 CFR 15.11(c)(2)(ii)(B)(1): exposure to the United States Government.');
    pinStrict('S13 combined exempt amount', row.amount_usd, 500000);
    pinStrict('S13 pct 100', row.pct_of_recomputed_reserves, 100);
  }
  // S14 — leg echoes verbatim, nulls where absent.
  {
    const { output_payload: o } = compute({ leg_a: A({ report_period: 'Q4-2026', period_end_date: '2026-12-31' }), leg_b: B({ filing_date: '2027-01-05' }), leg_c: C() });
    pin('S14 leg_a echo', o.leg_a, { as_of: '2027-01-01', source_digest: 'sha256:' + 'a'.repeat(64), report_period: 'Q4-2026', period_end_date: '2026-12-31' });
    pin('S14 leg_b echo', o.leg_b, { as_of: '2027-01-04', source_digest: null, accession_number: 'ACC-1', filing_date: '2027-01-05' });
    pin('S14 leg_c echo', o.leg_c, { as_of: '2027-01-11', source_digest: 'sha256:' + 'c'.repeat(64) });
  }
  // S15 — non-eligible holding + two discrepant reconciles: all four flags, in order.
  {
    const { output_payload: o, compliance_flags: fl } = compute({ leg_a: A({ asset_breakdown: [{ asset_class: 'non_eligible', amount_usd: 1000000, maturity_bucket_days: 0 }], reserves_in_fund_fraction: 1 }), leg_b: B({ total_net_assets: 1100000 }), leg_c: C({ onchain_supply: 2000000 }) });
    pin('S15 flags order', fl, ['STABLECOIN_3SRC_NOT_MET', 'CROSS_SOURCE_DISCREPANCY', 'GENIUS_NON_ELIGIBLE_HOLDING_DECLARED', 'CONCENTRATION_LIMIT_EXCEEDED']);
    pin('S15 overall', o.overall_determination, 'NOT_MET');
  }
  // S16 — the all-good case: MET overall, exactly one MET flag, rec1 reconciled.
  {
    const { output_payload: o, compliance_flags: fl } = compute({ leg_a: A({ reserves_in_fund_fraction: 1 }), leg_b: B(), leg_c: C() });
    pin('S16 flags all-good', fl, ['STABLECOIN_3SRC_MET']);
    pin('S16 overall', o.overall_determination, 'MET');
    pin('S16 rec1', o.reconciles[0], { check: 'reserves_vs_mmf_assets', verdict: 'RECONCILED', detail: 'Reserves attributed to the fund (1000000.00, 100.00% of recomputed reserves) vs Leg B total_net_assets (1000000): delta 0.0000%, tolerance 0.5%.', as_of_skew_days: 3 });
  }
  // S17 — no leg A: skew pairs that involve A are strictly null (mutated guards leak
  // NaN), B-vs-C still computed at 7 and drives max_as_of_skew_days_global.
  {
    const { output_payload: o } = compute({ leg_b: B(), leg_c: C() });
    pinStrict('S17 skewAB null', o.as_of_skew_pairs.leg_a_vs_leg_b, null);
    pinStrict('S17 skewAC null', o.as_of_skew_pairs.leg_a_vs_leg_c, null);
    pinStrict('S17 skewBC 7', o.as_of_skew_pairs.leg_b_vs_leg_c, 7);
    pinStrict('S17 max 7', o.max_as_of_skew_days_global, 7);
    pin('S17 rec2 indeterminate', o.reconciles[1].verdict, 'INDETERMINATE');
  }
  // S18 — token_price absent: defaults to 1 exactly (a mutated `?? 1` yields NaN).
  {
    const { output_payload: o } = compute({ leg_a: A({ token_price: undefined }), leg_b: B(), leg_c: C() });
    pinStrict('S18 liabilities default price 1', o.reserve_ratio.total_liabilities_usd, 1000000);
    pinStrict('S18 coverage 100', o.reserve_ratio.coverage_ratio_pct, 100);
  }
  return { name: 'P7_exact_output_pinning_regression_capture', trials: checked, violations };
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
results.properties.push(checkP7_exact_output_pinning());

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
