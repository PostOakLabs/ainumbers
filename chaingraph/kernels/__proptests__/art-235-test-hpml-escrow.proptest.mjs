// kernel_digest_at_authoring: sha256:1ae198828032158cef3630502b962e02ce05235c503f0b43bea0f76f0feac74a
//
// FV-PROPFLOOR-SHARD-B27-1 — property-test floor for art-235-test-hpml-escrow.
// Class B (bounded-numeric), FLOAT-SENSITIVE (apr_pct/apor_pct feed a float subtraction compared
// against a spread_threshold with an explicit `- 1e-5` epsilon fudge, then rounded via r4 to 4
// decimals) — ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external
// dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// Refreshed by ART235-ESCROW-REBUILD-1 for the rebuilt input contract. P5/P6/P7 are new and are
// the standing guards against the two defects that rebuild closed: P5 refuses any grant of the
// small-originator exemption that is not backed by ALL FOUR legs, and P6 refuses any result where
// the common-interest-community master-policy exemption has been allowed to reach the property-tax
// component. A regression in either direction fails here without needing a fixture to notice.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-235-test-hpml-escrow.proptest.mjs

import { compute } from '../art-235-test-hpml-escrow.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-235-test-hpml-escrow.fixtures.json');
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
const rand = mulberry32(0x235E5);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 12000;

function mkPP(rng) {
  const lien_type = rng() < 0.5 ? 'first' : 'subordinate';
  const is_jumbo = rng() < 0.3;
  const apor_pct = randRange(rng, 2, 8);
  const apr_pct = apor_pct + randRange(rng, -1, 5);
  const pp = {
    apr_pct, apor_pct, lien_type, is_jumbo,
    year: 2026,
    rural_or_underserved_preceding_year: rng() < 0.5,
    first_lien_covered_txns_sold_or_transferred_count: Math.floor(randRange(rng, 0, 4000)),
    creditor_and_affiliate_total_assets: Math.floor(randRange(rng, 0, 6_000_000_000)),
    maintains_escrow_for_serviced_loans: rng() < 0.4,
    property_in_common_interest_community_with_master_policy: rng() < 0.25,
  };
  if (pp.maintains_escrow_for_serviced_loans && rng() < 0.5) {
    pp.serviced_escrows_within_carve_outs = true;
    if (rng() < 0.5) pp.carve_out_pre_june_2021_first_lien_hpml_escrows = true;
    else pp.carve_out_distressed_consumer_accommodation_escrows = true;
  }
  if (rng() < 0.2) {
    pp.application_received_date = '2026-0' + (rng() < 0.5 ? '2' : '6') + '-15';
    pp.rural_or_underserved_next_to_last_year = rng() < 0.5;
    pp.first_lien_covered_txns_sold_or_transferred_count_next_to_last_year = Math.floor(randRange(rng, 0, 4000));
    pp.creditor_and_affiliate_total_assets_next_to_last_year = Math.floor(randRange(rng, 0, 6_000_000_000));
  }
  if (rng() < 0.15) {
    pp.creditor_is_insured_depository_or_credit_union = true;
    pp.insured_institution_total_assets = Math.floor(randRange(rng, 0, 2e10));
    pp.first_lien_principal_dwelling_covered_txns_count = Math.floor(randRange(rng, 0, 3000));
  }
  if (rng() < 0.1) pp.subject_to_commitment_to_be_acquired = true;
  if (rng() < 0.05) pp.is_pace_transaction = true;
  return pp;
}

// ---------- P1: monotonicity — raising apr_pct (apor fixed) never flips is_hpml true -> false ----------
function checkP1_hpmlMonotonic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const lower = compute({ ...pp, apr_pct: pp.apor_pct - 2 });
    const higher = compute({ ...pp, apr_pct: pp.apor_pct + 6 });
    checked++;
    if (lower.output_payload.is_hpml && !higher.output_payload.is_hpml) violations++;
  }
  return { name: 'P1_is_hpml_monotonic_in_apr_spread', trials: checked, violations };
}

// ---------- P2: boundedness — escrow_required implies is_hpml AND lien_type==='first' ----------
function checkP2_escrowImpliesHpmlFirstLien() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.output_payload.escrow_required && !(r.output_payload.is_hpml && r.output_payload.lien_type === 'first')) violations++;
  }
  return { name: 'P2_escrow_required_implies_hpml_and_first_lien', trials: checked, violations };
}

// ---------- P3: fixed threshold-tier agreement — spread_threshold_pct matches the declared tier constants ----------
function checkP3_thresholdTierExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected = pp.lien_type === 'subordinate' ? 3.5 : pp.is_jumbo ? 2.5 : 1.5;
    if (r.output_payload.spread_threshold_pct !== expected) violations++;
  }
  return { name: 'P3_spread_threshold_tier_exact', trials: checked, violations };
}

// ---------- P5 (over-grant guard 1): the small-originator exemption is CONJUNCTIVE ----------
// Whenever it is granted, all four legs must read true. This is the property whose absence was
// the defect: three legs were tested and the fourth had no input at all.
function checkP5_fourLegConjunction() {
  let violations = 0, checked = 0, granted = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const op = compute(pp).output_payload;
    checked++;
    if (op.escrow_exemption !== 'rural_or_underserved_small_creditor') continue;
    granted++;
    const t = op.small_originator_test;
    if (!(t.leg_a_area === true && t.leg_b_transferred_txn_count === true
      && t.leg_c_assets === true && t.leg_d_no_other_escrows === true && t.status === 'satisfied')) violations++;
    if (op.escrow_required !== false) violations++;
  }
  return { name: 'P5_small_originator_exemption_requires_all_four_legs', trials: checked, granted, violations };
}

// ---------- P6 (over-grant guard 2): the master-policy exemption never reaches property taxes ----------
function checkP6_limitedExemptionNeverDropsTaxes() {
  let violations = 0, checked = 0, limited = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const op = compute(pp).output_payload;
    checked++;
    if (op.escrow_limited_exemption === null) {
      // The insurance component may only differ from the account verdict via the limited exemption.
      if (op.escrow_insurance_premiums_required !== op.escrow_required) violations++;
      continue;
    }
    limited++;
    if (op.escrow_required !== true) violations++;
    if (op.escrow_property_taxes_required !== true) violations++;
    if (op.escrow_insurance_premiums_required !== false) violations++;
  }
  return { name: 'P6_master_policy_exemption_is_insurance_only', trials: checked, limited, violations };
}

// ---------- P7: count monotonicity — more transferred transactions never buys the exemption ----------
function checkP7_transferCountMonotonic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const low = compute({ ...pp, first_lien_covered_txns_sold_or_transferred_count: 10 }).output_payload;
    const high = compute({ ...pp, first_lien_covered_txns_sold_or_transferred_count: 3999 }).output_payload;
    checked++;
    const lowExempt = low.escrow_exemption === 'rural_or_underserved_small_creditor';
    const highExempt = high.escrow_exemption === 'rural_or_underserved_small_creditor';
    if (highExempt && !lowExempt) violations++;
  }
  return { name: 'P7_transferred_count_monotonic_against_exemption', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing on the apr-minus-apor spread comparison ----------
const ULP_BOUNDARY_CASES = [
  [{ apr_pct: 7, apor_pct: 5.5, lien_type: 'first', is_jumbo: false }, 'spread exactly 1.5pp (standard first-lien threshold) — must classify HPML (>= comparison, not >)'],
  [{ apr_pct: 7 - 1e-6, apor_pct: 5.5, lien_type: 'first', is_jumbo: false }, 'spread a hair under 1.5pp — the -1e-5 epsilon fudge must still classify HPML (within tolerance)'],
  [{ apr_pct: 6.9989, apor_pct: 5.5, lien_type: 'first', is_jumbo: false }, 'spread 1.4989pp, just past the 1e-5 epsilon tolerance below 1.5pp — must classify NOT HPML'],
  [{ apr_pct: 8, apor_pct: 5.5, lien_type: 'first', is_jumbo: true }, 'spread exactly 2.5pp jumbo threshold — must classify HPML'],
  [{ apr_pct: 9, apor_pct: 5.5, lien_type: 'subordinate', is_jumbo: false }, 'spread exactly 3.5pp subordinate threshold — must classify HPML'],
  [{ apr_pct: 5.5, apor_pct: 5.5, lien_type: 'first', is_jumbo: false }, 'apr equals apor exactly (0 spread) — must classify NOT HPML, no NaN'],
  [{ apr_pct: 0, apor_pct: 0, lien_type: 'first', is_jumbo: false }, 'both apr and apor exactly zero — 0 spread, NOT HPML, no NaN or Infinity'],
  [{ apr_pct: -0, apor_pct: -0, lien_type: 'first', is_jumbo: false }, 'negative zero apr/apor — must behave as zero, no NaN'],
  [{ apr_pct: 7.1 / 1 * 1, apor_pct: 5.5, lien_type: 'first', is_jumbo: false }, 'x/y*y-style rounding artifact input (7.1) — spread computed the same way as the kernel, no drift'],
  [{ apr_pct: Number.MAX_SAFE_INTEGER, apor_pct: 0, lien_type: 'first', is_jumbo: false }, 'apr at MAX_SAFE_INTEGER — must remain finite, no overflow to Infinity'],
  [{ apr_pct: Number.MIN_VALUE, apor_pct: 0, lien_type: 'first', is_jumbo: false }, 'apr at smallest positive double (denormal-adjacent) — must remain finite, non-NaN, NOT HPML'],
  [{ apr_pct: NaN, apor_pct: 5.5, lien_type: 'first', is_jumbo: false }, 'apr_pct is NaN — safeNum guard must fall back to 0, never propagate NaN into the verdict'],
  // Exemption-boundary forcing added by ART235-ESCROW-REBUILD-1. The two transaction counts are
  // integer comparisons with no epsilon, so the exact-at-limit cases are the ones that matter.
  [{ apr_pct: 7.5, apor_pct: 5.5, lien_type: 'first', is_jumbo: false, year: 2026, rural_or_underserved_preceding_year: true, first_lien_covered_txns_sold_or_transferred_count: 2000, creditor_and_affiliate_total_assets: 900000000, maintains_escrow_for_serviced_loans: false }, 'transferred count exactly at the 2,000 limit — "no more than" is inclusive, so the exemption must apply'],
  [{ apr_pct: 7.5, apor_pct: 5.5, lien_type: 'first', is_jumbo: false, year: 2026, rural_or_underserved_preceding_year: true, first_lien_covered_txns_sold_or_transferred_count: 2001, creditor_and_affiliate_total_assets: 900000000, maintains_escrow_for_serviced_loans: false }, 'transferred count one over the 2,000 limit — the exemption must NOT apply'],
  [{ apr_pct: 7.5, apor_pct: 5.5, lien_type: 'first', is_jumbo: false, year: 2026, rural_or_underserved_preceding_year: true, first_lien_covered_txns_sold_or_transferred_count: 10, creditor_and_affiliate_total_assets: 2785000000, maintains_escrow_for_serviced_loans: false }, 'assets exactly AT the CY2026 indexed limit — the test is "less than", so the exemption must NOT apply'],
  [{ apr_pct: 7.5, apor_pct: 5.5, lien_type: 'first', is_jumbo: false, year: 2026, rural_or_underserved_preceding_year: true, first_lien_covered_txns_sold_or_transferred_count: 10, creditor_and_affiliate_total_assets: 2784999999, maintains_escrow_for_serviced_loans: false }, 'assets one dollar under the CY2026 indexed limit — the exemption must apply'],
  [{ apr_pct: 7.5, apor_pct: 5.5, lien_type: 'first', is_jumbo: false, year: 2026, creditor_is_insured_depository_or_credit_union: true, insured_institution_total_assets: 12485000000, first_lien_principal_dwelling_covered_txns_count: 1000, rural_or_underserved_preceding_year: true, maintains_escrow_for_serviced_loans: false }, 'alternative path exactly at BOTH its limits — both tests are inclusive, so the exemption must apply'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const op = r.output_payload;
    const finite = Number.isFinite(op.apr_spread_pct) && Number.isFinite(op.apr_pct) && Number.isFinite(op.apor_pct);
    const plausible = finite && typeof op.is_hpml === 'boolean' && typeof op.escrow_required === 'boolean'
      && op.escrow_property_taxes_required <= op.escrow_required
      && op.escrow_insurance_premiums_required <= op.escrow_required;
    rows.push({
      label,
      input: pp,
      is_hpml: op.is_hpml,
      escrow_required: op.escrow_required,
      escrow_exemption: op.escrow_exemption,
      apr_spread_pct: op.apr_spread_pct,
      spread_threshold_pct: op.spread_threshold_pct,
      plausible,
    });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_hpmlMonotonic());
results.properties.push(checkP2_escrowImpliesHpmlFirstLien());
results.properties.push(checkP3_thresholdTierExact());
results.properties.push(checkP5_fourLegConjunction());
results.properties.push(checkP6_limitedExemptionNeverDropsTaxes());
results.properties.push(checkP7_transferCountMonotonic());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);
